// Country type
export interface Country {
  name: string;
  code: string; // ISO 3-letter country code
  isCommon?: boolean; // For frequently used countries
}

// Race distance type
export interface RaceDistance {
  id: string;
  loops: number;
  kilometers: number;
  miles: number;
  displayName: string;
}

// Registration type
export interface Registration {
  id: string;
  timestamp: Date;
  email: string;
  raceDistance: string; // ID of the selected race distance
  firstName: string;
  lastName: string;
  dateOfBirth: Date;
  nationality: string; // ISO 3-letter country code
  mobilePhone: string;
  representing?: string; // Optional
  travelRequired?: string; // Optional
  termsAccepted: boolean;
  comments?: string; // Optional
  paymentStatus: 'pending' | 'completed' | 'refunded';
  registrationStatus: 'confirmed' | 'waitlisted' | 'cancelled';
}

// User type
export interface User {
  uid: string;
  email: string;
  displayName?: string;
  registrations?: string[]; // Array of registration IDs
}
