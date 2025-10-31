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
const OVERRIDES_PATH = (() => {
  const v = argv.find((a) => a.startsWith('--overrides='));
  return v ? v.split('=')[1] : '';
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

function splitName(fullName, raw) {
  const first = raw?.firstName && String(raw.firstName).trim();
  const last = raw?.lastName && String(raw.lastName).trim();
  if (first || last) return { firstName: first || '', lastName: last || '' };
  const name = (fullName || '').trim();
  if (!name) return { firstName: '', lastName: '' };
  const parts = name.split(/\s+/);
  if (parts.length === 1) return { firstName: parts[0], lastName: '' };
  return { firstName: parts.slice(0, -1).join(' '), lastName: parts.slice(-1)[0] };
}

async function fetchParticipants(db) {
  const snap = await db.collection('moParticipantStaging').get();
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

async function fetchMoResult(db, id) {
  const ref = db.collection('moResults').doc(id);
  const snap = await ref.get();
  return snap.exists ? { id: snap.id, ...snap.data() } : null;
}

async function fetchAllUsers(db) {
  const snap = await db.collection('users').get();
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

function buildUserIndices(users) {
  const byEmail = new Map();
  const byNameYear = new Map();
  const byName = new Map();

  users.forEach((u) => {
    const email = normalizeEmail(u.email);
    if (email && !byEmail.has(email)) byEmail.set(email, u.id);

    const name = normalizePersonName(u.displayName || combineNameParts(u.firstName, u.lastName));
    const yob = typeof u.yearOfBirth === 'number' ? u.yearOfBirth : null;
    if (name) {
      if (yob != null) {
        const key = `${name}|${yob}`;
        if (!byNameYear.has(key)) byNameYear.set(key, u.id);
      }
      const list = byName.get(name) || [];
      list.push(u.id);
      byName.set(name, list);
    }
  });

  return { byEmail, byNameYear, byName };
}

function loadOverrides(filePath) {
  if (!filePath) return new Map();
  const abs = path.resolve(process.cwd(), filePath);
  if (!fs.existsSync(abs)) {
    console.warn(`[overrides] File not found at ${abs}; continuing without overrides.`);
    return new Map();
  }
  try {
    const raw = JSON.parse(fs.readFileSync(abs, 'utf-8'));
    const map = new Map();
    if (Array.isArray(raw)) {
      raw.forEach((r) => {
        if (r && r.runnerKey && r.userId) map.set(String(r.runnerKey), String(r.userId));
      });
    } else if (raw && typeof raw === 'object') {
      Object.entries(raw).forEach(([k, v]) => {
        if (v) map.set(String(k), String(v));
      });
    }
    console.log(`[overrides] Loaded ${map.size} runnerKey -> userId mapping(s) from ${abs}`);
    return map;
  } catch (e) {
    console.warn(`[overrides] Failed to parse overrides at ${abs}:`, e.message);
    return new Map();
  }
}

async function createUser(db, participant) {
  const users = db.collection('users');
  const ref = users.doc();
  const { firstName, lastName } = splitName(participant.fullName || participant.displayName || '', participant.raw || {});
  const payload = {
    firstName,
    lastName,
    displayName: (participant.displayName || participant.fullName || '').trim() || undefined,
    email: participant.email || null,
    yearOfBirth: participant.yearOfBirth ?? null,
    gender: participant.gender ?? null,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  };
  if (!DRY_RUN) await ref.set(payload, { merge: true });
  return ref.id;
}

async function linkMoResults(db, userId, docIds, matchType) {
  let batch = db.batch();
  let ops = 0;
  async function commitIfNeeded(force = false) {
    if (ops >= 400 || force) {
      if (!DRY_RUN) await batch.commit();
      batch = db.batch();
      ops = 0;
    }
  }
  for (const id of docIds) {
    const ref = db.collection('moResults').doc(id);
    const update = {
      userId,
      linkedVia: matchType,
      matchedAt: admin.firestore.FieldValue.serverTimestamp(),
    };
    if (!DRY_RUN) batch.update(ref, update);
    ops++;
    await commitIfNeeded();
  }
  await commitIfNeeded(true);
}

async function main() {
  console.log(`Environment: ${targetEnv}`);
  console.log(`Using credentials at: ${credentialPath}`);
  console.log(`Options: dryRun=${DRY_RUN} limit=${LIMIT || 'ALL'}`);

  const db = initFirebase();
  const participants = await fetchParticipants(db);
  console.log(`Loaded ${participants.length} staged participants.`);

  const users = await fetchAllUsers(db);
  console.log(`Loaded ${users.length} existing users.`);
  const indices = buildUserIndices(users);
  const overrides = loadOverrides(OVERRIDES_PATH);

  let created = 0;
  let processed = 0;
  let linkedExisting = 0;

  for (const p of participants) {
    const docIds = Array.isArray(p.sourceDocIds) ? p.sourceDocIds : [];
    if (docIds.length === 0) continue;

    let alreadyLinkedUser = null;
    for (const rid of docIds) {
      const res = await fetchMoResult(db, rid);
      if (res?.userId) {
        alreadyLinkedUser = res.userId;
        break;
      }
    }

    if (alreadyLinkedUser) {
      processed += 1;
      continue;
    }

    // Try to find an existing user to avoid duplicates
    let existingUserId = null;
    let existingMatchType = null;

    // 1) Manual override mapping by runnerKey
    if (overrides.has(p.runnerKey)) {
      existingUserId = overrides.get(p.runnerKey);
      existingMatchType = 'override';
    }

    const normEmail = normalizeEmail(p.email);
    if (!existingUserId && normEmail && indices.byEmail.has(normEmail)) {
      existingUserId = indices.byEmail.get(normEmail);
      existingMatchType = 'existing_email';
    } else if (!existingUserId) {
      const normName = normalizePersonName(p.fullName || p.displayName);
      const yob = typeof p.yearOfBirth === 'number' ? p.yearOfBirth : null;
      if (normName && yob != null) {
        const key = `${normName}|${yob}`;
        if (indices.byNameYear.has(key)) {
          existingUserId = indices.byNameYear.get(key);
          existingMatchType = 'existing_name_yob';
        }
      }
      // 3) Unique name-only exact match fallback
      if (!existingUserId && normName && indices.byName.has(normName)) {
        const list = indices.byName.get(normName) || [];
        if (list.length === 1) {
          existingUserId = list[0];
          existingMatchType = 'existing_name_unique';
        }
      }
    }

    if (existingUserId) {
      await linkMoResults(db, existingUserId, docIds, existingMatchType);
      linkedExisting += 1;
      processed += 1;
      console.log(`[matched-existing] users/${existingUserId} linked to ${docIds.length} moResults docs for ${p.runnerKey} via ${existingMatchType}`);
      continue;
    }

    const canCreate = LIMIT === 0 || created < LIMIT;
    if (!canCreate) {
      console.log(`[skip-create] Limit reached for creating new users. Skipping ${p.runnerKey}`);
      processed += 1;
      continue;
    }

    const userId = await createUser(db, p);
    await linkMoResults(db, userId, docIds, 'created_from_mo');
    created += 1;
    processed += 1;
    console.log(`[created] users/${userId} linked to ${docIds.length} moResults docs for ${p.runnerKey}`);
  }

  console.log(`Done. Created ${created} new user(s). Linked to ${linkedExisting} existing user(s). Processed ${processed} participant(s).`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
