#!/usr/bin/env node
"use strict";

/**
 * Helper to upsert Malvikingen Opp event editions (2011-2024) in `eventEditions/`.
 *
 * Usage examples:
 *   node scripts/fillMoEventEditions.js --env=test --dry-run
 *   node scripts/fillMoEventEditions.js --env=test --confirm
 *   node scripts/fillMoEventEditions.js --confirm                 # defaults to prod credentials
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const admin = require('firebase-admin');

const argv = process.argv.slice(2);
const hasFlag = (name) => argv.includes(`--${name}`);
const getOption = (name) => {
  const prefix = `--${name}`;
  const match = argv.find((arg) => arg === prefix || arg.startsWith(`${prefix}=`));
  if (!match) {
    const index = argv.findIndex((arg) => arg === prefix);
    if (index >= 0 && argv[index + 1] && !argv[index + 1].startsWith('--')) {
      return argv[index + 1];
    }
    return undefined;
  }
  const eqIndex = match.indexOf('=');
  if (eqIndex === -1) {
    const index = argv.indexOf(match);
    if (index >= 0 && argv[index + 1] && !argv[index + 1].startsWith('--')) {
      return argv[index + 1];
    }
    return undefined;
  }
  return match.slice(eqIndex + 1);
};

const expandHome = (inputPath) => {
  if (!inputPath) return inputPath;
  if (inputPath.startsWith('~')) {
    return path.join(os.homedir(), inputPath.slice(1));
  }
  if (inputPath.startsWith('$HOME/')) {
    return path.join(os.homedir(), inputPath.slice('$HOME/'.length));
  }
  return inputPath;
};

const ENV_FILES = {
  prod: 'serviceAccountKey.json',
  production: 'serviceAccountKey.json',
  test: 'serviceAccountKeyTest.json'
};

const env = (getOption('env') || 'prod').toLowerCase();
const credentialFile = ENV_FILES[env] || ENV_FILES.prod;
const credentialPath = expandHome(
  getOption('credentials') ||
    process.env.FIREBASE_ADMIN_SA ||
    path.join(os.homedir(), `.secrets/runners-hub/${credentialFile}`)
);

const DRY_RUN = hasFlag('dry-run') || hasFlag('dryrun');
const CONFIRM = hasFlag('confirm');

const RESULT_URL_BASE = env === 'test' ? 'https://runnershubtest.web.app' : 'https://runnershub.krultra.no';

if (!credentialPath || !fs.existsSync(credentialPath)) {
  console.error(`Service account credential not found at ${credentialPath}`);
  process.exit(1);
}

if (!DRY_RUN && !CONFIRM) {
  console.error("ERROR: --confirm is required when not running in dry-run mode.");
  process.exit(1);
}

const editionSpecs = [
  { year: 2011, start: '2011-05-07T10:00:00+02:00', end: '2011-05-07T14:00:00+02:00' },
  { year: 2012, start: '2012-05-05T10:00:00+02:00', end: '2012-05-05T14:00:00+02:00' },
  { year: 2013, start: '2013-05-13T10:00:00+02:00', end: '2013-05-13T14:00:00+02:00' },
  { year: 2014, start: '2014-05-10T10:00:00+02:00', end: '2014-05-10T14:00:00+02:00' },
  { year: 2015, start: '2015-05-09T10:00:00+02:00', end: '2015-05-09T14:00:00+02:00' },
  { year: 2016, start: '2016-05-14T10:00:00+02:00', end: '2016-05-14T14:00:00+02:00' },
  { year: 2017, start: '2017-05-13T10:00:00+02:00', end: '2017-05-13T14:00:00+02:00' },
  { year: 2018, start: '2018-05-13T10:00:00+02:00', end: '2018-05-13T14:00:00+02:00' },
  { year: 2019, start: '2019-05-12T10:00:00+02:00', end: '2019-05-12T14:00:00+02:00' },
  { year: 2020, start: '2020-05-01T00:00:00+02:00', end: '2020-06-01T00:00:00+02:00' },
  { year: 2021, start: '2021-05-01T00:00:00+02:00', end: '2021-06-01T00:00:00+02:00' },
  { year: 2022, start: '2022-05-21T10:00:00+02:00', end: '2022-05-21T14:00:00+02:00' },
  { year: 2023, start: '2023-06-04T10:00:00+02:00', end: '2023-06-04T14:00:00+02:00' },
  { year: 2024, start: '2024-05-11T10:00:00+02:00', end: '2024-05-11T14:00:00+02:00' },
  {
    year: 2025,
    start: '2025-05-10T10:00:00+02:00',
    end: '2025-05-10T14:00:00+02:00',
    RH_URL: '/mo-2025'
  }
];

const isoToTimestamp = (iso) => admin.firestore.Timestamp.fromDate(new Date(iso));

const buildPayload = (spec) => {
  const { year } = spec;
  const startIso = spec.start || `${year}-05-01T10:00:00+02:00`;
  const endIso = spec.end || `${year}-05-01T14:00:00+02:00`;
  return {
    eventId: 'mo',
    edition: year,
    eventShortName: 'MO',
    eventName: 'Malvikingen Opp',
    status: spec.status || 'finalized',
    resultsStatus: spec.resultsStatus || 'final',
    resultTypes: spec.resultTypes || ['scratch', 'gender', 'AGG'],
    startTime: isoToTimestamp(startIso),
    endTime: isoToTimestamp(endIso),
    liveResultsURL: spec.liveResultsURL || '',
    resultURL: spec.resultURL || `${RESULT_URL_BASE}/mo/results/mo-${year}`,
    RH_URL: spec.RH_URL || spec.rhUrl || '',
    notes: spec.notes || ''
  };
};

(async () => {
  console.log('Preparing to upsert MO event editions');
  console.log(`  Environment: ${env}`);
  console.log(`  Credential: ${credentialPath}`);
  console.log(`  Dry run: ${DRY_RUN ? 'yes' : 'no'}`);
  console.log(`  Editions: ${editionSpecs.map((e) => e.year).join(', ')}`);
  if (!DRY_RUN) {
    console.log('  Confirmation: --confirm supplied');
  }

  const serviceAccount = JSON.parse(fs.readFileSync(credentialPath, 'utf8'));
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
  const firestore = admin.firestore();

  try {
    for (const spec of editionSpecs) {
      const docId = `mo-${spec.year}`;
      const payload = buildPayload(spec);
      const preview = {
        ...payload,
        startTime: payload.startTime.toDate().toISOString(),
        endTime: payload.endTime.toDate().toISOString()
      };

      console.log(`\nDoc: eventEditions/${docId}`);
      console.log('Preview payload:', JSON.stringify(preview, null, 2));

      if (DRY_RUN) {
        continue;
      }

      await firestore.collection('eventEditions').doc(docId).set(payload, { merge: true });
      console.log(' → Upserted');
    }
  } finally {
    await admin.app().delete();
  }

  console.log('\nAll done.');
})().catch((err) => {
  console.error('Error:', err.message || err);
  if (process.env.DEBUG) {
    console.error(err);
  }
  process.exit(1);
});
