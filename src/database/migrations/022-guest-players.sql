-- Jugadores en plantel sin cuenta en la app (vinculables después).

ALTER TABLE players
  ALTER COLUMN user_id DROP NOT NULL;

ALTER TABLE players
  ADD COLUMN IF NOT EXISTS guest_first_name VARCHAR(80) NULL,
  ADD COLUMN IF NOT EXISTS guest_last_name VARCHAR(80) NULL;

COMMENT ON COLUMN players.guest_first_name IS 'Nombre cuando user_id es NULL (jugador sin app)';
COMMENT ON COLUMN players.guest_last_name IS 'Apellido cuando user_id es NULL (jugador sin app)';
