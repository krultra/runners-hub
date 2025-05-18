import { db } from '../config/firebase';
import {
  collection,
  getDocs,
  getDoc,
  addDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  doc,
  query,
  orderBy
} from 'firebase/firestore';
import { Timestamp } from 'firebase/firestore';

export interface RaceDistance {
  id: string;
  displayName: string;
  length: number;
  ascent: number;
  descent: number;
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
  startTime: Timestamp;
  endTime: Timestamp;
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

const COLL = 'eventEditions';

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
  console.log('eventEditionService - fetching event with id:', id);
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
    startTime: data.startTime,
    endTime: data.endTime,
    registrationDeadline: data.registrationDeadline,
    maxParticipants: data.maxParticipants,
    loopDistance: data.loopDistance,
    raceDistances: data.raceDistances || [],
    fees: data.fees || { participation: 0, baseCamp: 0, deposit: 0, total: 0 }
  } as EventEdition;
  console.log('eventEditionService - constructed event edition:', eventEdition);
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
    eventId: payload.eventId.trim() // Clean up but keep original format for display
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
  console.log('updateEventEdition - updating event with id:', id);
  console.log('updateEventEdition - payload:', payload);
  const ref = doc(db, COLL, id);
  try {
    await updateDoc(ref, payload as any);
    console.log('updateEventEdition - update successful');
  } catch (error) {
    console.error('updateEventEdition - error updating event:', error);
    throw error;
  }
};

export const deleteEventEdition = async (id: string): Promise<void> => {
  const ref = doc(db, COLL, id);
  await deleteDoc(ref);
};
