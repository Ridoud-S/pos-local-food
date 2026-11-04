package main

import (
	"strconv"

	"github.com/gin-gonic/gin"
)

type DiaStats struct {
	Dia               string `json:"dia"` // "2026-10-30"
	Ordenes           int    `json:"ordenes"`
	CobradoCentavos   int    `json:"cobrado_centavos"`
	PendienteCentavos int    `json:"pendiente_centavos"`
}

func diasParam(c *gin.Context) int {
	n, err := strconv.Atoi(c.DefaultQuery("dias", "7"))
	if err != nil || n < 1 || n > 365 {
		return 7
	}
	return n
}

// GET /stats/dias?dias=7  -> dinero por día
func (a *App) statsDias(c *gin.Context) {
	rows, err := a.db.Query(c.Request.Context(), `
		SELECT to_char((creada_en AT TIME ZONE 'America/Mexico_City')::date, 'YYYY-MM-DD') AS dia,
		       COUNT(*)::int,
		       COALESCE(SUM(abonado_centavos), 0)::int,
		       COALESCE(SUM(total_centavos - abonado_centavos) FILTER (WHERE estado_pago = 'pendiente'), 0)::int
		FROM ordenes
		WHERE estado_pago <> 'cancelado'
		  AND creada_en >= now() - make_interval(days => $1::int)
		GROUP BY 1
		ORDER BY 1 DESC`, diasParam(c))
	if err != nil {
		fail(c, err)
		return
	}
	defer rows.Close()

	out := []DiaStats{}
	for rows.Next() {
		var d DiaStats
		if err := rows.Scan(&d.Dia, &d.Ordenes, &d.CobradoCentavos, &d.PendienteCentavos); err != nil {
			fail(c, err)
			return
		}
		out = append(out, d)
	}
	if err := rows.Err(); err != nil {
		fail(c, err)
		return
	}
	c.JSON(200, out)
}

type TopProducto struct {
	Nombre           string `json:"nombre"`
	Piezas           int    `json:"piezas"`
	IngresosCentavos int    `json:"ingresos_centavos"`
}

// GET /stats/top?dias=7 -> productos más vendidos
func (a *App) statsTop(c *gin.Context) {
	rows, err := a.db.Query(c.Request.Context(), `
		SELECT d.nombre_producto,
		       SUM(d.cantidad)::int,
		       SUM(d.subtotal_centavos)::int
		FROM detalles_orden d
		JOIN ordenes o ON o.id = d.orden_id
		WHERE o.estado_pago = 'pagado'
		  AND o.creada_en >= now() - make_interval(days => $1::int)
		GROUP BY d.nombre_producto
		ORDER BY 2 DESC
		LIMIT 10`, diasParam(c))
	if err != nil {
		fail(c, err)
		return
	}
	defer rows.Close()

	out := []TopProducto{}
	for rows.Next() {
		var t TopProducto
		if err := rows.Scan(&t.Nombre, &t.Piezas, &t.IngresosCentavos); err != nil {
			fail(c, err)
			return
		}
		out = append(out, t)
	}
	if err := rows.Err(); err != nil {
		fail(c, err)
		return
	}
	c.JSON(200, out)
}
