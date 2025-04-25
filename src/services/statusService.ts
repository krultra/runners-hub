import { db } from '../config/firebase';
import { collection, getDocs, addDoc, deleteDoc, doc } from 'firebase/firestore';

export interface RegistrationStatus {
  id: string;
  label: string;
}

const STATUSES_COLLECTION = 'registrationStatuses';

/**
 * Fetches all registration status entries
 */
export const listRegistrationStatuses = async (): Promise<RegistrationStatus[]> => {
  const snap = await getDocs(collection(db, STATUSES_COLLECTION));
  return snap.docs.map(d => ({ id: d.id, label: d.data().label }));
};

/**
 * Adds a new registration status
 */
export const addRegistrationStatus = async (label: string): Promise<void> => {
  await addDoc(collection(db, STATUSES_COLLECTION), { label });
};

/**
 * Deletes a registration status by ID
 */
export const deleteRegistrationStatus = async (id: string): Promise<void> => {
  await deleteDoc(doc(db, STATUSES_COLLECTION, id));
};
