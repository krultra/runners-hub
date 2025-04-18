import { doc, getDoc, setDoc, getFirestore, runTransaction } from 'firebase/firestore';

/**
 * Service to manage sequential counters for various purposes
 * such as registration numbers
 */

/**
 * Gets the next sequential number for a given counter and increments it
 * @param counterName The name of the counter (e.g., 'registrations-kutc-2025')
 * @returns The next sequential number
 */
export const getNextSequentialNumber = async (counterName: string): Promise<number> => {
  const db = getFirestore();
  const counterRef = doc(db, 'counters', counterName);
  
  try {
    // Use a transaction to ensure we get a unique, sequential number
    return await runTransaction(db, async (transaction) => {
      const counterDoc = await transaction.get(counterRef);
      
      let currentValue = 1; // Start with 1 if counter doesn't exist
      
      if (counterDoc.exists()) {
        currentValue = counterDoc.data().currentValue + 1;
      }
      
      // Update the counter with the new value
      transaction.set(counterRef, { currentValue });
      
      return currentValue;
    });
  } catch (error) {
    console.error('Error getting next sequential number:', error);
    throw error;
  }
};

/**
 * Gets the current value of a counter without incrementing it
 * @param counterName The name of the counter
 * @returns The current value of the counter, or 0 if it doesn't exist
 */
export const getCurrentCounterValue = async (counterName: string): Promise<number> => {
  const db = getFirestore();
  const counterRef = doc(db, 'counters', counterName);
  
  try {
    const counterDoc = await getDoc(counterRef);
    
    if (counterDoc.exists()) {
      return counterDoc.data().currentValue;
    }
    
    return 0;
  } catch (error) {
    console.error('Error getting current counter value:', error);
    throw error;
  }
};

/**
 * Sets the counter to a specific value
 * @param counterName The name of the counter
 * @param value The value to set
 */
export const setCounterValue = async (counterName: string, value: number): Promise<void> => {
  const db = getFirestore();
  const counterRef = doc(db, 'counters', counterName);
  
  try {
    await setDoc(counterRef, { currentValue: value });
  } catch (error) {
    console.error('Error setting counter value:', error);
    throw error;
  }
};
