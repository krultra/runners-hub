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

const MIN_SCORE = (() => {
  const v = argv.find((a) => a.startsWith('--minScore='));
  if (!v) return 0.85;
  const n = Number(v.split('=')[1]);
  return Number.isFinite(n) ? n : 0.85;
})();

const LIMIT = (() => {
  const v = argv.find((a) => a.startsWith('--limit='));
  if (!v) return 0;
  const n = Number(v.split('=')[1]);
  return Number.isFinite(n) ? n : 0;
})();

const DRY_RUN = argv.includes('--dry-run');

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

function stripDiacritics(value) {
  if (!value) return value;
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function normalizePersonName(name) {
  if (!name) return null;
  return stripDiacritics(String(name))
    .toLowerCase()
    .replace(/[^a-z\s'-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokenizeName(name) {
  if (!name) return [];
  return name.split(' ').filter(Boolean);
}

function computeNameSimilarity(a, b) {
  const na = normalizePersonName(a);
  const nb = normalizePersonName(b);
  if (!na || !nb) return 0;
  if (na === nb) return 1;
  const as = new Set(tokenizeName(na));
  const bs = new Set(tokenizeName(nb));
  let overlap = 0;
  as.forEach((t) => { if (bs.has(t)) overlap += 1; });
  const ratio = overlap / Math.max(as.size, bs.size);
  if (ratio >= 0.9) return 0.95;
  if (ratio >= 0.75) return 0.85;
  if (ratio >= 0.6) return 0.7;
  return 0;
}

function normalizeEmail(email) {
  if (!email) return null;
  const v = String(email).trim().toLowerCase();
  return v || null;
}

async function fetchAllUsers(db) {
  const snap = await db.collection('users').get();
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

async function upsertCandidate(db, cand) {
  const id = `${cand.userAId}__${cand.userBId}`;
  const ref = db.collection('userDuplicateCandidates').doc(id);
  if (DRY_RUN) return;
  await ref.set({
    userAId: cand.userAId,
    userBId: cand.userBId,
    score: cand.score,
    nameSimilarity: cand.nameSimilarity,
    yobDiff: cand.yobDiff,
    emailsEqual: cand.emailsEqual,
    status: 'pending',
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  }, { merge: true });
}

async function main() {
  console.log(`Environment: ${targetEnv}`);
  console.log(`Using credentials at: ${credentialPath}`);
  console.log(`Options: dryRun=${DRY_RUN} minScore=${MIN_SCORE} limit=${LIMIT || 'ALL'}`);

  const db = initFirebase();
  const users = await fetchAllUsers(db);
  console.log(`Loaded ${users.length} users.`);

  const groups = new Map();
  users.forEach((u) => {
    const name = normalizePersonName(u.displayName || `${u.firstName || ''} ${u.lastName || ''}`);
    if (!name) return;
    const arr = groups.get(name) || [];
    arr.push(u);
    groups.set(name, arr);
  });

  const out = [];
  for (const [name, arr] of groups.entries()) {
    if (arr.length < 2) continue;
    for (let i = 0; i < arr.length; i++) {
      for (let j = i + 1; j < arr.length; j++) {
        const a = arr[i];
        const b = arr[j];
        const nameSim = computeNameSimilarity(a.displayName || `${a.firstName || ''} ${a.lastName || ''}`,
                                              b.displayName || `${b.firstName || ''} ${b.lastName || ''}`);
        if (nameSim === 0) continue;
        const ya = typeof a.yearOfBirth === 'number' ? a.yearOfBirth : null;
        const yb = typeof b.yearOfBirth === 'number' ? b.yearOfBirth : null;
        const yobDiff = (ya != null && yb != null) ? Math.abs(ya - yb) : null;
        const emailsEqual = (() => {
          const ea = normalizeEmail(a.email);
          const eb = normalizeEmail(b.email);
          return !!(ea && eb && ea === eb);
        })();
        if (emailsEqual) continue;
        let score = nameSim;
        if (yobDiff != null) {
          if (yobDiff === 0) score += 0.05;
          else if (yobDiff === 1) score += 0.02;
          else if (yobDiff > 2) score -= 0.2;
        }
        score = Math.max(0, Math.min(score, 1));
        if (score < MIN_SCORE) continue;
        const cand = {
          userAId: a.id,
          userBId: b.id,
          score,
          nameSimilarity: nameSim,
          yobDiff,
          emailsEqual,
        };
        out.push(cand);
        if (!DRY_RUN) await upsertCandidate(db, cand);
        if (LIMIT > 0 && out.length >= LIMIT) break;
      }
      if (LIMIT > 0 && out.length >= LIMIT) break;
    }
    if (LIMIT > 0 && out.length >= LIMIT) break;
  }

  const outDir = path.join(process.cwd(), 'tmp');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, 'userDuplicateCandidates.json');
  fs.writeFileSync(outPath, JSON.stringify(out, null, 2));
  console.log(`Wrote ${out.length} candidate pair(s) to ${outPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
