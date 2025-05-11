import React, { useState, useEffect, useCallback } from 'react';
import { useTheme, Box, Typography, TextField, Button, CircularProgress, TableContainer, Paper, Table, TableHead, TableRow, TableCell, TableBody } from '@mui/material';
import RegistrationDetailsDialog from './RegistrationDetailsDialog';
import { getRegistrationsByEdition, generateTestRegistrations } from '../../services/registrationService';
import { listCodeList } from '../../services/codeListService';
import { Registration } from '../../types';
import { listEventEditions } from '../../services/eventEditionService';

// Replacement for the deleted statusService
interface RegistrationStatus {
  id: string;
  label: string;
}

const RegistrationsPanel: React.FC = () => {
  const [currentEditionId, setCurrentEditionId] = useState<string>('');
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
    if (!currentEditionId) return;
    setRegLoading(true);
    const regs = await getRegistrationsByEdition(currentEditionId);
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
    setRegLoading(false);
  }, [currentEditionId]);

  // Fetch release editions and then load data
  useEffect(() => {
    (async () => {
      const editions = await listEventEditions();
      if (editions.length > 0) setCurrentEditionId(editions[editions.length - 1].id);
    })();
  }, []);
  useEffect(() => { if (currentEditionId) loadData(); }, [loadData, currentEditionId]);

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
    if (!currentEditionId) return;
    setTestLoading(true);
    await generateTestRegistrations(currentEditionId, testCount);
    const regs = await getRegistrationsByEdition(currentEditionId);
    // sort by registrationNumber ascending
    regs.sort((a, b) => Number(a.registrationNumber) - Number(b.registrationNumber));
    setRegistrations(regs);
    setTestLoading(false);
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

  return (
    <Box>
      <Typography variant="h5">Registrations & Payment Status</Typography>
      <TableContainer component={Paper} sx={{ mt: 2, mb: 2 }}>
        <Table size="small">
          <TableHead>
            <TableRow sx={{ backgroundColor: theme.palette.grey[200] }}>
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
            <TableRow sx={{ backgroundColor: theme.palette.grey[100] }}>
              <TableCell component="th" scope="row" sx={{ fontWeight: 'bold' }}>Sum p/c</TableCell>
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
      <Box display="flex" gap={2} alignItems="center" mt={2}>
        <TextField label="Test Count" type="number" size="small" value={testCount} onChange={e => setTestCount(Number(e.target.value))} />
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
