-- Catálogo
CREATE TABLE categorias (
                            id      SERIAL PRIMARY KEY,
                            nombre  TEXT NOT NULL,
                            orden   INT NOT NULL DEFAULT 0,
                            activo  BOOLEAN NOT NULL DEFAULT true
);

CREATE TABLE productos (
                           id               SERIAL PRIMARY KEY,
                           categoria_id     INT NOT NULL REFERENCES categorias(id),
                           nombre           TEXT NOT NULL,
                           precio_centavos  INT NOT NULL CHECK (precio_centavos >= 0),
                           orden            INT NOT NULL DEFAULT 0,
                           activo           BOOLEAN NOT NULL DEFAULT true
);

CREATE TABLE grupos_opciones (
                                 id      SERIAL PRIMARY KEY,
                                 nombre  TEXT NOT NULL,            -- "Sabor de boneless", "Ingredientes"
                                 activo  BOOLEAN NOT NULL DEFAULT true
);

CREATE TABLE opciones (
                          id                     SERIAL PRIMARY KEY,
                          grupo_id               INT NOT NULL REFERENCES grupos_opciones(id),
                          nombre                 TEXT NOT NULL,      -- "BBQ", "Lechuga"
                          precio_extra_centavos  INT NOT NULL DEFAULT 0 CHECK (precio_extra_centavos >= 0),
                          es_default             BOOLEAN NOT NULL DEFAULT false, -- viene preseleccionada
                          orden                  INT NOT NULL DEFAULT 0,
                          activo                 BOOLEAN NOT NULL DEFAULT true
);

-- Qué grupos aplican a cada producto y con qué reglas
CREATE TABLE producto_grupos (
                                 producto_id      INT NOT NULL REFERENCES productos(id),
                                 grupo_id         INT NOT NULL REFERENCES grupos_opciones(id),
                                 min_selecciones  INT NOT NULL DEFAULT 0,
                                 max_selecciones  INT NOT NULL DEFAULT 1,
                                 orden            INT NOT NULL DEFAULT 0,
                                 PRIMARY KEY (producto_id, grupo_id),
                                 CHECK (max_selecciones >= min_selecciones)
);

-- Ventas
CREATE TABLE ordenes (
                         id                       SERIAL PRIMARY KEY,
                         creada_en                TIMESTAMPTZ NOT NULL DEFAULT now(),
                         total_centavos           INT NOT NULL,
                         estado_pago              TEXT NOT NULL DEFAULT 'pendiente'
                             CHECK (estado_pago IN ('pendiente', 'pagado', 'cancelado')),
                         estado_cocina            TEXT NOT NULL DEFAULT 'pendiente'
                             CHECK (estado_cocina IN ('pendiente', 'en_preparacion', 'lista', 'entregada')),
                         metodo_pago              TEXT CHECK (metodo_pago IN ('efectivo', 'transferencia', 'tarjeta')),
                         monto_recibido_centavos  INT,
                         pagada_en                TIMESTAMPTZ,
                         nota                     TEXT
);

CREATE TABLE detalles_orden (
                                id                       SERIAL PRIMARY KEY,
                                orden_id                 INT NOT NULL REFERENCES ordenes(id) ON DELETE CASCADE,
                                producto_id              INT NOT NULL REFERENCES productos(id),
                                nombre_producto          TEXT NOT NULL,   -- snapshot
                                precio_unitario_centavos INT NOT NULL,    -- snapshot
                                cantidad                 INT NOT NULL CHECK (cantidad > 0),
                                subtotal_centavos        INT NOT NULL,    -- (precio + extras) * cantidad
                                nota                     TEXT
);

CREATE TABLE detalle_opciones (
                                  id                     SERIAL PRIMARY KEY,
                                  detalle_id             INT NOT NULL REFERENCES detalles_orden(id) ON DELETE CASCADE,
                                  opcion_id              INT REFERENCES opciones(id),
                                  nombre_grupo           TEXT NOT NULL,   -- snapshot
                                  nombre_opcion          TEXT NOT NULL,   -- snapshot
                                  precio_extra_centavos  INT NOT NULL DEFAULT 0
);

-- Índices para historial y reportes
CREATE INDEX idx_ordenes_creada_en ON ordenes (creada_en);
CREATE INDEX idx_ordenes_cocina ON ordenes (estado_cocina) WHERE estado_cocina <> 'entregada';
CREATE INDEX idx_detalles_orden ON detalles_orden (orden_id);
CREATE INDEX idx_detalle_opciones ON detalle_opciones (detalle_id);
