-- Actualizar tabla notifications para soportar notificaciones deportivas
-- Primero, eliminar la tabla existente y recrearla con la nueva estructura

DROP TABLE IF EXISTS notifications CASCADE;

-- Crear tipos enum
CREATE TYPE notification_type AS ENUM (
    'match_invitation',
    'training_reminder', 
    'payment_reminder',
    'social_event',
    'medical_expiry',
    'general',
    'roster_update'
);

CREATE TYPE notification_priority AS ENUM (
    'low',
    'medium',
    'high',
    'urgent'
);

-- Recrear tabla notifications con nueva estructura
CREATE TABLE notifications (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    team_id INTEGER REFERENCES teams(id) ON DELETE SET NULL,
    event_id INTEGER REFERENCES events(id) ON DELETE SET NULL,
    type notification_type DEFAULT 'general',
    priority notification_priority DEFAULT 'medium',
    title VARCHAR(200) NOT NULL,
    message TEXT NOT NULL,
    data JSONB,
    is_read BOOLEAN DEFAULT FALSE,
    read_at TIMESTAMP,
    scheduled_for TIMESTAMP,
    sent BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Índices para mejorar performance
CREATE INDEX idx_notifications_user_id ON notifications(user_id);
CREATE INDEX idx_notifications_team_id ON notifications(team_id);
CREATE INDEX idx_notifications_type ON notifications(type);
CREATE INDEX idx_notifications_is_read ON notifications(is_read);
CREATE INDEX idx_notifications_scheduled_for ON notifications(scheduled_for);
CREATE INDEX idx_notifications_created_at ON notifications(created_at);

-- Trigger para actualizar updated_at
CREATE OR REPLACE FUNCTION update_notifications_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_notifications_updated_at
    BEFORE UPDATE ON notifications
    FOR EACH ROW
    EXECUTE FUNCTION update_notifications_updated_at();

-- Insertar algunas notificaciones de prueba
INSERT INTO notifications (
    user_id, 
    team_id, 
    type, 
    priority, 
    title, 
    message, 
    data,
    created_at
) VALUES
-- Notificaciones para el usuario admin (id=1)
(1, 7, 'match_invitation', 'high', '⚽ Convocatoria a Partido Oficial', 
 'Has sido convocado para el partido del sábado 15/02. Confirma tu asistencia.', 
 '{"matchDate": "2024-02-15", "opponent": "Rival FC", "location": "Estadio Central"}',
 NOW() - INTERVAL '2 hours'),

(1, 7, 'training_reminder', 'medium', '🏃‍♂️ Recordatorio de Entrenamiento', 
 'Entrenamiento programado para mañana a las 19:00. ¡No faltes!', 
 '{"trainingDate": "2024-02-10", "location": "Campo de entrenamiento", "duration": "90 minutos"}',
 NOW() - INTERVAL '1 day'),

(1, NULL, 'medical_expiry', 'urgent', '🏥 Apto Médico por Vencer', 
 'Tu apto médico vence en 5 días. Renuévalo para seguir jugando.', 
 '{"expiryDate": "2024-02-15", "daysUntilExpiry": 5}',
 NOW() - INTERVAL '3 hours'),

(1, 7, 'payment_reminder', 'high', '💰 Recordatorio de Pago', 
 'Tienes cuotas pendientes. Paga antes del 20/02 para mantener tu habilitación.', 
 '{"amount": 5000, "dueDate": "2024-02-20", "concept": "Cuota mensual febrero"}',
 NOW() - INTERVAL '6 hours'),

(1, 7, 'social_event', 'low', '🎉 Evento Social del Equipo', 
 'Asado de fin de temporada - Sábado 25/02. ¡Acompáñanos!', 
 '{"eventTitle": "Asado de fin de temporada", "eventDate": "2024-02-25", "location": "Quincho del club", "hasExpenses": true}',
 NOW() - INTERVAL '12 hours');
