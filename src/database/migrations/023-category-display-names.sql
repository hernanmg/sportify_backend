-- Nombres de categoría compuestos (Masculino +35 en lugar de Masculino y +35 por separado).

UPDATE categories SET name = 'Masculino Libre' WHERE name = 'Libre';
UPDATE categories SET name = 'Masculino +35' WHERE name = '+35';
UPDATE categories SET name = 'Masculino +40' WHERE name = '+40';
UPDATE categories SET name = 'Masculino +45' WHERE name = '+45';

UPDATE player_roster pr
SET category = c.name
FROM categories c
WHERE pr.category_id = c.id;

UPDATE player_roster SET category = 'Masculino Libre' WHERE category = 'Libre';
UPDATE player_roster SET category = 'Masculino +35' WHERE category = '+35';
UPDATE player_roster SET category = 'Masculino +40' WHERE category = '+40';
UPDATE player_roster SET category = 'Masculino +45' WHERE category = '+45';

-- Categoría genérica "Masculino" sin edad: desactivar si no hay plantel.
UPDATE categories c
SET is_active = false
WHERE c.name = 'Masculino'
  AND NOT EXISTS (
    SELECT 1 FROM player_roster pr WHERE pr.category_id = c.id
  );
