

-- Insert for users
INSERT INTO users (username , email, password_hash , created_at) VALUES
('Alice Johnson', 'alice@example.com', 'hashed_password_1',  NOW()),
('Bob Smith', 'bob@example.com', 'hashed_password_2',  NOW()),
('Charlie Brown', 'charlie@example.com', 'hashed_password_3', NOW());

-- Insert for teams
INSERT INTO sports (name,  created_at) VALUES
('Soccer', NOW()),
('Basketball', NOW()),
('Volleyball', NOW());

-- Insert for teams
INSERT INTO teams (name, sport_id , created_at) VALUES
('Zebra FC +35', 1, NOW()),
('Sharks Basketball', 2, NOW()),
('Tigers Volleyball', 3, NOW()),
('Zebra FC +40', 1, NOW());

-- Insert for players
INSERT INTO players (user_id, team_id, created_at) VALUES
(7, 7, NOW()), -- Charlie Brown in Eagles FC
(8, 7, NOW()), -- Bob Smith in Eagles FC
(9, 7, NOW()); -- Alice Johnson in Sharks Basketball

-- Insert for player_stats
INSERT INTO player_stats (player_id, matches_played, goals, assists, minutes_played) VALUES
(4, 10, 5, 2, 900), -- Charlie Brown
(5, 12, 3, 4, 1080), -- Bob Smith
(6, 8, 0, 1, 720); -- Alice Johnson

-- Insert for payments
INSERT INTO payments (player_id, amount,status , description, created_at , is_paid) VALUES
(5, 50.00,'', 'Monthly fee', NOW(), TRUE),
(4, 50.00,'', 'Monthly fee', NOW(), TRUE),
(6, 50.00,'', 'Monthly fee', NOW(), FALSE);

-- Insert for matches
INSERT INTO matches (team_id, opponent_name , match_date, location, result) VALUES
(7, 'Zebra FC', '2024-12-05', 'Home', '2-1 Win'),
(8, 'Panthers FC', '2024-12-12', 'Away', '1-3 Loss'),
(9, 'Wolves BB', '2024-12-10', 'Home', '89-76 Win');

-- Insert for attendance
INSERT INTO attendance (match_id, player_id, status, attended, minutes_played) VALUES
(4, 4,'', TRUE, 90), -- Match 1, Charlie Brown
(4, 5,'', TRUE, 90), -- Match 1, Bob Smith
(4, 6,'', FALSE, 0); -- Match 2, Alice Johnson

-- Insert for expenses
INSERT INTO expenses (team_id, created_by, amount, description) VALUES
(7, 7, 150.00, 'Training equipment'), -- Charlie Brown
(7, 8, 200.00, 'Team dinner'), -- Bob Smith
(7, 9, 100.00, 'Uniforms'); -- Alice Johnson

-- Insert for messages
INSERT INTO messages (team_id, sender_id , message , created_at) VALUES
(7, 7, 'Good game everyone!', NOW()), -- Charlie Brown
(7, 7, 'Let’s work harder next time!', NOW()), -- Bob Smith
(8, 8, 'Practice starts at 6 PM.', NOW()); -- Alice Johnson

-- Insert for type_events
INSERT INTO type_events (name, description) VALUES
('Goal', 'Player scored a goal'),
('Assist', 'Player assisted a goal'),
('Yellow Card', 'Player received a yellow card');
-- Insert for events
INSERT INTO events (match_id, player_id, type_event_id, event_time , description) VALUES
(4, 4, 1, '2024-12-05 15:30:00', 'Goal scored by Charlie Brown'), -- Goal
(4, 5, 2, '2024-12-05 15:45:00', 'Assist by Bob Smith'), -- Assist
(4, 6, 3, '2024-12-12 17:10:00', 'Yellow card for Alice Johnson'); -- Yellow card



-- Insert for notifications
INSERT INTO notifications (user_id, message, sent_at, is_read) VALUES
(7, 'You have a new match scheduled', NOW(), FALSE), -- Charlie Brown
(8, 'Monthly payment due', NOW(), TRUE), -- Bob Smith
(9, 'Practice starts at 6 PM', NOW(), FALSE); -- Alice Johnson

-- Insert the specified languages
INSERT INTO languages (name, code) VALUES
('Español', 'es'),
('Português (Brasil)', 'pt-BR'),
('English', 'en'),
('Italiano', 'it'),
('Français', 'fr');

-- Insert default roles (orden jerárquico)
INSERT INTO roles (name, description) VALUES
('super_admin', 'Administrador del sistema con acceso total'),
('manager', 'Administrador de liga/torneo - gestiona equipos y usuarios'),
('team_captain', 'Capitán de equipo - gestiona su equipo y jugadores'),
('player', 'Jugador activo de un equipo'),
('guest', 'Usuario básico sin equipo asignado');

