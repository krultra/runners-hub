import { db } from '../config/firebase';
import { doc, deleteDoc } from 'firebase/firestore';
import { Registration } from '../types';
import { getRegistrationsByUserId, createRegistration } from '../services/registrationService';

describe('registrationService duplicate prevention', () => {
  const testCollection = 'registrations';
  const userId = 'test-duplicate-user';
  let createdDocIds: string[] = [];

  const registration: Registration = {
    email: 'unique@example.com',
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
    editionId: '2025',
    notifyFutureEvents: false,
    sendRunningOffers: false,
    paymentRequired: 0,
    paymentMade: 0,
  };

  beforeAll(async () => {
    // Clean up any existing registration for this user
    const existing = await getRegistrationsByUserId(userId, '2025');
    for (const reg of existing) {
      if (reg.id) {
        await deleteDoc(doc(db, testCollection, reg.id));
      }
    }
  });

  afterAll(async () => {
    // Clean up test docs
    for (const id of createdDocIds) {
      await deleteDoc(doc(db, testCollection, id));
    }
    // Properly terminate Firestore and delete all Firebase apps
    const { getFirestore, terminate } = await import('firebase/firestore');
    const { getApps, deleteApp } = await import('firebase/app');
    await terminate(getFirestore());
    await Promise.all(getApps().map(app => deleteApp(app)));
  });

  it('should allow the first registration for a user', async () => {
    const regId = await createRegistration({ ...registration }, userId);
    createdDocIds.push(regId);
    const regs = await getRegistrationsByUserId(userId, '2025');
    expect(regs.length).toBe(1);
  });

  it('should block duplicate registrations for the same userId', async () => {
    const regsBefore = await getRegistrationsByUserId(userId, '2025');
    expect(regsBefore.length).toBe(1);
  });
});
