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
const LIMIT = (() => {
  const v = argv.find((a) => a.startsWith('--limit='));
  if (!v) return 0;
  const n = Number(v.split('=')[1]);
  return Number.isFinite(n) ? n : 0;
})();
const COLLECTIONS_ARG = (() => {
  const v = argv.find((a) => a.startsWith('--collections='));
  return v ? v.split('=')[1] : 'moResults,moRegistrations,registrations';
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

async function fetchApprovedCandidates(db) {
  let q = db.collection('userDuplicateCandidates').where('status', '==', 'approved');
  if (LIMIT > 0) q = q.limit(LIMIT);
  const snap = await q.get();
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
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

async function mergeUserDocs(db, targetId, sourceId) {
  const targetRef = db.collection('users').doc(targetId);
  const targetSnap = await targetRef.get();
  if (!targetSnap.exists) throw new Error(`Target user ${targetId} does not exist`);
  const target = targetSnap.data() || {};

  const srcSnap = await db.collection('users').doc(sourceId).get();
  if (!srcSnap.exists) return;
  const src = srcSnap.data() || {};

  const aggregate = { ...target };
  if (!aggregate.displayName && src.displayName) aggregate.displayName = src.displayName;
  if (!aggregate.firstName && src.firstName) aggregate.firstName = src.firstName;
  if (!aggregate.lastName && src.lastName) aggregate.lastName = src.lastName;
  if (!aggregate.email && src.email) aggregate.email = src.email;
  if ((aggregate.yearOfBirth == null || aggregate.yearOfBirth === '') && (src.yearOfBirth != null && src.yearOfBirth !== '')) aggregate.yearOfBirth = src.yearOfBirth;
  if (!aggregate.gender && src.gender) aggregate.gender = src.gender;

  aggregate.updatedAt = admin.firestore.FieldValue.serverTimestamp();
  aggregate.mergedFrom = Array.from(new Set([...(Array.isArray(target.mergedFrom) ? target.mergedFrom : []), sourceId]));

  if (!DRY_RUN) await targetRef.set(aggregate, { merge: true });
}

async function deleteUser(db, userId) {
  if (DRY_RUN) return;
  await db.collection('users').doc(userId).delete();
}

async function main() {
  console.log(`Environment: ${targetEnv}`);
  console.log(`Using credentials at: ${credentialPath}`);
  console.log(`Options: dryRun=${DRY_RUN} limit=${LIMIT || 'ALL'} collections=${COLLECTIONS_ARG} deleteSources=${DELETE_SOURCES}`);

  const db = initFirebase();
  const candidates = await fetchApprovedCandidates(db);
  console.log(`Found ${candidates.length} approved candidate(s).`);

  const collections = COLLECTIONS_ARG.split(',').map((s) => s.trim()).filter(Boolean);

  for (const c of candidates) {
    const targetUserId = c.targetUserId;
    const sourceUserId = c.sourceUserId;
    if (!targetUserId || !sourceUserId) {
      console.warn(`[warn] Candidate ${c.id} missing target/source; skipping`);
      continue;
    }

    console.log(`\n[apply] ${sourceUserId} -> ${targetUserId}`);

    // Update references
    let totalUpdates = 0;
    for (const coll of collections) {
      const updated = await updateCollectionUserIds(db, coll, sourceUserId, targetUserId);
      totalUpdates += updated;
    }

    // Merge fields
    await mergeUserDocs(db, targetUserId, sourceUserId);

    // Audit + mark applied
    const nowTs = admin.firestore.FieldValue.serverTimestamp();
    if (!DRY_RUN) {
      await db.collection('adminMoActions').add({
        type: 'applyUserMerge',
        candidateId: c.id,
        targetUserId,
        sourceUserId,
        collections,
        updatedRefs: totalUpdates,
        at: nowTs,
        env: targetEnv,
      });
      await db.collection('userDuplicateCandidates').doc(c.id).set({
        status: 'applied',
        appliedAt: nowTs,
        appliedDocCount: totalUpdates,
      }, { merge: true });
    } else {
      console.log(`[dry-run] Would mark candidate ${c.id} applied and write audit, updatedRefs=${totalUpdates}`);
    }

    // Delete source
    if (DELETE_SOURCES) {
      if (!DRY_RUN) await deleteUser(db, sourceUserId);
      console.log(`[deleted] source user ${sourceUserId}`);
    }
  }

  console.log('\nAll approved merges processed.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
