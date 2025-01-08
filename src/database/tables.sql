
-- Sports table (Multi-sport support)
CREATE TABLE sports (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) NOT NULL UNIQUE, -- Sport name (e.g., Football, Basketball)
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
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
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
    CONSTRAINT fk_team FOREIGN KEY (team_id) REFERENCES teams (id) ON DELETE CASCADE
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