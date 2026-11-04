package main

import (
	"errors"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5"
)

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

// PATCH /api/orders/:id/cancelar  (solo pendientes y sin dinero abonado)
func (a *App) cancelOrder(c *gin.Context) {
	id, ok := idParam(c, "id")
	if !ok {
		return
	}
	ctx := c.Request.Context()

	tag, err := a.db.Exec(ctx, `
		UPDATE ordenes SET estado_pago = 'cancelado'
		WHERE id = $1 AND estado_pago = 'pendiente' AND abonado_centavos = 0`, id)
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
	if estado == "pendiente" {
		c.JSON(409, gin.H{"error": "el pedido ya tiene un abono, no se puede cancelar"})
		return
	}
	c.JSON(409, gin.H{"error": "la orden ya está " + estadoTexto(estado) + ", no se puede cancelar"})
}
