import { getFirestore, collection, query, where, getDocs, setDoc, doc, serverTimestamp } from 'firebase/firestore';
import type { Registration } from '../types';

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
    // Ensure we have an email to sync to the user profile
    if (!reg.email) {
      console.warn('syncUsersFromRegistrations: Registration missing email, skipping', { id: regDoc.id });
      continue;
    }
    // Try to find user by email
    const userQuery = query(collection(db, 'users'), where('email', '==', reg.email));
    const userSnap = await getDocs(userQuery);
    let userRef;
    let existingUser: any = null;
    if (!userSnap.empty) {
      userRef = doc(db, 'users', userSnap.docs[0].id);
      existingUser = userSnap.docs[0].data();
    } else {
      // Prefer UID from registration if available; otherwise, fallback to email as doc ID
      const docId = (reg as any).userId ? String((reg as any).userId) : String(reg.email);
      userRef = doc(db, 'users', docId);
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
      email: reg.email ?? '',
      editionId: reg.editionId ?? '',
      firstName: reg.firstName ?? '',
      lastName: reg.lastName ?? '',
      nationality: reg.nationality ?? '',
      dateOfBirth: (reg as any).dateOfBirth ?? '',
      phoneCountryCode: (reg as any).phoneCountryCode ?? '',
      phone: (reg as any).phoneNumber ?? '',
      representing: representingArr,
      lastSynced: serverTimestamp(),
    }, { merge: true });
  }
}
