import { db } from '../config/firebase';
import {
  collection,
  getDocs,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  doc,
  query,
  orderBy,
  where
} from 'firebase/firestore';
import { Timestamp } from 'firebase/firestore';

export interface RaceDistance {
  id: string;
  displayName: string;
  length: number;
  ascent: number;
  descent: number;
  active?: boolean;
  fee?: number;
}

export interface EventEdition {
  id: string;
  eventId: string;
  edition: number;
  eventShortName: string;
  eventName: string;
  status: string;
  resultTypes: string[];
  resultsStatus: string;
  resultURL?: string;
  liveResultsURL?: string;
  RH_URL?: string; // Internal Runners Hub URL for events with dedicated pages (e.g., "/kutc-2025")
  startTime: Timestamp;
  endTime: Timestamp;
  registrationOpens?: Timestamp;
  registrationDeadline?: Timestamp;
  maxParticipants?: number;
  loopDistance?: number;
  raceDistances?: RaceDistance[];
  fees?: {
    participation: number;
    baseCamp: number;
    deposit: number;
    total: number;
  };
}

export interface EventEditionSummary {
  id: string;
  eventId: string;
  edition: number;
}

export interface Event {
  id: string;
  name: string;
  shortName: string;
  description?: string;
  maxParticipants?: number;
  raceDistances?: RaceDistance[];
  loopDistance?: number;  // Distance per loop in km (for loop-based events like KUTC)
  loopAscent?: number;    // Ascent per loop in meters (for loop-based events like KUTC)
  fees?: {
    participation: number;
    baseCamp: number;
    deposit: number;
    total: number;
  };
}

const COLL = 'eventEditions';
const EVENTS_COLL = 'events';

export const listEventEditions = async (): Promise<EventEditionSummary[]> => {
  const q = query(collection(db, COLL), orderBy('eventId'), orderBy('edition'));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({
    id: d.id,
    eventId: d.data().eventId,
    edition: d.data().edition
  } as EventEditionSummary));
};

export const getFullEventEditions = async (): Promise<EventEdition[]> => {
  const q = query(collection(db, COLL), orderBy('eventId'), orderBy('edition'));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({
    id: d.id,
    ...d.data()
  } as unknown as EventEdition));
};

export const getEventEdition = async (id: string): Promise<EventEdition> => {
  const ref = doc(db, COLL, id);
  const snap = await getDoc(ref);
  const data = snap.data();
  if (!data) throw new Error('EventEdition not found');
  const eventEdition = {
    id: snap.id,
    eventId: data.eventId,
    edition: data.edition,
    eventShortName: data.eventShortName || '',
    eventName: data.eventName || '',
    status: data.status || '',
    resultTypes: data.resultTypes || [],
    resultsStatus: data.resultsStatus || '',
    resultURL: data.resultURL || '',
    liveResultsURL: data.liveResultsURL || '',
    startTime: data.startTime,
    endTime: data.endTime,
    registrationOpens: data.registrationOpens,
    registrationDeadline: data.registrationDeadline,
    maxParticipants: data.maxParticipants,
    loopDistance: data.loopDistance,
    raceDistances: data.raceDistances || [],
    fees: data.fees || { participation: 0, baseCamp: 0, deposit: 0, total: 0 }
  } as EventEdition;
  return eventEdition;
};

export const addEventEdition = async (
  payload: Omit<EventEdition, 'id'>
): Promise<string> => {
  // Validate that eventId and edition exist and are valid
  if (!payload.eventId || payload.eventId.trim() === '') {
    console.error('Cannot create event edition: eventId is empty');
    throw new Error('Event ID is required to create an event edition');
  }
  
  if (typeof payload.edition !== 'number' || isNaN(payload.edition) || payload.edition <= 0) {
    console.error('Cannot create event edition: invalid edition number');
    throw new Error('Valid edition number is required to create an event edition');
  }
  
  // Format the eventId to ensure it's suitable for a document ID
  // Remove spaces and special characters
  const safeEventId = payload.eventId.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
  
  // Create a consistent document ID using eventId-edition format
  const docId = `${safeEventId}-${payload.edition}`;
  
  console.log(`Creating event edition with formatted ID: ${docId}`);
  
  // Make sure the payload being saved has the same eventId that's used in the document ID
  const finalPayload = {
    ...payload,
    eventId: payload.eventId.trim(), // Clean up but keep original format for display
    liveResultsURL: payload.liveResultsURL || ''
  };
  
  // Use setDoc with the generated ID instead of addDoc
  const docRef = doc(db, COLL, docId);
  await setDoc(docRef, finalPayload);
  
  console.log(`Created event edition with ID: ${docId}`);
  return docId;
};

export const updateEventEdition = async (
  id: string,
  payload: Partial<Omit<EventEdition, 'id'>>
): Promise<void> => {
  const ref = doc(db, COLL, id);
  try {
    await updateDoc(ref, {
      ...payload,
      liveResultsURL: payload.liveResultsURL ?? (payload as any).liveResultsURL ?? undefined
    } as any);
  } catch (error) {
    console.error('updateEventEdition - error updating event:', error);
    throw error;
  }
};

export const deleteEventEdition = async (id: string): Promise<void> => {
  const ref = doc(db, COLL, id);
  await deleteDoc(ref);
};

/**
 * Get general event information (not edition-specific)
 * Fetches from 'events' collection
 */
export const getEvent = async (eventId: string): Promise<Event> => {
  const ref = doc(db, EVENTS_COLL, eventId);
  const snap = await getDoc(ref);
  const data = snap.data();
  if (!data) throw new Error(`Event '${eventId}' not found`);
  
  return {
    id: snap.id,
    name: data.name || '',
    shortName: data.shortName || '',
    description: data.description,
    maxParticipants: data.maxParticipants,
    raceDistances: data.raceDistances || [],
    loopDistance: data.loopDistance,
    loopAscent: data.loopAscent,
    fees: data.fees || { participation: 0, baseCamp: 0, deposit: 0, total: 0 }
  } as Event;
};

/**
 * Get previous and next editions for an event based on current time
 * Previous = most recent edition that has ended (endTime < now)
 * Next = earliest edition that hasn't started yet (startTime > now)
 */
export const getAdjacentEditions = async (eventId: string): Promise<{
  previous: EventEdition | null;
  next: EventEdition | null;
}> => {
  const toDateSafe = (value: unknown): Date | null => {
    if (!value) return null;
    if (value instanceof Date) return value;
    if (typeof (value as { toDate?: () => Date }).toDate === 'function') {
      return (value as { toDate: () => Date }).toDate();
    }
    const parsed = new Date(value as any);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  };

  const q = query(
    collection(db, COLL),
    where('eventId', '==', eventId),
    orderBy('startTime', 'asc')
  );
  const snap = await getDocs(q);
  const editions = snap.docs.map(d => ({
    id: d.id,
    ...d.data()
  } as unknown as EventEdition)).filter(ed => ed.status !== 'hidden');

  const now = new Date();
  
  // Previous: most recent edition where endTime < now
  const pastEditions = editions.filter(ed => {
    const endTime = toDateSafe(ed.endTime);
    return !!endTime && endTime < now;
  });
  const previous = pastEditions.length > 0 ? pastEditions[pastEditions.length - 1] : null;
  
  // Next: earliest edition where startTime > now
  const futureEditions = editions.filter(ed => {
    const startTime = toDateSafe(ed.startTime);
    return !!startTime && startTime > now;
  });
  const next = futureEditions.length > 0 ? futureEditions[0] : null;
  
  return { previous, next };
};
