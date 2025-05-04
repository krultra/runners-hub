import * as functions from 'firebase-functions';
import admin, { db } from '../utils/admin';

// Helper to pad bib numbers to 3 digits
const padBib = (bib: number): string => bib.toString().padStart(3, '0');

// Parses a time string (e.g. "12:34.5" or "1:02:03.4") and returns total seconds (rounded to one tenth)
function parseTime(timeStr: string): number {
  const parts = timeStr.split(':').map(s => s.trim());
  let seconds = 0;
  if (parts.length === 2) {
    // mm:ss.t
    const m = Number(parts[0]);
    const s = Number(parts[1]);
    seconds = m * 60 + s;
  } else if (parts.length === 3) {
    // hh:mm:ss.t
    const h = Number(parts[0]);
    const m = Number(parts[1]);
    const s = Number(parts[2]);
    seconds = h * 3600 + m * 60 + s;
  } else {
    seconds = Number(timeStr);
  }
  return Math.round(seconds * 10) / 10;
}

/**
 * Trigger: calculate age-graded and age&gender-graded times on moTiming create/update
 */
export const calculateGradedTimes = functions.firestore
  .document('moTiming/{docId}')
  .onWrite(async (change, context) => {
    const after = change.after;
    if (!after.exists) return null; // document deleted
    const data = after.data();
    if (!data) return null;

    const bib = Number(data.bib);
    const totalTimeStr = data.totalTime;
    const eventId = data.eventId;
    if (!bib || !totalTimeStr || !eventId) return null;

    // Lookup registration for this bib
    const regId = `mo-2025-${padBib(bib)}`;
    const regDoc = await db.collection('moRegistrations').doc(regId).get();
    if (!regDoc.exists) return null;
    const reg = regDoc.data();
    if (!reg?.dateOfBirth || !reg?.gender) return null;

    // Calculate age as age reached this year
    const dob: string = reg.dateOfBirth;
    const yearMatch = dob.match(/(\d{4})$/);
    if (!yearMatch) return null;
    const birthYear = Number(yearMatch[1]);
    const age = new Date().getFullYear() - birthYear;

    // Lookup grading factors
    const factorDoc = await db.collection('timeGradingFactors').doc(`mo-${age}`).get();
    if (!factorDoc.exists) return null;
    const f = factorDoc.data() as any;
    const gender = reg.gender;
    const agFactor = gender === 'F' ? Number(f.AG_F) : Number(f.AG_M);
    const aggFactor = gender === 'F' ? Number(f.AGG_F) : Number(f.AGG_M);

    // Parse time and compute graded times
    const totalSeconds = parseTime(totalTimeStr);
    const updateData: any = {};

    // Check eventEdition for resultTypes
    const editionDoc = await db.collection('eventEditions').doc(eventId).get();
    const types = editionDoc.exists ? (editionDoc.data()?.resultTypes as string[]) : [];
    if (types.includes('AG')) {
      updateData.totalAGTime = Math.round(totalSeconds * agFactor * 10) / 10;
    }
    if (types.includes('AGG')) {
      updateData.totalAGGTime = Math.round(totalSeconds * aggFactor * 10) / 10;
    }

    if (Object.keys(updateData).length === 0) return null;
    await after.ref.set(updateData, { merge: true });
    return null;
  });
