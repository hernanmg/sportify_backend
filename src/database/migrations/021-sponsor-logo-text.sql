-- Logo de sponsor: puede ser URL o data URI (imagen comprimida desde la app)
ALTER TABLE team_sponsors
  ALTER COLUMN logo_url TYPE TEXT;
