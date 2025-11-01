import { collection, getDocs, orderBy, query, where, QueryDocumentSnapshot, DocumentData } from 'firebase/firestore';
import { db } from '../config/firebase';
import { formatSeconds1d } from '../utils/format';
import { computeAdjustedTime, loadTimeGradingFactors, TimeGradingFactorMap } from './timeGrading';

export interface MOEventEditionSummary {
  id: string;
  edition: number;
  startTime: Date | null;
  endTime: Date | null;
  status: string;
  resultsStatus: string;
  resultURL?: string;
}

export interface MOEventEditionNav extends MOEventEditionSummary {
  isoDate?: string;
}

export type MOResultClass = 'konkurranse' | 'trim_tidtaking' | 'turklasse' | string;
export type MOResultGender = 'Male' | 'Female' | string;
export type MORankingMode = 'time' | 'adjusted';

export interface MOResultEntry {
  id: string;
  editionId: string;
  editionYear?: number | null;
  userId?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  fullName: string;
  class: MOResultClass;
  gender?: MOResultGender | null;
  status?: string | null;
  timeSeconds?: number | null;
  timeDisplay?: string | null;
  adjustedSeconds?: number | null;
  adjustedDisplay?: string | null;
  rankTime?: number | null;
  rankAdjusted?: number | null;
  representing?: string[] | string | null;
  age?: number | null;
  yearOfBirth?: number | null;
}

export interface MOEditionResultsOptions {
  classFilter?: MOResultClass | 'all';
  genderFilter?: MOResultGender | 'all';
  ranking?: MORankingMode;
}

export interface MOTimeRecordEntry {
  runnerKey: string;
  userId?: string | null;
  fullName: string;
  gender: MOResultGender | null;
  editionId: string;
  editionYear?: number | null;
  timeSeconds: number;
  timeDisplay: string;
  adjustedSeconds?: number | null;
  adjustedDisplay?: string | null;
  status?: string | null;
  age?: number | null;
  representing?: string[] | string | null;
}

export interface MOAppearanceRecord {
  runnerKey: string;
  userId?: string | null;
  fullName: string;
  gender: MOResultGender | null;
  appearances: number;
  firstYear?: number | null;
  lastYear?: number | null;
}

export interface MOParticipationSummary {
  editionId: string;
  editionYear?: number | null;
  totalCompetition: number;
  totalOverall: number;
}

export interface MOYearlyClassStats {
  editionId: string;
  editionYear: number | null;
  competitionFinished: number;
  competitionDnf: number;
  competitionDns: number;
  trimCount: number;
  turCount: number;
  volunteerCount: number;
  total: number;
}

export interface MORecordsResult {
  fastestMen: MOTimeRecordEntry[];
  fastestWomen: MOTimeRecordEntry[];
  fastestAGG: MOTimeRecordEntry[];
  mostAppearances: MOAppearanceRecord[];
  topParticipationCompetition: MOParticipationSummary[];
  topParticipationOverall: MOParticipationSummary[];
  yearlyClassStats: MOYearlyClassStats[];
}

