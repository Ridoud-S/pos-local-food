package main

import (
	"context"
	"errors"
	"fmt"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5"
)

type itemReq struct {
	ProductoID int    `json:"producto_id" binding:"required"`
	Cantidad   int    `json:"cantidad" binding:"required,min=1,max=50"`
	Opciones   []int  `json:"opciones" binding:"max=30"`
	Nota       string `json:"nota" binding:"max=200"`
}

type orderReq struct {
	Items           []itemReq `json:"items" binding:"required,min=1,max=50,dive"`
	Nota            string    `json:"nota" binding:"max=300"`
	Tipo            string    `json:"tipo" binding:"omitempty,oneof=local llevar domicilio"`
	ClienteNombre   string    `json:"cliente_nombre" binding:"max=100"`
	ClienteTelefono string    `json:"cliente_telefono" binding:"max=20"`
	Direccion       string    `json:"direccion" binding:"max=250"`
	Referencias     string    `json:"referencias" binding:"max=250"`
}

// Error de validación del cliente (400), distinto de un error interno (500)
type badRequest string

func (e badRequest) Error() string { return string(e) }

// POST /api/orders
func (a *App) createOrder(c *gin.Context) {
	var req orderReq
	if !bindJSON(c, &req) {
		return
	}

	if req.Tipo == "" {
		req.Tipo = "local"
	}
	req.ClienteNombre = strings.TrimSpace(req.ClienteNombre)
	req.ClienteTelefono = strings.TrimSpace(req.ClienteTelefono)
	req.Direccion = strings.TrimSpace(req.Direccion)
	req.Referencias = strings.TrimSpace(req.Referencias)

	if req.Tipo == "domicilio" && (req.Direccion == "" || req.ClienteTelefono == "") {
		c.JSON(400, gin.H{"error": "un domicilio necesita dirección y teléfono"})
		return
	}

	ctx := c.Request.Context()
	tx, err := a.db.Begin(ctx)
	if err != nil {
		fail(c, err)
		return
	}
	defer tx.Rollback(ctx)

	// Costo de envío: solo aplica a domicilios y sale de la tabla ajustes
	envio := 0
	if req.Tipo == "domicilio" {
		if err := tx.QueryRow(ctx,
			`SELECT valor::int FROM ajustes WHERE clave = 'envio_centavos'`).Scan(&envio); err != nil {
			fail(c, err)
			return
		}
	}

	var ordenID int
	err = tx.QueryRow(ctx, `
		INSERT INTO ordenes (total_centavos, nota, tipo, cliente_nombre, cliente_telefono,
		                     direccion, referencias, envio_centavos)
		VALUES (0, NULLIF($1,''), $2, NULLIF($3,''), NULLIF($4,''), NULLIF($5,''), NULLIF($6,''), $7)
		RETURNING id`,
		req.Nota, req.Tipo, req.ClienteNombre, req.ClienteTelefono,
		req.Direccion, req.Referencias, envio).Scan(&ordenID)
	if err != nil {
		fail(c, err)
		return
	}

	total := envio
	for _, it := range req.Items {
		sub, err := addItem(ctx, tx, ordenID, it)
		if err != nil {
			var br badRequest
			if errors.As(err, &br) {
				c.JSON(400, gin.H{"error": br.Error()})
				return
			}
			fail(c, err)
			return
		}
		total += sub
	}

	if _, err := tx.Exec(ctx,
		`UPDATE ordenes SET total_centavos = $1 WHERE id = $2`, total, ordenID); err != nil {
		fail(c, err)
		return
	}
	if err := tx.Commit(ctx); err != nil {
		fail(c, err)
		return
	}

	c.JSON(201, gin.H{
		"id":             ordenID,
		"tipo":           req.Tipo,
		"envio_centavos": envio,
		"total_centavos": total,
	})
}

type addItemsReq struct {
	Items []itemReq `json:"items" binding:"required,min=1,max=50,dive"`
}

// POST /api/orders/:id/items
// Agrega productos a un pedido existente. Si ya estaba pagado y el nuevo total
// supera lo abonado, vuelve a 'pendiente' y solo se cobra la diferencia.
func (a *App) addOrderItems(c *gin.Context) {
	id, ok := idParam(c, "id")
	if !ok {
		return
	}
	var req addItemsReq
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

	var total, abonado int
	var pago, cocina string
	err = tx.QueryRow(ctx, `
		SELECT total_centavos, abonado_centavos, estado_pago, estado_cocina
		FROM ordenes WHERE id = $1 FOR UPDATE`, id).Scan(&total, &abonado, &pago, &cocina)
	if errors.Is(err, pgx.ErrNoRows) {
		c.JSON(404, gin.H{"error": "la orden no existe"})
		return
	}
	if err != nil {
		fail(c, err)
		return
	}
	if pago == "cancelado" {
		c.JSON(409, gin.H{"error": "la orden está cancelada"})
		return
	}
	if cocina == "entregada" {
		c.JSON(409, gin.H{"error": "la orden ya fue entregada, crea un pedido nuevo"})
		return
	}

	extra := 0
	for _, it := range req.Items {
		sub, err := addItem(ctx, tx, id, it)
		if err != nil {
			var br badRequest
			if errors.As(err, &br) {
				c.JSON(400, gin.H{"error": br.Error()})
				return
			}
			fail(c, err)
			return
		}
		extra += sub
	}

	nuevoTotal := total + extra
	if _, err := tx.Exec(ctx, `
		UPDATE ordenes
		SET total_centavos = $1,
		    estado_pago = CASE WHEN $1 > abonado_centavos THEN 'pendiente' ELSE estado_pago END
		WHERE id = $2`, nuevoTotal, id); err != nil {
		fail(c, err)
		return
	}
	if err := tx.Commit(ctx); err != nil {
		fail(c, err)
		return
	}

	c.JSON(200, gin.H{
		"id":                 id,
		"total_centavos":     nuevoTotal,
		"abonado_centavos":   abonado,
		"pendiente_centavos": nuevoTotal - abonado,
	})
}

