import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  TextField,
  Box,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Table,
  TableBody,
  TableRow,
  TableCell,
  SelectChangeEvent,
} from '@mui/material';
import { Registration, Payment, PaymentMethod } from '../../types';
import {
  updateRegistration,
  addPaymentToRegistration,
  updateRegistrationStatus,
  getRegistrationById,
} from '../../services/registrationService';
import {
  sendPaymentConfirmationEmail,
  sendWaitingListEmail,
  sendRegistrationCancellationEmail,
  sendRegistrationExpirationEmail,
  sendStatusChangedEmail,
  EmailType,
} from '../../services/emailService';
import { RegistrationStatus } from '../../services/statusService';

interface Props {
  open: boolean;
  registration: Registration;
  statuses: RegistrationStatus[];
  onClose: () => void;
  onUpdate: () => void;
}

const RegistrationDetailsDialog: React.FC<Props> = ({ open, registration, statuses, onClose, onUpdate }) => {
  const [isOnWaitinglist, setIsOnWaitinglist] = useState(registration.isOnWaitinglist || false);
  const [status, setStatus] = useState(registration.status || '');
  const [payments, setPayments] = useState<Payment[]>(registration.payments || []);
  const [paymentForm, setPaymentForm] = useState<{ amount: string; method: PaymentMethod; comment: string }>({ amount: '', method: 'vipps', comment: '' });
  const [commentDialogOpen, setCommentDialogOpen] = useState(false);
  const [adminComment, setAdminComment] = useState('');
  const [emailDialogOpen, setEmailDialogOpen] = useState(false);
  const [selectedEmailType, setSelectedEmailType] = useState<EmailType>(EmailType.PAYMENT_CONFIRMATION);
  const allEmailTypes = Object.values(EmailType);
  const [adminCommentsList, setAdminCommentsList] = useState(registration.adminComments || []);

  useEffect(() => {
    setIsOnWaitinglist(registration.isOnWaitinglist || false);
    setStatus(registration.status || '');
    setPayments(registration.payments || []);
    setAdminCommentsList(registration.adminComments || []);
  }, [registration]);

  const refreshReg = async () => {
    const fresh = await getRegistrationById(registration.id!);
    if (!fresh) return;
    setIsOnWaitinglist(fresh.isOnWaitinglist || false);
    setStatus(fresh.status || '');
    setPayments(fresh.payments || []);
    setAdminCommentsList(fresh.adminComments || []);
  };

  const handleListChange = async (e: SelectChangeEvent<string>) => {
    const listType = e.target.value;
    const newList = listType === 'waiting-list';
    await updateRegistration(registration.id!, { isOnWaitinglist: newList }, false);
    setIsOnWaitinglist(newList);
    onUpdate();
  };

  const handleStatusSelect = (e: SelectChangeEvent<string>) => {
    setStatus(e.target.value);
    setAdminComment('');
    setCommentDialogOpen(true);
  };

  const confirmStatusChange = async () => {
    setCommentDialogOpen(false);
    // refresh and prompt email
    await updateRegistrationStatus(registration.id!, status, adminComment.trim() || undefined);
    await refreshReg();
    const def =
      status === 'cancelled'
        ? EmailType.CANCELLATION
        : status === 'expired'
        ? EmailType.EXPIRATION
        : EmailType.STATUS_CHANGED;
    setSelectedEmailType(def);
    setEmailDialogOpen(true);
  };

  const handleAddPayment = async () => {
    const amount = Number(paymentForm.amount);
    if (!amount) return;
    await addPaymentToRegistration(registration.id!, {
      amount,
      method: paymentForm.method,
      comment: paymentForm.comment,
      date: new Date(),
    });
    setPaymentForm({ amount: '', method: 'vipps', comment: '' });
    // refresh local details
    await refreshReg();
    const fresh = await getRegistrationById(registration.id!);
    if (fresh && fresh.status === 'pending' && fresh.paymentMade >= fresh.paymentRequired) {
      // full payment: confirm status
      await updateRegistrationStatus(fresh.id!, 'confirmed', undefined);
      await refreshReg();
      onUpdate();
      // prompt email
      const def = fresh.isOnWaitinglist
        ? EmailType.WAITING_LIST_CONFIRMATION
        : EmailType.PAYMENT_CONFIRMATION;
      setSelectedEmailType(def);
      setEmailDialogOpen(true);
    } else {
      onUpdate();
    }
  };

  const confirmSendEmail = async () => {
    try {
      const fullReg = await getRegistrationById(registration.id!);
      if (fullReg) {
        // ensure correct recipient
        const toEmail = fullReg.originalEmail || fullReg.email;
        const regForEmail = { ...fullReg, email: toEmail };
        switch (selectedEmailType) {
          case EmailType.PAYMENT_CONFIRMATION:
            await sendPaymentConfirmationEmail(regForEmail);
            break;
          case EmailType.WAITING_LIST_CONFIRMATION:
            await sendWaitingListEmail(regForEmail);
            break;
          case EmailType.CANCELLATION:
            await sendRegistrationCancellationEmail(regForEmail);
            break;
          case EmailType.EXPIRATION:
            await sendRegistrationExpirationEmail(regForEmail);
            break;
          case EmailType.STATUS_CHANGED:
            await sendStatusChangedEmail(regForEmail);
            break;
        }
        // refresh views
        await refreshReg();
        onUpdate();
      }
    } catch (error) {
      console.error('Error sending email:', error);
    } finally {
      setEmailDialogOpen(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Registration #{registration.registrationNumber}</DialogTitle>
      <DialogContent>
        <Typography variant="subtitle1">
          {registration.firstName} {registration.lastName}
        </Typography>
        <Typography variant="body2">Email: {registration.originalEmail || registration.email}</Typography>
        <Typography variant="body2">Race: {registration.raceDistance}</Typography>
        <Typography variant="body2">Payment Made: {registration.paymentMade}</Typography>

        <FormControl fullWidth margin="normal">
          <InputLabel>List</InputLabel>
          <Select value={isOnWaitinglist ? 'waiting-list' : 'participant'} label="List" onChange={handleListChange}>
            <MenuItem value="participant">Participant</MenuItem>
            <MenuItem value="waiting-list">Waiting-list</MenuItem>
          </Select>
        </FormControl>

        <FormControl fullWidth margin="normal">
          <InputLabel>Status</InputLabel>
          <Select value={status} label="Status" onChange={handleStatusSelect}>
            {statuses.map(s => (
              <MenuItem key={s.id} value={s.label}>{s.label}</MenuItem>
            ))}
          </Select>
        </FormControl>

        <Typography variant="h6" sx={{ mt: 2 }}>Payments</Typography>
        <Table size="small">
          <TableBody>
            {payments.map((p, i) => (
              <TableRow key={i}>
                <TableCell>{p.method}</TableCell>
                <TableCell>{p.amount}</TableCell>
                <TableCell>{p.comment}</TableCell>
                <TableCell>{new Date(p.date).toLocaleDateString()}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        <Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
          <FormControl size="small">
            <Select value={paymentForm.method} onChange={e => setPaymentForm(f => ({ ...f, method: e.target.value as PaymentMethod }))}>
              {['vipps','bank transfer','paypal','cash','other'].map(m => (
                <MenuItem key={m} value={m}>{m}</MenuItem>
              ))}
            </Select>
          </FormControl>
          <TextField
            size="small"
            label="Amount"
            value={paymentForm.amount}
            onChange={e => setPaymentForm(f => ({ ...f, amount: e.target.value }))}
          />
          <TextField
            size="small"
            label="Comment"
            value={paymentForm.comment}
            onChange={e => setPaymentForm(f => ({ ...f, comment: e.target.value }))}
          />
          <Button variant="contained" onClick={handleAddPayment}>Add</Button>
        </Box>

        {/* Admin comments section */}
        <Typography variant="h6" sx={{ mt: 2 }}>Admin Comments</Typography>
        <Table size="small">
          <TableBody>
            {(adminCommentsList || []).map((c, i) => (
              <TableRow key={i}>
                <TableCell>{c.text}</TableCell>
                <TableCell>{c.at.toDate ? c.at.toDate().toLocaleString() : new Date(c.at).toLocaleString()}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>

      <Dialog open={commentDialogOpen} onClose={() => setCommentDialogOpen(false)}>
        <DialogTitle>Admin Comment</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Comment"
            fullWidth
            multiline
            minRows={3}
            value={adminComment}
            onChange={e => setAdminComment(e.target.value)}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCommentDialogOpen(false)}>Cancel</Button>
          <Button onClick={confirmStatusChange} autoFocus>Confirm</Button>
        </DialogActions>
      </Dialog>

      {/* Email confirmation dialog */}
      <Dialog open={emailDialogOpen} onClose={() => setEmailDialogOpen(false)}>
        <DialogTitle>Send Email</DialogTitle>
        <DialogContent>
          <Typography>Select template and confirm sending:</Typography>
          <FormControl fullWidth margin="normal">
            <InputLabel>Template</InputLabel>
            <Select
              value={selectedEmailType}
              label="Template"
              onChange={e => setSelectedEmailType(e.target.value as EmailType)}
            >
              {allEmailTypes.map(opt => (
                <MenuItem key={opt} value={opt}>
                  {opt.replace(/_/g, ' ')}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEmailDialogOpen(false)}>No</Button>
          <Button onClick={confirmSendEmail} autoFocus>
            Yes
          </Button>
        </DialogActions>
      </Dialog>
    </Dialog>
  );
};

export default RegistrationDetailsDialog;
