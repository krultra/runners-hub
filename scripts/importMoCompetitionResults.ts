#!/usr/bin/env ts-node

import path from 'node:path';
import fs from 'node:fs/promises';
import os from 'node:os';
import readline from 'node:readline';
import { stdin as input, stdout as output } from 'node:process';
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
  dryRun: boolean;
  includeValidation: boolean;
  startYear?: number;
  endYear?: number;
  force: boolean;
  explicitEnv: boolean;
}

interface NormalizedResult {
  editionId: string;
  editionYear: number;
  firstName: string | null;
  lastName: string | null;
  representing: string[];
  gender: 'male' | 'female' | null;
  yearOfBirth: number | null;
  class: 'competition';
  raceTime: string | null;
  raceTimeSeconds: number | null;
  adjustedTime?: string | null;
  adjustedTimeSeconds?: number | null;
  email?: string | null;
  source: {
    importBatchId: string;
    importedAt: Date;
    csvRowNumber: number;
    csvFields: Record<string, string | null>;
    validation?: {
      ageFactor?: number | null;
      genderFactor?: number | null;
      aggFactor?: number | null;
      csvAdjustedTime?: string | null;
      csvAdjustedTimeSeconds?: number | null;
    };
  };
}

interface UserMatchCandidate {
  userId: string;
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
}

interface ResolvedUser {
  userId: string | null;
  matchedVia: 'email+name' | 'manual-confirmation' | 'new-user' | 'none';
}

const CSV_HEADERS = {
  year: 'Arr.år',
  firstName: 'Fornavn',
  lastName: 'Etternavn',
  fullName: 'Navn',
  club: 'Klubb',
  gender: 'Kjønn',
  birthYear: 'F.år',
  class: 'Klasse',
  timeDisplay: 'Løpstid',
  timeSeconds: 'Løpstid i sekunder',
  adjustedDisplay: 'Alders- og kjønns-gradert resultat',
  ageFactor: 'Alders-faktor',
  genderFactor: 'Kjønns-faktor',
  aggFactor: 'AKG-faktor',
  email: 'e-post'
} as const;

type CsvKey = (typeof CSV_HEADERS)[keyof typeof CSV_HEADERS];

const NORMALIZE_BOOLEAN = new Set(['y', 'yes', 'true', '1']);

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

const parseNumber = (value: string | null | undefined): number | null => {
  const normalized = normalizeString(value);
  if (!normalized) return null;
  const replaced = normalized.replace(',', '.');
  const num = Number.parseFloat(replaced);
  return Number.isFinite(num) ? num : null;
};

const parseIntStrict = (value: string | null | undefined): number | null => {
  const normalized = normalizeString(value);
  if (!normalized) return null;
  const num = Number.parseInt(normalized, 10);
  return Number.isFinite(num) ? num : null;
};

const toGender = (value: string | null | undefined): 'male' | 'female' | null => {
  const normalized = normalizeString(value)?.toLowerCase();
  if (!normalized) return null;
  if (normalized.startsWith('m')) return 'male';
  if (normalized.startsWith('k') || normalized.startsWith('f')) return 'female';
  return null;
};

const toEditionId = (year: number | null): string | null => {
  if (!year) return null;
  return `mo-${year}`;
};

const buildRepresenting = (club: string | null): string[] => {
  return club ? [club] : [];
};

