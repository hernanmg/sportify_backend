-- Post-partido: votación entre pares y notas oficiales DT

CREATE TABLE IF NOT EXISTS match_peer_ratings (
  id SERIAL PRIMARY KEY,
  sport_event_id INT NOT NULL REFERENCES sport_events(id) ON DELETE CASCADE,
  rater_user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  rated_user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  score SMALLINT NOT NULL CHECK (score >= 1 AND score <= 10),
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE (sport_event_id, rater_user_id, rated_user_id)
);

CREATE INDEX IF NOT EXISTS idx_match_peer_ratings_event
  ON match_peer_ratings(sport_event_id);

CREATE TABLE IF NOT EXISTS match_official_ratings (
  id SERIAL PRIMARY KEY,
  sport_event_id INT NOT NULL REFERENCES sport_events(id) ON DELETE CASCADE,
  rated_user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  score SMALLINT NOT NULL CHECK (score >= 1 AND score <= 10),
  set_by_user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE (sport_event_id, rated_user_id)
);

CREATE INDEX IF NOT EXISTS idx_match_official_ratings_event
  ON match_official_ratings(sport_event_id);

ALTER TABLE sport_events
  ADD COLUMN IF NOT EXISTS post_match_voting_closed BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE sport_events
  ADD COLUMN IF NOT EXISTS player_of_match_user_id INT REFERENCES users(id) ON DELETE SET NULL;
