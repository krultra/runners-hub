# KUTC Results Sync: Admin to RunnersHub

## Overview

This document outlines the architecture and implementation plan for syncing KUTC race results from KrUltraCR Admin (MariaDB) to RunnersHub (Firestore).

## Design Principles

1. **Single Source of Truth**: MariaDB in KrUltraCR Admin is the authoritative source
2. **Corrections via Re-sync**: All corrections are made in MariaDB, then entire edition is re-synced
3. **Purge Before Write**: Previous Firestore data for an edition is deleted before writing new data
4. **No Aggregated Data in Firestore**: All-time leaderboards and aggregations are computed on-demand in RunnersHub
5. **Environment Switching**: Admin can target RunnersHub (prod) or RunnersHubTest

---

## Firestore Data Structure

### 1. Edition Results Collection

**Path**: `kutcResults/{editionId}/races/{raceId}/results/{personId}`

**Example**: `kutcResults/2025/races/4-loops/results/123`

```typescript
interface KUTCResult {
  // Identifiers
  personId: number;              // PK from person table
  bib: string;                   // Race bib number
  
  // Participant info
  firstName: string;
  lastName: string;
  
  // Race info
  raceName: string;              // Display name: "4 loops", "8 loops", etc.
  raceId: number;                // FK to race table
  loopsCompleted: number;        // 4, 8, 12, 16, 20, 24
  
  // Rankings
  finalRank: number | null;      // Overall rank across all distances (null if DNF/DNS)
  raceRank: number | null;       // Rank within this specific distance
  
  // Timing (stored as numbers for querying/sorting)
  finishTime: Timestamp | null;          // Absolute finish datetime
  raceFinishTime: Timestamp | null;      // Race-specific finish datetime
  totalTimeSeconds: number;              // Overall time (e.g., 52345.50)
  raceTimeSeconds: number;               // Race-specific time
  
  // Display strings (pre-calculated for UI)
  totalTimeDisplay: string;      // "14:32:25" (HH:MM:SS)
  raceTimeDisplay: string;       // "3:38:04"
  
  // Status
  status: string;                // "finished" | "dnf" | "dns" | "dq"
  notes: string | null;          // Optional race notes
  
  // Metadata
  publishedAt: Timestamp | null;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

**Why this structure?**
- ✅ Mirrors MariaDB `result` table closely
- ✅ Document ID = `personId` (unique per race)
- ✅ Easy to query by race/distance
- ✅ Easy to purge entire edition
- ✅ Supports sorting by rank or time

### 2. Edition Metadata (Optional)

**Path**: `kutcResults/{editionId}/metadata`

```typescript
interface KUTCEditionMetadata {
  editionId: string;             // "2025"
  year: number;                  // 2025
  eventDate: Timestamp;
  
  // Participation stats
  totalParticipants: number;     // Unique runners across all distances
  totalFinishers: number;        // Runners with status = "finished"
  
  // Distance breakdown (for overview page)
  races: Array<{
    raceId: number;
    raceName: string;            // "4 loops"
    distanceKey: string;         // "4-loops"
    participants: number;
    finishers: number;
  }>;
  
  // Status
  resultsStatus: string;         // "preliminary" | "final"
  publishedAt: Timestamp | null;
  lastSyncedAt: Timestamp;
}
```

**Purpose**: Powers the `/kutc/results/{year}` overview page with summary cards.

---

## All-Time Leaderboard Strategy

### ❌ DO NOT Store in Firestore

**Why?**
- Corrections would require complex updates across multiple documents
- Data integrity risks if sync fails mid-way
- Difficult to verify accuracy vs. source data

### ✅ Calculate On-Demand in RunnersHub

**Query Strategy**:
```typescript
// Fetch ALL results across all years
const allResults = await getDocs(
  collectionGroup(db, 'results')
);

// Group by personId and aggregate in memory
const leaderboard = new Map<number, {
  personId: number,
  firstName: string,
  lastName: string,
  totalLoops: number,
  byYear: Map<string, number>
}>();

allResults.forEach(doc => {
  const result = doc.data() as KUTCResult;
  const entry = leaderboard.get(result.personId) || {
    personId: result.personId,
    firstName: result.firstName,
    lastName: result.lastName,
    totalLoops: 0,
    byYear: new Map()
  };
  
  entry.totalLoops += result.loopsCompleted;
  const yearLoops = entry.byYear.get(editionId) || 0;
  entry.byYear.set(editionId, yearLoops + result.loopsCompleted);
  
  leaderboard.set(result.personId, entry);
});

