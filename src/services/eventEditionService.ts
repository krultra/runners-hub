import { db } from '../config/firebase';
import {
  collection,
  getDocs,
  getDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  query,
  orderBy
} from 'firebase/firestore';
import { Timestamp } from 'firebase/firestore';

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

export const getEventEdition = async (id: string): Promise<EventEdition> => {
  const ref = doc(db, COLL, id);
  const snap = await getDoc(ref);
  const data = snap.data();
  if (!data) throw new Error('EventEdition not found');
  return {
    id: snap.id,
    eventId: data.eventId,
    edition: data.edition,
    eventShortName: data.eventShortName || '',
    eventName: data.eventName || '',
    status: data.status || '',
    resultTypes: data.resultTypes || [],
    resultsStatus: data.resultsStatus || '',
    startTime: data.startTime,
    endTime: data.endTime
  } as EventEdition;
};

export const addEventEdition = async (
  payload: Omit<EventEdition, 'id'>
): Promise<string> => {
  const ref = await addDoc(collection(db, COLL), payload);
  return ref.id;
};

export const updateEventEdition = async (
  id: string,
  payload: Partial<Omit<EventEdition, 'id'>>
): Promise<void> => {
  const ref = doc(db, COLL, id);
  await updateDoc(ref, payload as any);
};

export const deleteEventEdition = async (id: string): Promise<void> => {
  const ref = doc(db, COLL, id);
  await deleteDoc(ref);
};
