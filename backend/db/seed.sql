-- Insert categories
INSERT INTO categories (name) VALUES
  ('Frutas'),
  ('Verduras'),
  ('General')
ON CONFLICT (name) DO NOTHING;

-- Insert products with images
INSERT INTO products (id, name, price_piece, price_kg, image, category) VALUES
  (1,  'Fresa',                 35.00, 70.00, '/assets/strawberry.webp', 'Frutas'),
  (2,  'Aguacate',              15.00, 45.00, '/assets/avocado.webp', 'Frutas'),
  (3,  'Platano',                8.00, 18.00, '/assets/bananas.webp', 'Frutas'),
  (4,  'Dominico',               5.00, 20.00, '/assets/dominican.webp', 'Frutas'),
  (5,  'Uva Verde',             25.00, 55.00, '/assets/greengrape.webp', 'Frutas'),
  (6,  'Mango',                 12.00, 30.00, '/assets/mango.webp', 'Frutas'),
  (7,  'Frutos Rojos (Berries)',40.00, 90.00, '/assets/berries.webp', 'Frutas'),
  (8,  'Zanahoria',              6.00, 14.00, '/assets/carrot.webp', 'Verduras'),
  (9,  'Guayaba',               10.00, 22.00, '/assets/guava.webp', 'Frutas'),
  (10, 'Chayote',                8.00, 16.00, '/assets/squash.webp', 'Verduras'),
  (11, 'Limon Con Semilla',     10.00, 20.00, '/assets/lemonseed.webp', 'Frutas'),
  (12, 'Limon Sin Semilla',     12.00, 25.00, '/assets/lemon.webp', 'Frutas'),
  (13, 'Brocoli',               18.00, 35.00, '/assets/broccoli.webp', 'Verduras'),
  (14, 'Manzana Roja',          15.00, 32.00, '/assets/redapple.webp', 'Frutas'),
  (15, 'Manzana Verde',         15.00, 32.00, '/assets/greenapple.webp', 'Frutas'),
  (16, 'Piña',                  20.00,  0.00, '/assets/pineapple.webp', 'Frutas'),
  (17, 'Cebolla',                8.00, 16.00, '/assets/onion.webp', 'Verduras'),
  (18, 'Jitomate Rojo',         12.00, 24.00, '/assets/tomato.webp', 'Verduras'),
  (19, 'Tomate Verde',          10.00, 20.00, '/assets/tomatillo.webp', 'Verduras'),
  (20, 'Calabaza',              10.00, 18.00, '/assets/zucchini.webp', 'Verduras'),
  (21, 'Papa',                   8.00, 15.00, '/assets/potato.webp', 'Verduras'),
  (22, 'Papaya',                18.00, 28.00, '/assets/papaya.webp', 'Frutas')
ON CONFLICT (id) DO NOTHING;
