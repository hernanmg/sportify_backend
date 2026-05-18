-- Elegibilidad de jugadores + campos de convocatoria

ALTER TABLE sport_events
  ADD COLUMN IF NOT EXISTS court_number VARCHAR(20) NULL;

ALTER TABLE event_participants
  ADD COLUMN IF NOT EXISTS is_convoked BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS eligibility_status VARCHAR(30) NULL,
  ADD COLUMN IF NOT EXISTS eligibility_detail TEXT NULL,
  ADD COLUMN IF NOT EXISTS fee_override_by INT NULL,
  ADD COLUMN IF NOT EXISTS fee_override_at TIMESTAMP NULL;

CREATE TABLE IF NOT EXISTS player_impediments (
  id SERIAL PRIMARY KEY,
  team_id INT NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  impediment_type VARCHAR(20) NOT NULL CHECK (impediment_type IN ('injury', 'suspension', 'other')),
  description TEXT NULL,
  start_date DATE NOT NULL DEFAULT CURRENT_DATE,
  duration_days INT NULL,
  end_date DATE NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_by INT NULL REFERENCES users(id) ON DELETE SET NULL,
  updated_by INT NULL REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_player_impediments_team_user
  ON player_impediments(team_id, user_id, is_active);

CREATE TABLE IF NOT EXISTS player_fee_overrides (
  id SERIAL PRIMARY KEY,
  team_id INT NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reason TEXT NULL,
  overridden_by INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  overridden_at TIMESTAMP NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMP NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  UNIQUE(team_id, user_id)
);

CREATE TABLE IF NOT EXISTS player_status_audit_log (
  id SERIAL PRIMARY KEY,
  team_id INT NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  action VARCHAR(50) NOT NULL,
  payload JSONB NULL,
  performed_by INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  performed_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_player_status_audit_team
  ON player_status_audit_log(team_id, performed_at DESC);

-- Plantillas de convocatoria (fase posterior, esquema base)
CREATE TABLE IF NOT EXISTS convocation_templates (
  id SERIAL PRIMARY KEY,
  team_id INT NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  name VARCHAR(120) NOT NULL,
  default_participant_user_ids JSONB NULL,
  metadata JSONB NULL,
  created_by INT NULL REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);
