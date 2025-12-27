/* eslint-disable no-console */
const admin = require('firebase-admin');
const path = require('path');
const os = require('os');

const argv = process.argv.slice(2);

const DRY_RUN = argv.includes('--dry-run');
const ENV_ARG = (() => {
  const explicit = argv.find((arg) => arg.startsWith('--env='));
  if (explicit) {
    return explicit.split('=')[1]?.trim().toLowerCase() || 'prod';
  }
  if (argv.includes('--test')) return 'test';
  return 'prod';
})();

const ONLY = (() => {
  const v = argv.find((a) => a.startsWith('--only='));
  return v ? v.split('=')[1]?.trim().toLowerCase() : '';
})();

const LIMIT = (() => {
  const v = argv.find((a) => a.startsWith('--limit='));
  if (!v) return 0;
  const n = Number(v.split('=')[1]);
  return Number.isFinite(n) ? n : 0;
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
  credential: admin.credential.cert(require(credentialPath))
});

const db = admin.firestore();

const normalizeString = (value) => String(value ?? '').trim();

const toBoolean = (value) => Boolean(value);

const toNumberOrZero = (value) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};

const toNumberOrNull = (value) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
};

async function resolvePersonIdFromUserId(userId) {
  const id = normalizeString(userId);
  if (!id) return null;

  let userSnap = await db.collection('users').doc(id).get();
  if (!userSnap.exists) {
    const qUid = await db.collection('users').where('uid', '==', id).limit(1).get();
    if (!qUid.empty) {
      userSnap = qUid.docs[0];
    } else {
      const qLegacy = await db.collection('users').where('userId', '==', id).limit(1).get();
      if (!qLegacy.empty) {
        userSnap = qLegacy.docs[0];
      }
    }
  }

  if (!userSnap.exists) return null;
  return toNumberOrNull((userSnap.data() || {}).personId);
}

async function resolvePersonId(data, docId) {
  const fromDocId = toNumberOrNull(docId);
  if (fromDocId != null) return fromDocId;
  const direct = toNumberOrNull(data?.personId);
  if (direct != null) return direct;
  return resolvePersonIdFromUserId(data?.userId);
}

const extractBirthYear = (value) => {
  if (value == null) return null;

  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }

  if (value instanceof Date) {
    const y = value.getFullYear();
    return Number.isFinite(y) ? y : null;
  }

  if (typeof value.toDate === 'function') {
    const d = value.toDate();
    if (d instanceof Date) {
      const y = d.getFullYear();
      return Number.isFinite(y) ? y : null;
    }
  }

  const raw = String(value).trim();
  if (!raw) return null;

  const match = raw.match(/(\d{4})/);
  if (!match) return null;
  const year = Number(match[1]);
  return Number.isFinite(year) ? year : null;
};

const mapPublicRegistration = (data, personId) => {
  return {
    editionId: normalizeString(data.editionId),
    registrationNumber: toNumberOrZero(data.registrationNumber),
    personId: personId ?? null,
    firstName: normalizeString(data.firstName),
    lastName: normalizeString(data.lastName),
    nationality: normalizeString(data.nationality),
    representing: normalizeString(data.representing),
    raceDistance: normalizeString(data.raceDistance),
    status: normalizeString(data.status),
    isOnWaitinglist: toBoolean(data.isOnWaitinglist),
    waitinglistExpires: data.waitinglistExpires ?? null,
    bib: data.bib ?? null,
    updatedAt: data.updatedAt ?? null
  };
};

async function backfillCollection({
  sourceCollection,
  targetCollection,
  map,
}) {
  console.log(`\n[backfill] ${sourceCollection} -> ${targetCollection}`);

  const FieldPath = admin.firestore.FieldPath;
  let lastDoc = null;
  let processed = 0;
  let written = 0;

  let batch = db.batch();
  let ops = 0;

  const commitBatch = async (force = false) => {
    if (ops >= 400 || force) {
      if (!DRY_RUN) {
        await batch.commit();
      }
      batch = db.batch();
      ops = 0;
    }
  };

  while (true) {
    let q = db.collection(sourceCollection).orderBy(FieldPath.documentId()).limit(500);
    if (lastDoc) q = q.startAfter(lastDoc);

    const snap = await q.get();
    if (snap.empty) break;

    for (const doc of snap.docs) {
      const data = doc.data() || {};
      const personId = await resolvePersonId(data, doc.id);
      const payload = map(data, personId);

      if (!payload.editionId) {
        processed++;
        if (LIMIT > 0 && processed >= LIMIT) {
          await commitBatch(true);
          console.log(`[backfill] hit limit=${LIMIT}; stopping.`);
          return { processed, written };
        }
        continue;
      }

      if (!DRY_RUN) {
        batch.set(db.collection(targetCollection).doc(doc.id), payload, { merge: true });
      }
      ops++;
      written++;
      processed++;

      await commitBatch();

      if (LIMIT > 0 && processed >= LIMIT) {
        await commitBatch(true);
        console.log(`[backfill] hit limit=${LIMIT}; stopping.`);
        return { processed, written };
      }
    }

    lastDoc = snap.docs[snap.docs.length - 1];
  }

  await commitBatch(true);
  return { processed, written };
}

async function main() {
  console.log(`Environment: ${targetEnv}`);
  console.log(`Using credentials at: ${credentialPath}`);
  console.log(`Options: dryRun=${DRY_RUN} limit=${LIMIT || 'ALL'} only=${ONLY || 'both'}`);

  const doRegs = ONLY === '' || ONLY === 'both' || ONLY === 'registrations' || ONLY === 'reg';

  if (!doRegs) {
    throw new Error(`Unknown --only value '${ONLY}'. Use 'registrations' (or omit).`);
  }

  let totalWritten = 0;

  if (doRegs) {
    const res = await backfillCollection({
      sourceCollection: 'registrations',
      targetCollection: 'publicRegistrations',
      map: mapPublicRegistration,
    });
    console.log(`[backfill] registrations processed=${res.processed} projected=${res.written}${DRY_RUN ? ' (dry-run)' : ''}`);
    totalWritten += res.written;
  }

  console.log(`\nDone. Total projected docs: ${totalWritten}${DRY_RUN ? ' (dry-run)' : ''}.`);
}

main().catch((err) => {
  console.error('Backfill failed:', err);
  process.exit(1);
});
