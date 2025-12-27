---
status: in_progress
last_updated: 2025-12-25
---

# Privacy Hardening Rollout Plan

## Progress

### Milestone 1 (Projections) status
- [x] Add docs/PRIVACY_HARDENING_PLAN.md
- [x] Add Cloud Functions triggers:
  - [x] registrations -> publicRegistrations
  - [x] moRegistrations -> publicMoRegistrations
- [x] Export triggers from functions/src/index.ts
- [x] Add rules for publicRegistrations/publicMoRegistrations (public read, admin write)
- [x] Add Firestore composite indexes for public projection collections
- [x] Update frontend participants list fetcher to prefer publicRegistrations (temporary fallback kept)
- [ ] Build/lint functions and frontend locally
- [ ] Deploy functions + rules + indexes to test project
- [ ] Backfill publicRegistrations/publicMoRegistrations for existing data

## Goal
Prevent unauthorized access to sensitive runner data (email, phone, full date-of-birth, future address) while keeping:

- Public (unauthenticated) access to participants lists and results lists.
- Public runner profiles available only to authenticated users.
- Admin full read/write access.

## Data Classification

### Public
- firstName, lastName, displayName
- nationality
- representing (club)
- yearOfBirth
- personId
- nfifLicenseNumber

### Private
- email
- phoneCountryCode, phone
- dateOfBirth (full)
- address (future)

## Implementation Strategy (order matters)

### Milestone 1: Public projection collections (safe, no lock-down yet)
- Add Firestore projection collections:
  - publicRegistrations
  - publicMoRegistrations
- Add Cloud Functions triggers to maintain projections when source docs change:
  - registrations -> publicRegistrations
  - moRegistrations -> publicMoRegistrations
- Update Firestore rules to allow:
  - public read on projection collections
  - admin-only write on projection collections
- Switch PublicRegistrationsPage to read from publicRegistrations

### Milestone 2: Switch results aggregation to projections
- Update resultsService to read from publicRegistrations/publicMoRegistrations instead of registrations/moRegistrations.

### Milestone 3: Split user profiles
- Create usersPrivate collection for private fields.
- Move email/phone/full DOB from users to usersPrivate.
- Update app pages/services and admin UI to read/write private fields from usersPrivate.

### Milestone 4: Lock down sensitive source collections
- Restrict reads on registrations/moRegistrations to owner/admin (or admin-only where appropriate).
- Ensure public pages are fully backed by projections first.

### Milestone 5: Backfill & cleanup
- Backfill projections for historical docs.
- Remove sensitive fields from publicly readable docs.

## Testing Checklist

### After Milestone 1
- Unauthenticated:
  - Can load participants list page and see entries.
- Projections:
  - Creating/updating a registration results in a publicRegistrations doc being created/updated.
  - Creating/updating a moRegistrations doc results in a publicMoRegistrations doc being created/updated.

### After Milestone 2
- Unauthenticated:
  - Can load results pages and see participants/times.

### After Milestone 3
- Logged-in user:
  - Can view other runners' public profiles.
  - Cannot access other runners' private fields.
- Admin:
  - Can view/edit private fields.

### After Milestone 4
- Unauthenticated:
  - Cannot read registrations/moRegistrations directly.
  - Still can read public projections.

## Notes
- During the transition, temporary fallbacks may exist in frontend utilities to read old collections. These must be removed before Milestone 4.
