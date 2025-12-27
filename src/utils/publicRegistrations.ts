import { getFirestore, collection, query, where, orderBy, getDocs } from 'firebase/firestore';

export interface PublicRegistration {
  registrationNumber: number;
  firstName: string;
  lastName: string;
  nationality: string;
  representing: string;
  raceDistance: string;
  status: string;
  isOnWaitinglist: boolean;
  waitinglistExpires?: Date | null;
  bib?: string | number | null;
}

const DEBUG_PUBLIC_REGISTRATIONS_FETCH = process.env.REACT_APP_DEBUG_PUBLIC_REGISTRATIONS_FETCH === 'true';

const mapPublicRegistration = (data: any): PublicRegistration => {
  return {
    registrationNumber: data.registrationNumber ?? 0,
    firstName: data.firstName ?? '',
    lastName: data.lastName ?? '',
    nationality: data.nationality ?? '',
    representing: data.representing ?? '',
    raceDistance: data.raceDistance ?? '',
    status: data.status ?? '',
    isOnWaitinglist: data.isOnWaitinglist ?? false,
    waitinglistExpires: data.waitinglistExpires?.toDate?.() || null,
    bib: data.bib ?? null,
  };
};

export async function fetchPublicRegistrations(editionId: string): Promise<PublicRegistration[]> {
  const db = getFirestore();

  // Prefer the public projection collection. This is safe for unauthenticated visitors.
  try {
    const qPublic = query(
      collection(db, 'publicRegistrations'),
      where('editionId', '==', editionId),
      orderBy('registrationNumber')
    );
    const snapPublic = await getDocs(qPublic);
    if (!snapPublic.empty) {
      if (DEBUG_PUBLIC_REGISTRATIONS_FETCH) {
        console.info('[fetchPublicRegistrations] source=publicRegistrations', {
          editionId,
          count: snapPublic.size
        });
      }
      return snapPublic.docs.map((doc) => mapPublicRegistration(doc.data()));
    }

    if (DEBUG_PUBLIC_REGISTRATIONS_FETCH) {
      console.info('[fetchPublicRegistrations] source=publicRegistrations_empty_fallback', {
        editionId
      });
    }
  } catch {
    if (DEBUG_PUBLIC_REGISTRATIONS_FETCH) {
      console.info('[fetchPublicRegistrations] source=publicRegistrations_error_fallback', {
        editionId
      });
    }
    // ignore and fall back
  }

  // Temporary rollout fallback: read from legacy registrations.
  // This must be removed before we lock down registrations read access.
  const qLegacy = query(
    collection(db, 'registrations'),
    where('editionId', '==', editionId),
    orderBy('registrationNumber')
  );
  const snapLegacy = await getDocs(qLegacy);
  if (DEBUG_PUBLIC_REGISTRATIONS_FETCH) {
    console.info('[fetchPublicRegistrations] source=registrations', {
      editionId,
      count: snapLegacy.size
    });
  }
  return snapLegacy.docs.map((doc) => mapPublicRegistration(doc.data()));
}