const normalizeCsvRow = (
  row: RawCsvRow,
  rowNumber: number,
  options: ImportOptions,
  batchId: string
): NormalizedResult | null => {
  const year = parseIntStrict(row[CSV_HEADERS.year]);
  if (!year) {
    console.warn(`[SKIP] Missing year in row ${rowNumber}`);
    return null;
  }
  if ((options.startYear && year < options.startYear) || (options.endYear && year > options.endYear)) {
    return null;
  }

  const editionId = toEditionId(year);
  if (!editionId) {
    console.warn(`[SKIP] Invalid edition id for year ${year} (row ${rowNumber})`);
    return null;
  }

  const firstName = normalizeString(row[CSV_HEADERS.firstName]) ?? null;
  const lastName = normalizeString(row[CSV_HEADERS.lastName]) ?? null;
  let effectiveFirstName = firstName;
  let effectiveLastName = lastName;

  if (!effectiveFirstName && !effectiveLastName) {
    const fullName = normalizeString(row[CSV_HEADERS.fullName]);
    if (fullName) {
      const parts = fullName.split(' ');
      if (parts.length === 1) {
        effectiveFirstName = parts[0];
      } else if (parts.length > 1) {
        effectiveFirstName = parts.slice(0, -1).join(' ');
        effectiveLastName = parts[parts.length - 1];
      }
    }
  }

  const gender = toGender(row[CSV_HEADERS.gender]);
  const yearOfBirth = parseIntStrict(row[CSV_HEADERS.birthYear]);
  const raceTime = normalizeString(row[CSV_HEADERS.timeDisplay]);
  const raceTimeSeconds = parseNumber(row[CSV_HEADERS.timeSeconds]);
  const adjustedTime = normalizeString(row[CSV_HEADERS.adjustedDisplay]) ?? null;
  const adjustedTimeSeconds = parseNumber(row[CSV_HEADERS.adjustedDisplay]);
  const ageFactor = parseNumber(row[CSV_HEADERS.ageFactor]);
  const genderFactor = parseNumber(row[CSV_HEADERS.genderFactor]);
  const aggFactor = parseNumber(row[CSV_HEADERS.aggFactor]);
  const email = normalizeString(row[CSV_HEADERS.email]);

  const result: NormalizedResult = {
    editionId,
    editionYear: year,
    firstName: effectiveFirstName,
    lastName: effectiveLastName,
    representing: buildRepresenting(normalizeString(row[CSV_HEADERS.club])),
    gender,
    yearOfBirth,
    class: 'competition',
    raceTime,
    raceTimeSeconds,
    email,
    source: {
      importBatchId: batchId,
      importedAt: new Date(),
      csvRowNumber: rowNumber,
      csvFields: sanitizeCsvFields(row)
    }
  };

  if (options.includeValidation) {
    result.source.validation = {
      ageFactor,
      genderFactor,
      aggFactor,
      csvAdjustedTime: adjustedTime,
      csvAdjustedTimeSeconds: adjustedTimeSeconds
    };
  }

  if (raceTime && !raceTimeSeconds) {
    console.warn(`[WARN] Missing raceTimeSeconds for row ${rowNumber} (${raceTime})`);
  }

  if (!raceTimeSeconds) {
    // We will skip rows without numeric time for now (can be revisited for DNS entries)
    console.warn(`[SKIP] Missing numeric race time in row ${rowNumber}`);
    return null;
  }

  return result;
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

const formatUserName = (user: UserMatchCandidate): string => {
  const first = normalizeString(user.firstName) ?? '';
  const last = normalizeString(user.lastName) ?? '';
  return `${first} ${last}`.trim();
};

const buildNameKey = (firstName: string | null, lastName: string | null): string | null => {
  const first = normalizeString(firstName);
  const last = normalizeString(lastName);
  if (!first && !last) return null;
  return [first ?? '', last ?? ''].join(' ').trim().toLowerCase();
};

const findExistingUsers = async (
  db: FirebaseFirestore.Firestore,
  candidate: NormalizedResult
): Promise<UserMatchCandidate[]> => {
  const matches: UserMatchCandidate[] = [];

  const nameKey = buildNameKey(candidate.firstName, candidate.lastName);
  const email = normalizeString(candidate.email)?.toLowerCase();

  if (email) {
    const emailSnap = await db
      .collection('users')
      .where('email', '==', email)
      .get();
    emailSnap.forEach((doc) => {
      const data = doc.data() as Partial<UserMatchCandidate>;
      const match: UserMatchCandidate = {
        userId: doc.id,
        firstName: data.firstName ?? null,
        lastName: data.lastName ?? null,
        email: data.email ?? null
      };
      matches.push(match);
    });
  }

  if (nameKey) {
    const nameSnap = await db
      .collection('users')
      .where('searchName', '==', nameKey)
      .get();
    nameSnap.forEach((doc) => {
      const data = doc.data() as Partial<UserMatchCandidate> & { searchName?: string };
      const match: UserMatchCandidate = {
        userId: doc.id,
        firstName: data.firstName ?? null,
        lastName: data.lastName ?? null,
        email: data.email ?? null
      };
      matches.push(match);
    });
  }

  return matches;
};

const askQuestion = (rl: readline.Interface, query: string): Promise<string> =>
  new Promise((resolve) => rl.question(query, resolve));

const promptManualConfirmation = async (
  rl: readline.Interface,
  candidate: NormalizedResult,
  matches: UserMatchCandidate[]
): Promise<ResolvedUser> => {
  if (matches.length === 0) {
    return { userId: null, matchedVia: 'none' };
  }

  const uniqueMatches = new Map<string, UserMatchCandidate>();
  matches.forEach((match) => {
    uniqueMatches.set(match.userId, match);
  });

  const entries = Array.from(uniqueMatches.values());

  const email = normalizeString(candidate.email) ?? '—';
  const name = buildNameKey(candidate.firstName, candidate.lastName) ?? '—';

  output.write('\n');
  output.write('Potential existing users found for:\n');
  output.write(`  Name: ${name}\n`);
  output.write(`  Email: ${email}\n`);
  output.write('Candidates:\n');
  entries.forEach((match, index) => {
    output.write(`  [${index + 1}] ${formatUserName(match)} <${match.email ?? '—'}> (userId=${match.userId})\n`);
  });

  const answer = await askQuestion(rl, 'Select user number, (n)one, or (s)kip [n]: ');
  const normalized = answer.trim().toLowerCase();

  if (!normalized || normalized === 'n' || normalized === 'none') {
    return { userId: null, matchedVia: 'none' };
  }

  if (normalized === 's' || normalized === 'skip') {
    return { userId: null, matchedVia: 'none' };
  }

  const index = Number.parseInt(normalized, 10);
  if (!Number.isFinite(index) || index < 1 || index > entries.length) {
    output.write('Invalid selection. Skipping.\n');
    return { userId: null, matchedVia: 'none' };
  }

  const chosen = entries[index - 1];
  return { userId: chosen.userId, matchedVia: 'manual-confirmation' };
};

const resolveUser = async (
  db: FirebaseFirestore.Firestore,
  rl: readline.Interface,
  candidate: NormalizedResult,
  options: ImportOptions
): Promise<ResolvedUser> => {
  const matches = await findExistingUsers(db, candidate);

  if (matches.length === 0) {
    return { userId: null, matchedVia: 'none' };
  }

  const nameKey = buildNameKey(candidate.firstName, candidate.lastName);
  const email = normalizeString(candidate.email)?.toLowerCase();

  const exactMatch = matches.find((match) => {
    const matchEmail = normalizeString(match.email)?.toLowerCase();
    const matchName = buildNameKey(match.firstName ?? null, match.lastName ?? null);
    return matchEmail && matchName && matchEmail === email && matchName === nameKey;
  });

  if (exactMatch) {
    return { userId: exactMatch.userId, matchedVia: 'email+name' };
  }

  if (options.force) {
    output.write('[WARN] Ambiguous user match but --force specified; leaving unresolved.\n');
    return { userId: null, matchedVia: 'none' };
  }

  return promptManualConfirmation(rl, candidate, matches);
};

const writeResultDocument = async (
  db: FirebaseFirestore.Firestore,
  candidate: NormalizedResult,
  userResolution: ResolvedUser,
  dryRun: boolean
): Promise<void> => {
  const docRef = db.collection('moResults').doc();

  if (dryRun) {
    output.write(`[DRY-RUN] Would write result ${docRef.id} for edition ${candidate.editionId}\n`);
    return;
  }

  const payload: Record<string, unknown> = {
    editionId: candidate.editionId,
    editionYear: candidate.editionYear,
    firstName: candidate.firstName,
    lastName: candidate.lastName,
    representing: candidate.representing,
    gender: candidate.gender,
    yearOfBirth: candidate.yearOfBirth,
    class: candidate.class,
    raceTime: candidate.raceTime,
    raceTimeSeconds: candidate.raceTimeSeconds,
    adjustedTime: candidate.adjustedTime ?? null,
    adjustedTimeSeconds: candidate.adjustedTimeSeconds ?? null,
    email: candidate.email ?? null,
    importBatchId: candidate.source.importBatchId,
    importedAt: admin.firestore.Timestamp.fromDate(candidate.source.importedAt),
    csvRowNumber: candidate.source.csvRowNumber,
    userResolution: userResolution.matchedVia,
    resolvedUserId: userResolution.userId,
    sourceCsv: candidate.source.csvFields
  };

  if (candidate.source.validation) {
    payload.__csvValidation = candidate.source.validation;
  }

  await docRef.set(payload);
  output.write(`Wrote result ${docRef.id} for edition ${candidate.editionId}\n`);
};

const main = async () => {
  const cliArgs = hideBin(process.argv);
  const explicitEnvArg = cliArgs.some((arg, index) => {
    if (arg === '--env') {
      return true;
    }
    if (arg.startsWith('--env=')) {
      return true;
    }
    // Handle "-env" styles (unlikely) or short aliases if added later
    if (arg === '-env') {
      return true;
    }
    // When args are like "--env" followed by value, the detection above already caught it.
    return false;
  });

  const parser = yargs(cliArgs)
    .option('env', {
      type: 'string',
      choices: ['test', 'prod'],
      default: 'test',
      describe: 'Firebase project environment to target'
    })
    .option('file', {
      type: 'string',
      describe: 'Path to MO competition CSV export',
      demandOption: true
    })
    .option('dry-run', {
      type: 'boolean',
      default: false,
      describe: 'Only simulate import, no writes'
    })
    .option('include-validation', {
      type: 'boolean',
      default: false,
      describe: 'Store CSV factor fields under __csvValidation for later comparison'
    })
    .option('start-year', {
      type: 'number',
      describe: 'Restrict import to editions >= year'
    })
    .option('end-year', {
      type: 'number',
      describe: 'Restrict import to editions <= year'
    })
    .option('force', {
      type: 'boolean',
      default: false,
      describe: 'Skip interactive confirmation prompts'
    });

  const argv = await (parser as any).parseAsync();

  const options: ImportOptions = {
    env: argv.env as ImportOptions['env'],
    file: path.resolve(argv.file),
    dryRun: Boolean(argv['dry-run']),
    includeValidation: Boolean(argv['include-validation']),
    startYear: argv['start-year'],
    endYear: argv['end-year'],
    force: Boolean(argv.force),
    explicitEnv: explicitEnvArg
  };

  await initFirebase({ env: options.env, explicitEnv: options.explicitEnv });
  const db = admin.firestore();

  const batchId = `mo-import-${Date.now()}`;
  output.write(`Starting import with batchId ${batchId}\n`);

  const csvRows = await readCsv(options.file);
  output.write(`Parsed ${csvRows.length} rows from CSV\n`);

  const rl = readline.createInterface({ input, output });

  let processed = 0;
  let skipped = 0;
  let matchedExisting = 0;
  let manualMatches = 0;
  let unmatched = 0;

  for (let index = 0; index < csvRows.length; index += 1) {
    const row = csvRows[index];
    const normalized = normalizeCsvRow(row, index + 1, options, batchId);
    if (!normalized) {
      skipped += 1;
      continue;
    }

    let userResolution: ResolvedUser = { userId: null, matchedVia: 'none' };

    if (!options.dryRun) {
      userResolution = await resolveUser(db, rl, normalized, options);
      if (userResolution.matchedVia === 'email+name') {
        matchedExisting += 1;
      } else if (userResolution.matchedVia === 'manual-confirmation') {
        manualMatches += 1;
      } else {
        unmatched += 1;
      }
    }

    await writeResultDocument(db, normalized, userResolution, options.dryRun);
    processed += 1;
  }

  await rl.close();
  output.write('\n');
  output.write('Import summary:\n');
  output.write(`  Processed rows: ${processed}\n`);
  output.write(`  Skipped rows:   ${skipped}\n`);
  output.write(`  Auto-matched users: ${matchedExisting}\n`);
  output.write(`  Manual matches:    ${manualMatches}\n`);
  output.write(`  Unmatched users:   ${unmatched}\n`);

  if (options.dryRun) {
    output.write('\nDry-run completed. No data written.\n');
  }

  process.exit(0);
};

main().catch((error) => {
  console.error('Import failed:', error);
  process.exit(1);
});
