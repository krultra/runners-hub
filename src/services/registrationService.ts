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
import { Registration, Payment } from '../types';
import { sendWelcomeEmail, sendRegistrationUpdateEmail, sendWaitingListEmail } from './emailService';
import { getNextSequentialNumber } from './counterService';
import { RACE_DETAILS, RACE_DISTANCES } from '../constants';

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
    // Get the next sequential registration number
    const registrationNumber = await getNextSequentialNumber(`registrations-${registrationData.editionId}`);
    
    // Prepare data for Firestore
    const registrationToSave = {
      ...registrationData,
      // Ensure payment fields exist (for backward compatibility or manual calls)
      paymentRequired: registrationData.paymentRequired ?? 300,
      paymentMade: registrationData.paymentMade ?? 0,
      // Convert Date object to Firestore Timestamp
      dateOfBirth: registrationData.dateOfBirth ? Timestamp.fromDate(registrationData.dateOfBirth) : null,
      // Waiting list fields
      isOnWaitinglist: registrationData.isOnWaitinglist ?? false,
      waitinglistExpires: registrationData.waitinglistExpires ? Timestamp.fromDate(registrationData.waitinglistExpires) : null,
      // Add metadata
      userId: userId || null,
      status: 'pending', // Initial status
      registrationNumber, // Add the sequential registration number
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };

    // Add document to Firestore
    const docRef = await addDoc(collection(db, REGISTRATIONS_COLLECTION), registrationToSave);
    
    // Send appropriate email based on waiting-list status
    try {
      if (registrationToSave.isOnWaitinglist) {
        await sendWaitingListEmail({
          ...registrationToSave,
          id: docRef.id,
          registrationNumber
        } as Registration);
      } else {
        await sendWelcomeEmail({
          ...registrationToSave,
          id: docRef.id,
          registrationNumber
        } as Registration);
      }
    } catch (emailError) {
      console.error('Error sending email:', emailError);
    }
    
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
        dateOfBirth: (data.dateOfBirth && typeof data.dateOfBirth === 'object' && typeof (data.dateOfBirth as any).toDate === 'function')
        ? (data.dateOfBirth as any).toDate()
        : data.dateOfBirth || null,
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
        dateOfBirth: (data.dateOfBirth && typeof data.dateOfBirth === 'object' && typeof (data.dateOfBirth as any).toDate === 'function')
        ? (data.dateOfBirth as any).toDate()
        : data.dateOfBirth || null,
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
  registrationData: Partial<Registration>,
  sendEmail: boolean = true
): Promise<void> => {
  // If payments array is updated, recalculate paymentMade
  if (registrationData.payments) {
    registrationData.paymentMade = sumPayments(registrationData.payments);
  }

  try {
    // Prepare data for update
    const updateData: Record<string, any> = { ...registrationData };
    
    // Convert Date to Timestamp if present
    if (updateData.dateOfBirth instanceof Date) {
      updateData.dateOfBirth = Timestamp.fromDate(updateData.dateOfBirth);
    }
    // Convert waiting list expiration date to Timestamp if present
    if (updateData.waitinglistExpires instanceof Date) {
      updateData.waitinglistExpires = Timestamp.fromDate(updateData.waitinglistExpires);
    }
    
    // Add metadata
    updateData.updatedAt = serverTimestamp();
    
    // Update document
    const docRef = doc(db, REGISTRATIONS_COLLECTION, registrationId);
    await updateDoc(docRef, updateData);
    
    // Send registration update email only if requested
    if (sendEmail) {
      try {
        // Get the full updated registration data
        const updatedDoc = await getDoc(docRef);
        if (updatedDoc.exists()) {
          const updatedRegistration = {
            ...updatedDoc.data(),
            id: registrationId,
            dateOfBirth: updatedDoc.data().dateOfBirth ? updatedDoc.data().dateOfBirth.toDate() : null
          } as Registration;
          await sendRegistrationUpdateEmail(updatedRegistration);
        }
      } catch (emailError) {
        // Log email error but don't fail the update process
        console.error('Error sending registration update email:', emailError);
      }
    }
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
        dateOfBirth: (data.dateOfBirth && typeof data.dateOfBirth === 'object' && typeof (data.dateOfBirth as any).toDate === 'function')
        ? (data.dateOfBirth as any).toDate()
        : data.dateOfBirth || null,
        id: doc.id
      } as Registration;
    });
  } catch (error) {
    console.error('Error getting race distance registrations:', error);
    throw error;
  }
};

