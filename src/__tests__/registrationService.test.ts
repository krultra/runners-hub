import { db } from '../config/firebase';
import { collection, addDoc, getDoc, doc, deleteDoc } from 'firebase/firestore';
import { Registration } from '../types';

describe('registrationService Firestore integration', () => {
  const testCollection = 'registrations';
  let createdDocId: string | null = null;

  const registration: Registration = {
    email: 'test@example.com',
    raceDistance: '10k',
    firstName: 'Test',
    lastName: 'User',
    dateOfBirth: new Date('2000-01-01'),
    nationality: 'NOR',
    phoneCountryCode: '+47',
    phoneNumber: '12345678',
    representing: 'Test Club',
    travelRequired: 'No',
    termsAccepted: true,
    comments: 'Test comment',
  };

  afterAll(async () => {
  // Clean up test doc
  if (createdDocId) {
    await deleteDoc(doc(db, testCollection, createdDocId));
  }
  // Properly terminate Firestore and delete all Firebase apps
  const { getFirestore, terminate } = await import('firebase/firestore');
  const { getApps, deleteApp } = await import('firebase/app');
  await terminate(getFirestore());
  await Promise.all(getApps().map(app => deleteApp(app)));
});

  it('should add a registration and retrieve it', async () => {
    // Add
    const docRef = await addDoc(collection(db, testCollection), registration);
    createdDocId = docRef.id;
    // Get
    const fetched = await getDoc(doc(db, testCollection, docRef.id));
    expect(fetched.exists()).toBe(true);
    const data = fetched.data();
    expect(data?.email).toBe(registration.email);
    expect(data?.firstName).toBe(registration.firstName);
    expect(data?.raceDistance).toBe(registration.raceDistance);
  });
});
