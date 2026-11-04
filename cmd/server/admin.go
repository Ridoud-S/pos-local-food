package main

import (
	"context"
	"strconv"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
)

func (a *App) registerAdmin(g *gin.RouterGroup) {
	ad := g.Group("/admin")
	ad.GET("/catalogo", a.adminCatalogo)

	ad.POST("/categorias", a.createCategoria)
	ad.PATCH("/categorias/:id", a.updateCategoria)

	ad.POST("/productos", a.createProducto)
	ad.PATCH("/productos/:id", a.updateProducto)
	ad.PUT("/productos/:id/grupos/:grupo_id", a.linkGrupo)
	ad.DELETE("/productos/:id/grupos/:grupo_id", a.unlinkGrupo)

	ad.POST("/grupos", a.createGrupo)
	ad.PATCH("/grupos/:id", a.updateGrupo)

	ad.POST("/opciones", a.createOpcion)
	ad.PATCH("/opciones/:id", a.updateOpcion)

	ad.GET("/ajustes", a.getAjustes)
	ad.PUT("/ajustes/:clave", a.setAjuste)
}

// ---------- helpers ----------

func idParam(c *gin.Context, name string) (int, bool) {
	id, err := strconv.Atoi(c.Param(name))
	if err != nil || id < 1 {
		c.JSON(400, gin.H{"error": "id inválido"})
		return 0, false
	}
	return id, true
}

func bindJSON(c *gin.Context, v any) bool {
	if err := c.ShouldBindJSON(v); err != nil {
		c.JSON(400, gin.H{"error": err.Error()})
		return false
	}
	return true
}

// nil = no enviado; ok=false = enviado pero vacío
func normName(p *string) (*string, bool) {
	if p == nil {
		return nil, true
	}
	t := strings.TrimSpace(*p)
	if t == "" {
		return nil, false
	}
	return &t, true
}

func respondUpdate(c *gin.Context, tag pgconn.CommandTag, err error, id int) {
	if err != nil {
		dbError(c, err)
		return
	}
	if tag.RowsAffected() == 0 {
		c.JSON(404, gin.H{"error": "no existe"})
		return
	}
	c.JSON(200, gin.H{"id": id})
}

func collect[T any](ctx context.Context, db *pgxpool.Pool, sql string) ([]T, error) {
	rows, err := db.Query(ctx, sql)
	if err != nil {
		return nil, err
	}
	out, err := pgx.CollectRows(rows, pgx.RowToStructByName[T])
	if err != nil {
		return nil, err
	}
	if out == nil {
		out = []T{}
	}
	return out, nil
}

// ---------- catálogo completo (incluye inactivos) ----------

type catRow struct {
	ID     int    `db:"id" json:"id"`
	Nombre string `db:"nombre" json:"nombre"`
	Orden  int    `db:"orden" json:"orden"`
	Activo bool   `db:"activo" json:"activo"`
}

type prodRow struct {
	ID          int    `db:"id" json:"id"`
	CategoriaID int    `db:"categoria_id" json:"categoria_id"`
	Nombre      string `db:"nombre" json:"nombre"`
	Precio      int    `db:"precio_centavos" json:"precio_centavos"`
	Orden       int    `db:"orden" json:"orden"`
	Activo      bool   `db:"activo" json:"activo"`
}

type grupoRow struct {
	ID     int    `db:"id" json:"id"`
	Nombre string `db:"nombre" json:"nombre"`
	Activo bool   `db:"activo" json:"activo"`
}

type opcRow struct {
	ID          int    `db:"id" json:"id"`
	GrupoID     int    `db:"grupo_id" json:"grupo_id"`
	Nombre      string `db:"nombre" json:"nombre"`
	PrecioExtra int    `db:"precio_extra_centavos" json:"precio_extra_centavos"`
	EsDefault   bool   `db:"es_default" json:"es_default"`
	Orden       int    `db:"orden" json:"orden"`
	Activo      bool   `db:"activo" json:"activo"`
}

type vincRow struct {
	ProductoID int `db:"producto_id" json:"producto_id"`
	GrupoID    int `db:"grupo_id" json:"grupo_id"`
	Min        int `db:"min_selecciones" json:"min"`
	Max        int `db:"max_selecciones" json:"max"`
	Orden      int `db:"orden" json:"orden"`
}