/**
 * Gets the total count of registrations
 * @returns Promise with the total number of registrations
 */
export const getTotalRegistrationsCount = async (): Promise<number> => {
  try {
    const q = query(collection(db, REGISTRATIONS_COLLECTION));
    const querySnapshot = await getDocs(q);
    return querySnapshot.size;
  } catch (error) {
    console.error('Error getting total registrations count:', error);
    throw error;
  }
};

/**
 * Gets all registrations for a specific edition
 * @param editionId Edition ID
 * @returns Promise with array of registrations
 */
function sumPayments(payments: Payment[] = []): number {
  return payments.reduce((sum, p) => sum + Number(p.amount), 0);
}

export const addPaymentToRegistration = async (
  registrationId: string,
  payment: Payment
): Promise<void> => {
  const regRef = doc(db, 'registrations', registrationId);
  const regSnap = await getDoc(regRef);
  if (!regSnap.exists()) throw new Error('Registration not found');

  const regData = regSnap.data() as Registration;
  const newPayments = [
    ...((regData.payments || []).map(p => ({
      ...p,
      date: p.date instanceof Date ? Timestamp.fromDate(p.date) : p.date
    }))),
    {
      ...payment,
      date: payment.date instanceof Date ? Timestamp.fromDate(payment.date) : payment.date,
    }
  ];
  // Convert all dates to Date for sumPayments
  const paymentsForSum = newPayments.map(p => ({
    ...p,
    date: (p.date && typeof p.date === 'object' && 'toDate' in p.date) ? p.date.toDate() : p.date
  }));
  const paymentMade = sumPayments(paymentsForSum);

  await updateDoc(regRef, {
    payments: newPayments,
    paymentMade,
    updatedAt: serverTimestamp(),
  });
};

export const getRegistrationsByEdition = async (editionId: string): Promise<Registration[]> => {
  const q = query(collection(db, 'registrations'), where('editionId', '==', editionId));
  const snap = await getDocs(q);
  return snap.docs.map(doc => {
    const data = doc.data() as Registration;
    // Convert payments dates to Date
    const payments = (data.payments || []).map(p => {
  let date = p.date;
  // Only convert if it's a Firestore Timestamp
  if (date && typeof date === 'object' && typeof (date as any).toDate === 'function') {
    date = (date as any).toDate();
  }
  return {
    ...p,
    date
  };
});
    return {
      ...data,
      id: doc.id,
      dateOfBirth: (data.dateOfBirth && typeof data.dateOfBirth === 'object' && typeof (data.dateOfBirth as any).toDate === 'function')
        ? (data.dateOfBirth as any).toDate()
        : data.dateOfBirth || null,
      payments,
    };
  });
};

/**
 * Generates test registrations in Firestore emulator for given edition
 * @param editionId Event edition ID
 * @param count Number of registrations to generate
 * @returns Promise that resolves when all registrations are created
 */
export const generateTestRegistrations = async (editionId: string, count: number): Promise<void> => {
  const distances = RACE_DISTANCES.map(d => d.id);
  const totalFee = RACE_DETAILS.fees.total;
  const collectionRef = collection(db, REGISTRATIONS_COLLECTION);
  const counterName = `registrations-${editionId}`;
  for (let i = 0; i < count; i++) {
    const registrationNumber = await getNextSequentialNumber(counterName);
    const randomDistance = distances[Math.floor(Math.random() * distances.length)];
    const email = `test${registrationNumber}@example.com`;
    const regToSave = {
      editionId,
      email,
      raceDistance: randomDistance,
      firstName: `Test${registrationNumber}`,
      lastName: 'User',
      dateOfBirth: Timestamp.fromDate(new Date(1990, 0, 1)),
      nationality: 'NOR',
      phoneCountryCode: '+47',
      phoneNumber: String(10000000 + registrationNumber),
      termsAccepted: true,
      comments: 'Generated test data',
      notifyFutureEvents: false,
      sendRunningOffers: false,
      paymentRequired: totalFee,
      paymentMade: 0,
      status: 'pending',
      registrationNumber,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      isOnWaitinglist: false,
      waitinglistExpires: null,
    };

    await addDoc(collectionRef, regToSave);
  }
};