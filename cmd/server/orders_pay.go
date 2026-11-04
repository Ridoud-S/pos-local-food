package main

import (
	"errors"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5"
)

type pagoReq struct {
	MetodoPago    string `json:"metodo_pago" binding:"required,oneof=efectivo transferencia tarjeta"`
	MontoRecibido *int   `json:"monto_recibido_centavos"`
}

// PATCH /api/orders/:id/pagar  (cobra solo lo pendiente: total - abonado)
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

	var total, abonado int
	var estado string
	err = tx.QueryRow(ctx,
		`SELECT total_centavos, abonado_centavos, estado_pago FROM ordenes WHERE id = $1 FOR UPDATE`, id).
		Scan(&total, &abonado, &estado)
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

	due := total - abonado // lo que falta por cobrar
	recibido := due        // transferencia o tarjeta: se cobra exacto
	if req.MetodoPago == "efectivo" {
		if req.MontoRecibido == nil || *req.MontoRecibido < due {
			c.JSON(400, gin.H{"error": "el monto recibido no alcanza para cubrir lo pendiente"})
			return
		}
		recibido = *req.MontoRecibido
	}

	if _, err := tx.Exec(ctx, `
		UPDATE ordenes
		SET estado_pago = 'pagado', metodo_pago = $1,
		    monto_recibido_centavos = $2, abonado_centavos = total_centavos, pagada_en = now()
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
		"cobrado_centavos":        due,
		"monto_recibido_centavos": recibido,
		"cambio_centavos":         recibido - due,
	})
}
