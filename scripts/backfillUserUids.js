// scripts/backfillUserUids.js
// Backfill missing `uid` field in users collection by setting it to the document ID.
// Safe by default: prompts for confirmation, uses batched writes, and only updates docs missing uid.
//
// Usage:
//   node scripts/backfillUserUids.js
//
// Notes:
// - Ensure your service account JSON at ~/.secrets/runners-hub/serviceAccountKey.json
// - Consider running a backup first: `node scripts/backupFirestore.js`

const admin = require('firebase-admin');
const path = require('path');
const os = require('os');
const readline = require('readline');

admin.initializeApp({
  credential: admin.credential.cert(require(path.join(os.homedir(), '.secrets/runners-hub/serviceAccountKey.json'))),
});
const db = admin.firestore();

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const ask = (q) => new Promise((res) => rl.question(q, res));

async function backfillUserUids() {
  console.log('Scanning users for missing uid...');
  const snap = await db.collection('users').get();
  let missing = [];
  snap.forEach((doc) => {
    const data = doc.data() || {};
    if (!data.uid || String(data.uid).trim() === '') {
      missing.push(doc);
    }
  });
  console.log(`Found ${missing.length} users missing uid out of ${snap.size} total.`);

  if (missing.length === 0) return { updated: 0 };

  const confirm = (await ask("Type 'yes' to set uid = doc.id for these documents: ")).trim().toLowerCase();
  if (confirm !== 'yes') {
    console.log('Aborted by user.');
    return { updated: 0, aborted: true };
  }

  let batch = db.batch();
  let ops = 0;
  let updated = 0;

  for (const doc of missing) {
    batch.set(doc.ref, { uid: doc.id }, { merge: true });
    ops++;
    updated++;
    if (ops >= 400) {
      await batch.commit();
      console.log(`Committed batch. Updated so far: ${updated}`);
      batch = db.batch();
      ops = 0;
    }
  }

  if (ops > 0) {
    await batch.commit();
  }

  console.log(`Backfill complete. Updated ${updated} user documents.`);
  return { updated };
}

(async () => {
  try {
    console.log('NOTE: Consider running a backup first: node scripts/backupFirestore.js');
    const res = await backfillUserUids();
    if (!res.aborted) {
      console.log('Done.');
    }
  } catch (err) {
    console.error('Backfill failed:', err);
    process.exit(1);
  } finally {
    rl.close();
  }
})();
