// Utility to determine if we should use the Firestore emulator or production
// Usage: Set REACT_APP_FIRESTORE_EMULATOR=true in .env to use the emulator

export const shouldUseFirestoreEmulator = () => {
  return process.env.REACT_APP_FIRESTORE_EMULATOR === 'true';
};
