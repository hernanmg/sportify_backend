-- Ejecutar ANTES del 007 si el script falla: muestra problemas comunes.
-- No modifica datos.

-- ¿Transacción abortada? (si el cliente sigue en error, ejecutá ROLLBACK;)
SELECT 'Si ves error 25P02, ejecutá: ROLLBACK;' AS ayuda;

-- Rosters con player_id = user_id (incorrecto)
SELECT pr.id AS roster_id, pr.player_id AS guardado, pl.id AS player_real, u.username
FROM player_roster pr
LEFT JOIN players pl ON pl.id = pr.player_id
LEFT JOIN users u ON u.id = pr.player_id
WHERE pl.id IS NULL AND u.id IS NOT NULL;

-- Duplicados que bloquean el UNIQUE final
SELECT player_id, team_id, season, category_id, COUNT(*) AS cnt
FROM player_roster
GROUP BY player_id, team_id, season, category_id
HAVING COUNT(*) > 1;

-- Categorías de roster sin match
SELECT pr.id, pr.category, pr.team_id, t.sport_id
FROM player_roster pr
JOIN teams t ON t.id = pr.team_id
WHERE pr.category_id IS NULL AND TRIM(pr.category) <> '';