func (a *App) adminCatalogo(c *gin.Context) {
	ctx := c.Request.Context()
	cats, err := collect[catRow](ctx, a.db, `SELECT id, nombre, orden, activo FROM categorias ORDER BY orden, id`)
	if err != nil {
		fail(c, err)
		return
	}
	prods, err := collect[prodRow](ctx, a.db, `SELECT id, categoria_id, nombre, precio_centavos, orden, activo FROM productos ORDER BY orden, id`)
	if err != nil {
		fail(c, err)
		return
	}
	grupos, err := collect[grupoRow](ctx, a.db, `SELECT id, nombre, activo FROM grupos_opciones ORDER BY id`)
	if err != nil {
		fail(c, err)
		return
	}
	opc, err := collect[opcRow](ctx, a.db, `SELECT id, grupo_id, nombre, precio_extra_centavos, es_default, orden, activo FROM opciones ORDER BY orden, id`)
	if err != nil {
		fail(c, err)
		return
	}
	vinc, err := collect[vincRow](ctx, a.db, `SELECT producto_id, grupo_id, min_selecciones, max_selecciones, orden FROM producto_grupos ORDER BY producto_id, orden, grupo_id`)
	if err != nil {
		fail(c, err)
		return
	}
	c.JSON(200, gin.H{
		"categorias":      cats,
		"productos":       prods,
		"grupos":          grupos,
		"opciones":        opc,
		"producto_grupos": vinc,
	})
}

// ---------- categorías ----------

type catReq struct {
	Nombre *string `json:"nombre" binding:"omitempty,max=80"`
	Orden  *int    `json:"orden"`
	Activo *bool   `json:"activo"`
}

func (a *App) createCategoria(c *gin.Context) {
	var r catReq
	if !bindJSON(c, &r) {
		return
	}
	nombre, ok := normName(r.Nombre)
	if !ok || nombre == nil {
		c.JSON(400, gin.H{"error": "falta el nombre"})
		return
	}
	var id int
	err := a.db.QueryRow(c.Request.Context(),
		`INSERT INTO categorias (nombre, orden) VALUES ($1, COALESCE($2, 0)) RETURNING id`,
		*nombre, r.Orden).Scan(&id)
	if err != nil {
		dbError(c, err)
		return
	}
	c.JSON(201, gin.H{"id": id})
}

func (a *App) updateCategoria(c *gin.Context) {
	id, ok := idParam(c, "id")
	if !ok {
		return
	}
	var r catReq
	if !bindJSON(c, &r) {
		return
	}
	nombre, ok := normName(r.Nombre)
	if !ok {
		c.JSON(400, gin.H{"error": "el nombre no puede quedar vacío"})
		return
	}
	tag, err := a.db.Exec(c.Request.Context(), `
		UPDATE categorias SET nombre = COALESCE($1, nombre), orden = COALESCE($2, orden),
		       activo = COALESCE($3, activo)
		WHERE id = $4`, nombre, r.Orden, r.Activo, id)
	respondUpdate(c, tag, err, id)
}

// ---------- productos ----------

type prodReq struct {
	CategoriaID *int    `json:"categoria_id"`
	Nombre      *string `json:"nombre" binding:"omitempty,max=80"`
	Precio      *int    `json:"precio_centavos"`
	Orden       *int    `json:"orden"`
	Activo      *bool   `json:"activo"`
}

func (a *App) createProducto(c *gin.Context) {
	var r prodReq
	if !bindJSON(c, &r) {
		return
	}
	nombre, ok := normName(r.Nombre)
	if !ok || nombre == nil || r.CategoriaID == nil || r.Precio == nil {
		c.JSON(400, gin.H{"error": "faltan categoria_id, nombre o precio_centavos"})
		return
	}
	var id int
	err := a.db.QueryRow(c.Request.Context(), `
		INSERT INTO productos (categoria_id, nombre, precio_centavos, orden)
		VALUES ($1, $2, $3, COALESCE($4, 0)) RETURNING id`,
		*r.CategoriaID, *nombre, *r.Precio, r.Orden).Scan(&id)
	if err != nil {
		dbError(c, err)
		return
	}
	c.JSON(201, gin.H{"id": id})
}

