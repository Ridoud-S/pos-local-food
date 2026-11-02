package main

import (
	"context"
	"errors"
	"fmt"
	"log"
	"net/http"
	"os"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
)

type App struct {
	db *pgxpool.Pool
}

func connectDB(ctx context.Context) (*pgxpool.Pool, error) {
	url := os.Getenv("DATABASE_URL")
	if url == "" {
		return nil, fmt.Errorf("falta la variable DATABASE_URL")
	}
	cfg, err := pgxpool.ParseConfig(url)
	if err != nil {
		return nil, err
	}

	cfg.MaxConns = 5                      // de sobra para este negocio y cuida el free tier
	cfg.MinConns = 0                      // que la base pueda dormirse sin conexiones abiertas
	cfg.MaxConnIdleTime = 4 * time.Minute // cierra antes de que Neon suspenda (≈5 min)
	cfg.MaxConnLifetime = 30 * time.Minute
	cfg.HealthCheckPeriod = time.Minute
	if cfg.ConnConfig.ConnectTimeout == 0 {
		cfg.ConnConfig.ConnectTimeout = 10 * time.Second
	}

	pool, err := pgxpool.NewWithConfig(ctx, cfg)
	if err != nil {
		return nil, err
	}

	// Margen amplio por si Neon está "despertando" la base
	pctx, cancel := context.WithTimeout(ctx, 20*time.Second)
	defer cancel()
	if err := pool.Ping(pctx); err != nil {
		pool.Close()
		return nil, err
	}
	return pool, nil
}

func fail(c *gin.Context, err error) {
	log.Printf("error: %s %s: %v", c.Request.Method, c.Request.URL.Path, err)
	c.JSON(http.StatusInternalServerError, gin.H{"error": "error interno"})
}

// Traduce errores comunes de Postgres a 4xx; el resto es 500
func dbError(c *gin.Context, err error) {
	var pe *pgconn.PgError
	if errors.As(err, &pe) {
		switch pe.Code {
		case "23503": // foreign key
			c.JSON(400, gin.H{"error": "referencia inválida: el registro relacionado no existe"})
			return
		case "23505": // unique
			c.JSON(409, gin.H{"error": "ya existe un registro igual"})
			return
		case "23514": // check
			c.JSON(400, gin.H{"error": "algún valor no cumple las reglas permitidas"})
			return
		}
	}
	fail(c, err)
}
