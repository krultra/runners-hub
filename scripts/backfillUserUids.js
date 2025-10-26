// scripts/backfillUserUids.js
// Backfill missing or email-based `uid` fields in the users collection with generated, non-email IDs.
// Safe by default: supports dry-run, prompts for confirmation, uses batched writes, and skips documents
// that already have a non-email uid. If a user document lacks `userId`, the script sets it to the doc ID
// for backward compatibility.
//
// Usage:
//   node scripts/backfillUserUids.js                          # interactive run against prod
//   node scripts/backfillUserUids.js --dry-run                 # preview without writing (prod)
//   node scripts/backfillUserUids.js --env=test --dry-run      # dry-run against test project
//   node scripts/backfillUserUids.js --env=test                # run against test project
//
// Notes:
// - Ensure your service account JSON at ~/.secrets/runners-hub/serviceAccountKey.json
//   (and ~/.secrets/runners-hub/serviceAccountKeyTest.json for --env=test)
// - Consider running a backup first: `node scripts/backupFirestore.js`
// - Requires Node 16+ (for crypto.randomUUID)

const admin = require('firebase-admin');
const path = require('path');
const os = require('os');
const readline = require('readline');
const { randomUUID } = require('crypto');

const argv = process.argv.slice(2);
const DRY_RUN = argv.includes('--dry-run');
const ENV_ARG = (() => {
  const explicit = argv.find((arg) => arg.startsWith('--env='));
  if (explicit) {
    return explicit.split('=')[1]?.trim().toLowerCase() || 'prod';
  }
  if (argv.includes('--test')) {
    return 'test';
  }
  return 'prod';
})();

const SERVICE_ACCOUNT_FILES = {
  prod: 'serviceAccountKey.json',
  test: 'serviceAccountKeyTest.json'
};

const targetEnv = SERVICE_ACCOUNT_FILES[ENV_ARG] ? ENV_ARG : 'prod';
if (ENV_ARG && !SERVICE_ACCOUNT_FILES[ENV_ARG]) {
  console.warn(`Unknown --env value '${ENV_ARG}', defaulting to 'prod'.`);
}

const credentialFile = SERVICE_ACCOUNT_FILES[targetEnv];
const credentialPath = path.join(os.homedir(), `.secrets/runners-hub/${credentialFile}`);

admin.initializeApp({
  credential: admin.credential.cert(require(credentialPath)),
});
const db = admin.firestore();

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const ask = (q) => new Promise((res) => rl.question(q, res));

const toTrimmedOrNull = (value) => {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }
  const str = String(value).trim();
  return str.length > 0 ? str : null;
};

const looksLikeEmail = (value) => {
  if (!value) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.toLowerCase());
};

const describeDoc = (doc, currentUid, newUid) => ({
  docId: doc.id,
  currentUid: currentUid || null,
  proposedUid: newUid,
  emailLikeDocId: looksLikeEmail(doc.id),
});

function generateUniqueUid(existing) {
  let candidate;
  do {
    candidate = randomUUID();
  } while (existing.has(candidate));
  existing.add(candidate);
  return candidate;
}

async function backfillUserUids() {
  console.log(`Environment: ${targetEnv}`);
  console.log(`Using credentials at: ${credentialPath}`);
  console.log(`Scanning users for missing or email-based uid values${DRY_RUN ? ' (dry-run)' : ''}...`);
  const snap = await db.collection('users').get();
  const existingUids = new Set();
  const updates = [];

  snap.forEach((doc) => {
    const data = doc.data() || {};
    const currentUid = toTrimmedOrNull(data.uid);
    if (currentUid) {
      existingUids.add(currentUid);
    }
  });

  snap.forEach((doc) => {
    const data = doc.data() || {};
    const docId = doc.id;
    const docIdIsEmail = looksLikeEmail(docId);
    const currentUid = toTrimmedOrNull(data.uid);
    const currentUidLooksEmail = looksLikeEmail(currentUid);

    const needsUid = !currentUid;
    const badUid = currentUidLooksEmail || (currentUid && currentUid === docId && docIdIsEmail);

    if (!needsUid && !badUid) {
      // uid already present and non-email: nothing to do
      return;
    }

    const newUid = generateUniqueUid(existingUids);
    updates.push({
      doc,
      payload: {
        uid: newUid,
        ...(toTrimmedOrNull(data.userId) ? {} : { userId: docId })
      },
      info: describeDoc(doc, currentUid, newUid)
    });
  });

  console.log(`Found ${updates.length} users needing uid updates out of ${snap.size} total.`);

  if (updates.length === 0) {
    return { updated: 0 };
  }

  console.log('Sample updates:', updates.slice(0, 5).map((u) => u.info));

  if (DRY_RUN) {
    console.log('Dry run complete. No documents were modified.');
    return { updated: 0, dryRun: true };
  }

  const confirm = (await ask("Type 'migrate' to write these uid updates: ")).trim().toLowerCase();
  if (confirm !== 'migrate') {
    console.log('Aborted by user.');
    return { updated: 0, aborted: true };
  }

  let batch = db.batch();
  let ops = 0;
  let updated = 0;

  for (const item of updates) {
    batch.set(item.doc.ref, item.payload, { merge: true });
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
