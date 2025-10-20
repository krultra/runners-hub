import { db } from '../config/firebase';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query
} from 'firebase/firestore';
import { getVerboseName } from './codeListService';
import { getEventEdition } from './eventEditionService';

// ============================================
// Type Definitions
// ============================================

export interface KUTCResultEntry {
  personId: number;
  bib?: string;
  firstName?: string;
  lastName?: string;
  loopsCompleted?: number;
  finalRank?: number | null;
  totalTimeSeconds?: number | null;
  totalTimeDisplay?: string;
  finishTime?: any;
  status?: string;
  notes?: string;
  // Race-specific fields (only for race collections)
  raceName?: string;
  raceId?: number | null;
  raceRank?: number | null;
  raceFinishTime?: any;
  raceTimeSeconds?: number | null;
  raceTimeDisplay?: string;
  publishedAt?: any;
  createdAt?: any;
  updatedAt?: any;
}

export interface KUTCRaceInfo {
  raceId: number | string;
  raceName: string;
  distanceKey: string;
  participants: number;
  finishers: number;
}

export interface KUTCEditionMetadata {
  editionId: string;
  year: number;
  eventDate: any;
  totalParticipants: number;
  totalFinishers: number;
  totalDNF: number;
  totalDNS: number;
  races: KUTCRaceInfo[];
  resultsStatus: string;
  resultsStatusLabel?: string;
  publishedAt?: any;
  lastSyncedAt: any;
}

export interface KUTCEdition {
  id: string;
  year: number;
  metadata?: KUTCEditionMetadata;
}

// ============================================
// Helpers
// ============================================

const normalizeEditionMetadata = (editionId: string, raw: any): KUTCEditionMetadata => {
  const summary = raw || {};
  const races = Array.isArray(summary.races)
    ? summary.races.map((race: any, index: number) => {
        const distanceKey = race.distanceKey || race.raceName?.toLowerCase().replace(/\s+/g, '-') || `race-${index}`;
        return {
          raceId: race.raceId ?? race.race_id ?? index,
          raceName: race.raceName ?? race.name ?? 'Race',
          distanceKey,
          participants: race.participants ?? race.totalParticipants ?? 0,
          finishers: race.finishers ?? race.totalFinishers ?? 0
        } as KUTCRaceInfo;
      })
    : [];

  const parsedYear = Number(editionId);
  const fallbackYear = Number.isFinite(parsedYear) ? parsedYear : 0;

  return {
    editionId: summary.editionId || editionId,
    year: summary.year ?? fallbackYear,
    eventDate: summary.eventDate || null,
    totalParticipants: summary.totalParticipants ?? 0,
    totalFinishers: summary.totalFinishers ?? 0,
    totalDNF: summary.totalDNF ?? 0,
    totalDNS: summary.totalDNS ?? 0,
    races,
    resultsStatus: summary.resultsStatus || 'unknown',
    resultsStatusLabel: summary.resultsStatusLabel || undefined,
    publishedAt: summary.publishedAt || null,
    lastSyncedAt: summary.lastSyncedAt || null
  };
};

// ============================================
// Service Functions
// ============================================

/**
 * List all KUTC event editions from kutcResults collection
 */
