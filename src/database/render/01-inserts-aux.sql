-- Datos auxiliares mínimos para deploy (roles, permisos, deporte).
-- Idempotente: ON CONFLICT / DO NOTHING.

INSERT INTO roles (name, description) VALUES
  ('super_admin', 'Administrador del sistema con acceso total'),
  ('manager', 'Administrador de liga/torneo'),
  ('team_captain', 'Capitán de equipo'),
  ('dt', 'Director técnico — gestión deportiva del equipo'),
  ('player', 'Jugador activo'),
  ('guest', 'Usuario sin equipo asignado')
ON CONFLICT (name) DO NOTHING;

INSERT INTO permissions (name, description) VALUES
  ('GESTION_USUARIOS', 'Crear, editar, eliminar usuarios'),
  ('GESTION_ROLES', 'Crear, editar, asignar roles y permisos'),
  ('GESTION_PARTIDOS', 'Crear, editar, eliminar partidos y entrenamientos'),
  ('REGISTRAR_EVENTOS_PARTIDO', 'Registrar goles, asistencias, tarjetas, cambios'),
  ('VER_ESTADISTICAS', 'Consultar estadísticas'),
  ('EDITAR_ESTADISTICAS', 'Editar estadísticas'),
  ('GESTION_CONVOCATORIAS', 'Crear convocatorias'),
  ('CONFIRMAR_ASISTENCIA', 'Confirmar asistencia'),
  ('GESTION_PAGOS', 'Gestionar cuotas y deudas'),
  ('VER_PAGOS', 'Ver pagos propios'),
  ('GESTION_GASTOS', 'Gestionar gastos'),
  ('REPORTES_FINANCIEROS', 'Reportes financieros'),
  ('CHAT', 'Chat del equipo'),
  ('CONFIGURACION_GLOBAL', 'Configuración global'),
  ('VER_PUBLICO', 'Ver calendario público')
ON CONFLICT (name) DO NOTHING;

-- super_admin: todos los permisos
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'super_admin'
ON CONFLICT DO NOTHING;

-- manager
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.name IN (
  'GESTION_USUARIOS','GESTION_ROLES','GESTION_PARTIDOS','REGISTRAR_EVENTOS_PARTIDO',
  'VER_ESTADISTICAS','EDITAR_ESTADISTICAS','GESTION_CONVOCATORIAS','GESTION_PAGOS',
  'GESTION_GASTOS','REPORTES_FINANCIEROS','CHAT','CONFIGURACION_GLOBAL'
)
WHERE r.name = 'manager'
ON CONFLICT DO NOTHING;

-- team_captain y dt (mismos permisos operativos)
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.name IN (
  'GESTION_PARTIDOS','REGISTRAR_EVENTOS_PARTIDO','VER_ESTADISTICAS','EDITAR_ESTADISTICAS',
  'GESTION_CONVOCATORIAS','CONFIRMAR_ASISTENCIA','GESTION_PAGOS','VER_PAGOS',
  'GESTION_GASTOS','CHAT'
)
WHERE r.name IN ('team_captain', 'dt')
ON CONFLICT DO NOTHING;

-- player
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.name IN (
  'VER_ESTADISTICAS','CONFIRMAR_ASISTENCIA','VER_PAGOS','CHAT','VER_PUBLICO'
)
WHERE r.name = 'player'
ON CONFLICT DO NOTHING;

-- guest
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.name IN ('VER_ESTADISTICAS', 'VER_PUBLICO')
WHERE r.name = 'guest'
ON CONFLICT DO NOTHING;

INSERT INTO sports (name, created_at) VALUES
  ('Fútbol', NOW()),
  ('Básquet', NOW()),
  ('Vóley', NOW())
ON CONFLICT (name) DO NOTHING;

INSERT INTO languages (name, code) VALUES
  ('Español', 'es'),
  ('English', 'en')
ON CONFLICT DO NOTHING;
