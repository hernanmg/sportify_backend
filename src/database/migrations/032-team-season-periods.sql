-- Fechas desde/hasta por equipo y temporada (torneo)
CREATE TABLE IF NOT EXISTS team_season_periods (
  id SERIAL PRIMARY KEY,
  team_id INT NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  season VARCHAR(40) NOT NULL,
  start_date DATE,
  end_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (team_id, season)
);

CREATE INDEX IF NOT EXISTS idx_team_season_periods_team
  ON team_season_periods(team_id);
