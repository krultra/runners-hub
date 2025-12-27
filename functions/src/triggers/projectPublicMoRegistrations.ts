import * as functions from 'firebase-functions';
import { db } from '../utils/admin';

const normalizeString = (value: unknown): string => String(value ?? '').trim();

const toNumberOrNull = (value: unknown): number | null => {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
};

async function resolvePersonId(data: any, participantId: string): Promise<number | null> {
  const fromDocId = toNumberOrNull(participantId);
  if (fromDocId != null) {
    return fromDocId;
  }

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

const extractBirthYear = (value: unknown): number | null => {
  const raw = String(value ?? '').trim();
  if (!raw) return null;
  const match = raw.match(/(\d{4})$/);
  if (!match) return null;
  const year = Number(match[1]);
  return Number.isFinite(year) ? year : null;
};

const projectPublicMoRegistrations = functions.firestore
  .document('moRegistrations/{participantId}')
  .onWrite(async (change, context) => {
    const participantId = context.params.participantId;

    if (!change.after.exists) {
      await db.collection('publicMoRegistrations').doc(participantId).delete();
      return null;
    }

    const data = change.after.data() as any;
    if (!data) return null;

    const personId = await resolvePersonId(data, participantId);

    const yearOfBirth =
      typeof data.yearOfBirth === 'number'
        ? data.yearOfBirth
        : extractBirthYear(data.dateOfBirth);

    const payload: Record<string, any> = {
      editionId: normalizeString(data.editionId),
      registrationNumber: Number.isFinite(Number(data.registrationNumber)) ? Number(data.registrationNumber) : 0,
      personId,
      bib: data.bib ?? null,
      firstName: normalizeString(data.firstName),
      lastName: normalizeString(data.lastName),
      gender: normalizeString(data.gender),
      yearOfBirth,
      age: Number.isFinite(Number(data.age)) ? Number(data.age) : null,
      representing: normalizeString(data.representing),
      club: normalizeString(data.club),
      class: normalizeString(data.class),
      className: normalizeString(data.className),
      classDescription: normalizeString(data.classDescription),
      registrationType: normalizeString(data.registrationType),
      status: normalizeString(data.status),
      updatedAt: data.updatedAt ?? null,
    };

    await db.collection('publicMoRegistrations').doc(participantId).set(payload, { merge: true });
    return null;
  });
