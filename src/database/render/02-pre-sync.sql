-- Alinear permissions.name antes de TypeORM synchronize (evita ADD NOT NULL con filas NULL)

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
  ALTER COLUMN name SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'permissions_name_key'
  ) THEN
    ALTER TABLE permissions ADD CONSTRAINT permissions_name_key UNIQUE (name);
  END IF;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN duplicate_table THEN NULL;
END $$;
