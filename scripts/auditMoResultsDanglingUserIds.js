/* eslint-disable no-console */
const fs = require('fs');
const os = require('os');
const path = require('path');
const admin = require('firebase-admin');

const argv = process.argv.slice(2);

const getArgValue = (prefix, fallback) => {
  const match = argv.find((arg) => arg.startsWith(`${prefix}=`));
  if (!match) return fallback;
  const [, value] = match.split('=');
  return value ?? fallback;
};

const ENV_ARG = getArgValue('--env', 'prod').toLowerCase();
const OUTPUT_ARG = getArgValue('--output', path.join(process.cwd(), 'tmp', 'moResultsDanglingUserIds.json'));
const LIMIT = Number.parseInt(getArgValue('--limit', '0'), 10);
const SCAN_LIMIT = Number.parseInt(getArgValue('--scanLimit', '0'), 10);

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
    admin.initializeApp({
      credential: admin.credential.cert(loadServiceAccount()),
    });
  }
  return admin.firestore();
}

const normalizeUserId = (value) => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

async function main() {
  console.log(`[audit] Environment: ${targetEnv}`);
  console.log(`[audit] Using credentials at: ${credentialPath}`);
  console.log(`[audit] Output: ${OUTPUT_ARG}`);
  if (LIMIT > 0) {
    console.log(`[audit] Reporting limit: ${LIMIT}`);
  }
  if (SCAN_LIMIT > 0) {
    console.log(`[audit] Scan limit: ${SCAN_LIMIT}`);
  }

  const db = initFirebase();
  const queryBuilder = db.collection('moResults');
  const snapshot = SCAN_LIMIT > 0 ? await queryBuilder.limit(SCAN_LIMIT).get() : await queryBuilder.get();

  console.log(`[audit] Retrieved ${snapshot.size} moResults document(s) for analysis.`);

  const issues = [];
  const seen = new Map();
  const summary = {
    totalResults: snapshot.size,
    uniqueUserIdsChecked: 0,
    flaggedUserIds: 0,
  };

  const checkUserId = async (userId) => {
    if (seen.has(userId)) {
      return seen.get(userId);
    }

    const userDoc = await db.collection('users').doc(userId).get();
    if (userDoc.exists) {
      const result = { linked: true, method: 'docId', matchedDocId: userDoc.id };
      seen.set(userId, result);
      return result;
    }

    const uidSnap = await db.collection('users').where('uid', '==', userId).limit(1).get();
    if (!uidSnap.empty) {
      const result = { linked: true, method: 'uid', matchedDocId: uidSnap.docs[0].id };
      seen.set(userId, result);
      return result;
    }

    const result = { linked: false, method: 'none', matchedDocId: null };
    seen.set(userId, result);
    return result;
  };

  for (const doc of snapshot.docs) {
    const data = doc.data() || {};
    const userId = normalizeUserId(data.userId);
    if (!userId) {
      continue;
    }

    if (!seen.has(userId)) {
      summary.uniqueUserIdsChecked += 1;
    }

    const linkage = await checkUserId(userId);
    if (!linkage.linked) {
      summary.flaggedUserIds += 1;
      if (LIMIT === 0 || issues.length < LIMIT) {
        issues.push({
          resultId: doc.id,
          editionId: data.editionId ?? null,
          editionYear: data.editionYear ?? null,
          fullName: data.fullName ?? null,
          userId,
          status: data.status ?? null,
          notes: 'userId not found in users collection by docId or uid field',
        });
      }
    }
  }

  const outputDir = path.dirname(OUTPUT_ARG);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const payload = {
    generatedAt: new Date().toISOString(),
    environment: targetEnv,
    limitApplied: LIMIT,
    scanLimitApplied: SCAN_LIMIT,
    summary,
    issues,
  };

  fs.writeFileSync(OUTPUT_ARG, JSON.stringify(payload, null, 2));
  console.log(`[audit] Found ${summary.flaggedUserIds} userId(s) without matching user docs. Report written to ${OUTPUT_ARG} (showing ${issues.length}${LIMIT > 0 ? ` of limit ${LIMIT}` : ''}).`);
}

main().catch((err) => {
  console.error('[audit] Failed:', err);
  process.exit(1);
});
