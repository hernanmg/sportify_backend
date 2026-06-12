-- Campo "ficha de qué equipo" en perfil de usuario.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'users'
      AND column_name = 'ficha_origen'
  ) THEN
    ALTER TABLE users ADD COLUMN ficha_origen VARCHAR(150);
  END IF;
END $$;
