import { 
  collection, 
  addDoc, 
  updateDoc, 
  doc, 
  getDoc, 
  getDocs, 
  query, 
  where, 
  serverTimestamp,
  Timestamp
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { Registration } from '../types';

// Collection reference
const REGISTRATIONS_COLLECTION = 'registrations';

/**
 * Creates a new registration in Firestore
 * @param registrationData Registration data to save
 * @param userId Optional user ID if the user is authenticated
 * @returns Promise with the new registration ID
 */
export const createRegistration = async (
  registrationData: Registration, 
  userId?: string
): Promise<string> => {
  try {
    // Prepare data for Firestore
    const registrationToSave = {
      ...registrationData,
      // Ensure payment fields exist (for backward compatibility or manual calls)
      paymentRequired: registrationData.paymentRequired ?? 300,
      paymentMade: registrationData.paymentMade ?? 0,
      // Convert Date object to Firestore Timestamp
      dateOfBirth: registrationData.dateOfBirth ? Timestamp.fromDate(registrationData.dateOfBirth) : null,
      // Add metadata
      userId: userId || null,
      status: 'pending', // Initial status
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };

    // Add document to Firestore
    const docRef = await addDoc(collection(db, REGISTRATIONS_COLLECTION), registrationToSave);
    return docRef.id;
  } catch (error) {
    console.error('Error creating registration:', error);
    throw error;
  }
};

/**
 * Gets a registration by ID
 * @param registrationId Registration ID
 * @returns Promise with the registration data
 */
export const getRegistrationById = async (registrationId: string): Promise<Registration | null> => {
  try {
    const docRef = doc(db, REGISTRATIONS_COLLECTION, registrationId);
    const docSnap = await getDoc(docRef);
    
    if (docSnap.exists()) {
      const data = docSnap.data();
      
      // Convert Firestore Timestamp back to Date
      return {
        ...data,
        dateOfBirth: data.dateOfBirth ? data.dateOfBirth.toDate() : null,
        id: docSnap.id
      } as Registration;
    } else {
      return null;
    }
  } catch (error) {
    console.error('Error getting registration:', error);
    throw error;
  }
};

/**
 * Gets all registrations for a user
 * @param userId User ID
 * @returns Promise with array of registrations
 */
export const getRegistrationsByUserId = async (userId: string): Promise<Registration[]> => {
  try {
    const q = query(collection(db, REGISTRATIONS_COLLECTION), where("userId", "==", userId));
    const querySnapshot = await getDocs(q);
    
    return querySnapshot.docs.map(doc => {
      const data = doc.data();
      return {
        ...data,
        dateOfBirth: data.dateOfBirth ? data.dateOfBirth.toDate() : null,
        id: doc.id
      } as Registration;
    });
  } catch (error) {
    console.error('Error getting user registrations:', error);
    throw error;
  }
};

/**
 * Updates an existing registration
 * @param registrationId Registration ID
 * @param registrationData Updated registration data
 * @returns Promise that resolves when update is complete
 */
export const updateRegistration = async (
  registrationId: string, 
  registrationData: Partial<Registration>
): Promise<void> => {
  try {
    // Prepare data for update
    const updateData: Record<string, any> = { ...registrationData };
    
    // Convert Date to Timestamp if present
    if (updateData.dateOfBirth instanceof Date) {
      updateData.dateOfBirth = Timestamp.fromDate(updateData.dateOfBirth);
    }
    
    // Add metadata
    updateData.updatedAt = serverTimestamp();
    
    // Update document
    const docRef = doc(db, REGISTRATIONS_COLLECTION, registrationId);
    await updateDoc(docRef, updateData);
  } catch (error) {
    console.error('Error updating registration:', error);
    throw error;
  }
};

/**
 * Gets all registrations for a specific race distance
 * @param raceDistance Race distance ID
 * @returns Promise with array of registrations
 */
export const getRegistrationsByRaceDistance = async (raceDistance: string): Promise<Registration[]> => {
  try {
    const q = query(collection(db, REGISTRATIONS_COLLECTION), where("raceDistance", "==", raceDistance));
    const querySnapshot = await getDocs(q);
    
    return querySnapshot.docs.map(doc => {
      const data = doc.data();
      return {
        ...data,
        dateOfBirth: data.dateOfBirth ? data.dateOfBirth.toDate() : null,
        id: doc.id
      } as Registration;
    });
  } catch (error) {
    console.error('Error getting race distance registrations:', error);
    throw error;
  }
};
