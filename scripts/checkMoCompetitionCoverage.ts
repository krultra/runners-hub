#!/usr/bin/env ts-node

import path from 'node:path';
import fs from 'node:fs/promises';
import os from 'node:os';
import yargs from 'yargs/yargs';
import { hideBin } from 'yargs/helpers';
import Papa from 'papaparse';
import admin from 'firebase-admin';

interface RawCsvRow {
  [key: string]: string;
}

interface ImportOptions {
  env: 'test' | 'prod';
  file: string;
  startYear?: number;
  endYear?: number;
  output?: string;
  explicitEnv: boolean;
}

interface CompetitionEntry {
  editionId: string;
  editionYear: number;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  rowNumber: number;
  csvFields: Record<string, string | null>;
}

interface MissingEntry extends CompetitionEntry {
  reason: 'missing-email' | 'missing-name' | 'no-match';
}

const YEAR_COLUMNS = Array.from({ length: 2025 - 2011 + 1 }, (_, index) => (2011 + index).toString());

const sanitizeCsvFields = (row: RawCsvRow): Record<string, string | null> => {
  const sanitized: Record<string, string | null> = {};
  Object.entries(row).forEach(([key, value]) => {
    const trimmedKey = key?.trim();
    if (!trimmedKey) {
      return;
    }
    sanitized[trimmedKey] = value ?? null;
  });
  return sanitized;
};

const normalizeString = (value: string | null | undefined): string | null => {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed === '#I/T') return null;
  return trimmed;
};

const parseIntStrict = (value: string | null | undefined): number | null => {
  const normalized = normalizeString(value);
  if (!normalized) return null;
  const num = Number.parseInt(normalized, 10);
  return Number.isFinite(num) ? num : null;
};

const buildNameKey = (firstName: string | null, lastName: string | null): string | null => {
  const first = normalizeString(firstName)?.toLowerCase();
  const last = normalizeString(lastName)?.toLowerCase();
  if (!first && !last) return null;
  return [first ?? '', last ?? ''].join(' ').trim();
};

const readCsv = async (filePath: string): Promise<RawCsvRow[]> => {
  const fileContent = await fs.readFile(filePath, 'utf8');

  return new Promise((resolve, reject) => {
    Papa.parse<RawCsvRow>(fileContent, {
      header: true,
      delimiter: ';',
      skipEmptyLines: 'greedy',
      complete: (results) => {
        if (results.errors.length > 0) {
          reject(new Error(`CSV parse errors: ${JSON.stringify(results.errors, null, 2)}`));
          return;
        }
        resolve(results.data);
      },
      error: (error: any) => reject(error)
    });
  });
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

const buildCompetitionEntries = (
  rows: RawCsvRow[],
  options: ImportOptions
): CompetitionEntry[] => {
  const entries: CompetitionEntry[] = [];

  rows.forEach((row, index) => {
    const sanitizedFields = sanitizeCsvFields(row);
    const firstName = normalizeString(row['Fornavn']) ?? null;
    const lastName = normalizeString(row['Etternavn']) ?? null;
    const email = normalizeString(row['Mail']);

    YEAR_COLUMNS.forEach((yearColumn) => {
      const year = Number.parseInt(yearColumn, 10);
      if ((options.startYear && year < options.startYear) || (options.endYear && year > options.endYear)) {
        return;
      }

      const letter = normalizeString(row[yearColumn])?.toUpperCase();
      if (letter !== 'K') {
        return;
      }

      entries.push({
        editionId: `mo-${year}`,
        editionYear: year,
        firstName,
        lastName,
        email: email ?? null,
        rowNumber: index + 1,
        csvFields: sanitizedFields
      });
    });
  });

  return entries;
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
    .option('file', {
      type: 'string',
      describe: 'Path to Adelskalender CSV export',
      demandOption: true
    })
    .option('start-year', {
      type: 'number',
      describe: 'Restrict verification to editions >= year'
    })
    .option('end-year', {
      type: 'number',
      describe: 'Restrict verification to editions <= year'
    })
    .option('output', {
      type: 'string',
      describe: 'Write missing entries report to the given JSON file'
    });

  const argv = await (parser as any).parseAsync();

  const options: ImportOptions = {
    env: argv.env as ImportOptions['env'],
    file: path.resolve(argv.file),
    startYear: argv['start-year'],
    endYear: argv['end-year'],
    output: argv.output ? path.resolve(argv.output) : undefined,
    explicitEnv: explicitEnvArg
  };

  await initFirebase({ env: options.env, explicitEnv: options.explicitEnv });
  const db = admin.firestore();

  const csvRows = await readCsv(options.file);
  const entries = buildCompetitionEntries(csvRows, options);

  const entriesByEdition = new Map<string, CompetitionEntry[]>();
  entries.forEach((entry) => {
    const existing = entriesByEdition.get(entry.editionId) ?? [];
    existing.push(entry);
    entriesByEdition.set(entry.editionId, existing);
  });

  let matched = 0;
  const missing: MissingEntry[] = [];

  for (const [editionId, editionEntries] of entriesByEdition.entries()) {
    const snapshot = await db.collection('moResults').where('editionId', '==', editionId).get();
    const emailIndex = new Map<string, FirebaseFirestore.DocumentData>();
    const nameIndex = new Map<string, FirebaseFirestore.DocumentData>();

    snapshot.forEach((doc) => {
      const data = doc.data();
      const email = normalizeString(data.email)?.toLowerCase();
      if (email) {
        emailIndex.set(email, data);
      }
      const nameKey = buildNameKey(data.firstName ?? null, data.lastName ?? null);
      if (nameKey) {
        nameIndex.set(nameKey, data);
      }
    });

    editionEntries.forEach((entry) => {
      const normalizedEmail = normalizeString(entry.email)?.toLowerCase();
      const nameKey = buildNameKey(entry.firstName, entry.lastName);

      if (normalizedEmail && emailIndex.has(normalizedEmail)) {
        matched += 1;
        return;
      }

      if (nameKey && nameIndex.has(nameKey)) {
        matched += 1;
        return;
      }

      const reason: MissingEntry['reason'] = normalizedEmail ? (nameKey ? 'no-match' : 'missing-name') : 'missing-email';
      missing.push({ ...entry, reason });
    });
  }

  const summary = {
    totalEntries: entries.length,
    matched,
    missing: missing.length
  };

  console.log('Competition coverage summary:', summary);

  if (missing.length > 0) {
    console.log('\nMissing competition entries (up to 20 shown):');
    missing.slice(0, 20).forEach((entry) => {
      console.log(
        `  ${entry.editionId} | ${entry.firstName ?? '—'} ${entry.lastName ?? '—'} | email=${entry.email ?? '—'} | reason=${entry.reason} | row=${entry.rowNumber}`
      );
    });

    if (missing.length > 20) {
      console.log(`  ...and ${missing.length - 20} more`);
    }
  } else {
    console.log('All competition entries accounted for.');
  }

  if (options.output) {
    const report = {
      generatedAt: new Date().toISOString(),
      summary,
      missing
    };
    await fs.writeFile(options.output, JSON.stringify(report, null, 2), 'utf8');
    console.log(`\nWrote missing entries report to ${options.output}`);
  }

  process.exit(0);
};

main().catch((error) => {
  console.error('Competition coverage check failed:', error);
  process.exit(1);
});
