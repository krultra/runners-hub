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
  Timestamp,
  runTransaction,
  arrayUnion
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { Registration, Payment } from '../types';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { sendWelcomeEmail, sendRegistrationUpdateEmail, sendWaitingListEmail, sendWaitingListRegistrationEmail } from './emailService';
import { getNextSequentialNumber } from './counterService';

// Removed obsolete imports of RACE_DETAILS and RACE_DISTANCES; using dynamic eventEditionService for event info

// Collection reference
const REGISTRATIONS_COLLECTION = 'registrations';

const normalizeEmail = (value: string) => value.trim().toLowerCase();

const mapRegistrationDoc = (docSnap: any): Registration => {
  const data = docSnap.data();
  return {
    ...data,
    dateOfBirth:
      data.dateOfBirth && typeof data.dateOfBirth === 'object' && typeof (data.dateOfBirth as any).toDate === 'function'
        ? (data.dateOfBirth as any).toDate()
        : data.dateOfBirth || null,
    id: docSnap.id
  } as Registration;
};

export const getActiveRegistrationsForUser = async (userId: string): Promise<Registration[]> => {
  try {
    if (!userId) return [];
    const q = query(
      collection(db, REGISTRATIONS_COLLECTION),
      where('status', 'in', ['pending', 'confirmed']),
      where('userId', '==', userId)
    );
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(mapRegistrationDoc);
  } catch (error) {
    console.error('Error getting active registrations for user:', error);
    throw error;
  }
};

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
    
    // Enforce waiting-list if any active waiting-list entries
    const wlSnapshot = await getDocs(
      query(
        collection(db, REGISTRATIONS_COLLECTION),
        where('editionId', '==', registrationData.editionId),
        where('status', 'in', ['pending','confirmed']),
        where('isOnWaitinglist', '==', true)
      )
    );
    const enforceOnWL = wlSnapshot.size > 0;

    // Prepare data for Firestore
    const registrationToSave = {
      ...registrationData,
      // Ensure payment fields exist (for backward compatibility or manual calls)
      paymentRequired: registrationData.paymentRequired ?? 0,
      paymentMade: registrationData.paymentMade ?? 0,
      // Convert Date object to Firestore Timestamp
      dateOfBirth: registrationData.dateOfBirth ? Timestamp.fromDate(registrationData.dateOfBirth) : null,
      // Waiting list fields (force join queue if active)
      isOnWaitinglist: enforceOnWL ? true : registrationData.isOnWaitinglist ?? false,
      waitinglistExpires: registrationData.waitinglistExpires ? Timestamp.fromDate(registrationData.waitinglistExpires) : null,
      // Add metadata
      userId: userId || null,
      status: 'pending', // Initial status
      remindersSent: 0, // initialize reminder count
      lastNoticesSent: 0, // initialize last notice count
      registrationNumber, // Add the sequential registration number
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };

    // Add document to Firestore
    const docRef = await addDoc(collection(db, REGISTRATIONS_COLLECTION), registrationToSave);
    
    // Prepare email data with only the actual date values
    const emailData = {
      ...registrationData, // Use original data which has proper date objects
      id: docRef.id,
      registrationNumber,
      // Explicitly set timestamps to ensure they're proper dates
      createdAt: new Date(),
      updatedAt: new Date()
    };

    // Send appropriate email based on waiting-list status
    try {
      if (registrationToSave.isOnWaitinglist) {
        // Initial waiting-list registration email
        await sendWaitingListRegistrationEmail(emailData as Registration);
      } else {
        await sendWelcomeEmail(emailData as Registration);
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
 * Gets all registrations for a user, filtered by edition
 * @param userId User ID
 * @param editionId Edition ID to filter by
 * @returns Promise with array of registrations
 */
export const getRegistrationsByUserId = async (
  userId: string,
  editionId: string
): Promise<Registration[]> => {
  try {
    if (!userId) return [];
    const q = query(
      collection(db, REGISTRATIONS_COLLECTION),
      where('editionId', '==', editionId),
      where('status', 'in', ['pending', 'confirmed']),
      where('userId', '==', userId)
    );
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(mapRegistrationDoc);
  } catch (error) {
    console.error('Error getting user registrations by userId:', error);
    throw error;
  }
};

export const getRegistrationsByEmail = async (
  email: string,
  editionId: string
): Promise<Registration[]> => {
  try {
    if (!email) return [];
    const normalizedEmail = normalizeEmail(email);

    const constraints = [
      where('editionId', '==', editionId),
      where('status', 'in', ['pending', 'confirmed'])
    ];

    const q = query(
      collection(db, REGISTRATIONS_COLLECTION),
      ...constraints,
      where('email', '==', normalizedEmail)
    );
    const querySnapshot = await getDocs(q);

    const seenIds = new Set<string>();
    const results = querySnapshot.docs.map(docSnap => {
      const mapped = mapRegistrationDoc(docSnap);
      seenIds.add(mapped.id!);
      return mapped;
    });

    const qOriginal = query(
      collection(db, REGISTRATIONS_COLLECTION),
      ...constraints,
      where('originalEmail', '==', normalizedEmail)
    );
    const originalSnapshot = await getDocs(qOriginal);
    originalSnapshot.docs.forEach(docSnap => {
      if (!seenIds.has(docSnap.id)) {
        results.push(mapRegistrationDoc(docSnap));
        seenIds.add(docSnap.id);
      }
    });

    return results;
  } catch (error) {
    console.error('Error getting user registrations by email:', error);
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
          const docData = updatedDoc.data();
          const updatedRegistration = {
            ...docData,
            id: registrationId,
            dateOfBirth: docData.dateOfBirth?.toDate?.() || null,
            waitinglistExpires: docData.waitinglistExpires?.toDate?.() || null,
            // Ensure we use proper dates instead of serverTimestamp objects
            createdAt: docData.createdAt?.toDate?.() || new Date(),
            updatedAt: new Date()
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
 * Counts active participants for an edition (status pending or confirmed, not on waiting list)
 */
export const countActiveParticipants = async (editionId: string): Promise<number> => {
  try {
    let snap: any = null;
    try {
      snap = await getDocs(
        query(
          collection(db, 'publicRegistrations'),
          where('editionId', '==', editionId)
        )
      );
    } catch (err) {
      console.warn('Unable to query publicRegistrations for participant count, falling back', err);
    }

    if (!snap || snap.empty) {
      snap = await getDocs(
        query(
          collection(db, REGISTRATIONS_COLLECTION),
          where('editionId', '==', editionId),
          where('status', 'in', ['pending', 'confirmed'])
        )
      );
    }

    // Count only active (pending/confirmed) and not on waiting list (missing flag treated as false)
    return snap.docs.filter((doc: any) => {
      const data = doc.data();
      const status = String(data.status || '').toLowerCase();
      const isActive = status === 'pending' || status === 'confirmed';
      return isActive && data.isOnWaitinglist !== true;
    }).length;
  } catch (error) {
    console.error('Error counting active participants:', error);
    throw error;
  }
};

/**
 * Counts active waiting-list entries for an edition.
 * Pending or confirmed registrations with isOnWaitinglist=true.
 */
export const countWaitingList = async (editionId: string): Promise<number> => {
  try {
    let snap: any = null;
    try {
      snap = await getDocs(
        query(
          collection(db, 'publicRegistrations'),
          where('editionId', '==', editionId)
        )
      );
    } catch (err) {
      console.warn('Unable to query publicRegistrations for waiting-list count, falling back', err);
    }

    if (!snap || snap.empty) {
      snap = await getDocs(
        query(
          collection(db, REGISTRATIONS_COLLECTION),
          where('editionId', '==', editionId),
          where('status', 'in', ['pending', 'confirmed'])
        )
      );
    }

    return snap.docs.filter((doc: any) => {
      const data = doc.data();
      const status = String(data.status || '').toLowerCase();
      const isActive = status === 'pending' || status === 'confirmed';
      return isActive && data.isOnWaitinglist === true;
    }).length;
  } catch (error) {
    console.error('Error counting waiting-list:', error);
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
      waitinglistExpires: (data.waitinglistExpires && typeof data.waitinglistExpires === 'object' && typeof (data.waitinglistExpires as any).toDate === 'function')
        ? (data.waitinglistExpires as any).toDate()
        : data.waitinglistExpires || null,
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
  const collectionRef = collection(db, REGISTRATIONS_COLLECTION);
  const counterName = `registrations-${editionId}`;
  for (let i = 0; i < count; i++) {
    const registrationNumber = await getNextSequentialNumber(counterName);
    const email = `test${registrationNumber}@example.com`;
    const regToSave = {
      editionId,
      email,
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
      paymentRequired: 300,
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

/**
 * Updates registration status with admin tracking (stashes email and comments)
 * @param id Registration document ID
 * @param newStatus Target status (e.g., 'cancelled', 'expired')
 * @param comment Optional admin comment for change
 */
export const updateRegistrationStatus = async (
  id: string,
  newStatus: string,
  comment?: string
): Promise<void> => {
  const ref = doc(db, REGISTRATIONS_COLLECTION, id);
  await runTransaction(db, async tx => {
    const snap = await tx.get(ref);
    if (!snap.exists()) throw new Error('Registration not found');
    const data = snap.data() as any;
    const updates: any = { status: newStatus };
    // On invalidation, stash original email
    if ((newStatus === 'cancelled' || newStatus === 'expired') && !data.originalEmail) {
      updates.originalEmail = data.email;
      updates.email = '';
    }
    // Append admin comment
    if (comment) {
      updates.adminComments = arrayUnion({ text: comment, at: Timestamp.now() });
    }
    tx.update(ref, updates);
  });
};