// Cambiar el precio no afecta ventas pasadas: cada orden guarda su propio precio
func (a *App) updateProducto(c *gin.Context) {
	id, ok := idParam(c, "id")
	if !ok {
		return
	}
	var r prodReq
	if !bindJSON(c, &r) {
		return
	}
	nombre, ok := normName(r.Nombre)
	if !ok {
		c.JSON(400, gin.H{"error": "el nombre no puede quedar vacío"})
		return
	}
	tag, err := a.db.Exec(c.Request.Context(), `
		UPDATE productos SET categoria_id = COALESCE($1, categoria_id), nombre = COALESCE($2, nombre),
		       precio_centavos = COALESCE($3, precio_centavos), orden = COALESCE($4, orden),
		       activo = COALESCE($5, activo)
		WHERE id = $6`, r.CategoriaID, nombre, r.Precio, r.Orden, r.Activo, id)
	respondUpdate(c, tag, err, id)
}

// ---------- vínculo producto <-> grupo (reglas min/max) ----------

type vinculoReq struct {
	Min   *int `json:"min"`
	Max   *int `json:"max"`
	Orden *int `json:"orden"`
}

func (a *App) linkGrupo(c *gin.Context) {
	pid, ok := idParam(c, "id")
	if !ok {
		return
	}
	gid, ok := idParam(c, "grupo_id")
	if !ok {
		return
	}
	var r vinculoReq
	if !bindJSON(c, &r) {
		return
	}
	min, max, orden := 0, 1, 0
	if r.Min != nil {
		min = *r.Min
	}
	if r.Max != nil {
		max = *r.Max
	}
	if r.Orden != nil {
		orden = *r.Orden
	}
	if min < 0 || max < 1 || max < min {
		c.JSON(400, gin.H{"error": "min debe ser >= 0, max >= 1 y max >= min"})
		return
	}
	_, err := a.db.Exec(c.Request.Context(), `
		INSERT INTO producto_grupos (producto_id, grupo_id, min_selecciones, max_selecciones, orden)
		VALUES ($1, $2, $3, $4, $5)
		ON CONFLICT (producto_id, grupo_id) DO UPDATE
		SET min_selecciones = EXCLUDED.min_selecciones,
		    max_selecciones = EXCLUDED.max_selecciones,
		    orden = EXCLUDED.orden`, pid, gid, min, max, orden)
	if err != nil {
		dbError(c, err)
		return
	}
	c.JSON(200, gin.H{"producto_id": pid, "grupo_id": gid, "min": min, "max": max, "orden": orden})
}

func (a *App) unlinkGrupo(c *gin.Context) {
	pid, ok := idParam(c, "id")
	if !ok {
		return
	}
	gid, ok := idParam(c, "grupo_id")
	if !ok {
		return
	}
	tag, err := a.db.Exec(c.Request.Context(),
		`DELETE FROM producto_grupos WHERE producto_id = $1 AND grupo_id = $2`, pid, gid)
	respondUpdate(c, tag, err, pid)
}

// ---------- grupos de opciones ----------

type grupoReq struct {
	Nombre *string `json:"nombre" binding:"omitempty,max=80"`
	Activo *bool   `json:"activo"`
}

func (a *App) createGrupo(c *gin.Context) {
	var r grupoReq
	if !bindJSON(c, &r) {
		return
	}
	nombre, ok := normName(r.Nombre)
	if !ok || nombre == nil {
		c.JSON(400, gin.H{"error": "falta el nombre"})
		return
	}
	var id int
	if err := a.db.QueryRow(c.Request.Context(),
		`INSERT INTO grupos_opciones (nombre) VALUES ($1) RETURNING id`, *nombre).Scan(&id); err != nil {
		dbError(c, err)
		return
	}
	c.JSON(201, gin.H{"id": id})
}

