import React, { useState, useEffect } from 'react';
import { Box, Button, Typography, Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TextField, Checkbox, CircularProgress } from '@mui/material';
import InviteSummaryDialog from '../components/InviteSummaryDialog';
import { fetchInvitations, addInvitation, updateInvitationSent, Invitation } from '../utils/invitationUtils';

const EDITION_ID = 'kutc-2025';

const AdminPage: React.FC = () => {
  const [invitees, setInvitees] = useState<Invitation[]>([]);
  const [loading, setLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [addEmail, setAddEmail] = useState('');
  const [addName, setAddName] = useState('');
  const [addLoading, setAddLoading] = useState(false);
  const [numToSend, setNumToSend] = useState(0);

  // Fetch invitees on mount or when changed
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      const data = await fetchInvitations(EDITION_ID);
      setInvitees(data);
      setLoading(false);
    };
    fetchData();
  }, []);

  const handleAddInvitee = async () => {
    if (!addEmail || !addName) return;
    setAddLoading(true);
    await addInvitation({ email: addEmail, name: addName, editionId: EDITION_ID });
    setAddEmail('');
    setAddName('');
    // Refresh list
    const data = await fetchInvitations(EDITION_ID);
    setInvitees(data);
    setAddLoading(false);
  };

  // Prepare eligible invitees for sending (numSent == 0 or resendFlag == true)
  const eligibleInvitees = invitees.filter(i => i.numSent === 0 || i.resendFlag === true);

  const handleSendInvitations = () => {
    setNumToSend(eligibleInvitees.length);
    setDialogOpen(true);
  };

  const handleDialogClose = () => setDialogOpen(false);

  const handleRun = async () => {
    setDialogOpen(false);
    setLoading(true);
    let successCount = 0;
    let errorCount = 0;
    for (const invitee of eligibleInvitees) {
      try {
        const { sendInvitationEmail } = await import('../services/emailService');
        await sendInvitationEmail(invitee.email, invitee.name);
        await updateInvitationSent(invitee.id!, invitee.resendFlag);
        successCount++;
      } catch (error) {
        console.error(`Failed to send invitation to ${invitee.email}:`, error);
        errorCount++;
      }
    }
    setLoading(false);
    alert(`Run: Sent ${successCount} invitations successfully.${errorCount > 0 ? ` Failed: ${errorCount}` : ''}`);
    // Refresh list
    const data = await fetchInvitations(EDITION_ID);
    setInvitees(data);
  };

  return (
    <Box display="flex" flexDirection="column" alignItems="center" justifyContent="center" minHeight="60vh">
      <Paper elevation={3} sx={{ p: 4, width: 600, maxWidth: '98%' }}>
        <Typography variant="h4" gutterBottom>Admin Panel</Typography>
        <Typography variant="body1" gutterBottom>
          Only visible to admin users. Here you can send invitations and manage event communications.
        </Typography>
        <Box mt={2} mb={2}>
          <Typography variant="h6">Add Invitee</Typography>
          <Box display="flex" gap={2} alignItems="center">
            <TextField label="Email" value={addEmail} size="small" onChange={e => setAddEmail(e.target.value)} />
            <TextField label="Name" value={addName} size="small" onChange={e => setAddName(e.target.value)} />
            <Button variant="contained" color="primary" onClick={handleAddInvitee} disabled={addLoading || !addEmail || !addName}>
              {addLoading ? <CircularProgress size={20} /> : 'Add'}
            </Button>
          </Box>
        </Box>
        <Box mt={2} mb={2}>
          <Button variant="outlined" color="secondary" onClick={async () => {
            setLoading(true);
            const { syncUsersFromRegistrations } = await import('../utils/userSyncUtils');
            await syncUsersFromRegistrations(EDITION_ID);
            setLoading(false);
            alert('User data synced from registrations.');
          }} disabled={loading} sx={{ mr: 2 }}>
            {loading ? <CircularProgress size={18} /> : 'Get user data from registrations'}
          </Button>
          <Button variant="contained" color="primary" onClick={handleSendInvitations} disabled={loading || eligibleInvitees.length === 0}>
            Send invitations ({eligibleInvitees.length} eligible)
          </Button>
        </Box>
        <TableContainer component={Paper} sx={{ maxHeight: 350 }}>
          <Table size="small" stickyHeader>
            <TableHead>
              <TableRow>
                <TableCell>Email</TableCell>
                <TableCell>Name</TableCell>
                <TableCell>numSent</TableCell>
                <TableCell>firstSent</TableCell>
                <TableCell>lastSent</TableCell>
                <TableCell>resendFlag</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {invitees.map(inv => (
                <TableRow key={inv.id}>
                  <TableCell>{inv.email}</TableCell>
                  <TableCell>{inv.name}</TableCell>
                  <TableCell>{inv.numSent}</TableCell>
                  <TableCell>{inv.firstSent ? inv.firstSent.toDate().toLocaleString() : ''}</TableCell>
                  <TableCell>{inv.lastSent ? inv.lastSent.toDate().toLocaleString() : ''}</TableCell>
                  <TableCell><Checkbox checked={!!inv.resendFlag} disabled /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>
      <InviteSummaryDialog
        open={dialogOpen}
        onClose={handleDialogClose}
        onTest={handleDialogClose}
        onRun={handleRun}
        numTest={0}
        numRun={numToSend}
        loading={loading}
      />
    </Box>
  );
};

export default AdminPage;
