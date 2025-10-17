#!/usr/bin/env node
/*
  scripts/cloneFirestoreProject.js

  Cross-project Firestore cloner using Firebase Admin SDK.
  - Recursively copies all documents including subcollections.
  - Batched writes for efficiency; safe defaults.
  - Optional include/exclude top-level collections.
  - Source and target authenticated via separate service account JSON files.

  Usage examples:
    node scripts/cloneFirestoreProject.js --confirm \
      --source-credentials "$HOME/.secrets/runners-hub/runnershub-service-account-readwrite.json" \
      --target-credentials "$HOME/.secrets/runners-hub/runnershubtest-service-account-readwrite.json"

    # Include only a subset of collections
    node scripts/cloneFirestoreProject.js --confirm \
      --include codeLists,eventEditions,resultsSummary,resultsAggregates,allTime

  Environment variables (optional):
    FIREBASE_ADMIN_SA_PROD: path to prod service account JSON
    FIREBASE_ADMIN_SA_TEST: path to test service account JSON

  Fallback default paths if not specified:
    $HOME/.secrets/runners-hub/runnershub-service-account-readwrite.json
    $HOME/.secrets/runners-hub/runnershubtest-service-account-readwrite.json
*/

process.env.GOOGLE_CLOUD_DISABLE_AUTO_PAGE_WARNING = process.env.GOOGLE_CLOUD_DISABLE_AUTO_PAGE_WARNING || '1';

process.on('warning', (warning) => {
  if (warning && warning.name === 'AutopaginateTrueWarning') {
    return;
  }
  console.warn(warning);
});

const fs = require('fs');
const path = require('path');
const os = require('os');
const readline = require('readline');
const admin = require('firebase-admin');
const firestoreLib = require('@google-cloud/firestore');
const debugLib = require('debug');

function parseArgs(argv) {
  const args = {};
  const tokens = argv.slice(2);
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    if (!token.startsWith('--')) continue;
    const stripped = token.replace(/^--/, '');
    const eqIndex = stripped.indexOf('=');
    if (eqIndex >= 0) {
      const key = stripped.substring(0, eqIndex);
      const value = stripped.substring(eqIndex + 1);
      args[key] = value;
    } else {
      const key = stripped;
      const next = tokens[i + 1];
      if (next && !next.startsWith('--')) {
        args[key] = next;
        i++; // skip value token
      } else {
        args[key] = true;
      }
    }
  }
  return args;
}

function expandHome(p) {
  if (!p) return p;
  if (p.startsWith('~')) return path.join(os.homedir(), p.slice(1));
  return p.replace(/^\$HOME\//, path.join(os.homedir(), '/'));
}

function loadServiceAccount(fromArgs, envName, fallback) {
  const selected = fromArgs || process.env[envName] || expandHome(fallback);
  if (!selected) throw new Error(`Missing service account path for ${envName}`);
  const abs = path.resolve(selected);
  if (!fs.existsSync(abs)) {
    throw new Error(`Service account file not found: ${abs}`);
  }
  const json = JSON.parse(fs.readFileSync(abs, 'utf8'));
  if (!json.project_id) {
    console.warn(`[WARN] Service account missing project_id field: ${abs}`);
  }
  return { abs, json };
}

function askYesNo(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => rl.question(question, (ans) => { rl.close(); resolve(ans.trim().toLowerCase()); }));
}

async function getRootCollections(db) {
  return await db.listCollections();
}

function createBatcher(dstDb, batchSize = 400) {
  let batch = dstDb.batch();
  let ops = 0;
  return {
    async set(ref, data, merge) {
      batch.set(ref, data, { merge });
      ops++;
      if (ops >= batchSize) {
        await batch.commit();
        batch = dstDb.batch();
        ops = 0;
      }
    },
    async delete(ref) {
      batch.delete(ref);
      ops++;
      if (ops >= batchSize) {
        await batch.commit();
        batch = dstDb.batch();
        ops = 0;
      }
    },
    async flush() {
      if (ops > 0) {
        await batch.commit();
        ops = 0;
        batch = dstDb.batch();
      }
    }
  };
}

