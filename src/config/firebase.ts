import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore';

// Firebase configuration for the RunnersHub project
const firebaseConfig = {
  apiKey: "AIzaSyBxJA5vMRmtX_25LZGzKlF-dHvKqZa6kUw",
  authDomain: "runnershub-62442.firebaseapp.com",
  projectId: "runnershub-62442",
  storageBucket: "runnershub-62442.appspot.com",
  messagingSenderId: "1234567890",
  appId: "1:1234567890:web:abcdef1234567890",
  measurementId: "G-ABCDEFGHIJ"
};

// Log Firebase config for debugging
console.log('Using Firebase project:', firebaseConfig.projectId);
console.log('Connecting to Firestore emulator');

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

// Connect to Firestore emulator for local development
connectFirestoreEmulator(db, '127.0.0.1', 8080);

export default app;
