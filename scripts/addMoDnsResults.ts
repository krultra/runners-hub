#!/usr/bin/env ts-node

import path from 'node:path';
import fs from 'node:fs/promises';
import os from 'node:os';
import yargs from 'yargs/yargs';
import { hideBin } from 'yargs/helpers';
import admin from 'firebase-admin';

interface ImportOptions {
  env: 'test' | 'prod';
  report: string;
  dryRun: boolean;
  startYear?: number;
  endYear?: number;
  explicitEnv: boolean;
}

interface ClassifiedEntry {
  editionId: string;
  editionYear: number;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  rowNumber: number;
  reason: 'missing-email' | 'missing-name' | 'no-match';
  classification: 'data-mismatch' | 'missing-result' | 'csv-extra' | 'manual' | 'unknown';
  note?: string;
  reviewedAt?: string;
  csvFields: Record<string, string | null>;
  gender?: 'Male' | 'Female';
}

interface ReconciliationReport {
  classifications: ClassifiedEntry[];
}

const normalizeString = (value: string | null | undefined): string | null => {
  if (value === undefined || value === null) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed;
};

const normalizeForComparison = (value: string | null | undefined): string | null => {
  const normalized = normalizeString(value);
  if (!normalized) return null;
  return normalized
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();
};

const parseYear = (value: string | null | undefined): number | null => {
  const normalized = normalizeString(value);
  if (!normalized) return null;
  const num = Number.parseInt(normalized, 10);
  return Number.isFinite(num) ? num : null;
};

const buildRepresenting = (csvFields: Record<string, string | null>): string[] => {
  const club = normalizeString(csvFields['Klubb/sted'] ?? csvFields['Klubb/sted '] ?? null);
  return club ? [club] : [];
};

const buildNameKey = (firstName: string | null, lastName: string | null): string | null => {
  const first = normalizeForComparison(firstName);
  const last = normalizeForComparison(lastName);
  if (!first && !last) return null;
  return [first ?? '', last ?? ''].join(' ').trim();
};

const initFirebase = async (options: Pick<ImportOptions, 'env' | 'explicitEnv'>) => {
  if (admin.apps.length > 0) {
    return;
  }

  const defaultCredentialPath = (() => {
    const homeDir = os.homedir();
    const base = path.join(homeDir, '.secrets', 'runners-hub');
    return options.env === 'prod'
      ? path.join(base, 'serviceAccountKey.json')
      : path.join(base, 'serviceAccountKeyTest.json');
  })();

  const credentialPath = options.explicitEnv
    ? defaultCredentialPath
    : process.env.GOOGLE_APPLICATION_CREDENTIALS ?? defaultCredentialPath;

  let serviceAccount: admin.ServiceAccount;
  try {
    const content = await fs.readFile(credentialPath, 'utf8');
    serviceAccount = JSON.parse(content) as admin.ServiceAccount;
  } catch (error) {
    throw new Error(`Unable to load service account JSON at ${credentialPath}: ${(error as Error).message}`);
  }

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
};

const loadReport = async (reportPath: string): Promise<ClassifiedEntry[]> => {
  const content = await fs.readFile(reportPath, 'utf8');
  const parsed = JSON.parse(content) as ReconciliationReport;
  if (!parsed.classifications || !Array.isArray(parsed.classifications)) {
    throw new Error('Reconciliation report missing "classifications" array.');
  }
  return parsed.classifications;
};

