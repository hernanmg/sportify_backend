-- Cierres de caja por equipo / temporada
CREATE TABLE IF NOT EXISTS cash_closures (
  id SERIAL PRIMARY KEY,
  team_id INT NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  season VARCHAR(30),
  closed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  closed_by INT REFERENCES users(id) ON DELETE SET NULL,
  previous_cash_balance NUMERIC(12, 2) NOT NULL DEFAULT 0,
  outstanding_carried NUMERIC(12, 2) NOT NULL DEFAULT 0,
  carry_pending_quotas BOOLEAN NOT NULL DEFAULT TRUE,
  reset_cash_to_zero BOOLEAN NOT NULL DEFAULT TRUE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cash_closures_team
  ON cash_closures(team_id, closed_at DESC);