INSERT INTO permissions (name, description) VALUES
('GESTION_USUARIOS', 'Crear, editar, eliminar usuarios'),
('GESTION_ROLES', 'Crear, editar, asignar roles y permisos'),
('GESTION_PARTIDOS', 'Crear, editar, eliminar partidos y entrenamientos'),
('REGISTRAR_EVENTOS_PARTIDO', 'Registrar goles, asistencias, tarjetas, cambios'),
('VER_ESTADISTICAS', 'Consultar estadísticas de equipo y jugadores'),
('EDITAR_ESTADISTICAS', 'Editar estadísticas de equipo y jugadores'),
('GESTION_CONVOCATORIAS', 'Crear convocatorias y modificar horarios'),
('CONFIRMAR_ASISTENCIA', 'Confirmar asistencia a partidos/entrenamientos'),
('GESTION_PAGOS', 'Registrar y gestionar cuotas/deudas'),
('VER_PAGOS', 'Consultar estado de pagos propios'),
('GESTION_GASTOS', 'Registrar y editar gastos comunes'),
('REPORTES_FINANCIEROS', 'Consultar reportes de ingresos/egresos'),
('CHAT', 'Acceder y participar en el chat'),
('CONFIGURACION_GLOBAL', 'Configurar parámetros globales de la app'),
('VER_PUBLICO', 'Ver calendario y estadísticas públicas');


-- Asignar permisos por rol

-- 1. super_admin: Todos los permisos
INSERT INTO role_permissions (role_id, permission_id)
SELECT 1, id FROM permissions;

-- 2. manager: Gestión completa de liga/torneo
INSERT INTO role_permissions (role_id, permission_id) VALUES
(2, 1),   -- GESTION_USUARIOS
(2, 2),   -- GESTION_ROLES  
(2, 3),   -- GESTION_PARTIDOS
(2, 4),   -- REGISTRAR_EVENTOS_PARTIDO
(2, 5),   -- VER_ESTADISTICAS
(2, 6),   -- EDITAR_ESTADISTICAS
(2, 7),   -- GESTION_CONVOCATORIAS
(2, 9),   -- GESTION_PAGOS
(2, 11),  -- GESTION_GASTOS
(2, 12),  -- REPORTES_FINANCIEROS
(2, 13),  -- CHAT
(2, 14);  -- CONFIGURACION_GLOBAL

-- 3. team_captain: Gestión de su equipo
INSERT INTO role_permissions (role_id, permission_id) VALUES
(3, 3),   -- GESTION_PARTIDOS (su equipo)
(3, 4),   -- REGISTRAR_EVENTOS_PARTIDO
(3, 5),   -- VER_ESTADISTICAS
(3, 6),   -- EDITAR_ESTADISTICAS (su equipo)
(3, 7),   -- GESTION_CONVOCATORIAS
(3, 8),   -- CONFIRMAR_ASISTENCIA
(3, 9),   -- GESTION_PAGOS (su equipo)
(3, 10),  -- VER_PAGOS
(3, 11),  -- GESTION_GASTOS (su equipo)
(3, 13);  -- CHAT

-- 4. player: Permisos básicos de jugador  
INSERT INTO role_permissions (role_id, permission_id) VALUES
(4, 5),   -- VER_ESTADISTICAS
(4, 8),   -- CONFIRMAR_ASISTENCIA
(4, 10),  -- VER_PAGOS
(4, 13),  -- CHAT
(4, 15);  -- VER_PUBLICO

-- 5. guest: Solo visualización básica
INSERT INTO role_permissions (role_id, permission_id) VALUES
(5, 5),   -- VER_ESTADISTICAS
(5, 15);  -- VER_PUBLICO

-- Asignar usuarios a roles por defecto (ejemplos)
INSERT INTO user_roles (user_id, role_id) VALUES
(1, 1); -- Primer usuario -> super_admin

-- Insertar datos de prueba para player_roster (Lista de Buena Fe)
INSERT INTO player_roster (
    player_id, 
    team_id, 
    jersey_number, 
    medical_certificate_date, 
    medical_certificate_expires, 
    is_enabled, 
    position, 
    document_number, 
    emergency_contact, 
    season, 
    category, 
    medical_status, 
    notes
) VALUES
-- Equipo Eagles FC (team_id = 7) - Usar los player_id que existen (1, 2, 3)
(1, 7, 10, '2024-01-15', '2025-01-15', TRUE, 'midfielder', '12345678', 'Charlie Brown - 555-0101', '2024-Apertura', '+35', 'approved', 'Capitán del equipo'),
(2, 7, 9, '2024-02-01', '2025-02-01', TRUE, 'forward', '23456789', 'Bob Smith - 555-0102', '2024-Apertura', '+35', 'approved', 'Goleador del equipo'),
(3, 7, 1, '2024-01-20', '2025-01-20', TRUE, 'goalkeeper', '34567890', 'Alice Johnson - 555-0103', '2024-Apertura', '+35', 'approved', 'Arquero titular'),

-- Equipo Sharks Basketball (team_id = 8) - Algunos con apto vencido
(1, 8, 23, '2023-12-01', '2024-12-01', FALSE, 'player', '12345678', 'Charlie Brown - 555-0101', '2024-Apertura', '+35', 'expired', 'Apto médico vencido'),
(2, 8, 15, '2024-03-01', '2025-03-01', TRUE, 'player', '23456789', 'Bob Smith - 555-0102', '2024-Apertura', '+35', 'approved', 'Jugador activo'),

-- Equipo Wolves BB (team_id = 9)
(3, 9, 7, '2024-01-10', '2025-01-10', TRUE, 'player', '34567890', 'Alice Johnson - 555-0103', '2024-Apertura', '+35', 'approved', 'Nuevo en el equipo');