async function copyDocRecursive(srcDocRef, dstDocRef, options, counters, batcher) {
  const snap = await srcDocRef.get();
  if (!snap.exists) return;
  const data = snap.data();
  if (!options.dryRun) {
    await batcher.set(dstDocRef, data, !!options.merge);
  }
  counters.docs++;

  const subs = await srcDocRef.listCollections();
  for (const sub of subs) {
    const subSnap = await sub.get();
    for (const d of subSnap.docs) {
      const childSrc = d.ref;
      const childDst = dstDocRef.collection(sub.id).doc(d.id);
      await copyDocRecursive(childSrc, childDst, options, counters, batcher);
    }
  }
}

async function purgeCollection(dstDb, colName, batcher, logger) {
  const dstCol = dstDb.collection(colName);
  const snap = await dstCol.get();
  if (snap.empty) {
    logger(`Target collection ${colName} already empty`, true);
    return;
  }
  logger(`Purging target collection ${colName} (${snap.size} docs)`, true);
  for (const doc of snap.docs) {
    await deleteDocRecursive(doc.ref, batcher);
  }
  await batcher.flush();
}

async function deleteDocRecursive(docRef, batcher) {
  const subs = await docRef.listCollections();
  for (const sub of subs) {
    const subSnap = await sub.get();
    for (const child of subSnap.docs) {
      await deleteDocRecursive(child.ref, batcher);
    }
  }
  await batcher.delete(docRef);
}

async function copyCollection(srcDb, dstDb, colName, options, counters, batcher, logger) {
  const srcCol = srcDb.collection(colName);
  const dstCol = dstDb.collection(colName);
  const snap = await srcCol.get();
  counters.collections++;
  logger(`COLLECTION ${colName} - ${snap.size} docs`, true);

  let processed = 0;
  for (const d of snap.docs) {
    processed++;
    const srcDocRef = d.ref;
    const dstDocRef = dstCol.doc(d.id);
    await copyDocRecursive(srcDocRef, dstDocRef, options, counters, batcher);
    if (processed % 100 === 0) {
      logger(`processed ${processed}/${snap.size} in ${colName}`, true);
    }
  }
}

