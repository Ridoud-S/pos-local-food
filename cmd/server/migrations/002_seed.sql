
INSERT INTO categorias (nombre, orden) VALUES ('Hamburguesas', 1), ('Boneless', 2), ('Bebidas', 3);

INSERT INTO productos (categoria_id, nombre, precio_centavos) VALUES
                                                                  (1, 'Hamburguesa de res sencilla',     6000),
                                                                  (1, 'Hamburguesa de res con papas',    8000),
                                                                  (1, 'Hamburguesa de pollo sencilla',   6500),
                                                                  (1, 'Hamburguesa de pollo con papas',  8500),
                                                                  (2, 'Boneless',                        9000),
                                                                  (3, 'Chocomil',                        2500);

INSERT INTO grupos_opciones (nombre) VALUES
                                         ('Ingredientes'), ('Sabor de boneless'), ('Sabor de chocomil');

INSERT INTO opciones (grupo_id, nombre, es_default) VALUES
                                                        (1, 'Lechuga', true), (1, 'Jitomate', true), (1, 'Cebolla', true),
                                                        (1, 'Aderezo', true), (1, 'Chile', false),
                                                        (2, 'BBQ', false), (2, 'Búfalo', false), (2, 'Mango habanero', false),
                                                        (3, 'Chocolate', false), (3, 'Fresa', false), (3, 'Vainilla', false);

INSERT INTO opciones (grupo_id, nombre, precio_extra_centavos) VALUES (1, 'Queso extra', 1000);

-- Reglas: hamburguesas -> ingredientes (0 a 6); boneless -> 1 sabor; chocomil -> 1 sabor
INSERT INTO producto_grupos (producto_id, grupo_id, min_selecciones, max_selecciones) VALUES
                                                                                          (1,1,0,6),(2,1,0,6),(3,1,0,6),(4,1,0,6),
                                                                                          (5,2,1,1),
                                                                                          (6,3,1,1);