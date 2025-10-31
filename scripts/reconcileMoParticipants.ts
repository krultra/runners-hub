/* eslint-disable no-console */
const fs = require('fs');
const os = require('os');
const path = require('path');
const admin = require('firebase-admin');

/**
 * @typedef {Object} ParticipantRecord
 * @property {string} runnerKey
 * @property {string} fullName
 * @property {string} displayName
 * @property {string} nameSource
 * @property {number|null} yearOfBirth
 * @property {string|null} gender
 * @property {string|null} email
 * @property {string[]} editions
 * @property {string[]} sourceDocIds
 * @property {{ fullName: string|null; firstName: string|null; lastName: string|null }} raw
 */

/**
 * @typedef {Object} UserRecord
 * @property {string} userId
 * @property {string} fullName
 * @property {number|null} yearOfBirth
 * @property {string|null} gender
 * @property {string|null} email
 */

/**
 * @typedef {Object} MatchCandidate
 * @property {ParticipantRecord} participant
 * @property {UserRecord} user
 * @property {number} score
 * @property {string} matchType
 * @property {Record<string, unknown>} details
 */

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

const UPLOAD = argv.includes('--upload');
const ONLY_ARG = (() => {
  const v = argv.find((a) => a.startsWith('--only='));
  return v ? v.split('=')[1] : '';
})();
const MIN_SCORE = (() => {
  const v = argv.find((a) => a.startsWith('--minScore='));
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

function normalizeString(value) {
  if (!value) {
    return null;
  }
  return String(value)
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeKey(fullName, year) {
  const nameKey = normalizeString(fullName);
  if (!nameKey) {
    return null;
  }
  if (year != null) {
    return `${nameKey}|${year}`;
  }
  return nameKey;
}

function toNumber(value) {
  if (value == null) {
    return null;
  }
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

function normalizeEmail(email) {
  if (!email) {
    return null;
  }
  const trimmed = String(email).trim().toLowerCase();
  return trimmed || null;
}

function combineNameParts(...parts) {
  return parts
    .map((part) => (typeof part === 'string' ? part.trim() : ''))
    .filter((part) => part)
    .join(' ');
}

function deriveName(data, docId) {
  const candidates = [];

  const firstLast = combineNameParts(data.firstName || data.givenName, data.lastName || data.familyName);
  if (firstLast) {
    candidates.push({ value: firstLast, source: 'first_last' });
  }

  const possibleFields = [
    { value: data.fullName, source: 'fullName' },
    { value: data.name, source: 'name' },
    { value: data.displayName, source: 'displayName' },
    { value: data.runnerName, source: 'runnerName' }
  ];

  candidates.unshift(...possibleFields);

  for (const candidate of candidates) {
    const raw = typeof candidate.value === 'string' ? candidate.value.trim() : '';
    if (raw) {
      return { name: raw, source: candidate.source };
    }
  }

  return { name: docId, source: 'doc_id' };
}

function extractEmail(data) {
  const possibleFields = [data.email, data.contactEmail, data.primaryEmail, data.userEmail];
  for (const value of possibleFields) {
    const normalized = normalizeEmail(value);
    if (normalized) {
      return normalized;
    }
  }
  return null;
}

function buildRunnerKey(name, year, docId) {
  const normalizedName = normalizeString(name);
  if (normalizedName) {
    if (year != null) {
      return `${normalizedName}|${year}`;
    }
    return normalizedName;
  }
  if (docId) {
    return docId.toLowerCase();
  }
  return null;
}

async function loadParticipants(db) {
  const snapshot = await db.collection('moResults').get();
  console.log(`[debug] moResults snapshot size: ${snapshot.size}`);
  const participantsMap = new Map();

  snapshot.forEach((doc) => {
    const data = doc.data();
    const { name, source: nameSource } = deriveName(data, doc.id);
    const yearOfBirth = toNumber(data.yearOfBirth);
    const runnerKey = buildRunnerKey(name, yearOfBirth, doc.id);
    if (!runnerKey) {
      console.warn(`[warn] Skipping doc ${doc.id} due to missing key`);
      return;
    }

    const existing = participantsMap.get(runnerKey);
    const editionId = data.editionId || null;

    if (existing) {
      if (editionId && !existing.editions.includes(editionId)) {
        existing.editions.push(editionId);
      }
      if (!existing.sourceDocIds.includes(doc.id)) {
        existing.sourceDocIds.push(doc.id);
      }
      return;
    }

    participantsMap.set(runnerKey, {
      runnerKey,
      fullName: name,
      displayName: nameSource === 'doc_id' ? '(mangler navn)' : name,
      nameSource,
      yearOfBirth,
      gender: data.gender || null,
      email: extractEmail(data),
      editions: editionId ? [editionId] : [],
      sourceDocIds: [doc.id],
      raw: {
        fullName: data.fullName ?? null,
        firstName: data.firstName ?? data.givenName ?? null,
        lastName: data.lastName ?? data.familyName ?? null
      }
    });
  });

  return Array.from(participantsMap.values()).sort((a, b) => a.runnerKey.localeCompare(b.runnerKey));
}

async function loadUsers(db) {
  const snapshot = await db.collection('users').get();
  console.log(`[debug] users snapshot size: ${snapshot.size}`);
  return snapshot.docs.map((doc) => {
    const data = doc.data();
    return {
      userId: doc.id,
      fullName: data.fullName || '',
      yearOfBirth: toNumber(data.yearOfBirth),
      gender: data.gender || null,
      email: normalizeEmail(data.email)
    };
  });
}

function stripDiacritics(value) {
  if (!value) return value;
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function normalizePersonName(name) {
  if (!name) {
    return null;
  }
  return stripDiacritics(name)
    .toLowerCase()
    .replace(/[^a-z\s'-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokenizeName(name) {
  if (!name) {
    return [];
  }
  return name.split(' ').filter(Boolean);
}

function computeNameSimilarity(participant, user) {
  if (participant.nameSource === 'doc_id') {
    return 0;
  }

  const participantName = normalizePersonName(participant.fullName);
  const userName = normalizePersonName(user.fullName);

  if (!participantName || !userName) {
    return 0;
  }

  if (participantName === userName) {
    return 1;
  }

  const participantTokens = tokenizeName(participantName);
  const userTokens = tokenizeName(userName);
  if (!participantTokens.length || !userTokens.length) {
    return 0;
  }

  const participantSet = new Set(participantTokens);
  const userSet = new Set(userTokens);
  let overlap = 0;
  participantSet.forEach((token) => {
    if (userSet.has(token)) {
      overlap += 1;
    }
  });

  const ratio = overlap / Math.max(participantSet.size, userSet.size);

  if (ratio >= 0.8) {
    return 0.9;
  }
  if (ratio >= 0.6) {
    return 0.75;
  }
  if (ratio >= 0.4) {
    return 0.6;
  }

  return 0;
}

function scoreMatch(participant, user) {
  const participantEmail = normalizeEmail(participant.email);
  const userEmail = normalizeEmail(user.email);

  if (participantEmail && userEmail && participantEmail === userEmail) {
    return {
      participant,
      user,
      score: 1,
      matchType: 'email_exact',
      details: { email: participantEmail }
    };
  }

  const participantKey = normalizeKey(participant.fullName, participant.yearOfBirth);
  const userKey = normalizeKey(user.fullName, user.yearOfBirth);

  if (participantKey && userKey && participantKey === userKey) {
    return {
      participant,
      user,
      score: 1,
      matchType: 'name_exact',
      details: { key: participantKey }
    };
  }

  const nameSimilarity = computeNameSimilarity(participant, user);

  if (nameSimilarity === 0) {
    return null;
  }

  const yearDelta =
    participant.yearOfBirth != null && user.yearOfBirth != null
      ? Math.abs(participant.yearOfBirth - user.yearOfBirth)
      : null;

  let score = nameSimilarity;
  const details = { nameSimilarity };
  let matchType = 'name_fuzzy';

  if (yearDelta != null) {
    details.yearDelta = yearDelta;
    if (yearDelta === 0) {
      score += 0.1;
    } else if (yearDelta === 1) {
      score += 0.05;
    } else if (yearDelta > 2) {
      score -= 0.25;
    }
  }

  if (participantEmail && userEmail) {
    details.emailCompared = `${participantEmail} vs ${userEmail}`;
  }

  score = Math.max(0, Math.min(score, 1));

  if (score >= 0.95) {
    matchType = 'name_high';
  }

  if (score < 0.5) {
    return null;
  }

  return {
    participant,
    user,
    score,
    matchType,
    details
  };
}

function stageData(participants, users) {
  const outputDir = path.resolve(process.cwd(), 'tmp');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  fs.writeFileSync(path.join(outputDir, 'moParticipants.json'), JSON.stringify(participants, null, 2));
  fs.writeFileSync(path.join(outputDir, 'usersSubset.json'), JSON.stringify(users, null, 2));
}

function findMatches(participants, users) {
  /** @type {MatchCandidate[]} */
  const candidates = [];
  const userByKey = new Map();

  users.forEach((user) => {
    const key = normalizeKey(user.fullName, user.yearOfBirth);
    if (key) {
      userByKey.set(key, user);
    }
  });

  participants.forEach((participant) => {
    const key = normalizeKey(participant.fullName, participant.yearOfBirth);
    if (key && userByKey.has(key)) {
      const user = userByKey.get(key);
      candidates.push({
        participant,
        user,
        score: 1,
        matchType: 'name_exact',
        details: { key }
      });
      return;
    }

    let bestMatch = null;

    users.forEach((user) => {
      const match = scoreMatch(participant, user);
      if (!match) {
        return;
      }
      if (!bestMatch || match.score > bestMatch.score) {
        bestMatch = match;
      }
    });

    if (bestMatch) {
      candidates.push(bestMatch);
    }
  });

  return candidates.sort((a, b) => b.score - a.score);
}

async function main() {
  console.log(`Environment: ${targetEnv}`);
  console.log(`Using credentials at: ${credentialPath}`);

  const db = initFirebase();
  const appOptions = admin.app().options;
  if (appOptions && appOptions.projectId) {
    console.log(`Connected project: ${appOptions.projectId}`);
  }
  console.log('Loading participants...');
  const participants = await loadParticipants(db);
  console.log(`Loaded ${participants.length} participant records.`);

  console.log('Loading users...');
  const users = await loadUsers(db);
  console.log(`Loaded ${users.length} user records.`);

  console.log('Staging datasets to tmp/...');
  stageData(participants, users);

  console.log('Scoring matches...');
  const matches = findMatches(participants, users);
  const matchesPath = path.join(process.cwd(), 'tmp', 'moMatches.json');
  fs.writeFileSync(matchesPath, JSON.stringify(matches, null, 2));
  console.log(`Wrote ${matches.length} candidate matches to ${matchesPath}`);

  if (UPLOAD) {
    console.log('Uploading staging and candidates to Firestore...');
    await uploadToFirestore(db, participants, matches, { only: ONLY_ARG, minScore: MIN_SCORE });
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

function filterMatches(matches, opts) {
  const only = (opts.only || '').trim();
  const minScore = Number(opts.minScore || 0);
  return matches.filter((m) => {
    if (only && m.matchType !== only) return false;
    if (Number.isFinite(minScore) && m.score < minScore) return false;
    return true;
  });
}

async function uploadToFirestore(db, participants, matches, opts) {
  const filtered = filterMatches(matches, opts);
  const participantByKey = new Map();
  participants.forEach((p) => participantByKey.set(p.runnerKey, p));

  let batch = db.batch();
  let ops = 0;

  const nowTs = admin.firestore.FieldValue.serverTimestamp();

  function commitIfNeeded() {
    if (ops >= 400) {
      const b = batch;
      batch = db.batch();
      ops = 0;
      return b.commit();
    }
    return Promise.resolve();
  }

  for (const p of participants) {
    const ref = db.collection('moParticipantStaging').doc(p.runnerKey);
    batch.set(ref, {
      runnerKey: p.runnerKey,
      fullName: p.fullName,
      displayName: p.displayName,
      nameSource: p.nameSource,
      yearOfBirth: p.yearOfBirth ?? null,
      gender: p.gender ?? null,
      email: p.email ?? null,
      editions: p.editions || [],
      sourceDocIds: p.sourceDocIds || [],
      raw: p.raw || {},
      updatedAt: nowTs,
      createdAt: nowTs
    }, { merge: true });
    ops++;
    await commitIfNeeded();
  }

  for (const m of filtered) {
    const id = `${m.participant.runnerKey}__${m.user.userId}`.replace(/\//g, '_');
    const ref = db.collection('moMatchCandidates').doc(id);
    batch.set(ref, {
      participantRunnerKey: m.participant.runnerKey,
      userId: m.user.userId,
      score: m.score,
      matchType: m.matchType,
      details: m.details || {},
      status: 'pending',
      createdAt: nowTs,
      updatedAt: nowTs
    }, { merge: true });
    ops++;
    await commitIfNeeded();
  }

  if (ops > 0) {
    await batch.commit();
  }
  console.log(`Uploaded ${participants.length} participants to moParticipantStaging and ${filtered.length} candidates to moMatchCandidates`);
}
