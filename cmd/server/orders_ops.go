package main

import (
	"context"
	"errors"
	"net/http"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5"
)

type OpcionOrden struct {
	Grupo  string `json:"grupo"`
	Nombre string `json:"nombre"`
}

type ItemOrden struct {
	Nombre   string        `json:"nombre"`
	Cantidad int           `json:"cantidad"`
	Nota     *string       `json:"nota"`
	Opciones []OpcionOrden `json:"opciones"`
}

type Orden struct {
	ID              int          `json:"id"`
	CreadaEn        time.Time    `json:"creada_en"`
	PagadaEn        *time.Time   `json:"pagada_en"`
	Tipo            string       `json:"tipo"`
	Total           int          `json:"total_centavos"`
	Envio           int          `json:"envio_centavos"`
	EstadoPago      string       `json:"estado_pago"`
	EstadoCocina    string       `json:"estado_cocina"`
	MetodoPago      *string      `json:"metodo_pago"`
	MontoRecibido   *int         `json:"monto_recibido_centavos"`
	Cambio          *int         `json:"cambio_centavos"`
	Nota            *string      `json:"nota"`
	ClienteNombre   *string      `json:"cliente_nombre"`
	ClienteTelefono *string      `json:"cliente_telefono"`
	Direccion       *string      `json:"direccion"`
	Referencias     *string      `json:"referencias"`
	Items           []*ItemOrden `json:"items"`
}

// Inicio del día actual en hora de México
const hoyWhere = `creada_en >= (date_trunc('day', now() AT TIME ZONE 'America/Mexico_City') AT TIME ZONE 'America/Mexico_City')`

func estadoTexto(e string) string {
	switch e {
	case "pagado":
		return "pagada"
	case "cancelado":
		return "cancelada"
	}
	return e
}

// where y orderBy son constantes del código (nunca vienen del usuario); los valores van en args.
func (a *App) loadOrders(ctx context.Context, where, orderBy string, limit int, args ...any) ([]*Orden, error) {
	rows1, err := a.db.Query(ctx, `
		SELECT id, creada_en, pagada_en, tipo, total_centavos, envio_centavos,
		       estado_pago, estado_cocina, metodo_pago, monto_recibido_centavos,
		       nota, cliente_nombre, cliente_telefono, direccion, referencias
		FROM ordenes WHERE `+where+` ORDER BY `+orderBy+` LIMIT `+strconv.Itoa(limit), args...)
	if err != nil {
		return nil, err
	}
	defer rows1.Close()

	ordenes := []*Orden{}
	porID := map[int32]*Orden{}
	ids := []int32{}
	for rows1.Next() {
		o := &Orden{Items: []*ItemOrden{}}
		if err := rows1.Scan(&o.ID, &o.CreadaEn, &o.PagadaEn, &o.Tipo, &o.Total, &o.Envio,
			&o.EstadoPago, &o.EstadoCocina, &o.MetodoPago, &o.MontoRecibido,
			&o.Nota, &o.ClienteNombre, &o.ClienteTelefono, &o.Direccion, &o.Referencias); err != nil {
			return nil, err
		}
		if o.MontoRecibido != nil {
			cambio := *o.MontoRecibido - o.Total
			o.Cambio = &cambio
		}
		ordenes = append(ordenes, o)
		porID[int32(o.ID)] = o
		ids = append(ids, int32(o.ID))
	}
	if err := rows1.Err(); err != nil {
		return nil, err
	}
	rows1.Close()
	if len(ordenes) == 0 {
		return ordenes, nil
	}

	// Productos de esas órdenes
	rows2, err := a.db.Query(ctx, `
		SELECT id, orden_id, nombre_producto, cantidad, nota
		FROM detalles_orden WHERE orden_id = ANY($1) ORDER BY id`, ids)
	if err != nil {
		return nil, err
	}
	defer rows2.Close()

	porDetalle := map[int32]*ItemOrden{}
	detalleIDs := []int32{}
	for rows2.Next() {
		var did, oid int32
		it := &ItemOrden{Opciones: []OpcionOrden{}}
		if err := rows2.Scan(&did, &oid, &it.Nombre, &it.Cantidad, &it.Nota); err != nil {
			return nil, err
		}
		porID[oid].Items = append(porID[oid].Items, it)
		porDetalle[did] = it
		detalleIDs = append(detalleIDs, did)
	}
	if err := rows2.Err(); err != nil {
		return nil, err
	}
	rows2.Close()
	if len(detalleIDs) == 0 {
		return ordenes, nil
	}

	// Opciones elegidas de cada producto
	rows3, err := a.db.Query(ctx, `
		SELECT detalle_id, nombre_grupo, nombre_opcion
		FROM detalle_opciones WHERE detalle_id = ANY($1) ORDER BY id`, detalleIDs)
	if err != nil {
		return nil, err
	}
	defer rows3.Close()

	for rows3.Next() {
		var did int32
		var op OpcionOrden
		if err := rows3.Scan(&did, &op.Grupo, &op.Nombre); err != nil {
			return nil, err
		}
		porDetalle[did].Opciones = append(porDetalle[did].Opciones, op)
	}
	if err := rows3.Err(); err != nil {
		return nil, err
	}
	return ordenes, nil
}

