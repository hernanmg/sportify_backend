-- Alinear columna permissions.name antes de TypeORM synchronize (dev local).

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
