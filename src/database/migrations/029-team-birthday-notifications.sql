-- Notificaciones de cumpleaños: hora configurable por equipo + tipo de notificación.

ALTER TABLE teams
  ADD COLUMN IF NOT EXISTS birthday_notification_hour SMALLINT NOT NULL DEFAULT 9;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'teams_birthday_notification_hour_check'
  ) THEN
    ALTER TABLE teams
      ADD CONSTRAINT teams_birthday_notification_hour_check
      CHECK (birthday_notification_hour >= 0 AND birthday_notification_hour <= 23);
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'notification_type') THEN
    ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'birthday';
  END IF;
END $$;
