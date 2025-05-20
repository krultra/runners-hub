import React, { useState } from 'react';
import { Box, Button, Container, Paper, TextField, Typography, CircularProgress, Alert } from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import { getFirestore, doc, setDoc, getDoc, collection, query, where, getDocs, writeBatch } from 'firebase/firestore';
import Papa from 'papaparse';

// Define the structure for a Malvikingen participant
interface MalvikingenParticipant {
  firstName: string;
  lastName: string;
  className: string;
  gender: 'M' | 'K' | '*' | null;
  representing: string | null;
  eqTimingId: string; // Use the numeric ID as string
  registrationType: 'competition' | 'recreational' | 'timed_recreational';
  timestamp: string;
  email: string;
  phone: string;
  dateOfBirth: string;
  classDescription: string;
  comments: string;
  confirmedPayment: boolean;
  editionId: string;
  isOnWaitinglist: boolean;
  nationality: string;
  notifyFutureEvents: boolean;
  paymentMade: number;
  paymentRequired: number;
  phoneCountryCode: string;
  raceDistance: string;
  sendRunningOffers: boolean;
  status: string;
  termsAccepted: boolean;
  updatedAt: string;
  waitinglistExpires: string | null;
  registrationSource: string;
  registrationNumber: number;
  createdAt: string;
  // Add any other relevant fields if needed
}

interface TimingResult {
  eventId: string;
  importedFinalPosition: number;
  bib: number;
  totalTime: { display: string; seconds: number };
  totalAGTime?: [string, number]; // [display, seconds]
  totalAGGTime?: [string, number]; // [display, seconds]
  splitElapsedTimes: { display: string; seconds: number }[];
  splitTimes: { display: string; seconds: number }[];
  createdAt: string;
  updatedAt: string;
  scratchPlace?: number;
  genderPlace?: number;
  AGPlace?: number;
  AGGPlace?: number;
  classPlace?: number;
  registrationType?: string;
  className?: string;
  gender?: string;
  representing?: string;
  firstName?: string;
  lastName?: string;
  dateOfBirth?: string;
  age?: number;
}

// Type for grading factor records
interface TimeGradingFactor {
  eventId: string;
  age: number;
  AG_F: number;
  AG_M: number;
  GG_F: number;
  GG_M: number;
  AGG_F: number;
  AGG_M: number;
}

// Helper to parse time strings ("h:mm:ss.s" or "mm:ss.s") into seconds
function parseTimeStr(timeStr: string): number {
  const parts = timeStr.split(':').map(s => s.trim());
  let sec = 0;
  if (parts.length === 2) {
    sec = Number(parts[0]) * 60 + Number(parts[1]);
  } else if (parts.length === 3) {
    sec = Number(parts[0]) * 3600 + Number(parts[1]) * 60 + Number(parts[2]);
  } else {
    sec = Number(timeStr);
  }
  return Math.round(sec * 10) / 10;
}

