import { addDoc, collection } from 'firebase/firestore';
import { getFirestore } from 'firebase/firestore';
import { Registration } from '../types';
import { RACE_DETAILS } from '../constants';

/**
 * Email types supported by the application
 */
export enum EmailType {
  WELCOME = 'welcome',
  REGISTRATION_UPDATE = 'registration_update',
  PAYMENT_CONFIRMATION = 'payment_confirmation',
  NEWSLETTER = 'newsletter',
  REMINDER = 'reminder'
}

/**
 * Sends a welcome email with registration confirmation and payment instructions
 * @param registration The registration data
 */
export const sendWelcomeEmail = async (registration: Registration): Promise<void> => {
  const db = getFirestore();
  
  try {
    console.log('Attempting to send welcome email to:', registration.email);
    
    // Create the email document
    const emailDoc = {
      to: registration.email,
      message: {
        subject: `KUTC 2025 Registration Confirmation`,
        html: generateWelcomeEmailHtml(registration),
      }
    };
    
    console.log('Email document prepared:', JSON.stringify(emailDoc, null, 2));
    
    // Add to the mail collection
    const docRef = await addDoc(collection(db, 'mail'), emailDoc);
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
    await addDoc(collection(db, 'mail'), {
      to: registration.email,
      message: {
        subject: `KUTC 2025 Registration Update`,
        html: generateUpdateEmailHtml(registration),
      }
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
    await addDoc(collection(db, 'mail'), {
      to: registration.email,
      message: {
        subject: `KUTC 2025 Payment Confirmation`,
        html: generatePaymentConfirmationHtml(registration),
      }
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
      
      <p>The event will take place on ${eventDate} at Jamthaugvegen 37, Saksvik. More details about the event schedule and logistics will be sent closer to the event date.</p>
      
      <p>If you have any questions, please don't hesitate to contact us at post@krultra.no.</p>
      
      <p>Looking forward to seeing you at the event!</p>
      
      <p>Best regards,<br>The KUTC Team</p>
      
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
        <p><strong>Payment Date:</strong> ${new Date().toLocaleDateString()}</p>
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
      
      <p>Best regards,<br>The KUTC Team</p>
      
      <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #eaeaea; font-size: 12px; color: #666; text-align: center;">
        <p>This email was sent to ${registration.email}. If you did not register for this event, please ignore this email.</p>
      </div>
    </div>
  `;
};
