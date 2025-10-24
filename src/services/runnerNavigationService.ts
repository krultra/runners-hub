import { collection, getDocs, limit, query, where } from 'firebase/firestore';
import { db } from '../config/firebase';

const personIdToUserIdCache = new Map<number, string | null>();
const checkpointAvailabilityCache = new Map<string, boolean>();

export async function getUserIdByPersonId(personId: number): Promise<string | null> {
  if (!Number.isFinite(personId)) {
    return null;
  }
  if (personIdToUserIdCache.has(personId)) {
    return personIdToUserIdCache.get(personId) ?? null;
  }

  const usersRef = collection(db, 'users');
  const q = query(usersRef, where('personId', '==', personId), limit(1));
  const snapshot = await getDocs(q);

  if (snapshot.empty) {
    personIdToUserIdCache.set(personId, null);
    return null;
  }

  const userId = snapshot.docs[0].id;
  personIdToUserIdCache.set(personId, userId);
  return userId;
}

export async function hasCheckpointAnalysis(editionId: string, userId: string): Promise<boolean> {
  if (!editionId || !userId) {
    return false;
  }
  const key = `${editionId}::${userId}`;
  if (checkpointAvailabilityCache.has(key)) {
    return checkpointAvailabilityCache.get(key) ?? false;
  }

  const checkpointsRef = collection(db, 'checkpointResults');
  const q = query(
    checkpointsRef,
    where('eventEditionId', '==', editionId),
    where('userId', '==', userId),
    limit(1)
  );
  const snapshot = await getDocs(q);
  const hasData = !snapshot.empty;
  checkpointAvailabilityCache.set(key, hasData);
  return hasData;
}