// Sort by totalLoops descending
const sorted = Array.from(leaderboard.values())
  .sort((a, b) => b.totalLoops - a.totalLoops);
```

**Performance Considerations**:
- With ~200 results per year × 5 years = ~1000 documents
- Firestore read: ~1000 document reads
- Client-side aggregation: <50ms
- **Acceptable** for current scale
- Can cache results in-memory for session if needed

**Future Optimization** (if dataset grows >10K results):
- Use Cloud Function to pre-calculate monthly
- Store in single document with timestamp
- Re-calculate on admin sync

---

## Sync Implementation Plan

### High-Level Flow

```
1. Admin: User clicks "Generate Results" → MariaDB `result` table populated
2. Admin: User clicks "Sync to RunnersHub" → Firestore sync triggered
3. Admin: Select environment (Production or Test)
4. Sync Process:
   a. Validate MariaDB data completeness
   b. PURGE existing Firestore data for edition
   c. Batch write new results to Firestore
   d. Write metadata document
   e. Verify sync success
```

### Components Needed

#### 1. **Admin Environment Configuration**

**File**: `krultra-admin/config/firebase.ts`

```typescript
interface FirebaseConfig {
  projectId: string;
  serviceAccountPath: string;
}

const configs: Record<'production' | 'test', FirebaseConfig> = {
  production: {
    projectId: 'runnershub-62442',
    serviceAccountPath: process.env.FIREBASE_SA_PROD || 
      '~/.secrets/runners-hub/prod-service-account.json'
  },
  test: {
    projectId: 'runnershubtest',
    serviceAccountPath: process.env.FIREBASE_SA_TEST || 
      '~/.secrets/runners-hub/test-service-account.json'
  }
};

export function getFirebaseConfig(env: 'production' | 'test'): FirebaseConfig {
  return configs[env];
}
```

**UI Component**: Toggle/dropdown in admin to select target environment

#### 2. **Purge Function**

**File**: `krultra-admin/services/firebaseSync.ts`

```typescript
import { getFirestore } from 'firebase-admin/firestore';

/**
 * Purges all results for a specific edition from Firestore
 * Deletes all documents in kutcResults/{editionId}/races/*/results/*
 */
