/**
 * Alinea permissions/sports/roles.name antes de TypeORM synchronize (dev local).
 * Mismo SQL que Render usa en 02-pre-sync.sql.
 */
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');
const { getPgClientConfig } = require('./db-connection');

const PRE_SYNC = path.join(
  __dirname,
  '..',
  'src/database/render/02-pre-sync.sql',
);

async function main() {
  if (!fs.existsSync(PRE_SYNC)) {
    console.warn('⚠️  pre-sync omitido: no existe 02-pre-sync.sql');
    return;
  }
  const { config, label } = getPgClientConfig();
  const client = new Client(config);
  await client.connect();
  try {
    console.log(`▶ pre-sync → ${label}`);
    await client.query(fs.readFileSync(PRE_SYNC, 'utf8'));
    console.log('✅ pre-sync listo (permissions, sports, roles)');
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error('pre-sync falló:', err.message);
  process.exit(1);
});
