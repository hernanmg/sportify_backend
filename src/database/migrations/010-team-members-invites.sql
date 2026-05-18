CREATE TABLE IF NOT EXISTS team_members (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  team_id INTEGER NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  role VARCHAR(20) NOT NULL DEFAULT 'player',
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, team_id)
);

CREATE INDEX IF NOT EXISTS idx_team_members_team ON team_members(team_id);
CREATE INDEX IF NOT EXISTS idx_team_members_user ON team_members(user_id);

CREATE TABLE IF NOT EXISTS team_invites (
  id SERIAL PRIMARY KEY,
  team_id INTEGER NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  code VARCHAR(12) NOT NULL UNIQUE,
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  category_ids JSONB,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_team_invites_team ON team_invites(team_id);
