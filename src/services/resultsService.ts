import { db } from '../config/firebase';
import {
  collection,
  getDocs,
  getDoc,
  doc,
  query,
  where
} from 'firebase/firestore';

export interface Participant {
  id: string;
  bib: number;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  gender: 'M' | 'K' | '*' | string;
  club?: string;
  class?: string;
  registrationType?: 'competition' | 'recreational' | 'timed_recreational';
  totalTimeDisplay: string;
  totalTimeSeconds: number;
  totalAGTimeDisplay?: string;
  totalAGTimeSeconds?: number;
  totalAGGTimeDisplay?: string;
  totalAGGTimeSeconds?: number;
}

/**
 * Fetches event edition results data including all participants
 */
export const getEventResults = async (editionId: string): Promise<{
  eventData: any;
  participants: Participant[];
}> => {
  try {
    // Fetch event edition data
    const edDocRef = doc(db, 'eventEditions', editionId);
    const edDoc = await getDoc(edDocRef);
    
    if (!edDoc.exists()) {
      throw new Error('Event edition not found');
    }
    
    const eventData = edDoc.data();
    
    // Fetch public participant results
    // This query path should match your Firestore security rules for public access
    const resultsRef = collection(db, 'publicResults', editionId, 'participants');
    const resultsSnapshot = await getDocs(resultsRef);
    
    if (resultsSnapshot.empty) {
      return {
        eventData,
        participants: []
      };
    }
    
    // Convert participants data
    const participants: Participant[] = resultsSnapshot.docs.map((doc) => {
      const data = doc.data() as Participant;
      // Prevent ID overwriting
      const { id, ...restData } = data;
      return {
        id: doc.id,
        ...restData
      } as Participant;
    });
    
    return {
      eventData,
      participants
    };
  } catch (error) {
    console.error('Error fetching event results:', error);
    throw error;
  }
};
