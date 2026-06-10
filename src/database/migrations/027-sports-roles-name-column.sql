-- Alinear sports.name y roles.name (mismo fix que 02-pre-sync.sql).

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'sports'
      AND column_name = 'name'
  ) THEN
    ALTER TABLE sports ADD COLUMN name VARCHAR(50);
  END IF;
END $$;

UPDATE sports
SET name = COALESCE(NULLIF(TRIM(name), ''), 'Fútbol')
WHERE name IS NULL OR TRIM(name) = '';

UPDATE sports s
SET name = 'SPORT_' || s.id::text
WHERE name IS NULL OR TRIM(name) = ''
   OR EXISTS (
     SELECT 1 FROM sports s2
     WHERE s2.name = s.name AND s2.id < s.id
   );

ALTER TABLE sports
  ALTER COLUMN name TYPE VARCHAR(50) USING SUBSTRING(name FROM 1 FOR 50),
  ALTER COLUMN name SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'sports_name_key'
  ) THEN
    ALTER TABLE sports ADD CONSTRAINT sports_name_key UNIQUE (name);
  END IF;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'roles'
      AND column_name = 'name'
  ) THEN
    ALTER TABLE roles ADD COLUMN name VARCHAR(50);
  END IF;
END $$;

UPDATE roles
SET name = 'ROLE_' || id::text
WHERE name IS NULL OR TRIM(name) = '';

ALTER TABLE roles
  ALTER COLUMN name TYPE VARCHAR(50) USING SUBSTRING(name FROM 1 FOR 50),
  ALTER COLUMN name SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'roles_name_key'
  ) THEN
    ALTER TABLE roles ADD CONSTRAINT roles_name_key UNIQUE (name);
  END IF;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
