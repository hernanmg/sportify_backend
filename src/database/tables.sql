
-- Sports table (Multi-sport support)
CREATE TABLE sports (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) NOT NULL UNIQUE, -- Sport name (e.g., Football, Basketball)
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
-- Create the "users" table
CREATE TABLE users (
    id SERIAL PRIMARY KEY, -- Auto-incrementing primary key
    username VARCHAR(50) NOT NULL UNIQUE, -- Unique username
    email VARCHAR(100) NOT NULL UNIQUE, -- Unique email
    password_hash TEXT, -- Hashed password (nullable para OAuth)
    
    -- Información personal
    first_name VARCHAR(50),
    last_name VARCHAR(50),
    phone VARCHAR(20),
    fecha_nacimiento DATE,
    avatar_url TEXT,
    
    -- Estado y configuración
    estado_registro VARCHAR(20) DEFAULT 'pending', -- pending, verified, active, suspended
    email_verified BOOLEAN DEFAULT FALSE,
    phone_verified BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    
    -- Timestamps
    ultimo_login TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, -- Timestamp for creation
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP -- Timestamp for the last update
);

-- Teams table
CREATE TABLE teams (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    sport_id INT NOT NULL, -- Foreign key to sports
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_sport FOREIGN KEY (sport_id) REFERENCES sports (id) ON DELETE CASCADE
);

-- Players table (Users associated with teams)
CREATE TABLE players (
    id SERIAL PRIMARY KEY,
    user_id INT NOT NULL, -- Foreign key to users
    team_id INT NOT NULL, -- Foreign key to teams
    
    -- Información deportiva
    posicion VARCHAR(30), -- Portero, Defensa, Mediocampo, Delantero, etc.
    jersey_number INT,
    height NUMERIC(5,2), -- en centímetros (ej: 175.50)
    weight NUMERIC(5,2), -- en kilogramos (ej: 70.50)
    dominant_foot VARCHAR(10), -- left, right, both
    
    -- Fechas importantes
    joined_team_date DATE DEFAULT CURRENT_DATE,
    contract_end_date DATE,
    
    -- Estado del jugador
    is_active BOOLEAN DEFAULT TRUE,
    is_captain BOOLEAN DEFAULT FALSE,
    injury_status VARCHAR(20) DEFAULT 'healthy', -- healthy, injured, recovering
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT fk_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
    CONSTRAINT fk_team FOREIGN KEY (team_id) REFERENCES teams (id) ON DELETE CASCADE,
    CONSTRAINT unique_user_team UNIQUE (user_id, team_id), -- Un usuario por equipo
    CONSTRAINT unique_jersey_team UNIQUE (team_id, jersey_number) -- Número único por equipo
);

-- PlayerStats table
CREATE TABLE player_stats (
    id SERIAL PRIMARY KEY,
    player_id INT NOT NULL, -- Foreign key to players
    matches_played INT DEFAULT 0,
    goals INT DEFAULT 0,
    assists INT DEFAULT 0,
    minutes_played INT DEFAULT 0,
    shots_on_target INT DEFAULT 0,
    passes_completed INT DEFAULT 0,
    passes_failed INT DEFAULT 0,
    yellow_cards INT DEFAULT 0,
    red_cards INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_player FOREIGN KEY (player_id) REFERENCES players (id) ON DELETE CASCADE
);

-- Payments table
CREATE TABLE payments (
    id SERIAL PRIMARY KEY,
    player_id INT NOT NULL, -- Foreign key to players
    amount NUMERIC(10, 2) NOT NULL, -- Payment amount
    status VARCHAR(20) NOT NULL, -- Paid, Pending, Overdue
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_player FOREIGN KEY (player_id) REFERENCES players (id) ON DELETE CASCADE
);

-- Matches table
CREATE TABLE matches (
    id SERIAL PRIMARY KEY,
    team_id INT NOT NULL, -- Foreign key to teams
    opponent_name VARCHAR(100) NOT NULL, -- Name of the opposing team
    match_date TIMESTAMP NOT NULL,
    location VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_team FOREIGN KEY (team_id) REFERENCES teams (id) ON DELETE CASCADE
);

-- Attendance table
CREATE TABLE attendance (
    id SERIAL PRIMARY KEY,
    match_id INT NOT NULL, -- Foreign key to matches
    player_id INT NOT NULL, -- Foreign key to players
    status VARCHAR(20) NOT NULL, -- Present, Absent, Excused
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_match FOREIGN KEY (match_id) REFERENCES matches (id) ON DELETE CASCADE,
    CONSTRAINT fk_player FOREIGN KEY (player_id) REFERENCES players (id) ON DELETE CASCADE
);

-- Expenses table
CREATE TABLE expenses (
    id SERIAL PRIMARY KEY,
    team_id INT NOT NULL, -- Foreign key to teams
    amount NUMERIC(10, 2) NOT NULL, -- Expense amount
    description TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_team FOREIGN KEY (team_id) REFERENCES teams (id) ON DELETE CASCADE
);

-- Messages table
CREATE TABLE messages (
    id SERIAL PRIMARY KEY,
    sender_id INT NOT NULL, -- Foreign key to users
    team_id INT NOT NULL, -- Foreign key to teams
    message TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_sender FOREIGN KEY (sender_id) REFERENCES users (id) ON DELETE CASCADE,
    CONSTRAINT fk_team FOREIGN KEY (team_id) REFERENCES teams (id) ON DELETE CASCADE
);