func addItem(ctx context.Context, tx pgx.Tx, ordenID int, it itemReq) (int, error) {
	// Producto
	var nombre string
	var precio int
	err := tx.QueryRow(ctx,
		`SELECT nombre, precio_centavos FROM productos WHERE id = $1 AND activo`,
		it.ProductoID).Scan(&nombre, &precio)
	if errors.Is(err, pgx.ErrNoRows) {
		return 0, badRequest(fmt.Sprintf("el producto %d no existe o está inactivo", it.ProductoID))
	}
	if err != nil {
		return 0, err
	}

	// Reglas de grupos de este producto
	type regla struct {
		nombre   string
		min, max int
		count    int
	}
	reglas := map[int]*regla{}
	rows, err := tx.Query(ctx, `
		SELECT pg.grupo_id, g.nombre, pg.min_selecciones, pg.max_selecciones
		FROM producto_grupos pg
		JOIN grupos_opciones g ON g.id = pg.grupo_id
		WHERE pg.producto_id = $1 AND g.activo`, it.ProductoID)
	if err != nil {
		return 0, err
	}
	for rows.Next() {
		var gid int
		r := &regla{}
		if err := rows.Scan(&gid, &r.nombre, &r.min, &r.max); err != nil {
			rows.Close()
			return 0, err
		}
		reglas[gid] = r
	}
	rows.Close()
	if err := rows.Err(); err != nil {
		return 0, err
	}

	// Opciones elegidas
	type seleccion struct {
		id     int
		grupo  string
		nombre string
		extra  int
	}
	var sels []seleccion
	vistas := map[int]bool{}
	extras := 0

	for _, oid := range it.Opciones {
		if vistas[oid] {
			continue // ignora duplicados
		}
		vistas[oid] = true

		var gid, extra int
		var onombre, gnombre string
		err := tx.QueryRow(ctx, `
			SELECT o.grupo_id, o.nombre, o.precio_extra_centavos, g.nombre
			FROM opciones o
			JOIN grupos_opciones g ON g.id = o.grupo_id
			WHERE o.id = $1 AND o.activo AND g.activo`, oid).
			Scan(&gid, &onombre, &extra, &gnombre)
		if errors.Is(err, pgx.ErrNoRows) {
			return 0, badRequest(fmt.Sprintf("la opción %d no existe o está inactiva", oid))
		}
		if err != nil {
			return 0, err
		}
		r, ok := reglas[gid]
		if !ok {
			return 0, badRequest(fmt.Sprintf("'%s' no aplica a '%s'", onombre, nombre))
		}
		r.count++
		extras += extra
		sels = append(sels, seleccion{oid, gnombre, onombre, extra})
	}

	// Validar mínimos y máximos
	for _, r := range reglas {
		if r.count < r.min {
			return 0, badRequest(fmt.Sprintf("'%s' en '%s': elige al menos %d", r.nombre, nombre, r.min))
		}
		if r.count > r.max {
			return 0, badRequest(fmt.Sprintf("'%s' en '%s': elige máximo %d", r.nombre, nombre, r.max))
		}
	}

	subtotal := (precio + extras) * it.Cantidad

	var detalleID int
	err = tx.QueryRow(ctx, `
		INSERT INTO detalles_orden
			(orden_id, producto_id, nombre_producto, precio_unitario_centavos, cantidad, subtotal_centavos, nota)
		VALUES ($1, $2, $3, $4, $5, $6, NULLIF($7, ''))
		RETURNING id`,
		ordenID, it.ProductoID, nombre, precio, it.Cantidad, subtotal, it.Nota).Scan(&detalleID)
	if err != nil {
		return 0, err
	}

	for _, s := range sels {
		if _, err := tx.Exec(ctx, `
			INSERT INTO detalle_opciones
				(detalle_id, opcion_id, nombre_grupo, nombre_opcion, precio_extra_centavos)
			VALUES ($1, $2, $3, $4, $5)`,
			detalleID, s.id, s.grupo, s.nombre, s.extra); err != nil {
			return 0, err
		}
	}

	return subtotal, nil
}