export const listKUTCEditions = async (): Promise<KUTCEdition[]> => {
  const collectionRef = collection(db, 'kutcResults');
  const querySnapshot = await getDocs(collectionRef);

  const editions = await Promise.all(querySnapshot.docs.map(async (docSnap) => {
    const data = docSnap.data() as any;
    let metadata = data?.metadata || data?.summary || null;

    if (!metadata) {
      const summaryRef = doc(db, 'kutcResults', docSnap.id, 'metadata', 'summary');
      const summarySnap = await getDoc(summaryRef);
      if (summarySnap.exists()) {
        metadata = summarySnap.data();
      }
    }

    if (!metadata) {
      return null;
    }

    const normalized = normalizeEditionMetadata(docSnap.id, metadata);
    console.log(`[KUTC] Normalized metadata for ${docSnap.id}:`, {
      year: normalized.year,
      eventDate: normalized.eventDate,
      resultsStatus: normalized.resultsStatus,
      totalParticipants: normalized.totalParticipants,
      totalFinishers: normalized.totalFinishers,
      totalDNF: normalized.totalDNF,
      totalDNS: normalized.totalDNS
    });

    // Try to enrich with eventEdition data
    // docSnap.id is already in format 'kutc-2025', so use it directly
    const editionDocId = docSnap.id;
    console.log(`[KUTC] Attempting to fetch eventEdition: ${editionDocId}`);
    try {
      const eventEdition = await getEventEdition(editionDocId);
      console.log(`[KUTC] EventEdition found for ${editionDocId}:`, {
        startTime: eventEdition.startTime,
        resultsStatus: eventEdition.resultsStatus
      });
      if (eventEdition) {
        // Use startTime from eventEdition if available
        if (eventEdition.startTime) {
          console.log(`[KUTC] Updating eventDate from ${normalized.eventDate} to ${eventEdition.startTime}`);
          normalized.eventDate = eventEdition.startTime;
        }
        // Use resultsStatus from eventEdition if available
        if (eventEdition.resultsStatus) {
          console.log(`[KUTC] Updating resultsStatus from ${normalized.resultsStatus} to ${eventEdition.resultsStatus}`);
          normalized.resultsStatus = eventEdition.resultsStatus;
        }
      }
    } catch (err) {
      console.warn(`[KUTC] Error fetching eventEdition for ${editionDocId}:`, err);
      console.log(`[KUTC] No eventEdition found, defaulting to 'unknown' status for ${editionDocId}`);
      // When eventEdition doesn't exist, default to 'unknown' status
      normalized.resultsStatus = 'unknown';
    }

    // Get verbose name for results status
    console.log(`[KUTC] Getting verbose name for resultsStatus: ${normalized.resultsStatus}`);
    try {
      const verboseName = await getVerboseName('results', 'status', normalized.resultsStatus, normalized.resultsStatus);
      console.log(`[KUTC] Verbose name for '${normalized.resultsStatus}': ${verboseName}`);
      normalized.resultsStatusLabel = verboseName;
    } catch (err) {
      console.error('[KUTC] Failed to get verbose name for results status:', err);
      normalized.resultsStatusLabel = normalized.resultsStatus;
    }

    return {
      id: docSnap.id,
      year: normalized.year,
      metadata: normalized
    } as KUTCEdition;
  }));

  return editions
    .filter((edition): edition is KUTCEdition => Boolean(edition))
    .sort((a, b) => b.year - a.year);
};

/**
 * Get metadata for a specific edition
 */