// GET /api/orders
//   (sin parámetros) o ?vista=hoy  -> historial de hoy (hora de México)
//   ?vista=cocina                  -> por preparar/entregar (tablet del chef), la más vieja primero
//   ?vista=por_cobrar              -> pendientes de pago
//   ?fecha=YYYY-MM-DD              -> historial de un día
func (a *App) listOrders(c *gin.Context) {
	where := hoyWhere
	orderBy := "creada_en DESC"
	var args []any

	switch {
	case c.Query("vista") == "cocina":
		where = `estado_cocina <> 'entregada' AND estado_pago <> 'cancelado' AND creada_en >= now() - interval '1 day'`
		orderBy = "creada_en ASC"
	case c.Query("vista") == "por_cobrar":
		where = `estado_pago = 'pendiente' AND creada_en >= now() - interval '1 day'`
		orderBy = "creada_en ASC"
	case c.Query("fecha") != "":
		d, err := time.Parse("2006-01-02", c.Query("fecha"))
		if err != nil {
			c.JSON(400, gin.H{"error": "fecha inválida, usa YYYY-MM-DD"})
			return
		}
		where = `creada_en >= ($1::date::timestamp AT TIME ZONE 'America/Mexico_City')
		         AND creada_en < (($1::date + 1)::timestamp AT TIME ZONE 'America/Mexico_City')`
		args = []any{d}
	}

	ordenes, err := a.loadOrders(c.Request.Context(), where, orderBy, 500, args...)
	if err != nil {
		fail(c, err)
		return
	}
	c.JSON(http.StatusOK, ordenes)
}

// GET /api/orders/:id
func (a *App) getOrder(c *gin.Context) {
	id, ok := idParam(c, "id")
	if !ok {
		return
	}
	ordenes, err := a.loadOrders(c.Request.Context(), "id = $1", "id", 1, id)
	if err != nil {
		fail(c, err)
		return
	}
	if len(ordenes) == 0 {
		c.JSON(404, gin.H{"error": "la orden no existe"})
		return
	}
	c.JSON(http.StatusOK, ordenes[0])
}

type pagoReq struct {
	MetodoPago    string `json:"metodo_pago" binding:"required,oneof=efectivo transferencia tarjeta"`
	MontoRecibido *int   `json:"monto_recibido_centavos"`
}

// PATCH /api/orders/:id/pagar
func (a *App) payOrder(c *gin.Context) {
	id, ok := idParam(c, "id")
	if !ok {
		return
	}
	var req pagoReq
	if !bindJSON(c, &req) {
		return
	}

	ctx := c.Request.Context()
	tx, err := a.db.Begin(ctx)
	if err != nil {
		fail(c, err)
		return
	}
	defer tx.Rollback(ctx)

	var total int
	var estado string
	err = tx.QueryRow(ctx,
		`SELECT total_centavos, estado_pago FROM ordenes WHERE id = $1 FOR UPDATE`, id).
		Scan(&total, &estado)
	if errors.Is(err, pgx.ErrNoRows) {
		c.JSON(404, gin.H{"error": "la orden no existe"})
		return
	}
	if err != nil {
		fail(c, err)
		return
	}
	if estado != "pendiente" {
		c.JSON(409, gin.H{"error": "la orden ya está " + estadoTexto(estado)})
		return
	}

	recibido := total // transferencia o tarjeta: se cobra exacto
	if req.MetodoPago == "efectivo" {
		if req.MontoRecibido == nil || *req.MontoRecibido < total {
			c.JSON(400, gin.H{"error": "el monto recibido no alcanza para cubrir el total"})
			return
		}
		recibido = *req.MontoRecibido
	}

	if _, err := tx.Exec(ctx, `
		UPDATE ordenes
		SET estado_pago = 'pagado', metodo_pago = $1,
		    monto_recibido_centavos = $2, pagada_en = now()
		WHERE id = $3`, req.MetodoPago, recibido, id); err != nil {
		fail(c, err)
		return
	}
	if err := tx.Commit(ctx); err != nil {
		fail(c, err)
		return
	}

	c.JSON(200, gin.H{
		"id":                      id,
		"total_centavos":          total,
		"monto_recibido_centavos": recibido,
		"cambio_centavos":         recibido - total,
	})
}

type cocinaReq struct {
	Estado string `json:"estado" binding:"required,oneof=pendiente en_preparacion lista en_camino entregada"`
}

// PATCH /api/orders/:id/cocina
func (a *App) setKitchenState(c *gin.Context) {
	id, ok := idParam(c, "id")
	if !ok {
		return
	}
	var req cocinaReq
	if !bindJSON(c, &req) {
		return
	}

	tag, err := a.db.Exec(c.Request.Context(), `
		UPDATE ordenes SET estado_cocina = $1
		WHERE id = $2 AND estado_pago <> 'cancelado'`, req.Estado, id)
	if err != nil {
		fail(c, err)
		return
	}
	if tag.RowsAffected() == 0 {
		c.JSON(404, gin.H{"error": "la orden no existe o está cancelada"})
		return
	}
	c.JSON(200, gin.H{"id": id, "estado_cocina": req.Estado})
}

// PATCH /api/orders/:id/cancelar  (solo órdenes pendientes de pago)
func (a *App) cancelOrder(c *gin.Context) {
	id, ok := idParam(c, "id")
	if !ok {
		return
	}
	ctx := c.Request.Context()

	tag, err := a.db.Exec(ctx,
		`UPDATE ordenes SET estado_pago = 'cancelado' WHERE id = $1 AND estado_pago = 'pendiente'`, id)
	if err != nil {
		fail(c, err)
		return
	}
	if tag.RowsAffected() == 1 {
		c.JSON(200, gin.H{"id": id, "estado_pago": "cancelado"})
		return
	}

	var estado string
	err = a.db.QueryRow(ctx, `SELECT estado_pago FROM ordenes WHERE id = $1`, id).Scan(&estado)
	if errors.Is(err, pgx.ErrNoRows) {
		c.JSON(404, gin.H{"error": "la orden no existe"})
		return
	}
	if err != nil {
		fail(c, err)
		return
	}
	c.JSON(409, gin.H{"error": "la orden ya está " + estadoTexto(estado) + ", no se puede cancelar"})
}