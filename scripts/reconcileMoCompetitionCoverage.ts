#!/usr/bin/env ts-node

import path from 'node:path';
import fs from 'node:fs/promises';
import os from 'node:os';
import readline from 'node:readline';
import yargs from 'yargs/yargs';
import { hideBin } from 'yargs/helpers';
import admin from 'firebase-admin';

interface ImportOptions {
  env: 'test' | 'prod';
  coverageReport: string;
  output: string;
  startIndex: number;
  limit?: number;
  maxCandidates: number;
  explicitEnv: boolean;
}

interface RawCoverageReport {
  missing: CoverageMissingEntry[];
  summary?: unknown;
  [key: string]: unknown;
}

interface CoverageMissingEntry {
  editionId: string;
  editionYear: number;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  rowNumber: number;
  reason: 'missing-email' | 'missing-name' | 'no-match';
  csvFields: Record<string, string | null>;
}

interface ClassifiedEntry extends CoverageMissingEntry {
  classification:
    | 'data-mismatch'
    | 'missing-result'
    | 'csv-extra'
    | 'manual'
    | 'unknown';
  note?: string;
  matchedDocId?: string;
  matchedDocScore?: number;
  reviewedAt: string;
  gender?: 'Male' | 'Female';
}

interface ReconciliationOutput {
  generatedAt: string;
  env: ImportOptions['env'];
  coverageReport: string;
  classifications: ClassifiedEntry[];
}

interface CandidateDoc {
  docId: string;
  editionId: string;
  editionYear: number;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  class: string | null;
  raceTime: string | null;
  userResolution: string | null;
  resolvedUserId: string | null;
  similarity: number;
}

const CLASSIFICATION_CHOICES: { key: ClassifiedEntry['classification']; label: string }[] = [
  { key: 'data-mismatch', label: 'Match exists but data differs (name/email variation)' },
  { key: 'missing-result', label: 'Result missing from moResults (needs import)' },
  { key: 'csv-extra', label: 'Adelskalender entry should be ignored' },
  { key: 'manual', label: 'Handled manually (outside moResults)' },
  { key: 'unknown', label: 'Other / needs further investigation' }
];

const sanitizeString = (value: unknown): string | null => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const normalizeForComparison = (value: string | null | undefined): string | null => {
  if (!value) return null;
  return value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim();
};

const levenshteinSimilarity = (a: string | null, b: string | null): number => {
  const normalizedA = normalizeForComparison(a);
  const normalizedB = normalizeForComparison(b);
  if (!normalizedA || !normalizedB) return 0;
  if (normalizedA === normalizedB) return 1;

  const lenA = normalizedA.length;
  const lenB = normalizedB.length;
  const dp: number[][] = Array.from({ length: lenA + 1 }, () => new Array(lenB + 1).fill(0));

  for (let i = 0; i <= lenA; i += 1) dp[i][0] = i;
  for (let j = 0; j <= lenB; j += 1) dp[0][j] = j;

  for (let i = 1; i <= lenA; i += 1) {
    for (let j = 1; j <= lenB; j += 1) {
      const cost = normalizedA[i - 1] === normalizedB[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost
      );
    }
  }

  const distance = dp[lenA][lenB];
  const maxLen = Math.max(lenA, lenB);
  return maxLen === 0 ? 1 : 1 - distance / maxLen;
};

