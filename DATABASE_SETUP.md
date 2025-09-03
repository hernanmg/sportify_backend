# 🐘 Setup de Base de Datos PostgreSQL

Este proyecto utiliza PostgreSQL con Docker para el desarrollo local.

## 📋 Requisitos Previos

- Docker y Docker Compose instalados
- Puerto 5445 disponible (PostgreSQL)
- Puerto 8080 disponible (pgAdmin)

## 🚀 Inicio Rápido

### 1. Crear archivo de variables de entorno

Crea un archivo `.env` en la raíz del proyecto con:

```bash
# Database Configuration
DB_HOST=localhost
DB_PORT=5445
DB_USERNAME=sportify_user
DB_PASSWORD=sportify_password
DB_NAME=sportify_amateur

# TypeORM Configuration
DB_SYNCHRONIZE=true
DB_LOGGING=true

# JWT Configuration
JWT_SECRET=your-super-secret-jwt-key-here

# Application Configuration
NODE_ENV=development
PORT=3000
```

### 2. Iniciar la base de datos

```bash
# Opción 1: Usar el script helper
./scripts/db-setup.sh start

# Opción 2: Docker Compose directo
docker-compose up -d postgres pgadmin
```

### 3. Verificar que todo funciona

```bash
# Ver estado de contenedores
./scripts/db-setup.sh status

# Ver logs si hay problemas
./scripts/db-setup.sh logs
```

### 4. Iniciar tu backend NestJS

```bash
npm run start:dev
```

## 🔧 Administración

### Acceder a pgAdmin

1. Abrir: http://localhost:8080
2. Email: `admin@sportify.com`
3. Password: `admin123`

### Configurar conexión en pgAdmin

1. Clic derecho en "Servers" → "Register" → "Server"
2. **General tab:**
   - Name: `Sportify Amateur Local`
3. **Connection tab:**
   - Host: `postgres` (nombre del servicio Docker)
   - Port: `5432`
   - Database: `sportify_amateur`
   - Username: `sportify_user`
   - Password: `sportify_password`

### Conectar desde línea de comandos

```bash
# Usar el script helper
./scripts/db-setup.sh connect

# O conectar directamente
psql -h localhost -p 5445 -U sportify_user -d sportify_amateur
```

## 📊 Gestión de Datos

### Inicialización Automática

La base de datos se inicializa automáticamente con:
- `src/database/tables.sql` - Estructura de tablas
- `src/database/inserts.sql` - Datos iniciales
- `src/database/languages.sql` - Configuración de idiomas
- `src/database/user_role_permission.sql` - Roles y permisos

### TypeORM Synchronize

Con `DB_SYNCHRONIZE=true`, TypeORM automáticamente:
- ✅ Crea nuevas tablas de entidades
- ✅ Agrega nuevas columnas
- ✅ Modifica tipos de datos
- ⚠️ **NO elimina** columnas o tablas (por seguridad)

### Comandos Útiles

```bash
# Iniciar base de datos
./scripts/db-setup.sh start

# Detener todo
./scripts/db-setup.sh stop

# Reiniciar
./scripts/db-setup.sh restart

# Ver logs en tiempo real
./scripts/db-setup.sh logs

# Resetear completamente (⚠️ BORRA TODOS LOS DATOS)
./scripts/db-setup.sh reset

# Ver estado
./scripts/db-setup.sh status
```

## 🔄 Flujo de Desarrollo

1. **Modificar entidades TypeORM** en `src/*/entities/`
2. **Reiniciar backend** con `npm run start:dev`
3. **TypeORM sincroniza automáticamente** la estructura
4. **Verificar cambios** en pgAdmin si es necesario

## 🐛 Troubleshooting

### Error de conexión

```bash
# Verificar que los contenedores estén corriendo
./scripts/db-setup.sh status

# Ver logs para errores
./scripts/db-setup.sh logs

# Reiniciar todo
./scripts/db-setup.sh restart
```

### Puerto en uso

Si el puerto 5445 está ocupado:
1. Cambiar puerto en `docker-compose.yml`
2. Actualizar `DB_PORT` en `.env`
3. Reiniciar contenedores

### Problemas de sincronización

Si TypeORM no sincroniza:
1. Verificar que `DB_SYNCHRONIZE=true` en `.env`
2. Revisar logs del backend NestJS
3. Verificar que las entidades estén correctamente importadas

## 📁 Estructura de Archivos

```
├── docker-compose.yml          # Configuración Docker
├── .env                       # Variables de entorno (crear)
├── scripts/
│   └── db-setup.sh           # Script de gestión
└── src/
    ├── database/             # Scripts SQL
    ├── config/
    │   └── database.config.ts # Configuración TypeORM
    └── */entities/           # Entidades TypeORM
```
