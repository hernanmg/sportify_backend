-- Create the "roles" table
CREATE TABLE roles (
    id SERIAL PRIMARY KEY, -- Auto-incrementing primary key
    name VARCHAR(50) NOT NULL UNIQUE, -- Unique name for the role
    description TEXT, -- Optional description for the role
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, -- Timestamp for creation
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP -- Timestamp for the last update
);

-- Create the "permissions" table
CREATE TABLE permissions (
    id SERIAL PRIMARY KEY, -- Auto-incrementing primary key
    name VARCHAR(50) NOT NULL UNIQUE, -- Unique name for the permission
    description TEXT, -- Optional description for the permission
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, -- Timestamp for creation
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP -- Timestamp for the last update
);

-- Create the "role_permissions" junction table
CREATE TABLE role_permissions (
    id SERIAL PRIMARY KEY, -- Auto-incrementing primary key
    role_id INT NOT NULL, -- Foreign key to "roles"
    permission_id INT NOT NULL, -- Foreign key to "permissions"
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, -- Timestamp for creation
    CONSTRAINT fk_role FOREIGN KEY (role_id) REFERENCES roles (id) ON DELETE CASCADE,
    CONSTRAINT fk_permission FOREIGN KEY (permission_id) REFERENCES permissions (id) ON DELETE CASCADE,
    CONSTRAINT unique_role_permission UNIQUE (role_id, permission_id) -- Prevent duplicate assignments
);

-- Create the "users" table
CREATE TABLE users (
    id SERIAL PRIMARY KEY, -- Auto-incrementing primary key
    username VARCHAR(50) NOT NULL UNIQUE, -- Unique username
    email VARCHAR(100) NOT NULL UNIQUE, -- Unique email
    password_hash TEXT NOT NULL, -- Hashed password
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, -- Timestamp for creation
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP -- Timestamp for the last update
);

-- Create the "user_roles" junction table
CREATE TABLE user_roles (
    id SERIAL PRIMARY KEY, -- Auto-incrementing primary key
    user_id INT NOT NULL, -- Foreign key to "users"
    role_id INT NOT NULL, -- Foreign key to "roles"
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, -- Timestamp for creation
    CONSTRAINT fk_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
    CONSTRAINT fk_role FOREIGN KEY (role_id) REFERENCES roles (id) ON DELETE CASCADE,
    CONSTRAINT unique_user_role UNIQUE (user_id, role_id) -- Prevent duplicate assignments
);
