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
  includeTypes: Set<'tur' | 'trim' | 'volunteer'>;
  startYear?: number;
  endYear?: number;
  force: boolean;
  interactive: boolean;
  explicitEnv: boolean;
}

interface ParticipationRecord {
  editionId: string;
  editionYear: number;
  participationType: 'tur' | 'trim' | 'volunteer';
  firstName: string | null;
  lastName: string | null;
  representing: string[];
  email?: string | null;
  yearOfBirth: number | null;
  shield?: string | null;
  source: {
    importBatchId: string;
    importedAt: Date;
    csvRowNumber: number;
    csvFields: Record<string, string | null>;
    classCode: ParticipationLetter;
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
  matchedVia: 'email+name' | 'manual-confirmation' | 'auto-email' | 'none';
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

const buildRepresenting = (club: string | null): string[] => {
  return club ? [club] : [];
};

const buildNameKey = (firstName: string | null, lastName: string | null): string | null => {
  const first = normalizeString(firstName);
  const last = normalizeString(lastName);
  if (!first && !last) return null;
  return [first ?? '', last ?? ''].join(' ').trim().toLowerCase();
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

const findExistingUsers = async (
  db: FirebaseFirestore.Firestore,
  firstName: string | null,
  lastName: string | null,
  email: string | null
): Promise<UserMatchCandidate[]> => {
  const matches: UserMatchCandidate[] = [];

  const nameKey = buildNameKey(firstName, lastName);
  const normalizedEmail = normalizeString(email)?.toLowerCase();

  if (normalizedEmail) {
    const emailSnap = await db
      .collection('users')
      .where('email', '==', normalizedEmail)
      .get();
    emailSnap.forEach((doc) => {
      const data = doc.data() as Partial<UserMatchCandidate>;
      matches.push({
        userId: doc.id,
        firstName: data.firstName ?? null,
        lastName: data.lastName ?? null,
        email: data.email ?? null
      });
    });
  }

  if (nameKey) {
    const nameSnap = await db
      .collection('users')
      .where('searchName', '==', nameKey)
      .get();
    nameSnap.forEach((doc) => {
      const data = doc.data() as Partial<UserMatchCandidate>;
      matches.push({
        userId: doc.id,
        firstName: data.firstName ?? null,
        lastName: data.lastName ?? null,
        email: data.email ?? null
      });
    });
  }

  return matches;
};

const askQuestion = (rl: readline.Interface, query: string): Promise<string> =>
  new Promise((resolve) => rl.question(query, resolve));

const resolveUser = async (
  db: FirebaseFirestore.Firestore,
  rl: readline.Interface | null,
  record: ParticipationRecord,
  options: ImportOptions
): Promise<ResolvedUser> => {
  const matches = await findExistingUsers(db, record.firstName, record.lastName, record.email ?? null);

  if (matches.length === 0) {
    return { userId: null, matchedVia: 'none' };
  }

  const email = normalizeString(record.email)?.toLowerCase();
  const nameKey = buildNameKey(record.firstName, record.lastName);

  const exactMatch = matches.find((match) => {
    const matchEmail = normalizeString(match.email)?.toLowerCase();
    const matchName = buildNameKey(match.firstName ?? null, match.lastName ?? null);
    return matchEmail && matchName && matchEmail === email && matchName === nameKey;
  });

  if (exactMatch) {
    return { userId: exactMatch.userId, matchedVia: 'email+name' };
  }

  if (!options.interactive || options.force) {
    return { userId: null, matchedVia: 'none' };
  }

  if (!rl) {
    return { userId: null, matchedVia: 'none' };
  }

  output.write('\n');
  output.write('Potential existing users found for participation record:\n');
  output.write(`  Name: ${nameKey ?? '—'}\n`);
  output.write(`  Email: ${email ?? '—'}\n`);
  output.write('Candidates:\n');
  matches.forEach((match, index) => {
    const candidateName = [normalizeString(match.firstName) ?? '', normalizeString(match.lastName) ?? '']
      .join(' ')
      .trim();
    output.write(`  [${index + 1}] ${candidateName || '—'} <${match.email ?? '—'}> (userId=${match.userId})\n`);
  });

  const answer = await askQuestion(rl, 'Select user number, (n)one, or (s)kip [n]: ');
  const normalized = answer.trim().toLowerCase();

  if (!normalized || normalized === 'n' || normalized === 'none' || normalized === 's' || normalized === 'skip') {
    return { userId: null, matchedVia: 'none' };
  }

  const index = Number.parseInt(normalized, 10);
  if (!Number.isFinite(index) || index < 1 || index > matches.length) {
    output.write('Invalid selection. Skipping.\n');
    return { userId: null, matchedVia: 'none' };
  }

  const chosen = matches[index - 1];
  return { userId: chosen.userId, matchedVia: 'manual-confirmation' };
};

type ParticipationLetter = 'M' | 'T' | 'F';

type ClassCodeMapping = {
  letter: ParticipationLetter;
  type: 'tur' | 'trim' | 'volunteer';
};

const mapLetterToParticipation = (letter: string): ClassCodeMapping | null => {
  if (letter === 'M') return { letter, type: 'tur' };
  if (letter === 'T') return { letter, type: 'trim' };
  if (letter === 'F') return { letter, type: 'volunteer' };
  return null;
};

const extractParticipationMappings = (cellValue: string | null | undefined): ClassCodeMapping[] => {
  const normalized = normalizeString(cellValue);
  if (!normalized) return [];

  const letters = normalized
    .toUpperCase()
    .split('')
    .filter((char) => /[A-ZÅÆØ]/.test(char));

  const seen = new Set<string>();
  const mappings: ClassCodeMapping[] = [];

  letters.forEach((char) => {
    if (seen.has(char)) {
      return;
    }
    seen.add(char);
    const mapping = mapLetterToParticipation(char);
    if (mapping) {
      mappings.push(mapping);
    }
  });

  return mappings;
};

const buildParticipationRecords = (
  row: RawCsvRow,
  rowNumber: number,
  options: ImportOptions,
  batchId: string
): ParticipationRecord[] => {
  const firstName = normalizeString(row['Fornavn']) ?? null;
  const lastName = normalizeString(row['Etternavn']) ?? null;
  const representing = buildRepresenting(normalizeString(row['Klubb/sted']));
  const email = normalizeString(row['Mail']);
  const yearOfBirth = parseIntStrict(row['Fødselsår']);
  const shield = normalizeString(row['Skjold']);

  const sanitizedFields = sanitizeCsvFields(row);

  const records: ParticipationRecord[] = [];

  YEAR_COLUMNS.forEach((yearColumn) => {
    const year = Number.parseInt(yearColumn, 10);
    if ((options.startYear && year < options.startYear) || (options.endYear && year > options.endYear)) {
      return;
    }

    const mappings = extractParticipationMappings(row[yearColumn]);

    mappings.forEach((mapping) => {
      if (!options.includeTypes.has(mapping.type)) {
        return;
      }

      const editionId = `mo-${year}`;

      records.push({
        editionId,
        editionYear: year,
        participationType: mapping.type,
        firstName,
        lastName,
        representing,
        email,
        yearOfBirth,
        shield,
        source: {
          importBatchId: batchId,
          importedAt: new Date(),
          csvRowNumber: rowNumber,
          csvFields: sanitizedFields,
          classCode: mapping.letter
        }
      });
    });
  });

  return records;
};

const writeParticipationDocument = async (
  db: FirebaseFirestore.Firestore,
  record: ParticipationRecord,
  userResolution: ResolvedUser,
  dryRun: boolean
): Promise<void> => {
  const docRef = db.collection('moResults').doc();

  if (dryRun) {
    output.write(
      `[DRY-RUN] Would write ${record.participationType} participation ${docRef.id} for edition ${record.editionId}\n`
    );
    return;
  }

  const payload: Record<string, unknown> = {
    editionId: record.editionId,
    editionYear: record.editionYear,
    class: record.participationType,
    participationType: record.participationType,
    firstName: record.firstName,
    lastName: record.lastName,
    representing: record.representing,
    yearOfBirth: record.yearOfBirth,
    email: record.email ?? null,
    shield: record.shield ?? null,
    raceTime: null,
    raceTimeSeconds: null,
    importBatchId: record.source.importBatchId,
    importedAt: admin.firestore.Timestamp.fromDate(record.source.importedAt),
    csvRowNumber: record.source.csvRowNumber,
    userResolution: userResolution.matchedVia,
    resolvedUserId: userResolution.userId,
    sourceCsv: record.source.csvFields,
    sourceClassCode: record.source.classCode
  };

  await docRef.set(payload);
  output.write(`Wrote ${record.participationType} participation ${docRef.id} for edition ${record.editionId}\n`);
};

const parseTypes = (value: string | string[] | undefined): Set<'tur' | 'trim' | 'volunteer'> => {
  if (!value) {
    return new Set(['tur', 'trim', 'volunteer']);
  }

  const values = Array.isArray(value) ? value : value.split(',');
  const normalized = values
    .map((item) => item.trim().toLowerCase())
    .filter((item) => item === 'tur' || item === 'trim' || item === 'volunteer');

  return normalized.length > 0 ? new Set(normalized as ('tur' | 'trim' | 'volunteer')[]) : new Set(['tur', 'trim', 'volunteer']);
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
    .option('dry-run', {
      type: 'boolean',
      default: false,
      describe: 'Only simulate import, no writes'
    })
    .option('types', {
      type: 'string',
      describe: 'Comma separated list of participation types to include (tur,trim,volunteer)'
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
    })
    .option('interactive', {
      type: 'boolean',
      default: false,
      describe: 'Prompt for resolving ambiguous user matches'
    });

  const argv = await (parser as any).parseAsync();

  const options: ImportOptions = {
    env: argv.env as ImportOptions['env'],
    file: path.resolve(argv.file),
    dryRun: Boolean(argv['dry-run']),
    includeTypes: parseTypes(argv.types),
    startYear: argv['start-year'],
    endYear: argv['end-year'],
    force: Boolean(argv.force),
    interactive: Boolean(argv.interactive),
    explicitEnv: explicitEnvArg
  };

  await initFirebase({ env: options.env, explicitEnv: options.explicitEnv });
  const db = admin.firestore();

  const batchId = `mo-participation-import-${Date.now()}`;
  output.write(`Starting participation import with batchId ${batchId}\n`);

  const csvRows = await readCsv(options.file);
  output.write(`Parsed ${csvRows.length} rows from CSV\n`);

  const rl = options.interactive ? readline.createInterface({ input, output }) : null;

  let totalCreated = 0;
  let turCount = 0;
  let trimCount = 0;
  let volunteerCount = 0;

  for (let index = 0; index < csvRows.length; index += 1) {
    const row = csvRows[index];
    const records = buildParticipationRecords(row, index + 1, options, batchId);

    for (const record of records) {
      let userResolution: ResolvedUser = { userId: null, matchedVia: 'none' };
      if (!options.dryRun) {
        userResolution = await resolveUser(db, rl, record, options);
      }

      await writeParticipationDocument(db, record, userResolution, options.dryRun);
      totalCreated += 1;

      if (record.participationType === 'tur') {
        turCount += 1;
      } else if (record.participationType === 'trim') {
        trimCount += 1;
      } else if (record.participationType === 'volunteer') {
        volunteerCount += 1;
      }
    }
  }

  if (rl) {
    await rl.close();
  }

  output.write('\nParticipation import summary:\n');
  output.write(`  Created records: ${totalCreated}\n`);
  output.write(`  Tur entries:    ${turCount}\n`);
  output.write(`  Trim entries:   ${trimCount}\n`);
  output.write(`  Volunteer entries: ${volunteerCount}\n`);

  if (options.dryRun) {
    output.write('\nDry-run completed. No data written.\n');
  }

  process.exit(0);
};

main().catch((error) => {
  console.error('Participation import failed:', error);
  process.exit(1);
});
