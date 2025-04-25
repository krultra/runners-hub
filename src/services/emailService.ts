import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { getFirestore } from 'firebase/firestore';
import { Registration } from '../types';
import { RACE_DETAILS } from '../constants';
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

/**
 * Generates HTML content for the invitation email (bilingual, personalized)
 */
export const generateInvitationEmailHtml = (name: string): string => {
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eaeaea; border-radius: 5px;">
      <div style="margin-bottom: 20px;">
        <h2 style="color: #1976d2;">Hei ${name}!</h2>
        <p><em>(english version below)</em></p>
        <p>Tradisjonen tro åpner påmeldingen til KUTC i påsken, og som en av deltakerne de siste tre årene får du herved en mulighet til å melde deg på før vi annonserer til alle og enhver at påmeldingen har åpnet.</p>
        <p>I år har jeg laget et nytt påmeldingssystem, og det er nok bare i en beta-versjon ennå. Derfor er jeg interessert i å høre fra deg dersom du får problemer med påmeldingen eller har tips til hva som bør forbedres.</p>
        <p><b>Påmelding gjøres ved å gå til <a href='https://runnershub.krultra.no'>https://runnershub.krultra.no</a>.</b></p>
        <p>Håper se deg på startstreken igjen 11. oktober i år!</p>
        <p>Med vennlig hilsen,<br/>Torgeir</p>
        <hr style="margin: 32px 0;" />
        <h2 style="color: #1976d2;">Hi ${name}!</h2>
        <p>As is tradition, registration for KUTC opens at Easter, and as a participant in the last three years, you are hereby given the opportunity to register before we announce to the general public that registration is open.</p>
        <p>This year, I have created a new registration system, and it is still in a beta version. Therefore, I would appreciate hearing from you if you encounter any problems with registration or have suggestions for improvements.</p>
        <p><b>You can register by visiting <a href='https://runnershub.krultra.no'>https://runnershub.krultra.no</a>.</b></p>
        <p>Hope to see you at the starting line again on October 11th this year!</p>
        <p>Best regards,<br/>Torgeir</p>
      </div>
    </div>
  `;
};

/**
 * Sends an invitation email to a single invitee
 */
export const sendInvitationEmail = async (email: string, name: string): Promise<void> => {
  const db = getFirestore();
  // Load template
  const tplInv = await getEmailTemplate(EmailType.INVITATION, 'en');
  const invContext = { name, firstName: name, eventName: EVENT_NAME, eventShortName: EVENT_SHORT_NAME, eventEdition: EVENT_EDITION };
  const subjectInv = Handlebars.compile(tplInv.subjectTemplate || 'KUTC 2025 – Invitation to register')(invContext);
  const bodyInv = Handlebars.compile(tplInv.bodyTemplate || generateInvitationEmailHtml(name))(invContext);
  try {
    const emailDoc = {
      to: email,
      message: {
        subject: subjectInv,
        html: bodyInv,
      },
      type: EmailType.INVITATION,
      createdAt: serverTimestamp()
    };
    await addDoc(collection(db, 'mail'), emailDoc);
    await logSentEmail({
      to: email,
      subject: 'KUTC 2025 – Invitation to register',
      type: 'invitation',
      registrationId: undefined,
      meta: { name }
    });
    console.log(`Invitation email sent to ${email}`);
  } catch (error) {
    console.error('Error sending invitation email:', error);
    throw error;
  }
};

/**
 * Sends a welcome email with registration confirmation and payment instructions
 * @param registration The registration data
 */
export const sendWelcomeEmail = async (registration: Registration): Promise<void> => {
  const db = getFirestore();
  
  try {
    console.log('Attempting to send welcome email to:', registration.email);
    
    // Load template
    const tplWelcome = await getEmailTemplate(EmailType.WELCOME, 'en');
    const welcomeContext = { ...registration, eventName: EVENT_NAME, eventShortName: EVENT_SHORT_NAME, eventEdition: EVENT_EDITION };
    const subjectWelcome = Handlebars.compile(tplWelcome.subjectTemplate || `KUTC 2025 Registration Confirmation`)(welcomeContext);
    const bodyWelcome = Handlebars.compile(tplWelcome.bodyTemplate || generateWelcomeEmailHtml(registration))(welcomeContext);
    
    // Create the email document
    const emailDoc = {
      to: registration.email,
      message: {
        subject: subjectWelcome,
        html: bodyWelcome,
      },
      createdAt: serverTimestamp()
    };
    
    console.log('Email document prepared:', JSON.stringify(emailDoc, null, 2));
    
    // Add to the mail collection
    const docRef = await addDoc(collection(db, 'mail'), emailDoc);
    await logSentEmail({
      to: registration.email,
      subject: 'KUTC 2025 Registration Confirmation',
      type: 'welcome',
      registrationId: registration.id,
      meta: {}
    });
    console.log('Welcome email document created with ID:', docRef.id);
  } catch (error) {
    console.error('Error sending welcome email:', error);
    throw error;
  }
};

/**
 * Sends an email when a registration is updated
 * @param registration The updated registration data
 */
export const sendRegistrationUpdateEmail = async (registration: Registration): Promise<void> => {
  const db = getFirestore();
  
  try {
    // Load template
    const tplUpdate = await getEmailTemplate(EmailType.REGISTRATION_UPDATE, 'en');
    const updateContext = { ...registration, eventName: EVENT_NAME, eventShortName: EVENT_SHORT_NAME, eventEdition: EVENT_EDITION };
    const subjectUpdate = Handlebars.compile(tplUpdate.subjectTemplate || `KUTC 2025 Registration Update`)(updateContext);
    const bodyUpdate = Handlebars.compile(tplUpdate.bodyTemplate || generateUpdateEmailHtml(registration))(updateContext);
    
    await addDoc(collection(db, 'mail'), {
      to: registration.email,
      message: {
        subject: subjectUpdate,
        html: bodyUpdate,
      },
      createdAt: serverTimestamp()
    });
    await logSentEmail({
      to: registration.email,
      subject: 'KUTC 2025 Registration Update',
      type: 'registration_update',
      registrationId: registration.id,
      meta: {}
    });
    console.log('Registration update email sent successfully');
  } catch (error) {
    console.error('Error sending registration update email:', error);
    throw error;
  }
};

/**
 * Sends a payment confirmation email
 * @param registration The registration data
 */
export const sendPaymentConfirmationEmail = async (registration: Registration): Promise<void> => {
  const db = getFirestore();
  
  try {
    // Load template
    const tplPay = await getEmailTemplate(EmailType.PAYMENT_CONFIRMATION, 'en');
    const payContext = {
      ...registration,
      eventName: EVENT_NAME,
      eventShortName: EVENT_SHORT_NAME,
      eventEdition: EVENT_EDITION,
      today: new Date().toLocaleDateString()
    };
    const subjectPay = Handlebars.compile(tplPay.subjectTemplate || `KUTC 2025 Payment Confirmation`)(payContext);
    const bodyPay = Handlebars.compile(tplPay.bodyTemplate || generatePaymentConfirmationHtml(registration))(payContext);
    
    await addDoc(collection(db, 'mail'), {
      to: registration.email,
      message: {
        subject: subjectPay,
        html: bodyPay,
      },
      createdAt: serverTimestamp()
    });
    await logSentEmail({
      to: registration.email,
      subject: 'KUTC 2025 Payment Confirmation',
      type: 'payment_confirmation',
      registrationId: registration.id,
      meta: { paymentMade: registration.paymentMade, paymentRequired: registration.paymentRequired }
    });
    console.log('Payment confirmation email sent successfully');
  } catch (error) {
    console.error('Error sending payment confirmation email:', error);
    throw error;
  }
};

/**
 * Generates HTML content for welcome email
 */
const generateWelcomeEmailHtml = (registration: Registration): string => {
  console.log('[generateWelcomeEmailHtml] registration:', registration);
  console.log('[generateWelcomeEmailHtml] dateOfBirth:', registration.dateOfBirth, 'type:', typeof registration.dateOfBirth);

  // Format date safely
  let eventDate = '11 October 2025';
  try {
    eventDate = RACE_DETAILS.date.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  } catch (e) {
    console.error('Error formatting date:', e);
  }
  
  // Format birth date safely
  // Format birth date safely
  let birthDate = 'Not provided';
  try {
    if (registration.dateOfBirth) {
      let dob: Date;
      // Firestore Timestamp object detection
      if (registration.dateOfBirth && typeof (registration.dateOfBirth as any).toDate === 'function') {
        dob = (registration.dateOfBirth as any).toDate();
      } else if (typeof registration.dateOfBirth === 'string') {
        dob = new Date(registration.dateOfBirth);
      } else {
        dob = registration.dateOfBirth;
      }
      if (!isNaN(dob.getTime())) {
        birthDate = dob.toLocaleDateString('no-NO');
      }
    }
  } catch (e) {
    console.error('Error formatting birth date:', e);
  }
  
  // Get registration number (or use a fallback)
  const regNumber = registration.registrationNumber || 0;
  
  // Create a simple payment reference
  const paymentReference = `${registration.editionId}-${regNumber}`;
  
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eaeaea; border-radius: 5px;">
      <div style="text-align: center; margin-bottom: 20px;">
        <h1 style="color: #2e7d32;">KUTC 2025 Registration Confirmation</h1>
      </div>
      
      <p>Hello ${registration.firstName},</p>
      
      <p>Thank you for registering for Kruke's Ultra-Trail Challenge 2025! Your registration has been received and is being processed.</p>
      
      <div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
        <h3 style="margin-top: 0;">Registration Details</h3>
        <p><strong>Registration #:</strong> ${regNumber}</p>
        <p><strong>Name:</strong> ${registration.firstName} ${registration.lastName}</p>
        <p><strong>Email:</strong> ${registration.email}</p>
        <p><strong>Date of Birth:</strong> ${birthDate}</p>
        <p><strong>Nationality:</strong> ${registration.nationality}</p>
        <p><strong>Phone:</strong> ${registration.phoneCountryCode} ${registration.phoneNumber}</p>
        <p><strong>Race Distance:</strong> ${registration.raceDistance}</p>
        ${registration.representing ? `<p><strong>Representing:</strong> ${registration.representing}</p>` : ''}
        ${registration.travelRequired ? `<p><strong>Travel Required:</strong> ${registration.travelRequired}</p>` : ''}
        ${registration.comments ? `<p><strong>Comments:</strong> ${registration.comments}</p>` : ''}
        <p><strong>Registration Date:</strong> ${new Date().toLocaleDateString()}</p>
      </div>
      
      <div style="background-color: #e8f5e9; padding: 15px; border-radius: 5px; margin: 20px 0;">
        <h3 style="margin-top: 0; color: #2e7d32;">Payment Information</h3>
        <p><strong>Total Amount Due:</strong> ${registration.paymentRequired} NOK</p>
        <p><strong>Payment Methods:</strong></p>
        <ul>
          <li>Vipps/MobilePay: (+47) 913 51 909</li>
          <li>Bank Transfer: KrUltra, account 9802 46 25850</li>
          <li>International Payments: IBAN: NO61 9802 4625850, BIC/SWIFT: DNBANOKKXXX</li>
        </ul>
        <p><strong>Payment Reference:</strong> ${paymentReference}</p>
        <p>Please complete your payment within 7 days to secure your spot.</p>
      </div>
      
      <p>The event will take place on ${eventDate} at Jamthaugvegen 37, Saksvik. More details about the event will be sent closer to the event date.</p>
      
      <p>If you have any questions, please don't hesitate to contact us at post@krultra.no.</p>
      
      <p>Looking forward to seeing you at the event!</p>
      
      <p>Best regards,<br>KrUltra</p>
      
      <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #eaeaea; font-size: 12px; color: #666; text-align: center;">
        <p>This email was sent to ${registration.email}. If you did not register for this event, please ignore this email.</p>
      </div>
    </div>
  `;
};

