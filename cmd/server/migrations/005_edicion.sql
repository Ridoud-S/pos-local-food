ALTER TABLE ordenes
    ADD COLUMN IF NOT EXISTS abonado_centavos INT NOT NULL DEFAULT 0
    CHECK (abonado_centavos >= 0);

-- Los pedidos ya pagados se consideran abonados por completo
UPDATE ordenes SET abonado_centavos = total_centavos WHERE estado_pago = 'pagado';