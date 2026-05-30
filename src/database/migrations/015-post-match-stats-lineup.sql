-- Post-partido Fase 2: resultado, alineación y estadísticas

ALTER TABLE sport_events
  ADD COLUMN IF NOT EXISTS team_score INT;

ALTER TABLE sport_events
  ADD COLUMN IF NOT EXISTS opponent_score INT;

ALTER TABLE event_participants
  ADD COLUMN IF NOT EXISTS is_starter BOOLEAN NOT NULL DEFAULT FALSE;

CREATE TABLE IF NOT EXISTS match_player_stats (
  id SERIAL PRIMARY KEY,
  sport_event_id INT NOT NULL REFERENCES sport_events(id) ON DELETE CASCADE,
  user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  goals INT NOT NULL DEFAULT 0,
  assists INT NOT NULL DEFAULT 0,
  yellow_cards INT NOT NULL DEFAULT 0,
  red_cards INT NOT NULL DEFAULT 0,
  minutes_played INT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE (sport_event_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_match_player_stats_event
  ON match_player_stats(sport_event_id);
