-- Create the "languages" table
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

-- Insert the specified languages
INSERT INTO languages (name, code) VALUES
('Español', 'es'),
('Português (Brasil)', 'pt-BR'),
('English', 'en'),
('Italiano', 'it'),
('Français', 'fr');
