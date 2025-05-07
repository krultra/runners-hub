import { addDoc, collection, serverTimestamp, DocumentReference, doc, updateDoc, increment } from 'firebase/firestore';
import { getFirestore } from 'firebase/firestore';
import { Registration } from '../types';
import { logSentEmail } from './emailLogService';
import Handlebars from 'handlebars';
import { getEmailTemplate } from './templateService';
import { listEventEditions, getEventEdition } from './eventEditionService';

/**
 * Email types supported by the application
 */
export enum EmailType {
  WELCOME = 'welcome',
  REGISTRATION_UPDATE = 'registration_update',
  PAYMENT_CONFIRMATION = 'payment_confirmation',
  NEWSLETTER = 'newsletter',
  REMINDER = 'reminder',
  LAST_NOTICE = 'lastNotice',
  INVITATION = 'invitation',
  WAITING_LIST_REGISTRATION = 'waiting_list_registration',
  WAITING_LIST_CONFIRMATION = 'waiting_list_confirmation',
  CANCELLATION = 'registration_cancellation',
  EXPIRATION = 'registration_expiration',
  STATUS_CHANGED = 'status_changed',
  P_LIST2W_LIST = 'p-list2w-list',
  W_LIST2P_LIST_OFFER = 'w-list2p-list_offer',
  REFUND = 'refund',
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
  const context = { name, firstName: name };
  return sendEmail(EmailType.INVITATION, email, context);
};

/**
 * Sends a welcome email with registration confirmation and payment instructions
 * @param registration The registration data
 */
export const sendWelcomeEmail = async (registration: Registration): Promise<DocumentReference<any>> => {
  const context = { ...registration };
  return sendEmail(EmailType.WELCOME, registration.email, context);
};

/**
 * Sends an email when a registration is updated
 * @param registration The updated registration data
 */
export const sendRegistrationUpdateEmail = async (registration: Registration): Promise<DocumentReference<any>> => {
  const context = { ...registration };
  return sendEmail(EmailType.REGISTRATION_UPDATE, registration.email, context);
};

/**
 * Sends a payment confirmation email
 * @param registration The registration data
 */
export const sendPaymentConfirmationEmail = async (registration: Registration): Promise<DocumentReference<any>> => {
  const context = { ...registration, today: new Date() };
  return sendEmail(EmailType.PAYMENT_CONFIRMATION, registration.email, context);
};

/**
 * Sends waiting-list confirmation email
 */
export const sendWaitingListEmail = async (registration: Registration): Promise<DocumentReference<any>> => {
  const context = { ...registration, today: new Date() };
  return sendEmail(EmailType.WAITING_LIST_CONFIRMATION, registration.email, context);
};

/**
 * Sends an initial waiting-list registration email to a user.
 */
export const sendWaitingListRegistrationEmail = async (registration: Registration): Promise<DocumentReference<any>> => {
  const context = { ...registration };
  return sendEmail(EmailType.WAITING_LIST_REGISTRATION, registration.email, context);
};

/**
 * Sends registration cancellation email
 */
export const sendRegistrationCancellationEmail = async (registration: Registration): Promise<DocumentReference<any>> => {
  const context = { ...registration };
  return sendEmail(EmailType.CANCELLATION, registration.email, context);
};

/**
 * Sends registration expiration email
 */
export const sendRegistrationExpirationEmail = async (registration: Registration): Promise<DocumentReference<any>> => {
  const context = { ...registration };
  return sendEmail(EmailType.EXPIRATION, registration.email, context);
};

/**
 * Sends status-changed email
 */
export const sendStatusChangedEmail = async (registration: Registration): Promise<DocumentReference<any>> => {
  const context = { ...registration };
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
  [EmailType.LAST_NOTICE]: 'Last Notice Reminder',
  [EmailType.WAITING_LIST_REGISTRATION]: `Waiting List Registration`,
  [EmailType.WAITING_LIST_CONFIRMATION]: 'Waiting List Confirmation',
  [EmailType.CANCELLATION]: 'Registration Cancellation',
  [EmailType.EXPIRATION]: 'Registration Expiration',
  [EmailType.STATUS_CHANGED]: 'Registration Status Changed',
  [EmailType.P_LIST2W_LIST]: 'Participant to Waiting-list Notification',
  [EmailType.W_LIST2P_LIST_OFFER]: 'Waiting-list to Participant Offer',
  [EmailType.REFUND]: 'Refund Processed',
};

/**
 * Generic email sender using templates and fallback defaults
 */
