-- Quién creó el equipo (para detectar duplicados por admin, no solo por nombre).

ALTER TABLE teams
  ADD COLUMN IF NOT EXISTS created_by_user_id INT REFERENCES users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_teams_created_by ON teams(created_by_user_id);

-- Backfill: primer admin en team_members
UPDATE teams t
SET created_by_user_id = sub.user_id
FROM (
  SELECT DISTINCT ON (team_id) team_id, user_id
  FROM team_members
  WHERE role = 'admin'
  ORDER BY team_id, id ASC
) sub
WHERE t.id = sub.team_id
  AND t.created_by_user_id IS NULL;
