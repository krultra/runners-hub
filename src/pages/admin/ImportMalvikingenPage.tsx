import React, { useState } from 'react';
import { Box, Button, Container, Paper, TextField, Typography, CircularProgress, Alert } from '@mui/material';
import { getFirestore, doc, setDoc, writeBatch, collection, getDoc } from 'firebase/firestore';
import { auth } from '../../config/firebase'; // Import the auth instance
import Papa from 'papaparse';

// Define the structure for a Malvikingen participant
interface MalvikingenParticipant {
  firstName: string;
  lastName: string;
  className: string;
  gender: 'M' | 'K' | null;
  representing: string | null;
  eqTimingId: string; // Use the numeric ID as string
  registrationType: 'competition' | 'recreational';
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
  splitElapsedTimes: { display: string; seconds: number }[];
  splitTimes: { display: string; seconds: number }[];
  createdAt: string;
  updatedAt: string;
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

        const genderChar = className.charAt(0).toUpperCase();
        if (genderChar !== 'M' && genderChar !== 'K') throw new Error('Could not determine gender from class name.');
        const gender = genderChar as 'M' | 'K';

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
          registrationType: 'competition',
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
        const docRef = doc(db, 'moRegistrations', participant.eqTimingId);
        try {
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) {
            const { createdAt, ...updateData } = participant;
            await setDoc(docRef, updateData, { merge: true });
          } else {
            await setDoc(docRef, { ...participant, createdAt: new Date().toISOString() });
            successCount++;
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
            // Force classDescription to 'Turklasse'
            classDescription: 'Turklasse',
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
          // Each row corresponds to a timing result
          // Expected columns:
          // 0: Final Position (importedFinalPosition)
          // 1: Bib Number (bib)
          // 2: Last Name (ignored)
          // 3: First Name (ignored)
          // 4: Team (ignored)
          // 5: Total Elapsed Time (totalTime)
          // 6: Split 1 Elapsed Time (for splitElapsedTimes: element1, element0 fixed as "12:00:00")
          // 7: Split 1 Lap Time (for splitTimes: element1, element0 fixed as "0:00:00")
          const data = results.data as any[];
          const timingRecords = data.map((row, index) => {
            // Skip if row is blank or only whitespace
            if (!row || row.join('').trim() === '') return null;

            // Skip header row if present: if first row contains non-numeric or row[0] equals 'DNF' (case-insensitive), skip
            if (index === 0 && (isNaN(Number(row[0])) || String(row[0]).toUpperCase() === 'DNF')) return null;
            // Also skip any row where first column is 'DNF'
            if (String(row[0]).toUpperCase() === 'DNF') return null;
            
            const importedFinalPosition = Number(row[0]);
            const bib = Number(row[1]);
            // Skip rows with invalid bib (NaN or bib <= 0)
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
          // For each timing record, create or update a document in 'moTiming' with custom ID: "mo-2025-xxx"
          for (const record of timingRecords) {
            const bibNum: number = record.bib;
            const bibPadded = padBib(bibNum);
            const docId = `mo-2025-${bibPadded}`;
            const docRef = doc(db, 'moTiming', docId);
            await setDoc(docRef, record);
          }
          setTimingImportSuccess(true);
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