async function sendEmail(type: EmailType, to: string, context: any): Promise<DocumentReference<any>> {
  // Fetch latest event edition details dynamically
  const summaries = await listEventEditions();
  if (!summaries.length) throw new Error('No event editions found');
  const latestEdition = await getEventEdition(summaries[summaries.length - 1].id);
  const { eventName, eventShortName, edition: eventEdition } = latestEdition;
  const db = getFirestore();
  const tpl = await getEmailTemplate(type, 'en');
  // enrich context for subject/body templates
  const enrichedContext = {
    ...context,
    eventName,
    eventShortName,
    eventEdition,
    // Provide raw Date for templating and formatting
    today: context.today ? new Date(context.today) : new Date(),
  };
  // Format dates to 'D Mmm YYYY' for dateOfBirth, waitinglistExpires, and today
  ['dateOfBirth', 'waitinglistExpires', 'today'].forEach((field) => {
    const ts = (enrichedContext as any)[field];
    if (ts) {
      const date = ts.toDate ? ts.toDate() : new Date(ts);
      (enrichedContext as any)[field] = date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
    }
  });
  const subjTpl = tpl.subjectTemplate || DEFAULT_SUBJECTS[type];
  let subject: string;
  try {
    subject = subjTpl.includes('{{') ? Handlebars.compile(subjTpl)(enrichedContext) : subjTpl;
  } catch (err) {
    console.error(`Error compiling subject template for ${type}:`, err);
    subject = DEFAULT_SUBJECTS[type];
  }
  // default HTML for refund emails if no template provided
  const defaultRefundTemplate = `
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eaeaea; border-radius: 5px;">
  <h2 style="color: #1976d2;">Dear {{firstName}},</h2>
  <p>
    We would like to inform you that your payment for <strong>{{eventName}} {{eventEdition}}</strong> has been refunded in accordance with the event’s cancellation and refund policy.
  </p>
  <div style="background-color: #e8f5e9; padding: 15px; border-radius: 5px; margin: 20px 0;">
    <h3 style="margin-top: 0; color: #2e7d32;">Refund Information</h3>
    <p>Your refund has been processed and sent to the same payment method used for your original transaction.</p>
    <p><strong>Reference:</strong> {{eventShortName}}-{{eventEdition}}-{{registrationNumber}}</p>
  </div>
  <p>
    For most payment methods, such as Vipps, the refund should appear almost immediately. If you paid by bank transfer or another method, please allow a few business days for the transaction to be completed.
  </p>
  <p>
    If you have any questions or believe something is incorrect, feel free to reply to this email.
  </p>
  <p>Best regards,<br />KrUltra</p>
  <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #eaeaea; font-size: 12px; color: #666; text-align: center;">
    <p>This email was sent to {{email}} in connection with your registration for {{eventName}} {{eventEdition}}.</p>
  </div>
</div>`;
  const bodyTpl = tpl.bodyTemplate && tpl.bodyTemplate.trim() !== ''
    ? tpl.bodyTemplate
    : (type === EmailType.REFUND ? defaultRefundTemplate : '');
  let html: string;
  try {
    html = bodyTpl.includes('{{') ? Handlebars.compile(bodyTpl)(enrichedContext) : bodyTpl;
  } catch (err) {
    console.error(`Error compiling body template for ${type}:`, err);
    html = '';
  }
  const mailRef = await addDoc(collection(db, 'mail'), {
    to,
    message: { subject, html },
    type,
    createdAt: serverTimestamp(),
  });
  await logSentEmail({ to, subject, type, registrationId: enrichedContext.id, meta: enrichedContext });
  // update registration counters for reminders and last notices (with debug logging)
  if (enrichedContext.id) {
    const regRef = doc(db, 'registrations', enrichedContext.id);
    try {
      if (type === EmailType.REMINDER) {
        console.log(`sendEmail: incrementing remindersSent for ${enrichedContext.id}`);
        await updateDoc(regRef, { remindersSent: increment(1) });
        console.log('sendEmail: remindersSent incremented');
      } else if (type === EmailType.LAST_NOTICE) {
        console.log(`sendEmail: incrementing lastNoticesSent for ${enrichedContext.id}`);
        await updateDoc(regRef, { lastNoticesSent: increment(1) });
        console.log('sendEmail: lastNoticesSent incremented');
      }
    } catch (err) {
      console.error(`sendEmail: error incrementing counters for ${enrichedContext.id}`, err);
    }
  }
  return mailRef;
}

// Generic sender for dynamic templates
export { sendEmail };
