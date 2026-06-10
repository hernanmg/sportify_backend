-- =============================================================================
-- Neon / producción: eliminar equipo duplicado ZFC id = 2
-- Conservar equipo id = 1 (creado por super admin).
--
-- IMPORTANTE:
-- - Ejecutar primero solo el bloque "1. VERIFICAR" y revisar resultados.
-- - Guillermo (DT) si estaba solo en el equipo #2 quedará sin equipo:
--   después invitalo al equipo #1 con código desde la app.
-- - No commitear hasta confirmar que id=2 es el duplicado correcto.
-- =============================================================================

-- 1. VERIFICAR (ejecutar solo esto primero)
SELECT id, name, sport_id, created_by_user_id, created_at
FROM teams
WHERE name ILIKE '%ZFC%' OR id IN (1, 2)
ORDER BY id;

SELECT tm.team_id, t.name, u.email, tm.role
FROM team_members tm
JOIN teams t ON t.id = tm.team_id
JOIN users u ON u.id = tm.user_id
WHERE tm.team_id IN (1, 2)
ORDER BY tm.team_id, u.email;

SELECT pr.team_id, t.name, COUNT(*) AS filas_roster
FROM player_roster pr
JOIN teams t ON t.id = pr.team_id
WHERE pr.team_id IN (1, 2)
GROUP BY pr.team_id, t.name;

-- 2. ELIMINAR (dentro de transacción; COMMIT solo si todo coincide)
BEGIN;

-- Resumen de lo que se borrará (solo lectura)
SELECT 'player_roster' AS tabla, COUNT(*) AS filas
FROM player_roster WHERE team_id = 2
UNION ALL
SELECT 'players', COUNT(*) FROM players WHERE team_id = 2
UNION ALL
SELECT 'team_members', COUNT(*) FROM team_members WHERE team_id = 2
UNION ALL
SELECT 'team_invites', COUNT(*) FROM team_invites WHERE team_id = 2
UNION ALL
SELECT 'team_categories', COUNT(*) FROM team_categories WHERE team_id = 2
UNION ALL
SELECT 'sport_events', COUNT(*) FROM sport_events WHERE team_id = 2;

-- Borra el equipo; el resto cae por ON DELETE CASCADE (o team_id → NULL en notifications)
DELETE FROM teams
WHERE id = 2
  AND EXISTS (SELECT 1 FROM teams WHERE id = 1);  -- solo si el equipo #1 sigue existiendo

-- Comprobar que quedó solo el equipo bueno
SELECT id, name FROM teams WHERE name ILIKE '%ZFC%' ORDER BY id;

-- Si algo no cuadra:
-- ROLLBACK;

COMMIT;

-- 3. POST-ELIMINACIÓN (opcional)
-- Invitar a sanchez.guillermo@hotmail.com al equipo #1 desde la app (código de invitación).
-- O asignarlo manualmente:
--
-- INSERT INTO team_members (user_id, team_id, role)
-- SELECT u.id, 1, 'admin'
-- FROM users u
-- WHERE u.email = 'sanchez.guillermo@hotmail.com'
-- ON CONFLICT (user_id, team_id) DO NOTHING;
