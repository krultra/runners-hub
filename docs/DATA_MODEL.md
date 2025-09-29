# Data Model

This document describes the primary Firestore collections used by Runners Hub.

> Conventions
>
> - All users should have `uid` equal to the Firestore document ID in `users/`.
> - Registration email is the canonical source for user email when syncing.
> - Timestamps in Firestore are stored as Firestore Timestamps.

## Collections

### users
Represents application users (participants and admins).

- id (document ID): string — equals `uid`
- uid: string — duplicate of document ID for convenience
- email: string — user email address
- firstName: string
- lastName: string
- nationality: string (ISO-3)
- dateOfBirth: Timestamp | string
- phone: string
- representing: string[] — de-duplicated history of clubs/teams entered in registrations
- isAdmin: boolean (optional)
- lastSynced: Timestamp — when the admin sync last ran for this user

Notes:
- The admin backfill script ensures `uid` is present and equals the doc ID.
- The admin sync (UI/CLI) ensures `email` is set from the registration.

### registrations
Represents event registrations.

- id (document ID): string
- editionId: string — e.g., `kutc-2025`
- email: string — registrant email (canonical source)
- userId: string | null — optional UID when known
- raceDistance: string
- firstName: string
- lastName: string
- dateOfBirth: Timestamp | Date | string
- nationality: string (ISO-3)
- phoneCountryCode: string
- phoneNumber: string
- representing?: string
- travelRequired?: string
- termsAccepted: boolean
- comments?: string
- notifyFutureEvents: boolean
- sendRunningOffers: boolean
- payments?: Array<{ date: Timestamp | Date | string; method: string; amount: number; comment?: string; }>
- paymentRequired: number
- paymentMade: number
- status?: string ('pending' | 'confirmed' | 'cancelled' | 'expired' ...)
- isOnWaitinglist?: boolean
- waitinglistExpires?: Timestamp | string | null
- registrationNumber?: number
- remindersSent?: number
- lastNoticesSent?: number
- originalEmail?: string
- createdAt?: Timestamp
- updatedAt?: Timestamp

Indexes:
- See `firestore.indexes.json`.

### admins
Admin users for authorization checks.

- id (document ID): string — could be uid or arbitrary
- email: string
- roles?: string[]

### mail
Outgoing email documents to be processed by Firebase email extension.

- to: string | string[]
- message: { subject, text, html }
- createdAt: Timestamp

### emailLogs
Audit of sent emails.

- ref to mail doc, status, timestamps, etc.

### counters
Monotonic counters used to generate sequential numbers (e.g., registrations).

- id: string — counter name (e.g., `registrations-kutc-2025`)
- currentValue: number

## Relationships

- One user can have many registrations (linked by email; optionally by `userId=uid`).
- `representing` in `users` is derived from any `registrations.representing` values entered over time.

## Data Flows

- Registration create → (optional) Admin Sync updates/creates matching `users` doc:
  - Find `users` by `email == registration.email`.
  - If none, create `users/{uid-or-email}` (prefer UID if available, else email).
  - Merge basic profile fields and update `representing` array.

## Security

- See `firestore.rules` and `firestore.rules.bak` for rule sets.
- Production rules should enforce read/write on `users/{uid}` only for the authenticated user or admins.
