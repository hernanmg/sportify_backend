# Deploy en Render + Neon

## Arquitectura

| Servicio | Rol |
|----------|-----|
| **Neon** | PostgreSQL (`DATABASE_URL`) |
| **Render** | API NestJS (Web Service) |
| **APK Flutter** | `--dart-define=API_BASE_URL=https://TU-SERVICIO.onrender.com` |

En cada deploy de Render se ejecuta automáticamente:

1. `scripts/deploy-db.js` — schema base, datos auxiliares, migraciones SQL, seed demo  
2. `scripts/sync-schema.js` — tablas/columnas que solo existen en entidades TypeORM (finanzas, `categories`, etc.)  
3. `node dist/main` — API

No hace falta Shell en Render.

---

## Variables de entorno en Render

### Obligatorias

| Variable | Descripción | Ejemplo |
|----------|-------------|---------|
| `DATABASE_URL` | Connection string de Neon (con SSL) | `postgresql://user:pass@ep-xxx.neon.tech/neondb?sslmode=require` |
| `JWT_SECRET` | Secreto JWT access token (≥ 32 caracteres aleatorios) | Generar en Render |
| `JWT_REFRESH_SECRET` | Secreto refresh token | Generar en Render |
| `NODE_ENV` | Entorno | `production` |
| `PORT` | Puerto (Render lo inyecta; default `10000`) | `10000` |

### Recomendadas para deploy automático

| Variable | Valor sugerido | Descripción |
|----------|----------------|-------------|
| `RENDER` | `true` | Desactiva `synchronize` en la app en runtime |
| `DB_SYNCHRONIZE` | `false` | No alterar schema en cada request |
| `RUN_SCHEMA_SYNC` | `true` | Sync TypeORM solo al arrancar el deploy |
| `RUN_DEMO_SEED` | `true` | Carga usuarios demo (poner `false` en prod real) |
| `SESSION_SECRET` | string aleatorio largo | Sesión Passport (`main.ts`) |
| `DB_LOGGING` | `false` | Logs SQL |
| `CORS_ORIGINS` | opcional | Orígenes separados por coma (Flutter web, etc.) |

### Opcionales (funcionalidad extra)

| Variable | Cuándo |
|----------|--------|
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` | Emails (convocatorias, recordatorios) |
| `EMAIL_REQUIRE_VERIFIED` | `true` si exigís email verificado |
| `FIREBASE_SERVICE_ACCOUNT_JSON` | Push FCM (JSON en una línea) |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_CALLBACK_URL` | Login Google OAuth |
| `AWS_SNS_TOPIC_ARN` | SNS legacy (si se usa) |

### Alternativa a `DATABASE_URL` (no usar en Render si tenés Neon)

| Variable | Default local |
|----------|----------------|
| `DB_HOST` | `localhost` |
| `DB_PORT` | `5445` |
| `DB_USERNAME` | `sportify_user` |
| `DB_PASSWORD` | — |
| `DB_NAME` | `sportify_amateur` |
| `DB_SSL` | `true` si Postgres remoto |

---

## Neon

1. Crear proyecto → copiar **connection string** (pooled o direct; pooled recomendado en free tier).  
2. Asegurar `?sslmode=require` en la URL.  
3. Pegar en Render como `DATABASE_URL`.

No correr migraciones a mano en Neon: lo hace `deploy-db.js` en cada deploy.

---

## Render — Web Service

- **Build Command:** `npm ci && npm run build`  
- **Start Command:** `npm run start:render`  
- **Health check:** `/api` (Swagger)

O usar el blueprint `render.yaml` en la raíz del backend.

---

## Usuarios demo (seed)

Contraseña para los tres: **`Demo2026!`** (bcrypt en SQL).

| Rol | Email | Nombre |
|-----|-------|--------|
| super_admin | hernanmilers121@gmail.com | Hernan Milers |
| dt | sanchez.guillermo@hotmail.com | Guillermo Sanchez |
| player | maxirodriguez160583@gmail.com | Maximiliano Rodriguez |

Login en la app: **email** + contraseña.

Regenerar hash: `node scripts/gen-demo-hash.js`

Desactivar seed en producción real: `RUN_DEMO_SEED=false`

---

## APK Flutter

```powershell
flutter build apk --release --dart-define=API_BASE_URL=https://sportify-amateur-api.onrender.com
```

Sin barra final. Usar HTTPS de Render.

---

## Orden de archivos SQL (referencia)

1. `src/database/tables.sql`  
2. `src/database/render/01-inserts-aux.sql`  
3. Migraciones `001` … `020` (ver lista en `scripts/deploy-db.js`)  
4. `src/database/render/99-seed-demo.sql`  

Estado guardado en tabla `sportify_schema_migrations` (no se re-ejecutan archivos ya aplicados).

---

## Problemas frecuentes

| Síntoma | Causa |
|---------|--------|
| API lenta al primer request | Cold start plan free Render |
| Login falla | `RUN_DEMO_SEED` o migraciones no corrieron; revisar logs deploy |
| SSL DB | `DATABASE_URL` debe incluir SSL; el script ya usa `rejectUnauthorized: false` |
| Tabla finance falta | `RUN_SCHEMA_SYNC=false` por error; revisar log `sync-schema.js` |

---

## Logs útiles en Render

Buscar líneas:

- `▶ src/database/...` — migración aplicada  
- `⏭ Ya aplicado` — skip idempotente  
- `✅ Migraciones y seed completados`  
- `✅ TypeORM schema sync OK`
