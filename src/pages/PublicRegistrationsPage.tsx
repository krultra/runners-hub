import React, { useEffect, useState } from 'react';
import { fetchPublicRegistrations, PublicRegistration } from '../utils/publicRegistrations';
import StatusIndicator from '../components/StatusIndicator';
import { Container, Typography, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper, CircularProgress, Box, Alert, Switch, FormControlLabel } from '@mui/material';

interface PublicRegistrationsPageProps {
  editionId?: string;
}

const PublicRegistrationsPage: React.FC<PublicRegistrationsPageProps> = ({ editionId = 'kutc-2025' }) => {
  const [registrations, setRegistrations] = useState<PublicRegistration[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [showCancelled, setShowCancelled] = useState(false);

  useEffect(() => {
    fetchPublicRegistrations(editionId).then(data => {
      setRegistrations(data);
      setLoading(false);
    });
  }, [editionId]);

  const regsList = registrations || [];
  const filteredRegs = regsList.filter(r => showCancelled || ['pending','confirmed'].includes(r.status));
  const participants = filteredRegs.filter(r => !r.isOnWaitinglist);
  const waitingList = filteredRegs.filter(r => r.isOnWaitinglist);
  const participantsCount = regsList.filter(r => ['pending','confirmed'].includes(r.status) && !r.isOnWaitinglist).length;
  const waitingListCount = regsList.filter(r => ['pending','confirmed'].includes(r.status) && r.isOnWaitinglist).length;
  const hasWaitingList = waitingList.length > 0;

  return (
    <Container maxWidth="md" sx={{ mt: 4 }}>
      <Typography variant="h4" gutterBottom sx={{ fontWeight: 700, letterSpacing: 0.5 }}>
        {hasWaitingList ? 'Participants and Waiting-list' : 'Registered Participants'}
      </Typography>
      <Alert severity="info" sx={{ mb: 3 }}>
        {hasWaitingList
          ? 'This table shows all public registrations for the current race edition, including registrations for the waiting-list. Only basic information is displayed for privacy. Status is updated as registrations are processed, and when waiting-list entries are moved to the participants list.'
          : 'This table shows all public registrations for the current race edition. Only basic information is displayed for privacy. Status is updated as registrations are processed.'}
      </Alert>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
        <Typography>Participants: {participantsCount} &nbsp; Waiting-list: {waitingListCount}</Typography>
        <FormControlLabel control={<Switch checked={showCancelled} onChange={e => setShowCancelled(e.target.checked)} />} label="Show cancelled registrations" />
      </Box>
      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 180 }}>
          <CircularProgress />
        </Box>
      ) : registrations && registrations.length > 0 ? (
        <TableContainer component={Paper} elevation={2} sx={{ borderRadius: 2, boxShadow: 2 }}>
          <Table stickyHeader aria-label="public registrations table">
            <TableHead>
              <TableRow sx={{ backgroundColor: 'background.paper' }}>
                <TableCell sx={{ fontWeight: 600, bgcolor: 'info.dark', color: 'info.contrastText', borderBottom: 2, borderColor: 'info.dark' }}>#</TableCell>
                <TableCell sx={{ fontWeight: 600, bgcolor: 'info.dark', color: 'info.contrastText', borderBottom: 2, borderColor: 'info.dark' }}>Name</TableCell>
                <TableCell sx={{ fontWeight: 600, bgcolor: 'info.dark', color: 'info.contrastText', borderBottom: 2, borderColor: 'info.dark' }}>Nationality</TableCell>
                <TableCell sx={{ fontWeight: 600, bgcolor: 'info.dark', color: 'info.contrastText', borderBottom: 2, borderColor: 'info.dark' }}>Representing</TableCell>
                <TableCell sx={{ fontWeight: 600, bgcolor: 'info.dark', color: 'info.contrastText', borderBottom: 2, borderColor: 'info.dark' }}>Status</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {participants.map((reg, idx) => (
                <TableRow
                  key={reg.registrationNumber}
                  sx={{
                    backgroundColor: idx % 2 === 0 ? 'background.default' : 'action.hover',
                    '&:last-child td, &:last-child th': { border: 0 }
                  }}
                >
                  <TableCell>{reg.registrationNumber}</TableCell>
                  <TableCell>{reg.firstName} {reg.lastName}</TableCell>
                  <TableCell>{reg.nationality}</TableCell>
                  <TableCell>{reg.representing}</TableCell>
                  <TableCell><StatusIndicator status={reg.status} /></TableCell>
                </TableRow>
              ))}
              {hasWaitingList && (
                <>
                  <TableRow>
                    <TableCell colSpan={5} sx={{ textAlign: 'center', fontWeight: 'bold', bgcolor: 'info.dark', color: 'info.contrastText' }}>
                      Waiting-list
                    </TableCell>
                  </TableRow>
                  {waitingList.map((reg, idx) => (
                    <TableRow
                      key={reg.registrationNumber}
                      sx={{
                        backgroundColor: idx % 2 === 0 ? 'background.default' : 'action.hover',
                        '&:last-child td, &:last-child th': { border: 0 }
                      }}
                    >
                      <TableCell>{reg.registrationNumber}</TableCell>
                      <TableCell>{reg.firstName} {reg.lastName}</TableCell>
                      <TableCell>{reg.nationality}</TableCell>
                      <TableCell>{reg.representing}</TableCell>
                      <TableCell><StatusIndicator status={reg.status} /></TableCell>
                    </TableRow>
                  ))}
                </>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      ) : (
        <Typography color="text.secondary" sx={{ mt: 4, fontStyle: 'italic' }}>No participants registered yet.</Typography>
      )}
    </Container>
  );
};

export { PublicRegistrationsPage };
export default PublicRegistrationsPage;
