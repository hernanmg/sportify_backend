-- =============================================================================
-- Neon / producción: reset total de datos operativos.
-- Deja solo los 3 usuarios demo (super_admin, dt, player).
-- NO borra: sports, categories, roles, permissions, sport_positions, migraciones.
--
-- Password demo: Demo2026!
-- Ejecutar en orden: 1) VERIFICAR  2) BEGIN…COMMIT  3) confirmar conteos
-- =============================================================================

-- 1. VERIFICAR (solo lectura)
SELECT id, email, first_name, last_name FROM users ORDER BY id;

SELECT COUNT(*) AS teams FROM teams;
SELECT COUNT(*) AS roster FROM player_roster;
SELECT COUNT(*) AS members FROM team_members;

-- 2. RESET (revisar conteos antes de COMMIT)
BEGIN;

-- Equipos y todo lo que cuelga (plantel, eventos, finanzas, invitaciones, etc.)
TRUNCATE TABLE teams RESTART IDENTITY CASCADE;

-- Datos huérfanos / por usuario que no pasan por teams
TRUNCATE TABLE
  notifications,
  device_tokens,
  user_auth_providers
RESTART IDENTITY CASCADE;

-- Usuarios que no son demo
DELETE FROM users
WHERE email NOT IN (
  'hernanmilers121@gmail.com',
  'sanchez.guillermo@hotmail.com',
  'maxirodriguez160583@gmail.com'
);

-- Normalizar los 3 demo (password Demo2026!)
INSERT INTO users (
  username, email, password_hash,
  first_name, last_name,
  estado_registro, email_verified, is_active, profile_completion
) VALUES
  (
    'hernan.milers',
    'hernanmilers121@gmail.com',
    '$2a$10$fTQpyEDFlxOw72EjoURUVOpp2yS1nlybvaqENV8tJREU2i8VxSO76',
    'Hernan', 'Milers',
    'active', true, true, 80
  ),
  (
    'guillermo.sanchez',
    'sanchez.guillermo@hotmail.com',
    '$2a$10$fTQpyEDFlxOw72EjoURUVOpp2yS1nlybvaqENV8tJREU2i8VxSO76',
    'Guillermo', 'Sanchez',
    'active', true, true, 80
  ),
  (
    'maxi.rodriguez',
    'maxirodriguez160583@gmail.com',
    '$2a$10$fTQpyEDFlxOw72EjoURUVOpp2yS1nlybvaqENV8tJREU2i8VxSO76',
    'Maximiliano', 'Rodriguez',
    'active', true, true, 80
  )
ON CONFLICT (email) DO UPDATE SET
  password_hash = EXCLUDED.password_hash,
  first_name = EXCLUDED.first_name,
  last_name = EXCLUDED.last_name,
  estado_registro = 'active',
  email_verified = true,
  is_active = true,
  profile_completion = 80,
  updated_at = NOW();

DELETE FROM user_roles
WHERE user_id IN (SELECT id FROM users);

INSERT INTO user_roles (user_id, role_id)
SELECT u.id, r.id
FROM users u
JOIN roles r ON r.name = 'super_admin'
WHERE u.email = 'hernanmilers121@gmail.com';

INSERT INTO user_roles (user_id, role_id)
SELECT u.id, r.id
FROM users u
JOIN roles r ON r.name = 'dt'
WHERE u.email = 'sanchez.guillermo@hotmail.com';

INSERT INTO user_roles (user_id, role_id)
SELECT u.id, r.id
FROM users u
JOIN roles r ON r.name = 'player'
WHERE u.email = 'maxirodriguez160583@gmail.com';

-- 3. Controles post-reset
SELECT 'users' AS tabla, COUNT(*)::text AS filas FROM users
UNION ALL SELECT 'teams', COUNT(*)::text FROM teams
UNION ALL SELECT 'player_roster', COUNT(*)::text FROM player_roster
UNION ALL SELECT 'team_members', COUNT(*)::text FROM team_members
UNION ALL SELECT 'sport_events', COUNT(*)::text FROM sport_events;

SELECT u.email, r.name AS role
FROM users u
LEFT JOIN user_roles ur ON ur.user_id = u.id
LEFT JOIN roles r ON r.id = ur.role_id
ORDER BY u.email;

-- Si algo no cuadra: ROLLBACK;
COMMIT;

-- Después del reset:
-- 1) Hernan inicia sesión → crea ZFC y genera código con categorías.
-- 2) Guillermo inicia sesión → pantalla de código → opcional «También juego».
-- 3) Maxi se une con código como jugador.
