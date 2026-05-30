-- Acta / reseña post-partido
ALTER TABLE sport_events
  ADD COLUMN IF NOT EXISTS post_match_report TEXT,
  ADD COLUMN IF NOT EXISTS post_match_report_updated_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS post_match_report_updated_at TIMESTAMPTZ;

