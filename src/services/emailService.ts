import { addDoc, collection, serverTimestamp, DocumentReference } from 'firebase/firestore';
import { getFirestore } from 'firebase/firestore';
import { Registration } from '../types';
import { logSentEmail } from './emailLogService';
import Handlebars from 'handlebars';
import { getEmailTemplate } from './templateService';
import { EVENT_NAME, EVENT_SHORT_NAME, EVENT_EDITION } from '../config/event';

/**
 * Email types supported by the application
 */
export enum EmailType {
  WELCOME = 'welcome',
  REGISTRATION_UPDATE = 'registration_update',
  PAYMENT_CONFIRMATION = 'payment_confirmation',
  NEWSLETTER = 'newsletter',
  REMINDER = 'reminder',
  INVITATION = 'invitation',
  WAITING_LIST_REGISTRATION = 'waiting_list_registration',
  WAITING_LIST_CONFIRMATION = 'waiting_list_confirmation',
  CANCELLATION = 'registration_cancellation',
  EXPIRATION = 'registration_expiration',
  STATUS_CHANGED = 'status_changed',
  P_LIST2W_LIST = 'p-list2w-list',
  W_LIST2P_LIST_OFFER = 'w-list2p-list_offer',
}

// Date formatting helper for Handlebars
Handlebars.registerHelper('formatDate', (ts: any, locale = 'no-NO') => {
  try {
    const date = ts?.toDate ? ts.toDate() : new Date(ts);
    return date.toLocaleDateString(locale, { day: 'numeric', month: 'long', year: 'numeric' });
  } catch {
    return '';
  }
});

/**
 * Sends an invitation email to a single invitee
 */
export const sendInvitationEmail = async (email: string, name: string): Promise<DocumentReference<any>> => {
  const context = { name, firstName: name, eventName: EVENT_NAME, eventShortName: EVENT_SHORT_NAME, eventEdition: EVENT_EDITION };
  return sendEmail(EmailType.INVITATION, email, context);
};

/**
 * Sends a welcome email with registration confirmation and payment instructions
 * @param registration The registration data
 */
export const sendWelcomeEmail = async (registration: Registration): Promise<DocumentReference<any>> => {
  const context = { ...registration, eventName: EVENT_NAME, eventShortName: EVENT_SHORT_NAME, eventEdition: EVENT_EDITION };
  return sendEmail(EmailType.WELCOME, registration.email, context);
};

/**
 * Sends an email when a registration is updated
 * @param registration The updated registration data
 */
export const sendRegistrationUpdateEmail = async (registration: Registration): Promise<DocumentReference<any>> => {
  const context = { ...registration, eventName: EVENT_NAME, eventShortName: EVENT_SHORT_NAME, eventEdition: EVENT_EDITION };
  return sendEmail(EmailType.REGISTRATION_UPDATE, registration.email, context);
};

/**
 * Sends a payment confirmation email
 * @param registration The registration data
 */
export const sendPaymentConfirmationEmail = async (registration: Registration): Promise<DocumentReference<any>> => {
  const context = { ...registration, eventName: EVENT_NAME, eventShortName: EVENT_SHORT_NAME, eventEdition: EVENT_EDITION, today: new Date().toLocaleDateString() };
  return sendEmail(EmailType.PAYMENT_CONFIRMATION, registration.email, context);
};

/**
 * Sends waiting-list confirmation email
 */
export const sendWaitingListEmail = async (registration: Registration): Promise<DocumentReference<any>> => {
  const context = { ...registration, eventName: EVENT_NAME, eventShortName: EVENT_SHORT_NAME, eventEdition: EVENT_EDITION, today: new Date().toLocaleDateString() };
  return sendEmail(EmailType.WAITING_LIST_CONFIRMATION, registration.email, context);
};

/**
 * Sends an initial waiting-list registration email to a user.
 */
export const sendWaitingListRegistrationEmail = async (registration: Registration): Promise<DocumentReference<any>> => {
  const context = { ...registration, eventName: EVENT_NAME, eventShortName: EVENT_SHORT_NAME, eventEdition: EVENT_EDITION };
  return sendEmail(EmailType.WAITING_LIST_REGISTRATION, registration.email, context);
};

/**
 * Sends registration cancellation email
 */
export const sendRegistrationCancellationEmail = async (registration: Registration): Promise<DocumentReference<any>> => {
  const context = { ...registration, eventName: EVENT_NAME, eventShortName: EVENT_SHORT_NAME, eventEdition: EVENT_EDITION };
  return sendEmail(EmailType.CANCELLATION, registration.email, context);
};

/**
 * Sends registration expiration email
 */
export const sendRegistrationExpirationEmail = async (registration: Registration): Promise<DocumentReference<any>> => {
  const context = { ...registration, eventName: EVENT_NAME, eventShortName: EVENT_SHORT_NAME, eventEdition: EVENT_EDITION };
  return sendEmail(EmailType.EXPIRATION, registration.email, context);
};

/**
 * Sends status-changed email
 */
export const sendStatusChangedEmail = async (registration: Registration): Promise<DocumentReference<any>> => {
  const context = { ...registration, eventName: EVENT_NAME, eventShortName: EVENT_SHORT_NAME, eventEdition: EVENT_EDITION };
  return sendEmail(EmailType.STATUS_CHANGED, registration.email, context);
};

// Default subjects for fallback
const DEFAULT_SUBJECTS: Record<EmailType, string> = {
  [EmailType.INVITATION]: 'Invitation to register',
  [EmailType.WELCOME]: 'Registration Confirmation',
  [EmailType.REGISTRATION_UPDATE]: 'Registration Update',
  [EmailType.PAYMENT_CONFIRMATION]: 'Payment Confirmation',
  [EmailType.NEWSLETTER]: 'KrUltra Newsletter',
  [EmailType.REMINDER]: 'Reminder',
  [EmailType.WAITING_LIST_REGISTRATION]: `Waiting List Registration`,
  [EmailType.WAITING_LIST_CONFIRMATION]: 'Waiting List Confirmation',
  [EmailType.CANCELLATION]: 'Registration Cancellation',
  [EmailType.EXPIRATION]: 'Registration Expiration',
  [EmailType.STATUS_CHANGED]: 'Registration Status Changed',
  [EmailType.P_LIST2W_LIST]: 'Participant to Waiting-list Notification',
  [EmailType.W_LIST2P_LIST_OFFER]: 'Waiting-list to Participant Offer',
};

/**
 * Generic email sender using templates and fallback defaults
 */
async function sendEmail(type: EmailType, to: string, context: any): Promise<DocumentReference<any>> {
  const db = getFirestore();
  const tpl = await getEmailTemplate(type, 'en');
  // enrich context for subject/body templates
  const enrichedContext = {
    ...context,
    eventName: EVENT_NAME,
    eventShortName: EVENT_SHORT_NAME,
    eventEdition: EVENT_EDITION,
    today: context.today || new Date().toLocaleDateString(),
  };
  const subjTpl = tpl.subjectTemplate || DEFAULT_SUBJECTS[type];
  const subject = Handlebars.compile(subjTpl)(enrichedContext);
  const html = Handlebars.compile(tpl.bodyTemplate || '')(enrichedContext);
  const mailRef = await addDoc(collection(db, 'mail'), {
    to,
    message: { subject, html },
    type,
    createdAt: serverTimestamp(),
  });
  await logSentEmail({ to, subject, type, registrationId: enrichedContext.id, meta: enrichedContext });
  return mailRef;
}

// Generic sender for dynamic templates
export { sendEmail };
