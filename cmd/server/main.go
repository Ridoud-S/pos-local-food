package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"os/signal"
	"path"
	"path/filepath"
	"strings"
	"syscall"
	"time"

	"github.com/gin-gonic/gin"
)

func getenv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

func trustedProxies() []string {
	var out []string
	for _, p := range strings.Split(os.Getenv("TRUSTED_PROXIES"), ",") {
		if p = strings.TrimSpace(p); p != "" {
			out = append(out, p)
		}
	}
	return out
}

func staticDir() string {
	if _, err := os.Stat("./frontend/dist/index.html"); err == nil {
		return "./frontend/dist"
	}
	return "./web"
}

func securityHeaders() gin.HandlerFunc {
	return func(c *gin.Context) {
		h := c.Writer.Header()
		h.Set("X-Content-Type-Options", "nosniff")
		h.Set("X-Frame-Options", "DENY")
		h.Set("Referrer-Policy", "same-origin")
		c.Next()
	}
}

func limitBody(max int64) gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, max)
		c.Next()
	}
}

func main() {
	port := getenv("PORT", "8080")

	if len(jwtSecret()) < 32 {
		log.Fatal("JWT_SECRET debe tener al menos 32 caracteres")
	}

	ctx := context.Background()
	pool, err := connectDB(ctx)
	if err != nil {
		log.Fatalf("no se pudo conectar a la base de datos: %v", err)
	}
	defer pool.Close()

	mctx, mcancel := context.WithTimeout(ctx, 60*time.Second)
	if err := runMigrations(mctx, pool); err != nil {
		mcancel()
		log.Fatalf("error en migraciones: %v", err)
	}
	mcancel()

	app := &App{db: pool}
	app.seedAdmin(ctx)

	bg, cancelBg := context.WithCancel(ctx)
	defer cancelBg()
	startLimiterCleanup(bg)

	if gin.Mode() == gin.ReleaseMode && !cookieSecure() {
		log.Println("AVISO: GIN_MODE=release sin COOKIE_SECURE=true; la cookie de sesión viajará sin la marca Secure")
	}

	r := gin.Default()
	// Sin TRUSTED_PROXIES, ClientIP es la IP directa y nadie puede falsificarla con X-Forwarded-For
	if err := r.SetTrustedProxies(trustedProxies()); err != nil {
		log.Fatalf("TRUSTED_PROXIES inválido: %v", err)
	}
	r.Use(securityHeaders(), limitBody(1<<20))

	api := r.Group("/api")
	api.GET("/health", func(c *gin.Context) { c.String(http.StatusOK, "ok") })
	api.POST("/auth/login", app.login)
	api.POST("/auth/logout", app.logout)

	priv := api.Group("", app.auth()) // cualquier usuario autenticado
	priv.GET("/me", app.me)
	priv.GET("/menu", app.getMenu)

	priv.GET("/orders", app.listOrders)
	priv.GET("/orders/:id", app.getOrder)
	priv.POST("/orders", app.createOrder)
	priv.PATCH("/orders/:id/pagar", app.payOrder)
	priv.PATCH("/orders/:id/cocina", app.setKitchenState)
	priv.PATCH("/orders/:id/cancelar", app.cancelOrder)

	priv.GET("/stats/dias", app.statsDias)
	priv.GET("/stats/top", app.statsTop)

	app.registerAdmin(priv)

	// Frontend (React build o web/) con fallback a index.html para las rutas del SPA
	dir := staticDir()
	r.NoRoute(func(c *gin.Context) {
		p := c.Request.URL.Path
		if strings.HasPrefix(p, "/api") || (c.Request.Method != http.MethodGet && c.Request.Method != http.MethodHead) {
			c.JSON(404, gin.H{"error": "no encontrado"})
			return
		}
		clean := path.Clean("/" + p)
		file := filepath.Join(dir, filepath.FromSlash(clean))
		if info, err := os.Stat(file); err == nil && !info.IsDir() {
			c.File(file)
			return
		}
		c.File(filepath.Join(dir, "index.html"))
	})

	srv := &http.Server{
		Addr:              ":" + port,
		Handler:           r,
		ReadHeaderTimeout: 5 * time.Second,
		ReadTimeout:       15 * time.Second,
		WriteTimeout:      15 * time.Second,
		IdleTimeout:       60 * time.Second,
	}

	go func() {
		log.Printf("Servidor escuchando en :%s (frontend: %s)", port, dir)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("error del servidor: %v", err)
		}
	}()

	stop := make(chan os.Signal, 1)
	signal.Notify(stop, os.Interrupt, syscall.SIGTERM)
	<-stop

	sctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	if err := srv.Shutdown(sctx); err != nil {
		log.Printf("error al apagar: %v", err)
	}
	log.Println("Servidor detenido")
}