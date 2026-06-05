-- Tabla de invitados externos reutilizables (TypeORM también la crea con synchronize)
CREATE TABLE IF NOT EXISTS team_social_guests (
    id SERIAL PRIMARY KEY,
    team_id INTEGER NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    display_name VARCHAR(120) NOT NULL,
    phone VARCHAR(30),
    email VARCHAR(100),
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_by INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_team_social_guests_team ON team_social_guests(team_id);

ALTER TABLE event_participants
    ADD COLUMN IF NOT EXISTS included_in_expense_split BOOLEAN NOT NULL DEFAULT TRUE;

-- Pendientes no entran al reparto hasta confirmar
UPDATE event_participants
SET included_in_expense_split = FALSE
WHERE status IN ('pending', 'no_response');
