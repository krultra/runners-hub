// scripts/backupFirestore.js
const path = require('path');
const os = require('os');
const { runBackup } = require('./firestoreBackupCollections');

async function backup() {
  const credentialPath = process.env.FIREBASE_ADMIN_SA
    ? process.env.FIREBASE_ADMIN_SA
    : path.join(os.homedir(), '.secrets/runners-hub/serviceAccountKey.json');

  await runBackup({
    credentialPath
    // No collections supplied -> backup all root collections (with subcollections)
  });
}

backup().catch(err => {
  console.error('Backup failed:', err);
  process.exit(1);
});