/**
 * Sincroniza tablas/columnas faltantes (finanzas, categories, etc.) vía TypeORM.
 * Solo para deploy; en producción DB_SYNCHRONIZE debe seguir en false en la app.
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const { DataSource } = require('typeorm');

function buildOptions() {
  const url = process.env.DATABASE_URL;
  const base = {
    type: 'postgres',
    entities: [path.join(__dirname, '..', 'dist', '**', '*.entity.js')],
    synchronize: true,
    logging: ['error'],
  };
  if (url) {
    return {
      ...base,
      url,
      ssl: { rejectUnauthorized: false },
    };
  }
  return {
    ...base,
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    username: process.env.DB_USERNAME || 'sportify_user',
    password: process.env.DB_PASSWORD || 'sportify_password',
    database: process.env.DB_NAME || 'sportify_amateur',
  };
}

async function main() {
  if (process.env.RUN_SCHEMA_SYNC === 'false') {
    console.log('ℹ️  RUN_SCHEMA_SYNC=false — sync omitido');
    return;
  }

  const ds = new DataSource(buildOptions());
  await ds.initialize();
  console.log('✅ TypeORM schema sync OK');
  await ds.destroy();
}

main().catch((err) => {
  console.error('Schema sync falló:', err);
  process.exit(1);
});
