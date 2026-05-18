-- Bloque 3 corregido: ejecutar solo este archivo si el bloque de players falló
-- (los bloques 1 y 2 ya los ejecutaste OK)

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
