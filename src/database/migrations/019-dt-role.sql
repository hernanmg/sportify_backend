-- Rol Director Técnico (DT), distinto de team_captain
INSERT INTO roles (name, description)
VALUES ('dt', 'Director técnico — gestión deportiva del equipo')
ON CONFLICT (name) DO NOTHING;

-- Mismos permisos que team_captain (role_id 3 en installs base)
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, rp.permission_id
FROM roles r
CROSS JOIN role_permissions rp
WHERE r.name = 'dt'
  AND rp.role_id = (SELECT id FROM roles WHERE name = 'team_captain' LIMIT 1)
ON CONFLICT DO NOTHING;
