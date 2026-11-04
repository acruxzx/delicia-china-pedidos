-- Delicia China · datos de ejemplo (GENÉRICOS).
-- Platos y precios de relleno para el piloto. Se reemplazan por los reales si el dueño acepta.
-- Ejecutar después de 01-esquema.sql.

insert into public.configuracion (id, recibiendo_pedidos, horario_texto, whatsapp_tienda, datos_pago, opciones_generales)
values (1, true, 'Todos los días, 11:00 a. m. a 9:00 p. m.', '573000000000',
  '[{"metodo": "nequi", "titular": "Delicia China (ejemplo)", "numero": "300 000 0000"},
    {"metodo": "daviplata", "titular": "Delicia China (ejemplo)", "numero": "300 000 0000"},
    {"metodo": "transferencia", "titular": "Delicia China (ejemplo)", "banco": "Banco de ejemplo", "tipo": "Ahorros", "numero": "000-000000-00"}]',
  array['Sin cebolla', 'Sin picante', 'Salsa aparte', 'Porción extra de arroz'])
on conflict (id) do nothing;

insert into public.categorias (nombre, orden) values
  ('Entradas', 1),
  ('Sopas', 2),
  ('Arroces', 3),
  ('Chop Suey', 4),
  ('Chow Mein', 5),
  ('Pollo', 6),
  ('Cerdo', 7),
  ('Res', 8),
  ('Camarones y mariscos', 9),
  ('Combos', 10),
  ('Acompañamientos', 11),
  ('Bebidas', 12),
  ('Postres', 13);