const ImportMalvikingenPage: React.FC = () => {
  const [rawData, setRawData] = useState<string>('');
  const [isImporting, setIsImporting] = useState<boolean>(false);
  const [importStatus, setImportStatus] = useState<{ message: string; severity: 'success' | 'error' | 'info' } | null>(null);
  const [errorDetails, setErrorDetails] = useState<string[]>([]);

  const [turklasseUrl, setTurklasseUrl] = useState<string>("https://docs.google.com/spreadsheets/d/e/2PACX-1vRv8CxCcz-bufmEdmW10rbVXPY1dhv-RRupX0MzYsNVV6zKJUuCs7T78p3dnXAsyoXuxZyXAbdBaW5p/pub?output=csv");
  const [turklasseImportError, setTurklasseImportError] = useState<string | null>(null);
  const [turklasseImportSuccess, setTurklasseImportSuccess] = useState<boolean>(false);

  const [timingFile, setTimingFile] = useState<File | null>(null);
  const [isTimingImporting, setIsTimingImporting] = useState(false);
  const [timingImportSuccess, setTimingImportSuccess] = useState<boolean | null>(null);
  const [timingImportError, setTimingImportError] = useState<string | null>(null);

  const [factorsFile, setFactorsFile] = useState<File | null>(null);
  const [isFactorsImporting, setIsFactorsImporting] = useState(false);
  const [factorsImportSuccess, setFactorsImportSuccess] = useState<boolean | null>(null);
  const [factorsImportError, setFactorsImportError] = useState<string | null>(null);

  const handleImport = async () => {
    setIsImporting(true);
    setImportStatus(null);
    setErrorDetails([]);
    const db = getFirestore();
    let successCount = 0;
    const errors: string[] = [];

    const lines = rawData.trim().split('\n');

    // Check for header row (simple check: does the first line contain 'First name' or 'Fornavn'?)
    const headerRowPresent = lines.length > 0 && (lines[0].includes('First name') || lines[0].includes('Fornavn'));
    const dataLines = headerRowPresent ? lines.slice(1) : lines;

    // Update handleImport to add registrationType 'competition'
    const importedData = dataLines.map((line, index) => {
      // Trim the line and check if it should be skipped
      const trimmedLine = line.trim();
      if (trimmedLine === '' || trimmedLine === '+') {
        return null; // Skip empty lines and lines with only '+'
      }

      const lineNumber = headerRowPresent ? index + 2 : index + 1; // Adjust line number for error reporting

      const columns = line.split('\t');

      // Expected columns based on analysis: 11
      if (columns.length < 11) {
        if (line.trim()) { // Only report error if line is not empty
           errors.push(`Line ${lineNumber}: Invalid columns count (${columns.length}). Skipping.`);
        }
        return null; // Skip this line
      }

      try {
        const firstName = columns[0]?.trim() || '';
        const lastName = columns[1]?.trim() || '';
        const rawBirthYear = columns[2]?.trim();
        const className = columns[8]?.trim() || '';
        const club = columns[9]?.trim() === 'None' ? null : columns[9]?.trim() || null;
        const eqTimingIdRaw = columns[10]?.trim() || '';

        // Basic validation
        if (!firstName || !lastName) throw new Error('Missing first or last name.');
        if (!rawBirthYear || isNaN(parseInt(rawBirthYear))) throw new Error('Invalid birth year.');
        if (!className) throw new Error('Missing class name.');
        if (!eqTimingIdRaw.startsWith('(') || !eqTimingIdRaw.endsWith(')')) throw new Error('Invalid EQ Timing ID format.');

        const eqTimingIdMatch = eqTimingIdRaw.match(/\((\d+)\)/);
        if (!eqTimingIdMatch || !eqTimingIdMatch[1]) throw new Error('Could not parse EQ Timing ID number.');
        const eqTimingId = eqTimingIdMatch[1];

        // Determine gender based on class name
        let gender: 'M' | 'K' | '*' | null = null;
        // Determine registration type - default to competition
        let registrationType: 'competition' | 'timed_recreational' | 'recreational' = 'competition';
        
        // Handle standard competition classes (Menn/Kvinner)
        if (className.startsWith('Menn') || className.toLowerCase().includes('menn')) {
          gender = 'M';
        } else if (className.startsWith('Kvinner') || className.toLowerCase().includes('kvinner')) {
          gender = 'K';
        } 
        // Handle recreational classes like "Trim m/tidtaking" with gender-neutral '*'
        else if (className.startsWith('Trim')) {
          gender = '*';
          registrationType = 'timed_recreational';
        } else {
          throw new Error('Could not determine gender from class name: ' + className);
        }

        const timestamp = columns[5]?.trim() || '';
        const email = columns[6]?.trim() || '';
        const phone = columns[7]?.trim() || '';
        const formattedDOB = rawBirthYear ? `01/01/${rawBirthYear}` : '';
        const classDescription = columns[4]?.trim() || '';
        const comment = columns[11]?.trim() || '';
        const startNumber = columns[3]?.trim() || '';

        const participant: MalvikingenParticipant = {
          timestamp,
          email,
          firstName,
          lastName,
          phone,
          dateOfBirth: formattedDOB,
          classDescription,
          representing: club,
          comments: comment,
          confirmedPayment: true,
          eqTimingId,
          registrationType,
          className,
          gender,
          editionId: 'mo-2025',
          isOnWaitinglist: false,
          nationality: 'NOR',
          notifyFutureEvents: false,
          paymentMade: 200,
          paymentRequired: 200,
          phoneCountryCode: '+47',
          raceDistance: '6 km',
          sendRunningOffers: false,
          status: 'confirmed',
          termsAccepted: true,
          updatedAt: new Date().toISOString(),
          waitinglistExpires: null,
          registrationSource: 'EQ',
          registrationNumber: startNumber ? parseInt(startNumber) : 0,
          createdAt: new Date().toISOString()
        };

        return participant;

      } catch (error: any) {
        errors.push(`Line ${lineNumber}: Error - ${error.message || 'Unknown error'}`);
        return null;
      }
    }).filter((item): item is MalvikingenParticipant => item !== null); // Remove null values

    try {
      for (const participant of importedData) {
        // Create a composite key using eqTimingId, firstName, lastName, and birth year
        // This ensures uniqueness even if multiple participants share the same EQ Timing ID
        const birthYear = participant.dateOfBirth ? participant.dateOfBirth.split('/')[2] : '';
        const compositeKey = `mo-2025-eq-${participant.eqTimingId}-${participant.firstName.toLowerCase()}-${participant.lastName.toLowerCase()}-${birthYear}`;
        
        // Sanitize the key to remove any characters that could cause issues in document IDs
        const sanitizedKey = compositeKey
          .replace(/\s+/g, '-')  // Replace spaces with hyphens
          .replace(/[^a-z0-9-]/g, '')  // Remove any non-alphanumeric characters except hyphens
          .replace(/-+/g, '-');  // Replace multiple consecutive hyphens with a single one
        
        console.log(`Generated composite key for ${participant.firstName} ${participant.lastName}: ${sanitizedKey}`);
        
        // Use the composite key as the document ID
        const docRef = doc(db, 'moRegistrations', sanitizedKey);
        
        try {
          // Check if a document with the same EQ Timing ID and name already exists
          const existingDocsQuery = query(
            collection(db, 'moRegistrations'), 
            where('eqTimingId', '==', participant.eqTimingId),
            where('firstName', '==', participant.firstName),
            where('lastName', '==', participant.lastName)
          );
          
          const existingDocs = await getDocs(existingDocsQuery);
          
          if (!existingDocs.empty) {
            // Update the existing document
            const existingDoc = existingDocs.docs[0];
            const { createdAt, ...updateData } = participant;
            await setDoc(doc(db, 'moRegistrations', existingDoc.id), updateData, { merge: true });
            console.log(`Updated existing registration for ${participant.firstName} ${participant.lastName} with ID ${existingDoc.id}`);
          } else {
            // Check if the document with the composite key exists
            const docSnap = await getDoc(docRef);
            if (docSnap.exists()) {
              const { createdAt, ...updateData } = participant;
              await setDoc(docRef, updateData, { merge: true });
              console.log(`Updated registration with composite key for ${participant.firstName} ${participant.lastName}`);
            } else {
              // Create a new document with the composite key
              await setDoc(docRef, { ...participant, createdAt: new Date().toISOString() });
              console.log(`Created new registration for ${participant.firstName} ${participant.lastName} with key ${sanitizedKey}`);
              successCount++;
            }
          }
        } catch (err) {
          throw err;
        }
      }
      setImportStatus({ message: `Successfully imported/updated ${successCount} participants.`, severity: 'success' });
    } catch (error: any) {
      setImportStatus({ message: `Error during import: ${error.message}`, severity: 'error' });
    }

    setIsImporting(false);
  };

  const handleTurklasseImport = async () => {
    setTurklasseImportError(null);
    setTurklasseImportSuccess(false);
    try {
      const response = await fetch(turklasseUrl);
      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }
      const csvData = await response.text();
      Papa.parse(csvData, {
        header: true,
        complete: (results: Papa.ParseResult<any>) => {
          // Map each parsed record from the spreadsheet columns to our internal fields
          const mappedData = results.data.map((row: any) => ({
            timestamp: row['Tidsmerke'],
            email: row['E-postadresse'],
            firstName: row['Fornavn'],
            lastName: row['Etternavn'],
            phone: row['Mobiltelefon'],
            dateOfBirth: row['Fødselsdato'],
            // Assign className instead of classDescription for Turklasse
            className: 'Turklasse',
            classDescription: '', // Empty string instead of 'Turklasse'
            representing: row['Klubb'],
            comments: row['Plass til å kommentere eller skrive beskjeder til arrangøren'],
            registrationType: 'recreational',
            editionId: 'mo-2025',
            isOnWaitinglist: false,
            nationality: 'NOR',
            notifyFutureEvents: false,
            paymentMade: 50,
            paymentRequired: 50,
            phoneCountryCode: '+47',
            raceDistance: '6 km',
            sendRunningOffers: false,
            status: 'confirmed',
            termsAccepted: true,
            updatedAt: new Date().toISOString(),
            waitinglistExpires: null,
            registrationSource: 'Google sheet',
            registrationNumber: 0,
            gender: null,
            createdAt: new Date().toISOString()
          }));
          console.log('Mapped Turklasse data:', mappedData);

          (async () => {
            try {
              const db = getFirestore();
              for (const record of mappedData) {
                const sanitizedTimestamp = record.timestamp.replace(/[^0-9]/g, '');
                const docId = `mo-2025-google-${sanitizedTimestamp}`;
                const docRef = doc(db, 'moRegistrations', docId);
                try {
                  const docSnap = await getDoc(docRef);
                  if (docSnap.exists()) {
                    const { createdAt, ...updateData } = record;
                    await setDoc(docRef, updateData, { merge: true });
                  } else {
                    await setDoc(docRef, { ...record, createdAt: new Date().toISOString() });
                  }
                } catch (err) {
                  throw err;
                }
              }
              setTurklasseImportSuccess(true);
            } catch (error: any) {
              setTurklasseImportError(error.message);
            }
          })();
        },
        error: (err: Error) => {
          setTurklasseImportError('Error parsing CSV: ' + err.message);
        }
      });
    } catch (error: any) {
      setTurklasseImportError(error.message);
    }
  };

  const padBib = (bib: number): string => bib.toString().padStart(3, '0');

  // Helper function to format time in seconds to a human-readable format
