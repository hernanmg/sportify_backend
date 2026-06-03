-- 018: Asistencia unificada, cargos por entrenamiento, categoría ledger training

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
