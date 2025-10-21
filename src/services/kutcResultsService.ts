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

export interface AllTimeParticipant {
  personId: number;
  firstName: string;
  lastName: string;
  editionResults: Map<string, number | null>; // editionId -> loops completed (null = didn't participate, 0 = DNS)
  totalLoops: number;
}

export interface LoopRecord {
  personId: number;
  firstName: string;
  lastName: string;
  loopsCompleted: number;
  totalTimeSeconds: number | null;
  totalTimeDisplay: string;
  editionId: string;
  year: number;
}

export interface FastestTimeRecord {
  personId: number;
  firstName: string;
  lastName: string;
  distanceKey: string;
  raceName: string;
  loops: number; // Number of loops for this race distance
  timeSeconds: number;
  timeDisplay: string;
  editionId: string;
  year: number;
}

export interface AppearanceRecord {
  personId: number;
  firstName: string;
  lastName: string;
  appearances: number;
  editions: string[]; // edition IDs
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

const FINISHED_STATUS_VALUES = new Set(['finished', 'finish', 'finished!', 'complete', 'completed']);

const isFinishedStatus = (status?: string | null): boolean => {
  if (!status) return false;
  const normalized = String(status).trim().toLowerCase();
  if (!normalized) return false;
  if (FINISHED_STATUS_VALUES.has(normalized)) return true;
  // Support combined statuses like "finished (preliminary)"
  return normalized.startsWith('finished');
};

const countFinishedResults = (results: KUTCResultEntry[]): number =>
  results.reduce((acc, entry) => (isFinishedStatus(entry.status) ? acc + 1 : acc), 0);

const applyFinisherCounts = async (editionId: string, metadata: KUTCEditionMetadata): Promise<void> => {
  try {
    const totalResults = await getTotalCompetitionResults(editionId);
    metadata.totalFinishers = countFinishedResults(totalResults);
  } catch (err) {
    console.warn(`[KUTC] Unable to recompute total finishers for ${editionId}`, err);
  }

  const raceUpdates = await Promise.all(
    metadata.races
      .filter((race) => race.distanceKey && race.distanceKey !== 'total')
      .map(async (race) => {
        try {
          const results = await getRaceDistanceResults(editionId, race.distanceKey);
          return { key: race.distanceKey, finishers: countFinishedResults(results) };
        } catch (err) {
          console.warn(`[KUTC] Unable to recompute finishers for ${editionId}/${race.distanceKey}`, err);
          return { key: race.distanceKey, finishers: race.finishers };
        }
      })
  );

  const finisherMap = new Map(raceUpdates.map((r) => [r.key, r.finishers]));
  metadata.races = metadata.races.map((race) => {
    if (race.distanceKey === 'total') {
      return { ...race, finishers: metadata.totalFinishers };
    }
    const override = finisherMap.get(race.distanceKey);
    return typeof override === 'number' ? { ...race, finishers: override } : race;
  });
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

  await Promise.all(
    editions
      .filter((edition): edition is KUTCEdition => Boolean(edition))
      .map(async (edition) => {
        if (edition.metadata) {
          await applyFinisherCounts(edition.id, edition.metadata);
        }
      })
  );

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

    await applyFinisherCounts(editionDocId, normalized);

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

/**
 * Get all-time leaderboard data for KUTC
 * Aggregates loops completed across all editions for each participant
 */
export async function getAllTimeLeaderboard(): Promise<{
  participants: AllTimeParticipant[];
  editions: KUTCEdition[];
}> {
  console.log('[KUTC All-Time] Fetching editions...');
  
  // Get all editions (sorted by year)
  const editions = await listKUTCEditions();
  console.log(`[KUTC All-Time] Found ${editions.length} editions`);
  
  // Map to track all participants: personId -> participant data
  const participantMap = new Map<number, AllTimeParticipant>();
  
  // Fetch results for each edition
  for (const edition of editions) {
    console.log(`[KUTC All-Time] Processing ${edition.id}...`);
    
    try {
      // Get total competition results for this edition
      const results = await getTotalCompetitionResults(edition.id);
      console.log(`[KUTC All-Time] ${edition.id}: ${results.length} participants`);
      
      // Process each result
      for (const result of results) {
        const { personId, firstName, lastName, loopsCompleted, status } = result;
        
        // Get or create participant entry
        if (!participantMap.has(personId)) {
          participantMap.set(personId, {
            personId,
            firstName: firstName || 'Unknown',
            lastName: lastName || 'Unknown',
            editionResults: new Map(),
            totalLoops: 0
          });
        }
        
        const participant = participantMap.get(personId)!;
        
        // Update name if we have better data
        if (firstName) participant.firstName = firstName;
        if (lastName) participant.lastName = lastName;
        
        // Determine loops for this edition
        // loopsCompleted is number of loops, or 0 if DNS
        const loops = loopsCompleted ?? 0;
        participant.editionResults.set(edition.id, loops);
        participant.totalLoops += loops;
      }
    } catch (err) {
      console.error(`[KUTC All-Time] Error fetching results for ${edition.id}:`, err);
    }
  }
  
  // Convert map to array and sort by total loops (descending)
  const participants = Array.from(participantMap.values())
    .sort((a, b) => b.totalLoops - a.totalLoops);
  
  console.log(`[KUTC All-Time] Total unique participants: ${participants.length}`);
  
  return {
    participants,
    editions
  };
}

/**
 * Get max loops records across all KUTC editions
 * Returns top 3 results (with ties) sorted by loops completed, then by time
 */
export async function getMaxLoopsRecords(): Promise<LoopRecord[]> {
  console.log('[KUTC Records] Fetching max loops records...');
  
  const editions = await listKUTCEditions();
  const allRecords: LoopRecord[] = [];
  
  // Collect all total competition results across editions
  for (const edition of editions) {
    try {
      const results = await getTotalCompetitionResults(edition.id);
      
      for (const result of results) {
        if (result.loopsCompleted && result.loopsCompleted > 0) {
          allRecords.push({
            personId: result.personId,
            firstName: result.firstName || 'Unknown',
            lastName: result.lastName || 'Unknown',
            loopsCompleted: result.loopsCompleted,
            totalTimeSeconds: result.totalTimeSeconds || null,
            totalTimeDisplay: result.totalTimeDisplay || '-',
            editionId: edition.id,
            year: edition.year
          });
        }
      }
    } catch (err) {
      console.error(`[KUTC Records] Error fetching results for ${edition.id}:`, err);
    }
  }
  
  // Sort by loops (descending), then by time (ascending)
  allRecords.sort((a, b) => {
    if (a.loopsCompleted !== b.loopsCompleted) {
      return b.loopsCompleted - a.loopsCompleted;
    }
    // Handle null times
    if (a.totalTimeSeconds === null && b.totalTimeSeconds === null) return 0;
    if (a.totalTimeSeconds === null) return 1;
    if (b.totalTimeSeconds === null) return -1;
    return a.totalTimeSeconds - b.totalTimeSeconds;
  });
  
  // Get top records (include ties for 3rd place)
  if (allRecords.length === 0) return [];
  
  const topRecords: LoopRecord[] = [];
  const maxLoops = allRecords[0].loopsCompleted;
  let thirdPlaceLoops = 0;
  
  // Find the loops count for 3rd place
  let placesFound = 0;
  let currentLoops = maxLoops;
  
  for (const record of allRecords) {
    if (record.loopsCompleted < currentLoops) {
      placesFound++;
      currentLoops = record.loopsCompleted;
    }
    if (placesFound === 2) {
      thirdPlaceLoops = record.loopsCompleted;
      break;
    }
  }
  
  // Include all records with loops >= 3rd place loops
  for (const record of allRecords) {
    if (thirdPlaceLoops > 0 && record.loopsCompleted >= thirdPlaceLoops) {
      topRecords.push(record);
    } else if (thirdPlaceLoops === 0 && topRecords.length < 3) {
      topRecords.push(record);
    }
  }
  
  console.log(`[KUTC Records] Found ${topRecords.length} max loops records`);
  return topRecords;
}

/**
 * Get fastest race times for each distance across all editions
 * Returns map of distanceKey -> fastest records (with ties)
 */
export async function getFastestRaceTimes(): Promise<Map<string, FastestTimeRecord[]>> {
  console.log('[KUTC Records] Fetching fastest race times...');
  
  const editions = await listKUTCEditions();
  const distanceRecords: Record<string, FastestTimeRecord[]> = {};
  
  // Collect all race results
  for (const edition of editions) {
    if (!edition.metadata?.races) continue;
    
    for (const race of edition.metadata.races) {
      if (race.distanceKey === 'total') continue; // Skip total competition
      
      try {
        const results = await getRaceDistanceResults(edition.id, race.distanceKey);
        
        for (const result of results) {
          if (result.raceTimeSeconds && result.raceTimeSeconds > 0) {
            // Extract loop count from race name (e.g., "12-Loops" or "12 - Loops" -> 12)
            const loopMatch = race.raceName.match(/^(\d+)\s*-/);
            const loops = loopMatch ? parseInt(loopMatch[1], 10) : 0;
            
            const record: FastestTimeRecord = {
              personId: result.personId,
              firstName: result.firstName || 'Unknown',
              lastName: result.lastName || 'Unknown',
              distanceKey: race.distanceKey,
              raceName: race.raceName,
              loops,
              timeSeconds: result.raceTimeSeconds,
              timeDisplay: result.raceTimeDisplay || '-',
              editionId: edition.id,
              year: edition.year
            };
            
            if (!distanceRecords[race.distanceKey]) {
              distanceRecords[race.distanceKey] = [];
            }
            distanceRecords[race.distanceKey].push(record);
          }
        }
      } catch (err) {
        console.error(`[KUTC Records] Error fetching race ${race.distanceKey} for ${edition.id}:`, err);
      }
    }
  }
  
  // For each distance, keep top 3 times (including ties for 3rd place)
  const fastestByDistance = new Map<string, FastestTimeRecord[]>();
  
  Object.keys(distanceRecords).forEach((distanceKey: string) => {
    const recordsForDistance = distanceRecords[distanceKey];
    if (!recordsForDistance || recordsForDistance.length === 0) {
      return;
    }

    const sortedRecords: FastestTimeRecord[] = recordsForDistance
      .slice()
      .sort((a: FastestTimeRecord, b: FastestTimeRecord) => a.timeSeconds - b.timeSeconds);

    // Find top 3 unique times (with ties)
    const topRecords: FastestTimeRecord[] = [];
    let placesFound = 0;
    let currentTime = -1;
    
    for (const record of sortedRecords) {
      if (record.timeSeconds !== currentTime) {
        placesFound++;
        currentTime = record.timeSeconds;
      }
      if (placesFound <= 3) {
        topRecords.push(record);
      } else {
        break;
      }
    }

    fastestByDistance.set(distanceKey, topRecords);
    console.log(`[KUTC Records] ${distanceKey}: ${topRecords.length} top record(s)`);
  });
  
  return fastestByDistance;
}

/**
 * Get appearance leaders (most editions participated in)
 * Returns all participants tied for most appearances
 */
export async function getAppearanceLeaders(): Promise<AppearanceRecord[]> {
  console.log('[KUTC Records] Fetching appearance leaders...');
  
  const editions = await listKUTCEditions();
  const participantAppearances = new Map<number, { firstName: string; lastName: string; editions: string[] }>();
  
  // Count appearances for each participant
  for (const edition of editions) {
    try {
      const results = await getTotalCompetitionResults(edition.id);
      
      for (const result of results) {
        if (!participantAppearances.has(result.personId)) {
          participantAppearances.set(result.personId, {
            firstName: result.firstName || 'Unknown',
            lastName: result.lastName || 'Unknown',
            editions: []
          });
        }
        
        participantAppearances.get(result.personId)!.editions.push(edition.id);
        
        // Update name if we have better data
        if (result.firstName) {
          participantAppearances.get(result.personId)!.firstName = result.firstName;
        }
        if (result.lastName) {
          participantAppearances.get(result.personId)!.lastName = result.lastName;
        }
      }
    } catch (err) {
      console.error(`[KUTC Records] Error fetching results for ${edition.id}:`, err);
    }
  }
  
  // Convert to array and sort by appearances
  const appearanceRecords: AppearanceRecord[] = Array.from(participantAppearances.entries()).map(
    ([personId, data]) => ({
      personId,
      firstName: data.firstName,
      lastName: data.lastName,
      appearances: data.editions.length,
      editions: data.editions
    })
  ).sort((a, b) => b.appearances - a.appearances);
  
  // Return only those tied for most appearances
  if (appearanceRecords.length === 0) return [];
  
  const maxAppearances = appearanceRecords[0].appearances;
  const leaders = appearanceRecords.filter(r => r.appearances === maxAppearances);
  
  console.log(`[KUTC Records] ${leaders.length} leader(s) with ${maxAppearances} appearances`);
  return leaders;
}
