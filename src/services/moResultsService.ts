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