func (a *App) updateGrupo(c *gin.Context) {
	id, ok := idParam(c, "id")
	if !ok {
		return
	}
	var r grupoReq
	if !bindJSON(c, &r) {
		return
	}
	nombre, ok := normName(r.Nombre)
	if !ok {
		c.JSON(400, gin.H{"error": "el nombre no puede quedar vacío"})
		return
	}
	tag, err := a.db.Exec(c.Request.Context(), `
		UPDATE grupos_opciones SET nombre = COALESCE($1, nombre), activo = COALESCE($2, activo)
		WHERE id = $3`, nombre, r.Activo, id)
	respondUpdate(c, tag, err, id)
}

// ---------- opciones (sabores, ingredientes) ----------

type opcReq struct {
	GrupoID     *int    `json:"grupo_id"` // solo al crear
	Nombre      *string `json:"nombre" binding:"omitempty,max=80"`
	PrecioExtra *int    `json:"precio_extra_centavos"`
	EsDefault   *bool   `json:"es_default"`
	Orden       *int    `json:"orden"`
	Activo      *bool   `json:"activo"`
}

func (a *App) createOpcion(c *gin.Context) {
	var r opcReq
	if !bindJSON(c, &r) {
		return
	}
	nombre, ok := normName(r.Nombre)
	if !ok || nombre == nil || r.GrupoID == nil {
		c.JSON(400, gin.H{"error": "faltan grupo_id o nombre"})
		return
	}
	var id int
	err := a.db.QueryRow(c.Request.Context(), `
		INSERT INTO opciones (grupo_id, nombre, precio_extra_centavos, es_default, orden)
		VALUES ($1, $2, COALESCE($3, 0), COALESCE($4, false), COALESCE($5, 0)) RETURNING id`,
		*r.GrupoID, *nombre, r.PrecioExtra, r.EsDefault, r.Orden).Scan(&id)
	if err != nil {
		dbError(c, err)
		return
	}
	c.JSON(201, gin.H{"id": id})
}

func (a *App) updateOpcion(c *gin.Context) {
	id, ok := idParam(c, "id")
	if !ok {
		return
	}
	var r opcReq
	if !bindJSON(c, &r) {
		return
	}
	nombre, ok := normName(r.Nombre)
	if !ok {
		c.JSON(400, gin.H{"error": "el nombre no puede quedar vacío"})
		return
	}
	tag, err := a.db.Exec(c.Request.Context(), `
		UPDATE opciones SET nombre = COALESCE($1, nombre),
		       precio_extra_centavos = COALESCE($2, precio_extra_centavos),
		       es_default = COALESCE($3, es_default), orden = COALESCE($4, orden),
		       activo = COALESCE($5, activo)
		WHERE id = $6`, nombre, r.PrecioExtra, r.EsDefault, r.Orden, r.Activo, id)
	respondUpdate(c, tag, err, id)
}

// ---------- ajustes (costo de envío) ----------

func (a *App) getAjustes(c *gin.Context) {
	rows, err := a.db.Query(c.Request.Context(), `SELECT clave, valor FROM ajustes`)
	if err != nil {
		fail(c, err)
		return
	}
	defer rows.Close()
	out := map[string]string{}
	for rows.Next() {
		var k, v string
		if err := rows.Scan(&k, &v); err != nil {
			fail(c, err)
			return
		}
		out[k] = v
	}
	if err := rows.Err(); err != nil {
		fail(c, err)
		return
	}
	c.JSON(200, out)
}

func (a *App) setAjuste(c *gin.Context) {
	clave := c.Param("clave")
	if clave != "envio_centavos" {
		c.JSON(404, gin.H{"error": "ajuste desconocido"})
		return
	}
	var r struct {
		Valor *int `json:"valor" binding:"required"`
	}
	if !bindJSON(c, &r) {
		return
	}
	if *r.Valor < 0 || *r.Valor > 100000 {
		c.JSON(400, gin.H{"error": "valor fuera de rango"})
		return
	}
	if _, err := a.db.Exec(c.Request.Context(), `
		INSERT INTO ajustes (clave, valor) VALUES ($1, $2)
		ON CONFLICT (clave) DO UPDATE SET valor = EXCLUDED.valor`,
		clave, strconv.Itoa(*r.Valor)); err != nil {
		fail(c, err)
		return
	}
	c.JSON(200, gin.H{"clave": clave, "valor": *r.Valor})
}
