import * as admin from 'firebase-admin';

// Initialize Firebase Admin once
admin.initializeApp();

// Firestore database reference
export const db = admin.firestore();

// Export admin SDK if needed elsewhere
export default admin;