async function purgeEditionResults(
  db: FirebaseFirestore.Firestore, 
  editionId: string
): Promise<void> {
  console.log(`Purging existing results for edition: ${editionId}`);
  
  const editionRef = db.collection('kutcResults').doc(editionId);
  const racesSnap = await editionRef.collection('races').get();
  
  if (racesSnap.empty) {
    console.log('No existing data to purge');
    return;
  }
  
  let deleteCount = 0;
  const batchSize = 500; // Firestore limit
  
  for (const raceDoc of racesSnap.docs) {
    const resultsSnap = await raceDoc.ref.collection('results').get();
    
    if (resultsSnap.empty) continue;
    
    // Delete in batches
    for (let i = 0; i < resultsSnap.docs.length; i += batchSize) {
      const batch = db.batch();
      const chunk = resultsSnap.docs.slice(i, i + batchSize);
      
      chunk.forEach(doc => {
        batch.delete(doc.ref);
        deleteCount++;
      });
      
      await batch.commit();
      console.log(`Deleted ${chunk.length} results from ${raceDoc.id}`);
    }
    
    // Delete the race document itself
    await raceDoc.ref.delete();
  }
  
  // Delete metadata if exists
  const metadataRef = editionRef.collection('metadata').doc('summary');
  await metadataRef.delete().catch(() => {}); // Ignore if doesn't exist
  
  console.log(`Purge complete. Deleted ${deleteCount} result documents`);
}
```

#### 3. **Sync Function**

**File**: `krultra-admin/services/firebaseSync.ts`

```typescript
interface MariaDBResult {
  id: number;
  event_edition_id: string;
  person_id: number;
  race_id: number;
  bib: string;
  first_name: string;
  last_name: string;
  race_name: string;
  final_rank: number | null;
  race_rank: number | null;
  loops_completed: number;
  finish_time: Date | null;
  race_finish_time: Date | null;
  total_time_seconds: number;
  race_time_seconds: number;
  status: string;
  notes: string | null;
  published_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

/**
 * Syncs results from MariaDB to Firestore
 */
async function syncResultsToFirestore(
  editionId: string,
  environment: 'production' | 'test'
): Promise<{ success: boolean; resultCount: number; error?: string }> {
  try {
    // 1. Initialize Firestore with selected environment
    const config = getFirebaseConfig(environment);
    const firebaseApp = initializeFirebaseApp(config);
    const db = getFirestore(firebaseApp);
    
    console.log(`Syncing to ${environment}: ${config.projectId}`);
    
    // 2. Fetch results from MariaDB
    const results = await fetchResultsFromMariaDB(editionId);
    
    if (results.length === 0) {
      throw new Error(`No results found for edition: ${editionId}`);
    }
    
    console.log(`Fetched ${results.length} results from MariaDB`);
    
    // 3. PURGE existing data
    await purgeEditionResults(db, editionId);
    
    // 4. Group results by race
    const resultsByRace = groupBy(results, 'race_id');
    
    // 5. Prepare metadata
    const metadata = calculateMetadata(editionId, results, resultsByRace);
    
    // 6. Batch write to Firestore
    let writeCount = 0;
    const batchSize = 500;
    
    for (const [raceId, raceResults] of Object.entries(resultsByRace)) {
      const raceName = raceResults[0].race_name; // e.g., "4 loops"
      const raceKey = raceName.toLowerCase().replace(/\s+/g, '-'); // "4-loops"
      
      console.log(`Writing ${raceResults.length} results for ${raceName}`);
      
      // Batch write results
      for (let i = 0; i < raceResults.length; i += batchSize) {
        const batch = db.batch();
        const chunk = raceResults.slice(i, i + batchSize);
        
        chunk.forEach(result => {
          const docRef = db
            .collection('kutcResults')
            .doc(editionId)
            .collection('races')
            .doc(raceKey)
            .collection('results')
            .doc(String(result.person_id));
          
          batch.set(docRef, {
            personId: result.person_id,
            bib: result.bib,
            firstName: result.first_name,
            lastName: result.last_name,
            raceName: result.race_name,
            raceId: result.race_id,
            loopsCompleted: result.loops_completed,
            finalRank: result.final_rank,
            raceRank: result.race_rank,
            finishTime: result.finish_time ? 
              Timestamp.fromDate(result.finish_time) : null,
            raceFinishTime: result.race_finish_time ? 
              Timestamp.fromDate(result.race_finish_time) : null,
            totalTimeSeconds: result.total_time_seconds,
            raceTimeSeconds: result.race_time_seconds,
            totalTimeDisplay: formatSeconds(result.total_time_seconds),
            raceTimeDisplay: formatSeconds(result.race_time_seconds),
            status: result.status,
            notes: result.notes,
            publishedAt: result.published_at ? 
              Timestamp.fromDate(result.published_at) : null,
            createdAt: Timestamp.fromDate(result.created_at),
            updatedAt: Timestamp.fromDate(result.updated_at)
          });
          
          writeCount++;
        });
        
        await batch.commit();
        console.log(`Committed batch ${Math.floor(i / batchSize) + 1}`);
      }
    }
    
    // 7. Write metadata
    const metadataRef = db
      .collection('kutcResults')
      .doc(editionId)
      .collection('metadata')
      .doc('summary');
    
    await metadataRef.set(metadata);
    console.log('Metadata written');
    
    // 8. Success
    console.log(`Sync complete: ${writeCount} results written to ${environment}`);
    
    return {
      success: true,
      resultCount: writeCount
    };
    
  } catch (error) {
    console.error('Sync failed:', error);
    return {
      success: false,
      resultCount: 0,
      error: error.message
    };
  }
}

// Helper: Format seconds to HH:MM:SS
function formatSeconds(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  return `${hours}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

// Helper: Calculate metadata from results
function calculateMetadata(
  editionId: string, 
  allResults: MariaDBResult[],
  resultsByRace: Record<string, MariaDBResult[]>
): KUTCEditionMetadata {
  const uniqueRunners = new Set(allResults.map(r => r.person_id)).size;
  const finishers = allResults.filter(r => r.status === 'finished').length;
  
  const races = Object.entries(resultsByRace).map(([raceId, results]) => ({
    raceId: parseInt(raceId),
    raceName: results[0].race_name,
    distanceKey: results[0].race_name.toLowerCase().replace(/\s+/g, '-'),
    participants: results.length,
    finishers: results.filter(r => r.status === 'finished').length
  }));
  
  // Sort races by loops (extract number from race name)
  races.sort((a, b) => {
    const loopsA = parseInt(a.raceName.match(/\d+/)?.[0] || '0');
    const loopsB = parseInt(b.raceName.match(/\d+/)?.[0] || '0');
    return loopsA - loopsB;
  });
  
  return {
    editionId,
    year: parseInt(editionId),
    eventDate: Timestamp.fromDate(new Date(parseInt(editionId), 0, 1)), // Placeholder
    totalParticipants: uniqueRunners,
    totalFinishers: finishers,
    races,
    resultsStatus: allResults.some(r => r.published_at) ? 'final' : 'preliminary',
    publishedAt: allResults.find(r => r.published_at)?.published_at ? 
      Timestamp.fromDate(allResults.find(r => r.published_at)!.published_at!) : null,
    lastSyncedAt: Timestamp.now()
  };
}
```

#### 4. **Admin UI Integration**

**Workflow in Admin Panel**:

```
┌─────────────────────────────────────┐
│   Results Management for KUTC-2025  │
├─────────────────────────────────────┤
│                                     │
│  Step 1: Generate Results           │
│  ☑ Results generated to MariaDB     │
│  Last run: 2025-10-17 14:32         │
│                                     │
│  [Re-generate Results]              │
│                                     │
├─────────────────────────────────────┤
│                                     │
│  Step 2: Sync to RunnersHub         │
│                                     │
│  Target Environment:                │
│  ○ Test (runnershubtest)            │
│  ● Production (runnershub-62442)    │
│                                     │
│  ⚠ Warning: This will delete        │
│  existing results for this edition  │
│  and replace with current data.     │
│                                     │
│  [Sync to Firestore]                │
│                                     │
│  Last sync: Not synced              │
│                                     │
└─────────────────────────────────────┘
```

**Button Handler**:
```typescript
async function handleSyncToFirestore() {
  const confirmed = confirm(
    'This will delete existing results for KUTC-2025 and sync new data. Continue?'
  );
  
  if (!confirmed) return;
  
  setLoading(true);
  
  const result = await syncResultsToFirestore('2025', selectedEnvironment);
  
  if (result.success) {
    alert(`Success! Synced ${result.resultCount} results to ${selectedEnvironment}`);
  } else {
    alert(`Sync failed: ${result.error}`);
  }
  
  setLoading(false);
}
```

---

## Firestore Security Rules

Add to `firestore.rules`:

```javascript
// KUTC Results - read-only for public
match /kutcResults/{editionId}/races/{raceId}/results/{personId} {
  allow read: if true;
  allow write: if isAdmin();
}

match /kutcResults/{editionId}/metadata/{doc} {
  allow read: if true;
  allow write: if isAdmin();
}
```

---

## Testing Strategy

### Phase 1: Test Environment
1. Generate results in Admin for KUTC-2025 (or test data)
2. Select "Test" environment
3. Click "Sync to Firestore"
4. Verify in Firebase Console (RunnersHubTest):
   - `kutcResults/2025/races/4-loops/results/*` exists
   - `kutcResults/2025/metadata/summary` exists
   - Document counts match MariaDB
5. Test RunnersHub frontend against test data

### Phase 2: Corrections Test
1. Make corrections in MariaDB
2. Re-generate results
3. Re-sync to Test (should purge + replace)
4. Verify corrections appear in frontend

### Phase 3: Production
1. Final verification in test
2. Switch to "Production" environment
3. Sync to production Firestore
4. Monitor for errors

---

## Error Handling

### Sync Failures Mid-Process
- **Problem**: Batch write fails after purge → partial data in Firestore
- **Solution**: 
  - Transaction-like approach: Write to temp collection first
  - Only swap/promote after full success
  - OR: Accept that re-running sync will fix (simpler)

### Validation Checks
Before sync, validate:
- [ ] All results have `person_id`
- [ ] All results have `race_id`
- [ ] No duplicate `person_id` per race
- [ ] `loops_completed` is valid (4, 8, 12, 16, 20, 24)
- [ ] Times are reasonable (not negative, not absurdly large)

### Logging
- Log every major step to console + file
- Track batch commits with counts
- Summary report at end (documents written, time taken)

---

## Future Enhancements

1. **Incremental Sync**: Only sync changed results (compare `updated_at`)
2. **Rollback Capability**: Keep previous version for X days
3. **Dry-Run Mode**: Preview changes without committing
4. **Progress Bar**: Real-time sync progress in UI
5. **Webhook**: Notify on sync completion
6. **Audit Log**: Track who synced what and when

---

## Summary

| Aspect | Decision |
|--------|----------|
| **Data Structure** | Mirror MariaDB schema in Firestore |
| **Corrections** | Re-sync entire edition from MariaDB |
| **Purge Strategy** | Delete all edition results before write |
| **All-Time Data** | Calculate on-demand in RunnersHub (not stored) |
| **Environment** | Configurable prod/test with service account switch |
| **Batch Size** | 500 documents per batch (Firestore limit) |
| **Validation** | Pre-sync checks + post-sync verification |

**Next Steps**: Review this plan, then implement sync function in KrUltraCR Admin.
