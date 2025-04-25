import { collection, getDocs, getFirestore } from 'firebase/firestore';
import { db } from '../config/firebase';

/**
 * Tests the Firestore connection by attempting to read from a collection
 */
export const testFirestoreConnection = async (): Promise<boolean> => {
  try {
    // Try to get a list of collections
    const snapshot = await getDocs(collection(db, 'registrations'));
    return true;
  } catch (error) {
    console.error('testFirestoreConnection failed:', error);
    return false;
  }
};
