-- Insertar usuario de prueba con contraseña hasheada
-- Contraseña: "123456"
INSERT INTO users (username, email, password_hash, first_name, last_name, is_active, created_at, updated_at) 
VALUES 
('testuser', 'test@example.com', '$2b$10$mHJHZ8gxrkgxU0gU8gxU0eMmF8HZoOQMQZHZgHzOQZGZHzgHZoOQMQ', 'Usuario', 'Prueba', true, NOW(), NOW())
ON CONFLICT (email) DO UPDATE SET 
  password_hash = EXCLUDED.password_hash,
  updated_at = NOW();

-- Asignar rol 'guest' al usuario (asumiendo que el usuario es ID 1 y guest es role_id 5)
INSERT INTO user_roles (user_id, role_id, created_at)
SELECT 
  u.id, 
  5, -- guest role
  NOW()
FROM users u 
WHERE u.email = 'test@example.com'
ON CONFLICT (user_id, role_id) DO NOTHING;
