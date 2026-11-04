package main

import (
	"context"
	"net/http"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
)

// where y orderBy son constantes del código (nunca vienen del usuario); los valores van en args.
func (a *App) loadOrders(ctx context.Context, where, orderBy string, limit int, args ...any) ([]*Orden, error) {
	rows1, err := a.db.Query(ctx, `
		SELECT id, creada_en, pagada_en, tipo, total_centavos, envio_centavos, abonado_centavos,
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
		if err := rows1.Scan(&o.ID, &o.CreadaEn, &o.PagadaEn, &o.Tipo, &o.Total, &o.Envio, &o.Abonado,
			&o.EstadoPago, &o.EstadoCocina, &o.MetodoPago, &o.MontoRecibido,
			&o.Nota, &o.ClienteNombre, &o.ClienteTelefono, &o.Direccion, &o.Referencias); err != nil {
			return nil, err
		}
		o.Pendiente = o.Total - o.Abonado
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
//
//	(sin parámetros) o ?vista=hoy  -> historial de hoy (hora de México)
//	?vista=cocina                  -> pedidos activos (no entregados ni cancelados), el más viejo primero
//	?vista=por_cobrar              -> pendientes de pago
//	?fecha=YYYY-MM-DD              -> historial de un día
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
