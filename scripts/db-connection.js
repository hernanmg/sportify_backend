/**
 * Configuración compartida para scripts que hablan con PostgreSQL.
 * - Carga `.env` (mismas variables que Nest en local).
 * - Si existe DATABASE_URL → Neon/Render (con SSL).
 * - Si no → DB_HOST/DB_PORT/... (local; puerto por defecto 5445 = docker-compose).
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

function getPgClientConfig() {
  const url = process.env.DATABASE_URL;
  if (url) {
    return {
      config: {
        connectionString: url,
        ssl: { rejectUnauthorized: false },
      },
      label: 'DATABASE_URL (remoto)',
    };
  }

  const host = process.env.DB_HOST || 'localhost';
  const port = parseInt(process.env.DB_PORT || '5445', 10);
  const user = process.env.DB_USERNAME || 'sportify_user';
  const database = process.env.DB_NAME || 'sportify_amateur';

  return {
    config: {
      host,
      port,
      user,
      password: process.env.DB_PASSWORD || 'sportify_password',
      database,
    },
    label: `${host}:${port}/${database} (local)`,
  };
}

module.exports = { getPgClientConfig };
