-- Crear tabla player_roster (Lista de Buena Fe)
CREATE TABLE IF NOT EXISTS player_roster (
    id SERIAL PRIMARY KEY,
    player_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
    team_id INTEGER NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    jersey_number INTEGER NOT NULL,
    medical_certificate_date DATE,
    medical_certificate_expires DATE,
    is_enabled BOOLEAN DEFAULT TRUE,
    position VARCHAR(20) DEFAULT 'player' CHECK (position IN ('goalkeeper', 'defender', 'midfielder', 'forward', 'player')),
    document_number VARCHAR(20) NOT NULL,
    emergency_contact VARCHAR(100),
    season VARCHAR(20) NOT NULL,
    category VARCHAR(10) NOT NULL,
    medical_status VARCHAR(20) DEFAULT 'pending' CHECK (medical_status IN ('pending', 'approved', 'expired', 'rejected')),
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Constraints únicos
    UNIQUE(team_id, jersey_number, season), -- Un número por equipo por temporada
    UNIQUE(player_id, team_id, season)      -- Un jugador por equipo por temporada
);

-- Índices para mejorar performance
CREATE INDEX IF NOT EXISTS idx_roster_team_season ON player_roster(team_id, season);
CREATE INDEX IF NOT EXISTS idx_roster_player ON player_roster(player_id);
CREATE INDEX IF NOT EXISTS idx_roster_enabled ON player_roster(is_enabled);
CREATE INDEX IF NOT EXISTS idx_roster_medical_status ON player_roster(medical_status);

-- Trigger para actualizar updated_at
CREATE OR REPLACE FUNCTION update_roster_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_roster_updated_at
    BEFORE UPDATE ON player_roster
    FOR EACH ROW
    EXECUTE FUNCTION update_roster_updated_at();
