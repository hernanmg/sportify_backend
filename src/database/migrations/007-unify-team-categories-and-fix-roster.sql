-- =============================================================================
-- 007 - Migración: equipos multi-categoría + fix roster
-- =============================================================================
-- pgAdmin:
--   1) Abrí Query Tool en la base sportify_amateur
--   2) Si alguna vez falló con 25P02, ejecutá PRIMERO solo:  ROLLBACK;
--   3) Menú: File → Open → este archivo
--   4) Botón "Execute script" (ícono ▶ con documento) — NO uses solo F5
--   5) Al final ejecutá las consultas de VERIFICACIÓN (abajo)
--
-- SIN BEGIN/COMMIT: cada sentencia confirma sola (evita 25P02 en bloque)
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1) Tabla team_categories
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS team_categories (
    id SERIAL PRIMARY KEY,
    team_id INTEGER NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    category_id INTEGER NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(team_id, category_id)
);

CREATE INDEX IF NOT EXISTS idx_team_categories_team ON team_categories(team_id);
CREATE INDEX IF NOT EXISTS idx_team_categories_category ON team_categories(category_id);

INSERT INTO team_categories (team_id, category_id)
SELECT t.id, t.category_id
FROM teams t
WHERE t.category_id IS NOT NULL
ON CONFLICT (team_id, category_id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 2) category_id en player_roster
-- ---------------------------------------------------------------------------
ALTER TABLE player_roster
    ADD COLUMN IF NOT EXISTS category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL;

DO $$
BEGIN
    ALTER TABLE player_roster ALTER COLUMN category TYPE VARCHAR(50);
EXCEPTION
    WHEN others THEN
        RAISE NOTICE 'columna category: %', SQLERRM;
END $$;

UPDATE player_roster pr
SET category_id = c.id
FROM teams t
JOIN categories c ON c.sport_id = t.sport_id
WHERE pr.team_id = t.id
  AND pr.category_id IS NULL
  AND TRIM(pr.category) <> ''
  AND TRIM(LOWER(c.name)) = TRIM(LOWER(pr.category));

INSERT INTO categories (name, sport_id, is_active, sort_order, created_at, updated_at)
SELECT DISTINCT TRIM(src.category_name), src.sport_id, TRUE, 0, NOW(), NOW()
FROM (
    SELECT TRIM(pr.category) AS category_name, t.sport_id AS sport_id
    FROM player_roster pr
    JOIN teams t ON t.id = pr.team_id
    WHERE pr.category_id IS NULL
      AND TRIM(pr.category) <> ''
) src
WHERE NOT EXISTS (
    SELECT 1 FROM categories c
    WHERE c.sport_id = src.sport_id
      AND TRIM(LOWER(c.name)) = TRIM(LOWER(src.category_name))
);

UPDATE player_roster pr
SET category_id = c.id
FROM teams t
JOIN categories c ON c.sport_id = t.sport_id
WHERE pr.team_id = t.id
  AND pr.category_id IS NULL
  AND TRIM(pr.category) <> ''
  AND TRIM(LOWER(c.name)) = TRIM(LOWER(pr.category));

INSERT INTO team_categories (team_id, category_id)
SELECT DISTINCT pr.team_id, pr.category_id
FROM player_roster pr
WHERE pr.category_id IS NOT NULL
ON CONFLICT (team_id, category_id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 3) Reparar player_id (se guardó user_id por error)
-- ---------------------------------------------------------------------------
-- Sin ON CONFLICT: en esta BD puede no existir UNIQUE(user_id, team_id)
INSERT INTO players (user_id, team_id, is_active, joined_team_date)
SELECT DISTINCT pr.player_id, pr.team_id, TRUE, CURRENT_DATE
FROM player_roster pr
WHERE NOT EXISTS (SELECT 1 FROM players p WHERE p.id = pr.player_id)
  AND EXISTS (SELECT 1 FROM users u WHERE u.id = pr.player_id)
  AND NOT EXISTS (
    SELECT 1 FROM players p2
    WHERE p2.user_id = pr.player_id AND p2.team_id = pr.team_id
  );

UPDATE player_roster pr
SET player_id = pl.id
FROM players pl
WHERE pl.user_id = pr.player_id
  AND pl.team_id = pr.team_id
  AND pr.player_id IS DISTINCT FROM pl.id;

UPDATE player_roster pr
SET player_id = pl.id
FROM players pl
WHERE pl.user_id = pr.player_id
  AND pr.player_id IS DISTINCT FROM pl.id
  AND NOT EXISTS (SELECT 1 FROM players px WHERE px.id = pr.player_id);

-- ---------------------------------------------------------------------------
-- 4) Restricción única por categoría
-- ---------------------------------------------------------------------------
ALTER TABLE player_roster
    DROP CONSTRAINT IF EXISTS player_roster_player_id_team_id_season_key;

ALTER TABLE player_roster
    DROP CONSTRAINT IF EXISTS "UQ_player_roster_player_team_season_category";

ALTER TABLE player_roster
    DROP CONSTRAINT IF EXISTS uq_roster_player_team_season_category;

DELETE FROM player_roster a
USING player_roster b
WHERE a.id > b.id
  AND a.player_id = b.player_id
  AND a.team_id = b.team_id
  AND a.season = b.season
  AND COALESCE(a.category_id, -1) = COALESCE(b.category_id, -1);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'uq_roster_player_team_season_category'
    ) THEN
        ALTER TABLE player_roster
            ADD CONSTRAINT uq_roster_player_team_season_category
            UNIQUE (player_id, team_id, season, category_id);
    END IF;
EXCEPTION
    WHEN unique_violation THEN
        RAISE NOTICE 'No se pudo crear UNIQUE: hay duplicados. Ejecutá la consulta de duplicados en 007-diagnose-before-migrate.sql';
END $$;

-- =============================================================================
-- VERIFICACIÓN (ejecutar después — deberían devolver filas / sin error)
-- =============================================================================
-- ¿Existe team_categories?
SELECT 'team_categories' AS tabla, COUNT(*) AS filas FROM team_categories;

-- ¿Roster con category_id?
SELECT COUNT(*) AS roster_con_category_id
FROM player_roster WHERE category_id IS NOT NULL;

-- ¿player_id mal enlazado? (debería ser 0 filas)
SELECT COUNT(*) AS roster_sin_player_valido
FROM player_roster pr
LEFT JOIN players pl ON pl.id = pr.player_id
WHERE pl.id IS NULL;