const toDate = (value: any): Date | null => {
  if (!value) {
    return null;
  }
  if (value instanceof Date) {
    return value;
  }
  if (typeof value.toDate === 'function') {
    try {
      return value.toDate();
    } catch (error) {
      console.warn('[MO Results] Failed to convert Firestore Timestamp to Date', error);
      return null;
    }
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

export const listMoEventEditions = async (): Promise<MOEventEditionSummary[]> => {
  const editionsRef = collection(db, 'eventEditions');
  const q = query(editionsRef, where('eventId', '==', 'mo'), orderBy('edition', 'desc'));
  const snapshot = await getDocs(q);

  return snapshot.docs.map((docSnap) => {
    const data = docSnap.data() as any;
    return {
      id: docSnap.id,
      edition: typeof data.edition === 'number' ? data.edition : Number.parseInt(String(data.edition), 10),
      startTime: toDate(data.startTime),
      endTime: toDate(data.endTime),
      status: data.status || '',
      resultsStatus: data.resultsStatus || '',
      resultURL: data.resultURL || undefined
    } as MOEventEditionSummary;
  });
};

const toIso = (value: Date | null | undefined): string | undefined =>
  value ? value.toISOString() : undefined;

export const findEditionWithNeighbors = async (
  editionId: string
): Promise<{
  current: MOEventEditionNav | null;
  previous: MOEventEditionSummary | null;
  next: MOEventEditionSummary | null;
}> => {
  const editions = await listMoEventEditions();
  if (editions.length === 0) {
    return { current: null, previous: null, next: null };
  }
  const index = editions.findIndex((item) => item.id === editionId);
  if (index === -1) {
    return { current: null, previous: null, next: null };
  }
  const current = editions[index];
  const previous = index < editions.length - 1 ? editions[index + 1] : null;
  const next = index > 0 ? editions[index - 1] : null;
  return {
    current: current ? { ...current, isoDate: toIso(current.startTime) } : null,
    previous,
    next
  };
};

const normalizeString = (value: unknown): string | null => {
  if (value === undefined || value === null) {
    return null;
  }
  const str = String(value).trim();
  return str.length > 0 ? str : null;
};

const normalizeNameKey = (value: string | null | undefined): string | null => {
  if (!value) {
    return null;
  }
  return value
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
};

const normalizeClass = (value: unknown): MOResultClass => {
  const str = normalizeString(value)?.toLowerCase();
  if (!str) return '';
  if (str === 'konkurranse' || str === 'competition') return 'konkurranse';
  if (str === 'trim' || str === 'trim_tidtaking' || str === 'trimmedtidtaking' || str === 'timed') return 'trim_tidtaking';
  if (str === 'tur' || str === 'turklasse' || str === 'mosjon' || str === 'hike') return 'turklasse';
  if (str === 'volunteer') return '';
  return str;
};

const normalizeGender = (value: unknown): MOResultGender | null => {
  const str = normalizeString(value)?.toLowerCase();
  if (!str) return null;
  if (str === 'male' || str === 'm' || str === 'menn') return 'Male';
  if (str === 'female' || str === 'f' || str === 'kvinner') return 'Female';
  return str;
};

const toNumber = (value: unknown): number | null => {
  if (value === undefined || value === null) {
    return null;
  }
  const normalized = typeof value === 'number' ? value : Number(String(value).replace(',', '.'));
  return Number.isFinite(normalized) ? normalized : null;
};

const extractEditionYear = (rawId: string | null | undefined): number | null => {
  if (!rawId) {
    return null;
  }
  const match = rawId.match(/(\d{4})$/);
  if (!match) {
    return null;
  }
  const year = Number(match[1]);
  return Number.isFinite(year) ? year : null;
};

const compareNumbers = (a: number | null | undefined, b: number | null | undefined): number => {
  const numA = toNumber(a);
  const numB = toNumber(b);
  if (numA === null && numB === null) return 0;
  if (numA === null) return 1;
  if (numB === null) return -1;
  if (numA < numB) return -1;
  if (numA > numB) return 1;
  return 0;
};

const getStatusPriority = (status: string | null | undefined): number => {
  if (!status) return 0;
  const normalized = status.toUpperCase();
  if (normalized === 'DNF') return 1;
  if (normalized === 'DNS') return 2;
  return 0;
};

const sortCompetitionEntries = (entries: MOResultEntry[], ranking: MORankingMode): MOResultEntry[] => {
  const sorted = entries
    .slice()
    .sort((a, b) => {
      const priorityDiff = getStatusPriority(a.status) - getStatusPriority(b.status);
      if (priorityDiff !== 0) {
        return priorityDiff;
      }

      if (ranking === 'adjusted') {
        const adjustedDiff = compareNumbers(a.adjustedSeconds, b.adjustedSeconds);
        if (adjustedDiff !== 0) {
          return adjustedDiff;
        }
      }

      const timeDiff = compareNumbers(a.timeSeconds, b.timeSeconds);
      if (timeDiff !== 0) {
        return timeDiff;
      }

      return a.fullName.localeCompare(b.fullName, 'nb', { sensitivity: 'base' });
    });

  let timeRank = 1;
  let adjustedRank = 1;

  return sorted.map((entry) => {
    const priority = getStatusPriority(entry.status);
    const clone: MOResultEntry = { ...entry };

    if (priority === 0) {
      const timeValue = toNumber(entry.timeSeconds);
      const adjustedValue = toNumber(entry.adjustedSeconds);
      clone.rankTime = timeValue !== null ? timeRank++ : null;
      clone.rankAdjusted = adjustedValue !== null ? adjustedRank++ : null;
    } else {
      clone.rankTime = null;
      clone.rankAdjusted = null;
    }

    return clone;
  });
};

const buildFullName = (firstName?: string | null, lastName?: string | null): string => {
  const primary = normalizeString(firstName);
  const secondary = normalizeString(lastName);
  if (primary && secondary) return `${primary} ${secondary}`;
  return primary || secondary || '';
};

const canonicalizeClass = (rawClass: MOResultClass): MOResultClass => {
  const normalized = normalizeClass(rawClass);
  if (!normalized && rawClass) {
    const value = rawClass.toLowerCase();
    if (value.includes('funksjon') || value.includes('vol')) {
      return '';
    }
  }
  return normalized;
};

const buildRunnerKey = (entry: MOResultEntry): string | null => {
  if (entry.userId) {
    return entry.userId;
  }
  const nameKey = normalizeNameKey(entry.fullName);
  if (!nameKey) {
    return null;
  }
  const birthYear = toNumber(entry.yearOfBirth);
  if (birthYear != null) {
    return `${nameKey}|${birthYear}`;
  }
  return nameKey;
};

const isDnsStatus = (status: string | null | undefined): boolean => {
  if (!status) {
    return false;
  }
  return status.toUpperCase() === 'DNS';
};

const mapResultDoc = (
  docSnap: QueryDocumentSnapshot<DocumentData>,
  factorMap: TimeGradingFactorMap | null
): MOResultEntry => {
  const data = docSnap.data() as any;
  const firstName = data.firstName ?? data.fornavn ?? null;
  const lastName = data.lastName ?? data.etternavn ?? data.surname ?? null;
  const resultClass = normalizeClass(data.class ?? data.klasse);
  const gender = normalizeGender(data.gender ?? data.kjonn);
  const gradingGender = gender === 'Male' || gender === 'Female' ? gender : null;
  const raceTimeSeconds = toNumber(data.timeSeconds ?? data.raceTimeSeconds ?? data.lopstidSekunder ?? data.time_seconds);
  const editionYear = toNumber(data.editionYear ?? data.year ?? extractEditionYear(data.editionId ?? docSnap.id));
  let derivedAge = toNumber(data.age ?? data.alder ?? null);
  if (derivedAge == null) {
    const birthYear = toNumber(data.yearOfBirth ?? data.birthYear ?? null);
    if (birthYear != null && editionYear != null) {
      derivedAge = editionYear - birthYear;
    }
  }
  if (resultClass !== 'konkurranse') {
    derivedAge = null;
  }

  let adjustedSeconds = toNumber(
    data.adjustedSeconds ?? data.aggSeconds ?? data.adjustedTimeSeconds ?? data.aldersOgKjonnSeconds
  );
  if (adjustedSeconds == null) {
    const display = normalizeString(data.adjustedDisplay ?? data.aggDisplay ?? data.aldersOgKjonnResultat);
    if (display) {
      adjustedSeconds = toNumber(data.adjustedTimeSeconds ?? data.aggSeconds ?? data.aldersOgKjonnSekunder);
      if (adjustedSeconds == null) {
        const parts = display.split(':').map((part) => Number(part.replace(',', '.')));
        if (parts.length === 2) {
          adjustedSeconds = parts[0] * 60 + parts[1];
        } else if (parts.length === 3) {
          adjustedSeconds = parts[0] * 3600 + parts[1] * 60 + parts[2];
        }
        if (adjustedSeconds != null) {
          adjustedSeconds = Math.round(adjustedSeconds * 10) / 10;
        }
      }
    }
  }

  const rawStatus = normalizeString(data.status) ?? normalizeString(data.resultStatus);
  let status: string | null = rawStatus;
  if (rawStatus) {
    const statusLower = rawStatus.toLowerCase();
    if (statusLower === 'dns' || statusLower === 'did not start') {
      status = 'DNS';
    } else if (statusLower === 'dnf' || statusLower === 'did not finish') {
      status = 'DNF';
    } else if (statusLower === 'finished' || statusLower === 'finish') {
      status = 'Fullførte';
    }
  }

  let computedAdjusted: ReturnType<typeof computeAdjustedTime> | null = null;
  if (!adjustedSeconds && factorMap && raceTimeSeconds && raceTimeSeconds > 0) {
    computedAdjusted = computeAdjustedTime(
      raceTimeSeconds,
      derivedAge,
      gradingGender,
      factorMap,
      'AGG'
    );
    if (!computedAdjusted) {
      console.log('[MO Results] No grading factor available for entry', {
        id: docSnap.id,
        age: derivedAge,
        gender: gradingGender,
        timeSeconds: raceTimeSeconds
      });
    } else {
      console.log('[MO Results] Computed adjusted seconds', {
        id: docSnap.id,
        adjustedSeconds: computedAdjusted.seconds,
        display: computedAdjusted.display
      });
    }
  }

  console.log('[MO Results] Normalized entry', {
    id: docSnap.id,
    rawStatus,
    normalizedStatus: status,
    storedAdjustedSeconds: adjustedSeconds,
    finalAdjustedSeconds: adjustedSeconds ?? computedAdjusted?.seconds ?? null,
    class: resultClass,
    gender
  });

  return {
    id: docSnap.id,
    editionId: normalizeString(data.editionId) ?? '',
    editionYear,
    userId: normalizeString(data.userId) ?? normalizeString(data.uid),
    firstName: normalizeString(firstName),
    lastName: normalizeString(lastName),
    fullName: buildFullName(firstName, lastName),
    class: resultClass,
    gender,
    status,
    timeSeconds: raceTimeSeconds,
    timeDisplay: normalizeString(data.timeDisplay ?? data.raceTime ?? data.lopstid),
    adjustedSeconds: adjustedSeconds ?? computedAdjusted?.seconds ?? null,
    adjustedDisplay:
      normalizeString(data.adjustedDisplay ?? data.aggDisplay ?? data.aldersOgKjonnResultat) ??
      (adjustedSeconds != null ? formatSeconds1d(adjustedSeconds) : null) ??
      computedAdjusted?.display ?? null,
    rankTime: toNumber(data.rankTime ?? data.scratchRank ?? data.plassering),
    rankAdjusted: toNumber(data.rankAdjusted ?? data.aggRank ?? data.akgPlassering),
    representing: data.representing ?? data.club ?? null,
    age: derivedAge,
    yearOfBirth: toNumber(data.yearOfBirth ?? data.birthYear ?? null)
  } as MOResultEntry;
};

export const getEditionResults = async (
  editionId: string,
  options: MOEditionResultsOptions = {}
): Promise<MOResultEntry[]> => {
  const factorMap = await loadTimeGradingFactors();
  const resultsRef = collection(db, 'moResults');
  const q = query(resultsRef, where('editionId', '==', editionId));
  const snapshot = await getDocs(q);

  const entries = snapshot.docs.map((docSnap) => mapResultDoc(docSnap, factorMap));

  const { classFilter = 'all', genderFilter = 'all', ranking = 'time' } = options;

  const filtered = entries.filter((entry) => {
    const entryClass = normalizeClass(entry.class);
    if (!entryClass) {
      return false;
    }
    if (classFilter !== 'all') {
      if (entryClass !== normalizeClass(classFilter)) {
        return false;
      }
    }
    if (genderFilter !== 'all') {
      const normalizedGender = normalizeGender(genderFilter);
      if (normalizeGender(entry.gender) !== normalizedGender) {
        return false;
      }
    }
    return true;
  });

  const forceAlphabetical = classFilter === 'trim_tidtaking' || classFilter === 'turklasse';

  if (classFilter === 'all') {
    const competitionEntries = sortCompetitionEntries(
      filtered.filter((entry) => normalizeClass(entry.class) === 'konkurranse'),
      ranking
    );

    const otherEntries = filtered
      .filter((entry) => normalizeClass(entry.class) !== 'konkurranse')
      .slice()
      .sort((a, b) => a.fullName.localeCompare(b.fullName, 'nb', { sensitivity: 'base' }));

    return [...competitionEntries, ...otherEntries];
  }

  if (normalizeClass(classFilter) === 'konkurranse') {
    return sortCompetitionEntries(filtered, ranking);
  }

  filtered.sort((a, b) => {
    if (forceAlphabetical) {
      return a.fullName.localeCompare(b.fullName, 'nb', { sensitivity: 'base' });
    }

    const rankA = toNumber(a.rankTime);
    const rankB = toNumber(b.rankTime);
    if (rankA !== null && rankB !== null && rankA !== rankB) {
      return rankA - rankB;
    }
    const valA = toNumber(a.timeSeconds);
    const valB = toNumber(b.timeSeconds);
    if (valA !== null && valB !== null && valA !== valB) {
      return valA - valB;
    }

    return a.fullName.localeCompare(b.fullName);
  });

  return filtered;
};

export const getRunnerMoResults = async (userId: string): Promise<MOResultEntry[]> => {
  const factorMap = await loadTimeGradingFactors();
  const resultsRef = collection(db, 'moResults');
  const q = query(resultsRef, where('userId', '==', userId));
  const snapshot = await getDocs(q);
  return snapshot.docs.map((docSnap) => mapResultDoc(docSnap, factorMap));
};

interface AggregatedRunnerStats {
  entry: MOResultEntry;
  bestTimeSeconds: number;
  bestTimeDisplay: string;
  bestAdjustedSeconds: number | null;
  bestAdjustedDisplay: string | null;
  appearances: number;
  editions: Set<string>;
  firstYear: number | null;
  lastYear: number | null;
  competitionEditions: Set<string>;
  trimTurEditions: Set<string>;
  volunteerEditions: Set<string>;
  editionYearMap: Map<string, number | null>;
  yearCategories: Map<string, Set<'competition' | 'trim_tur' | 'volunteer'>>;
}

const aggregateRunnerStats = (
  statsMap: Map<string, AggregatedRunnerStats>,
  entry: MOResultEntry
) => {
  const runnerKey = buildRunnerKey(entry);
  if (!runnerKey) {
    return;
  }

  const timeSeconds = toNumber(entry.timeSeconds);
  const adjustedSeconds = toNumber(entry.adjustedSeconds);
  const normalizedClass = canonicalizeClass(entry.class);
  const isCompetition = normalizedClass === 'konkurranse';
  const isTrimOrTur = normalizedClass === 'trim_tidtaking' || normalizedClass === 'turklasse';
  const isVolunteer = normalizedClass === '';

  const isDns = isDnsStatus(entry.status);
  const competitionIncrement = !isDns && isCompetition ? 1 : 0;
  const trimTurIncrement = !isDns && isTrimOrTur ? 1 : 0;
  const volunteerIncrement = !isDns && isVolunteer ? 1 : 0;

  const editionId = entry.editionId;
  const editionYear = entry.editionYear ?? extractEditionYear(editionId ?? null);
  const yearKey = editionYear != null
    ? String(editionYear)
    : editionId
    ? editionId.replace('mo-', '')
    : null;

  const current = statsMap.get(runnerKey);
  if (!current) {
    statsMap.set(runnerKey, {
      entry,
      bestTimeSeconds: timeSeconds ?? Number.POSITIVE_INFINITY,
      bestTimeDisplay: entry.timeDisplay ?? (timeSeconds != null ? formatSeconds1d(timeSeconds) : ''),
      bestAdjustedSeconds: adjustedSeconds ?? null,
      bestAdjustedDisplay: entry.adjustedDisplay ??
        (adjustedSeconds != null ? formatSeconds1d(adjustedSeconds) : null),
      appearances: 0,
      editions: new Set<string>(),
      firstYear: entry.editionYear ?? null,
      lastYear: entry.editionYear ?? null,
      competitionEditions: new Set(),
      trimTurEditions: new Set(),
      volunteerEditions: new Set(),
      editionYearMap: new Map(),
      yearCategories: new Map()
    });

    const created = statsMap.get(runnerKey)!;
    if (!isDns && editionId) {
      created.editionYearMap.set(editionId, editionYear ?? null);
      created.editions.add(editionId);
      if (competitionIncrement) {
        created.competitionEditions.add(editionId);
      }
      if (trimTurIncrement) {
        created.trimTurEditions.add(editionId);
      }
      if (volunteerIncrement) {
        created.volunteerEditions.add(editionId);
      }
    }
    if (!isDns && yearKey) {
      const categories = new Set<'competition' | 'trim_tur' | 'volunteer'>();
      if (competitionIncrement) {
        categories.add('competition');
      }
      if (trimTurIncrement) {
        categories.add('trim_tur');
      }
      if (volunteerIncrement) {
        categories.add('volunteer');
      }
      if (categories.size > 0) {
        created.yearCategories.set(yearKey, categories);
        created.appearances += 1;
      }
    }
    return;
  }

  if (!isDns && editionId) {
    current.editionYearMap.set(editionId, editionYear ?? null);
    current.editions.add(editionId);
    if (competitionIncrement) {
      current.competitionEditions.add(editionId);
    }
    if (trimTurIncrement) {
      current.trimTurEditions.add(editionId);
    }
    if (volunteerIncrement) {
      current.volunteerEditions.add(editionId);
    }
  }
  if (!isDns && yearKey) {
    let categories = current.yearCategories.get(yearKey);
    const isNewYear = !categories;
    if (!categories) {
      categories = new Set<'competition' | 'trim_tur' | 'volunteer'>();
      current.yearCategories.set(yearKey, categories);
    }
    if (competitionIncrement) {
      categories.add('competition');
    }
    if (trimTurIncrement) {
      categories.add('trim_tur');
    }
    if (volunteerIncrement) {
      categories.add('volunteer');
    }
    if (isNewYear) {
      current.appearances += 1;
    }
  }

  if (entry.editionYear != null) {
    if (current.firstYear == null || entry.editionYear < current.firstYear) {
      current.firstYear = entry.editionYear;
    }
    if (current.lastYear == null || entry.editionYear > current.lastYear) {
      current.lastYear = entry.editionYear;
    }
  }

  if (isCompetition && timeSeconds != null && timeSeconds > 0 && timeSeconds < current.bestTimeSeconds) {
    current.bestTimeSeconds = timeSeconds;
    current.bestTimeDisplay = entry.timeDisplay ?? formatSeconds1d(timeSeconds);
    current.entry = entry;
  }

  if (
    isCompetition &&
    adjustedSeconds != null &&
    adjustedSeconds > 0 &&
    (current.bestAdjustedSeconds == null || adjustedSeconds < current.bestAdjustedSeconds)
  ) {
    current.bestAdjustedSeconds = adjustedSeconds;
    current.bestAdjustedDisplay = entry.adjustedDisplay ?? formatSeconds1d(adjustedSeconds);
  }
};

export interface MOAllTimeYearDetail {
  year: string;
  categories: ('competition' | 'trim_tur' | 'volunteer')[];
}

export interface MOAllTimeParticipant {
  runnerKey: string;
  userId?: string | null;
  fullName: string;
  gender: MOResultGender | null;
  appearances: number;
  competitionCount: number;
  competitionYears: string[];
  trimTurCount: number;
  trimTurYears: string[];
  volunteerCount: number;
  volunteerYears: string[];
  bestTimeSeconds: number | null;
  bestTimeDisplay: string | null;
  bestAdjustedSeconds: number | null;
  bestAdjustedDisplay: string | null;
  editions: string[];
  editionYears: string[];
  yearDetails: MOAllTimeYearDetail[];
}

export interface MOAllTimeLeaderboardResult {
  participants: MOAllTimeParticipant[];
}

export const getAllTimeLeaderboard = async (): Promise<MOAllTimeLeaderboardResult> => {
  const factorMap = await loadTimeGradingFactors();
  const resultsRef = collection(db, 'moResults');
  const snapshot = await getDocs(resultsRef);

  const statsMap = new Map<string, AggregatedRunnerStats>();
  snapshot.docs.forEach((docSnap) => {
    const entry = mapResultDoc(docSnap, factorMap);
    aggregateRunnerStats(statsMap, entry);
  });

  const participants: MOAllTimeParticipant[] = Array.from(statsMap.entries())
    .map(([runnerKey, stats]) => {
      const sortEditions = (ids: Set<string>) =>
        Array.from(ids).sort((a, b) => {
          const yearA = stats.editionYearMap.get(a) ?? extractEditionYear(a) ?? 0;
          const yearB = stats.editionYearMap.get(b) ?? extractEditionYear(b) ?? 0;
          if (yearA && yearB && yearA !== yearB) {
            return yearA - yearB;
          }
          return a.localeCompare(b);
        });

      const toYearLabels = (ids: Set<string>) =>
        sortEditions(ids).map((editionId) => {
          const year = stats.editionYearMap.get(editionId) ?? extractEditionYear(editionId);
          return year != null ? String(year) : editionId.replace('mo-', '');
        });

      const overallEditions = sortEditions(stats.editions);
      const categoryOrder: ('competition' | 'trim_tur' | 'volunteer')[] = [
        'competition',
        'trim_tur',
        'volunteer'
      ];

      const parseYearValue = (value: string) => {
        const numeric = Number.parseInt(value, 10);
        return Number.isNaN(numeric) ? null : numeric;
      };

      const yearDetails = Array.from(stats.yearCategories.entries())
        .map(([year, categoriesSet]) => ({
          year,
          categories: categoryOrder.filter((category) => categoriesSet.has(category))
        }))
        .sort((a, b) => {
          const yearA = parseYearValue(a.year);
          const yearB = parseYearValue(b.year);
          if (yearA != null && yearB != null && yearA !== yearB) {
            return yearA - yearB;
          }
          if (yearA != null && yearB == null) {
            return -1;
          }
          if (yearA == null && yearB != null) {
            return 1;
          }
          return a.year.localeCompare(b.year);
        });

      const competitionYears = yearDetails
        .filter((detail) => detail.categories.includes('competition'))
        .map((detail) => detail.year);

      const trimTurYears = yearDetails
        .filter((detail) => detail.categories.includes('trim_tur'))
        .map((detail) => detail.year);

      const volunteerYears = yearDetails
        .filter((detail) => detail.categories.includes('volunteer'))
        .map((detail) => detail.year);

      const editionYears = yearDetails.length
        ? yearDetails.map((detail) => detail.year)
        : overallEditions.map((editionId) => {
            const year = stats.editionYearMap.get(editionId) ?? extractEditionYear(editionId);
            return year != null ? String(year) : editionId.replace('mo-', '');
          });

      return {
        runnerKey,
        userId: stats.entry.userId ?? null,
        fullName: stats.entry.fullName,
        gender: stats.entry.gender ?? null,
        appearances: stats.appearances,
        competitionCount: competitionYears.length,
        competitionYears,
        trimTurCount: trimTurYears.length,
        trimTurYears,
        volunteerCount: volunteerYears.length,
        volunteerYears,
        bestTimeSeconds: Number.isFinite(stats.bestTimeSeconds) ? stats.bestTimeSeconds : null,
        bestTimeDisplay: Number.isFinite(stats.bestTimeSeconds) ? stats.bestTimeDisplay ?? null : null,
        bestAdjustedSeconds: stats.bestAdjustedSeconds,
        bestAdjustedDisplay: stats.bestAdjustedDisplay ?? null,
        editions: overallEditions,
        editionYears,
        yearDetails
      };
    })
    .filter((participant) => participant.appearances > 0)
    .sort((a, b) => {
      if (b.appearances !== a.appearances) {
        return b.appearances - a.appearances;
      }
      if (b.competitionCount !== a.competitionCount) {
        return b.competitionCount - a.competitionCount;
      }
      if (a.bestTimeSeconds !== null && b.bestTimeSeconds !== null) {
        return a.bestTimeSeconds - b.bestTimeSeconds;
      }
      if (a.bestTimeSeconds !== null) {
        return -1;
      }
      if (b.bestTimeSeconds !== null) {
        return 1;
      }
      return a.fullName.localeCompare(b.fullName, 'nb', { sensitivity: 'base' });
    });

  return { participants };
};

interface TimeRecordAccumulator {
  men: MOTimeRecordEntry[];
  women: MOTimeRecordEntry[];
  agg: MOTimeRecordEntry[];
}

const maybePushTimeRecord = (
  list: MOTimeRecordEntry[],
  entry: MOResultEntry,
  opts: { adjusted?: boolean }
) => {
  const baseSeconds = toNumber(entry.timeSeconds);
  const adjSeconds = toNumber(entry.adjustedSeconds);
  const include = opts.adjusted ? (adjSeconds != null && adjSeconds > 0) : (baseSeconds != null && baseSeconds > 0);
  if (!include) {
    return;
  }
  const timeSeconds = baseSeconds ?? 0;
  const timeDisplay = baseSeconds != null ? (entry.timeDisplay ?? formatSeconds1d(baseSeconds)) : '—';

  const runnerKey = buildRunnerKey(entry);
  if (!runnerKey) {
    return;
  }

  list.push({
    runnerKey,
    userId: entry.userId ?? null,
    fullName: entry.fullName,
    gender: entry.gender ?? null,
    editionId: entry.editionId,
    editionYear: entry.editionYear,
    timeSeconds,
    timeDisplay,
    adjustedSeconds: opts.adjusted ? (adjSeconds ?? null) : entry.adjustedSeconds ?? null,
    adjustedDisplay: opts.adjusted
      ? (entry.adjustedDisplay ?? (adjSeconds != null ? formatSeconds1d(adjSeconds) : null))
      : entry.adjustedDisplay ?? null,
    status: entry.status,
    age: entry.age ?? null,
    representing: entry.representing ?? null
  });
};

export const getRecords = async (): Promise<MORecordsResult> => {
  const factorMap = await loadTimeGradingFactors();
  const resultsRef = collection(db, 'moResults');
  const snapshot = await getDocs(resultsRef);

  const timeRecords: TimeRecordAccumulator = {
    men: [],
    women: [],
    agg: []
  };
  const appearanceMap = new Map<string, AggregatedRunnerStats>();
  const participationByEdition = new Map<
    string,
    { editionYear?: number | null; competition: number; overall: number }
  >();
  const yearlyStatsMap = new Map<string, MOYearlyClassStats>();

  const getYearlyStats = (editionId: string, editionYear: number | null) => {
    let stats = yearlyStatsMap.get(editionId);
    if (!stats) {
      stats = {
        editionId,
        editionYear,
        competitionFinished: 0,
        competitionDnf: 0,
        competitionDns: 0,
        trimCount: 0,
        turCount: 0,
        volunteerCount: 0,
        total: 0
      };
      yearlyStatsMap.set(editionId, stats);
    }
    return stats;
  };

  snapshot.docs.forEach((docSnap) => {
    const entry = mapResultDoc(docSnap, factorMap);
    const entryClass = normalizeClass(entry.class);
    const isCompetition = entryClass === 'konkurranse';
    const isVolunteer = entryClass === '';

    const status = entry.status ?? null;
    const isDns = isDnsStatus(status);

    const editionKey = entry.editionId;
    const editionYear = entry.editionYear ?? extractEditionYear(editionKey);

    if (editionKey) {
      const stats = getYearlyStats(editionKey, editionYear ?? null);
      const statusUpper = (status ?? '').toString().trim().toUpperCase();

      if (isCompetition) {
        if (statusUpper === 'DNF') {
          stats.competitionDnf += 1;
        } else if (statusUpper === 'DNS') {
          stats.competitionDns += 1;
        } else {
          stats.competitionFinished += 1;
        }
      } else if (entryClass === 'trim_tidtaking') {
        stats.trimCount += 1;
      } else if (entryClass === 'turklasse') {
        stats.turCount += 1;
      } else if (isVolunteer) {
        stats.volunteerCount += 1;
      }
    }

    if (isCompetition) {
      if (!isDns) {
        if (entry.gender === 'Male') {
          maybePushTimeRecord(timeRecords.men, entry, { adjusted: false });
        } else if (entry.gender === 'Female') {
          maybePushTimeRecord(timeRecords.women, entry, { adjusted: false });
        }
      }
      maybePushTimeRecord(timeRecords.agg, entry, { adjusted: true });
    }

    aggregateRunnerStats(appearanceMap, entry);

    if (editionKey) {
      let summary = participationByEdition.get(editionKey);
      if (!summary) {
        summary = {
          editionYear,
          competition: 0,
          overall: 0
        };
        participationByEdition.set(editionKey, summary);
      }
      if (!isDns) {
        if (isCompetition) {
          summary.competition += 1;
        }
        if (!isVolunteer) {
          summary.overall += 1;
        }
      }
    }
  });

  const sortByTime = (entries: MOTimeRecordEntry[]) =>
    entries
      .filter((item, index, self) => {
        const key = `${item.runnerKey}|${item.editionId}`;
        return (
          item.timeSeconds > 0 &&
          self.findIndex((candidate) => `${candidate.runnerKey}|${candidate.editionId}` === key) === index
        );
      })
      .sort((a, b) => a.timeSeconds - b.timeSeconds || a.fullName.localeCompare(b.fullName, 'nb'));

  const sortByAdjusted = (entries: MOTimeRecordEntry[]) =>
    entries
      .filter((item, index, self) => {
        const key = `${item.runnerKey}|${item.editionId}`;
        return (
          (item.adjustedSeconds ?? 0) > 0 &&
          self.findIndex((candidate) => `${candidate.runnerKey}|${candidate.editionId}` === key) === index
        );
      })
      .sort((a, b) => {
        const av = a.adjustedSeconds ?? Number.POSITIVE_INFINITY;
        const bv = b.adjustedSeconds ?? Number.POSITIVE_INFINITY;
        if (av !== bv) return av - bv;
        return a.fullName.localeCompare(b.fullName, 'nb');
      });

  const fastestMen = sortByTime(timeRecords.men).slice(0, 5);
  const fastestWomen = sortByTime(timeRecords.women).slice(0, 5);
  const fastestAGG = sortByAdjusted(timeRecords.agg).slice(0, 10);

  const appearanceEntries = Array.from(appearanceMap.entries())
    .map(([runnerKey, stats]) => ({
      runnerKey,
      userId: stats.entry.userId ?? null,
      fullName: stats.entry.fullName,
      gender: stats.entry.gender ?? null,
      appearances: stats.appearances,
      firstYear: stats.firstYear,
      lastYear: stats.lastYear
    }))
    .filter((item) => item.appearances > 0)
    .sort((a, b) => {
      if (b.appearances !== a.appearances) {
        return b.appearances - a.appearances;
      }
      return a.fullName.localeCompare(b.fullName, 'nb', { sensitivity: 'base' });
    });

  const appearanceCutoff = appearanceEntries[4]?.appearances ?? 0;
  const mostAppearances = appearanceEntries.filter((item) => item.appearances >= appearanceCutoff);

  const participationSummaries = Array.from(participationByEdition.entries())
    .map(([editionId, value]) => ({
      editionId,
      editionYear: value.editionYear,
      totalCompetition: value.competition,
      totalOverall: value.overall
    }))
    .sort((a, b) => b.totalCompetition - a.totalCompetition || (a.editionYear ?? 0) - (b.editionYear ?? 0));

  const topParticipationCompetition = participationSummaries
    .filter((item) => item.totalCompetition > 0)
    .slice(0, 5);

  const sortedOverall = participationSummaries
    .slice()
    .sort((a, b) => b.totalOverall - a.totalOverall || (a.editionYear ?? 0) - (b.editionYear ?? 0));

  const topParticipationOverall = sortedOverall.filter((item) => item.totalOverall > 0).slice(0, 5);

  const yearlyClassStats = Array.from(yearlyStatsMap.values())
    .map((stats) => ({
      ...stats,
      total:
        stats.competitionFinished +
        stats.competitionDnf +
        stats.competitionDns +
        stats.trimCount +
        stats.turCount +
        stats.volunteerCount
    }))
    .sort((a, b) => {
      const yearA = a.editionYear ?? extractEditionYear(a.editionId) ?? 0;
      const yearB = b.editionYear ?? extractEditionYear(b.editionId) ?? 0;
      if (yearA !== yearB) {
        return yearA - yearB;
      }
      return a.editionId.localeCompare(b.editionId);
    });

  return {
    fastestMen,
    fastestWomen,
    fastestAGG,
    mostAppearances,
    topParticipationCompetition,
    topParticipationOverall,
    yearlyClassStats
  };
};
