import { db } from '../config/firebase';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  where,
  setDoc,
  Timestamp
} from 'firebase/firestore';

interface FirestoreUser {
  firstName?: string;
  lastName?: string;
  displayName?: string;
  personId?: number | string | null;
  email?: string;
  phoneCountryCode?: string | null;
  phone?: string | null;
  uid?: string | null;
  userId?: string | null;
}

export interface RunnerParticipation {
  editionId: string;
  year: number;
  eventDate?: Date | null;
  raceName: string;
  distanceKey?: string | null;
  raceRank?: number | null;
  raceTimeSeconds?: number | null;
  raceTimeDisplay?: string | null;
  totalRank?: number | null;
  totalTimeSeconds?: number | null;
  totalTimeDisplay?: string | null;
  loopsCompleted: number;
  status?: string | null;
  hasCheckpointData: boolean;
}

export interface RunnerBestPerformance {
  editionId: string;
  year: number;
  loops: number;
  totalTimeSeconds: number | null;
  totalTimeDisplay?: string | null;
  raceName: string;
}

export interface RunnerProfile {
  userId: string;
  personId: number | null;
  firstName: string;
  lastName: string;
  email: string;
  phoneCountryCode?: string | null;
  phone?: string | null;
  totalAppearances: number;
  appearanceYears: number[];
  totalLoops: number;
  bestPerformance: RunnerBestPerformance | null;
  participations: RunnerParticipation[];
  upcomingRegistrations: RunnerUpcomingRegistration[];
}

export interface RunnerProfileEditableDetails {
  firstName: string;
  lastName: string;
  phoneCountryCode?: string;
  phone?: string;
}

export interface RunnerUpcomingRegistration {
  registrationId: string;
  editionId: string;
  eventName: string;
  eventShortName?: string;
  startTime: Date | null;
  registrationType: 'kutc' | 'mo' | 'event';
  status?: string | null;
  registrationNumber?: number | null;
}

const deriveDistanceKey = (race: any, index: number): string => {
  if (race?.distanceKey) return String(race.distanceKey);
  if (race?.key) return String(race.key);
  if (race?.raceKey) return String(race.raceKey);
  if (race?.raceName) {
    return String(race.raceName).toLowerCase().replace(/\s+/g, '-');
  }
  return `race-${index}`;
};

const toDateSafe = (value: any): Date | null => {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value.toDate === 'function') return value.toDate();
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const parseYearFromEditionId = (editionId: string): number => {
  const parts = editionId.split('-');
  const yearStr = parts[parts.length - 1];
  const year = Number(yearStr);
  return Number.isFinite(year) ? year : 0;
};

