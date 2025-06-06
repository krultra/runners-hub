import { initializeApp } from 'firebase/app';
import { getAuth, connectAuthEmulator } from 'firebase/auth';
import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore';
import { shouldUseFirestoreEmulator } from './firestoreMode';

// Firebase configuration for the RunnersHub project
const firebaseConfig = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY,
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID,
  storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.REACT_APP_FIREBASE_APP_ID,
  measurementId: process.env.REACT_APP_FIREBASE_MEASUREMENT_ID,
};


/**
 * Firebase configuration and initialization for RunnersHub.
 * Switches between emulator and production Firestore based on env.
 */
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

// Switch between emulator and production Firestore based on env
if (shouldUseFirestoreEmulator()) {
  console.log('Connecting to Firestore emulator on 127.0.0.1:8080');
  connectFirestoreEmulator(db, '127.0.0.1', 8080);
  console.log('Connecting to Auth emulator on 127.0.0.1:9099');
  // Use localhost and trailing slash to ensure Auth emulator CORS proxy works
  connectAuthEmulator(auth, 'http://localhost:9099/', { disableWarnings: true });
} else {
  console.log('Using Firestore production environment');
}

export default app;
