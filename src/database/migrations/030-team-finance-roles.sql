-- Roles globales de finanzas por equipo + roles en team_members (treasurer, delegate)

INSERT INTO roles (name, description)
VALUES
  ('tesorero', 'Tesorero del equipo — cuotas, pagos y caja'),
  ('delegado', 'Delegado del equipo — apoyo administrativo y finanzas')
ON CONFLICT (name) DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, rp.permission_id
FROM roles r
CROSS JOIN role_permissions rp
WHERE r.name = 'tesorero'
  AND rp.role_id = (SELECT id FROM roles WHERE name = 'team_captain' LIMIT 1)
ON CONFLICT DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, rp.permission_id
FROM roles r
CROSS JOIN role_permissions rp
WHERE r.name = 'delegado'
  AND rp.role_id = (SELECT id FROM roles WHERE name = 'team_captain' LIMIT 1)
ON CONFLICT DO NOTHING;

COMMENT ON COLUMN team_members.role IS
  'admin | player | treasurer | delegate — rol dentro del equipo';
