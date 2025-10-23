# KUTC Event Setup - Distance and Ascent Calculation

## Overview

The checkpoint service now calculates total distance and ascent based on the number of loops completed and the event's loop distance/ascent values.

---

## Required Firestore Data

### Add to `events/kutc` document:

```javascript
{
  id: "kutc",
  name: "Kruke's Ultra-Trail Challenge",
  shortName: "KUTC",
  loopDistance: 6.8,  // Distance per loop in kilometers
  loopAscent: 120,    // Elevation gain per loop in meters
  // ... other existing fields
}
```

---

## How It Works

### 1. **Distance/Ascent Calculation**

For each checkpoint result:
- `cumulativeDistance` = (completed loops) × `loopDistance`
- `cumulativeAscent` = (completed loops) × `loopAscent`

Example for a runner in loop 3:
- Before loop 3 starts: 2 loops completed
- `cumulativeDistance` = 2 × 6.8 = 13.6 km
- `cumulativeAscent` = 2 × 120 = 240 m

### 2. **Total Stats**

For summary statistics:
- `totalDistance` = (number of loops) × `loopDistance`
- `totalAscent` = (number of loops) × `loopAscent`

Example for runner who completed 6 loops:
- `totalDistance` = 6 × 6.8 = 40.8 km
- `totalAscent` = 6 × 120 = 720 m

### 3. **Pace & Speed Calculation**

With distance data available:
- `averagePace` = (total moving time in minutes) / total distance
- `averageSpeed` = total distance / (total moving time in hours)

---

## Adding Loop Data to Firestore

### Via Firebase Console:

1. Go to Firestore Database
2. Navigate to `events` collection
3. Select `kutc` document
4. Click "Edit" or add fields:
   - Field: `loopDistance`, Type: number, Value: `6.8`
   - Field: `loopAscent`, Type: number, Value: `120`
5. Save

### Via Firebase Admin SDK (Script):

```javascript
const admin = require('firebase-admin');
const db = admin.firestore();

await db.collection('events').doc('kutc').update({
  loopDistance: 6.8,
  loopAscent: 120
});
```

---

## Verification

After adding the loop data:

1. Navigate to test page: `/test/checkpoint`
2. Enter event: `kutc-2025`
3. Enter a valid user ID
4. Click "Test"
5. Check that:
   - Total Distance shows value (not "N/A")
   - Total Ascent shows value (not "N/A")
   - Average Pace shows value (not "-")
   - Loop aggregates show distance and ascent per loop

---

## Example Console Output (Success):

```
Testing checkpoint service...
Event: kutc-2025
User: abc123

1. Fetching raw checkpoint results...
✓ Found 42 checkpoint results

2. Fetching enriched checkpoint results...
✓ Enriched 42 checkpoint results
First enriched checkpoint: {
  cumulativeDistance: 0,      // Loop 1 start
  cumulativeAscent: 0,
  ...
}

3. Grouping by loop...
✓ Found 6 loops
Loop aggregates: [
  {
    loopNumber: 1,
    totalDistance: 6.8,
    totalAscent: 120,
    averagePaceMinPerKm: 7.5,
    ...
  },
  ...
]

4. Generating summary...
✓ Summary generated
Summary: {
  totalDistance: 40.8,
  totalAscent: 720,
  averagePaceMinPerKm: 8.2,
  ...
}
```

---

## Notes

- Loop distance and ascent values are for **KUTC events only**
- Other events (like Malvikingen Opp) will use different data structures
- Values should match the actual race course measurements
- If loop data is not available, distance/ascent will show as "N/A" but timing data will still work

---

## Current KUTC Values

Based on typical KUTC setup:
- **Loop Distance**: ~6.8 km (verify with actual course data)
- **Loop Ascent**: ~120 m (verify with actual course data)

**⚠️ Important**: Update these values with actual measured course data for accuracy.
