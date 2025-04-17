import { collection, getDocs } from 'firebase/firestore';
import { db } from '../config/firebase';

/**
 * Tests the Firestore connection by attempting to read from a collection
 */
export const testFirestoreConnection = async (): Promise<boolean> => {
  try {
    console.log('Testing Firestore connection...');
    // Try to get a list of collections
    const snapshot = await getDocs(collection(db, 'registrations'));
    console.log('Firestore connection successful!');
    console.log('Number of documents:', snapshot.size);
    return true;
  } catch (error) {
    console.error('Firestore connection test failed:', error);
    return false;
  }
};
