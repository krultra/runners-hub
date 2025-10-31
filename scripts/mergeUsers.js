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
const DELETE_SOURCES = argv.includes('--no-delete') ? false : true;
const FILE_ARG = (() => {
  const v = argv.find((a) => a.startsWith('--file='));
  return v ? v.split('=')[1] : '';
})();
const COLLECTIONS_ARG = (() => {
  const v = argv.find((a) => a.startsWith('--collections='));
  return v ? v.split('=')[1] : 'moResults';
})();

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

function readMerges(filePath) {
  if (!filePath) throw new Error('Missing --file=<path-to-merges.json>');
  const abs = path.resolve(process.cwd(), filePath);
  if (!fs.existsSync(abs)) throw new Error(`Merges file not found at ${abs}`);
  const raw = JSON.parse(fs.readFileSync(abs, 'utf-8'));
  if (!Array.isArray(raw)) throw new Error('Merges file must be an array');
  return raw.map((m) => {
    if (!m || !m.targetUserId || !Array.isArray(m.sourceUserIds) || m.sourceUserIds.length === 0) {
      throw new Error('Each merge item must have targetUserId and non-empty sourceUserIds');
    }
    return { targetUserId: String(m.targetUserId), sourceUserIds: m.sourceUserIds.map(String) };
  });
}

async function updateCollectionUserIds(db, collectionName, sourceId, targetId) {
  const ref = db.collection(collectionName);
  const snap = await ref.where('userId', '==', sourceId).get();
  if (snap.empty) return 0;

  let batch = db.batch();
  let ops = 0;
  const nowTs = admin.firestore.FieldValue.serverTimestamp();

  async function commitIfNeeded(force = false) {
    if (ops >= 400 || force) {
      if (!DRY_RUN) await batch.commit();
      batch = db.batch();
      ops = 0;
    }
  }

  let count = 0;
  snap.forEach((doc) => {
    const update = { userId: targetId, mergedAt: nowTs };
    if (collectionName === 'moResults') update.linkedVia = 'merged';
    if (!DRY_RUN) batch.update(doc.ref, update);
    ops++;
    count++;
  });

  await commitIfNeeded(true);
  return count;
}

async function mergeUserDocs(db, targetId, sourceIds) {
  const targetRef = db.collection('users').doc(targetId);
  const targetSnap = await targetRef.get();
  if (!targetSnap.exists) throw new Error(`Target user ${targetId} does not exist`);
  const target = targetSnap.data() || {};

  // Merge fields conservatively: keep target values; fill missing from sources
  const aggregate = { ...target };
  for (const sid of sourceIds) {
    const srcSnap = await db.collection('users').doc(sid).get();
    if (!srcSnap.exists) continue;
    const src = srcSnap.data() || {};
    if (!aggregate.displayName && src.displayName) aggregate.displayName = src.displayName;
    if (!aggregate.firstName && src.firstName) aggregate.firstName = src.firstName;
    if (!aggregate.lastName && src.lastName) aggregate.lastName = src.lastName;
    if (!aggregate.email && src.email) aggregate.email = src.email;
    if ((aggregate.yearOfBirth == null || aggregate.yearOfBirth === '') && (src.yearOfBirth != null && src.yearOfBirth !== '')) aggregate.yearOfBirth = src.yearOfBirth;
    if (!aggregate.gender && src.gender) aggregate.gender = src.gender;
  }

  aggregate.updatedAt = admin.firestore.FieldValue.serverTimestamp();
  aggregate.mergedFrom = Array.from(new Set([...(Array.isArray(target.mergedFrom) ? target.mergedFrom : []), ...sourceIds]));

  if (!DRY_RUN) await targetRef.set(aggregate, { merge: true });
}

async function deleteUsers(db, sourceIds) {
  let batch = db.batch();
  let ops = 0;
  async function commitIfNeeded(force = false) {
    if (ops >= 400 || force) {
      if (!DRY_RUN) await batch.commit();
      batch = db.batch();
      ops = 0;
    }
  }
  for (const sid of sourceIds) {
    const ref = db.collection('users').doc(sid);
    if (!DRY_RUN) batch.delete(ref);
    ops++;
    await commitIfNeeded();
  }
  await commitIfNeeded(true);
}

async function main() {
  console.log(`Environment: ${targetEnv}`);
  console.log(`Using credentials at: ${credentialPath}`);
  console.log(`Options: dryRun=${DRY_RUN} deleteSources=${DELETE_SOURCES} collections=${COLLECTIONS_ARG}`);

  const db = initFirebase();
  const merges = readMerges(FILE_ARG);
  console.log(`Loaded ${merges.length} merge group(s).`);

  const collections = COLLECTIONS_ARG.split(',').map((s) => s.trim()).filter(Boolean);

  for (const merge of merges) {
    const { targetUserId, sourceUserIds } = merge;
    console.log(`\n[merge] target=${targetUserId} sources=${sourceUserIds.join(',')}`);

    // Update references in collections
    let totalUpdates = 0;
    for (const coll of collections) {
      const updated = await updateCollectionUserIds(db, coll, sourceUserIds[0], targetUserId); // will repeat per source below
      totalUpdates += updated;
    }
    // Repeat for remaining sources
    for (let i = 1; i < sourceUserIds.length; i++) {
      for (const coll of collections) {
        const updated = await updateCollectionUserIds(db, coll, sourceUserIds[i], targetUserId);
        totalUpdates += updated;
      }
    }

    // Merge user documents
    await mergeUserDocs(db, targetUserId, sourceUserIds);

    // Audit
    const auditRef = db.collection('adminMoActions').doc();
    const auditDoc = {
      type: 'mergeUsers',
      targetUserId,
      sourceUserIds,
      collections,
      updatedRefs: totalUpdates,
      env: targetEnv,
      at: admin.firestore.FieldValue.serverTimestamp(),
      dryRun: DRY_RUN,
    };
    if (!DRY_RUN) await auditRef.set(auditDoc);

    // Delete sources
    if (DELETE_SOURCES) {
      await deleteUsers(db, sourceUserIds);
    }

    console.log(`[done] merged into ${targetUserId}, updated refs: ${totalUpdates}, deleted sources: ${DELETE_SOURCES ? sourceUserIds.length : 0}`);
  }

  console.log('\nAll merges processed.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
