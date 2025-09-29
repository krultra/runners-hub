// scripts/copyCollection.js
// Safely copy one top-level Firestore collection to another collection name.
// - Prompts for the TARGET collection name (source defaults to 'users').
// - Uses batched writes (chunks of 400) to avoid exceeding Firestore limits.
// - Skips copy if target doc already exists (optional behavior can be adjusted).
//
// Usage:
//   node scripts/copyCollection.js
//
// Requirements:
//   - serviceAccountKey.json present at project root (same as backup script)
//   - `firebase-admin` installed (already in package.json)

const admin = require('firebase-admin');
const readline = require('readline');
const path = require('path');
const os = require('os');

// Initialize Admin SDK using the same pattern as backup/restore
admin.initializeApp({
  credential: admin.credential.cert(require(path.join(os.homedir(), '.secrets/runners-hub/serviceAccountKey.json'))),
});
const db = admin.firestore();

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function ask(question) {
  return new Promise((resolve) => rl.question(question, resolve));
}

async function copyCollection({ source = 'users', target }) {
  if (!target) throw new Error('Target collection name is required');
  if (source === target) throw new Error('Source and target collection names must be different');

  console.log(`\nStarting copy: '${source}' -> '${target}'`);

  // Fetch all docs from source collection
  const sourceRef = db.collection(source);
  const snap = await sourceRef.get();
  console.log(`Found ${snap.size} documents in '${source}'.`);

  const targetRef = db.collection(target);

  let processed = 0;
  let skipped = 0;
  let written = 0;

  let batch = db.batch();
  let opsInBatch = 0;

  for (const doc of snap.docs) {
    processed++;
    const targetDocRef = targetRef.doc(doc.id);

    // Option: skip if target already exists (safer default to prevent overwrite)
    const targetDoc = await targetDocRef.get();
    if (targetDoc.exists) {
      skipped++;
      if (processed % 100 === 0) {
        console.log(`Progress: processed=${processed}, written=${written}, skipped=${skipped}`);
      }
      continue;
    }

    batch.set(targetDocRef, doc.data(), { merge: false });
    opsInBatch++;

    if (opsInBatch >= 400) {
      await batch.commit();
      written += opsInBatch;
      console.log(`Committed batch: written so far = ${written}`);
      batch = db.batch();
      opsInBatch = 0;
    }

    if (processed % 200 === 0) {
      console.log(`Progress: processed=${processed}, written=${written}, skipped=${skipped}`);
    }
  }

  if (opsInBatch > 0) {
    await batch.commit();
    written += opsInBatch;
    console.log(`Committed final batch: total written = ${written}`);
  }

  console.log(`\nDone. Summary for '${source}' -> '${target}':`);
  console.log(`  processed: ${processed}`);
  console.log(`  written:   ${written}`);
  console.log(`  skipped:   ${skipped} (already existed in target)`);
}

(async () => {
  try {
    const sourceInput = await ask("Source collection name [default 'users']: ");
    const source = (sourceInput && sourceInput.trim()) || 'users';

    const target = (await ask('Target collection name (required): ')).trim();
    if (!target) {
      throw new Error('Target collection name cannot be empty.');
    }

    console.log(`\nAbout to copy from '${source}' to '${target}'.`);
    const confirm = (await ask("Type 'yes' to proceed: ")).trim().toLowerCase();
    if (confirm !== 'yes') {
      console.log('Aborted by user.');
      process.exit(0);
    }

    await copyCollection({ source, target });
  } catch (err) {
    console.error('Copy failed:', err.message || err);
    process.exitCode = 1;
  } finally {
    rl.close();
  }
})();
