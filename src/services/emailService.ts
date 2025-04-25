import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
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
export const sendInvitationEmail = async (email: string, name: string): Promise<void> => {
  const context = { name, firstName: name, eventName: EVENT_NAME, eventShortName: EVENT_SHORT_NAME, eventEdition: EVENT_EDITION };
  return sendEmail(EmailType.INVITATION, email, context);
};

/**
 * Sends a welcome email with registration confirmation and payment instructions
 * @param registration The registration data
 */
export const sendWelcomeEmail = async (registration: Registration): Promise<void> => {
  const context = { ...registration, eventName: EVENT_NAME, eventShortName: EVENT_SHORT_NAME, eventEdition: EVENT_EDITION };
  return sendEmail(EmailType.WELCOME, registration.email, context);
};

/**
 * Sends an email when a registration is updated
 * @param registration The updated registration data
 */
export const sendRegistrationUpdateEmail = async (registration: Registration): Promise<void> => {
  const context = { ...registration, eventName: EVENT_NAME, eventShortName: EVENT_SHORT_NAME, eventEdition: EVENT_EDITION };
  return sendEmail(EmailType.REGISTRATION_UPDATE, registration.email, context);
};

/**
 * Sends a payment confirmation email
 * @param registration The registration data
 */
export const sendPaymentConfirmationEmail = async (registration: Registration): Promise<void> => {
  const context = { ...registration, eventName: EVENT_NAME, eventShortName: EVENT_SHORT_NAME, eventEdition: EVENT_EDITION, today: new Date().toLocaleDateString() };
  return sendEmail(EmailType.PAYMENT_CONFIRMATION, registration.email, context);
};

/**
 * Sends waiting-list confirmation email
 */
export const sendWaitingListEmail = async (registration: Registration): Promise<void> => {
  const context = { ...registration, eventName: EVENT_NAME, eventShortName: EVENT_SHORT_NAME, eventEdition: EVENT_EDITION, today: new Date().toLocaleDateString() };
  return sendEmail(EmailType.WAITING_LIST_CONFIRMATION, registration.email, context);
};

/**
 * Sends an initial waiting-list registration email to a user.
 */
export const sendWaitingListRegistrationEmail = async (registration: Registration): Promise<void> => {
  const context = { ...registration, eventName: EVENT_NAME, eventShortName: EVENT_SHORT_NAME, eventEdition: EVENT_EDITION };
  return sendEmail(EmailType.WAITING_LIST_REGISTRATION, registration.email, context);
};

// Default subjects for fallback
const DEFAULT_SUBJECTS: Record<EmailType, string> = {
  [EmailType.INVITATION]: 'KUTC 2025 – Invitation to register',
  [EmailType.WELCOME]: 'KUTC 2025 Registration Confirmation',
  [EmailType.REGISTRATION_UPDATE]: 'KUTC 2025 Registration Update',
  [EmailType.PAYMENT_CONFIRMATION]: 'KUTC 2025 Payment Confirmation',
  [EmailType.NEWSLETTER]: '',
  [EmailType.REMINDER]: '',
  [EmailType.WAITING_LIST_REGISTRATION]: `KUTC ${EVENT_EDITION} Waiting List Registration`,
  [EmailType.WAITING_LIST_CONFIRMATION]: 'KUTC 2025 Waiting List Confirmation'
};

/**
 * Generic email sender using templates and fallback defaults
 */
async function sendEmail(type: EmailType, to: string, context: any): Promise<void> {
  const db = getFirestore();
  const tpl = await getEmailTemplate(type, 'en');
  const subjTpl = tpl.subjectTemplate || DEFAULT_SUBJECTS[type];
  const subject = Handlebars.compile(subjTpl)(context);
  const html = Handlebars.compile(tpl.bodyTemplate || '')(context);
  await addDoc(collection(db, 'mail'), { to, message: { subject, html }, type, createdAt: serverTimestamp() });
  await logSentEmail({ to, subject, type, registrationId: context.id, meta: context });
}
