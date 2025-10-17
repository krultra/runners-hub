import { db } from '../config/firebase';
import {
  collection,
  collectionGroup,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  where
} from 'firebase/firestore';

export interface SummaryEntry {
  personId: number;
  raceId: number;
  bib?: string;
  firstName?: string;
  lastName?: string;
  raceName?: string;
  loopsCompleted?: number;
  finalRank?: number | null;
  raceRank?: number | null;
  finishTime?: any;
  totalTimeSeconds?: number | null;
  raceFinishTime?: any;
  raceTimeSeconds?: number | null;
  status?: string;
}

export interface RaceSummary {
  raceId: string;
  raceName?: string;
  entries: SummaryEntry[];
}

export async function listKUTCEventEditions(): Promise<{ id: string; eventId: string; edition: number; eventName?: string }[]> {
  const q = query(collection(db, 'eventEditions'), where('eventId', '==', 'kutc'));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...(d.data() as any) }));
}

export async function getEditionRaceSummaries(editionId: string): Promise<RaceSummary[]> {
  const racesRef = collection(db, `resultsSummary/${editionId}/races`);
  const racesSnap = await getDocs(racesRef);
  const results: RaceSummary[] = [];
  for (const raceDoc of racesSnap.docs) {
    const entriesRef = collection(db, `resultsSummary/${editionId}/races/${raceDoc.id}/entries`);
    const entriesQ = query(entriesRef, orderBy('loopsCompleted', 'desc'), orderBy('totalTimeSeconds', 'asc'));
    const entriesSnap = await getDocs(entriesQ);
    const entries = entriesSnap.docs.map(d => ({ id: d.id, ...(d.data() as any) })) as any as SummaryEntry[];
    results.push({ raceId: raceDoc.id, raceName: (raceDoc.data() as any)?.raceName, entries });
  }
  return results;
}

export async function getAllTimeLeaderboard(): Promise<{ personId: number; firstName?: string; lastName?: string; totalLoops: number; appearances?: number; bestLoopsYear?: number; lastAppearance?: any }[]> {
  const ref = collection(db, 'allTime/kutc/leaderboard');
  const q = query(ref, orderBy('totalLoops', 'desc'), orderBy('appearances', 'desc'));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...(d.data() as any) }));
}

export async function getEditionAggregates(editionId: string): Promise<any | null> {
  const ref = doc(db, `resultsAggregates/${editionId}`);
  const snap = await getDoc(ref);
  return snap.exists() ? snap.data() : null;
}

export async function getKUTCRecords(): Promise<any | null> {
  // Prefer a consolidated records doc
  const ref = doc(db, 'allTime/kutc/records');
  const snap = await getDoc(ref);
  if (snap.exists()) return snap.data();
  return null;
}

export async function getRunnerSplits(editionId: string, raceId: string, personId: string): Promise<any[]> {
  const ref = collection(db, `resultsSummary/${editionId}/races/${raceId}/entries/${personId}/splits`);
  const q = query(ref, orderBy('sequenceNumber', 'asc'));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...(d.data() as any) }));
}
