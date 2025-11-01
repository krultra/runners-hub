import { collection, getDocs, limit, query, where } from 'firebase/firestore';
import { db } from '../config/firebase';

const personIdToUserIdCache = new Map<number, string | null>();
const checkpointAvailabilityCache = new Map<string, boolean>();

export async function getUserIdByPersonId(personId: number): Promise<string | null> {
  if (!Number.isFinite(personId)) {
    return null;
  }
  const cached = personIdToUserIdCache.get(personId);
  if (cached !== undefined) {
    if (cached && cached.includes('@')) {
      personIdToUserIdCache.delete(personId);
    } else {
      return cached;
    }
  }

  const usersRef = collection(db, 'users');
  const q = query(usersRef, where('personId', '==', personId), limit(1));
  const snapshot = await getDocs(q);

  if (snapshot.empty) {
    personIdToUserIdCache.set(personId, null);
    return null;
  }

  const docSnap = snapshot.docs[0];
  const data = docSnap.data() as { uid?: string | null; userId?: string | null };
  const trimOrNull = (value?: string | null) => {
    if (!value) return null;
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  };
  const sanitize = (value: string | null) => {
    if (!value) return null;
    return value.includes('@') ? null : value;
  };

  const candidateUid = sanitize(trimOrNull(data.uid));
  const candidateUserId = sanitize(trimOrNull(data.userId));
  const docIdCandidate = sanitize(trimOrNull(docSnap.id));
  const resolved = candidateUid || candidateUserId || docIdCandidate || String(personId);
  const userId = resolved.trim();
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
