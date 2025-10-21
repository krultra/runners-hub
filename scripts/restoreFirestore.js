// scripts/restoreFirestore.js
const path = require('path');
const os = require('os');
const { runRestore } = require('./firestoreBackupCollections');

async function restore() {
  const credentialPath = process.env.FIREBASE_ADMIN_SA
    ? process.env.FIREBASE_ADMIN_SA
    : path.join(os.homedir(), '.secrets/runners-hub/serviceAccountKey.json');

  const backupPath = process.argv[2];
  if (!backupPath) {
    console.error('Usage: node scripts/restoreFirestore.js <backup-file-path> [--purge true] [--dry-run true]');
    process.exit(1);
  }

  const args = process.argv.slice(3);
  const options = {};
  for (let i = 0; i < args.length; i++) {
    const token = args[i];
    if (!token.startsWith('--')) continue;
    const key = token.slice(2);
    const value = args[i + 1] && !args[i + 1].startsWith('--') ? args[++i] : 'true';
    options[key] = value;
  }

  await runRestore({
    credentialPath,
    inputPath: backupPath,
    collections: [],
    purge: options.purge === 'true' || options.purge === '1',
    dryRun: options['dry-run'] === 'true' || options['dry-run'] === '1'
  });
}

restore().catch(err => {
  console.error('Restore failed:', err);
  process.exit(1);
});
