-- Tácticas guardadas por equipo (pizarra + alineación)
CREATE TABLE IF NOT EXISTS team_tactical_boards (
  id SERIAL PRIMARY KEY,
  team_id INTEGER NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  name VARCHAR(120) NOT NULL,
  formation VARCHAR(20),
  lineup_slots JSONB NOT NULL DEFAULT '{}',
  board_strokes JSONB NOT NULL DEFAULT '[]',
  created_by_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  share_token UUID UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_team_tactical_boards_team
  ON team_tactical_boards(team_id);

CREATE INDEX IF NOT EXISTS idx_team_tactical_boards_share_token
  ON team_tactical_boards(share_token)
  WHERE share_token IS NOT NULL;
