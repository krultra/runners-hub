import * as functions from 'firebase-functions';
import { db } from '../utils/admin';

const normalizeString = (value: unknown): string => String(value ?? '').trim();

const toBoolean = (value: unknown): boolean => Boolean(value);

const toNumberOrNull = (value: unknown): number | null => {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
};

async function resolvePersonId(data: any): Promise<number | null> {
  const direct = toNumberOrNull(data?.personId);
  if (direct != null) {
    return direct;
  }

  const userId = normalizeString(data?.userId);
  if (!userId) {
    return null;
  }

  let userSnap = await db.collection('users').doc(userId).get();
  if (!userSnap.exists) {
    const qUid = await db.collection('users').where('uid', '==', userId).limit(1).get();
    if (!qUid.empty) {
      userSnap = qUid.docs[0];
    } else {
      const qLegacy = await db.collection('users').where('userId', '==', userId).limit(1).get();
      if (!qLegacy.empty) {
        userSnap = qLegacy.docs[0];
      }
    }
  }

  if (!userSnap.exists) {
    return null;
  }
  return toNumberOrNull((userSnap.data() as any)?.personId);
}

export const projectPublicRegistrations = functions.firestore
  .document('registrations/{registrationId}')
  .onWrite(async (change, context) => {
    const registrationId = context.params.registrationId;

    if (!change.after.exists) {
      await db.collection('publicRegistrations').doc(registrationId).delete();
      return null;
    }

    const data = change.after.data() as any;
    if (!data) return null;

    const personId = await resolvePersonId(data);

    const payload: Record<string, any> = {
      editionId: normalizeString(data.editionId),
      registrationNumber: Number.isFinite(Number(data.registrationNumber)) ? Number(data.registrationNumber) : 0,
      personId,
      firstName: normalizeString(data.firstName),
      lastName: normalizeString(data.lastName),
      nationality: normalizeString(data.nationality),
      representing: normalizeString(data.representing),
      raceDistance: normalizeString(data.raceDistance),
      status: normalizeString(data.status),
      isOnWaitinglist: toBoolean(data.isOnWaitinglist),
      waitinglistExpires: data.waitinglistExpires ?? null,
      bib: data.bib ?? null,
      updatedAt: (data.updatedAt ?? null),
    };

    await db.collection('publicRegistrations').doc(registrationId).set(payload, { merge: true });
    return null;
  });
