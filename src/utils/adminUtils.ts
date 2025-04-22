import { db } from '../config/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';

/**
 * Checks if the given email belongs to an admin user by querying the Firestore 'admins' collection.
 * @param email The email address to check
 * @returns Promise<boolean> true if admin, false otherwise
 */
export async function isAdminUser(email: string): Promise<boolean> {
  if (!email) return false;
  const adminsRef = collection(db, 'admins');
  const q = query(adminsRef, where('userId', '==', email));
  const snapshot = await getDocs(q);
  return !snapshot.empty;
}
