# Malvikingen Opp (MO) Results – Implementation Plan

## Decisions (confirmed)
- Use routes with `:editionId` for both MO and KUTC; add redirects for KUTC from `:year` to `:editionId`.
- MO pages use Norwegian (nb-NO) labels/texts. Home card for MO remains English.
- Grading factors come from `timeGradingFactors` as-is. Factor types: AGG (age+gender), AG (age), GG (gender). Clamp ages to [4,100].
- Classes: `konkurranse`, `trim_tidtaking`, `turklasse`. Gender stored as `Male|Female`, UI displays `Menn|Kvinner`. Turklasse has no times; exclude Trim from records.
- Runner statuses follow code list `{results, runnerstatus}`: UNK, FIN, DNS, DNF, DSQ, CNL. Timing precision: tenths of a second.
- Use `users.representing` for club/affiliation. Volunteers tracked separately with role codes (VOL,RD,HJ,CM,HTJ,TK,SEC) as array.

## Phased Delivery

### Phase 1 — Routing & Scaffolding (current)
- Add MO routes in `src/App.tsx`:
  - `/mo/results` → `MOResultsOverviewPage`
  - `/mo/results/:editionId` → `MOEditionResultsPage`
  - `/mo/all-time` → `MOAllTimeLeaderboardPage`
  - `/mo/records` → `MORecordsPage`
- Add KUTC alias route `/kutc/results/:editionId` that redirects to `/kutc/results/:year` (parse `kutc-YYYY`).
- Scaffold MO pages with nb-NO placeholders.
- Gate: Routes render placeholders in test.

### Phase 2 — Seed MO Event Editions (2011–2025) ✅
- Script `scripts/fillMoEventEditions.js` upserts `eventEditions/mo-YYYY` with finalized metadata (status, resultsStatus, resultTypes, timing, URLs).
- Seeded in test and prod; `/mo/results` now lists `mo-2011` … `mo-2025`.

- ✅ `listMoEventEditions()` and overview list wired (`MOResultsOverviewPage.tsx`).
- ✅ `getEditionResults()` with klasse/kjønn/ranking filters; `MOEditionResultsPage.tsx` shows table, CSV export, alle-mot-alle preset (with state), prev/next nav, class-specific UX (trim/tur locks gender & sorts alphabetically).
- ☐ Implement `getRunnerMoResults(userId)` and expose per-runner linking.
- ☐ Add `getEditionMetadata()` helper if needed for header details.
- ☐ Prepare fixtures/test dataset for nb-NO copy and regression tests.
- Gate: Edition results render from Firestore seed with filters + navigation.

### Phase 4 — Time Grading & All-time/Records
- `src/services/timeGradingService.ts`:
  - `adjustTime({ seconds, age, gender, factorType: 'AGG'|'AG'|'GG' })` using `timeGradingFactors/mo-{age}`.
- Extend `moResultsService`:
  - `getAllTimeLeaderboard()` and `getRecords()` (competition-only).
- Implement `MOAllTimeLeaderboardPage.tsx`, `MORecordsPage.tsx`.
- Gate: Unit tests for grading/aggregations.

### Phase 5 — Registration Parity
- Add unified route `/register/:eventId/:editionId`; keep KUTC legacy redirects.
- Update Home/Event pages to use unified route.
- Gate: E2E registration in test.

### Phase 6 — Import Historical MO Results
- `scripts/importMoResults.js`:
  - Parse Excel, map columns → fields.
  - Resolve/create `users` (generated uid if email missing), set `representing`.
  - Compute `timeSeconds`, adjusted values, set status per code list.
  - Dry-run mode, unmatched report, detailed logs.
- Gate: Validate 2–3 editions, then batch import.

### Phase 7 — Adelskalender & Volunteers
- `moVolunteers` collection: `{ editionId, userId?, roles: string[], notes? }`.
- Aggregation for counts per class and totals; show pin milestones.
- Gate: Cross-check against spreadsheet.

## Data Model (MO)
- `eventEditions/{editionId}`: `eventId='mo'`, `name`, `startTime`, `status`, `resultsStatus`, `liveResultsURL?`.
- `moResults/{autoId}`: `editionId`, `userId`, `firstName`, `lastName`, `representing?`, `club?`, `gender: 'Male'|'Female'`, `class`, `status`, `timeSeconds?`, `timeDisplay?`, `birthYear?`, `age?`, `adjustedSeconds?`, `adjustedDisplay?`, `adjustedFactor?`, `rankTime?`, `rankAdjusted?`, `bibNumber?`.
- `timeGradingFactors/{id=mo-{age}}`: `AGG_F`, `AGG_M`, `AG_F`, `AG_M`, `GG_F`, `GG_M`, `age`, `eventId='mo'`.
- `moVolunteers/{autoId}`: `editionId`, `userId?`, `roles: string[]`, `notes?`.
- Indexes (initial): `moResults`: (`editionId`,`class`,`gender`,`rankTime`), (`editionId`,`class`,`rankAdjusted`), (`editionId`,`userId`).

## Testing & QA
- Unit tests for services; integration for pages.
- Manual QA: navigation, nb-NO UI, UID-only links, no PII leaks.
- Rollout: test → validate → prod with rollback plan.
