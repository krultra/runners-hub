// Utility to determine if we should use the Firestore emulator or production
// Usage: Set REACT_APP_FIRESTORE_EMULATOR=true in .env to use the emulator

export const shouldUseFirestoreEmulator = () => {
  // Use emulator only when explicitly enabled via env var
  console.log(`firestoreMode: REACT_APP_FIRESTORE_EMULATOR = '${process.env.REACT_APP_FIRESTORE_EMULATOR}' (type: ${typeof process.env.REACT_APP_FIRESTORE_EMULATOR})`);
  return process.env.REACT_APP_FIRESTORE_EMULATOR === 'true';
};
