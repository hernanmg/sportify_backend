-- Migración para agregar sport_event_id a notifications
-- y corregir la relación con sport_events

-- Agregar nueva columna sport_event_id
ALTER TABLE notifications 
ADD COLUMN sport_event_id INTEGER;

-- Agregar clave foránea para sport_events
ALTER TABLE notifications 
ADD CONSTRAINT FK_notifications_sport_event_id 
FOREIGN KEY (sport_event_id) REFERENCES sport_events(id) ON DELETE SET NULL;

-- Crear índice para mejorar performance
CREATE INDEX idx_notifications_sport_event_id ON notifications(sport_event_id);

-- Comentarios para claridad
COMMENT ON COLUMN notifications.event_id IS 'Referencia a events (eventos de partido - goles, tarjetas)';
COMMENT ON COLUMN notifications.sport_event_id IS 'Referencia a sport_events (eventos deportivos - entrenamientos, partidos)';
