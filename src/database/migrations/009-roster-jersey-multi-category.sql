-- Mismo jugador, mismo dorsal, varias categorías en el mismo equipo/temporada.
-- Dorsal entre jugadores distintos: validación en roster.service.

DO $$
DECLARE
  cname text;
BEGIN
  FOR cname IN
    SELECT con.conname
    FROM pg_constraint con
    JOIN pg_class rel ON rel.oid = con.conrelid
    JOIN pg_attribute a1 ON a1.attrelid = rel.oid AND a1.attnum = con.conkey[1]
    JOIN pg_attribute a2 ON a2.attrelid = rel.oid AND a2.attnum = con.conkey[2]
    JOIN pg_attribute a3 ON a3.attrelid = rel.oid AND a3.attnum = con.conkey[3]
    WHERE rel.relname = 'player_roster'
      AND con.contype = 'u'
      AND array_length(con.conkey, 1) = 3
      AND a1.attname = 'team_id'
      AND a2.attname = 'jersey_number'
      AND a3.attname = 'season'
  LOOP
    EXECUTE format('ALTER TABLE player_roster DROP CONSTRAINT %I', cname);
  END LOOP;
END $$;
