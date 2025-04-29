import { getFirestore, doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { User } from 'firebase/auth';
import { isAdminUser } from './adminUtils';

export interface AppUser {
  uid: string;
  email: string;
  displayName?: string;
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
  const adminFlag = await isAdminUser(user.email!);
  if (userSnap.exists()) {
    await setDoc(userRef, {
      email: user.email,
      displayName: user.displayName || '',
      lastLogin: now,
      isAdmin: adminFlag,
    }, { merge: true });
  } else {
    await setDoc(userRef, {
      uid: user.uid,
      email: user.email,
      displayName: user.displayName || '',
      createdAt: now,
      lastLogin: now,
      isAdmin: adminFlag,
    });
  }
}

export async function getUser(uid: string): Promise<AppUser | null> {
  const db = getFirestore();
  const userRef = doc(db, COLLECTION, uid);
  const userSnap = await getDoc(userRef);
  return userSnap.exists() ? (userSnap.data() as AppUser) : null;
}
