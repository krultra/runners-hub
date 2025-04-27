import React, { useState, useEffect } from 'react';
import { useTheme, Box, Typography, TextField, Button, CircularProgress, TableContainer, Paper, Table, TableHead, TableRow, TableCell, TableBody, FormControl, InputLabel, Select, MenuItem } from '@mui/material';
import { getRegistrationsByEdition, updateRegistration, addPaymentToRegistration, generateTestRegistrations } from '../../services/registrationService';
import { listRegistrationStatuses, RegistrationStatus } from '../../services/statusService';
import { Registration, PaymentMethod } from '../../types';
import { CURRENT_EDITION_ID } from '../../constants/events';

const RegistrationsPanel: React.FC = () => {
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [statuses, setStatuses] = useState<RegistrationStatus[]>([]);
  const [regLoading, setRegLoading] = useState(false);
  const [paymentForms, setPaymentForms] = useState<Record<string, { amount: string; method: PaymentMethod; comment: string }>>({});
  const [testCount, setTestCount] = useState('');
  const [testLoading, setTestLoading] = useState(false);

  const theme = useTheme();

  useEffect(() => {
    const loadData = async () => {
      setRegLoading(true);
      const regs = await getRegistrationsByEdition(CURRENT_EDITION_ID);
      const sts = await listRegistrationStatuses();
      setRegistrations(regs);
      setStatuses(sts);
      setRegLoading(false);
    };
    loadData();
  }, []);

  const handlePaymentFormChange = (id: string, field: string, value: string) => {
    setPaymentForms(prev => ({
      ...prev,
      [id]: { ...prev[id], [field]: value }
    }));
  };

  const handleAddPayment = async (id: string) => {
    const form = paymentForms[id];
    if (!form?.amount || isNaN(Number(form.amount))) return;
    await addPaymentToRegistration(id, { amount: Number(form.amount), method: form.method, comment: form.comment, date: new Date() });
    const regs = await getRegistrationsByEdition(CURRENT_EDITION_ID);
    setRegistrations(regs);
    setPaymentForms(prev => ({ ...prev, [id]: { amount: '', method: 'vipps', comment: '' } }));
  };

  const handleStatusChange = async (id: string, status: string) => {
    await updateRegistration(id, { status }, false);
    setRegistrations(prev => prev.map(r => r.id === id ? { ...r, status } : r));
  };

  const handleListChange = async (id: string, listType: string) => {
    const isOnWaitinglist = listType === 'waiting-list';
    await updateRegistration(id, { isOnWaitinglist }, false);
    setRegistrations(prev => prev.map(r => r.id === id ? { ...r, isOnWaitinglist } : r));
  };

  const handleGenerateTest = async () => {
    setTestLoading(true);
    await generateTestRegistrations(CURRENT_EDITION_ID, parseInt(testCount, 10));
    const regs = await getRegistrationsByEdition(CURRENT_EDITION_ID);
    setRegistrations(regs);
    setTestLoading(false);
  };

  // registration summary counts
  const participants = registrations.filter(r => !r.isOnWaitinglist);
  const participantsPending = participants.filter(r => r.status === 'pending').length;
  const participantsConfirmed = participants.filter(r => r.status === 'confirmed').length;
  const participantsTotal = participants.length;
  const waitingList = registrations.filter(r => r.isOnWaitinglist);
  const waitingPending = waitingList.filter(r => r.status === 'pending').length;
  const waitingConfirmed = waitingList.filter(r => r.status === 'confirmed').length;
  const waitingTotal = waitingList.length;
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
              <TableCell>{participantsTotal + waitingTotal}</TableCell>
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
        <TextField label="Test Count" type="number" size="small" value={testCount} onChange={e => setTestCount(e.target.value)} />
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
              <TableCell>Race</TableCell>
              <TableCell>Req.</TableCell>
              <TableCell>Paid</TableCell>
              <TableCell>Add Payment</TableCell>
              <TableCell>List</TableCell>
              <TableCell>Status</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {registrations.map(reg => (
              <TableRow key={reg.id}>
                <TableCell>{reg.registrationNumber ?? ''}</TableCell>
                <TableCell>{reg.firstName} {reg.lastName}</TableCell>
                <TableCell>{reg.raceDistance}</TableCell>
                <TableCell>{reg.paymentRequired}</TableCell>
                <TableCell>{reg.paymentMade}</TableCell>
                <TableCell>
                  <Box display="flex" alignItems="center" gap={1}>
                    <FormControl size="small">
                      <InputLabel>Method</InputLabel>
                      <Select value={paymentForms[reg.id!]?.method ?? 'vipps'} label="Method" onChange={e => handlePaymentFormChange(reg.id!, 'method', e.target.value)}>
                        <MenuItem value="vipps">Vipps</MenuItem>
                        <MenuItem value="bank transfer">Bank Transfer</MenuItem>
                        <MenuItem value="paypal">PayPal</MenuItem>
                        <MenuItem value="cash">Cash</MenuItem>
                        <MenuItem value="other">Other</MenuItem>
                      </Select>
                    </FormControl>
                    <TextField size="small" type="number" value={paymentForms[reg.id!]?.amount ?? ''} onChange={e => handlePaymentFormChange(reg.id!, 'amount', e.target.value)} placeholder="Amount" />
                    <TextField size="small" value={paymentForms[reg.id!]?.comment ?? ''} onChange={e => handlePaymentFormChange(reg.id!, 'comment', e.target.value)} placeholder="Comment" />
                    <Button variant="contained" size="small" onClick={() => handleAddPayment(reg.id!)} disabled={!paymentForms[reg.id!]?.amount}>
                      Add
                    </Button>
                  </Box>
                </TableCell>
                <TableCell>
                  <FormControl size="small">
                    <InputLabel>List</InputLabel>
                    <Select value={reg.isOnWaitinglist ? 'waiting-list' : 'participant'} label="List" onChange={e => handleListChange(reg.id!, e.target.value as string)}>
                      <MenuItem value="participant">Participant</MenuItem>
                      <MenuItem value="waiting-list">Waiting-list</MenuItem>
                    </Select>
                  </FormControl>
                </TableCell>
                <TableCell>
                  <FormControl size="small">
                    <InputLabel>Status</InputLabel>
                    <Select value={reg.status ?? ''} onChange={e => handleStatusChange(reg.id!, e.target.value as string)}>
                      {statuses.map(s => <MenuItem key={s.id} value={s.label}>{s.label}</MenuItem>)}
                    </Select>
                  </FormControl>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
      )}
    </Box>
  );
};

export default RegistrationsPanel;
