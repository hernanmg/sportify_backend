-- Migración: Agregar nuevos campos a tabla users
-- Fecha: 2025-09-15
-- Descripción: Añadir campos de información personal y estado

-- Agregar nuevos campos a la tabla users
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS first_name VARCHAR(50),
ADD COLUMN IF NOT EXISTS last_name VARCHAR(50),
ADD COLUMN IF NOT EXISTS phone VARCHAR(20),
ADD COLUMN IF NOT EXISTS fecha_nacimiento DATE,
ADD COLUMN IF NOT EXISTS avatar_url TEXT,
ADD COLUMN IF NOT EXISTS estado_registro VARCHAR(20) DEFAULT 'pending',
ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS phone_verified BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS ultimo_login TIMESTAMP;

-- Hacer password_hash nullable para OAuth
ALTER TABLE users 
ALTER COLUMN password_hash DROP NOT NULL;

-- Agregar nuevos campos a la tabla players
ALTER TABLE players 
ADD COLUMN IF NOT EXISTS posicion VARCHAR(30),
ADD COLUMN IF NOT EXISTS jersey_number INT,
ADD COLUMN IF NOT EXISTS height NUMERIC(5,2),
ADD COLUMN IF NOT EXISTS weight NUMERIC(5,2),
ADD COLUMN IF NOT EXISTS dominant_foot VARCHAR(10),
ADD COLUMN IF NOT EXISTS joined_team_date DATE DEFAULT CURRENT_DATE,
ADD COLUMN IF NOT EXISTS contract_end_date DATE,
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS is_captain BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS injury_status VARCHAR(20) DEFAULT 'healthy',
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

-- Constraints únicos (idempotente; IF NOT EXISTS no es válido en ADD CONSTRAINT)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'unique_user_team'
  ) THEN
    ALTER TABLE players
      ADD CONSTRAINT unique_user_team UNIQUE (user_id, team_id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'unique_jersey_team'
  ) THEN
    ALTER TABLE players
      ADD CONSTRAINT unique_jersey_team UNIQUE (team_id, jersey_number);
  END IF;
END $$;

-- Comentarios informativos
COMMENT ON COLUMN users.estado_registro IS 'Estados: pending, verified, active, suspended';
COMMENT ON COLUMN players.posicion IS 'Posición en el campo: Portero, Defensa, Mediocampo, Delantero, etc.';
COMMENT ON COLUMN players.injury_status IS 'Estado de lesión: healthy, injured, recovering';
