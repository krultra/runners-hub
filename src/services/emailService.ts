import { addDoc, collection, serverTimestamp, DocumentReference, doc, updateDoc, increment } from 'firebase/firestore';
import { getFirestore } from 'firebase/firestore';
import { Registration } from '../types';
import Handlebars from 'handlebars';
import { getEmailTemplate } from './templateService';
import { getEventEdition } from './eventEditionService';
import { formatShortDate, formatDateTime } from '../utils/dateFormatter';

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



interface InvitationContext {
  name: string;
  firstName: string;
  editionId?: string;
  [key: string]: any;
}

/**
 * Sends an invitation email to a single invitee
 * @param email Recipient email address
 * @param name Recipient name
 * @param context Additional context for the email template
 */
export const sendInvitationEmail = async (
  email: string, 
  name: string, 
  context?: Partial<InvitationContext>
): Promise<DocumentReference<any>> => {
  const emailContext: InvitationContext = {
    name,
    firstName: name.split(' ')[0],
    ...context
  };
  return sendEmail(EmailType.INVITATION, email, emailContext);
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

/**
 * Generic email sender using templates
 */
async function sendEmail(type: EmailType, to: string, context: any): Promise<DocumentReference<any>> {
  const db = getFirestore();
  // Get the event edition from the registration context
  const eventEditionId = (context as any).editionId || (context as any).eventEditionId;
  if (!eventEditionId) throw new Error('No event edition ID found in registration data');
  let eventEdition;
  try {
    eventEdition = await getEventEdition(eventEditionId);
  } catch (e) {
    console.error('[sendEmail] Error fetching eventEdition', e);
    throw e;
  }
  const { eventName, eventShortName, edition } = eventEdition;
  let tpl;
  try {
    tpl = await getEmailTemplate(type, 'en');
    if (!tpl) {
      console.error(`[sendEmail] No template found for type ${type}`);
      throw new Error(`No template found for type ${type}`);
    }
  } catch (e) {
    console.error('[sendEmail] Error fetching email template', e);
    throw e;
  }
  // enrich context for subject/body templates
  const enrichedContext = {
    ...context,
    eventName,
    eventShortName,
    eventEdition: edition,
    today: formatShortDate(context.today || new Date()),
    // Format dates directly in the context for use in templates
    dateOfBirth: context.dateOfBirth ? formatShortDate(context.dateOfBirth) : '',
    waitinglistExpires: context.waitinglistExpires ? formatShortDate(context.waitinglistExpires) : '',
    updatedAt: context.updatedAt ? formatDateTime(context.updatedAt) : ''
  };
  if (!tpl.subjectTemplate) {
    console.error(`[sendEmail] No subject template found for type ${type}`);
    throw new Error(`No subject template found for type ${type}`);
  }
  let subject: string;
  try {
    subject = tpl.subjectTemplate.includes('{{') ? Handlebars.compile(tpl.subjectTemplate)(enrichedContext) : tpl.subjectTemplate;
  } catch (err) {
    console.error(`[sendEmail] Error compiling subject template for ${type}:`, err);
    throw err;
  }

  if (!tpl.bodyTemplate) {
    console.error(`[sendEmail] No body template found for type ${type}`);
    throw new Error(`No body template found for type ${type}`);
  }
  let html: string;
  try {
    html = tpl.bodyTemplate.includes('{{') ? Handlebars.compile(tpl.bodyTemplate)(enrichedContext) : tpl.bodyTemplate;
  } catch (err) {
    console.error(`[sendEmail] Error compiling body template for ${type}:`, err);
    throw err;
  }

  // Create the email document
  const mailDoc = {
    to,
    message: {
      subject,
      html,
    },
    type,
    context: enrichedContext,
    registrationId: enrichedContext.id || null,
    createdAt: serverTimestamp(),
    status: 'pending',
  };

  // Write to mail collection in Firestore
  let mailRef;
  try {
    mailRef = await addDoc(collection(db, 'mail'), mailDoc);
  } catch (firestoreError) {
    console.error('[sendEmail] Error writing mailDoc to Firestore:', firestoreError);
    throw firestoreError;
  }

  // update registration counters for reminders and last notices
  if (enrichedContext.id) {
    const regRef = doc(db, 'registrations', enrichedContext.id);
    try {
      if (type === EmailType.REMINDER) {
        await updateDoc(regRef, { remindersSent: increment(1) });
      } else if (type === EmailType.LAST_NOTICE) {
        await updateDoc(regRef, { lastNoticesSent: increment(1) });
      }
    } catch (err) {
      console.error(`[sendEmail] Error incrementing counters for ${enrichedContext.id}`, err);
    }
  }
  return mailRef;
}

// Generic sender for dynamic templates
export { sendEmail };
