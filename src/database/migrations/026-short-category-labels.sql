-- Etiquetas cortas de categoría en toda la app (M+35, M-Libre, F+30).

UPDATE categories SET name = 'M-Libre' WHERE name IN ('Libre', 'Masculino Libre');
UPDATE categories SET name = 'M+35' WHERE name IN ('+35', 'Masculino +35');
UPDATE categories SET name = 'M+40' WHERE name IN ('+40', 'Masculino +40');
UPDATE categories SET name = 'M+45' WHERE name IN ('+45', 'Masculino +45');
UPDATE categories SET name = 'F+30' WHERE name IN ('Femenino +30');

UPDATE categories c
SET is_active = false
WHERE c.name IN ('Masculino', 'Femenino')
  AND NOT EXISTS (
    SELECT 1 FROM player_roster pr WHERE pr.category_id = c.id
  );

UPDATE player_roster pr
SET category = c.name
FROM categories c
WHERE pr.category_id = c.id;

UPDATE player_roster SET category = 'M-Libre' WHERE category IN ('Libre', 'Masculino Libre');
UPDATE player_roster SET category = 'M+35' WHERE category IN ('+35', 'Masculino +35');
UPDATE player_roster SET category = 'M+40' WHERE category IN ('+40', 'Masculino +40');
UPDATE player_roster SET category = 'M+45' WHERE category IN ('+45', 'Masculino +45');
UPDATE player_roster SET category = 'F+30' WHERE category IN ('Femenino +30', 'Femenino');
