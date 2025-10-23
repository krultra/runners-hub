import { db } from '../config/firebase';
import {
  collection,
  query,
  where,
  orderBy,
  getDocs,
  Timestamp
} from 'firebase/firestore';
import { getEvent } from './eventEditionService';
import type { Event } from './eventEditionService';

// ============================================================================
// Types & Interfaces
// ============================================================================

export interface CheckpointResult {
  // Identifiers
  id: string;
  eventEditionId: string;
  userId: string;
  personId?: number;
  raceId: number;
  
  // Participant Info
  bib: string;
  firstName: string;
  lastName: string;
  
  // Race Info
  raceName: string;
  raceDistance: number;
  
  // Checkpoint Info
  checkpointId: number;
  checkpointName: string;
  isStartCp: boolean;
  isFinishCp: boolean;
  loopNumber: number;
  sequenceNumber: number;
  
  // Timing Data
  scanTime: Timestamp;
  adjustedScanTime: Timestamp;
  legTimeSeconds: number | null;
  loopTimeSeconds: number | null;
  cumulativeTimeSeconds: number;
  restTimeSeconds: number;
  
  // Rankings
  racePosition: number;
  racePositionChange: number;
  overallPosition: number;
  overallPositionChange: number;
  
  // Distance/Ascent data (if available)
  legDistance?: number | null;
  legAscent?: number | null;
  cumulativeDistance?: number | null;
  cumulativeAscent?: number | null;
  
  // Metadata
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface EnrichedCheckpointResult extends CheckpointResult {
  // Formatted times
  legTimeFormatted: string;
  raceTimeFormatted: string;
  scanTimeFormatted: string;
  
  // Speeds and paces (calculated from legDistance and legTimeSeconds)
  legSpeedKmh: number | null;
  averageSpeedKmh: number | null;
  legPaceMinPerKm: number | null;
  averagePaceMinPerKm: number | null;
  legPaceFormatted: string;
  averagePaceFormatted: string;
  
  // Position changes with display format
  racePositionChangeDisplay: string;
  overallPositionChangeDisplay: string;
}

export interface LoopAggregate {
  loopNumber: number;
  
  // Time aggregates
  totalLoopTime: number;        // seconds
  movingTime: number;           // seconds (total - rest)
  restTime: number;             // seconds
  
  // Formatted times
  totalLoopTimeFormatted: string;
  movingTimeFormatted: string;
  restTimeFormatted: string;
  accumulatedRestTime: number;
  accumulatedRestTimeFormatted: string;

  // Distance aggregates
  totalDistance: number | null;  // km
  totalAscent: number | null;    // m
  cumulativeDistance: number | null;
  cumulativeAscent: number | null;

  // Performance aggregates
  averagePaceMinPerKm: number | null;
  averageSpeedKmh: number | null;
  averagePaceFormatted: string;
  
  // Rankings at loop end
  racePositionAtEnd: number;
  overallPositionAtEnd: number;
  racePositionChangeThisLoop: number | null;
  overallPositionChangeThisLoop: number | null;
  
  // Checkpoints in this loop
  checkpoints: EnrichedCheckpointResult[];
}

export interface CheckpointSummary {
  userId: string;
  eventEditionId: string;
  participantName: string;
  bib: string;
  raceName: string;
  raceDistance: number;
  
  totalCheckpoints: number;
  totalLoops: number;
  totalDistance: number | null;
  totalAscent: number | null;
  totalRaceTime: number;
  totalRestTime: number;
  totalMovingTime: number;
  
  // Formatted times
  totalRaceTimeFormatted: string;
  totalRestTimeFormatted: string;
  totalMovingTimeFormatted: string;
  
  // Overall performance
  averagePaceMinPerKm: number | null;
  averageSpeedKmh: number | null;
  averagePaceFormatted: string;
  
  // Final rankings
  finalRacePosition: number;
  finalOverallPosition: number;
  