const main = async () => {
  const cliArgs = hideBin(process.argv);
  const explicitEnvArg = cliArgs.some((arg) => arg === '--env' || arg.startsWith('--env=') || arg === '-env');

  const parser = yargs(cliArgs)
    .option('env', {
      type: 'string',
      choices: ['test', 'prod'],
      default: 'test',
      describe: 'Firebase project environment to target'
    })
    .option('report', {
      type: 'string',
      describe: 'Path to reconciliation-report.json',
      demandOption: true
    })
    .option('dry-run', {
      type: 'boolean',
      default: false,
      describe: 'Only simulate DNS creation'
    })
    .option('start-year', {
      type: 'number',
      describe: 'Restrict DNS creation to editions >= year'
    })
    .option('end-year', {
      type: 'number',
      describe: 'Restrict DNS creation to editions <= year'
    });

  const argv = await (parser as any).parseAsync();

  const options: ImportOptions = {
    env: argv.env as ImportOptions['env'],
    report: path.resolve(argv.report),
    dryRun: Boolean(argv['dry-run']),
    startYear: argv['start-year'],
    endYear: argv['end-year'],
    explicitEnv: explicitEnvArg
  };

  await initFirebase({ env: options.env, explicitEnv: options.explicitEnv });
  const db = admin.firestore();

  const classifications = await loadReport(options.report);
  const dnsEntries = classifications.filter((entry) => entry.classification === 'unknown');

  const batchId = `mo-dns-import-${Date.now()}`;
  console.log(`Processing ${dnsEntries.length} DNS entries (dryRun=${options.dryRun})`);

  const editionCache = new Map<string, FirebaseFirestore.QuerySnapshot<FirebaseFirestore.DocumentData>>();

  let created = 0;
  let updated = 0;
  let skipped = 0;

  for (const entry of dnsEntries) {
    if ((options.startYear && entry.editionYear < options.startYear) || (options.endYear && entry.editionYear > options.endYear)) {
      skipped += 1;
      continue;
    }

    const firstName = normalizeString(entry.firstName);
    const lastName = normalizeString(entry.lastName);
    const email = normalizeString(entry.email);
    const yearOfBirth = parseYear(entry.csvFields['Fødselsår']);
    const representing = buildRepresenting(entry.csvFields);

    let snapshot = editionCache.get(entry.editionId);
    if (!snapshot) {
      snapshot = await db.collection('moResults').where('editionId', '==', entry.editionId).get();
      editionCache.set(entry.editionId, snapshot);
    }

    const normalizedEmail = normalizeForComparison(email);
    const nameKey = buildNameKey(firstName, lastName);

    let existingDoc: FirebaseFirestore.QueryDocumentSnapshot<FirebaseFirestore.DocumentData> | undefined;
    snapshot.forEach((doc) => {
      if (existingDoc) {
        return;
      }
      const data = doc.data();
      const docEmail = normalizeForComparison(data.email);
      const docNameKey = buildNameKey(data.firstName ?? null, data.lastName ?? null);
      if (normalizedEmail && docEmail === normalizedEmail) {
        existingDoc = doc;
        return;
      }
      if (!normalizedEmail && nameKey && docNameKey === nameKey) {
        existingDoc = doc;
      }
    });

    const payload: Record<string, unknown> = {
      editionId: entry.editionId,
      editionYear: entry.editionYear,
      class: 'competition',
      firstName,
      lastName,
      representing,
      email: email ?? null,
      yearOfBirth,
      gender: entry.gender ?? null,
      raceTime: null,
      raceTimeSeconds: null,
      resultStatus: 'dns',
      dnsReason: entry.note ?? entry.reason,
      importBatchId: batchId,
      importedAt: admin.firestore.Timestamp.now(),
      csvRowNumber: entry.rowNumber,
      userResolution: 'none',
      resolvedUserId: null,
      sourceCsv: entry.csvFields,
      dnsSource: {
        report: options.report,
        reviewedAt: entry.reviewedAt ?? null
      }
    };

    if (existingDoc) {
      if (options.dryRun) {
        console.log(`[DRY-RUN] Would update DNS status for doc ${existingDoc.id} (${entry.editionId})`);
      } else {
        await existingDoc.ref.update(payload);
        console.log(`Updated existing doc ${existingDoc.id} with DNS status (${entry.editionId})`);
      }
      updated += 1;
      continue;
    }

    if (options.dryRun) {
      console.log(`[DRY-RUN] Would create DNS doc for ${entry.editionId} | ${firstName ?? '—'} ${lastName ?? '—'}`);
      created += 1;
      continue;
    }

    const docRef = db.collection('moResults').doc();
    await docRef.set(payload);
    console.log(`Created DNS doc ${docRef.id} for ${entry.editionId}`);
    created += 1;
  }

  console.log('\nDNS import summary:');
  console.log(`  Created: ${created}`);
  console.log(`  Updated: ${updated}`);
  console.log(`  Skipped (outside range): ${skipped}`);

  if (options.dryRun) {
    console.log('\nDry-run completed. No documents were written.');
  }

  process.exit(0);
};

main().catch((error) => {
  console.error('DNS import failed:', error);
  process.exit(1);
});
