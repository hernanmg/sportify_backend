CREATE TABLE IF NOT EXISTS training_schedules (
  id SERIAL PRIMARY KEY,
  team_id INT NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  title VARCHAR(200) NOT NULL DEFAULT 'Entrenamiento',
  weekday SMALLINT NOT NULL CHECK (weekday >= 0 AND weekday <= 6),
  hour SMALLINT NOT NULL CHECK (hour >= 0 AND hour <= 23),
  minute SMALLINT NOT NULL DEFAULT 0 CHECK (minute >= 0 AND minute <= 59),
  duration_minutes INT,
  location VARCHAR(255),
  category_ids INT[] NULL,
  weeks_ahead INT NOT NULL DEFAULT 8,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_by INT REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_training_schedules_team
  ON training_schedules (team_id)
  WHERE active = TRUE;
