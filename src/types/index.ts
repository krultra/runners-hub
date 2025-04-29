// Country type
export interface Country {
  name: string;
  code: string; // ISO 3-letter country code
  isCommon?: boolean; // For frequently used countries
}

// Phone country code type
export interface PhoneCode {
  country: string;
  code: string; // e.g., +47
  flag: string; // Unicode flag emoji
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

export type PaymentMethod = 'vipps' | 'bank transfer' | 'paypal' | 'cash' | 'other';

export interface Payment {
  date: Date | string; // Firestore Timestamp or ISO string
  method: PaymentMethod;
  amount: number;
  comment?: string;
}

// Registration type
export interface Registration {
  id?: string;
  editionId: string; // ID of the event edition (e.g., 'kutc-2025')
  email: string;
  raceDistance: string; // ID of the selected race distance
  firstName: string;
  lastName: string;
  dateOfBirth: Date | null;
  nationality: string; // ISO 3-letter country code
  phoneCountryCode: string; // e.g., +47
  phoneNumber: string; // without country code
  representing?: string; // Optional
  travelRequired?: string; // Optional
  termsAccepted: boolean;
  comments?: string; // Optional
  
  // Waiting list fields
  isOnWaitinglist?: boolean;   // Indicates if registration is on waiting list
  waitinglistExpires?: any;    // Firestore Timestamp or ISO string for expiration date
  
  // Marketing preferences
  notifyFutureEvents: boolean; // Notify about future events
  sendRunningOffers: boolean; // Send offers related to trail and ultra running

  // Payment fields
  payments?: Payment[];
  paymentRequired: number;
  paymentMade: number;
  
  // Metadata fields (added by the service)
  userId?: string | null;
  registrationNumber?: number; // Sequential registration number
  status?: string; // Dynamic registration status from Firestore
  
  // Admin tracking (including email sends)
  adminComments?: Array<{
    text?: string;
    at: any;
    mailRef?: string;
    type?: string;
    state?: string;
  }>;
  
  originalEmail?: string; // Stashes previous email on invalidation
  
  paymentStatus?: 'pending' | 'completed' | 'refunded';
  createdAt?: any; // Firestore Timestamp
  updatedAt?: any; // Firestore Timestamp
  remindersSent?: number; // number of reminder emails sent
}

// ActionRequests for admin review
export interface ActionRequest {
  id?: string;
  registrationId: string;
  email: string;
  type: 'sendReminder' | 'sendLastNotice' | 'expireRegistration';
  reason: string;
  createdAt?: any;
  status: 'pending' | 'done' | 'approved' | 'rejected';
  actedAt?: any;
}

// User type
export interface User {
  uid: string;
  email: string;
  displayName?: string;
  registrations?: string[]; // Array of registration IDs
}