/**
 * Generates HTML content for registration update email
 */
const generateUpdateEmailHtml = (registration: Registration): string => {
  console.log('[generateUpdateEmailHtml] registration:', registration);
  console.log('[generateUpdateEmailHtml] dateOfBirth:', registration.dateOfBirth, 'type:', typeof registration.dateOfBirth);

  // Format birth date safely
  let birthDate = 'Not provided';
  try {
    if (registration.dateOfBirth) {
      let dob: Date;
      // Firestore Timestamp object detection
      if (registration.dateOfBirth && typeof (registration.dateOfBirth as any).toDate === 'function') {
        dob = (registration.dateOfBirth as any).toDate();
      } else if (typeof registration.dateOfBirth === 'string') {
        dob = new Date(registration.dateOfBirth);
      } else {
        dob = registration.dateOfBirth;
      }
      if (!isNaN(dob.getTime())) {
        birthDate = dob.toLocaleDateString('no-NO');
      }
    }
  } catch (e) {
    console.error('Error formatting birth date:', e);
  }
  
  // Get registration number (or use a fallback)
  const regNumber = registration.registrationNumber || 0;
  
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eaeaea; border-radius: 5px;">
      <div style="text-align: center; margin-bottom: 20px;">
        <h1 style="color: #1976d2;">KUTC 2025 Registration Update</h1>
      </div>
      
      <p>Hello ${registration.firstName},</p>
      
      <p>Your registration for Kruke's Ultra-Trail Challenge 2025 has been updated successfully.</p>
      
      <div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
        <h3 style="margin-top: 0;">Updated Registration Details</h3>
        <p><strong>Registration #:</strong> ${regNumber}</p>
        <p><strong>Name:</strong> ${registration.firstName} ${registration.lastName}</p>
        <p><strong>Email:</strong> ${registration.email}</p>
        <p><strong>Date of Birth:</strong> ${birthDate}</p>
        <p><strong>Nationality:</strong> ${registration.nationality}</p>
        <p><strong>Phone:</strong> ${registration.phoneCountryCode} ${registration.phoneNumber}</p>
        <p><strong>Race Distance:</strong> ${registration.raceDistance}</p>
        ${registration.representing ? `<p><strong>Representing:</strong> ${registration.representing}</p>` : ''}
        ${registration.travelRequired ? `<p><strong>Travel Required:</strong> ${registration.travelRequired}</p>` : ''}
        ${registration.comments ? `<p><strong>Comments:</strong> ${registration.comments}</p>` : ''}
        <p><strong>Last Updated:</strong> ${new Date().toLocaleDateString()}</p>
      </div>
      
      <p>If you did not make these changes or have any questions, please contact us immediately at post@krultra.no.</p>
      
      <p>Best regards,<br>The KUTC Team</p>
      
      <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #eaeaea; font-size: 12px; color: #666; text-align: center;">
        <p>This email was sent to ${registration.email}. If you did not register for this event, please ignore this email.</p>
      </div>
    </div>
  `;
};

/**
 * Generates HTML content for payment confirmation email
 *
 * EMAIL TEXT PREVIEW (template variables in curly braces):
 *
 * Subject: KUTC 2025 Payment Confirmation
 *
 * Hello {firstName},
 *
 * We have received your payment for Kruke's Ultra-Trail Challenge 2025. Thank you!
 *
 * Payment Details
 * Registration #: {registrationNumber}
 * Payment Reference: {editionId}-{registrationNumber}
 * Amount Paid: {paymentMade} NOK
 * Payment Date: {today's date}
 * Registration Status: {status or 'pending'}
 *
 * Registration Details
 * Name: {firstName} {lastName}
 * Email: {email}
 * Race Distance: {raceDistance}
 *
 * Your spot in the event is now confirmed. We look forward to seeing you at KUTC 2025 on {eventDate}!
 *
 * If you have any questions, please don't hesitate to contact us at post@krultra.no.
 *
 * Best regards,
 * The KUTC Team
 *
 * This email was sent to {email}. If you did not register for this event, please ignore this email.
 */
const generatePaymentConfirmationHtml = (registration: Registration): string => {
  // Format event date safely
  let eventDate = '11 October 2025';
  try {
    eventDate = RACE_DETAILS.date.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  } catch (e) {
    console.error('Error formatting date:', e);
  }
  
  // Get registration number (or use a fallback)
  const regNumber = registration.registrationNumber || 0;
  
  // Create a simple payment reference
  const paymentReference = `${registration.editionId}-${regNumber}`;
  
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eaeaea; border-radius: 5px;">
      <div style="text-align: center; margin-bottom: 20px;">
        <h1 style="color: #2e7d32;">KUTC 2025 Payment Confirmation</h1>
      </div>
      
      <p>Hello ${registration.firstName},</p>
      
      <p>We have received your payment for Kruke's Ultra-Trail Challenge 2025. Thank you!</p>
      
      <div style="background-color: #e8f5e9; padding: 15px; border-radius: 5px; margin: 20px 0;">
        <h3 style="margin-top: 0; color: #2e7d32;">Payment Details</h3>
        <p><strong>Registration #:</strong> ${regNumber}</p>
        <p><strong>Payment Reference:</strong> ${paymentReference}</p>
        <p><strong>Amount Paid:</strong> ${registration.paymentMade} NOK</p>
        <p><strong>Payment Date:</strong> {{today}}</p>
        <p><strong>Registration Status:</strong> ${registration.status || 'pending'}</p>
      </div>
      
      <div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
        <h3 style="margin-top: 0;">Registration Details</h3>
        <p><strong>Name:</strong> ${registration.firstName} ${registration.lastName}</p>
        <p><strong>Email:</strong> ${registration.email}</p>
        <p><strong>Race Distance:</strong> ${registration.raceDistance}</p>
      </div>
      
      <p>Your spot in the event is now confirmed. We look forward to seeing you at KUTC 2025 on ${eventDate}!</p>
      
      <p>If you have any questions, please don't hesitate to contact us at post@krultra.no.</p>
      
      <p>Best regards,<br/>The KUTC Team</p>
      
      <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #eaeaea; font-size: 12px; color: #666; text-align: center;">
        <p>This email was sent to ${registration.email}. If you did not register for this event, please ignore this email.</p>
      </div>
    </div>
  `;
};

