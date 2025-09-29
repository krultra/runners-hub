import { addDoc, collection, serverTimestamp, DocumentReference, doc, updateDoc, increment } from 'firebase/firestore';
import { getFirestore } from 'firebase/firestore';
import { Registration } from '../types';
import Handlebars from 'handlebars';
import { registerDefaultEmailHelpers } from './handlebarsHelpers';
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
  // Get the event edition from the registration context if available
  const eventEditionId = (context as any).editionId || (context as any).eventEditionId;
  let eventEdition = null;
  let eventName = '';
  let eventShortName = '';
  let edition = '';
  
  if (eventEditionId) {
    try {
      eventEdition = await getEventEdition(eventEditionId);
      if (eventEdition) {
        eventName = eventEdition.eventName || '';
        eventShortName = eventEdition.eventShortName || '';
        edition = eventEdition.edition?.toString() || '';
      }
    } catch (e) {
      console.error('[sendEmail] Error fetching eventEdition', e);
      // Don't throw error for general emails, just log it
      if (type !== EmailType.NEWSLETTER) {
        throw e;
      }
    }
  } else if (type !== EmailType.NEWSLETTER) {
    // Only throw error for non-newsletter emails that require an event edition
    throw new Error('No event edition ID found in registration data');
  }
  let tpl;
  try {
    // Ensure helpers are registered prior to compiling
    registerDefaultEmailHelpers(Handlebars);
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

  // Create the email document (compatible with SMTP agent reading /mail)
  const mailDoc = {
    // Required by SMTP agent
    to,
    subject, // duplicate subject at top-level
    message: {
      subject, // keep nested for backward compatibility
      html,
    },
    // Initialize agent namespace so listener query can see this doc
    smtpAgent: {
      state: 'PENDING' as const,
      lastUpdatedAt: serverTimestamp(),
    },
    // Agent state fields
    state: 'PENDING' as const,
    delivery: null as any,
    // App metadata
    type,
    context: enrichedContext,
    registrationId: enrichedContext.id || null,
    createdAt: serverTimestamp(),
    status: 'pending', // keep legacy field for compatibility
    // Add metadata for tracking and filtering
    metadata: {
      emailType: type,
      locale: 'en', // Currently hardcoded, could be made dynamic if needed
      emailTemplate: `${type}_en`,
      ...(eventEditionId && {
        eventEditionId,
        eventId: eventEditionId.split('-').slice(0, -1).join('-'), // Remove year suffix (e.g., 'kutc-2025' -> 'kutc')
        edition: edition?.toString() || ''
      })
    },
  };

  // Write to mail collection in Firestore
  let mailRef;
  try {
    mailRef = await addDoc(collection(db, 'mail'), mailDoc);
  } catch (firestoreError) {
    console.error('[sendEmail] Error writing mailDoc to Firestore:', firestoreError);
    throw firestoreError;
  }

  // Ensure smtpAgent map exists for agent query compatibility
  try {
    await updateDoc(mailRef, {
      'smtpAgent.state': 'PENDING',
      'smtpAgent.lastUpdatedAt': serverTimestamp(),
    });
  } catch (err) {
    console.warn('[sendEmail] Warning: failed to set smtpAgent fields after addDoc', err);
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
export async function enqueueRawEmail(
  to: string,
  subject: string,
  html: string,
  options?: { type?: EmailType | string; context?: any; eventEditionId?: string; campaignId?: string }
): Promise<DocumentReference<any>> {
  const db = getFirestore();
  const type = options?.type ?? 'test';
  const context = options?.context ?? {};
  const eventEditionId = options?.eventEditionId;

  // Build metadata similar to sendEmail
  let eventId = undefined as string | undefined;
  let edition = undefined as string | undefined;
  if (eventEditionId) {
    try {
      const ee = await getEventEdition(eventEditionId);
      if (ee) {
        edition = ee.edition?.toString() || '';
        eventId = eventEditionId.split('-').slice(0, -1).join('-');
      }
    } catch {
      // Non-fatal for test enqueues
    }
  }

  const mailDoc = {
    to,
    subject,
    message: {
      subject,
      html,
    },
    smtpAgent: {
      state: 'PENDING' as const,
      lastUpdatedAt: serverTimestamp(),
    },
    state: 'PENDING' as const,
    delivery: null as any,
    type,
    context,
    registrationId: context?.id || null,
    createdAt: serverTimestamp(),
    status: 'pending',
    metadata: {
      emailType: String(type),
      locale: context?.locale || 'en',
      emailTemplate: `${type}_${context?.locale || 'en'}`,
      ...(options?.campaignId && { campaignId: options.campaignId }),
      ...(eventEditionId && {
        eventEditionId,
        eventId: eventId || '',
        edition: edition || '',
      }),
    },
  };

  const ref = await addDoc(collection(db, 'mail'), mailDoc);
  try {
    await updateDoc(ref, {
      'smtpAgent.state': 'PENDING',
      'smtpAgent.lastUpdatedAt': serverTimestamp(),
    });
  } catch (err) {
    console.warn('[enqueueRawEmail] Warning: failed to set smtpAgent fields after addDoc', err);
  }
  return ref;
}

export { sendEmail };
