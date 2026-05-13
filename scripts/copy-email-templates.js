const path = require('node:path');
const fs = require('node:fs/promises');

async function main() {
  const root = path.resolve(__dirname, '..');
  const srcDir = path.join(root, 'src', 'email', 'templates');
  const destDir = path.join(root, 'dist', 'email', 'templates');

  await fs.mkdir(destDir, { recursive: true });

  // Node >=16.7 soporta fs.cp; en Node 24 está disponible.
  await fs.cp(srcDir, destDir, { recursive: true, force: true });
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('[copy-email-templates] Error copiando templates:', err);
  process.exitCode = 1;
});

