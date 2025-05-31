import React, { useState, useEffect, useCallback } from 'react';
import { useTheme, Box, Typography, TextField, Button, CircularProgress, TableContainer, Paper, Table, TableHead, TableRow, TableCell, TableBody, Alert } from '@mui/material';
import RegistrationDetailsDialog from './RegistrationDetailsDialog';
import { getRegistrationsByEdition, generateTestRegistrations } from '../../services/registrationService';
import { listCodeList } from '../../services/codeListService';
import { Registration } from '../../types';
import { useEventEdition } from '../../contexts/EventEditionContext';

// Replacement for the deleted statusService
interface RegistrationStatus {
  id: string;
  label: string;
}

const RegistrationsPanel: React.FC = () => {
  const { event: selectedEvent } = useEventEdition();
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [statuses, setStatuses] = useState<RegistrationStatus[]>([]);
  const [regLoading, setRegLoading] = useState(false);
  const [testCount, setTestCount] = useState<number>(0);
  const [testLoading, setTestLoading] = useState(false);

  const theme = useTheme();

  // State for details dialog
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedReg, setSelectedReg] = useState<Registration | null>(null);

  // Load registrations and statuses
  const loadData = useCallback(async () => {
    if (!selectedEvent?.id) return;
    setRegLoading(true);
    try {
      const regs = await getRegistrationsByEdition(selectedEvent.id);
      // sort by registrationNumber ascending
      regs.sort((a, b) => Number(a.registrationNumber) - Number(b.registrationNumber));
      // Get statuses from codeLists collection
      const codeListItems = await listCodeList('status', 'registrations');
      // Map to the expected RegistrationStatus interface
      const sts = codeListItems.map(item => ({
        id: item.id,
        label: item.code
      }));
      setRegistrations(regs);
      setStatuses(sts);
    } catch (error) {
      console.error('Error loading registrations:', error);
    } finally {
      setRegLoading(false);
    }
  }, [selectedEvent?.id]);

  // Load data when selected event changes
  useEffect(() => {
    loadData();
  }, [loadData]);

  // Handlers for details dialog
  const openDetails = (reg: Registration) => {
    setSelectedReg(reg);
    setDialogOpen(true);
  };
  const closeDetails = () => {
    setDialogOpen(false);
    setSelectedReg(null);
  };
  const handleUpdate = () => { loadData(); };

  const handleGenerateTest = async () => {
    if (!selectedEvent?.id) return;
    setTestLoading(true);
    try {
      await generateTestRegistrations(selectedEvent.id, testCount);
      const regs = await getRegistrationsByEdition(selectedEvent.id);
      // sort by registrationNumber ascending
      regs.sort((a, b) => Number(a.registrationNumber) - Number(b.registrationNumber));
      setRegistrations(regs);
    } catch (error) {
      console.error('Error generating test data:', error);
    } finally {
      setTestLoading(false);
    }
  };

  // registration summary counts
  const participants = registrations.filter(r => !r.isOnWaitinglist);
  const participantsPending = participants.filter(r => r.status === 'pending').length;
  const participantsConfirmed = participants.filter(r => r.status === 'confirmed').length;
  const waitingList = registrations.filter(r => r.isOnWaitinglist);
  const waitingPending = waitingList.filter(r => r.status === 'pending').length;
  const waitingConfirmed = waitingList.filter(r => r.status === 'confirmed').length;
  const cancelledCount = registrations.filter(r => r.status === 'cancelled').length;
  const expiredCount = registrations.filter(r => r.status === 'expired').length;

  if (!selectedEvent) {
    return (
      <Box p={3}>
        <Alert severity="info">Please select an event edition to view registrations.</Alert>
      </Box>
    );
  }

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
        <Typography variant="h5">Registrations & Payment Status</Typography>
        <Typography variant="subtitle1" color="textSecondary">
          {selectedEvent.eventName} {selectedEvent.edition}
        </Typography>
      </Box>
      <TableContainer component={Paper} sx={{ mt: 2, mb: 2 }}>
        <Table size="small" stickyHeader>
          <TableHead>
            <TableRow>
              <TableCell>Status</TableCell>
              <TableCell>Participants</TableCell>
              <TableCell>Waiting-list</TableCell>
              <TableCell>Total</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            <TableRow>
              <TableCell component="th" scope="row" sx={{ fontWeight: 'bold' }}>Pending</TableCell>
              <TableCell>{participantsPending}</TableCell>
              <TableCell>{waitingPending}</TableCell>
              <TableCell>{participantsPending + waitingPending}</TableCell>
            </TableRow>
            <TableRow>
              <TableCell component="th" scope="row" sx={{ fontWeight: 'bold' }}>Confirmed</TableCell>
              <TableCell>{participantsConfirmed}</TableCell>
              <TableCell>{waitingConfirmed}</TableCell>
              <TableCell>{participantsConfirmed + waitingConfirmed}</TableCell>
            </TableRow>
            <TableRow 
              sx={{ 
                position: 'sticky',
                top: '48px',
                zIndex: 2,
                backgroundColor: 'background.paper',
                borderBottom: '1px solid',
                borderColor: 'divider',
                '& th, & td': {
                  backgroundColor: 'inherit'
                }
              }}
            >
              <TableCell component="th" scope="row" sx={{ fontWeight: 'bold' }}>Sum active reg.</TableCell>
              <TableCell>{participantsPending + participantsConfirmed}</TableCell>
              <TableCell>{waitingPending + waitingConfirmed}</TableCell>
              <TableCell>{participantsPending + participantsConfirmed + waitingPending + waitingConfirmed}</TableCell>
            </TableRow>
            <TableRow>
              <TableCell component="th" scope="row" sx={{ fontWeight: 'bold' }}>Cancelled</TableCell>
              <TableCell>{registrations.filter(r => !r.isOnWaitinglist && r.status==='cancelled').length}</TableCell>
              <TableCell>{registrations.filter(r => r.isOnWaitinglist && r.status==='cancelled').length}</TableCell>
              <TableCell>{cancelledCount}</TableCell>
            </TableRow>
            <TableRow>
              <TableCell component="th" scope="row" sx={{ fontWeight: 'bold' }}>Expired</TableCell>
              <TableCell>{registrations.filter(r => !r.isOnWaitinglist && r.status==='expired').length}</TableCell>
              <TableCell>{registrations.filter(r => r.isOnWaitinglist && r.status==='expired').length}</TableCell>
              <TableCell>{expiredCount}</TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </TableContainer>
      <Box display="flex" alignItems="center" gap={2} mb={2}>
        <TextField
          type="number"
          label="Number of test registrations"
          value={testCount}
          onChange={(e) => setTestCount(parseInt(e.target.value) || 0)}
          size="small"
          sx={{ width: 250 }}
          disabled={!selectedEvent.id}
        />
        <Button variant="contained" onClick={handleGenerateTest} disabled={!testCount || testLoading}>
          {testLoading ? <CircularProgress size={20} /> : 'Generate Test Registrations'}
        </Button>
      </Box>
      {regLoading ? (
        <CircularProgress />
      ) : (
      <TableContainer component={Paper} sx={{ mt: 2 }}>
        <Table size="small" stickyHeader>
          <TableHead>
            <TableRow>
              <TableCell>#</TableCell>
              <TableCell>Name</TableCell>
              <TableCell>Paid</TableCell>
              <TableCell>List</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {registrations.map(reg => (
              <TableRow key={reg.id}>
                <TableCell>{reg.registrationNumber}</TableCell>
                <TableCell>{reg.firstName} {reg.lastName}</TableCell>
                <TableCell>{reg.paymentMade}</TableCell>
                <TableCell>{reg.isOnWaitinglist ? 'Waiting-list' : 'Participant'}</TableCell>
                <TableCell>{reg.status}</TableCell>
                <TableCell>
                  <Button size="small" onClick={() => openDetails(reg)}>Details</Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
      )}
      {selectedReg && (
        <RegistrationDetailsDialog
          open={dialogOpen}
          registration={selectedReg}
          statuses={statuses}
          onClose={closeDetails}
          onUpdate={handleUpdate}
        />
      )}
    </Box>
  );
};

export default RegistrationsPanel;
