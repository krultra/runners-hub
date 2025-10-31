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

function normalizeEmail(email) {
  if (!email) return null;
  const v = String(email).trim().toLowerCase();
  return v || null;
}

function combineNameParts(...parts) {
  return parts
    .map((p) => (typeof p === 'string' ? p.trim() : ''))
    .filter(Boolean)
    .join(' ');
}

async function fetchAllUsers(db) {
  const snap = await db.collection('users').get();
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

async function main() {
  console.log(`Environment: ${targetEnv}`);
  console.log(`Using credentials at: ${credentialPath}`);

  const db = initFirebase();
  const users = await fetchAllUsers(db);
  console.log(`Loaded ${users.length} users.`);

  const byEmail = new Map();
  const byName = new Map();
  const byNameYob = new Map();

  users.forEach((u) => {
    const email = normalizeEmail(u.email);
    const name = normalizePersonName(u.displayName || combineNameParts(u.firstName, u.lastName));
    const yob = typeof u.yearOfBirth === 'number' ? u.yearOfBirth : null;

    if (email) {
      const list = byEmail.get(email) || [];
      list.push(u);
      byEmail.set(email, list);
    }
    if (name) {
      const list = byName.get(name) || [];
      list.push(u);
      byName.set(name, list);
      if (yob != null) {
        const key = `${name}|${yob}`;
        const list2 = byNameYob.get(key) || [];
        list2.push(u);
        byNameYob.set(key, list2);
      }
    }
  });

  const emailDupes = [];
  for (const [email, list] of byEmail.entries()) {
    if (list.length > 1) {
      emailDupes.push({ email, count: list.length, users: list.map((u) => ({ id: u.id, displayName: u.displayName, firstName: u.firstName, lastName: u.lastName, yearOfBirth: u.yearOfBirth })) });
    }
  }

  const nameDupes = [];
  for (const [name, list] of byName.entries()) {
    if (list.length > 1) {
      const yobs = Array.from(new Set(list.map((u) => (typeof u.yearOfBirth === 'number' ? u.yearOfBirth : null))));
      nameDupes.push({ name, count: list.length, distinctYobs: yobs, users: list.map((u) => ({ id: u.id, displayName: u.displayName, firstName: u.firstName, lastName: u.lastName, yearOfBirth: u.yearOfBirth, email: u.email || null })) });
    }
  }

  const report = { emailDupes, nameDupes };
  const outDir = path.join(process.cwd(), 'tmp');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, 'duplicateUsersReport.json');
  fs.writeFileSync(outPath, JSON.stringify(report, null, 2));
  console.log(`Wrote duplicate report to ${outPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
