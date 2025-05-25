// Setup file for Jest tests
import { auth, db } from 'config/firebase';

// Global test setup
beforeAll(async () => {
  // Any global setup before tests run
  // Reset all mocks before each test
  jest.clearAllMocks();
});

// Global test teardown
afterAll(async () => {
  // Clean up Firebase after all tests
  await auth.signOut();
  // Close any open connections
  await Promise.all([
    // Add any additional cleanup here if needed
  ]);
});

// Mock any global objects or functions needed for testing
// Mock the window.matchMedia function used by Material-UI
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(), // deprecated
    removeListener: jest.fn(), // deprecated
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
});
