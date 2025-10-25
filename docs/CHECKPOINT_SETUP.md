# Checkpoint Results Service - Testing & Setup Guide

## Overview

This guide covers how to test the checkpoint results service and configure Firestore rules and indexes.

---

## 1. Testing the Service

### 1.1 Access the Test Page

Navigate to: **http://localhost:3000/test/checkpoint** (only available in non-production)

### 1.2 Find a User ID to Test With

You need a valid `userId` from a user who has checkpoint results. Here are two ways to find one:

**Option A: From Firestore Console**
1. Go to Firestore Console → `checkpointResults` collection
2. Pick any document
3. Copy the `userId` field value

**Option B: From Users Collection**
1. Go to Firestore Console → `users` collection
2. Find a user with a `personId` field (indicates they competed in KUTC)
3. Copy the document ID (this is the `userId`)

### 1.3 Run the Test

1. Enter event edition ID: `kutc-2025`
2. Enter the user ID you found
3. Click "Test" button
4. **Open Browser Console** (F12) to see detailed logs

### 1.4 What to Look For

**✅ Success indicators:**
- Summary card displays with participant name, bib, race info
- Loop aggregates show for each loop
- Performance insights display (fastest/slowest leg, biggest gain/loss)
- Console shows: "✓ All tests passed!"

**❌ Error indicators:**
- Error message appears at the top
- Console shows error details
- Common issues:
  - "No checkpoint results found" → User ID doesn't exist or has no checkpoints
  - Permission denied → Firestore rules not set up
  - Missing index → Indexes not created

### 1.5 Console Output

The test will log:
```
Testing checkpoint service...
Event: kutc-2025
User: abc123userId

1. Fetching raw checkpoint results...
✓ Found 42 checkpoint results
First checkpoint: {...}

2. Fetching enriched checkpoint results...
✓ Enriched 42 checkpoint results
First enriched checkpoint: {...}

3. Grouping by loop...
✓ Found 6 loops
Loop aggregates: [...]

4. Generating summary...
✓ Summary generated
Summary: {...}

✓ All tests passed!
```

---

## 2. Firestore Security Rules

### 2.1 Add Rules for checkpointResults

Add these rules to your `firestore.rules` file:

```javascript
match /checkpointResults/{documentId} {
  // Public read access (data is public during races anyway)
  allow read: if true;
  
  // Only admins can write
  allow write: if request.auth != null && 
                  request.auth.token.admin == true;
}
```

### 2.2 Deploy Rules

**Via Firebase Console:**
1. Go to Firebase Console → Firestore Database
2. Click "Rules" tab
3. Add the checkpoint rules to your existing rules
4. Click "Publish"

**Via Firebase CLI:**
```bash
firebase deploy --only firestore:rules
```

### 2.3 Verify Rules

Test in the Firebase Console:
1. Go to Rules tab
2. Click "Rules Playground"
3. Test query:
   - Operation: `get`
   - Collection: `checkpointResults`
   - Document ID: (any)
   - Should show: ✅ Read allowed

---

## 3. Firestore Indexes

### 3.1 Required Indexes

**Index 1: Query by event and user**
- Collection: `checkpointResults`
- Fields:
  - `eventEditionId` (Ascending)
  - `userId` (Ascending)
  - `sequenceNumber` (Ascending)

**Index 2: Query all checkpoints in an event**
- Collection: `checkpointResults`
- Fields:
  - `eventEditionId` (Ascending)
  - `sequenceNumber` (Ascending)

**Index 3: Query all checkpoints for a user across events**
- Collection: `checkpointResults`
- Fields:
  - `userId` (Ascending)
  - `eventEditionId` (Ascending)
  - `sequenceNumber` (Ascending)

### 3.2 Create Indexes

**Automatic (Recommended):**
1. Run the test page with a valid user ID
2. Firestore will display an error with a link to create the index
3. Click the link → Firebase Console opens with index pre-configured
4. Click "Create Index"
5. Wait 2-5 minutes for index to build
6. Refresh and try again

**Manual via Firebase Console:**
1. Go to Firebase Console → Firestore Database
2. Click "Indexes" tab
3. Click "Create Index"
4. Enter the field combinations listed above
5. Click "Create"

**Via firestore.indexes.json:**
1. Copy the contents from `firestore-indexes-checkpoint.json`
2. Merge with your existing `firestore.indexes.json`
3. Deploy:
   ```bash
   firebase deploy --only firestore:indexes
   ```

### 3.3 Check Index Status

In Firebase Console → Firestore → Indexes tab:
- ✅ Green dot = Index ready
- ⏳ Orange dot = Index building (wait a few minutes)
- ❌ Red dot = Index failed (check configuration)

---

## 4. Troubleshooting

### Error: "Missing or insufficient permissions"

**Cause:** Firestore rules not deployed

**Fix:**
1. Add checkpoint rules to `firestore.rules`
2. Deploy rules via console or CLI
3. Refresh test page

