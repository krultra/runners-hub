import React, { useEffect, useState } from 'react';
import { fetchPublicRegistrations, PublicRegistration } from '../utils/publicRegistrations';
import StatusIndicator from '../components/StatusIndicator';
import { Container, Typography, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper, CircularProgress, Box, Alert, Switch, FormControlLabel, Button } from '@mui/material';
import { useEventEdition } from '../contexts/EventEditionContext';
import { useNavigate } from 'react-router-dom';

interface PublicRegistrationsPageProps {
  /** 
   * The event edition ID in the format '{eventId}-{edition}[-suffix]' 
   * Example: 'mo-2025' or 'kutc-2025-turklasse'
   * - eventId: The stable, unique identifier for the event (e.g., 'mo' for Malvikingen Opp)
   * - edition: The year or edition identifier (e.g., '2025')
   * - suffix: Optional suffix for specific registration classes (e.g., 'turklasse')
   */
  editionId?: string;
}

const PublicRegistrationsPage: React.FC<PublicRegistrationsPageProps> = ({ editionId }) => {
  const { event, loading: eventLoading, error: eventError } = useEventEdition();
  const navigate = useNavigate();
  const [registrations, setRegistrations] = useState<PublicRegistration[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [showCancelled, setShowCancelled] = useState(false);

  // If no event is loaded but we have an editionId, use it to fetch the event
  useEffect(() => {
    if (editionId && !eventLoading && !event) {
      // The editionId is in the format: {eventId}-{edition}[-suffix]
      // For example: 'mo-2025-turklasse' or 'kutc-2025'
      const [eventId, edition] = editionId.split('-');
      
      if (!eventId || !edition) {
        console.error('Invalid editionId format. Expected format: {eventId}-{edition}[-suffix]');
        navigate('/');
        return;
      }
      
      console.log(`Loading event with ID: ${eventId}, edition: ${edition}`);
      // Here you would typically fetch the event using the eventId and edition
      // For example: fetchEventByIdAndEdition(eventId, edition);
      
    } else if (!editionId && !eventLoading && !event) {
      // No editionId provided and no event in context - just try to load without event
      // This allows the page to work when accessed directly via URL
      console.log('No event in context, page will load when event is available');
    }
  }, [editionId, event, eventLoading, navigate]);

  // Load registrations when event is available or when editionId changes
  useEffect(() => {
    const loadRegistrations = async (id: string) => {
      setLoading(true);
      try {
        const data = await fetchPublicRegistrations(id);
        setRegistrations(data);
      } catch (error) {
        console.error('Error loading registrations:', error);
      } finally {
        setLoading(false);
      }
    };

    if (event?.id) {
      loadRegistrations(event.id);
    } else if (editionId) {
      // If we have an editionId but no event, use it directly
      // This assumes fetchPublicRegistrations can handle the editionId format
      loadRegistrations(editionId);
    }
  }, [event?.id, editionId]);

  if (eventLoading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="200px">
        <CircularProgress />
      </Box>
    );
  }

  if (eventError) {
    return (
      <Container maxWidth="md" sx={{ mt: 4, mb: 4 }}>
        <Alert severity="error">
          Error loading event: {eventError.message}
        </Alert>
        <Button variant="contained" onClick={() => navigate('/')} sx={{ mt: 2 }}>
          Back to Home
        </Button>
      </Container>
    );
  }

  if (!event) {
    return (
      <Container maxWidth="md" sx={{ mt: 4, mb: 4 }}>
        <Alert severity="info">
          Please select an event to view participants.
        </Alert>
        <Button variant="contained" onClick={() => navigate('/')} sx={{ mt: 2 }}>
          Select Event
        </Button>
      </Container>
    );
  }

  const regsList = registrations || [];
  const filteredRegs = regsList.filter(r => showCancelled || ['pending','confirmed'].includes(r.status));
  const now = new Date();
  const isExpiredWl = (r: PublicRegistration) => !!(r.isOnWaitinglist && r.waitinglistExpires && r.waitinglistExpires <= now);
  // Display lists (include cancelled when toggled on)
  const participants = filteredRegs.filter(r => !r.isOnWaitinglist);
  const waitingList = filteredRegs.filter(r => r.isOnWaitinglist && (showCancelled || !isExpiredWl(r)));
  // Stable indices computed from ACTIVE entries only
  const activeParticipants = regsList.filter(r => ['pending','confirmed'].includes(r.status) && !r.isOnWaitinglist);
  const activeWaiting = regsList.filter(r => ['pending','confirmed'].includes(r.status) && r.isOnWaitinglist && !isExpiredWl(r));
  const participantIndexByRegNo = new Map<number, number>();
  activeParticipants.forEach((r, i) => participantIndexByRegNo.set(r.registrationNumber, i + 1));
  const waitingIndexByRegNo = new Map<number, number>();
  activeWaiting.forEach((r, i) => waitingIndexByRegNo.set(r.registrationNumber, i + 1));

  const formatIndexOrBib = (reg: PublicRegistration, indexMap: Map<number, number>) => {
    if (reg.bib !== undefined && reg.bib !== null && reg.bib !== '') {
      return reg.bib;
    }
    return indexMap.get(reg.registrationNumber) ?? '';
  };
  const usesBibNumbers = regsList.some(r => r.bib !== undefined && r.bib !== null && r.bib !== '');
  const indexHeaderLabel = usesBibNumbers ? 'Bib' : '#';
  // Counts
  const participantsCount = activeParticipants.length;
  const waitingListCount = showCancelled ? regsList.filter(r => ['pending','confirmed'].includes(r.status) && r.isOnWaitinglist).length : activeWaiting.length;
  const hasWaitingList = waitingList.length > 0;
  const distanceLabelById = new Map((event.raceDistances || []).map(d => [d.id, d.displayName || d.id]));

  return (
    <Container maxWidth="md" sx={{ mt: 4 }}>
      <Typography variant="h4" gutterBottom sx={{ fontWeight: 700, letterSpacing: 0.5 }}>
        {event.eventName} {event.edition} – {hasWaitingList ? 'Participants and Waiting-list' : 'Registered Participants'}
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
                <TableCell sx={{ fontWeight: 600, bgcolor: 'info.dark', color: 'info.contrastText', borderBottom: 2, borderColor: 'info.dark' }}>{indexHeaderLabel}</TableCell>
                <TableCell sx={{ fontWeight: 600, bgcolor: 'info.dark', color: 'info.contrastText', borderBottom: 2, borderColor: 'info.dark' }}>Name</TableCell>
                <TableCell sx={{ fontWeight: 600, bgcolor: 'info.dark', color: 'info.contrastText', borderBottom: 2, borderColor: 'info.dark' }}>Nationality</TableCell>
                <TableCell sx={{ fontWeight: 600, bgcolor: 'info.dark', color: 'info.contrastText', borderBottom: 2, borderColor: 'info.dark' }}>Representing</TableCell>
                <TableCell sx={{ fontWeight: 600, bgcolor: 'info.dark', color: 'info.contrastText', borderBottom: 2, borderColor: 'info.dark' }}>Race distance</TableCell>
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
                  <TableCell>{formatIndexOrBib(reg, participantIndexByRegNo)}</TableCell>
                  <TableCell>{reg.firstName} {reg.lastName}</TableCell>
                  <TableCell>{reg.nationality}</TableCell>
                  <TableCell>{reg.representing}</TableCell>
                  <TableCell>{distanceLabelById.get(reg.raceDistance) || reg.raceDistance || '-'}</TableCell>
                  <TableCell><StatusIndicator status={reg.status} /></TableCell>
                </TableRow>
              ))}
              {hasWaitingList && (
                <>
                  <TableRow>
                    <TableCell colSpan={6} sx={{ textAlign: 'center', fontWeight: 'bold', bgcolor: 'info.dark', color: 'info.contrastText' }}>
                      Waiting-list
                    </TableCell>
                  </TableRow>
                  {waitingList.map((reg, idx) => {
                    const expired = isExpiredWl(reg);
                    const displayStatus = expired ? 'expired' : reg.status;
                    return (
                    <TableRow
                      key={reg.registrationNumber}
                      sx={{
                        backgroundColor: idx % 2 === 0 ? 'background.default' : 'action.hover',
                        '&:last-child td, &:last-child th': { border: 0 }
                      }}
                    >
                      <TableCell>{!expired ? formatIndexOrBib(reg, waitingIndexByRegNo) : ''}</TableCell>
                      <TableCell>{reg.firstName} {reg.lastName}</TableCell>
                      <TableCell>{reg.nationality}</TableCell>
                      <TableCell>{reg.representing}</TableCell>
                      <TableCell>{distanceLabelById.get(reg.raceDistance) || reg.raceDistance || '-'}</TableCell>
                      <TableCell><StatusIndicator status={displayStatus} /></TableCell>
                    </TableRow>
                  );})}
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
