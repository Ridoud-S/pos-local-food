-- Evita usuarios duplicados que solo difieren en mayúsculas
CREATE UNIQUE INDEX IF NOT EXISTS usuarios_usuario_lower_idx ON usuarios (lower(usuario));