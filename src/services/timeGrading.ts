import { collection, getDocs, orderBy, query, where } from 'firebase/firestore';
import { db } from '../config/firebase';
import { formatSeconds1d } from '../utils/format';

export interface TimeGradingFactor {
  age: number;
  eventId: string;
  AG_F: number;
  AG_M: number;
  GG_F: number;
  GG_M: number;
  AGG_F: number;
  AGG_M: number;
}

export type TimeGradingFactorMap = Map<number, TimeGradingFactor>;

export const MIN_GRADED_AGE = 4;
export const MAX_GRADED_AGE = 100;

const factorCache = new Map<string, TimeGradingFactorMap>();

const toNumber = (value: unknown): number | null => {
  if (value === undefined || value === null) {
    return null;
  }
  const normalized = typeof value === 'number' ? value : Number(String(value).replace(',', '.'));
  return Number.isFinite(normalized) ? normalized : null;
};

const clampAge = (age: number): number => {
  if (!Number.isFinite(age)) {
    return age;
  }
  return Math.min(MAX_GRADED_AGE, Math.max(MIN_GRADED_AGE, Math.round(age)));
};

const findNearestFactor = (factorMap: TimeGradingFactorMap, age: number): TimeGradingFactor | null => {
  if (factorMap.has(age)) {
    return factorMap.get(age) ?? null;
  }

  let nearest: TimeGradingFactor | null = null;
  let smallestDiff = Number.POSITIVE_INFINITY;

  factorMap.forEach((factor) => {
    const diff = Math.abs(factor.age - age);
    if (diff < smallestDiff) {
      smallestDiff = diff;
      nearest = factor;
    }
  });

  return nearest;
};

export const clearTimeGradingFactorCache = (eventId?: string) => {
  if (eventId) {
    factorCache.delete(eventId);
    return;
  }
  factorCache.clear();
};

export const loadTimeGradingFactors = async (eventId = 'mo'): Promise<TimeGradingFactorMap> => {
  if (factorCache.has(eventId)) {
    return factorCache.get(eventId)!;
  }

  const normalizedEventId = eventId.toLowerCase();
  const factorsRef = collection(db, 'timeGradingFactors');
  let snapshot = await getDocs(query(factorsRef, where('eventId', '==', eventId)));

  if (snapshot.empty) {
    snapshot = await getDocs(factorsRef);
  }

  const factors: TimeGradingFactor[] = [];

  snapshot.forEach((docSnap) => {
    const data = docSnap.data() as Partial<TimeGradingFactor> & { age?: unknown };
    const age = toNumber(data.age ?? docSnap.id?.split('-').pop());
    if (age == null) {
      return;
    }

    const docEventId = String(data.eventId ?? docSnap.id?.split('-')[0] ?? eventId);
    const docEventIdNormalized = docEventId.toLowerCase();
    const matchesEvent =
      docEventIdNormalized === normalizedEventId || docEventIdNormalized.startsWith(`${normalizedEventId}-`);
    if (!matchesEvent) {
      return;
    }

    factors.push({
      age,
      eventId: docEventId,
      AG_F: toNumber(data.AG_F) ?? 1,
      AG_M: toNumber(data.AG_M) ?? 1,
      GG_F: toNumber(data.GG_F) ?? 1,
      GG_M: toNumber(data.GG_M) ?? 1,
      AGG_F: toNumber(data.AGG_F) ?? 1,
      AGG_M: toNumber(data.AGG_M) ?? 1
    });
  });

  factors.sort((a, b) => a.age - b.age);

  const map: TimeGradingFactorMap = new Map();
  factors.forEach((factor) => {
    map.set(factor.age, factor);
  });

  factorCache.set(eventId, map);
  console.log('[TimeGrading] Loaded grading factors', {
    eventId,
    count: map.size,
    ages: Array.from(map.keys()).slice(0, 5)
  });
  if (map.size === 0) {
    console.warn('[TimeGrading] No grading factors found for event', { eventId });
  }
  return map;
};

export const getGradingFactor = (
  factorMap: TimeGradingFactorMap,
  age: number | null | undefined,
  gender: 'Male' | 'Female' | null | undefined,
  mode: 'AG' | 'AGG'
): number | null => {
  if (age == null || !Number.isFinite(age)) {
    return null;
  }
  if (gender !== 'Male' && gender !== 'Female') {
    return null;
  }

  const effectiveAge = clampAge(age);
  const factor = findNearestFactor(factorMap, effectiveAge);
  if (!factor) {
    return null;
  }

  if (mode === 'AG') {
    return gender === 'Female' ? factor.AG_F : factor.AG_M;
  }

  return gender === 'Female' ? factor.AGG_F : factor.AGG_M;
};

export interface AdjustedTimeResult {
  seconds: number;
  display: string;
  factor: number;
}

export const computeAdjustedTime = (
  seconds: number | null | undefined,
  age: number | null | undefined,
  gender: 'Male' | 'Female' | null | undefined,
  factorMap: TimeGradingFactorMap,
  mode: 'AG' | 'AGG'
): AdjustedTimeResult | null => {
  if (seconds == null || !Number.isFinite(seconds) || seconds <= 0) {
    return null;
  }

  const factor = getGradingFactor(factorMap, age, gender, mode);
  if (factor == null) {
    return null;
  }

  const adjustedSeconds = Math.round(seconds * factor * 10) / 10;
  return {
    seconds: adjustedSeconds,
    display: formatSeconds1d(adjustedSeconds),
    factor
  };
};
