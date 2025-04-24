import { getFirestore, collection, query, where, getDocs, addDoc, updateDoc, doc, Timestamp, setDoc } from 'firebase/firestore';

export interface Invitation {
  email: string;
  name: string;
  editionId: string;
  numSent: number;
  firstSent: Timestamp | null;
  lastSent: Timestamp | null;
  resendFlag: boolean;
  id?: string;
}

const COLLECTION = 'invitations';

export async function fetchInvitations(editionId: string): Promise<Invitation[]> {
  const db = getFirestore();
  const q = query(collection(db, COLLECTION), where('editionId', '==', editionId));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() })) as Invitation[];
}

export async function addInvitation(invitation: Omit<Invitation, 'numSent' | 'firstSent' | 'lastSent' | 'resendFlag' | 'id'>): Promise<string> {
  const db = getFirestore();
  const docRef = await addDoc(collection(db, COLLECTION), {
    ...invitation,
    numSent: 0,
    firstSent: null,
    lastSent: null,
    resendFlag: false,
  });
  return docRef.id;
}

export async function updateInvitationSent(invitationId: string, isResend: boolean = false) {
  const db = getFirestore();
  const invitationRef = doc(db, COLLECTION, invitationId);
  const now = Timestamp.now();
  await updateDoc(invitationRef, {
    numSent: isResend ? 1 : (await getDocs(query(collection(db, COLLECTION), where('__name__', '==', invitationId)))).docs[0].data().numSent + 1,
    lastSent: now,
    firstSent: isResend ? (await getDocs(query(collection(db, COLLECTION), where('__name__', '==', invitationId)))).docs[0].data().firstSent || now : now,
    resendFlag: false,
  });
}

export async function setResendFlag(invitationId: string, resendFlag: boolean = true) {
  const db = getFirestore();
  const invitationRef = doc(db, COLLECTION, invitationId);
  await updateDoc(invitationRef, { resendFlag });
}
