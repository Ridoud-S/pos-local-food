package main

import (
	"context"
	"errors"
	"regexp"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5"
	"golang.org/x/crypto/bcrypt"
)

var usuarioRe = regexp.MustCompile(`^[a-z0-9._-]{3,40}$`)

type Usuario struct {
	ID      int    `json:"id"`
	Usuario string `json:"usuario"`
	Rol     string `json:"rol"`
	Activo  bool   `json:"activo"`
}

// GET /api/admin/usuarios
func (a *App) listUsuarios(c *gin.Context) {
	rows, err := a.db.Query(c.Request.Context(),
		`SELECT id, usuario, rol, activo FROM usuarios ORDER BY usuario`)
	if err != nil {
		fail(c, err)
		return
	}
	defer rows.Close()
	out := []Usuario{}
	for rows.Next() {
		var u Usuario
		if err := rows.Scan(&u.ID, &u.Usuario, &u.Rol, &u.Activo); err != nil {
			fail(c, err)
			return
		}
		out = append(out, u)
	}
	if err := rows.Err(); err != nil {
		fail(c, err)
		return
	}
	c.JSON(200, out)
}

type crearUsuarioReq struct {
	Usuario  string `json:"usuario" binding:"required"`
	Password string `json:"password" binding:"required,min=8,max=72"`
	Rol      string `json:"rol" binding:"required,oneof=admin caja cocina"`
}

// POST /api/admin/usuarios
func (a *App) createUsuario(c *gin.Context) {
	var req crearUsuarioReq
	if !bindJSON(c, &req) {
		return
	}
	nombre := strings.ToLower(strings.TrimSpace(req.Usuario))
	if !usuarioRe.MatchString(nombre) {
		c.JSON(400, gin.H{"error": "el usuario debe tener 3 a 40 caracteres: letras, números, punto, guion o guion bajo"})
		return
	}
	hash, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		c.JSON(400, gin.H{"error": "contraseña no válida (máximo 72 caracteres)"})
		return
	}
	var id int
	err = a.db.QueryRow(c.Request.Context(),
		`INSERT INTO usuarios (usuario, password_hash, rol) VALUES ($1, $2, $3) RETURNING id`,
		nombre, string(hash), req.Rol).Scan(&id)
	if err != nil {
		dbError(c, err)
		return
	}
	c.JSON(201, Usuario{ID: id, Usuario: nombre, Rol: req.Rol, Activo: true})
}

// Cuenta otros admins activos; el candado evita que dos peticiones a la vez
// dejen el sistema sin administrador.
func otrosAdmins(ctx context.Context, tx pgx.Tx, id int) (int, error) {
	if _, err := tx.Exec(ctx, `SELECT pg_advisory_xact_lock(7001)`); err != nil {
		return 0, err
	}
	var n int
	err := tx.QueryRow(ctx,
		`SELECT COUNT(*) FROM usuarios WHERE rol = 'admin' AND activo AND id <> $1`, id).Scan(&n)
	return n, err
}

type editarUsuarioReq struct {
	Password *string `json:"password" binding:"omitempty,min=8,max=72"`
	Rol      *string `json:"rol" binding:"omitempty,oneof=admin caja cocina"`
	Activo   *bool   `json:"activo"`
}

// PATCH /api/admin/usuarios/:id
func (a *App) updateUsuario(c *gin.Context) {
	id, ok := idParam(c, "id")
	if !ok {
		return
	}
	var req editarUsuarioReq
	if !bindJSON(c, &req) {
		return
	}
	uid := c.GetInt("uid")

	var hash *string
	if req.Password != nil {
		h, err := bcrypt.GenerateFromPassword([]byte(*req.Password), bcrypt.DefaultCost)
		if err != nil {
			c.JSON(400, gin.H{"error": "contraseña no válida (máximo 72 caracteres)"})
			return
		}
		s := string(h)
		hash = &s
	}

	ctx := c.Request.Context()
	tx, err := a.db.Begin(ctx)
	if err != nil {
		fail(c, err)
		return
	}
	defer tx.Rollback(ctx)

	n, err := otrosAdmins(ctx, tx, id)
	if err != nil {
		fail(c, err)
		return
	}
	var rolActual string
	var activoActual bool
	err = tx.QueryRow(ctx, `SELECT rol, activo FROM usuarios WHERE id = $1`, id).Scan(&rolActual, &activoActual)
	if errors.Is(err, pgx.ErrNoRows) {
		c.JSON(404, gin.H{"error": "el usuario no existe"})
		return
	}
	if err != nil {
		fail(c, err)
		return
	}

	cambiaRol := req.Rol != nil && *req.Rol != rolActual
	desactiva := req.Activo != nil && !*req.Activo && activoActual
	if id == uid && (cambiaRol || desactiva) {
		c.JSON(400, gin.H{"error": "no puedes cambiar tu propio rol ni desactivarte"})
		return
	}
	if rolActual == "admin" && activoActual && (cambiaRol || desactiva) && n == 0 {
		c.JSON(409, gin.H{"error": "debe quedar al menos un administrador activo"})
		return
	}

	if _, err := tx.Exec(ctx, `
		UPDATE usuarios SET password_hash = COALESCE($1, password_hash),
		       rol = COALESCE($2, rol), activo = COALESCE($3, activo)
		WHERE id = $4`, hash, req.Rol, req.Activo, id); err != nil {
		dbError(c, err)
		return
	}
	if err := tx.Commit(ctx); err != nil {
		fail(c, err)
		return
	}
	c.JSON(200, gin.H{"id": id})
}

// DELETE /api/admin/usuarios/:id
func (a *App) deleteUsuario(c *gin.Context) {
	id, ok := idParam(c, "id")
	if !ok {
		return
	}
	if id == c.GetInt("uid") {
		c.JSON(400, gin.H{"error": "no puedes eliminar tu propia cuenta"})
		return
	}

	ctx := c.Request.Context()
	tx, err := a.db.Begin(ctx)
	if err != nil {
		fail(c, err)
		return
	}
	defer tx.Rollback(ctx)

	n, err := otrosAdmins(ctx, tx, id)
	if err != nil {
		fail(c, err)
		return
	}
	var rol string
	var activo bool
	err = tx.QueryRow(ctx, `SELECT rol, activo FROM usuarios WHERE id = $1`, id).Scan(&rol, &activo)
	if errors.Is(err, pgx.ErrNoRows) {
		c.JSON(404, gin.H{"error": "el usuario no existe"})
		return
	}
	if err != nil {
		fail(c, err)
		return
	}
	if rol == "admin" && activo && n == 0 {
		c.JSON(409, gin.H{"error": "debe quedar al menos un administrador activo"})
		return
	}
	if _, err := tx.Exec(ctx, `DELETE FROM usuarios WHERE id = $1`, id); err != nil {
		fail(c, err)
		return
	}
	if err := tx.Commit(ctx); err != nil {
		fail(c, err)
		return
	}
	c.Status(204)
}