-- TypeEvents table
CREATE TABLE type_events (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) NOT NULL UNIQUE, -- Event type name (e.g., Goal, Foul)
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Events table
CREATE TABLE events (
    id SERIAL PRIMARY KEY,
    match_id INT NOT NULL, -- Foreign key to matches
    player_id INT, -- Foreign key to players (nullable, e.g., for team events)
    type_event_id INT NOT NULL, -- Foreign key to type_events
    description TEXT,
    event_time TIMESTAMP NOT NULL, -- Time of the event
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_match FOREIGN KEY (match_id) REFERENCES matches (id) ON DELETE CASCADE,
    CONSTRAINT fk_player FOREIGN KEY (player_id) REFERENCES players (id) ON DELETE CASCADE,
    CONSTRAINT fk_type_event FOREIGN KEY (type_event_id) REFERENCES type_events (id) ON DELETE CASCADE
);

-- Notifications table
CREATE TABLE notifications (
    id SERIAL PRIMARY KEY,
    user_id INT NOT NULL, -- Foreign key to users
    message TEXT NOT NULL,
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
);

-- Create the "roles" table
CREATE TABLE roles (
    id SERIAL PRIMARY KEY, -- Auto-incrementing primary key
    name VARCHAR(50) NOT NULL UNIQUE, -- Unique name for the role
    description TEXT, -- Optional description for the role
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, -- Timestamp for creation
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP -- Timestamp for the last update
);

-- Create the "permissions" table
CREATE TABLE permissions (
    id SERIAL PRIMARY KEY, -- Auto-incrementing primary key
    name VARCHAR(50) NOT NULL UNIQUE, -- Unique name for the permission
    description TEXT, -- Optional description for the permission
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, -- Timestamp for creation
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP -- Timestamp for the last update
);

-- Create the "role_permissions" junction table
CREATE TABLE role_permissions (
    id SERIAL PRIMARY KEY, -- Auto-incrementing primary key
    role_id INT NOT NULL, -- Foreign key to "roles"
    permission_id INT NOT NULL, -- Foreign key to "permissions"
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, -- Timestamp for creation
    CONSTRAINT fk_role FOREIGN KEY (role_id) REFERENCES roles (id) ON DELETE CASCADE,
    CONSTRAINT fk_permission FOREIGN KEY (permission_id) REFERENCES permissions (id) ON DELETE CASCADE,
    CONSTRAINT unique_role_permission UNIQUE (role_id, permission_id) -- Prevent duplicate assignments
);

-- Create the "user_roles" junction table
CREATE TABLE user_roles (
    id SERIAL PRIMARY KEY, -- Auto-incrementing primary key
    user_id INT NOT NULL, -- Foreign key to "users"
    role_id INT NOT NULL, -- Foreign key to "roles"
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, -- Timestamp for creation
    CONSTRAINT fk_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
    CONSTRAINT fk_role FOREIGN KEY (role_id) REFERENCES roles (id) ON DELETE CASCADE,
    CONSTRAINT unique_user_role UNIQUE (user_id, role_id) -- Prevent duplicate assignments
);

CREATE TABLE languages (
    language_id SERIAL PRIMARY KEY, -- Auto-incrementing primary key
    name VARCHAR(50) NOT NULL UNIQUE, -- Language name (e.g., English, Spanish)
    code VARCHAR(10) NOT NULL UNIQUE, -- Language code (e.g., en, es)
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP -- Timestamp for creation
);

CREATE TABLE Translations (
    translation_id SERIAL PRIMARY KEY,
    language_id INT REFERENCES Languages(language_id),
    key VARCHAR(100) NOT NULL, -- e.g., 'welcome_message', 'player_stats'
    translated_text TEXT NOT NULL
);

ALTER TABLE expenses
ADD COLUMN created_by INT NOT NULL; -- Foreign key to users

-- Add the foreign key constraint to ensure data integrity
ALTER TABLE expenses
ADD CONSTRAINT fk_created_by FOREIGN KEY (created_by) REFERENCES users (id) ON DELETE CASCADE;

ALTER TABLE attendance 
ADD COLUMN minutes_played INT; -- Foreign key to users


ALTER TABLE attendance 
ADD COLUMN attended BOOL default False; 

ALTER TABLE notifications 
ADD COLUMN sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP; 

ALTER TABLE sports ALTER COLUMN name SET DEFAULT 'Unnamed Sport';

ALTER TABLE sports
ALTER COLUMN name SET NOT NULL;

ALTER TABLE events ALTER COLUMN description SET DEFAULT 'Unnamed Event';

ALTER TABLE events
ALTER COLUMN event_time SET DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE events
ALTER COLUMN event_time SET NOT NULL;

ALTER TABLE roles ALTER COLUMN name SET DEFAULT 'player';

-- Tabla para autenticación múltiple (Google, Facebook, Email)
CREATE TABLE user_auth_providers (
    id SERIAL PRIMARY KEY,
    user_id INT NOT NULL,
    provider VARCHAR(20) NOT NULL, -- 'email', 'google', 'facebook', 'apple'
    provider_id VARCHAR(100), -- ID del proveedor externo (para OAuth)
    provider_email VARCHAR(100), -- Email del proveedor (puede diferir del email principal)
    is_verified BOOLEAN DEFAULT FALSE,
    is_primary BOOLEAN DEFAULT FALSE, -- Método principal de autenticación
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT fk_user_auth FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
    CONSTRAINT unique_user_provider UNIQUE (user_id, provider),
    CONSTRAINT unique_provider_id UNIQUE (provider, provider_id)
);