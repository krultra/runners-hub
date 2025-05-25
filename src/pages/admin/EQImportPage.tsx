import React, { useState } from 'react';
import { Box, Button, Container, Paper, Typography, Alert, CircularProgress } from '@mui/material';
import { getFirestore, writeBatch, collection, doc } from 'firebase/firestore';
import Papa from 'papaparse';

const EQImportPage: React.FC = () => {
  // Helper to calculate age from dateOfBirth string for a target year
  const calculateAge = (dateOfBirth: string, targetYear: number): number => {
    try {
      const dob = new Date(dateOfBirth);
      if (isNaN(dob.getTime())) {
        // If not a valid date, try to extract year
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
  const [eqTimingFile, setEqTimingFile] = useState<File | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [importSuccess, setImportSuccess] = useState<boolean | null>(null);
  const [importError, setImportError] = useState<string | null>(null);

  const handleEqTimingCsvImport = async () => {
    if (!eqTimingFile) {
      setImportError('Please select a CSV file.');
      return;
    }
    setIsImporting(true);
    setImportError(null);
    setImportSuccess(null);
    try {
      const results = await new Promise<Papa.ParseResult<string[]>>((resolve, reject) => {
        Papa.parse(eqTimingFile, {
          header: false,
          skipEmptyLines: true,
          complete: resolve,
          error: reject,
        });
      });
      const db = getFirestore();
      const batch = writeBatch(db);
      // Skip header row and filter out invalid rows
      // First remove the header row
      const rawRows = results.data as string[][];
      const dataRowsWithoutHeader = rawRows.length > 0 ? rawRows.slice(1) : [];
      
      // Additional filtering to ensure no headers get through
      const dataRows = dataRowsWithoutHeader.filter(row => {
        // Skip empty or too short rows
        if (!Array.isArray(row) || row.length < 20) return false;
        
        // Skip rows that look like headers (typically contain words like 'id', 'name', 'class', etc.)
        const potentialHeaderTerms = ['id', 'name', 'first', 'last', 'gender', 'class', 'club', 'date', 'birth'];
        const rowText = row.join(' ').toLowerCase();
        const seemsLikeHeader = potentialHeaderTerms.some(term => rowText.includes(term));
        
        // If multiple terms are found, it's likely a header
        const headerTermCount = potentialHeaderTerms.filter(term => rowText.includes(term)).length;
        
        // Return false (skip) if it seems like a header with multiple header terms
        if (seemsLikeHeader && headerTermCount > 3) return false;
        
        // Skip rows where the registration number field isn't numeric
        const registrationNumber = row[1];
        if (registrationNumber && isNaN(Number(registrationNumber))) return false;
        
        return true;
      });
      for (const columns of dataRows) {
        // Defensive: skip if not enough columns
        if (columns.length < 20) continue;
        const gender = (columns[14] || '').toUpperCase() === 'M' ? 'M' : 'K';
        const dateOfBirth = columns[13] || '';
        const participant = {
          firstName: columns[5],
          lastName: columns[6],
          className: columns[17],
          gender,
          representing: columns[8] || null,
          eqTimingId: columns[3],
          registrationType: columns[17].toLowerCase().includes('trim') ? 'timed_recreational' : 'competition',
          registeredAt: columns[19],
          email: '',
          phone: '',
          dateOfBirth,
          age: calculateAge(dateOfBirth, 2025),
          comments: 'Imported from EQ timing',
          confirmedPayment: true,
          editionId: 'mo-2025',
          isOnWaitinglist: false,
          nationality: columns[15],
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
          registrationNumber: Number(columns[1]),
          createdAt: new Date().toISOString(),
        };
        const ref = doc(collection(db, 'moRegistrations'));
        batch.set(ref, participant);
      }
      await batch.commit();
      setImportSuccess(true);
    } catch (error) {
      setImportError(error instanceof Error ? error.message : 'Error importing EQ Timing CSV');
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <Container maxWidth="md">
      <Paper sx={{ p: 3, mt: 4, mb: 4 }}>
        <Typography variant="h4" component="h1" gutterBottom>
          Import EQ Timing CSV
        </Typography>
        <Box sx={{ mt: 4 }}>
          <input
            type="file"
            accept=".csv"
            onChange={e => {
              if (e.target.files && e.target.files.length > 0) {
                setEqTimingFile(e.target.files[0]);
                setImportError(null);
                setImportSuccess(null);
              }
            }}
          />
          <Button
            variant="contained"
            color="primary"
            sx={{ ml: 2 }}
            onClick={handleEqTimingCsvImport}
            disabled={isImporting || !eqTimingFile}
          >
            {isImporting ? <CircularProgress size={24} /> : 'Import EQ Timing CSV'}
          </Button>
          {importSuccess && <Alert severity="success" sx={{ mt: 2 }}>EQ Timing participants imported successfully!</Alert>}
          {importError && <Alert severity="error" sx={{ mt: 2 }}>{importError}</Alert>}
        </Box>
      </Paper>
    </Container>
  );
};

export default EQImportPage;