async function main() {
  const args = parseArgs(process.argv);
  const includeRaw = typeof args.include === 'string' ? args.include : '';
  const excludeRaw = typeof args.exclude === 'string' ? args.exclude : '';
  const include = includeRaw.split(',').map(s => s.trim()).filter(Boolean);
  const exclude = excludeRaw.split(',').map(s => s.trim()).filter(Boolean);
  const purge = args.purge === true || String(args.purge || '').toLowerCase() === 'true';
  const options = {
    merge: !!args.merge,
    dryRun: !!(args['dry-run'] || args.dryrun),
    purge,
  };
  const verbose = args.verbose === true || String(args.verbose || '').toLowerCase() === 'true';
  const logFilePathRaw = args['log-file'] || args.logfile;
  const logFilePath = logFilePathRaw ? path.resolve(expandHome(logFilePathRaw)) : null;
  const debugLines = [];
  const reverse = args.reverse === true || String(args.reverse || '').toLowerCase() === 'true';

  if (!verbose) {
    debugLib.disable();
  }

  const originalConsoleLog = console.log.bind(console);
  if (!verbose) {
    console.log = () => {};
  }

  const logger = (message, verboseOnly = false) => {
    const line = `[${new Date().toISOString()}] ${message}`;
    if (!verboseOnly || verbose) {
      originalConsoleLog(message);
    }
    if (logFilePath) {
      debugLines.push(line);
    }
  };

  // Load credentials
  const sourceLabel = reverse ? 'test' : 'prod';
  const targetLabel = reverse ? 'prod' : 'test';
  const sourceEnv = reverse ? 'FIREBASE_ADMIN_SA_TEST' : 'FIREBASE_ADMIN_SA_PROD';
  const targetEnv = reverse ? 'FIREBASE_ADMIN_SA_PROD' : 'FIREBASE_ADMIN_SA_TEST';
  const sourceFallback = reverse
    ? '~/.secrets/runners-hub/runnershubtest-service-account-readwrite.json'
    : '~/.secrets/runners-hub/runnershub-service-account-readwrite.json';
  const targetFallback = reverse
    ? '~/.secrets/runners-hub/runnershub-service-account-readwrite.json'
    : '~/.secrets/runners-hub/runnershubtest-service-account-readwrite.json';

  const srcSA = loadServiceAccount(args['source-credentials'], sourceEnv, sourceFallback);
  const dstSA = loadServiceAccount(args['target-credentials'], targetEnv, targetFallback);

  if (typeof firestoreLib.setLogFunction === 'function') {
    firestoreLib.setLogFunction(verbose ? console.log.bind(console) : () => {});
  } else if (!verbose && typeof admin.firestore.setLogFunction === 'function') {
    admin.firestore.setLogFunction(() => {});
  }
  if (!verbose) {
    process.env.FIRESTORE_LOG_LEVEL = process.env.FIRESTORE_LOG_LEVEL || 'error';
  }

  // Initialize apps
  const sourceApp = admin.initializeApp({ credential: admin.credential.cert(srcSA.json) }, 'source');
  const targetApp = admin.initializeApp({ credential: admin.credential.cert(dstSA.json) }, 'target');
  const srcDb = admin.firestore(sourceApp);
  const dstDb = admin.firestore(targetApp);
  const batchSize = Number.parseInt(String(args.batchSize || args.batch || 400), 10) || 400;
  const batcher = createBatcher(dstDb, batchSize);

  logger('Firestore clone starting', true);
  logger(`Source project (${sourceLabel}): ${srcSA.json.project_id || '(unknown)'}`, true);
  logger(`Target project (${targetLabel}): ${dstSA.json.project_id || '(unknown)'}`, true);
  logger(`Include: ${include.length ? include.join(', ') : '(all)'}`, true);
  logger(`Exclude: ${exclude.length ? exclude.join(', ') : '(none)'}`, true);
  logger(`Merge mode: ${options.merge ? 'true' : 'false'}`, true);
  logger(`Dry run: ${options.dryRun ? 'true' : 'false'}`, true);

  if (!args.confirm) {
    const ans = await askYesNo("Type 'yes' to start cloning: ");
    if (ans !== 'yes') {
      logger('Aborted.');
      process.exit(0);
    }
  }

  const counters = { collections: 0, docs: 0 };
  const root = await getRootCollections(srcDb);
  const rootNames = root.map(c => c.id);

  const selected = rootNames
    .filter(name => include.length === 0 || include.includes(name))
    .filter(name => !exclude.includes(name));

  if (selected.length === 0) {
    logger('No collections selected. Nothing to do.');
    process.exit(0);
  }

  if (options.purge && !options.dryRun) {
    for (const colName of selected) {
      await purgeCollection(dstDb, colName, batcher, logger);
    }
  }

  for (const colName of selected) {
    await copyCollection(srcDb, dstDb, colName, options, counters, batcher, logger);
  }

  // Flush any remaining batched writes
  if (!options.dryRun) {
    await batcher.flush();
  }

  if (logFilePath && debugLines.length) {
    fs.writeFileSync(logFilePath, debugLines.join('\n'), 'utf8');
    if (verbose) {
      console.log(`Debug log written to ${logFilePath}`);
    }
  }

  logger('====================================');
  logger('Clone completed.');
  logger(`Collections copied: ${counters.collections}`);
  logger(`Documents copied:   ${counters.docs}`);
  logger('====================================');

  if (!verbose) {
    console.log = originalConsoleLog;
  }
}

main().catch(err => {
  console.error('Clone failed:', err);
  process.exit(1);
});
