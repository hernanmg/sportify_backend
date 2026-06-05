/**
 * Sincroniza tablas/columnas faltantes (finanzas, categories, etc.) vía TypeORM.
 * Solo para deploy; en producción DB_SYNCHRONIZE debe seguir en false en la app.
 */
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const { Client } = require('pg');
const { DataSource } = require('typeorm');

const ROOT = path.join(__dirname, '..');
const PRE_SYNC_FILES = ['src/database/render/02-pre-sync.sql'];

function getClientConfig() {
  const url = process.env.DATABASE_URL;
  if (url) {
    return {
      connectionString: url,
      ssl: { rejectUnauthorized: false },
    };
  }
  return {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    user: process.env.DB_USERNAME || 'sportify_user',
    password: process.env.DB_PASSWORD || 'sportify_password',
    database: process.env.DB_NAME || 'sportify_amateur',
  };
}

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

async function runPreSyncSql() {
  const client = new Client(getClientConfig());
  await client.connect();
  try {
    for (const relativePath of PRE_SYNC_FILES) {
      const fullPath = path.join(ROOT, relativePath);
      if (!fs.existsSync(fullPath)) continue;
      const sql = fs.readFileSync(fullPath, 'utf8');
      if (!sql.trim()) continue;
      console.log(`▶ pre-sync ${relativePath}`);
      await client.query(sql);
    }
  } finally {
    await client.end();
  }
}

async function main() {
  if (process.env.RUN_SCHEMA_SYNC === 'false') {
    console.log('ℹ️  RUN_SCHEMA_SYNC=false — sync omitido');
    return;
  }

  await runPreSyncSql();

  const ds = new DataSource(buildOptions());
  await ds.initialize();
  console.log('✅ TypeORM schema sync OK');
  await ds.destroy();
}

main().catch((err) => {
  console.error('Schema sync falló:', err);
  process.exit(1);
});
