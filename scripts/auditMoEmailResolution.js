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

const hasFlag = (flag) => argv.includes(flag);

const ENV_ARG = getArgValue('--env', 'prod').toLowerCase();
const OUTPUT_ARG = getArgValue('--output', path.join(process.cwd(), 'tmp', 'moEmailResolutionIssues.json'));
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
      credential: admin.credential.cert(loadServiceAccount())
    });
  }
  return admin.firestore();
}

const looksLikeEmail = (value) => {
  if (typeof value !== 'string') return false;
  const trimmed = value.trim();
  if (!trimmed) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed.toLowerCase());
};

const sanitizeId = (value) => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.includes('@') ? null : trimmed;
};

const normalizeString = (value) => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const resolveCanonicalUserId = (docId, data = {}) => {
  const candidates = [data.uid, data.userId, docId];
  for (const candidate of candidates) {
    const sanitized = sanitizeId(candidate);
    if (sanitized) {
      return { value: sanitized, source: candidate === docId ? 'docId' : candidate === data.uid ? 'uid' : 'userId' };
    }
  }
  return { value: null, source: null };
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
  const queryBuilder = db.collection('moResults').where('userResolution', '==', 'email+name');
  const snapshot = SCAN_LIMIT > 0 ? await queryBuilder.limit(SCAN_LIMIT).get() : await queryBuilder.get();

  console.log(`[audit] Retrieved ${snapshot.size} moResults document(s) with userResolution="email+name".`);

  const issues = [];
  let flaggedCount = 0;
  const userCache = new Map();

  const fetchUserInfo = async (userId) => {
    if (!userId) return { exists: false, docId: null, data: null, lookup: 'none' };
    if (userCache.has(userId)) {
      return userCache.get(userId);
    }

    let docSnap = await db.collection('users').doc(userId).get();
    let lookup = 'docId';

    if (!docSnap.exists) {
      const candidates = [];
      if (looksLikeEmail(userId)) {
        candidates.push({ field: 'email', value: userId.toLowerCase(), label: 'emailQuery' });
      }
      candidates.push({ field: 'uid', value: userId, label: 'uidQuery' });
      candidates.push({ field: 'userId', value: userId, label: 'userIdQuery' });

      for (const candidate of candidates) {
        const querySnap = await db.collection('users').where(candidate.field, '==', candidate.value).limit(1).get();
        if (!querySnap.empty) {
          docSnap = querySnap.docs[0];
          lookup = candidate.label;
          break;
        }
      }
    }

    const result = {
      exists: docSnap.exists,
      docId: docSnap.exists ? docSnap.id : null,
      data: docSnap.exists ? docSnap.data() : null,
      lookup: docSnap.exists ? lookup : 'none'
    };
    userCache.set(userId, result);
    return result;
  };

  for (const doc of snapshot.docs) {
    const data = doc.data() || {};
    const userIdRaw = data.userId ?? null;
    const userId = normalizeString(typeof userIdRaw === 'string' ? userIdRaw : null);
    const issueFlags = {
      missingUserId: false,
      userIdLooksLikeEmail: false,
      userDocMissing: false,
      canonicalMismatch: false
    };

    if (!userId) {
      issueFlags.missingUserId = true;
    }

    const looksEmail = userId ? looksLikeEmail(userId) : false;
    if (looksEmail) {
      issueFlags.userIdLooksLikeEmail = true;
    }

    let userInfo = { exists: false, docId: null, data: null, lookup: 'none' };
    let canonical = { value: null, source: null };

    if (userId) {
      userInfo = await fetchUserInfo(userId);
      if (!userInfo.exists) {
        issueFlags.userDocMissing = true;
      } else {
        canonical = resolveCanonicalUserId(userInfo.docId, userInfo.data);
        if (canonical.value && canonical.value !== userId) {
          issueFlags.canonicalMismatch = true;
        }
      }
    }

    const shouldFlag = issueFlags.missingUserId || issueFlags.userIdLooksLikeEmail || issueFlags.userDocMissing || issueFlags.canonicalMismatch;

    if (shouldFlag) {
      flaggedCount += 1;
      if (LIMIT === 0 || issues.length < LIMIT) {
        issues.push({
          docId: doc.id,
          editionId: data.editionId ?? null,
          editionYear: data.editionYear ?? null,
          fullName: data.fullName ?? null,
          class: data.class ?? null,
          status: data.status ?? null,
          userId: userId ?? null,
          userResolution: data.userResolution ?? null,
          flags: issueFlags,
          userDoc: {
            lookup: userInfo.lookup,
            docId: userInfo.docId,
            uid: userInfo.data?.uid ?? null,
            userIdField: userInfo.data?.userId ?? null,
            email: userInfo.data?.email ?? null
          },
          canonicalUserId: canonical.value,
          canonicalSource: canonical.source
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
    totalDocumentsScanned: snapshot.size,
    flaggedCount,
    limitApplied: LIMIT,
    issues
  };

  fs.writeFileSync(OUTPUT_ARG, JSON.stringify(payload, null, 2));
  console.log(`[audit] Flagged ${flaggedCount} document(s). Report written to ${OUTPUT_ARG} (showing ${issues.length}${LIMIT > 0 ? ` of limit ${LIMIT}` : ''}).`);
}

main().catch((err) => {
  console.error('[audit] Failed:', err);
  process.exit(1);
});
