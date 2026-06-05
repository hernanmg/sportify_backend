-- Alinear columnas "name" requeridas antes de TypeORM synchronize
-- (evita ADD NOT NULL cuando ya hay filas o varchar/text no coinciden con la entidad)

-- permissions (varchar 50)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'permissions'
      AND column_name = 'name'
  ) THEN
    ALTER TABLE permissions ADD COLUMN name VARCHAR(50);
  END IF;
END $$;

UPDATE permissions
SET name = 'PERM_' || id::text
WHERE name IS NULL OR TRIM(name) = '';

ALTER TABLE permissions
  ALTER COLUMN name TYPE VARCHAR(50) USING SUBSTRING(name FROM 1 FOR 50),
  ALTER COLUMN name SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'permissions_name_key'
  ) THEN
    ALTER TABLE permissions ADD CONSTRAINT permissions_name_key UNIQUE (name);
  END IF;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- sports (varchar 50 — no text, alineado con tables.sql y sport.entity)
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
SET name = 'SPORT_' || id::text
WHERE name IS NULL OR TRIM(name) = '';

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

-- roles (varchar 50)
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