const ensureNumber = (value: any): number | null => {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number') return value;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const ensureLoops = (value: any): number => {
  if (value === null || value === undefined) return 0;
  if (typeof value === 'number') return value;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const normalizeId = (value: unknown): string | null => {
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const looksLikeEmail = (value: unknown): boolean => {
  if (typeof value !== 'string') {
    return false;
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return false;
  }
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed.toLowerCase());
};

const toDateFromUnknown = (value: any): Date | null => {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value.toDate === 'function') return value.toDate();
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const upcomingStatusFilter = ['pending', 'confirmed'];

async function fetchUpcomingRegistrations(userId: string, email: string | null | undefined): Promise<RunnerUpcomingRegistration[]> {
  if (!userId) {
    return [];
  }

  const now = Timestamp.now();
  const editionsRef = collection(db, 'eventEditions');
  const editionsQuery = query(editionsRef, where('startTime', '>', now), orderBy('startTime', 'asc'));
  const editionsSnapshot = await getDocs(editionsQuery);

  if (editionsSnapshot.empty) {
    return [];
  }

  const results: RunnerUpcomingRegistration[] = [];

  await Promise.all(
    editionsSnapshot.docs.map(async (editionDoc) => {
      const editionData = editionDoc.data() as any;
      const editionId = editionDoc.id;
      const startTime = toDateFromUnknown(editionData.startTime);
      const eventName = editionData.eventName || editionId;
      const eventShortName = editionData.eventShortName || editionData.eventId || undefined;
      const type: RunnerUpcomingRegistration['registrationType'] = editionId.toLowerCase().startsWith('kutc-')
        ? 'kutc'
        : editionId.toLowerCase().startsWith('mo-')
          ? 'mo'
          : 'event';

      if (type === 'kutc' || type === 'event') {
        const registrationsRef = collection(db, 'registrations');
        const regQuery = query(
          registrationsRef,
          where('editionId', '==', editionId),
          where('userId', '==', userId),
          where('status', 'in', upcomingStatusFilter)
        );
        const registrationSnapshot = await getDocs(regQuery);
        registrationSnapshot.forEach((docSnap) => {
          const data = docSnap.data() as any;
          results.push({
            registrationId: docSnap.id,
            editionId,
            eventName,
            eventShortName,
            startTime,
            registrationType: type,
            status: data.status || null,
            registrationNumber: typeof data.registrationNumber === 'number' ? data.registrationNumber : null
          });
        });
      }

      if (type === 'mo') {
        const moRef = collection(db, 'moRegistrations');
        let moQuery = query(
          moRef,
          where('editionId', '==', editionId),
          where('userId', '==', userId)
        );
        let moSnapshot = await getDocs(moQuery);

        if (moSnapshot.empty && email) {
          const normalizedEmail = String(email).trim().toLowerCase();
          moQuery = query(
            moRef,
            where('editionId', '==', editionId),
            where('email', '==', normalizedEmail)
          );
          moSnapshot = await getDocs(moQuery);
        }

        moSnapshot.forEach((docSnap) => {
          const data = docSnap.data() as any;
          results.push({
            registrationId: docSnap.id,
            editionId,
            eventName,
            eventShortName,
            startTime,
            registrationType: type,
            status: data.status || null,
            registrationNumber: typeof data.registrationNumber === 'number' ? data.registrationNumber : null
          });
        });
      }
    })
  );

  results.sort((a, b) => {
    const aTime = a.startTime?.getTime?.() ?? 0;
    const bTime = b.startTime?.getTime?.() ?? 0;
    return aTime - bTime;
  });

  return results;
}

async function determineCheckpointAvailability(eventEditionId: string, userId: string): Promise<boolean> {
  const checkpointsRef = collection(db, 'checkpointResults');
  const q = query(
    checkpointsRef,
    where('eventEditionId', '==', eventEditionId),
    where('userId', '==', userId),
    limit(1)
  );
  const snapshot = await getDocs(q);
  return !snapshot.empty;
}

async function getRaceResult(
  editionId: string,
  personId: number,
  races: any[]
): Promise<{ result: any | null; distanceKey?: string | null }> {
  for (let index = 0; index < races.length; index += 1) {
    const race = races[index];
    const distanceKey = deriveDistanceKey(race, index);
    if (!distanceKey || distanceKey === 'total') {
      continue;
    }
    const raceRef = doc(db, `kutcResults/${editionId}/races/${distanceKey}/results/${personId}`);
    const raceSnap = await getDoc(raceRef);
    if (raceSnap.exists()) {
      return { result: raceSnap.data(), distanceKey };
    }
  }
  return { result: null, distanceKey: null };
}

async function getKUTCParticipations(userId: string, personId: number): Promise<RunnerParticipation[]> {
  const participations: RunnerParticipation[] = [];
  const kutcCollection = collection(db, 'kutcResults');
  const editionsSnapshot = await getDocs(kutcCollection);

  for (const editionDoc of editionsSnapshot.docs) {
    const editionId = editionDoc.id;
    const totalResultRef = doc(db, `kutcResults/${editionId}/races/total/results/${personId}`);
    const totalResultSnap = await getDoc(totalResultRef);
    if (!totalResultSnap.exists()) {
      continue;
    }

    const totalResult = totalResultSnap.data() as any;
    const loopsCompleted = ensureLoops(totalResult.loopsCompleted);
    const totalRank = ensureNumber(totalResult.finalRank);
    const totalTimeSeconds = ensureNumber(totalResult.totalTimeSeconds);
    const totalTimeDisplay = totalResult.totalTimeDisplay || totalResult.totalTime || null;
    const status = totalResult.status || null;

    const rawData = editionDoc.data() as any;
    const metadata = rawData?.metadata || rawData?.summary || {};
    const races = Array.isArray(metadata?.races) ? metadata.races : [];
    const eventDate = toDateSafe(metadata?.eventDate);
    const year = ensureNumber(metadata?.year) ?? parseYearFromEditionId(editionId);

    let raceName = totalResult.raceName || totalResult.race || '';
    let raceRank = ensureNumber(totalResult.raceRank);
    let raceTimeSeconds = ensureNumber(totalResult.raceTimeSeconds);
    let raceTimeDisplay = totalResult.raceTimeDisplay || null;
    let distanceKey: string | null | undefined = totalResult.distanceKey || null;

    if (!raceName || raceRank === null || raceTimeSeconds === null) {
      const { result: raceResult, distanceKey: detectedKey } = await getRaceResult(editionId, personId, races);
      if (raceResult) {
        distanceKey = detectedKey;
        raceName = raceResult.raceName || raceResult.distanceName || raceName;
        raceRank = ensureNumber(raceResult.raceRank ?? raceResult.race_rank);
        raceTimeSeconds = ensureNumber(raceResult.raceTimeSeconds ?? raceResult.race_time_seconds);
        raceTimeDisplay = raceResult.raceTimeDisplay || raceResult.race_time_display || raceTimeDisplay;
      }
    }

    if (!raceName) {
      const raceIndex = races.findIndex((race: any) => {
        const key = deriveDistanceKey(race, 0);
        return key === distanceKey;
      });
      if (raceIndex >= 0) {
        raceName = races[raceIndex]?.raceName || races[raceIndex]?.name || 'Race';
      }
    }

    const hasCheckpointData = await determineCheckpointAvailability(editionId, userId);

    participations.push({
      editionId,
      year: year ?? parseYearFromEditionId(editionId),
      eventDate,
      raceName: raceName || 'Race',
      distanceKey,
      raceRank,
      raceTimeSeconds,
      raceTimeDisplay,
      totalRank,
      totalTimeSeconds,
      totalTimeDisplay,
      loopsCompleted,
      status,
      hasCheckpointData
    });
  }

  participations.sort((a, b) => b.year - a.year);
  return participations;
}

export async function getRunnerProfile(userId: string): Promise<RunnerProfile> {
  if (looksLikeEmail(userId)) {
    throw new Error('Runner not found');
  }

  let userSnap = await getDoc(doc(db, 'users', userId));

  if (!userSnap.exists()) {
    const usersRef = collection(db, 'users');
    const uidQuery = query(usersRef, where('uid', '==', userId), limit(1));
    const uidSnapshot = await getDocs(uidQuery);
    if (!uidSnapshot.empty) {
      userSnap = uidSnapshot.docs[0];
    } else {
      const legacyQuery = query(usersRef, where('userId', '==', userId), limit(1));
      const legacySnapshot = await getDocs(legacyQuery);
      if (!legacySnapshot.empty) {
        userSnap = legacySnapshot.docs[0];
      }
    }
  }

  if (!userSnap.exists()) {
    throw new Error('Runner not found');
  }

  const userData = userSnap.data() as FirestoreUser;
  const resolvedUid =
    normalizeId(userData.uid) ??
    normalizeId(userData.userId) ??
    (!userSnap.id.includes('@') ? normalizeId(userSnap.id) : null) ??
    normalizeId(userId) ??
    userSnap.id;
  const effectiveUserId = resolvedUid || userId;

  const firstName = userData.firstName || userData.displayName?.split(' ')[0] || 'Runner';
  const lastName = userData.lastName || userData.displayName?.split(' ').slice(1).join(' ') || '';
  const personId = ensureNumber(userData.personId);

  const participations = personId !== null
    ? await getKUTCParticipations(effectiveUserId, personId)
    : [];

  const upcomingRegistrations = await fetchUpcomingRegistrations(effectiveUserId, userData.email || null);

  const countedParticipations = participations.filter((participation) =>
    participation.status?.toUpperCase() !== 'DNS'
  );

  const totalAppearances = countedParticipations.length;
  const totalLoops = participations.reduce((sum, item) => sum + item.loopsCompleted, 0);
  const appearanceYears = Array.from(new Set(countedParticipations.map((item) => item.year)))
    .filter((year): year is number => Number.isFinite(year) && year > 0)
    .sort((a, b) => a - b);

  let bestPerformance: RunnerBestPerformance | null = null;
  for (const participation of participations) {
    if (participation.loopsCompleted <= 0) {
      continue;
    }
    if (!bestPerformance) {
      bestPerformance = {
        editionId: participation.editionId,
        year: participation.year,
        loops: participation.loopsCompleted,
        totalTimeSeconds: participation.totalTimeSeconds ?? null,
        totalTimeDisplay: participation.totalTimeDisplay,
        raceName: participation.raceName
      };
      continue;
    }

    if (participation.loopsCompleted > bestPerformance.loops) {
      bestPerformance = {
        editionId: participation.editionId,
        year: participation.year,
        loops: participation.loopsCompleted,
        totalTimeSeconds: participation.totalTimeSeconds ?? null,
        totalTimeDisplay: participation.totalTimeDisplay,
        raceName: participation.raceName
      };
      continue;
    }

    if (participation.loopsCompleted === bestPerformance.loops) {
      const currentTime = participation.totalTimeSeconds ?? Number.POSITIVE_INFINITY;
      const bestTime = bestPerformance.totalTimeSeconds ?? Number.POSITIVE_INFINITY;
      if (currentTime < bestTime) {
        bestPerformance = {
          editionId: participation.editionId,
          year: participation.year,
          loops: participation.loopsCompleted,
          totalTimeSeconds: participation.totalTimeSeconds ?? null,
          totalTimeDisplay: participation.totalTimeDisplay,
          raceName: participation.raceName
        };
      }
    }
  }

  return {
    userId: effectiveUserId,
    personId,
    firstName,
    lastName,
    email: userData.email || '',
    phoneCountryCode: userData.phoneCountryCode || null,
    phone: userData.phone || null,
    totalAppearances,
    appearanceYears,
    totalLoops,
    bestPerformance,
    participations,
    upcomingRegistrations
  };
}

export async function updateRunnerProfileDetails(
  userId: string,
  details: RunnerProfileEditableDetails
): Promise<void> {
  if (!userId) {
    throw new Error('Missing userId for runner profile update');
  }

  const payload: Record<string, string | null | undefined> = {
    firstName: details.firstName,
    lastName: details.lastName,
    phoneCountryCode: details.phoneCountryCode ?? '',
    phone: details.phone ?? ''
  };

  await setDoc(doc(db, 'users', userId), payload, { merge: true });
}
