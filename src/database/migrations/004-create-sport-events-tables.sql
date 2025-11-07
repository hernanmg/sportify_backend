-- Crear tipos enum para eventos deportivos
CREATE TYPE sport_event_type AS ENUM (
    'training',
    'match', 
    'social',
    'meeting'
);

CREATE TYPE sport_event_status AS ENUM (
    'draft',
    'scheduled',
    'confirmed',
    'in_progress',
    'completed',
    'cancelled'
);

CREATE TYPE participant_status AS ENUM (
    'pending',
    'confirmed',
    'declined',
    'no_response'
);

CREATE TYPE participant_role AS ENUM (
    'player',
    'substitute',
    'coach',
    'staff'
);

-- Crear tabla sport_events
CREATE TABLE sport_events (
    id SERIAL PRIMARY KEY,
    title VARCHAR(200) NOT NULL,
    description TEXT,
    type sport_event_type DEFAULT 'training',
    status sport_event_status DEFAULT 'scheduled',
    event_date TIMESTAMP NOT NULL,
    duration_minutes INTEGER,
    location VARCHAR(300),
    team_id INTEGER NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    created_by INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Para partidos
    opponent_name VARCHAR(100),
    is_home_match BOOLEAN DEFAULT TRUE,
    is_official_match BOOLEAN DEFAULT FALSE,
    
    -- Para eventos sociales
    has_expenses BOOLEAN DEFAULT FALSE,
    estimated_cost DECIMAL(10,2),
    
    -- Configuración de participación
    max_participants INTEGER,
    requires_confirmation BOOLEAN DEFAULT TRUE,
    confirmation_deadline TIMESTAMP,
    requires_payment_up_to_date BOOLEAN DEFAULT FALSE,
    
    -- Notas y metadata
    notes TEXT,
    metadata JSONB,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Crear tabla event_participants
CREATE TABLE event_participants (
    id SERIAL PRIMARY KEY,
    event_id INTEGER NOT NULL REFERENCES sport_events(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status participant_status DEFAULT 'pending',
    role participant_role DEFAULT 'player',
    response_date TIMESTAMP,
    notes TEXT,
    
    -- Para eventos con gastos
    expense_share DECIMAL(10,2),
    has_paid_expenses BOOLEAN DEFAULT FALSE,
    
    -- Para partidos
    playing_position VARCHAR(50),
    
    -- Para control de asistencia
    attended BOOLEAN,
    attendance_notes TEXT,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Un usuario solo puede participar una vez por evento
    CONSTRAINT uq_event_user UNIQUE (event_id, user_id)
);

-- Índices para mejorar performance
CREATE INDEX idx_sport_events_team_id ON sport_events(team_id);
CREATE INDEX idx_sport_events_type ON sport_events(type);
CREATE INDEX idx_sport_events_status ON sport_events(status);
CREATE INDEX idx_sport_events_event_date ON sport_events(event_date);
CREATE INDEX idx_sport_events_created_by ON sport_events(created_by);

CREATE INDEX idx_event_participants_event_id ON event_participants(event_id);
CREATE INDEX idx_event_participants_user_id ON event_participants(user_id);
CREATE INDEX idx_event_participants_status ON event_participants(status);

-- Triggers para actualizar updated_at
CREATE OR REPLACE FUNCTION update_sport_events_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_sport_events_updated_at
    BEFORE UPDATE ON sport_events
    FOR EACH ROW
    EXECUTE FUNCTION update_sport_events_updated_at();

CREATE OR REPLACE FUNCTION update_event_participants_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_event_participants_updated_at
    BEFORE UPDATE ON event_participants
    FOR EACH ROW
    EXECUTE FUNCTION update_event_participants_updated_at();

-- Insertar datos de prueba
INSERT INTO sport_events (
    title,
    description,
    type,
    status,
    event_date,
    duration_minutes,
    location,
    team_id,
    created_by,
    opponent_name,
    is_home_match,
    is_official_match,
    requires_confirmation,
    confirmation_deadline,
    requires_payment_up_to_date,
    notes
) VALUES
-- Entrenamientos
('Entrenamiento Semanal', 'Entrenamiento regular del equipo', 'training', 'scheduled', 
 '2024-02-15 19:00:00', 90, 'Campo de entrenamiento', 3, 1, 
 NULL, TRUE, FALSE, TRUE, '2024-02-15 12:00:00', FALSE, 'Traer botines y agua'),

('Entrenamiento Táctico', 'Práctica de jugadas y estrategias', 'training', 'scheduled', 
 '2024-02-20 18:30:00', 120, 'Campo principal', 3, 1, 
 NULL, TRUE, FALSE, TRUE, '2024-02-20 10:00:00', FALSE, 'Enfoque en defensa'),

-- Partidos
('Partido vs Rival FC', 'Partido oficial de liga', 'match', 'confirmed', 
 '2024-02-18 16:00:00', 90, 'Estadio Central', 3, 1, 
 'Rival FC', FALSE, TRUE, TRUE, '2024-02-17 12:00:00', TRUE, 'Partido importante para la tabla'),

('Amistoso vs Local United', 'Partido amistoso de preparación', 'match', 'scheduled', 
 '2024-02-22 15:00:00', 90, 'Cancha del club', 3, 1, 
 'Local United', TRUE, FALSE, TRUE, '2024-02-21 18:00:00', FALSE, 'Partido de práctica'),

-- Eventos sociales
('Asado de Fin de Temporada', 'Celebración del equipo', 'social', 'scheduled', 
 '2024-02-25 14:00:00', 240, 'Quincho del club', 3, 1, 
 NULL, TRUE, FALSE, TRUE, '2024-02-23 20:00:00', FALSE, 'Traer bebidas y acompañamientos'),

('Reunión de Padres', 'Reunión informativa con padres de jugadores', 'meeting', 'scheduled', 
 '2024-02-28 19:00:00', 60, 'Salón del club', 3, 1, 
 NULL, TRUE, FALSE, TRUE, '2024-02-27 12:00:00', FALSE, 'Temas: calendario y cuotas');

-- Insertar participantes de ejemplo
INSERT INTO event_participants (
    event_id,
    user_id,
    status,
    role,
    response_date,
    notes,
    playing_position
) VALUES
-- Entrenamiento 1 (id=1)
(1, 1, 'confirmed', 'player', NOW() - INTERVAL '1 day', 'Confirmo asistencia', 'midfielder'),
(1, 2, 'confirmed', 'player', NOW() - INTERVAL '2 hours', NULL, 'forward'),
(1, 3, 'pending', 'player', NULL, NULL, 'goalkeeper'),

-- Partido oficial (id=3)
(3, 1, 'confirmed', 'player', NOW() - INTERVAL '3 hours', 'Listo para el partido', 'midfielder'),
(3, 2, 'confirmed', 'player', NOW() - INTERVAL '1 hour', NULL, 'forward'),
(3, 3, 'declined', 'player', NOW() - INTERVAL '30 minutes', 'No puedo asistir', NULL),

-- Asado (id=5)
(5, 1, 'confirmed', 'player', NOW() - INTERVAL '1 day', 'Llevo ensalada', NULL),
(5, 2, 'confirmed', 'player', NOW() - INTERVAL '6 hours', 'Confirmo', NULL),
(5, 3, 'pending', 'player', NULL, NULL, NULL);
