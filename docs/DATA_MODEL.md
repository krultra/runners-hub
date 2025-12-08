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

Monotonic counters used to generate sequential numbers (e.g., registrations).

- id: string — counter name (e.g., `registrations-kutc-2025`)
- currentValue: number

### eventEditions
Represents a specific edition/year of an event.

- id (document ID): string — e.g., `kutc-2026`
- eventId: string — parent event ID, e.g., `kutc`
- edition: number — year/edition number
- eventShortName: string
- eventName: string
- status: string — status code (see codeLists below)
- resultTypes: string[]
- resultsStatus: string
- resultURL?: string
- liveResultsURL?: string — external live timing URL
- RH_URL?: string — internal RunnersHub page URL, e.g., `/kutc-2026`
- startTime: Timestamp
- endTime: Timestamp
- registrationOpens?: Timestamp — when registration opens
- registrationDeadline?: Timestamp — when registration closes
- maxParticipants?: number — triggers waiting-list when reached
- loopDistance?: number
- raceDistances?: Array<{ id, displayName, length, ascent, descent, active? }>
- fees?: { participation, baseCamp, deposit, total }

### codeLists
Lookup table for status codes and other enumerated values.

- id (document ID): string — auto-generated
- code: string — the code value stored in documents
- object: string — which collection this applies to (e.g., `eventEditions`)
- type: string — which field (e.g., `status`)
- sortOrder: number — display order
- verboseName: string — human-readable label

#### eventEditions.status codes

| Code | sortOrder | verboseName | Registration Allowed |
|------|-----------|-------------|---------------------|
| `hidden` | 0 | Event is hidden | No |
| `draft` | 10 | Not Published | No |
| `announced` | 20 | Published, not open for registrations | No |
| `pre_registration` | 30 | Open for pre-registration | Yes |
| `open` | 40 | Open for registration | Yes |
| `waitlist` | 44 | Open for waitlist registrations | Yes (waiting-list only) |
| `late_registration` | 50 | Late registration accepted (extra fee) | Yes |
| `full` | 54 | All spots taken, registration closed | No |
| `closed` | 60 | Registration is closed | No |
| `in_progress` | 70 | Event is ongoing | No |
| `suspended` | 75 | Temporarily paused | No |
| `finished` | 80 | Event has concluded | No |
| `cancelled` | 90 | Event is cancelled | No |
| `finalized` | 100 | Official results are published | No |

**Registration logic**: Codes 30-60 are considered "registration phase" in the UI.
- `isRegistrationOpen` = status in [30-60] AND `registrationDeadline` not passed AND race not started
- When `maxParticipants` is reached, new registrations go to waiting-list
- When any waiting-list entries exist, all new registrations are forced to waiting-list

### Example: mo-2026 eventEdition

To enable the MO 2026 page with RunnersHub registration, create a document in `eventEditions` with ID `mo-2026`:

```json
{
  "eventId": "mo",
  "edition": 2026,
  "eventShortName": "MO",
  "eventName": "Malvikingen Opp 2026",
  "status": "announced",
  "resultsStatus": "",
  "RH_URL": "/mo-2026",
  "startTime": "2026-05-09T12:00:00+02:00",
  "endTime": "2026-05-09T15:00:00+02:00",
  "registrationOpens": "2026-03-01T12:00:00+01:00",
  "registrationDeadline": "2026-05-07T23:59:00+02:00",
  "maxParticipants": 200,
  "loopDistance": 6000,
  "raceDistances": [
    {
      "id": "konkurranse",
      "displayName": "Konkurranse",
      "length": 6000,
      "ascent": 420,
      "descent": 0,
      "active": true
    },
    {
      "id": "trim",
      "displayName": "Trim med tidtaking",
      "length": 6000,
      "ascent": 420,
      "descent": 0,
      "active": true
    },
    {
      "id": "tur",
      "displayName": "Turklasse",
      "length": 6000,
      "ascent": 420,
      "descent": 0,
      "active": true
    }
  ],
  "fees": {
    "participation": 200,
    "baseCamp": 50,
    "deposit": 0,
    "total": 200
  }
}
```

**Notes:**
- `participation` fee is for competition/trim classes
- `baseCamp` fee is used for hiking class (turklasse)
- Set `status` to `open` (40) when registration should be active
- Ensure `registrationOpens` is set to control when registration opens

## Security
{{ ... }}
- See `firestore.rules` and `firestore.rules.bak` for rule sets.
- Production rules should enforce read/write on `users/{uid}` only for the authenticated user or admins.
