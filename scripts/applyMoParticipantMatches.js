/* eslint-disable no-console */
const fs = require('fs');
const os = require('os');
const path = require('path');
const admin = require('firebase-admin');

const argv = process.argv.slice(2);

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

const DRY_RUN = argv.includes('--dry-run');
const ONLY_ARG = (() => {
  const v = argv.find((a) => a.startsWith('--only='));
  return v ? v.split('=')[1] : '';
})();
const LIMIT = (() => {
  const v = argv.find((a) => a.startsWith('--limit='));
  if (!v) return 0;
  const n = Number(v.split('=')[1]);
  return Number.isFinite(n) ? n : 0;
})();
const SKIP_APPLIED = argv.includes('--skip-applied');

const SERVICE_ACCOUNT_FILES = {
  prod: 'serviceAccountKey.json',
  test: 'serviceAccountKeyTest.json'
};

const targetEnv = SERVICE_ACCOUNT_FILES[ENV_ARG] ? ENV_ARG : 'prod';
if (ENV_ARG && !SERVICE_ACCOUNT_FILES[ENV_ARG]) {
  console.warn(`Unknown --env value '${ENV_ARG}', defaulting to 'prod'.`);
}

const serviceAccountDir = path.join(os.homedir(), '.secrets', 'runners-hub');
const credentialFile = SERVICE_ACCOUNT_FILES[targetEnv];
const credentialPath = path.join(serviceAccountDir, credentialFile);

function loadServiceAccount() {
  if (!fs.existsSync(credentialPath)) {
    throw new Error(
      `Service account not found at ${credentialPath}. ` +
        'Please create it or adjust SERVICE_ACCOUNT_FILES mapping.'
    );
  }
  return JSON.parse(fs.readFileSync(credentialPath, 'utf-8'));
}

function initFirebase() {
  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert(loadServiceAccount())
    });
  }
  return admin.firestore();
}

async function fetchApprovedCandidates(db) {
  let q = db.collection('moMatchCandidates').where('status', '==', 'approved');
  if (ONLY_ARG) {
    q = q.where('matchType', '==', ONLY_ARG);
  }
  if (LIMIT > 0) {
    q = q.limit(LIMIT);
  }
  const snap = await q.get();
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

async function fetchParticipant(db, runnerKey) {
  const ref = db.collection('moParticipantStaging').doc(runnerKey);
  const snap = await ref.get();
  return snap.exists ? { id: snap.id, ...snap.data() } : null;
}

async function applyMatches() {
  console.log(`Environment: ${targetEnv}`);
  console.log(`Using credentials at: ${credentialPath}`);
  console.log(`Options: dryRun=${DRY_RUN} only='${ONLY_ARG || 'ANY'}' limit=${LIMIT || 'ALL'} skipApplied=${SKIP_APPLIED}`);

  const db = initFirebase();

  const candidates = await fetchApprovedCandidates(db);
  console.log(`Found ${candidates.length} approved candidate(s) to apply.`);

  let batch = db.batch();
  let ops = 0;
  let linkedCount = 0;
  const nowTs = admin.firestore.FieldValue.serverTimestamp();

  async function commitIfNeeded(force = false) {
    if (ops >= 400 || force) {
      if (DRY_RUN) {
        // simulate commit
      } else {
        await batch.commit();
      }
      batch = db.batch();
      ops = 0;
    }
  }

  for (const c of candidates) {
    const runnerKey = c.participantRunnerKey;
    if (!runnerKey) {
      console.warn(`[warn] Candidate ${c.id} missing participantRunnerKey`);
      continue;
    }

    if (SKIP_APPLIED && c.appliedAt) {
      console.log(`[skip] Candidate ${c.id} already applied at ${c.appliedAt}`);
      continue;
    }

    const participant = await fetchParticipant(db, runnerKey);
    if (!participant) {
      console.warn(`[warn] No participant staging for ${runnerKey}`);
      continue;
    }

    const docIds = Array.isArray(participant.sourceDocIds) ? participant.sourceDocIds : [];
    if (docIds.length === 0) {
      console.warn(`[warn] No sourceDocIds for ${runnerKey}`);
      continue;
    }

    let updatedDocs = 0;
    for (const docId of docIds) {
      const resRef = db.collection('moResults').doc(docId);
      const resSnap = await resRef.get();
      if (!resSnap.exists) {
        console.warn(`[warn] moResults/${docId} missing`);
        continue;
      }
      const data = resSnap.data() || {};
      if (data.userId && data.userId === c.userId) {
        // already linked to same user
      } else if (data.userId && data.userId !== c.userId) {
        console.warn(`[warn] moResults/${docId} already has userId ${data.userId}, skipping`);
        continue;
      }

      const update = {
        userId: c.userId,
        linkedVia: c.matchType || 'unknown',
        matchedAt: nowTs,
      };
      if (!DRY_RUN) batch.update(resRef, update);
      ops++;
      updatedDocs++;
      await commitIfNeeded();
    }

    if (updatedDocs > 0) {
      linkedCount += updatedDocs;
      const candRef = db.collection('moMatchCandidates').doc(c.id);
      const auditRef = db.collection('adminMoActions').doc();
      const auditDoc = {
        type: 'applyMatch',
        candidateId: c.id,
        runnerKey,
        userId: c.userId,
        count: updatedDocs,
        at: nowTs,
        env: targetEnv,
        only: ONLY_ARG || null,
      };
      if (!DRY_RUN) {
        batch.update(candRef, { appliedAt: nowTs, appliedDocCount: updatedDocs });
        ops++;
        await commitIfNeeded();
        batch.set(auditRef, auditDoc);
        ops++;
        await commitIfNeeded();
      } else {
        console.log(`[dry-run] Would update candidate ${c.id} and add audit record`, auditDoc);
      }
    }
  }

  await commitIfNeeded(true);
  console.log(`Done. Linked ${linkedCount} moResults document(s).`);
}

applyMatches().catch((err) => {
  console.error(err);
  process.exit(1);
});
