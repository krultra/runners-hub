// scripts/compareUsersWithBackup.js
// Compare the current Firestore 'users' collection with a backup JSON file.
// Produces a summary in stdout and writes a detailed diff JSON next to the backup file.
//
// Usage: From the root of the project, run:
//   node scripts/compareUsersWithBackup.js path/to/firestore_backup_YYYYMMDD_HHMMSS.json
//
// The backup file format should match the output of scripts/backupFirestore.js
// (top-level object of collections keyed by collection name, then docs keyed by docId).

const fs = require('fs');
const path = require('path');
const os = require('os');
const admin = require('firebase-admin');

admin.initializeApp({
  credential: admin.credential.cert(require(path.join(os.homedir(), '.secrets/runners-hub/serviceAccountKey.json'))),
});
const db = admin.firestore();

function loadBackup(backupPath) {
  const absPath = path.resolve(backupPath);
  if (!fs.existsSync(absPath)) {
    throw new Error(`Backup file not found: ${absPath}`);
  }
  const raw = fs.readFileSync(absPath, 'utf8');
  const data = JSON.parse(raw);
  if (!data.users || typeof data.users !== 'object') {
    console.warn('Backup file has no users collection; proceeding with empty set.');
    return { absPath, users: {} };
  }
  return { absPath, users: data.users };
}

function isProbablyUID(value) {
  // Heuristic: not containing '@' and length in a range typical for Firebase UID (e.g., 20-36)
  return typeof value === 'string' && !value.includes('@') && value.length >= 20 && value.length <= 40;
}

function shallowDiff(objA = {}, objB = {}) {
  const keys = new Set([...Object.keys(objA), ...Object.keys(objB)]);
  const changes = {};
  for (const k of keys) {
    const a = objA[k];
    const b = objB[k];
    // Normalize Firestore Timestamp-like objects from backup
    const norm = (v) => {
      if (v && typeof v === 'object' && typeof v._seconds === 'number') return `__ts:${v._seconds}:${v._nanoseconds||0}`;
      return v;
    };
    if (JSON.stringify(norm(a)) !== JSON.stringify(norm(b))) {
      changes[k] = { before: a, after: b };
    }
  }
  return changes;
}

async function fetchCurrentUsers() {
  const snap = await db.collection('users').get();
  const out = {};
  snap.forEach(doc => { out[doc.id] = doc.data(); });
  return out;
}

async function main() {
  try {
    const backupPath = process.argv[2];
    if (!backupPath) {
      console.error('Usage: node scripts/compareUsersWithBackup.js path/to/backup.json');
      process.exit(1);
    }

    const { absPath, users: backupUsers } = loadBackup(backupPath);
    console.log(`Loaded backup from: ${absPath}`);

    const currentUsers = await fetchCurrentUsers();
    console.log(`Fetched current users from Firestore: ${Object.keys(currentUsers).length} docs`);

    const backupIds = new Set(Object.keys(backupUsers));
    const currentIds = new Set(Object.keys(currentUsers));

    const added = []; // in current, not in backup
    const removed = []; // in backup, not in current
    const changed = []; // same id, different content

    for (const id of currentIds) {
      if (!backupIds.has(id)) added.push(id);
    }
    for (const id of backupIds) {
      if (!currentIds.has(id)) removed.push(id);
    }
    for (const id of currentIds) {
      if (backupIds.has(id)) {
        const diffs = shallowDiff(backupUsers[id], currentUsers[id]);
        if (Object.keys(diffs).length > 0) {
          // Add some helpful flags
          const emailNow = currentUsers[id]?.email;
          const emailWas = backupUsers[id]?.email;
          const suspiciousEmail = isProbablyUID(emailNow) && emailWas && emailWas.includes('@') && emailNow !== emailWas;
          changed.push({ id, diffs, suspiciousEmail });
        }
      }
    }

    console.log('Summary:');
    console.log(`  Backup users:  ${backupIds.size}`);
    console.log(`  Current users: ${currentIds.size}`);
    console.log(`  Added:         ${added.length}`);
    console.log(`  Removed:       ${removed.length}`);
    console.log(`  Changed:       ${changed.length}`);

    const suspicious = changed.filter(c => c.suspiciousEmail);
    if (suspicious.length) {
      console.log(`  Suspicious email changes: ${suspicious.length}`);
    }

    // Write detailed diff JSON next to backup
    const outDir = path.dirname(absPath);
    const base = path.basename(absPath, path.extname(absPath));
    const outPath = path.join(outDir, `${base}__users_diff.json`);
    fs.writeFileSync(outPath, JSON.stringify({
      summary: {
        backupCount: backupIds.size,
        currentCount: currentIds.size,
        addedCount: added.length,
        removedCount: removed.length,
        changedCount: changed.length,
        suspiciousEmailChanges: suspicious.length,
      },
      added,
      removed,
      changed,
    }, null, 2));

    console.log(`\nDetailed diff written to: ${outPath}`);
  } catch (err) {
    console.error('Comparison failed:', err.message || err);
    process.exit(1);
  }
}

main();
