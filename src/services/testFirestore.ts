import { collection, getDocs } from 'firebase/firestore';
import { db } from '../config/firebase';

/**
 * Tests the Firestore connection by attempting to read from a collection
 */
export const testFirestoreConnection = async (): Promise<boolean> => {
  try {
    // Try to get a list of collections
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const snapshot = await getDocs(collection(db, 'registrations'));
    return true;
  } catch (error) {
    // Firestore connection test failed
    return false;
  }
};
