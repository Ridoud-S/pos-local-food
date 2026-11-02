CREATE TABLE IF NOT EXISTS usuarios (
    id             SERIAL PRIMARY KEY,
    usuario        TEXT NOT NULL UNIQUE,
    password_hash  TEXT NOT NULL,
    rol            TEXT NOT NULL CHECK (rol IN ('admin', 'caja', 'cocina')),
    activo         BOOLEAN NOT NULL DEFAULT true
);