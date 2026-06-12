-- Restaurar Guillermo como DT + encargado del equipo (tras bug joinWithCode sin dt en jerarquía).
-- Ejecutar en Neon después del deploy del fix en teams.service.ts.

BEGIN;

-- 1. Ver estado actual
SELECT u.email, r.name AS role
FROM users u
LEFT JOIN user_roles ur ON ur.user_id = u.id
LEFT JOIN roles r ON r.id = ur.role_id
WHERE u.email = 'sanchez.guillermo@hotmail.com';

SELECT tm.team_id, tm.role, t.name
FROM team_members tm
JOIN users u ON u.id = tm.user_id
JOIN teams t ON t.id = tm.team_id
WHERE u.email = 'sanchez.guillermo@hotmail.com';

-- 2. Rol global DT
DELETE FROM user_roles
WHERE user_id = (SELECT id FROM users WHERE email = 'sanchez.guillermo@hotmail.com');

INSERT INTO user_roles (user_id, role_id)
SELECT u.id, r.id
FROM users u
JOIN roles r ON r.name = 'dt'
WHERE u.email = 'sanchez.guillermo@hotmail.com';

-- 3. Encargado del equipo (ajustá team_id si no es 1)
INSERT INTO team_members (user_id, team_id, role)
SELECT u.id, t.id, 'admin'
FROM users u
CROSS JOIN teams t
WHERE u.email = 'sanchez.guillermo@hotmail.com'
ORDER BY t.id ASC
LIMIT 1
ON CONFLICT (user_id, team_id) DO UPDATE SET role = 'admin';

-- 4. (Opcional) Agregar al plantel M+35 — descomentá y ajustá category_id / season
/*
INSERT INTO players (user_id, team_id, is_active, joined_team_date)
SELECT u.id, t.id, TRUE, CURRENT_DATE
FROM users u
CROSS JOIN teams t
WHERE u.email = 'sanchez.guillermo@hotmail.com'
ORDER BY t.id ASC
LIMIT 1
ON CONFLICT (user_id, team_id) DO NOTHING;

-- Luego player_roster con category_id correcto (ver team_categories)
*/

SELECT u.email, r.name AS role
FROM users u
LEFT JOIN user_roles ur ON ur.user_id = u.id
LEFT JOIN roles r ON r.id = ur.role_id
WHERE u.email = 'sanchez.guillermo@hotmail.com';

COMMIT;

-- Guillermo: cerrar sesión en la app y volver a entrar para refrescar el JWT.
