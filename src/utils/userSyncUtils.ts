import { getFirestore, collection, query, where, getDocs, setDoc, doc, serverTimestamp } from 'firebase/firestore';
import { AppUser } from './userUtils';

export interface Registration {
  userId: string; // email
  editionId: string;
  firstName: string;
  lastName: string;
  nationality: string;
  dateOfBirth: string;
  phoneNumber: string;
  representing: string;
}

/**
 * Sync users from registrations for a given edition.
 * - Creates user docs in users/{uid} if not present (using email as fallback doc ID if UID not found).
 * - Updates user doc fields with registration info.
 * - Maintains a chronological, de-duplicated array of 'representing' values.
 */
export async function syncUsersFromRegistrations(editionId: string) {
  const db = getFirestore();
  const regQ = query(collection(db, 'registrations'), where('editionId', '==', editionId));
  const regSnap = await getDocs(regQ);
  for (const regDoc of regSnap.docs) {
    const reg = regDoc.data() as Registration;
    // Try to find user by email (userId)
    // If you have a mapping from email to UID, use it; otherwise, use email as doc ID
    const userQuery = query(collection(db, 'users'), where('email', '==', reg.userId));
    const userSnap = await getDocs(userQuery);
    let userRef;
    let existingUser: any = null;
    if (!userSnap.empty) {
      userRef = doc(db, 'users', userSnap.docs[0].id);
      existingUser = userSnap.docs[0].data();
    } else {
      // Fallback: create user doc with email as ID (not ideal, but works if no UID mapping)
      userRef = doc(db, 'users', reg.userId);
    }
    // Merge representing array
    let representingArr: string[] = [];
    if (existingUser && Array.isArray(existingUser.representing)) {
      representingArr = [...existingUser.representing];
    }
    if (reg.representing && !representingArr.includes(reg.representing)) {
      representingArr.push(reg.representing);
    }
    // Always keep latest at the end
    representingArr = representingArr.filter(Boolean);
    // Update user doc
    await setDoc(userRef, {
      email: reg.userId ?? '',
      editionId: reg.editionId ?? '',
      firstName: reg.firstName ?? '',
      lastName: reg.lastName ?? '',
      nationality: reg.nationality ?? '',
      dateOfBirth: reg.dateOfBirth ?? '',
      phone: reg.phoneNumber ?? '',
      representing: representingArr,
      lastSynced: serverTimestamp(),
    }, { merge: true });
  }
}
