# KUTC Results Debugging Guide

## ✅ FIXED: Document ID Issue
**Problem**: Code was looking for `kutc-kutc-2025` instead of `kutc-2025`
**Solution**: Fixed double prefix in `kutcResultsService.ts` - now uses docSnap.id directly

## Remaining Issues to Verify
1. **Date shows 1 Jan YYYY** - Need to verify `eventEditions/kutc-2025.startTime` has correct date
2. **Status shows "Preliminary Results"** - Need to verify `eventEditions/kutc-2025.resultsStatus` is set to "final" 
3. **DNF/DNS always 0** - Need to populate `kutcResults/{year}/metadata.totalDNF` and `totalDNS` fields

## How the System Works

### Data Flow
```
kutcResults/{year}/metadata/summary OR kutcResults/{year}.metadata
  ↓
normalizeEditionMetadata() creates base metadata
  ↓
Try to enrich from eventEditions/kutc-{year}
  - Get startTime → eventDate
  - Get resultsStatus → resultsStatus
  ↓
Look up verbose name from codeLists
  - object='results', type='status', code=resultsStatus
  ↓
Display on cards
```

## What to Check

### 1. Browser Console Logs
Open `/kutc/results` and check console for logs like:
```
[KUTC] Normalized metadata for 2025: { ... }
[KUTC] Attempting to fetch eventEdition: kutc-2025
[KUTC] EventEdition found for kutc-2025: { startTime: ..., resultsStatus: ... }
[KUTC] Updating eventDate from ... to ...
[KUTC] Getting verbose name for resultsStatus: final
[KUTC] Verbose name for 'final': Final Results
```

**If you see errors** like:
- `Error fetching eventEdition` → The `eventEditions/kutc-{year}` document doesn't exist
- `Failed to get verbose name` → The codeList entry doesn't exist

### 2. Firestore Data Verification

#### Check eventEditions Document
```
Collection: eventEditions
Document ID: kutc-2025

Expected fields:
{
  startTime: Timestamp (should be the actual event date, not Jan 1)
  resultsStatus: "final" (or "preliminary", "unknown", etc.)
  eventId: "kutc"
  edition: 2025
  ...
}
```

#### Check kutcResults Metadata
```
Collection: kutcResults
Document ID: 2025

Expected structure (one of these):
Option 1 - Direct in document:
{
  metadata: {
    totalParticipants: 123,
    totalFinishers: 100,
    totalDNF: 20,
    totalDNS: 3,
    resultsStatus: "preliminary",
    eventDate: Timestamp,
    ...
  }
}

Option 2 - In subcollection:
kutcResults/2025/metadata/summary
{
  totalParticipants: 123,
  totalFinishers: 100,
  totalDNF: 20,
  totalDNS: 3,
  resultsStatus: "preliminary",
  eventDate: Timestamp,
  ...
}
```

#### Check codeLists
```
Collection: codeLists
Query: where('object', '==', 'results') AND where('type', '==', 'status')

Expected documents:
{
  object: 'results',
  type: 'status',
  code: 'unknown',
  verboseName: 'Unknown',
  sortOrder: 0
}
{
  object: 'results',
  type: 'status',
  code: 'preliminary',
  verboseName: 'Preliminary Results',
  sortOrder: 5
}
{
  object: 'results',
  type: 'status',
  code: 'final',
  verboseName: 'Final Results',
  sortOrder: 7
}
```

## Common Fixes

### Fix 1: eventEditions Document Missing
If `kutc-2025` doesn't exist in `eventEditions`, create it with minimal fields:
```json
{
  "eventId": "kutc",
  "edition": 2025,
  "eventName": "KUTC 2025",
  "startTime": <Timestamp for actual event date>,
  "resultsStatus": "final"
}
```

### Fix 2: DNF/DNS Not in Metadata
The Python sync script should populate `totalDNF` and `totalDNS` when syncing results.
Check if these fields exist in the kutcResults metadata.

### Fix 3: CodeList Missing
Add entries to `codeLists` collection for all valid result statuses.

## Expected Behavior After Fixes

For **kutc-2025** with:
- `eventEditions/kutc-2025.startTime` = June 14, 2025
- `eventEditions/kutc-2025.resultsStatus` = "final"
- `kutcResults/2025/metadata.totalDNF` = 15
- `kutcResults/2025/metadata.totalDNS` = 5
- `codeLists` entry with code="final" and verboseName="Final Results"

The card should show:
```
2025
14 Jun 2025
120 participants
100 finishers, 15 DNF, 5 DNS
[Final Results] (green chip)
```
