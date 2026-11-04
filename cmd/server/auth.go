package main

import (
	"context"
	"errors"
	"log"
	"net/http"
	"os"
	"strings"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"github.com/jackc/pgx/v5"
	"golang.org/x/crypto/bcrypt"
	"golang.org/x/time/rate"
)

type claims struct {
	Rol string `json:"rol"`
	jwt.RegisteredClaims
}

const (
	cookieName = "session"
	sessionTTL = 8 * time.Hour
)

func jwtSecret() []byte { return []byte(os.Getenv("JWT_SECRET")) }

func cookieSecure() bool { return os.Getenv("COOKIE_SECURE") == "true" }

// Crea el primer admin si la tabla está vacía (usa ADMIN_USER y ADMIN_PASSWORD)
func (a *App) seedAdmin(ctx context.Context) {
	var n int
	if err := a.db.QueryRow(ctx, `SELECT COUNT(*) FROM usuarios`).Scan(&n); err != nil {
		log.Printf("seedAdmin: no se pudo consultar usuarios: %v", err)
		return
	}
	if n > 0 {
		return
	}
	u, p := os.Getenv("ADMIN_USER"), os.Getenv("ADMIN_PASSWORD")
	if u == "" || p == "" {
		log.Println("seedAdmin: faltan ADMIN_USER o ADMIN_PASSWORD y no hay ningún usuario")
		return
	}
	hash, err := bcrypt.GenerateFromPassword([]byte(p), bcrypt.DefaultCost)
	if err != nil {
		log.Printf("seedAdmin: bcrypt: %v", err)
		return
	}
	if _, err := a.db.Exec(ctx,
		`INSERT INTO usuarios (usuario, password_hash, rol) VALUES ($1, $2, 'admin')`, u, string(hash)); err != nil {
		log.Printf("seedAdmin: no se pudo crear el usuario: %v", err)
		return
	}
	log.Printf("seedAdmin: usuario '%s' creado", u)
}

// Límite de intentos de login por IP: ráfaga de 5, luego 1 cada 12 s
type limEntry struct {
	l    *rate.Limiter
	seen time.Time
}

var (
	limMu sync.Mutex
	lims  = map[string]*limEntry{}
)

func limiterFor(ip string) *rate.Limiter {
	limMu.Lock()
	defer limMu.Unlock()
	e, ok := lims[ip]
	if !ok {
		e = &limEntry{l: rate.NewLimiter(rate.Every(12*time.Second), 5)}
		lims[ip] = e
	}
	e.seen = time.Now()
	return e.l
}

// Borra del mapa las IPs que no han intentado nada en 30 min
func startLimiterCleanup(ctx context.Context) {
	go func() {
		t := time.NewTicker(10 * time.Minute)
		defer t.Stop()
		for {
			select {
			case <-ctx.Done():
				return
			case <-t.C:
				limMu.Lock()
				for ip, e := range lims {
					if time.Since(e.seen) > 30*time.Minute {
						delete(lims, ip)
					}
				}
				limMu.Unlock()
			}
		}
	}()
}

func (a *App) login(c *gin.Context) {
	if !limiterFor(c.ClientIP()).Allow() {
		c.JSON(http.StatusTooManyRequests, gin.H{"error": "demasiados intentos, espera un momento"})
		return
	}
	var req struct {
		Usuario  string `json:"usuario" binding:"required"`
		Password string `json:"password" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(400, gin.H{"error": "faltan datos"})
		return
	}

	var id int
	var hash, rol, nombre string
	err := a.db.QueryRow(c.Request.Context(),
		`SELECT id, usuario, password_hash, rol FROM usuarios WHERE lower(usuario) = lower($1) AND activo`, strings.TrimSpace(req.Usuario)).
		Scan(&id, &nombre, &hash, &rol)
	if err != nil || bcrypt.CompareHashAndPassword([]byte(hash), []byte(req.Password)) != nil {
		c.JSON(401, gin.H{"error": "usuario o contraseña incorrectos"})
		return
	}

	tok, err := jwt.NewWithClaims(jwt.SigningMethodHS256, claims{
		Rol: rol,
		RegisteredClaims: jwt.RegisteredClaims{
			Subject:   req.Usuario,
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(sessionTTL)),
		},
	}).SignedString(jwtSecret())
	if err != nil {
		fail(c, err)
		return
	}

	c.SetSameSite(http.SameSiteLaxMode)
	c.SetCookie(cookieName, tok, int(sessionTTL.Seconds()), "/", "", cookieSecure(), true)
	c.JSON(200, gin.H{"usuario": req.Usuario, "rol": rol})
}

func (a *App) logout(c *gin.Context) {
	c.SetSameSite(http.SameSiteLaxMode)
	c.SetCookie(cookieName, "", -1, "/", "", cookieSecure(), true)
	c.Status(http.StatusNoContent)
}

// Middleware: valida el token y consulta la base, así que desactivar, eliminar
// o cambiar de rol a un usuario surte efecto al instante.
// El admin siempre pasa; los demás solo si su rol está en la lista.
func (a *App) auth(roles ...string) gin.HandlerFunc {
	return func(c *gin.Context) {
		raw, err := c.Cookie(cookieName)
		if err != nil {
			c.AbortWithStatusJSON(401, gin.H{"error": "no autenticado"})
			return
		}
		cl := &claims{}
		tok, err := jwt.ParseWithClaims(raw, cl, func(t *jwt.Token) (any, error) {
			return jwtSecret(), nil
		}, jwt.WithValidMethods([]string{"HS256"}))
		if err != nil || !tok.Valid {
			c.AbortWithStatusJSON(401, gin.H{"error": "sesión inválida o expirada"})
			return
		}

		var uid int
		var rol string
		var activo bool
		err = a.db.QueryRow(c.Request.Context(),
			`SELECT id, rol, activo FROM usuarios WHERE lower(usuario) = lower($1)`, cl.Subject).
			Scan(&uid, &rol, &activo)
		if errors.Is(err, pgx.ErrNoRows) || (err == nil && !activo) {
			c.SetCookie(cookieName, "", -1, "/", "", cookieSecure(), true)
			c.AbortWithStatusJSON(401, gin.H{"error": "la cuenta ya no está disponible"})
			return
		}
		if err != nil {
			log.Printf("auth: %v", err)
			c.AbortWithStatusJSON(500, gin.H{"error": "error interno"})
			return
		}

		allowed := rol == "admin"
		for _, r := range roles {
			if r == rol {
				allowed = true
			}
		}
		if !allowed {
			c.AbortWithStatusJSON(403, gin.H{"error": "sin permiso"})
			return
		}
		c.Set("uid", uid)
		c.Set("usuario", cl.Subject)
		c.Set("rol", rol)
		c.Next()
	}
}

func (a *App) me(c *gin.Context) {
	c.JSON(200, gin.H{"usuario": c.GetString("usuario"), "rol": c.GetString("rol")})
}
