-- Seed demo Render (idempotente). Password: Demo2026! (bcrypt rounds=10)
-- Regenerar hash: node scripts/gen-demo-hash.js

-- Usuarios demo
INSERT INTO users (
  username, email, password_hash,
  first_name, last_name,
  estado_registro, email_verified, is_active
) VALUES
  (
    'hernan.milers',
    'hernanmilers121@gmail.com',
    '$2a$10$fTQpyEDFlxOw72EjoURUVOpp2yS1nlybvaqENV8tJREU2i8VxSO76',
    'Hernan',
    'Milers',
    'active',
    true,
    true
  ),
  (
    'guillermo.sanchez',
    'sanchez.guillermo@hotmail.com',
    '$2a$10$fTQpyEDFlxOw72EjoURUVOpp2yS1nlybvaqENV8tJREU2i8VxSO76',
    'Guillermo',
    'Sanchez',
    'active',
    true,
    true
  ),
  (
    'maxi.rodriguez',
    'maxirodriguez160583@gmail.com',
    '$2a$10$fTQpyEDFlxOw72EjoURUVOpp2yS1nlybvaqENV8tJREU2i8VxSO76',
    'Maximiliano',
    'Rodriguez',
    'active',
    true,
    true
  )
ON CONFLICT (email) DO UPDATE SET
  password_hash = EXCLUDED.password_hash,
  first_name = EXCLUDED.first_name,
  last_name = EXCLUDED.last_name,
  estado_registro = 'active',
  email_verified = true,
  is_active = true,
  updated_at = NOW();

-- Roles (un rol principal por usuario)
DELETE FROM user_roles
WHERE user_id IN (
  SELECT id FROM users
  WHERE email IN (
    'hernanmilers121@gmail.com',
    'sanchez.guillermo@hotmail.com',
    'maxirodriguez160583@gmail.com'
  )
);

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
