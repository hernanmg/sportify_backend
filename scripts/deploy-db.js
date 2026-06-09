/**
 * Migraciones SQL + seed demo en deploy (Render / Neon).
 * Ejecutar después de `npm run build` si usás sync-schema (entidades en dist).
 *
 * Uso: node scripts/deploy-db.js
 */
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

const ROOT = path.join(__dirname, '..');

const BOOTSTRAP_FILES = [
  'src/database/tables.sql',
];

const MIGRATION_FILES = [
  'src/database/migrations/001-add-user-fields.sql',
  'src/database/migrations/002-create-roster-table.sql',
  'src/database/migrations/003-update-notifications-table.sql',
  'src/database/migrations/004-create-sport-events-tables.sql',
  'src/database/migrations/005-fix-notifications-sport-events.sql',
  'src/database/migrations/006-add-reminder-sent-to-sport-events.sql',
  'src/database/migrations/007-unify-team-categories-and-fix-roster.sql',
  'src/database/migrations/008-team-social-guests.sql',
  'src/database/migrations/009-roster-jersey-multi-category.sql',
  'src/database/migrations/010-team-members-invites.sql',
  'src/database/migrations/011-player-eligibility-convocations.sql',
  'src/database/migrations/012-fcm-templates-stats-multisport.sql',
  'src/database/migrations/013-payment-receipts.sql',
  'src/database/migrations/014-post-match-ratings.sql',
  'src/database/migrations/015-post-match-stats-lineup.sql',
  'src/database/migrations/016-team-tactical-boards.sql',
  'src/database/migrations/017-post-match-report.sql',
  'src/database/migrations/018-team-operations.sql',
  'src/database/migrations/019-dt-role.sql',
  'src/database/migrations/020-team-extras.sql',
  'src/database/migrations/021-sponsor-logo-text.sql',
  'src/database/migrations/022-guest-players.sql',
  'src/database/migrations/023-category-display-names.sql',
];

const AUX_FILES = ['src/database/render/01-inserts-aux.sql'];

/** Siempre re-ejecutable (upsert usuarios demo). No se registra en sportify_schema_migrations. */
const SEED_FILES = ['src/database/render/99-seed-demo.sql'];

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

async function ensureMigrationTable(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS sportify_schema_migrations (
      id SERIAL PRIMARY KEY,
      filename VARCHAR(255) NOT NULL UNIQUE,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
}

async function isApplied(client, filename) {
  const res = await client.query(
    'SELECT 1 FROM sportify_schema_migrations WHERE filename = $1',
    [filename],
  );
  return res.rowCount > 0;
}

async function markApplied(client, filename) {
  await client.query(
    'INSERT INTO sportify_schema_migrations (filename) VALUES ($1) ON CONFLICT (filename) DO NOTHING',
    [filename],
  );
}

async function runSqlFile(client, relativePath) {
  const fullPath = path.join(ROOT, relativePath);
  if (!fs.existsSync(fullPath)) {
    console.warn(`⚠️  Omitido (no existe): ${relativePath}`);
    return;
  }
  const sql = fs.readFileSync(fullPath, 'utf8');
  if (!sql.trim()) return;
  console.log(`▶ ${relativePath}`);
  await client.query(sql);
}

async function runFileList(client, files) {
  for (const file of files) {
    if (await isApplied(client, file)) {
      console.log(`⏭  Ya aplicado: ${file}`);
      continue;
    }
    try {
      await runSqlFile(client, file);
      await markApplied(client, file);
    } catch (err) {
      console.error(`❌ Error en ${file}:`, err.message);
      throw err;
    }
  }
}

async function main() {
  const runSeed = process.env.RUN_DEMO_SEED !== 'false';
  const client = new Client(getClientConfig());
  await client.connect();
  console.log('🗄️  Deploy DB: conectado');

  try {
    await ensureMigrationTable(client);
    await runFileList(client, BOOTSTRAP_FILES);
    await runFileList(client, AUX_FILES);
    await runFileList(client, MIGRATION_FILES);
    if (runSeed) {
      for (const file of SEED_FILES) {
        try {
          await runSqlFile(client, file);
        } catch (err) {
          console.error(`❌ Error en seed ${file}:`, err.message);
          throw err;
        }
      }
    } else {
      console.log('ℹ️  RUN_DEMO_SEED=false — seed demo omitido');
    }
    console.log('✅ Migraciones y seed completados');
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error('Deploy DB falló:', err);
  process.exit(1);
});
