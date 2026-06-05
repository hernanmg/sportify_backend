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