/**
 * Generates HTML content for waiting-list confirmation email
 */
export const generateWaitingListEmailHtml = (registration: Registration): string => {
  // Format waiting-list expiry date
  let expiry = 'Unknown date';
  try {
    if (registration.waitinglistExpires && typeof (registration.waitinglistExpires as any).toDate === 'function') {
      expiry = (registration.waitinglistExpires as any).toDate().toLocaleDateString('no-NO', { day: 'numeric', month: 'long', year: 'numeric' });
    } else if (registration.waitinglistExpires instanceof Date) {
      expiry = registration.waitinglistExpires.toLocaleDateString('no-NO', { day: 'numeric', month: 'long', year: 'numeric' });
    }
  } catch (e) {
    console.error('Error formatting waiting-list expiry date:', e);
  }
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eaeaea; border-radius: 5px;">
      <div style="margin-bottom: 20px;">
        <h2 style="color: #1976d2;">Hei ${registration.firstName}!</h2>
        <p>Du er nå registrert på ventelisten for KUTC 2025.</p>
        <p>Ventelisten utløper ${expiry}. Dersom du ikke blir flyttet til deltakerlisten innen denne datoen, vil du automatisk bli fjernet fra ventelisten.</p>
        <p>Skulle en plass bli ledig, vil du motta et nytt tilbud på e-post. Hvis du aksepterer tilbudet, må du bekrefte innen 24 timer for å sikre din plass.</p>
        <p>Hvis du ikke får mulighet til å flyttes til deltakerlisten, vil alle betalinger (minus transaksjonsgebyrer) bli refundert.</p>
        <p>Merk at hvis du mottar et tilbud om deltakerplass og velger å avslå, vil det ikke være noen refusjon.</p>
        <p>Med vennlig hilsen,<br/>KUTC Teamet</p>
        <hr style="margin: 32px 0;" />
        <h2 style="color: #1976d2;">Hi ${registration.firstName}!</h2>
        <p>You have been added to the waiting list for KUTC 2025.</p>
        <p>The waiting list expires on ${expiry}. If you are not moved to the participants list before this date, you will be automatically removed from the waiting list.</p>
        <p>If a spot becomes available, you will receive a new email offer. If you choose to accept the offer, you must confirm within 24 hours to secure your spot.</p>
        <p>If you never get an opportunity to move to the participants list, all payments (minus transaction fees) will be refunded.</p>
        <p>Please note that if you receive an offer to move to the participants list and decide to reject the offer, there will be no refund.</p>
        <p>Best regards,<br/>The KUTC Team</p>
      </div>
    </div>
  `;
};

/**
 * Sends waiting-list confirmation email
 */
export const sendWaitingListEmail = async (registration: Registration): Promise<void> => {
  const db = getFirestore();
  try {
    // Load template
    const tplWait = await getEmailTemplate(EmailType.WAITING_LIST_CONFIRMATION, 'en');
    const waitContext = {
      ...registration,
      eventName: EVENT_NAME,
      eventShortName: EVENT_SHORT_NAME,
      eventEdition: EVENT_EDITION,
      today: new Date().toLocaleDateString()
    };
    const subjectWait = Handlebars.compile(tplWait.subjectTemplate || `KUTC 2025 Waiting List Confirmation`)(waitContext);
    const bodyWait = Handlebars.compile(tplWait.bodyTemplate || generateWaitingListEmailHtml(registration))(waitContext);
    
    const emailDoc = {
      to: registration.email,
      message: {
        subject: subjectWait,
        html: bodyWait,
      },
      type: EmailType.WAITING_LIST_CONFIRMATION,
      createdAt: serverTimestamp()
    };
    await addDoc(collection(db, 'mail'), emailDoc);
    await logSentEmail({
      to: registration.email,
      subject: 'KUTC 2025 Waiting List Confirmation',
      type: EmailType.WAITING_LIST_CONFIRMATION,
      registrationId: registration.id,
      meta: { waitinglistExpires: registration.waitinglistExpires }
    });
    console.log('Waiting list email sent to', registration.email);
  } catch (error) {
    console.error('Error sending waiting-list email:', error);
    throw error;
  }
};

/**
 * Sends an initial waiting-list registration email to a user.
 */
export const sendWaitingListRegistrationEmail = async (registration: Registration): Promise<void> => {
  const db = getFirestore();
  // Load template
  const tpl = await getEmailTemplate(EmailType.WAITING_LIST_REGISTRATION, 'en');
  const context = { ...registration, eventName: EVENT_NAME, eventShortName: EVENT_SHORT_NAME, eventEdition: EVENT_EDITION };
  const subject = Handlebars.compile(tpl.subjectTemplate || `KUTC ${EVENT_EDITION} Waiting List Registration`)(context);
  const body = Handlebars.compile(tpl.bodyTemplate || generateWaitingListEmailHtml(registration))(context);
  try {
    await addDoc(collection(db, 'mail'), { to: registration.email, message: { subject, html: body }, type: EmailType.WAITING_LIST_REGISTRATION, createdAt: serverTimestamp() });
    await logSentEmail({ to: registration.email, subject, type: 'waiting_list_registration', registrationId: registration.id, meta: { waitinglistExpires: registration.waitinglistExpires } });
    console.log('Waiting list registration email sent to', registration.email);
  } catch (error) {
    console.error('Error sending waiting list registration email:', error);
    throw error;
  }
};