insert into public.platos (id, categoria_id, nombre, descripcion, precio, orden)
select v.id, c.id, v.nombre, v.descripcion, v.precio, v.orden
from (values
  (1, 'Entradas', 'Rollitos primavera (x3)', 'Rollos crocantes rellenos de verduras.', 12000, 1),
  (2, 'Entradas', 'Wantán frito (x6)', 'Masa crocante rellena de cerdo, con salsa agridulce.', 14000, 2),
  (3, 'Entradas', 'Empanadas chinas (x4)', 'Empanadas de pollo y vegetales.', 13000, 3),
  (4, 'Entradas', 'Costillitas BBQ', 'Costillas de cerdo glaseadas en salsa BBQ.', 22000, 4),
  (5, 'Entradas', 'Alitas agridulces (x6)', 'Alitas fritas bañadas en salsa agridulce.', 20000, 5),
  (6, 'Entradas', 'Camarones apanados (x5)', 'Camarones fritos con salsa de la casa.', 24000, 6),
  (7, 'Sopas', 'Sopa wantán', 'Caldo de pollo con wantanes de cerdo.', 16000, 1),
  (8, 'Sopas', 'Sopa de pollo con vegetales', 'Caldo ligero con pollo y verduras.', 14000, 2),
  (9, 'Sopas', 'Sopa de maíz tierno con pollo', 'Crema suave de maíz con hilos de huevo.', 15000, 3),
  (10, 'Sopas', 'Sopa agridulce', 'Caldo espeso, picante suave, con cerdo y huevo.', 15000, 4),
  (11, 'Sopas', 'Sopa de mariscos', 'Caldo con camarones y pescado.', 24000, 5),
  (12, 'Arroces', 'Arroz chino especial', 'Arroz frito con pollo, cerdo, jamón y huevo.', 22000, 1),
  (13, 'Arroces', 'Arroz con pollo', 'Arroz frito con pollo y verduras.', 18000, 2),
  (14, 'Arroces', 'Arroz con cerdo', 'Arroz frito con cerdo asado y huevo.', 18000, 3),
  (15, 'Arroces', 'Arroz con res', 'Arroz frito con tiras de res.', 20000, 4),
  (16, 'Arroces', 'Arroz con camarones', 'Arroz frito con camarones y cebollín.', 24000, 5),
  (17, 'Arroces', 'Arroz mixto', 'Arroz frito con pollo, res, cerdo y camarones.', 25000, 6),
  (18, 'Arroces', 'Arroz frito vegetariano', 'Arroz con huevo y vegetales.', 15000, 7),
  (19, 'Chop Suey', 'Chop suey de pollo', 'Verduras salteadas con pollo.', 20000, 1),
  (20, 'Chop Suey', 'Chop suey de cerdo', 'Verduras salteadas con cerdo.', 20000, 2),
  (21, 'Chop Suey', 'Chop suey de res', 'Verduras salteadas con res.', 22000, 3),
  (22, 'Chop Suey', 'Chop suey de camarones', 'Verduras salteadas con camarones.', 26000, 4),
  (23, 'Chop Suey', 'Chop suey mixto', 'Verduras con pollo, res, cerdo y camarones.', 27000, 5),
  (24, 'Chop Suey', 'Chop suey vegetariano', 'Variedad de verduras salteadas al wok.', 17000, 6),
  (25, 'Chow Mein', 'Chow mein de pollo', 'Tallarines salteados con pollo y verduras.', 20000, 1),
  (26, 'Chow Mein', 'Chow mein de cerdo', 'Tallarines salteados con cerdo.', 20000, 2),
  (27, 'Chow Mein', 'Chow mein de res', 'Tallarines salteados con res.', 22000, 3),
  (28, 'Chow Mein', 'Chow mein de camarones', 'Tallarines salteados con camarones.', 26000, 4),
  (29, 'Chow Mein', 'Chow mein mixto', 'Tallarines con pollo, res, cerdo y camarones.', 27000, 5),
  (30, 'Chow Mein', 'Chow mein vegetariano', 'Tallarines con vegetales.', 17000, 6),
  (31, 'Pollo', 'Pollo agridulce', 'Trozos de pollo apanado en salsa agridulce.', 24000, 1),
  (32, 'Pollo', 'Pollo con almendras', 'Pollo salteado con almendras y verduras.', 25000, 2),
  (33, 'Pollo', 'Pollo con champiñones', 'Pollo en salsa suave con champiñones.', 24000, 3),
  (34, 'Pollo', 'Pollo al limón', 'Pollo crocante con salsa cítrica.', 24000, 4),
  (35, 'Pollo', 'Pollo en salsa de ostras', 'Pollo salteado con salsa de ostras.', 24000, 5),
  (36, 'Pollo', 'Pollo con verduras al wok', 'Pollo con brócoli, zanahoria y pimentón.', 23000, 6),
  (37, 'Cerdo', 'Cerdo agridulce', 'Cerdo apanado en salsa agridulce.', 24000, 1),
  (38, 'Cerdo', 'Costilla BBQ (plato)', 'Costillas glaseadas con arroz.', 28000, 2),
  (39, 'Cerdo', 'Cerdo con piña', 'Cerdo salteado con piña y pimentón.', 24000, 3),
  (40, 'Cerdo', 'Cerdo en salsa de soya', 'Cerdo salteado con salsa de soya y cebollín.', 23000, 4),
  (41, 'Res', 'Res con brócoli', 'Tiras de res salteadas con brócoli.', 27000, 1),
  (42, 'Res', 'Res en salsa de ostras', 'Res tierna en salsa de ostras.', 27000, 2),
  (43, 'Res', 'Res con pimentón', 'Res salteada con pimentón y cebolla.', 26000, 3),
  (44, 'Res', 'Res mongoliana', 'Res crocante con salsa dulce y picante suave.', 28000, 4),
  (45, 'Camarones y mariscos', 'Camarones al ajillo', 'Camarones salteados con ajo y cebollín.', 32000, 1),
  (46, 'Camarones y mariscos', 'Camarones agridulces', 'Camarones apanados en salsa agridulce.', 32000, 2),
  (47, 'Camarones y mariscos', 'Camarones con vegetales', 'Camarones con brócoli y zanahoria.', 31000, 3),
  (48, 'Camarones y mariscos', 'Mariscos salteados', 'Mezcla de mariscos con verduras.', 34000, 4),
  (49, 'Combos', 'Combo personal', 'Arroz chino, pollo agridulce y rollito primavera.', 28000, 1),
  (50, 'Combos', 'Combo pareja', '2 arroces, 2 platos fuertes y 6 rollitos.', 58000, 2),
  (51, 'Combos', 'Combo familiar (4 personas)', '2 arroces, chop suey, 2 platos fuertes y bebida 1.5 L.', 110000, 3),
  (52, 'Combos', 'Combo almuerzo', 'Sopa, arroz con pollo y bebida.', 22000, 4),
  (53, 'Acompañamientos', 'Arroz blanco', 'Porción de arroz blanco.', 5000, 1),
  (54, 'Acompañamientos', 'Salsa agridulce extra', 'Porción adicional de salsa.', 2000, 2),
  (55, 'Acompañamientos', 'Salsa de soya extra', 'Porción adicional de salsa de soya.', 1500, 3),
  (56, 'Acompañamientos', 'Papas fritas', 'Porción de papas a la francesa.', 8000, 4),
  (57, 'Bebidas', 'Gaseosa personal', 'Botella de 400 ml.', 4500, 1),
  (58, 'Bebidas', 'Gaseosa 1.5 L', 'Botella familiar.', 9000, 2),
  (59, 'Bebidas', 'Jugo natural', 'Jugo en agua o leche, según fruta disponible.', 6000, 3),
  (60, 'Bebidas', 'Té frío', 'Té de limón o durazno.', 5000, 4),
  (61, 'Bebidas', 'Agua', 'Botella de 600 ml.', 3500, 5),
  (62, 'Bebidas', 'Cerveza', 'Botella nacional.', 6500, 6),
  (63, 'Postres', 'Helado frito', 'Helado envuelto en masa crocante.', 9000, 1),
  (64, 'Postres', 'Bananos fritos con miel', 'Banano apanado con miel.', 8000, 2),
  (65, 'Postres', 'Flan', 'Flan casero con caramelo.', 7000, 3)
) as v(id, categoria, nombre, descripcion, precio, orden)
join public.categorias c on c.nombre = v.categoria;

-- Ajusta el contador para que los platos nuevos sigan después del último.
select setval('public.platos_id_seq', (select max(id) from public.platos));
