import { getFirestore, doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { User } from 'firebase/auth';

export interface AppUser {
  uid: string;
  email: string;
  displayName?: string;
  firstName?: string;
  lastName?: string;
  phoneCountryCode?: string | null;
  phone?: string | null;
  createdAt?: any;
  lastLogin?: any;
  isAdmin?: boolean;
}

const COLLECTION = 'users';

export async function createOrUpdateUser(user: User) {
  const db = getFirestore();
  const userRef = doc(db, COLLECTION, user.uid);
  const userSnap = await getDoc(userRef);
  const now = serverTimestamp();
  if (userSnap.exists()) {
    await setDoc(userRef, {
      email: user.email,
      displayName: user.displayName || '',
      lastLogin: now,
    }, { merge: true });
  } else {
    await setDoc(userRef, {
      uid: user.uid,
      email: user.email,
      displayName: user.displayName || '',
      createdAt: now,
      lastLogin: now,
    });
  }
}

export async function getUser(uid: string): Promise<AppUser | null> {
  const db = getFirestore();
  const userRef = doc(db, COLLECTION, uid);
  const userSnap = await getDoc(userRef);
  return userSnap.exists() ? (userSnap.data() as AppUser) : null;
}
