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
  console.log('[sendEmail] Start', { type, to, context });
  const db = getFirestore();
  // Get the event edition from the registration context
  const eventEditionId = (context as any).editionId || (context as any).eventEditionId;
  console.log('[sendEmail] eventEditionId:', eventEditionId);
  if (!eventEditionId) throw new Error('No event edition ID found in registration data');
  let eventEdition;
  try {
    eventEdition = await getEventEdition(eventEditionId);
    console.log('[sendEmail] eventEdition:', eventEdition);
  } catch (e) {
    console.error('[sendEmail] Error fetching eventEdition', e);
    throw e;
  }
  const { eventName, eventShortName, edition } = eventEdition;
  let tpl;
  try {
    tpl = await getEmailTemplate(type, 'en');
    console.log('[sendEmail] email template:', tpl);
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
    // Provide raw Date for templating and formatting
    today: context.today ? new Date(context.today) : new Date(),
  };
  console.log('[sendEmail] enrichedContext:', enrichedContext);
  // Format dates to Norwegian format
  const formatOptions: Record<string, any> = {
    dateOfBirth: { day: '2-digit', month: '2-digit', year: 'numeric' },
    waitinglistExpires: { day: '2-digit', month: '2-digit', year: 'numeric' },
    today: { day: '2-digit', month: '2-digit', year: 'numeric' },
    updatedAt: { 
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    }
  };

  // Format each date field with its specific format
  ['dateOfBirth', 'waitinglistExpires', 'today', 'updatedAt'].forEach((field) => {
    const ts = (enrichedContext as any)[field];
    if (ts) {
      const date = ts.toDate ? ts.toDate() : new Date(ts);
      const options = formatOptions[field];
      (enrichedContext as any)[field] = date.toLocaleString('no-NO', options);
    }
  });
  console.log('[sendEmail] formatted enrichedContext:', enrichedContext);
  const subjTpl = tpl.subjectTemplate || DEFAULT_SUBJECTS[type];
  let subject: string;
  try {
    subject = subjTpl.includes('{{') ? Handlebars.compile(subjTpl)(enrichedContext) : subjTpl;
    console.log('[sendEmail] compiled subject:', subject);
  } catch (err) {
    console.error(`[sendEmail] Error compiling subject template for ${type}:`, err);
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
  console.log('[sendEmail] html:', html);
  // Finally, create the email document in Firestore
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
  console.log('[sendEmail] mailDoc to be written:', mailDoc);

  // Write to mail collection
  let mailRef;
  try {
    console.log('[sendEmail] Writing mailDoc to Firestore...');
    mailRef = await addDoc(collection(db, 'mail'), mailDoc);
    console.log('[sendEmail] mailRef:', mailRef);
  } catch (firestoreError) {
    console.error('[sendEmail] Error writing mailDoc to Firestore:', firestoreError);
    throw firestoreError;
  }

  // Log sent email (if applicable)
  try {
    console.log('[sendEmail] Logging sent email...');
    await logSentEmail({
      to,
      subject,
      type,
      registrationId: enrichedContext.id,
      meta: enrichedContext,
    });
    console.log('[sendEmail] Sent email logged.');
  } catch (logError) {
    console.error('[sendEmail] Error logging sent email', logError);
  }

  // update registration counters for reminders and last notices (with debug logging)
  if (enrichedContext.id) {
    const regRef = doc(db, 'registrations', enrichedContext.id);
    try {
      console.log('[sendEmail] Updating registration counters...');
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
