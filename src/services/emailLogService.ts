// DEPRECATED: This file is no longer in active use and will be removed in a future version.
// import { getFirestore, collection, addDoc, serverTimestamp } from 'firebase/firestore';

/**
 * Logs an email sent by the system.
 * @param to Recipient email address
 * @param subject Email subject
 * @param type Type of email (welcome, update, payment_confirmation, etc.)
 * @param registrationId Optional registration id
 * @param meta Optional extra metadata (object)
 */


// export async function logSentEmail({
//   to,
//   subject,
//   type,
//   registrationId,
//   meta = {}
// }: {
//   to: string;
//   subject: string;
//   type: string;
//   registrationId?: string;
//   meta?: Record<string, any>;
// }) {
//   const db = getFirestore();
//   await addDoc(collection(db, 'emailLogs'), {
//     to,
//     subject,
//     type,
//     registrationId: registrationId || null,
//     meta,
//     sentAt: serverTimestamp(),
//   });
// }

/**
 * Example usage:
 * await logSentEmail({
 *   to: 'user@example.com',
 *   subject: 'Welcome',
 *   type: 'welcome',
 *   registrationId: 'abc123',
 *   meta: { foo: 'bar' }
 * });
 */
