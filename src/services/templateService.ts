import { getFirestore, doc, getDoc, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { EmailType } from './emailService';

export interface EmailTemplate {
  id: string;
  type: EmailType;
  locale: string;
  subjectTemplate: string;
  bodyTemplate: string;
  updatedAt: any;
}

/**
 * Fetches an email template from Firestore, creating a default stub if missing.
 */
export const getEmailTemplate = async (
  type: EmailType,
  locale: string = 'en'
): Promise<EmailTemplate> => {
  const db = getFirestore();
  const docId = `${type}_${locale}`;
  const ref = doc(db, 'emailTemplates', docId);
  const snap = await getDoc(ref);
  if (snap.exists()) {
    return { id: snap.id, ...(snap.data() as Omit<EmailTemplate, 'id'>) };
  }
  // create stub
  const stub = {
    type,
    locale,
    subjectTemplate: '',
    bodyTemplate: '',
    updatedAt: serverTimestamp(),
  };
  await setDoc(ref, stub);
  return { id: docId, ...stub };
};

/**
 * Updates an existing email template in Firestore.
 */
export const updateEmailTemplate = async (
  type: EmailType,
  locale: string,
  subjectTemplate: string,
  bodyTemplate: string
): Promise<void> => {
  const db = getFirestore();
  const docId = `${type}_${locale}`;
  const ref = doc(db, 'emailTemplates', docId);
  await updateDoc(ref, {
    subjectTemplate,
    bodyTemplate,
    updatedAt: serverTimestamp(),
  });
};
