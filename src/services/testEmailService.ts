import { addDoc, collection, getFirestore } from 'firebase/firestore';

/**
 * Sends a test email to verify the email configuration
 * @param recipientEmail Email address to send the test to
 */
export const sendTestEmail = async (recipientEmail: string): Promise<void> => {
  const db = getFirestore();
  
  try {
    console.log('Sending test email to:', recipientEmail);
    
    const emailDoc = {
      to: recipientEmail,
      message: {
        subject: 'Test Email from KUTC Registration System',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eaeaea;">
            <h1 style="color: #2e7d32;">KUTC Email Test</h1>
            <p>This is a test email from the KUTC registration system.</p>
            <p>If you're receiving this, the email configuration is working correctly!</p>
            <p>Time sent: ${new Date().toLocaleString()}</p>
            <p>Challenge yourself on the trails to Solemsvåttan!</p>
            <p>If you have any questions, please contact us at post@krultra.no</p>
          </div>
        `
      }
    };
    
    const docRef = await addDoc(collection(db, 'mail'), emailDoc);
    console.log('Test email document created with ID:', docRef.id);
  } catch (error) {
    console.error('Error sending test email:', error);
    throw error;
  }
};