export const getEditionMetadata = async (editionId: string): Promise<KUTCEditionMetadata | null> => {
  try {
    const docRef = doc(db, 'kutcResults', editionId);
    const docSnap = await getDoc(docRef);
    const data = docSnap.exists() ? (docSnap.data() as any) : null;
    let metadata = data?.metadata || data?.summary || null;

    if (!metadata) {
      const summaryRef = doc(db, 'kutcResults', editionId, 'metadata', 'summary');
      const summarySnap = await getDoc(summaryRef);
      if (summarySnap.exists()) {
        metadata = summarySnap.data();
      }
    }

    if (!metadata) {
      return null;
    }

    const normalized = normalizeEditionMetadata(editionId, metadata);
    console.log(`[KUTC-Meta] Normalized metadata for ${editionId}:`, {
      year: normalized.year,
      eventDate: normalized.eventDate,
      resultsStatus: normalized.resultsStatus
    });

    // Try to enrich with eventEdition data
    // editionId is already in format 'kutc-2025' or just '2025', handle both
    const editionDocId = editionId.startsWith('kutc-') ? editionId : `kutc-${editionId}`;
    console.log(`[KUTC-Meta] Attempting to fetch eventEdition: ${editionDocId}`);
    try {
      const eventEdition = await getEventEdition(editionDocId);
      console.log(`[KUTC-Meta] EventEdition found for ${editionDocId}:`, {
        startTime: eventEdition.startTime,
        resultsStatus: eventEdition.resultsStatus
      });
      if (eventEdition) {
        // Use startTime from eventEdition if available
        if (eventEdition.startTime) {
          console.log(`[KUTC-Meta] Updating eventDate from ${normalized.eventDate} to ${eventEdition.startTime}`);
          normalized.eventDate = eventEdition.startTime;
        }
        // Use resultsStatus from eventEdition if available
        if (eventEdition.resultsStatus) {
          console.log(`[KUTC-Meta] Updating resultsStatus from ${normalized.resultsStatus} to ${eventEdition.resultsStatus}`);
          normalized.resultsStatus = eventEdition.resultsStatus;
        }
      }
    } catch (err) {
      console.warn(`[KUTC-Meta] Error fetching eventEdition for ${editionDocId}:`, err);
      console.log(`[KUTC-Meta] No eventEdition found, defaulting to 'unknown' status for ${editionDocId}`);
      // When eventEdition doesn't exist, default to 'unknown' status
      normalized.resultsStatus = 'unknown';
    }

    // Get verbose name for results status
    console.log(`[KUTC-Meta] Getting verbose name for resultsStatus: ${normalized.resultsStatus}`);
    try {
      const verboseName = await getVerboseName('results', 'status', normalized.resultsStatus, normalized.resultsStatus);
      console.log(`[KUTC-Meta] Verbose name for '${normalized.resultsStatus}': ${verboseName}`);
      normalized.resultsStatusLabel = verboseName;
    } catch (err) {
      console.error('[KUTC-Meta] Failed to get verbose name for results status:', err);
      normalized.resultsStatusLabel = normalized.resultsStatus;
    }

    return normalized;
  } catch (error) {
    console.error('getEditionMetadata error', error);
    throw error;
  }
};

/**
 * Get total competition results for an edition
 * Path: kutcResults/{editionId}/races/total/results
 */
export async function getTotalCompetitionResults(editionId: string): Promise<KUTCResultEntry[]> {
  const resultsRef = collection(db, `kutcResults/${editionId}/races/total/results`);
  const q = query(resultsRef, orderBy('finalRank', 'asc'));
  const snapshot = await getDocs(q);
  
  return snapshot.docs.map(d => ({
    ...d.data(),
    personId: parseInt(d.id)
  })) as KUTCResultEntry[];
}

/**
 * Get results for a specific race distance
 * Path: kutcResults/{editionId}/races/{distanceKey}/results
 */
export async function getRaceDistanceResults(
  editionId: string,
  distanceKey: string
): Promise<KUTCResultEntry[]> {
  const resultsRef = collection(db, `kutcResults/${editionId}/races/${distanceKey}/results`);
  const q = query(resultsRef, orderBy('raceRank', 'asc'));
  const snapshot = await getDocs(q);
  
  return snapshot.docs.map(d => ({
    ...d.data(),
    personId: parseInt(d.id)
  })) as KUTCResultEntry[];
}

/**
 * Get all race results for an edition (all distances)
 */
export async function getAllRaceResults(editionId: string): Promise<Map<string, KUTCResultEntry[]>> {
  const metadata = await getEditionMetadata(editionId);
  
  if (!metadata) {
    return new Map();
  }
  
  const resultsMap = new Map<string, KUTCResultEntry[]>();
  
  // Fetch results for each race
  for (const race of metadata.races) {
    if (race.distanceKey === 'total') {
      continue; // Skip total, use getTotalCompetitionResults for that
    }
    
    const results = await getRaceDistanceResults(editionId, race.distanceKey);
    resultsMap.set(race.distanceKey, results);
  }
  
  return resultsMap;
}

/**
 * Get a single runner's result from a specific race
 */
export async function getRunnerResult(
  editionId: string,
  distanceKey: string,
  personId: number
): Promise<KUTCResultEntry | null> {
  const resultRef = doc(db, `kutcResults/${editionId}/races/${distanceKey}/results/${personId}`);
  const snap = await getDoc(resultRef);
  
  if (!snap.exists()) {
    return null;
  }
  
  return {
    ...snap.data(),
    personId
  } as KUTCResultEntry;
}