const computeCandidateScore = (
  entry: CoverageMissingEntry,
  candidate: FirebaseFirestore.DocumentData
): number => {
  const entryFirst = sanitizeString(entry.firstName);
  const entryLast = sanitizeString(entry.lastName);
  const entryEmail = normalizeForComparison(entry.email);

  const candidateFirst = sanitizeString(candidate.firstName);
  const candidateLast = sanitizeString(candidate.lastName);
  const candidateEmail = normalizeForComparison(candidate.email);

  let score = 0;

  if (entryEmail && candidateEmail) {
    if (entryEmail === candidateEmail) {
      score += 1.5;
    } else if (candidateEmail.includes(entryEmail) || entryEmail.includes(candidateEmail)) {
      score += 0.75;
    }
  }

  const firstScore = levenshteinSimilarity(entryFirst, candidateFirst);
  const lastScore = levenshteinSimilarity(entryLast, candidateLast);

  score += firstScore * 0.5 + lastScore * 0.7;

  return score;
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

const loadCoverageReport = async (reportPath: string): Promise<CoverageMissingEntry[]> => {
  const content = await fs.readFile(reportPath, 'utf8');
  const parsed = JSON.parse(content) as RawCoverageReport;
  if (!parsed.missing || !Array.isArray(parsed.missing)) {
    throw new Error('Coverage report missing "missing" array.');
  }
  return parsed.missing as CoverageMissingEntry[];
};

const loadExistingOutput = async (outputPath: string): Promise<ReconciliationOutput | null> => {
  try {
    const content = await fs.readFile(outputPath, 'utf8');
    const parsed = JSON.parse(content) as ReconciliationOutput;
    if (!parsed.classifications || !Array.isArray(parsed.classifications)) {
      return null;
    }
    return parsed;
  } catch (error) {
    return null;
  }
};

const createReadlineInterface = () =>
  readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

const askQuestion = (rl: readline.Interface, query: string): Promise<string> =>
  new Promise((resolve) => rl.question(query, resolve));

const formatCandidateLine = (index: number, candidate: CandidateDoc): string => {
  const name = [candidate.firstName ?? '', candidate.lastName ?? ''].join(' ').trim() || '—';
  const email = candidate.email ?? '—';
  const raceTime = candidate.raceTime ?? '—';
  const className = candidate.class ?? '—';
  const userResolution = candidate.userResolution ?? '—';
  return `  [${index}] score=${candidate.similarity.toFixed(2)} docId=${candidate.docId} | ${name} <${email}> | class=${className} | raceTime=${raceTime} | resolution=${userResolution}`;
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
      describe: 'Path to coverage-report JSON file',
      demandOption: true
    })
    .option('output', {
      type: 'string',
      describe: 'Path to reconciliation output JSON',
      demandOption: true
    })
    .option('start-index', {
      type: 'number',
      describe: 'Zero-based index of missing entries to start from',
      default: 0
    })
    .option('limit', {
      type: 'number',
      describe: 'Process only this many entries'
    })
    .option('max-candidates', {
      type: 'number',
      describe: 'Maximum number of candidate matches to display',
      default: 5
    });

  const argv = await (parser as any).parseAsync();

  const options: ImportOptions = {
    env: argv.env as ImportOptions['env'],
    coverageReport: path.resolve(argv.report),
    output: path.resolve(argv.output),
    startIndex: Number.isFinite(argv['start-index']) ? Number(argv['start-index']) : 0,
    limit: Number.isFinite(argv.limit) ? Number(argv.limit) : undefined,
    maxCandidates: Number.isFinite(argv['max-candidates']) ? Number(argv['max-candidates']) : 5,
    explicitEnv: explicitEnvArg
  };

  await initFirebase({ env: options.env, explicitEnv: options.explicitEnv });
  const db = admin.firestore();

  const missingEntries = await loadCoverageReport(options.coverageReport);

  const existingOutput = await loadExistingOutput(options.output);
  const classifications = existingOutput?.classifications ?? [];
  const processedKeys = new Set(classifications.map((entry) => `${entry.editionId}#${entry.rowNumber}`));

  const rl = createReadlineInterface();

  const editionCache = new Map<string, FirebaseFirestore.QuerySnapshot<FirebaseFirestore.DocumentData>>();

  const saveOutput = async () => {
    const payload: ReconciliationOutput = {
      generatedAt: new Date().toISOString(),
      env: options.env,
      coverageReport: options.coverageReport,
      classifications
    };
    await fs.writeFile(options.output, JSON.stringify(payload, null, 2), 'utf8');
  };

  const total = missingEntries.length;
  let processed = 0;
  for (let index = options.startIndex; index < missingEntries.length; index += 1) {
    if (options.limit !== undefined && processed >= options.limit) {
      break;
    }

    const entry = missingEntries[index];
    const entryKey = `${entry.editionId}#${entry.rowNumber}`;

    if (processedKeys.has(entryKey)) {
      continue;
    }

    processed += 1;

    console.log('\n================================================');
    console.log(`Entry ${index + 1} of ${total}`);
    console.log(`Edition: ${entry.editionId}`);
    console.log(`CSV Row: ${entry.rowNumber}`);
    console.log(`Reason: ${entry.reason}`);
    console.log(`Name: ${(entry.firstName ?? '—')} ${(entry.lastName ?? '—')}`);
    console.log(`Email: ${entry.email ?? '—'}`);

    let snapshot = editionCache.get(entry.editionId);
    if (!snapshot) {
      snapshot = await db.collection('moResults').where('editionId', '==', entry.editionId).get();
      editionCache.set(entry.editionId, snapshot);
    }

    const candidates: CandidateDoc[] = snapshot.docs
      .map((doc) => {
        const data = doc.data();
        return {
          docId: doc.id,
          editionId: data.editionId ?? entry.editionId,
          editionYear: data.editionYear ?? entry.editionYear,
          firstName: sanitizeString(data.firstName),
          lastName: sanitizeString(data.lastName),
          email: sanitizeString(data.email),
          class: sanitizeString(data.class),
          raceTime: sanitizeString(data.raceTime),
          userResolution: sanitizeString(data.userResolution),
          resolvedUserId: sanitizeString(data.resolvedUserId),
          similarity: computeCandidateScore(entry, data)
        };
      })
      .filter((candidate) => candidate.similarity > 0)
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, options.maxCandidates);

    if (candidates.length > 0) {
      console.log('\nCandidate matches:');
      candidates.forEach((candidate, idx) => {
        console.log(formatCandidateLine(idx + 1, candidate));
      });
    } else {
      console.log('\nNo candidate matches found for this edition.');
    }

    let chosenCandidate: CandidateDoc | undefined;

    while (true) {
      const selection = await askQuestion(
        rl,
        '\nSelect matching doc number, (n)o match, (s)kip, or (q)uit [n]: '
      );
      const normalized = selection.trim().toLowerCase();

      if (!normalized || normalized === 'n' || normalized === 'no') {
        break;
      }

      if (normalized === 's' || normalized === 'skip') {
        console.log('Skipping entry without classification.');
        chosenCandidate = undefined;
        break;
      }

      if (normalized === 'q' || normalized === 'quit') {
        console.log('Quitting reconciliation.');
        await saveOutput();
        rl.close();
        process.exit(0);
      }

      const indexSelection = Number.parseInt(normalized, 10);
      if (Number.isFinite(indexSelection) && indexSelection >= 1 && indexSelection <= candidates.length) {
        chosenCandidate = candidates[indexSelection - 1];
        console.log(`Selected docId=${chosenCandidate.docId}`);
        break;
      }

      console.log('Invalid selection. Please choose again.');
    }

    let classification: ClassifiedEntry['classification'] | undefined;
    if (chosenCandidate) {
      classification = 'data-mismatch';
      console.log('Defaulting classification to data-mismatch (existing document selected).');
    }

    while (!classification) {
      console.log('\nClassification options:');
      CLASSIFICATION_CHOICES.forEach((choice, idx) => {
        console.log(`  [${idx + 1}] ${choice.label}`);
      });
      const answer = await askQuestion(rl, 'Choose classification [1-5] (or (s)kip, (q)uit): ');
      const normalized = answer.trim().toLowerCase();

      if (normalized === 's' || normalized === 'skip') {
        console.log('Skipping entry without classification.');
        classification = undefined;
        break;
      }

      if (normalized === 'q' || normalized === 'quit') {
        console.log('Quitting reconciliation.');
        await saveOutput();
        rl.close();
        process.exit(0);
      }

      const choiceIndex = Number.parseInt(normalized, 10);
      if (Number.isFinite(choiceIndex) && choiceIndex >= 1 && choiceIndex <= CLASSIFICATION_CHOICES.length) {
        classification = CLASSIFICATION_CHOICES[choiceIndex - 1].key;
      } else {
        console.log('Invalid selection. Try again.');
      }
    }

    if (!classification) {
      console.log('Entry was skipped. No classification saved.');
      continue;
    }

    const note = await askQuestion(rl, 'Optional note (enter to skip): ');
    const trimmedNote = note.trim().length > 0 ? note.trim() : undefined;

    const classifiedEntry: ClassifiedEntry = {
      ...entry,
      classification,
      note: trimmedNote,
      matchedDocId: chosenCandidate?.docId,
      matchedDocScore: chosenCandidate?.similarity,
      reviewedAt: new Date().toISOString()
    };

    if (classification === 'unknown') {
      let gender: 'Male' | 'Female' | undefined;
      while (!gender) {
        const genderAnswer = await askQuestion(rl, 'Specify gender for DNS entry (m/f): ');
        const normalizedGender = genderAnswer.trim().toLowerCase();
        if (normalizedGender === 'm' || normalizedGender === 'male' || normalizedGender === 'mann') {
          gender = 'Male';
        } else if (normalizedGender === 'f' || normalizedGender === 'female' || normalizedGender === 'kvinner' || normalizedGender === 'kvinne') {
          gender = 'Female';
        } else {
          console.log('Please enter "m" for male or "f" for female.');
        }
      }
      classifiedEntry.gender = gender;
    }

    classifications.push(classifiedEntry);
    processedKeys.add(entryKey);

    await saveOutput();
    console.log('Classification saved.');
  }

  await saveOutput();
  rl.close();

  console.log('\nReconciliation complete.');
};

main().catch((error) => {
  console.error('Reconciliation helper failed:', error);
  process.exit(1);
});
