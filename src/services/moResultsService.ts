import { collection, getDocs, orderBy, query, where } from 'firebase/firestore';
import { db } from '../config/firebase';

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
  if (str === 'konkurranse') return 'konkurranse';
  if (str === 'trim' || str === 'trim_tidtaking' || str === 'trimmedtidtaking') return 'trim_tidtaking';
  if (str === 'tur' || str === 'turklasse' || str === 'mosjon') return 'turklasse';
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
  const num = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(num) ? num : null;
};

const buildFullName = (firstName?: string | null, lastName?: string | null): string => {
  const primary = normalizeString(firstName);
  const secondary = normalizeString(lastName);
  if (primary && secondary) return `${primary} ${secondary}`;
  return primary || secondary || '';
};

export const getEditionResults = async (
  editionId: string,
  options: MOEditionResultsOptions = {}
): Promise<MOResultEntry[]> => {
  const resultsRef = collection(db, 'moResults');
  const q = query(resultsRef, where('editionId', '==', editionId));
  const snapshot = await getDocs(q);

  const entries = snapshot.docs.map((docSnap) => {
    const data = docSnap.data() as any;
    const firstName = data.firstName ?? data.fornavn ?? null;
    const lastName = data.lastName ?? data.etternavn ?? data.surname ?? null;
    const resultClass = normalizeClass(data.class ?? data.klasse);
    return {
      id: docSnap.id,
      editionId,
      userId: normalizeString(data.userId) ?? normalizeString(data.uid),
      firstName: normalizeString(firstName),
      lastName: normalizeString(lastName),
      fullName: buildFullName(firstName, lastName),
      class: resultClass,
      gender: normalizeGender(data.gender ?? data.kjonn),
      status: normalizeString(data.status),
      timeSeconds: toNumber(data.timeSeconds ?? data.lopstidSekunder ?? data.time_seconds),
      timeDisplay: normalizeString(data.timeDisplay ?? data.lopstid),
      adjustedSeconds: toNumber(data.adjustedSeconds ?? data.aggSeconds ?? data.aldersOgKjonnSeconds),
      adjustedDisplay: normalizeString(data.adjustedDisplay ?? data.aggDisplay ?? data.aldersOgKjonnResultat),
      rankTime: toNumber(data.rankTime ?? data.scratchRank ?? data.plassering),
      rankAdjusted: toNumber(data.rankAdjusted ?? data.aggRank ?? data.akgPlassering),
      representing: data.representing ?? data.club ?? null,
      age: toNumber(data.age ?? data.alder ?? data.birthYear ? new Date().getFullYear() - Number(data.birthYear) : null)
    } as MOResultEntry;
  });

  const { classFilter = 'all', genderFilter = 'all', ranking = 'time' } = options;

  const filtered = entries.filter((entry) => {
    if (classFilter !== 'all') {
      if (normalizeClass(entry.class) !== normalizeClass(classFilter)) {
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

  filtered.sort((a, b) => {
    if (forceAlphabetical) {
      return a.fullName.localeCompare(b.fullName, 'nb', { sensitivity: 'base' });
    }
    if (ranking === 'adjusted') {
      const rankA = toNumber(a.rankAdjusted);
      const rankB = toNumber(b.rankAdjusted);
      if (rankA !== null && rankB !== null && rankA !== rankB) {
        return rankA - rankB;
      }
      const valA = toNumber(a.adjustedSeconds);
      const valB = toNumber(b.adjustedSeconds);
      if (valA !== null && valB !== null && valA !== valB) {
        return valA - valB;
      }
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
  const resultsRef = collection(db, 'moResults');
  const q = query(resultsRef, where('userId', '==', userId));
  const snapshot = await getDocs(q);
  return snapshot.docs.map((docSnap) => {
    const data = docSnap.data() as any;
    const firstName = data.firstName ?? null;
    const lastName = data.lastName ?? null;
    return {
      id: docSnap.id,
      editionId: data.editionId,
      userId,
      firstName: normalizeString(firstName),
      lastName: normalizeString(lastName),
      fullName: buildFullName(firstName, lastName),
      class: normalizeClass(data.class),
      gender: normalizeGender(data.gender),
      status: normalizeString(data.status),
      timeSeconds: toNumber(data.timeSeconds),
      timeDisplay: normalizeString(data.timeDisplay),
      adjustedSeconds: toNumber(data.adjustedSeconds),
      adjustedDisplay: normalizeString(data.adjustedDisplay),
      rankTime: toNumber(data.rankTime),
      rankAdjusted: toNumber(data.rankAdjusted),
      representing: data.representing ?? null,
      age: toNumber(data.age)
    } as MOResultEntry;
  });
};
