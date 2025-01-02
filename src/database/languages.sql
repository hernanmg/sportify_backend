-- Create the "languages" table
CREATE TABLE languages (
    id SERIAL PRIMARY KEY, -- Auto-incrementing primary key
    name VARCHAR(50) NOT NULL UNIQUE, -- Language name (e.g., English, Spanish)
    code VARCHAR(10) NOT NULL UNIQUE, -- Language code (e.g., en, es)
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP -- Timestamp for creation
);

-- Insert the specified languages
INSERT INTO languages (name, code) VALUES
('Español', 'es'),
('Português (Brasil)', 'pt-BR'),
('English', 'en'),
('Italiano', 'it'),
('Français', 'fr');
