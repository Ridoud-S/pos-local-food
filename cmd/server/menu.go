package main

import "github.com/gin-gonic/gin"

type Opcion struct {
	ID          int    `json:"id"`
	Nombre      string `json:"nombre"`
	PrecioExtra int    `json:"precio_extra_centavos"`
	EsDefault   bool   `json:"es_default"`
}

type Grupo struct {
	ID       int      `json:"id"`
	Nombre   string   `json:"nombre"`
	Min      int      `json:"min"`
	Max      int      `json:"max"`
	Opciones []Opcion `json:"opciones"`
}

type Producto struct {
	ID             int     `json:"id"`
	Nombre         string  `json:"nombre"`
	PrecioCentavos int     `json:"precio_centavos"`
	Grupos         []Grupo `json:"grupos"`
}

type Categoria struct {
	ID        int        `json:"id"`
	Nombre    string     `json:"nombre"`
	Productos []Producto `json:"productos"`
}

func (a *App) getMenu(c *gin.Context) {
	ctx := c.Request.Context()

	// 1. Opciones agrupadas por grupo
	opcionesPorGrupo := map[int][]Opcion{}
	rows, err := a.db.Query(ctx, `
		SELECT grupo_id, id, nombre, precio_extra_centavos, es_default
		FROM opciones WHERE activo ORDER BY orden, id`)
	if err != nil {
		fail(c, err)
		return
	}
	for rows.Next() {
		var gid int
		var o Opcion
		if err := rows.Scan(&gid, &o.ID, &o.Nombre, &o.PrecioExtra, &o.EsDefault); err != nil {
			rows.Close()
			fail(c, err)
			return
		}
		opcionesPorGrupo[gid] = append(opcionesPorGrupo[gid], o)
	}
	rows.Close()
	if err := rows.Err(); err != nil {
		fail(c, err)
		return
	}

	// 2. Grupos de cada producto (con sus reglas min/max)
	gruposPorProducto := map[int][]Grupo{}
	rows, err = a.db.Query(ctx, `
		SELECT pg.producto_id, g.id, g.nombre, pg.min_selecciones, pg.max_selecciones
		FROM producto_grupos pg
		JOIN grupos_opciones g ON g.id = pg.grupo_id
		WHERE g.activo
		ORDER BY pg.orden, g.id`)
	if err != nil {
		fail(c, err)
		return
	}
	for rows.Next() {
		var pid int
		var g Grupo
		if err := rows.Scan(&pid, &g.ID, &g.Nombre, &g.Min, &g.Max); err != nil {
			rows.Close()
			fail(c, err)
			return
		}
		g.Opciones = opcionesPorGrupo[g.ID]
		if g.Opciones == nil {
			g.Opciones = []Opcion{}
		}
		gruposPorProducto[pid] = append(gruposPorProducto[pid], g)
	}
	rows.Close()
	if err := rows.Err(); err != nil {
		fail(c, err)
		return
	}

	// 3. Productos por categoría
	productosPorCat := map[int][]Producto{}
	rows, err = a.db.Query(ctx, `
		SELECT categoria_id, id, nombre, precio_centavos
		FROM productos WHERE activo ORDER BY orden, id`)
	if err != nil {
		fail(c, err)
		return
	}
	for rows.Next() {
		var cid int
		var p Producto
		if err := rows.Scan(&cid, &p.ID, &p.Nombre, &p.PrecioCentavos); err != nil {
			rows.Close()
			fail(c, err)
			return
		}
		p.Grupos = gruposPorProducto[p.ID]
		if p.Grupos == nil {
			p.Grupos = []Grupo{}
		}
		productosPorCat[cid] = append(productosPorCat[cid], p)
	}
	rows.Close()
	if err := rows.Err(); err != nil {
		fail(c, err)
		return
	}

	// 4. Categorías
	menu := []Categoria{}
	rows, err = a.db.Query(ctx, `SELECT id, nombre FROM categorias WHERE activo ORDER BY orden, id`)
	if err != nil {
		fail(c, err)
		return
	}
	for rows.Next() {
		var cat Categoria
		if err := rows.Scan(&cat.ID, &cat.Nombre); err != nil {
			rows.Close()
			fail(c, err)
			return
		}
		cat.Productos = productosPorCat[cat.ID]
		if cat.Productos == nil {
			cat.Productos = []Producto{}
		}
		menu = append(menu, cat)
	}
	rows.Close()
	if err := rows.Err(); err != nil {
		fail(c, err)
		return
	}

	c.JSON(200, menu)
}
