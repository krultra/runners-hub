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
}

export async function fetchPublicRegistrations(editionId: string): Promise<PublicRegistration[]> {
  const db = getFirestore();
  const q = query(
    collection(db, 'registrations'),
    where('editionId', '==', editionId),
    orderBy('registrationNumber')
  );
  const snap = await getDocs(q);
  return snap.docs.map(doc => {
    const data = doc.data();
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
    };
  });
}