  // Performance insights
  fastestLeg: {
    checkpointName: string;
    loopNumber: number;
    pace: number;
    paceFormatted: string;
  } | null;
  slowestLeg: {
    checkpointName: string;
    loopNumber: number;
    pace: number;
    paceFormatted: string;
  } | null;
  biggestGain: {
    checkpointName: string;
    loopNumber: number;
    positionChange: number;
    type: 'race' | 'overall';
  } | null;
  biggestLoss: {
    checkpointName: string;
    loopNumber: number;
    positionChange: number;
    type: 'race' | 'overall';
  } | null;
}

// ============================================================================
// Formatting Utilities
// ============================================================================

/**
 * Format seconds to HH:MM:SS
 */
export function formatTime(seconds: number | null): string {
  if (seconds === null || seconds === undefined) return '-';
  
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Format pace as MM:SS per km
 */
export function formatPace(minPerKm: number | null): string {
  if (minPerKm === null || minPerKm === undefined || minPerKm === 0) return '-';
  if (minPerKm < 0 || !isFinite(minPerKm)) return '-';
  
  const minutes = Math.floor(minPerKm);
  const seconds = Math.floor((minPerKm - minutes) * 60);
  
  return `${minutes}:${seconds.toString().padStart(2, '0')} /km`;
}

/**
 * Format speed as X.X km/h
 */
export function formatSpeed(kmh: number | null): string {
  if (kmh === null || kmh === undefined || kmh === 0) return '-';
  if (kmh < 0 || !isFinite(kmh)) return '-';
  
  return `${kmh.toFixed(1)} km/h`;
}

/**
 * Format position change with +/- prefix
 */
export function formatPositionChange(change: number): string {
  if (change === 0) return '-';
  if (change > 0) return `+${change}`;
  return change.toString();
}

/**
 * Format timestamp to readable date/time
 */
export function formatDateTime(timestamp: Timestamp): string {
  const date = timestamp.toDate();
  return date.toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
}

/**
 * Format timestamp to time only (HH:MM:SS)
 */
export function formatTimeOnly(timestamp: Timestamp): string {
  const date = timestamp.toDate();
  return date.toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
}

// ============================================================================
// Calculation Utilities
// ============================================================================

/**
 * Calculate pace in min/km from distance (km) and time (seconds)
 */
export function calculatePace(distanceKm: number | null, timeSeconds: number | null): number | null {
  if (!distanceKm || !timeSeconds || distanceKm <= 0 || timeSeconds <= 0) return null;
  return (timeSeconds / 60) / distanceKm;
}

/**
 * Calculate speed in km/h from distance (km) and time (seconds)
 */
export function calculateSpeed(distanceKm: number | null, timeSeconds: number | null): number | null {
  if (!distanceKm || !timeSeconds || distanceKm <= 0 || timeSeconds <= 0) return null;
  return distanceKm / (timeSeconds / 3600);
}

// ============================================================================
// Query Functions
// ============================================================================

/**
 * Get all checkpoint results for a runner in an event
 */
export async function getCheckpointResults(
  eventEditionId: string,
  userId: string
): Promise<CheckpointResult[]> {
  const resultsRef = collection(db, 'checkpointResults');
  const q = query(
    resultsRef,
    where('eventEditionId', '==', eventEditionId),
    where('userId', '==', userId),
    orderBy('sequenceNumber', 'asc')
  );
  
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => doc.data() as CheckpointResult);
}

/**
 * Get enriched checkpoint results with all calculated metrics
 */
export async function getEnrichedCheckpointResults(
  eventEditionId: string,
  userId: string
): Promise<EnrichedCheckpointResult[]> {
  const results = await getCheckpointResults(eventEditionId, userId);

  if (results.length > 0) {
    // Extract eventId from eventEditionId (e.g., "kutc-2025" -> "kutc")
    const eventId = eventEditionId.split('-')[0];
    try {
      const event = await getEvent(eventId) as Event & {
        loopDistance?: number | null;
        loopAscent?: number | null;
      };
      const loopDistance = event.loopDistance ?? null;
      const loopAscent = event.loopAscent ?? null;
      const halfLoopDistance = loopDistance != null ? loopDistance / 2 : null;
      const halfLoopAscent = loopAscent != null ? loopAscent / 2 : null;

      if (loopDistance != null || loopAscent != null) {
        return results.map(result => {
          const loopsCompleted = result.loopNumber - 1; // Loops fully completed before this one

          let legDistance = result.legDistance ?? null;
          if (legDistance === null && loopDistance != null) {
            if (result.isStartCp) {
              legDistance = 0;
            } else if (result.isFinishCp) {
              legDistance = halfLoopDistance ?? loopDistance;
            } else {
              legDistance = halfLoopDistance ?? loopDistance;
            }
          }

          let legAscent = result.legAscent ?? null;
          if (legAscent === null && loopAscent != null) {
            if (result.isStartCp) {
              legAscent = 0;
            } else if (result.isFinishCp) {
              legAscent = halfLoopAscent ?? loopAscent;
            } else {
              legAscent = halfLoopAscent ?? loopAscent;
            }
          }

          let cumulativeDistance = result.cumulativeDistance ?? null;
          if (loopDistance != null && cumulativeDistance === null) {
            if (result.isStartCp) {
              cumulativeDistance = loopsCompleted * loopDistance;
            } else if (result.isFinishCp) {
              cumulativeDistance = loopsCompleted * loopDistance + loopDistance;
            } else {
              cumulativeDistance = loopsCompleted * loopDistance + (halfLoopDistance ?? loopDistance);
            }
          }

          let cumulativeAscent = result.cumulativeAscent ?? null;
          if (loopAscent != null && cumulativeAscent === null) {
            if (result.isStartCp) {
              cumulativeAscent = loopsCompleted * loopAscent;
            } else if (result.isFinishCp) {
              cumulativeAscent = loopsCompleted * loopAscent + loopAscent;
            } else {
              cumulativeAscent = loopsCompleted * loopAscent + (halfLoopAscent ?? loopAscent);
            }
          }

          return enrichCheckpointResult({
            ...result,
            legDistance,
            legAscent,
            cumulativeDistance,
            cumulativeAscent
          });
        });
      }
    } catch (err) {
      console.error('[Checkpoint Service] Failed to fetch event data for distance calculation:', err);
    }
  }

  // Default enrichment when event loop data is unavailable
  return results.map(result => enrichCheckpointResult(result));
}

/**
 * Enrich a single checkpoint result with calculated fields
 */
function enrichCheckpointResult(result: CheckpointResult): EnrichedCheckpointResult {
  // Calculate pace and speed for this leg
  const legPace = calculatePace(result.legDistance || null, result.legTimeSeconds);
  const legSpeed = calculateSpeed(result.legDistance || null, result.legTimeSeconds);
  
  // Calculate average pace and speed up to this point
  const avgPace = calculatePace(result.cumulativeDistance || null, result.cumulativeTimeSeconds);
  const avgSpeed = calculateSpeed(result.cumulativeDistance || null, result.cumulativeTimeSeconds);
  
  return {
    ...result,
    legTimeFormatted: formatTime(result.legTimeSeconds),
    raceTimeFormatted: formatTime(result.cumulativeTimeSeconds),
    scanTimeFormatted: formatTimeOnly(result.adjustedScanTime),
    legSpeedKmh: legSpeed,
    averageSpeedKmh: avgSpeed,
    legPaceMinPerKm: legPace,
    averagePaceMinPerKm: avgPace,
    legPaceFormatted: formatPace(legPace),
    averagePaceFormatted: formatPace(avgPace),
    racePositionChangeDisplay: formatPositionChange(result.racePositionChange),
    overallPositionChangeDisplay: formatPositionChange(result.overallPositionChange),
  };
}

/**
 * Group checkpoint results by loop
 */
export async function groupByLoop(
  checkpoints: EnrichedCheckpointResult[],
  eventEditionId?: string
): Promise<LoopAggregate[]> {
  // Try to fetch event data for loop distance/ascent
  let loopDistance: number | null = null;
  let loopAscent: number | null = null;

  if (eventEditionId) {
    const eventId = eventEditionId.split('-')[0];
    try {
      const event = await getEvent(eventId) as Event & {
        loopDistance?: number | null;
        loopAscent?: number | null;
      };
      loopDistance = event.loopDistance ?? null;
      loopAscent = event.loopAscent ?? null;
    } catch (err) {
      console.error('Failed to fetch event data for loop grouping:', err);
    }
  }
  const loopMap = new Map<number, EnrichedCheckpointResult[]>();

  // Group checkpoints by loop number
  for (const cp of checkpoints) {
    if (!loopMap.has(cp.loopNumber)) {
      loopMap.set(cp.loopNumber, []);
    }
    loopMap.get(cp.loopNumber)!.push(cp);
  }

  // Create loop aggregates
  const loops: LoopAggregate[] = [];
  const loopEntries = Array.from(loopMap.entries()).sort((a, b) => a[0] - b[0]);

  let accumulatedRestTime = 0;
  let accumulatedDistance: number | null = null;
  let accumulatedAscent: number | null = null;
  let previousRacePosition: number | null = null;
  let previousOverallPosition: number | null = null;

  for (const [loopNumber, loopCheckpoints] of loopEntries) {
    // Sort checkpoints by sequence number
    loopCheckpoints.sort((a: EnrichedCheckpointResult, b: EnrichedCheckpointResult) => a.sequenceNumber - b.sequenceNumber);

    // Find the finish checkpoint (last checkpoint in loop)
    const finishCp = loopCheckpoints[loopCheckpoints.length - 1];
    
    // Calculate loop totals
    const totalLoopTime = finishCp.loopTimeSeconds || 0;
    const restTime = loopCheckpoints.reduce((sum: number, cp: EnrichedCheckpointResult) => sum + (cp.restTimeSeconds || 0), 0);
    const movingTime = totalLoopTime - restTime;
    accumulatedRestTime += restTime;

    // Distance and ascent per loop
    // Use event loop distance/ascent if available (all loops are the same)
    // Otherwise calculate from cumulative values
    let totalDistance = loopDistance;
    let totalAscent = loopAscent;

    if (totalDistance === null && finishCp.cumulativeDistance !== null && finishCp.cumulativeDistance !== undefined) {
      const startDistance = loopCheckpoints[0].cumulativeDistance || 0;
      totalDistance = finishCp.cumulativeDistance - startDistance;
    }

    if (totalAscent === null && finishCp.cumulativeAscent !== null && finishCp.cumulativeAscent !== undefined) {
      const startAscent = loopCheckpoints[0].cumulativeAscent || 0;
      totalAscent = finishCp.cumulativeAscent - startAscent;
    }

    if (totalDistance !== null) {
      accumulatedDistance = (accumulatedDistance ?? 0) + totalDistance;
    }

    if (totalAscent !== null) {
      accumulatedAscent = (accumulatedAscent ?? 0) + totalAscent;
    }

    const cumulativeDistance = totalDistance !== null
      ? accumulatedDistance
      : finishCp.cumulativeDistance ?? accumulatedDistance;

    const cumulativeAscent = totalAscent !== null
      ? accumulatedAscent
      : finishCp.cumulativeAscent ?? accumulatedAscent;

    // Performance metrics
    const averagePace = calculatePace(totalDistance, movingTime);
    const averageSpeed = calculateSpeed(totalDistance, movingTime);

    // Position changes for this loop
    const racePositionChangeThisLoop = previousRacePosition !== null ? finishCp.racePosition - previousRacePosition : null;
    const overallPositionChangeThisLoop = previousOverallPosition !== null ? finishCp.overallPosition - previousOverallPosition : null;

    previousRacePosition = finishCp.racePosition;
    previousOverallPosition = finishCp.overallPosition;

    loops.push({
      loopNumber,
      totalLoopTime,
      movingTime,
      restTime,
      totalLoopTimeFormatted: formatTime(totalLoopTime),
      movingTimeFormatted: formatTime(movingTime),
      restTimeFormatted: formatTime(restTime),
      accumulatedRestTime,
      accumulatedRestTimeFormatted: formatTime(accumulatedRestTime),
      totalDistance,
      totalAscent,
      cumulativeDistance: cumulativeDistance ?? null,
      cumulativeAscent: cumulativeAscent ?? null,
      averagePaceMinPerKm: averagePace,
      averageSpeedKmh: averageSpeed,
      averagePaceFormatted: formatPace(averagePace),
      racePositionAtEnd: finishCp.racePosition,
      overallPositionAtEnd: finishCp.overallPosition,
      racePositionChangeThisLoop,
      overallPositionChangeThisLoop,
      checkpoints: loopCheckpoints
    });
  }

  return loops;
}

/**
 * Get summary statistics for a runner's performance
 */
export async function getCheckpointSummary(
  eventEditionId: string,
  userId: string
): Promise<CheckpointSummary> {
  const checkpoints = await getEnrichedCheckpointResults(eventEditionId, userId);
  
  if (checkpoints.length === 0) {
    throw new Error('No checkpoint results found');
  }
  
  const lastCheckpoint = checkpoints[checkpoints.length - 1];
  const loops = await groupByLoop(checkpoints, eventEditionId);
  
  // Calculate distance/ascent from loop count if not in data
  let totalDistance = lastCheckpoint.cumulativeDistance || null;
  let totalAscent = lastCheckpoint.cumulativeAscent || null;
  
  if (totalDistance === null || totalAscent === null) {
    // Extract eventId and fetch event data
    const eventId = eventEditionId.split('-')[0];
    try {
      const event = await getEvent(eventId);
      if (event.loopDistance && event.loopAscent) {
        const loopCount = loops.length;
        totalDistance = loopCount * event.loopDistance;
        totalAscent = loopCount * event.loopAscent;
      }
    } catch (err) {
      console.error('Failed to fetch event data for summary:', err);
    }
  }
  
  // Calculate totals
  const totalRestTime = checkpoints.reduce((sum: number, cp: EnrichedCheckpointResult) => sum + (cp.restTimeSeconds || 0), 0);
  const totalMovingTime = lastCheckpoint.cumulativeTimeSeconds - totalRestTime;
  
  // Calculate average pace/speed based on total distance and moving time
  const averagePaceMinPerKm = calculatePace(totalDistance, totalMovingTime);
  const averageSpeedKmh = calculateSpeed(totalDistance, totalMovingTime);
  
  // Find fastest and slowest legs (by pace)
  const legsWithPace = checkpoints.filter(cp => cp.legPaceMinPerKm !== null && cp.legTimeSeconds !== null && cp.legTimeSeconds > 0);
  const fastestLeg = legsWithPace.length > 0
    ? legsWithPace.reduce((min, cp) => cp.legPaceMinPerKm! < min.legPaceMinPerKm! ? cp : min)
    : null;
  const slowestLeg = legsWithPace.length > 0
    ? legsWithPace.reduce((max, cp) => cp.legPaceMinPerKm! > max.legPaceMinPerKm! ? cp : max)
    : null;
  
  // Find biggest position changes
  const gainChanges = checkpoints.filter(cp => cp.racePositionChange > 0 || cp.overallPositionChange > 0);
  const lossChanges = checkpoints.filter(cp => cp.racePositionChange < 0 || cp.overallPositionChange < 0);
  
  const biggestGain = gainChanges.length > 0
    ? gainChanges.reduce((max, cp) => {
        const maxChange = Math.max(max.racePositionChange, max.overallPositionChange);
        const cpChange = Math.max(cp.racePositionChange, cp.overallPositionChange);
        return cpChange > maxChange ? cp : max;
      })
    : null;
  
  const biggestLoss = lossChanges.length > 0
    ? lossChanges.reduce((max, cp) => {
        const maxChange = Math.min(max.racePositionChange, max.overallPositionChange);
        const cpChange = Math.min(cp.racePositionChange, cp.overallPositionChange);
        return cpChange < maxChange ? cp : max;
      })
    : null;
  
  return {
    userId,
    eventEditionId,
    participantName: `${lastCheckpoint.firstName} ${lastCheckpoint.lastName}`,
    bib: lastCheckpoint.bib,
    raceName: lastCheckpoint.raceName,
    raceDistance: lastCheckpoint.raceDistance,
    totalCheckpoints: checkpoints.length,
    totalLoops: loops.length,
    totalDistance,
    totalAscent,
    totalRaceTime: lastCheckpoint.cumulativeTimeSeconds,
    totalRestTime,
    totalMovingTime,
    totalRaceTimeFormatted: formatTime(lastCheckpoint.cumulativeTimeSeconds),
    totalRestTimeFormatted: formatTime(totalRestTime),
    totalMovingTimeFormatted: formatTime(totalMovingTime),
    averagePaceMinPerKm,
    averageSpeedKmh,
    averagePaceFormatted: formatPace(averagePaceMinPerKm),
    finalRacePosition: lastCheckpoint.racePosition,
    finalOverallPosition: lastCheckpoint.overallPosition,
    fastestLeg: fastestLeg ? {
      checkpointName: fastestLeg.checkpointName,
      loopNumber: fastestLeg.loopNumber,
      pace: fastestLeg.legPaceMinPerKm!,
      paceFormatted: formatPace(fastestLeg.legPaceMinPerKm)
    } : null,
    slowestLeg: slowestLeg ? {
      checkpointName: slowestLeg.checkpointName,
      loopNumber: slowestLeg.loopNumber,
      pace: slowestLeg.legPaceMinPerKm!,
      paceFormatted: formatPace(slowestLeg.legPaceMinPerKm)
    } : null,
    biggestGain: biggestGain ? {
      checkpointName: biggestGain.checkpointName,
      loopNumber: biggestGain.loopNumber,
      positionChange: Math.max(biggestGain.racePositionChange, biggestGain.overallPositionChange),
      type: biggestGain.racePositionChange >= biggestGain.overallPositionChange ? 'race' : 'overall'
    } : null,
    biggestLoss: biggestLoss ? {
      checkpointName: biggestLoss.checkpointName,
      loopNumber: biggestLoss.loopNumber,
      positionChange: Math.min(biggestLoss.racePositionChange, biggestLoss.overallPositionChange),
      type: Math.abs(biggestLoss.racePositionChange) >= Math.abs(biggestLoss.overallPositionChange) ? 'race' : 'overall'
    } : null
  };
}
