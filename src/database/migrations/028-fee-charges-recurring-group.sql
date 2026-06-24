-- Grupo para cuotas mensuales generadas en serie (recurrentes)
ALTER TABLE fee_charges
  ADD COLUMN IF NOT EXISTS recurring_group_id VARCHAR(36) NULL;

CREATE INDEX IF NOT EXISTS idx_fee_charges_recurring_group
  ON fee_charges (team_id, recurring_group_id)
  WHERE recurring_group_id IS NOT NULL;
