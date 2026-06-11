-- Corrige temporadas legado 2025-2026 → 2026-Apertura / 2026-Clausura
-- Ejecutar una vez en Neon si hay fichas creadas con joinWithCode antes del fix.

BEGIN;

UPDATE player_roster
SET season = '2026-Apertura'
WHERE season ~ '^\d{4}-\d{4}$'
  AND EXTRACT(MONTH FROM CURRENT_DATE) <= 6;

UPDATE player_roster
SET season = '2026-Clausura'
WHERE season ~ '^\d{4}-\d{4}$'
  AND EXTRACT(MONTH FROM CURRENT_DATE) > 6;

SELECT season, COUNT(*) FROM player_roster GROUP BY season ORDER BY season;

COMMIT;
