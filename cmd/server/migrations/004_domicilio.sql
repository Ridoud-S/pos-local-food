-- 004_domicilio.sql
-- Domicilio y tipo de pedido. Todo es opcional: un pedido normal queda como tipo 'local'.

ALTER TABLE ordenes
    ADD COLUMN IF NOT EXISTS tipo TEXT NOT NULL DEFAULT 'local',
    ADD COLUMN IF NOT EXISTS origen TEXT NOT NULL DEFAULT 'caja',
    ADD COLUMN IF NOT EXISTS cliente_nombre TEXT,
    ADD COLUMN IF NOT EXISTS cliente_telefono TEXT,
    ADD COLUMN IF NOT EXISTS direccion TEXT,
    ADD COLUMN IF NOT EXISTS referencias TEXT,
    ADD COLUMN IF NOT EXISTS envio_centavos INT NOT NULL DEFAULT 0;

-- Restricciones (se recrean para poder correr el archivo varias veces)
ALTER TABLE ordenes DROP CONSTRAINT IF EXISTS ordenes_tipo_check;
ALTER TABLE ordenes ADD CONSTRAINT ordenes_tipo_check
    CHECK (tipo IN ('local', 'llevar', 'domicilio'));

ALTER TABLE ordenes DROP CONSTRAINT IF EXISTS ordenes_origen_check;
ALTER TABLE ordenes ADD CONSTRAINT ordenes_origen_check
    CHECK (origen IN ('caja', 'web'));

ALTER TABLE ordenes DROP CONSTRAINT IF EXISTS ordenes_envio_check;
ALTER TABLE ordenes ADD CONSTRAINT ordenes_envio_check
    CHECK (envio_centavos >= 0);

-- Un domicilio exige dirección y teléfono; los demás tipos no piden nada
ALTER TABLE ordenes DROP CONSTRAINT IF EXISTS domicilio_requiere_datos;
ALTER TABLE ordenes ADD CONSTRAINT domicilio_requiere_datos
    CHECK (tipo <> 'domicilio' OR (direccion IS NOT NULL AND cliente_telefono IS NOT NULL));

-- El estado de cocina gana "en_camino" (aún no se usa desde la API)
ALTER TABLE ordenes DROP CONSTRAINT IF EXISTS ordenes_estado_cocina_check;
ALTER TABLE ordenes ADD CONSTRAINT ordenes_estado_cocina_check
    CHECK (estado_cocina IN ('pendiente', 'en_preparacion', 'lista', 'en_camino', 'entregada'));

-- Ajustes editables por el local (costo de envío, $20 de ejemplo)
CREATE TABLE IF NOT EXISTS ajustes (
                                       clave  TEXT PRIMARY KEY,
                                       valor  TEXT NOT NULL
);
INSERT INTO ajustes (clave, valor) VALUES ('envio_centavos', '2000')
    ON CONFLICT (clave) DO NOTHING;