/* eslint-disable no-console */
const fs = require('fs');
const os = require('os');
const path = require('path');
const admin = require('firebase-admin');

const argv = process.argv.slice(2);

const ENV_ARG = (() => {
  const explicit = argv.find((arg) => arg.startsWith('--env='));
  if (explicit) return explicit.split('=')[1]?.trim().toLowerCase() || 'prod';
  if (argv.includes('--test')) return 'test';
  return 'prod';
})();

const DRY_RUN = argv.includes('--dry-run');
const LIMIT = (() => {
  const v = argv.find((a) => a.startsWith('--limit='));
  if (!v) return 0;
  const n = Number(v.split('=')[1]);
  return Number.isFinite(n) ? n : 0;
})();
const MISSING_ONLY = argv.includes('--missing-only') || !argv.includes('--force');
const UPDATE_UPDATED_AT = argv.includes('--update-updatedAt');

const SERVICE_ACCOUNT_FILES = { prod: 'serviceAccountKey.json', test: 'serviceAccountKeyTest.json' };
const targetEnv = SERVICE_ACCOUNT_FILES[ENV_ARG] ? ENV_ARG : 'prod';
const serviceAccountDir = path.join(os.homedir(), '.secrets', 'runners-hub');
const credentialFile = SERVICE_ACCOUNT_FILES[targetEnv];
const credentialPath = path.join(serviceAccountDir, credentialFile);

function loadServiceAccount() {
  if (!fs.existsSync(credentialPath)) {
    throw new Error(`Service account not found at ${credentialPath}`);
  }
  return JSON.parse(fs.readFileSync(credentialPath, 'utf-8'));
}

function initFirebase() {
  if (!admin.apps.length) {
    admin.initializeApp({ credential: admin.credential.cert(loadServiceAccount()) });
  }
  return admin.firestore();
}

async function main() {
  console.log(`Environment: ${targetEnv}`);
  console.log(`Using credentials at: ${credentialPath}`);
  console.log(`Options: dryRun=${DRY_RUN} limit=${LIMIT || 'ALL'} missingOnly=${MISSING_ONLY} updateUpdatedAt=${UPDATE_UPDATED_AT}`);

  const db = initFirebase();
  const usersSnap = await db.collection('users').get();
  console.log(`Loaded ${usersSnap.size} users.`);

  let batch = db.batch();
  let ops = 0;
  let updated = 0;

  async function commitIfNeeded(force = false) {
    if (ops >= 400 || force) {
      if (!DRY_RUN) await batch.commit();
      batch = db.batch();
      ops = 0;
    }
  }

  for (const doc of usersSnap.docs) {
    const data = doc.data() || {};
    const hasCreatedAt = data.createdAt != null;
    const hasUpdatedAt = data.updatedAt != null;

    const needsCreated = MISSING_ONLY ? !hasCreatedAt : true;
    const needsUpdated = UPDATE_UPDATED_AT ? (MISSING_ONLY ? !hasUpdatedAt : true) : false;

    if (!needsCreated && !needsUpdated) continue;

    const update = {};
    if (needsCreated) update.createdAt = doc.createTime; // Firestore Timestamp
    if (needsUpdated) update.updatedAt = doc.updateTime; // Firestore Timestamp

    if (Object.keys(update).length === 0) continue;

    if (!DRY_RUN) batch.set(doc.ref, update, { merge: true });
    ops++;
    updated++;
    await commitIfNeeded();

    if (LIMIT > 0 && updated >= LIMIT) break;
  }

  await commitIfNeeded(true);
  console.log(`Done. ${updated} user(s) ${DRY_RUN ? 'would be ' : ''}updated with createdAt${UPDATE_UPDATED_AT ? ' and/or updatedAt' : ''}.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