const formatTime = (seconds: number): string => {
  if (isNaN(seconds) || seconds <= 0) return '';
  
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  
  // Format as hh:mm:ss or mm:ss.s depending on whether hours > 0
  if (hours > 0) {
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toFixed(1).padStart(4, '0')}`;
  } else {
    return `${minutes.toString().padStart(2, '0')}:${secs.toFixed(1).padStart(4, '0')}`;
  }
};

// Helper function to calculate AG and AGG times
const calculateGradedTimes = (
  totalSeconds: number, 
  age: number, 
  gender: string | undefined, 
  gradingFactors: Map<number, TimeGradingFactor>
): { AGTime: [string, number], AGGTime: [string, number] } => {
  // Default to no adjustment
  let AGFactor = 1.0;
  let AGGFactor = 1.0;

  // Find the closest age factor
  const factor = gradingFactors.get(age);
  
  if (factor && gender) {
    if (gender === 'M') {
      AGFactor = factor.AG_M;
      AGGFactor = factor.AGG_M;
    } else if (gender === 'K' || gender === 'F') {
      AGFactor = factor.AG_F;
      AGGFactor = factor.AGG_F;
    }
  }
  
  // Calculate adjusted times - multiply by the factors to get age-graded times
  // Factors are <= 1.0, with smaller values giving more adjustment
  const AGSeconds = totalSeconds * AGFactor;
  const AGGSeconds = totalSeconds * AGGFactor;
  
  return {
    AGTime: [formatTime(AGSeconds), AGSeconds],
    AGGTime: [formatTime(AGGSeconds), AGGSeconds]
  };
};

// Calculate placements for all competitive participants
const calculatePlacements = async (timingResults: TimingResult[]): Promise<TimingResult[]> => {
  // Filter competitive participants
  const competitive = timingResults.filter(p => p.registrationType === 'competition');
  
  if (competitive.length === 0) {
    console.info('No competitive participants found for placement calculation');
    return timingResults;
  }
  
  // 1. Calculate scratch placements based on total time
  const scratchSorted = [...competitive].sort((a, b) => a.totalTime.seconds - b.totalTime.seconds);
  let currentPlace = 1;
  let lastTime = -1;
  
  for (let i = 0; i < scratchSorted.length; i++) {
    const participant = scratchSorted[i];
    if (i > 0 && participant.totalTime.seconds !== lastTime) {
      currentPlace = i + 1;
    }
    lastTime = participant.totalTime.seconds;
    // Find this participant in the original array and update it
    const originalIndex = timingResults.findIndex(p => 
      p.bib === participant.bib && p.eventId === participant.eventId
    );
    if (originalIndex >= 0) {
      timingResults[originalIndex].scratchPlace = currentPlace;
    }
  }
  
  // 2. Calculate gender placements
  const maleParticipants = competitive.filter(p => p.gender === 'M');
  const femaleParticipants = competitive.filter(p => p.gender === 'K' || p.gender === 'F');
  
  // Male placements
  const maleSorted = [...maleParticipants].sort((a, b) => a.totalTime.seconds - b.totalTime.seconds);
  currentPlace = 1;
  lastTime = -1;
  
  for (let i = 0; i < maleSorted.length; i++) {
    const participant = maleSorted[i];
    if (i > 0 && participant.totalTime.seconds !== lastTime) {
      currentPlace = i + 1;
    }
    lastTime = participant.totalTime.seconds;
    const originalIndex = timingResults.findIndex(p => 
      p.bib === participant.bib && p.eventId === participant.eventId
    );
    if (originalIndex >= 0) {
      timingResults[originalIndex].genderPlace = currentPlace;
    }
  }
  
  // Female placements
  const femaleSorted = [...femaleParticipants].sort((a, b) => a.totalTime.seconds - b.totalTime.seconds);
  currentPlace = 1;
  lastTime = -1;
  
  for (let i = 0; i < femaleSorted.length; i++) {
    const participant = femaleSorted[i];
    if (i > 0 && participant.totalTime.seconds !== lastTime) {
      currentPlace = i + 1;
    }
    lastTime = participant.totalTime.seconds;
    const originalIndex = timingResults.findIndex(p => 
      p.bib === participant.bib && p.eventId === participant.eventId
    );
    if (originalIndex >= 0) {
      timingResults[originalIndex].genderPlace = currentPlace;
    }
  }
  
  // 3. Calculate AG placements by gender
  // Male AG placements
  const maleAGSorted = [...maleParticipants]
    .filter(p => p.totalAGTime && p.totalAGTime[1] > 0)
    .sort((a, b) => (a.totalAGTime?.[1] || 0) - (b.totalAGTime?.[1] || 0));
  
  currentPlace = 1;
  lastTime = -1;
  
  for (let i = 0; i < maleAGSorted.length; i++) {
    const participant = maleAGSorted[i];
    if (i > 0 && participant.totalAGTime?.[1] !== lastTime) {
      currentPlace = i + 1;
    }
    lastTime = participant.totalAGTime?.[1] || 0;
    const originalIndex = timingResults.findIndex(p => 
      p.bib === participant.bib && p.eventId === participant.eventId
    );
    if (originalIndex >= 0) {
      timingResults[originalIndex].AGPlace = currentPlace;
    }
  }
  
  // Female AG placements
  const femaleAGSorted = [...femaleParticipants]
    .filter(p => p.totalAGTime && p.totalAGTime[1] > 0)
    .sort((a, b) => (a.totalAGTime?.[1] || 0) - (b.totalAGTime?.[1] || 0));
  
  currentPlace = 1;
  lastTime = -1;
  
  for (let i = 0; i < femaleAGSorted.length; i++) {
    const participant = femaleAGSorted[i];
    if (i > 0 && participant.totalAGTime?.[1] !== lastTime) {
      currentPlace = i + 1;
    }
    lastTime = participant.totalAGTime?.[1] || 0;
    const originalIndex = timingResults.findIndex(p => 
      p.bib === participant.bib && p.eventId === participant.eventId
    );
    if (originalIndex >= 0) {
      timingResults[originalIndex].AGPlace = currentPlace;
    }
  }
  
  // 4. Calculate AGG placements (all competitors together)
  const AGGSorted = [...competitive]
    .filter(p => p.totalAGGTime && p.totalAGGTime[1] > 0)
    .sort((a, b) => (a.totalAGGTime?.[1] || 0) - (b.totalAGGTime?.[1] || 0));
  
  currentPlace = 1;
  lastTime = -1;
  
  for (let i = 0; i < AGGSorted.length; i++) {
    const participant = AGGSorted[i];
    if (i > 0 && participant.totalAGGTime?.[1] !== lastTime) {
      currentPlace = i + 1;
    }
    lastTime = participant.totalAGGTime?.[1] || 0;
    const originalIndex = timingResults.findIndex(p => 
      p.bib === participant.bib && p.eventId === participant.eventId
    );
    if (originalIndex >= 0) {
      timingResults[originalIndex].AGGPlace = currentPlace;
    }
  }
  
  // 5. Calculate class placements
  // Group participants by class
  const classSeparated = new Map<string, TimingResult[]>();
  competitive.forEach(participant => {
    if (!participant.className) return;
    
    if (!classSeparated.has(participant.className)) {
      classSeparated.set(participant.className, []);
    }
    classSeparated.get(participant.className)?.push(participant);
  });
  
  // Calculate placements within each class
  classSeparated.forEach(classParticipants => {
    const classSorted = [...classParticipants].sort((a, b) => a.totalTime.seconds - b.totalTime.seconds);
    let currentClassPlace = 1;
    let lastClassTime = -1;
    
    for (let i = 0; i < classSorted.length; i++) {
      const participant = classSorted[i];
      if (i > 0 && participant.totalTime.seconds !== lastClassTime) {
        currentClassPlace = i + 1;
      }
      lastClassTime = participant.totalTime.seconds;
      const originalIndex = timingResults.findIndex(p => 
        p.bib === participant.bib && p.eventId === participant.eventId
      );
      if (originalIndex >= 0) {
        timingResults[originalIndex].classPlace = currentClassPlace;
      }
    }
  });
  
  return timingResults;
};

// Helper to calculate age from birth date
const calculateAge = (dateOfBirth: string, targetYear: number): number => {
  try {
    // Try to parse date of birth in format MM/DD/YYYY
    const dob = new Date(dateOfBirth);
    if (isNaN(dob.getTime())) {
      // If parsing failed, try to extract the year directly
      const yearMatch = dateOfBirth.match(/\d{4}/);
      if (yearMatch) {
        return targetYear - parseInt(yearMatch[0]);
      }
      return 0;
    }
    return targetYear - dob.getFullYear();
  } catch (error) {
    console.error('Error calculating age:', error);
    return 0;
  }
};

const handleTimingImport = async () => {
  if (!timingFile) return;
  setIsTimingImporting(true);
  setTimingImportSuccess(null);
  setTimingImportError(null);
  
  try {
    const fileText = await timingFile.text();
    Papa.parse(fileText, {
      header: false,
      complete: async (results: Papa.ParseResult<any>) => {
        // Process raw timing data
        const data = results.data as any[];
        const timingRecords = data.map((row, index) => {
          // Skip if row is blank or only whitespace
          if (!row || row.join('').trim() === '') return null;

          // Skip header row if present
          if (index === 0 && (isNaN(Number(row[0])) || String(row[0]).toUpperCase() === 'DNF')) return null;
          // Also skip any row where first column is 'DNF'
          if (String(row[0]).toUpperCase() === 'DNF') return null;
          
          const importedFinalPosition = Number(row[0]);
          const bib = Number(row[1]);
          // Skip rows with invalid bib
          if (isNaN(bib) || bib <= 0) return null;
          const totalStr = row[5]?.trim() || '';
          const splitElapsedStr = row[6]?.trim() || '';
          const splitLapStr = row[7]?.trim() || '';
          const totalSec = parseTimeStr(totalStr);
          const elapsedSec = parseTimeStr(splitElapsedStr);
          const lapSec = parseTimeStr(splitLapStr);
          
          return {
            eventId: 'mo-2025',
            importedFinalPosition,
            bib,
            totalTime: { display: totalStr, seconds: totalSec },
            splitElapsedTimes: [
              { display: '12:00:00', seconds: parseTimeStr('12:00:00') },
              { display: splitElapsedStr, seconds: elapsedSec }
            ],
            splitTimes: [
              { display: '0:00:00', seconds: parseTimeStr('0:00:00') },
              { display: splitLapStr, seconds: lapSec }
            ],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          };
        }).filter((record): record is TimingResult => record !== null);

        const db = getFirestore();
        
        // Create a debug log array to store information about the processing
        const debugLog: string[] = [];
        debugLog.push(`Processing ${timingRecords.length} timing records`);
        
        try {
          // 1. Fetch all timeGradingFactors for the event
          debugLog.push('Fetching time grading factors...');
          const gradingFactorsMap = new Map<number, TimeGradingFactor>();
          
          // Get all time grading factors without filtering
          const factorsQuery = query(collection(db, 'timeGradingFactors'));
          const factorsSnapshot = await getDocs(factorsQuery);
          
          // Debug: Log all retrieved documents
          debugLog.push(`Retrieved ${factorsSnapshot.docs.length} total factor documents`);
          let factorDebugSample: string[] = [];
          
          factorsSnapshot.forEach(doc => {
            const factorData = doc.data() as TimeGradingFactor;
            debugLog.push(`Factor document: ${doc.id}, eventId: ${factorData.eventId}, age: ${factorData.age}`);
            
            // Only include factors for this event ('mo-2025')
            if (factorData.eventId === 'mo-2025') {
              gradingFactorsMap.set(factorData.age, factorData);
              
              // Add a sample of factors to the debug log
              if (factorDebugSample.length < 5) {
                factorDebugSample.push(
                  `Age ${factorData.age}: M(AG=${factorData.AG_M.toFixed(3)}, AGG=${factorData.AGG_M.toFixed(3)}), ` +
                  `F(AG=${factorData.AG_F.toFixed(3)}, AGG=${factorData.AGG_F.toFixed(3)})`
                );
              }
            }
          });
          
          debugLog.push(`Loaded ${gradingFactorsMap.size} time grading factors for eventId='mo-2025'`);
          debugLog.push(`Sample factors: ${factorDebugSample.join(' | ')}`);
          
          // 2. Fetch all moRegistrations to get participant details
          debugLog.push('Fetching participant registrations...');
          const registrationsQuery = query(collection(db, 'moRegistrations'), where('editionId', '==', 'mo-2025'));
          const registrationsSnapshot = await getDocs(registrationsQuery);
          
          // Create a map of registrations by bib number for quick lookup
          const registrationsByBib = new Map<number, any>();
          registrationsSnapshot.forEach(doc => {
            const registrationData = doc.data();
            if (registrationData.registrationNumber) {
              registrationsByBib.set(registrationData.registrationNumber, registrationData);
            }
          });
          
          debugLog.push(`Loaded ${registrationsByBib.size} participant registrations`);
          
          // 3. Enrich timing records with participant information
          debugLog.push('Enriching timing records with participant information...');
          for (const record of timingRecords) {
            const registration = registrationsByBib.get(record.bib);
            
            if (registration) {
              // Add participant details to timing record
              record.registrationType = registration.registrationType || 'recreational';
              record.className = registration.className || '';
              record.gender = registration.gender || '*';
              record.representing = registration.representing || '';
              record.firstName = registration.firstName || '';
              record.lastName = registration.lastName || '';
              record.dateOfBirth = registration.dateOfBirth || '';
              
              // Calculate participant age (as of the end of the year)
              record.age = calculateAge(registration.dateOfBirth, 2025);
              
              // Calculate age-graded and age-gender-graded times for valid times
              if (record.totalTime.seconds > 0 && record.age > 0) {
                // Add debugging for this record
                const hasFactor = gradingFactorsMap.has(record.age);
                const factor = gradingFactorsMap.get(record.age);
                
                // Log detailed information for a few records to help diagnose the issue
                if (record.bib % 50 === 0) {
                  debugLog.push(
                    `Bib ${record.bib}: Age=${record.age}, Gender=${record.gender}, ` +
                    `Raw time=${record.totalTime.display} (${record.totalTime.seconds.toFixed(1)}s), ` +
                    `Has factor: ${hasFactor}, ` +
                    `Factor data: ${factor ? JSON.stringify(factor) : 'None'}`
                  );
                }
                
                const gradedTimes = calculateGradedTimes(
                  record.totalTime.seconds,
                  record.age,
                  record.gender,
                  gradingFactorsMap
                );
                
                // Log timing calculations for a sample of records
                if (record.bib % 50 === 0) {
                  debugLog.push(
                    `Bib ${record.bib} calculations: ` +
                    `AG: ${gradedTimes.AGTime[0]} (${gradedTimes.AGTime[1].toFixed(1)}s), ` +
                    `AGG: ${gradedTimes.AGGTime[0]} (${gradedTimes.AGGTime[1].toFixed(1)}s)`
                  );
                }
                
                record.totalAGTime = gradedTimes.AGTime;
                record.totalAGGTime = gradedTimes.AGGTime;
              }
            } else {
              debugLog.push(`Warning: No registration found for bib ${record.bib}`);
            }
          }
          
          // 4. Calculate placements
          debugLog.push('Calculating placements...');
          const processedTimingRecords = await calculatePlacements(timingRecords);
          
          // 5. Save all records to moTiming collection
          debugLog.push('Saving results to database...');
          const batch = writeBatch(db);
          let batchCount = 0;
          const maxBatchSize = 500;
          
          for (const record of processedTimingRecords) {
            const bibNum: number = record.bib;
            const bibPadded = padBib(bibNum);
            const docId = `mo-2025-${bibPadded}`;
            const docRef = doc(db, 'moTiming', docId);
            
            batch.set(docRef, record);
            
            batchCount++;
            if (batchCount >= maxBatchSize) {
              await batch.commit();
              batchCount = 0;
            }
          }
          
          if (batchCount > 0) {
            await batch.commit();
          }
          
          debugLog.push(`Successfully processed and saved ${processedTimingRecords.length} timing records`);
          console.log('Debug log:', debugLog.join('\n'));
          setTimingImportSuccess(true);
        } catch (error: any) {
          console.error('Error in processing timing data:', error);
          debugLog.push(`Error in processing: ${error.message}`);
          setTimingImportError(`Error processing timing data: ${error.message}\n\nDebug log:\n${debugLog.join('\n')}`);
        }
      },
      error: (err: Error) => {
        setTimingImportError('Error parsing CSV: ' + err.message);
      }
    });
  } catch (error: any) {
    setTimingImportError(error.message);
  } finally {
    setIsTimingImporting(false);
  }
};

  const handleFactorsImport = async () => {
    if (!factorsFile) return;
    setIsFactorsImporting(true);
    setFactorsImportSuccess(null);
    setFactorsImportError(null);
    try {
      const fileText = await factorsFile.text();
      Papa.parse(fileText, {
        delimiter: ';',
        header: false,
        complete: async (results: Papa.ParseResult<any>) => {
          const data = results.data as any[];
          // Assume first row is header, so skip index 0
          const factors = data.slice(1).map((row): TimeGradingFactor | null => {
            // Skip blank rows
            if (!row || row.join('').trim() === '') return null;
            const age = Number(row[0]);
            const AG_F = Number(String(row[1]).replace(/,/g, '.'));
            const AG_M = Number(String(row[2]).replace(/,/g, '.'));
            const GG_F = Number(String(row[3]).replace(/,/g, '.'));
            const GG_M = Number(String(row[4]).replace(/,/g, '.'));
            const AGG_F = Number(String(row[5]).replace(/,/g, '.'));
            const AGG_M = Number(String(row[6]).replace(/,/g, '.'));
            if (isNaN(age) || age < 5 || age > 100) return null;
            return { eventId: 'mo', age, AG_F, AG_M, GG_F, GG_M, AGG_F, AGG_M };
          }).filter((item): item is TimeGradingFactor => item !== null);

          const db = getFirestore();
          // For each factor, create or update a document in 'timeGradingFactors' with id `mo-<age>`
          for (const factor of factors) {
            const factorDocId = `mo-${factor.age}`;
            const docRef = doc(db, 'timeGradingFactors', factorDocId);
            await setDoc(docRef, factor, { merge: true });
          }
          setFactorsImportSuccess(true);
        },
        error: (err: Error) => {
          setFactorsImportError('Error parsing CSV: ' + err.message);
        }
      });
    } catch (error: any) {
      setFactorsImportError(error.message);
    } finally {
      setIsFactorsImporting(false);
    }
  };

  return (
    <Container maxWidth="md">
      <Paper sx={{ p: 3, mt: 4, mb: 4 }}>
        <Typography variant="h4" component="h1" gutterBottom>
          Import Malvikingen Opp (Konkurranseklasser)
        </Typography>
        <Typography paragraph>
          Paste the participant data copied from EQ Timing below (tab-separated).
          The import uses the EQ Timing ID (last column) to prevent duplicates.
        </Typography>
        <TextField
          label="Paste Data Here"
          multiline
          rows={15}
          fullWidth
          variant="outlined"
          value={rawData}
          onChange={(e) => setRawData(e.target.value)}
          sx={{ mb: 2 }}
          placeholder={'First name\tLast name\tFødselsår\tStart no\tSeeding\tStart time\tEvent\tGroup\tClass\tClub\tLatest detection\nPaul Håkon\tAlmås\t1957\t999999\t\t\tMalvikingen Opp\tMalvikingen Opp\tM65-69\tHell Ultraløperklubb\t(2762520)'}
        />
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Button
            variant="contained"
            color="primary"
            onClick={handleImport}
            disabled={isImporting || !rawData.trim()}
          >
            {isImporting ? <CircularProgress size={24} /> : 'Import Participants'}
          </Button>
          {isImporting && <Typography>Importing...</Typography>}
        </Box>

        {importStatus && (
          <Alert severity={importStatus.severity} sx={{ mt: 3 }}>
            {importStatus.message}
          </Alert>
        )}

        {errorDetails.length > 0 && (
          <Box sx={{ mt: 2 }}>
            <Typography variant="h6" color="error">Error Details:</Typography>
            <Paper elevation={0} sx={{ maxHeight: '200px', overflowY: 'auto', border: '1px solid', borderColor: 'error.main', p: 1, mt: 1, backgroundColor: 'rgba(255, 0, 0, 0.05)' }}>
              {errorDetails.map((err, i) => (
                <Typography key={i} variant="body2" component="pre" sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontSize: '0.8rem' }}>
                  {err}
                </Typography>
              ))}
            </Paper>
          </Box>
        )}
      </Paper>

      <Box sx={{ mt: 4 }}>
        <Typography variant="h6" gutterBottom>
          Turklasse Import
        </Typography>
        <TextField 
          fullWidth 
          label="Google Sheets CSV URL"
          value={turklasseUrl}
          onChange={(e) => setTurklasseUrl(e.target.value)}
          placeholder="Enter CSV URL"
        />
        <Button variant="contained" onClick={handleTurklasseImport} sx={{ mt: 2 }}>
          Import Turklasse
        </Button>
        {turklasseImportError && (
          <Typography color="error" variant="body2" sx={{ mt: 1 }}>
            {turklasseImportError}
          </Typography>
        )}
        {turklasseImportSuccess && (
          <Typography color="primary" variant="body2" sx={{ mt: 1 }}>
            Import successful!
          </Typography>
        )}
      </Box>

      <Box sx={{ mt: 4, mb: 2 }}>
        <Typography variant="h6" gutterBottom>EQ Timing Import</Typography>
        <Button 
          component={RouterLink} 
          to="/admin/eqimport" 
          variant="contained" 
          color="secondary"
        >
          Go to EQ Timing Import Page
        </Button>
        <Typography variant="body2" sx={{ mt: 1, fontStyle: 'italic' }}>
          The dedicated EQ Timing import page provides a streamlined interface for importing participant data from EQ Timing CSV files.
        </Typography>
      </Box>

      <Box sx={{ mt: 4 }}>
        <Typography variant="h6">Import Timing Results</Typography>
        <input
          type="file"
          accept=".csv"
          onChange={(e) => {
            if (e.target.files && e.target.files.length > 0) {
              setTimingFile(e.target.files[0]);
            }
          }}
        />
        <Button
          variant="contained"
          color="primary"
          sx={{ ml: 2 }}
          onClick={handleTimingImport}
          disabled={isTimingImporting || !timingFile}
        >
          {isTimingImporting ? 'Importing...' : 'Import Timing Results'}
        </Button>
        {timingImportSuccess && <Alert severity="success" sx={{ mt: 2 }}>Timing results imported successfully!</Alert>}
        {timingImportError && <Alert severity="error" sx={{ mt: 2 }}>{timingImportError}</Alert>}
      </Box>

      <Box sx={{ mt: 4 }}>
        <Typography variant="h6">Import Age & Gender Grading Factors</Typography>
        <Typography variant="body2" sx={{ mb: 1 }}>Expected CSV format: Age;AG_F;AG_M;GG_F;GG_M;AGG_F;AGG_M (one row per age from 5 to 100)</Typography>
        <input
          type="file"
          accept=".csv"
          onChange={(e) => {
            if (e.target.files && e.target.files.length > 0) {
              setFactorsFile(e.target.files[0]);
            }
          }}
        />
        <Button
          variant="contained"
          color="primary"
          sx={{ ml: 2 }}
          onClick={handleFactorsImport}
          disabled={isFactorsImporting || !factorsFile}
        >
          {isFactorsImporting ? 'Importing...' : 'Import Grading Factors'}
        </Button>
        {factorsImportSuccess && <Alert severity="success" sx={{ mt: 2 }}>Grading factors imported successfully!</Alert>}
        {factorsImportError && <Alert severity="error" sx={{ mt: 2 }}>{factorsImportError}</Alert>}
      </Box>
    </Container>
  );
};

export default ImportMalvikingenPage;
