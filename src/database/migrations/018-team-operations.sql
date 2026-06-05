-- 018: Asistencia unificada, cargos por entrenamiento, categoría ledger training

CREATE TABLE IF NOT EXISTS fee_charges (
    id SERIAL PRIMARY KEY,
    team_id INTEGER NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type VARCHAR(30) NOT NULL DEFAULT 'monthly_quota',
    concept VARCHAR(150) NOT NULL,
    amount DECIMAL(12, 2) NOT NULL,
    paid_amount DECIMAL(12, 2) NOT NULL DEFAULT 0,
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    due_date DATE,
    season VARCHAR(20),
    created_by INTEGER,
    sport_event_id INTEGER REFERENCES sport_events(id) ON DELETE SET NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_fee_charges_team_user
    ON fee_charges(team_id, user_id);

ALTER TABLE event_participants
  ADD COLUMN IF NOT EXISTS attendance_status VARCHAR(20) NULL;

COMMENT ON COLUMN event_participants.attendance_status IS
  'present | absent | justified — asistencia real al evento';

UPDATE event_participants
SET attendance_status = CASE
  WHEN attended = true THEN 'present'
  WHEN attended = false THEN 'absent'
  ELSE NULL
END
WHERE attendance_status IS NULL AND attended IS NOT NULL;

ALTER TABLE fee_charges
  ADD COLUMN IF NOT EXISTS sport_event_id INT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_fee_charges_sport_event'
  ) THEN
    ALTER TABLE fee_charges
      ADD CONSTRAINT fk_fee_charges_sport_event
      FOREIGN KEY (sport_event_id) REFERENCES sport_events(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_fee_charges_sport_event
  ON fee_charges(sport_event_id);
