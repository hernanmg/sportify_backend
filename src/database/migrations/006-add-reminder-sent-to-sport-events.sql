-- Migración: Agregar campo reminder_sent a sport_events
-- Fecha: 2025-11-15
-- Descripción: Agregar control de recordatorios enviados para evitar duplicados

-- Agregar columna reminder_sent
ALTER TABLE sport_events 
ADD COLUMN IF NOT EXISTS reminder_sent BOOLEAN DEFAULT false;

-- Crear índice para mejorar performance de queries del scheduler
CREATE INDEX IF NOT EXISTS idx_sport_events_reminder_sent 
ON sport_events(reminder_sent, event_date, status, type);

-- Comentarios
COMMENT ON COLUMN sport_events.reminder_sent IS 'Indica si ya se envió el recordatorio automático para este evento';
COMMENT ON INDEX idx_sport_events_reminder_sent IS 'Índice compuesto para optimizar búsqueda de eventos pendientes de recordatorio';

