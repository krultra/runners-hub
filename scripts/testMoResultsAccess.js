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
    throw new Error(`Service account not found at ${credentialPath}`);
  }
  return JSON.parse(fs.readFileSync(credentialPath, 'utf-8'));
}

async function main() {
  console.log(`Environment: ${targetEnv}`);
  console.log(`Using credentials at: ${credentialPath}`);

  admin.initializeApp({
    credential: admin.credential.cert(loadServiceAccount())
  });

  const appOptions = admin.app().options;
  if (appOptions?.projectId) {
    console.log(`Connected project: ${appOptions.projectId}`);
  }

  const db = admin.firestore();
  const snapshot = await db.collection('moResults').limit(5).get();
  console.log(`moResults snapshot size (limit 5): ${snapshot.size}`);

  snapshot.forEach((doc) => {
    const data = doc.data();
    console.log(`Doc ${doc.id}: fullName='${data.fullName || ''}', editionId='${data.editionId || ''}'`);
  });

  console.log('Done.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
