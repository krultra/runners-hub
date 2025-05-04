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

// Formats seconds into human-readable 'h:mm:ss.s' or 'mm:ss.s'
function formatTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const rem = seconds - h * 3600;
  const m = Math.floor(rem / 60);
  const s = rem - m * 60;
  const secRounded = Math.round(s * 10) / 10;
  const integerSec = Math.floor(secRounded);
  const dec = Math.round((secRounded - integerSec) * 10);
  const secStr = integerSec.toString().padStart(2,'0') + '.' + dec;
  const minStr = m.toString().padStart(2,'0');
  return h > 0 ? `${h}:${minStr}:${secStr}` : `${minStr}:${secStr}`;
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
    const totalTimeField = data.totalTime;
    const eventId = data.eventId;
    // Handle human-readable or object totalTime
    let totalTimeStr: string;
    let totalSeconds: number;
    if (totalTimeField && typeof totalTimeField === 'object' && 'seconds' in totalTimeField) {
      totalSeconds = (totalTimeField as any).seconds;
      totalTimeStr = (totalTimeField as any).display;
    } else {
      totalTimeStr = String(totalTimeField);
      totalSeconds = parseTime(totalTimeStr);
    }
    console.log(`[calculateGradedTimes] bib=${bib}, totalTimeStr=${totalTimeStr}, eventId=${eventId}`);
    if (!bib || !totalTimeStr || !eventId) return null;

    // Lookup registration by editionId and registrationNumber
    const regSnap = await db.collection('moRegistrations')
      .where('editionId', '==', eventId)
      .where('registrationNumber', '==', bib)
      .limit(1)
      .get();
    if (regSnap.empty) return null;
    const regDoc = regSnap.docs[0];
    const reg = regDoc.data() as any;
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

    // totalSeconds already parsed above
    const updateData: any = {};

    // Check eventEdition for resultTypes
    const editionDoc = await db.collection('eventEditions').doc(eventId).get();
    const types = editionDoc.exists ? (editionDoc.data()?.resultTypes as string[]) : [];
    if (types.includes('AG')) {
      const agSec = Math.round(totalSeconds * agFactor * 10) / 10;
      updateData.totalAGTime = [formatTime(agSec), agSec];
    }
    if (types.includes('AGG')) {
      const aggSec = Math.round(totalSeconds * aggFactor * 10) / 10;
      updateData.totalAGGTime = [formatTime(aggSec), aggSec];
    }

    if (Object.keys(updateData).length === 0) return null;
    console.log('[calculateGradedTimes] updateData to write:', updateData);
    await after.ref.set(updateData, { merge: true });
    return null;
  });
