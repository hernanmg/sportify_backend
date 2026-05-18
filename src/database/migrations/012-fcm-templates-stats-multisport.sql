-- FCM device tokens, tipos de notificación, posiciones por deporte

CREATE TABLE IF NOT EXISTS device_tokens (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token VARCHAR(512) NOT NULL,
  platform VARCHAR(10) NOT NULL CHECK (platform IN ('ios', 'android', 'web')),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, token)
);

CREATE INDEX IF NOT EXISTS idx_device_tokens_user_active
  ON device_tokens(user_id, is_active);

-- Extender tipos de notificación (el enum puede no existir si no corriste 003)
DO $$
DECLARE
  enum_name text;
BEGIN
  SELECT t.typname INTO enum_name
  FROM pg_attribute a
  JOIN pg_class c ON c.oid = a.attrelid
  JOIN pg_type t ON t.oid = a.atttypid
  WHERE c.relname = 'notifications'
    AND a.attname = 'type'
    AND t.typtype = 'e'
  LIMIT 1;

  IF enum_name IS NOT NULL THEN
    EXECUTE format(
      'ALTER TYPE %I ADD VALUE IF NOT EXISTS %L',
      enum_name, 'impediment_cleared'
    );
    EXECUTE format(
      'ALTER TYPE %I ADD VALUE IF NOT EXISTS %L',
      enum_name, 'player_eligible'
    );
    RAISE NOTICE 'Valores agregados al enum %', enum_name;
  ELSIF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'notification_type') THEN
    ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'impediment_cleared';
    ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'player_eligible';
    RAISE NOTICE 'Valores agregados a notification_type';
  ELSE
    RAISE NOTICE
      'Columna notifications.type no usa ENUM (probable VARCHAR). '
      'No hace falta ALTER TYPE; los nuevos tipos funcionan igual.';
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS sport_positions (
  id SERIAL PRIMARY KEY,
  sport_id INT NOT NULL REFERENCES sports(id) ON DELETE CASCADE,
  code VARCHAR(40) NOT NULL,
  label VARCHAR(80) NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  UNIQUE(sport_id, code)
);

INSERT INTO sport_positions (sport_id, code, label, sort_order)
SELECT s.id, v.code, v.label, v.ord
FROM sports s
CROSS JOIN (VALUES
  ('goalkeeper', 'Arquero', 1),
  ('defender', 'Defensor', 2),
  ('midfielder', 'Mediocampo', 3),
  ('forward', 'Delantero', 4),
  ('player', 'Jugador', 5)
) AS v(code, label, ord)
WHERE LOWER(s.name) LIKE '%fútbol%' OR LOWER(s.name) LIKE '%futbol%'
ON CONFLICT (sport_id, code) DO NOTHING;
