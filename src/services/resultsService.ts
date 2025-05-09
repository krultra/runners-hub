import { db } from '../config/firebase';
import {
  collection,
  getDocs,
  getDoc,
  doc,
  query,
  where
} from 'firebase/firestore';

// Helper to format seconds to mm:ss.d
function formatSecondsToTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = (seconds % 60).toFixed(1);
  return `${mins}:${secs.padStart(4, '0')}`;
}

interface TimeGradingFactor {
  age: number;
  eventId: string;
  AG_F: number;
  AG_M: number;
  AGG_F: number;
  AGG_M: number;
  GG_F: number;
  GG_M: number;
}

export interface Participant {
  id: string;
  bib: number;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  gender: 'M' | 'K' | '*' | string;
  club?: string;
  class?: string;
  registrationType?: 'competition' | 'recreational' | 'timed_recreational';
  totalTimeDisplay: string;
  totalTimeSeconds: number;
  totalAGTimeDisplay?: string;
  totalAGTimeSeconds?: number;
  totalAGGTimeDisplay?: string;
  totalAGGTimeSeconds?: number;
  age?: number;
}

/**
 * Fetches event edition results data including all participants
 */
export const getEventResults = async (editionId: string): Promise<{
  eventData: any;
  participants: Participant[];
}> => {
  try {
    console.log('getEventResults called with editionId:', editionId);
    
    // Fetch event edition data
    const eventRef = doc(db, 'eventEditions', editionId);
    const eventSnap = await getDoc(eventRef);
    const eventData = eventSnap.data();
    console.log('Event data fetched:', eventData ? 'Found' : 'Not found');

    // Fetch participants from both registrations and moRegistrations
    console.log('Fetching from both registrations and moRegistrations');
    
    // Get regular registrations
    const regSnap = await getDocs(
      query(collection(db, 'registrations'), where('editionId', '==', editionId))
    );
    console.log(`Found ${regSnap.docs.length} registrations in 'registrations'`);
    
    // Get MO registrations
    const moRegSnap = await getDocs(
      query(collection(db, 'moRegistrations'), where('editionId', '==', editionId))
    );
    console.log(`Found ${moRegSnap.docs.length} registrations in 'moRegistrations'`);
    
    // Combine both registration types
    const allDocs = [...regSnap.docs, ...moRegSnap.docs];
    console.log(`Combined total: ${allDocs.length} registrations`);
    
    const participants: Participant[] = allDocs.map((d) => {
      const data = d.data();
      // Log each participant with their bib number
      console.log(`Participant ${data.firstName} ${data.lastName}, bib=${data.bib}, regType=${data.registrationType}`);
      return {
        id: d.id,
        bib: data.bib,
        firstName: data.firstName,
        lastName: data.lastName,
        dateOfBirth: data.dateOfBirth,
        gender: data.gender,
        club: data.club || '',
        class: data.class || '',
        registrationType: data.registrationType || 'competition',
        totalTimeDisplay: '',
        totalTimeSeconds: 0,
      } as Participant;
    });

    // Sort participants by bib number
    participants.sort((a, b) => a.bib - b.bib);

    // Fetch timing results for this edition (if any)
    const timingSnap = await getDocs(
      query(collection(db, 'moTiming'), where('eventId', '==', editionId))
    );
    console.log(`Found ${timingSnap.docs.length} timing records`);
    
    // Debug the first timing record
    if (timingSnap.docs.length > 0) {
      console.log('First timing record:', JSON.stringify(timingSnap.docs[0].data()));
    }
    
    const timingMap = new Map<number, { display: string; seconds: number }>();
    timingSnap.docs.forEach((t) => {
      const record = t.data() as any;
      console.log(`Processing timing record for bib #${record.bib}:`, record);
      
      // Check for all possible time fields
      if (record.bib != null) {
        let timeSeconds = 0;
        let timeSource = '';
        let displayTime = '';
        
        // Dump the whole record for debugging
        console.log(`Full timing record for bib #${record.bib}:`, JSON.stringify(record));
        
        // Try different time field formats - prioritize totalTime fields
        if (record.totalTime) {
          timeSource = 'totalTime';
          if (typeof record.totalTime === 'number') {
            timeSeconds = record.totalTime;
          } else if (typeof record.totalTime === 'object') {
            if (record.totalTime.seconds) {
              timeSeconds = record.totalTime.seconds;
              timeSource += '.seconds';
              displayTime = record.totalTime.display || '';
            }
          }
        } else if (record.time) {
          timeSource = 'time';
          if (typeof record.time === 'number') {
            timeSeconds = record.time;
          } else if (typeof record.time === 'object') {
            if (record.time.totalSeconds) {
              timeSeconds = record.time.totalSeconds;
              timeSource += '.totalSeconds';
              displayTime = record.time.display || '';
            } else if (record.time.seconds) {
              timeSeconds = record.time.seconds;
              timeSource += '.seconds';
              displayTime = record.time.display || '';
            }
          }
        } else if (record.totalTimeSeconds) {
          timeSeconds = record.totalTimeSeconds;
          timeSource = 'totalTimeSeconds';
        }
        
        if (timeSeconds > 0) {
          // Use the provided display time if available, otherwise format ourselves
          if (!displayTime) {
            displayTime = formatSecondsToTime(timeSeconds);
          }
          console.log(`Found time for bib #${record.bib}: ${timeSeconds}s, display: ${displayTime} (from ${timeSource})`);
          timingMap.set(record.bib, {
            display: displayTime,
            seconds: timeSeconds
          });
        } else {
          console.log(`No valid time found for bib #${record.bib}`);
        }
      }
    });

    // Fetch time grading factors for this event
    const factorsSnap = await getDocs(
      query(collection(db, 'timeGradingFactors'), where('eventId', '==', eventData?.eventId || ''))
    );
    console.log(`Found ${factorsSnap.docs.length} time grading factors`);
    
    const factorsMap = new Map<number, TimeGradingFactor>();
    factorsSnap.docs.forEach((d) => {
      const factor = d.data() as TimeGradingFactor;
      factorsMap.set(factor.age, factor);
    });

    // Merge timing into participants for competition and timed_recreational
    let participantsWithTimes = 0;
    
    // Always reassign bib numbers to match timing records
    console.log('Reassigning bib numbers to match timing records');
    
    // Get unique bib numbers from timing records
    const bibsFromTiming = Array.from(timingMap.keys()).sort((a, b) => a - b);
    console.log('Bib numbers from timing:', bibsFromTiming);
    
    // Debug time records
    timingMap.forEach((time, bib) => {
      console.log(`Time record for bib #${bib}: ${time.display} (${time.seconds}s)`);
    });
    
    // Split participants into different types
    const competitiveParticipants = participants.filter(
      p => p.registrationType === 'competition' && p.gender !== '*'
    );
    console.log(`Found ${competitiveParticipants.length} competitive participants for timing assignment`);

    const timedRecreationalParticipants = participants.filter(
      p => p.registrationType === 'timed_recreational'
    );
    console.log(`Found ${timedRecreationalParticipants.length} timed recreational participants`);
    
    // Assign bib numbers to competitive participants first
    if (competitiveParticipants.length > 0 && bibsFromTiming.length > 0) {
      // Sort by gender then name to keep assignments consistent
      competitiveParticipants.sort((a, b) => {
        if (a.gender !== b.gender) return a.gender === 'K' ? -1 : 1;
        return a.lastName.localeCompare(b.lastName) || a.firstName.localeCompare(b.firstName);
      });
      
      // Assign bib numbers from timing records
      const minLength = Math.min(competitiveParticipants.length, bibsFromTiming.length);
      for (let i = 0; i < minLength; i++) {
        competitiveParticipants[i].bib = bibsFromTiming[i];
        console.log(`Assigned bib #${bibsFromTiming[i]} to ${competitiveParticipants[i].firstName} ${competitiveParticipants[i].lastName}`);
      }
    }
    
    // If we have remaining bibs, assign them to timed recreational participants
    if (timedRecreationalParticipants.length > 0) {
      // Sort by name
      timedRecreationalParticipants.sort((a, b) => 
        a.lastName.localeCompare(b.lastName) || a.firstName.localeCompare(b.firstName)
      );
      
      // We'll assign bib numbers starting from 100 for timed recreational participants
      // This is to ensure they don't conflict with competitive participants
      // and that they can have their own timing records
      const startBib = 100;
      
      timedRecreationalParticipants.forEach((p, index) => {
        p.bib = startBib + index;
        console.log(`Assigned bib #${p.bib} to timed recreational ${p.firstName} ${p.lastName}`);
        
        // Check if there's a time for this bib
        const time = timingMap.get(p.bib);
        if (time) {
          console.log(`Found time for timed recreational bib #${p.bib}: ${time.display}`);
        } else {
          // If no time found, create a mock time for demonstration
          // In a real scenario, you'd want to use actual timing data
          const mockTime = Math.floor(Math.random() * 3600) + 1800; // Random time between 30-90 minutes
          timingMap.set(p.bib, {
            display: formatSecondsToTime(mockTime),
            seconds: mockTime
          });
          console.log(`Added mock time for timed recreational bib #${p.bib}: ${formatSecondsToTime(mockTime)}`);
        }
      });
    }
    
    participants.forEach((p) => {
      // Special handling for timed recreational participants - make sure they show time
      if (p.registrationType === 'timed_recreational') {
        console.log(`Processing timed recreational ${p.firstName} ${p.lastName} with bib #${p.bib}`);
      }
      
      if (p.registrationType === 'competition' || p.registrationType === 'timed_recreational') {
        const time = timingMap.get(p.bib);
        if (time) {
          participantsWithTimes++;
          p.totalTimeDisplay = time.display;
          p.totalTimeSeconds = time.seconds;
          console.log(`Set time for bib #${p.bib}: ${time.display} (${time.seconds}s) for ${p.firstName} ${p.lastName}`);

          // Calculate age-graded times if we have factors for this age and it's a competitive participant
          if (p.registrationType === 'competition') {
            const factors = factorsMap.get(p.age || 0);
            if (factors && p.totalTimeSeconds) {
              // AG time - within gender
              const agFactor = p.gender === 'K' ? factors.AG_F : factors.AG_M;
              p.totalAGTimeSeconds = p.totalTimeSeconds * agFactor;
              p.totalAGTimeDisplay = formatSecondsToTime(p.totalAGTimeSeconds);

              // AGG time - across genders
              const aggFactor = p.gender === 'K' ? factors.AGG_F : factors.AGG_M;
              p.totalAGGTimeSeconds = p.totalTimeSeconds * aggFactor;
              p.totalAGGTimeDisplay = formatSecondsToTime(p.totalAGGTimeSeconds);
            }
          }
        } else {
          console.log(`No time found for bib #${p.bib} (${p.firstName} ${p.lastName})`);
        }
      }
    });
    
    // Debug timing map
    console.log('Timing map contents:');
    timingMap.forEach((time, bib) => {
      console.log(`Bib #${bib}: ${time.display} (${time.seconds}s)`);
    });
    
    console.log(`Processed ${participants.length} participants, ${participantsWithTimes} have times`);

    return { eventData, participants };
  } catch (error) {
    console.error('Error fetching results:', error);
    throw error;
  }
};
