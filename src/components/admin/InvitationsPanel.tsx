import React, { useState, useEffect, useCallback } from 'react';
import { Box, Typography, TextField, Button, CircularProgress, TableContainer, Paper, Table, TableHead, TableRow, TableCell, TableBody, Checkbox, Alert } from '@mui/material';
import { fetchInvitations, addInvitation, updateInvitationSent, setResendFlag, Invitation } from '../../utils/invitationUtils';
import InviteSummaryDialog from '../InviteSummaryDialog';
import { sendInvitationEmail } from '../../services/emailService';
import { useEventEdition } from '../../contexts/EventEditionContext';

const InvitationsPanel: React.FC = () => {
  const { event: selectedEvent } = useEventEdition();
  const [invitees, setInvitees] = useState<Invitation[]>([]);
  const [loading, setLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [addEmail, setAddEmail] = useState('');
  const [addName, setAddName] = useState('');
  const [addLoading, setAddLoading] = useState(false);
  const [numToSend, setNumToSend] = useState(0);

  // fetch invitations when selected event changes
  const loadInvitations = useCallback(async () => {
    if (!selectedEvent?.id) return;
    setLoading(true);
    try {
      const data = await fetchInvitations(selectedEvent.id);
      setInvitees(data);
    } catch (error) {
      console.error('Error loading invitations:', error);
    } finally {
      setLoading(false);
    }
  }, [selectedEvent?.id]);

  useEffect(() => {
    loadInvitations();
  }, [loadInvitations]);

  const handleAddInvitee = async () => {
    if (!addEmail || !addName || !selectedEvent?.id) return;
    setAddLoading(true);
    try {
      await addInvitation({ email: addEmail, name: addName, editionId: selectedEvent.id });
      setAddEmail('');
      setAddName('');
      await loadInvitations();
    } catch (error) {
      console.error('Error adding invitee:', error);
    } finally {
      setAddLoading(false);
    }
  };

  const eligibleInvitees = invitees.filter(inv => inv.numSent === 0 || inv.resendFlag);

  const handleSendInvitations = () => {
    setNumToSend(eligibleInvitees.length);
    setDialogOpen(true);
  };

  const handleDialogClose = () => setDialogOpen(false);

  const handleRun = async () => {
    if (!selectedEvent?.id) return;
    
    setDialogOpen(false);
    setLoading(true);
    let successCount = 0;
    let errorCount = 0;
    
    for (const invite of eligibleInvitees) {
      try {
        // Include the event edition ID in the context
        await sendInvitationEmail(invite.email, invite.name, { editionId: selectedEvent.id });
        await updateInvitationSent(invite.id!, invite.resendFlag);
        successCount++;
      } catch (error) {
        console.error(`Failed to send invitation to ${invite.email}:`, error);
        errorCount++;
      }
    }
    
    setLoading(false);
    alert(`Sent ${successCount} invitations.${errorCount > 0 ? ` Failed: ${errorCount}` : ''}`);
    await loadInvitations();
  };

  // Toggle resend flag for an invitation
  const handleResendToggle = async (id: string, checked: boolean) => {
    await setResendFlag(id, checked);
    setInvitees(prev => prev.map(inv => inv.id === id ? { ...inv, resendFlag: checked } : inv));
  };

  if (!selectedEvent) {
    return (
      <Box p={3}>
        <Alert severity="info">Please select an event edition to manage invitations.</Alert>
      </Box>
    );
  }

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
        <Typography variant="h5" color="textSecondary">Invitations</Typography>
        <Typography variant="subtitle1" color="textSecondary">
          {selectedEvent.eventName} {selectedEvent.edition}
        </Typography>
      </Box>
      <Box display="flex" gap={2} alignItems="center" mt={2}>
        <TextField label="Email" value={addEmail} size="small" onChange={e => setAddEmail(e.target.value)} />
        <TextField label="Name" value={addName} size="small" onChange={e => setAddName(e.target.value)} />
        <Button variant="contained" color="primary" onClick={handleAddInvitee} disabled={addLoading || !addEmail || !addName || !selectedEvent?.id}>
          {addLoading ? <CircularProgress size={20} /> : 'Add'}
        </Button>
      </Box>
      <Box display="flex" gap={2} mt={2} mb={2}>
        <Button variant="contained" color="primary" onClick={handleSendInvitations} disabled={loading || eligibleInvitees.length === 0}>
          Send Invitations ({eligibleInvitees.length})
        </Button>
      </Box>
      <TableContainer component={Paper}>
        <Table size="small" stickyHeader>
          <TableHead>
            <TableRow>
              <TableCell>Email</TableCell>
              <TableCell>Name</TableCell>
              <TableCell>Sent Count</TableCell>
              <TableCell>First Sent</TableCell>
              <TableCell>Last Sent</TableCell>
              <TableCell>Resend</TableCell>
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
                <TableCell><Checkbox checked={inv.resendFlag} onChange={e => handleResendToggle(inv.id!, e.target.checked)} /></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
      <InviteSummaryDialog
        open={dialogOpen}
        onClose={handleDialogClose}
        onRun={handleRun}
        numRun={numToSend}
        loading={loading}
      />
    </Box>
  );
};

export default InvitationsPanel;
