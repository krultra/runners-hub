// Test configuration for Firestore emulator
export const TEST_CONFIG = {
  // Use the default Firestore emulator port
  FIRESTORE_EMULATOR_PORT: 8080,
  
  // Test collection names
  COLLECTIONS: {
    REGISTRATIONS: 'test_registrations',
    USERS: 'test_users',
    EVENTS: 'test_events'
  },
  
  // Test user data
  TEST_USER: {
    id: 'test-user-123',
    email: 'test@example.com',
    displayName: 'Test User'
  },
  
  // Test registration data
  TEST_REGISTRATION: {
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
    editionId: '2025',
    notifyFutureEvents: false,
    sendRunningOffers: false,
    paymentRequired: 0,
    paymentMade: 0,
    userId: 'test-user-123',
    status: 'registered',
    createdAt: new Date(),
    updatedAt: new Date()
  }
} as const;
