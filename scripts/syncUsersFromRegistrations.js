// scripts/syncUsersFromRegistrations.js
// Admin CLI: Sync users from registrations for a given editionId
// - Prompts for editionId
// - For each registration in that edition:
//    * Finds a user by email
//    * If found, merges fields
//    * If not found, creates users/{uidOrEmail}
//    * Always sets email from registration.email
//    * Maintains 'representing' as a de-duplicated array
// - Uses batched writes for efficiency (chunked commits)
//
// Usage:
//   node scripts/syncUsersFromRegistrations.js
//
// Tip: Run a backup first: `node scripts/backupFirestore.js`

const admin = require('firebase-admin');
const path = require('path');
const os = require('os');
const readline = require('readline');

admin.initializeApp({
  credential: admin.credential.cert(require(path.join(os.homedir(), '.secrets/runners-hub/serviceAccountKey.json'))),
});
const db = admin.firestore();

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const ask = (q) => new Promise((res) => rl.question(q, res));

async function queryRegistrationsByEdition(editionId) {
  const snap = await db.collection('registrations')
    .where('editionId', '==', editionId)
    .get();
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

async function findUserDocByEmail(email) {
  const snap = await db.collection('users').where('email', '==', email).limit(1).get();
  if (!snap.empty) {
    const d = snap.docs[0];
    return { id: d.id, ref: d.ref, data: d.data() };
  }
  return null;
}

function mergeRepresenting(existingUser) {
  const arr = Array.isArray(existingUser?.representing) ? [...existingUser.representing] : [];
  return arr;
}

async function syncForEdition(editionId) {
  const regs = await queryRegistrationsByEdition(editionId);
  console.log(`Found ${regs.length} registrations for edition '${editionId}'.`);

  let batch = db.batch();
  let ops = 0;
  let updated = 0;

  for (const reg of regs) {
    const email = reg.email;
    if (!email || typeof email !== 'string') {
      console.warn(`Skipping registration ${reg.id}: missing email`);
      continue;
    }

    const existing = await findUserDocByEmail(email);
    let userRef;
    let existingUser = null;

    if (existing) {
      userRef = existing.ref;
      existingUser = existing.data;
    } else {
      // Prefer UID if present on registration, otherwise fallback to email as doc ID
      const docId = reg.userId ? String(reg.userId) : String(email);
      userRef = db.collection('users').doc(docId);
    }

    // Merge representing
    const representingArr = mergeRepresenting(existingUser);
    if (reg.representing) {
      const val = String(reg.representing).trim();
      if (val && !representingArr.includes(val)) representingArr.push(val);
    }

    const payload = {
      // Always set email to the registration email (canonical source)
      email: email,
      editionId: reg.editionId || '',
      firstName: reg.firstName || '',
      lastName: reg.lastName || '',
      nationality: reg.nationality || '',
      dateOfBirth: reg.dateOfBirth || '',
      phone: reg.phoneNumber || '',
      representing: representingArr,
      lastSynced: admin.firestore.FieldValue.serverTimestamp(),
    };

    batch.set(userRef, payload, { merge: true });
    ops++;
    updated++;

    if (ops >= 400) {
      await batch.commit();
      console.log(`Committed batch. Updated so far: ${updated}`);
      batch = db.batch();
      ops = 0;
    }
  }

  if (ops > 0) {
    await batch.commit();
  }

  console.log(`Sync complete. Updated ${updated} user documents.`);
}

(async () => {
  try {
    console.log('NOTE: Consider running a backup first: node scripts/backupFirestore.js');
    const editionId = (await ask('Enter editionId to sync (e.g., kutc-2025): ')).trim();
    if (!editionId) {
      console.error('editionId is required.');
      process.exit(1);
    }
    const confirm = (await ask(`Type 'yes' to sync users from registrations for '${editionId}': `)).trim().toLowerCase();
    if (confirm !== 'yes') {
      console.log('Aborted by user.');
      process.exit(0);
    }
    await syncForEdition(editionId);
  } catch (err) {
    console.error('Sync failed:', err);
    process.exit(1);
  } finally {
    rl.close();
  }
})();
