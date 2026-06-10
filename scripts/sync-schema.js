/**
 * Sincroniza tablas/columnas faltantes (finanzas, categories, etc.) vía TypeORM.
 * Solo para deploy; en producción DB_SYNCHRONIZE debe seguir en false en la app.
 */
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');
const { DataSource } = require('typeorm');
const { getPgClientConfig } = require('./db-connection');

const ROOT = path.join(__dirname, '..');
const PRE_SYNC_FILES = ['src/database/render/02-pre-sync.sql'];

function buildOptions() {
  const { config } = getPgClientConfig();
  const base = {
    type: 'postgres',
    entities: [path.join(__dirname, '..', 'dist', '**', '*.entity.js')],
    synchronize: true,
    logging: ['error'],
  };
  if (config.connectionString) {
    return {
      ...base,
      url: config.connectionString,
      ssl: config.ssl,
    };
  }
  return {
    ...base,
    host: config.host,
    port: config.port,
    username: config.user,
    password: config.password,
    database: config.database,
  };
}

async function runPreSyncSql() {
  const { config, label } = getPgClientConfig();
  const client = new Client(config);
  await client.connect();
  console.log(`▶ pre-sync SQL → ${label}`);
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