### Error: "The query requires an index"

**Cause:** Composite index not created

**Fix:**
1. Click the link in the error message (opens Firebase Console)
2. Click "Create Index"
3. Wait for index to build (2-5 min)
4. Refresh test page

### Error: "No checkpoint results found"

**Cause:** User has no checkpoint data or doesn't exist

**Fix:**
1. Verify the user ID exists in Firestore users collection
2. Check that checkpoint results exist for this user:
   - Go to checkpointResults collection
   - Filter: `userId == "yourUserId"`
3. Try a different user ID

### Error: "Cannot read properties of undefined"

**Cause:** Data format mismatch or missing fields

**Fix:**
1. Check console logs for which field is undefined
2. Verify checkpoint data in Firestore has all required fields
3. Check that timestamps are Firestore Timestamp objects (not strings)

### Console shows conversion/calculation errors

**Cause:** Null or invalid data in calculations

**Fix:**
- Service handles null values gracefully
- Check that `legDistance`, `legTimeSeconds` are numeric when present
- Verify timestamps are valid Firestore Timestamp objects

---

## 5. Data Validation

### 5.1 Check Data Structure

Sample checkpoint result document should look like:

```javascript
{
  id: "kutc-2025___userId123___42",
  eventEditionId: "kutc-2025",
  userId: "userId123",
  personId: 123,
  raceId: 1,
  bib: "42",
  firstName: "John",
  lastName: "Doe",
  raceName: "50km",
  raceDistance: 50,
  checkpointId: 1,
  checkpointName: "Start",
  isStartCp: true,
  isFinishCp: false,
  loopNumber: 1,
  sequenceNumber: 42,
  scanTime: Timestamp(...),
  adjustedScanTime: Timestamp(...),
  legTimeSeconds: 2723.5,
  loopTimeSeconds: null,
  cumulativeTimeSeconds: 2723.5,
  restTimeSeconds: 0,
  racePosition: 12,
  racePositionChange: 3,
  overallPosition: 12,
  overallPositionChange: 3,
  legDistance: 6.8,           // Optional but recommended
  legAscent: 120,             // Optional but recommended
  cumulativeDistance: 6.8,    // Optional but recommended
  cumulativeAscent: 120,      // Optional but recommended
  createdAt: Timestamp(...),
  updatedAt: Timestamp(...)
}
```

### 5.2 Common Data Issues

**Issue:** Times show as "-" or "N/A"
- Check: `legTimeSeconds`, `cumulativeTimeSeconds` are numbers (not null/undefined)
- Check: Values are in seconds (not milliseconds)

**Issue:** Pace/speed shows as "-"
- Check: `legDistance` and `cumulativeDistance` fields exist
- Check: Distance values are in kilometers (not meters)

**Issue:** Loop aggregation fails
- Check: All checkpoints have `loopNumber` field
- Check: Loop numbers are sequential (1, 2, 3, ...)

---

## 6. Performance Tips

### 6.1 Query Optimization

- ✅ Queries are indexed and should be fast (<200ms)
- ✅ Checkpoint count per runner is small (~500 max for KUTC)
- ✅ No pagination needed for single runner queries

### 6.2 Caching Strategy

Consider caching checkpoint results:
```javascript
// In React component
const [checkpoints, setCheckpoints] = useState([]);

useEffect(() => {
  // Cache results in state
  getEnrichedCheckpointResults(eventId, userId)
    .then(setCheckpoints);
}, [eventId, userId]);
```

### 6.3 Real-time Updates (Future)

If you need real-time updates during races:
```javascript
import { onSnapshot } from 'firebase/firestore';

// Subscribe to changes
const unsubscribe = onSnapshot(
  query(checkpointResults, where('userId', '==', userId)),
  (snapshot) => {
    // Update UI with new checkpoints
  }
);
```

---

## 7. Next Steps

Once testing is successful:

✅ **Phase 2 Complete!** Checkpoint service is working

**Phase 3: Runner Search Page**
- Create search page
- Query users collection
- Display search results
- Link to runner profiles

**Phase 4: Runner Profile Page**
- Display runner info
- Show KUTC statistics
- List all editions participated in
- Link to checkpoint analysis

**Phase 5: Checkpoint Analysis Page**
- Display checkpoint-by-checkpoint breakdown
- Group by loops
- Show performance insights
- Mobile-responsive multi-row layout

---

## Summary Checklist

- [ ] Test page accessible at `/test/checkpoint`
- [ ] Firestore rules deployed for `checkpointResults` collection
- [ ] All 3 required indexes created and built
- [ ] Test runs successfully with sample user
- [ ] Console shows "✓ All tests passed!"
- [ ] Summary card displays correctly
- [ ] Loop aggregates show for each loop
- [ ] Performance insights display

Once all checkboxes are complete, you're ready for Phase 3! 🚀
