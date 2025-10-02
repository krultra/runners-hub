import React, { useState, useEffect, useRef } from 'react';
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
  TableHead,
  TableRow,
  TableCell,
  TableContainer,
  SelectChangeEvent,
} from '@mui/material';
import { FormControlLabel, Checkbox } from '@mui/material';
import CircularProgress from '@mui/material/CircularProgress';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import {
  onSnapshot,
  DocumentReference,
} from 'firebase/firestore';
import { doc, updateDoc, getDoc, arrayUnion, Timestamp } from 'firebase/firestore';
import { db } from '../../config/firebase';
import {
  Registration,
  Payment,
  PaymentMethod
} from '../../types';
import { useEventEdition } from '../../contexts/EventEditionContext';
import {
  updateRegistration,
  addPaymentToRegistration,
  updateRegistrationStatus,
  getRegistrationById,
} from '../../services/registrationService';
import { sendEmail, EmailType } from '../../services/emailService';
import { listEmailTemplates, EmailTemplate } from '../../services/templateService';

// Local definition to replace the deleted statusService
interface RegistrationStatus {
  id: string;
  label: string;
}

interface Props {
  open: boolean;
  registration: Registration;
  statuses: RegistrationStatus[];
  onClose: () => void;
  onUpdate: () => void;
}

const RegistrationDetailsDialog: React.FC<Props> = ({
  open,
  registration,
  statuses,
  onClose,
  onUpdate,
}) => {
  const { event } = useEventEdition();
  const distanceOptions = (event?.raceDistances || []).map(d => ({ id: d.id, label: d.displayName || d.id }));
  const [isOnWaitinglist, setIsOnWaitinglist] = useState(
    registration.isOnWaitinglist || false
  );
  const [status, setStatus] = useState(registration.status || '');
  const [payments, setPayments] = useState<Payment[]>(
    registration.payments || []
  );
  const [paymentForm, setPaymentForm] = useState<{
    amount: string;
    method: PaymentMethod;
    comment: string;
  }>({ amount: '', method: 'vipps', comment: '' });
  const [commentDialogOpen, setCommentDialogOpen] = useState(false);
  const [adminComment, setAdminComment] = useState('');
  const [emailDialogOpen, setEmailDialogOpen] = useState(false);
  const [selectedEmailType, setSelectedEmailType] = useState<EmailType>(
    EmailType.PAYMENT_CONFIRMATION
  );
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [adminCommentsList, setAdminCommentsList] = useState(
    registration.adminComments || []
  );
  // mail send progress state
  const [mailProgressOpen, setMailProgressOpen] = useState(false);
  const [mailStatus, setMailStatus] = useState<string>('pending');
  const [mailError, setMailError] = useState<string>('');
  const [timerExceeded, setTimerExceeded] = useState(false);
  const unsubscribeRef = useRef<() => void | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [mailDetailsOpen, setMailDetailsOpen] = useState(false);
  const [selectedMailDetails, setSelectedMailDetails] = useState<any>(null);
  const [emailCommentDialogOpen, setEmailCommentDialogOpen] = useState(false);
  const [emailAdminComment, setEmailAdminComment] = useState('');
  // cache of mail statuses by mailRef id
  const [mailStatuses, setMailStatuses] = useState<Record<string, string>>({});
  // edit mode state
  const [editMode, setEditMode] = useState(false);
  const [form, setForm] = useState({
    firstName: registration.firstName || '',
    lastName: registration.lastName || '',
    email: registration.originalEmail || registration.email || '',
    raceDistance: registration.raceDistance || '',
    nationality: registration.nationality || '',
    phoneCountryCode: registration.phoneCountryCode || '',
    phoneNumber: registration.phoneNumber || '',
    representing: registration.representing || '',
    dateOfBirth: registration.dateOfBirth ? new Date(registration.dateOfBirth) : null as Date | null,
    notifyFutureEvents: !!registration.notifyFutureEvents,
    sendRunningOffers: !!registration.sendRunningOffers,
    comments: registration.comments || '',
  });

  // load dynamic email templates
  useEffect(() => {
    listEmailTemplates().then(setTemplates).catch(console.error);
  }, []);

  // Reset form when switching to a different registration and exit edit mode
  useEffect(() => {
    setForm({
      firstName: registration.firstName || '',
      lastName: registration.lastName || '',
      email: registration.originalEmail || registration.email || '',
      raceDistance: registration.raceDistance || '',
      nationality: registration.nationality || '',
      phoneCountryCode: registration.phoneCountryCode || '',
      phoneNumber: registration.phoneNumber || '',
      representing: registration.representing || '',
      dateOfBirth: registration.dateOfBirth ? new Date(registration.dateOfBirth) : null,
      notifyFutureEvents: !!registration.notifyFutureEvents,
      sendRunningOffers: !!registration.sendRunningOffers,
      comments: registration.comments || '',
    });
    setEditMode(false);
  }, [registration.id]);

  // cleanup mail listener & timer on unmount
  useEffect(() => {
    return () => {
      if (unsubscribeRef.current) unsubscribeRef.current();
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const handleSaveEdits = async () => {
    const payload: any = {
      firstName: form.firstName.trim(),
      lastName: form.lastName.trim(),
      email: form.email.trim(),
      raceDistance: form.raceDistance.trim(),
      nationality: form.nationality.trim(),
      phoneCountryCode: form.phoneCountryCode.trim(),
      phoneNumber: form.phoneNumber.trim(),
      representing: form.representing.trim(),
      notifyFutureEvents: !!form.notifyFutureEvents,
      sendRunningOffers: !!form.sendRunningOffers,
      comments: form.comments,
    };
    if (form.dateOfBirth) payload.dateOfBirth = new Date(form.dateOfBirth);
    await updateRegistration(registration.id!, payload, false);
    await refreshReg();
    onUpdate();
    setEditMode(false);
  };

  // Load current smtpAgent.status for adminComments which have a mailRef
  useEffect(() => {
    const loadStatuses = async () => {
      try {
        const entries = (adminCommentsList || []).filter((c: any) => c.mailRef);
        if (!entries.length) return;
        const updates: Record<string, string> = {};
        for (const c of entries) {
          const key = String(c.mailRef);
          const ref = doc(db, 'mail', key);
          const snap = await getDoc(ref);
          if (snap.exists()) {
            const d: any = snap.data();
            const s = d?.smtpAgent?.state || d?.status || 'unknown';
            updates[key] = String(s);
          }
        }
        if (Object.keys(updates).length) setMailStatuses(prev => ({ ...prev, ...updates }));
      } catch (e) {
        console.error('Failed to load mail statuses', e);
      }
    };
    loadStatuses();
  }, [adminCommentsList]);

  const refreshReg = async () => {
    const fresh = await getRegistrationById(registration.id!);
    if (!fresh) return;
    setIsOnWaitinglist(fresh.isOnWaitinglist || false);
    setStatus(fresh.status || '');
    setPayments(fresh.payments || []);
    setAdminCommentsList(
      (fresh.adminComments || []).slice().sort((a, b) => {
        const ta = a.at.toDate ? a.at.toDate().getTime() : new Date(a.at).getTime();
        const tb = b.at.toDate ? b.at.toDate().getTime() : new Date(b.at).getTime();
        return tb - ta;
      })
    );
  };

  const handleListChange = async (e: SelectChangeEvent<string>) => {
    const listType = e.target.value;
    const newList = listType === 'waiting-list';
    await updateRegistration(registration.id!, { isOnWaitinglist: newList }, false);
    setIsOnWaitinglist(newList);
    // suggest mail template for list switch
    const defaultTemplate = newList
      ? EmailType.P_LIST2W_LIST
      : EmailType.W_LIST2P_LIST_OFFER;
    setSelectedEmailType(defaultTemplate);
    setEmailAdminComment('');
    setEmailCommentDialogOpen(true);
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
    await updateRegistrationStatus(
      registration.id!,
      status,
      adminComment.trim() || undefined
    );
    await refreshReg();
    // Notify parent to refresh list so changes are immediately reflected
    onUpdate();
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
    setEmailDialogOpen(false);
    // Clear any previous listener/timer (legacy)
    if (unsubscribeRef.current) unsubscribeRef.current();
    if (timerRef.current) clearTimeout(timerRef.current);
    try {
      const fullReg = await getRegistrationById(registration.id!);
      if (!fullReg) throw new Error('Registration not found');
      const toEmail = fullReg.originalEmail || fullReg.email;
      const regForEmail = { ...fullReg, email: toEmail };
      // send any template by type
      const mailRef: DocumentReference<any> = await sendEmail(
        selectedEmailType,
        toEmail,
        regForEmail
      );
      if (mailRef) {
        // record in adminComments with comment text
        const regRef = doc(db, 'registrations', registration.id!);
        await updateDoc(regRef, {
          adminComments: arrayUnion({
            at: Timestamp.now(),
            mailRef: mailRef.id,
            type: selectedEmailType,
            state: 'PENDING',
            text: emailAdminComment
          })
        });
        // counter is updated inside sendEmail
        // clear admin comment
        setEmailAdminComment('');
        // Immediately confirm enqueue instead of waiting for trigger/agent
        alert('Email queued for delivery.');
        // Optionally refresh statuses shortly after enqueue
        try {
          const snap = await getDoc(mailRef);
          if (snap.exists()) {
            const d: any = snap.data();
            const s = d?.smtpAgent?.state || d?.status || 'unknown';
            setMailStatuses(prev => ({ ...prev, [mailRef.id]: String(s) }));
          }
        } catch {}
      }
    } catch (err: any) {
      console.error('Error initiating email send:', err);
      setMailError(err.message || 'Error sending email');
    }
    // always refresh
    await refreshReg();
    onUpdate();
  };

  // open mail details popup
  const openMailDetails = async (mailRefId: string) => {
    const ref = doc(db, 'mail', mailRefId);
    const snap = await getDoc(ref);
    if (snap.exists()) {
      setSelectedMailDetails({ id: mailRefId, ...snap.data() });
      setMailDetailsOpen(true);
    }
  };

  const closeMailDetails = () => {
    setMailDetailsOpen(false);
    setSelectedMailDetails(null);
  };

  const handleAddAdminComment = async () => {
    if (!adminComment.trim()) return;
    const regRef = doc(db, 'registrations', registration.id!);
    await updateDoc(regRef, {
      adminComments: arrayUnion({ text: adminComment.trim(), at: Timestamp.now() })
    });
    setAdminComment('');
    await refreshReg();
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Registration #{registration.registrationNumber}</DialogTitle>
      <DialogContent>
        {editMode ? (
          <>
            <Box display="grid" gridTemplateColumns={{ xs: '1fr', sm: '1fr 1fr' }} gap={2}>
              <TextField label="First name" value={form.firstName} onChange={e => setForm(f => ({ ...f, firstName: e.target.value }))} />
              <TextField label="Last name" value={form.lastName} onChange={e => setForm(f => ({ ...f, lastName: e.target.value }))} />
              <TextField label="Email" type="email" fullWidth value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
              <FormControl fullWidth>
                <InputLabel id="race-distance-label">Race distance</InputLabel>
                <Select
                  labelId="race-distance-label"
                  label="Race distance"
                  value={form.raceDistance}
                  onChange={(e) => setForm(f => ({ ...f, raceDistance: e.target.value as string }))}
                >
                  {distanceOptions.map(opt => (
                    <MenuItem key={opt.id} value={opt.id}>{opt.label}</MenuItem>
                  ))}
                </Select>
              </FormControl>
              <TextField label="Nationality (ISO3)" value={form.nationality} onChange={e => setForm(f => ({ ...f, nationality: e.target.value }))} />
              <TextField label="Phone country code" value={form.phoneCountryCode} onChange={e => setForm(f => ({ ...f, phoneCountryCode: e.target.value }))} />
              <TextField label="Phone number" value={form.phoneNumber} onChange={e => setForm(f => ({ ...f, phoneNumber: e.target.value }))} />
              <TextField label="Representing" value={form.representing} onChange={e => setForm(f => ({ ...f, representing: e.target.value }))} />
              <TextField label="Date of birth" type="date" InputLabelProps={{ shrink: true }} value={form.dateOfBirth ? new Date(form.dateOfBirth).toISOString().slice(0,10) : ''} onChange={e => setForm(f => ({ ...f, dateOfBirth: e.target.value ? new Date(e.target.value) : null }))} />
            </Box>
            <Box mt={2}>
              <FormControlLabel control={<Checkbox checked={form.notifyFutureEvents} onChange={e => setForm(f => ({ ...f, notifyFutureEvents: e.target.checked }))} />} label="Notify Future Events" />
              <FormControlLabel control={<Checkbox checked={form.sendRunningOffers} onChange={e => setForm(f => ({ ...f, sendRunningOffers: e.target.checked }))} />} label="Send Running Offers" />
            </Box>
            <TextField fullWidth margin="normal" label="Comments" value={form.comments} onChange={e => setForm(f => ({ ...f, comments: e.target.value }))} multiline rows={3} />
          </>
        ) : (
          <>
            <Typography variant="subtitle1">
              {registration.firstName} {registration.lastName} ({registration.nationality})
            </Typography>
            <Typography variant="body2">
              Email: {registration.originalEmail || registration.email}
            </Typography>
            <Typography variant="body2">Race: {registration.raceDistance}</Typography>
            <Typography variant="body2">
              Payment Made: {registration.paymentMade}
            </Typography>
            <Typography variant="body2">
              Phone: {registration.phoneCountryCode} {registration.phoneNumber}
            </Typography>
            <Typography variant="body2">
              Created: {registration.createdAt
                ? registration.createdAt.toDate
                  ? registration.createdAt.toDate().toLocaleString()
                  : new Date(registration.createdAt).toLocaleString()
                : 'N/A'}
            </Typography>
            <Typography variant="body2">
              Updated: {registration.updatedAt
                ? registration.updatedAt.toDate
                  ? registration.updatedAt.toDate().toLocaleString()
                  : new Date(registration.updatedAt).toLocaleString()
                : 'N/A'}
            </Typography>
          </>
        )}
        {registration.waitinglistExpires && (
          <Typography variant="body2">
            Waitinglist Expires: {registration.waitinglistExpires.toDate
              ? registration.waitinglistExpires.toDate().toLocaleString()
              : new Date(registration.waitinglistExpires).toLocaleString()}
          </Typography>
        )}
        <Typography variant="body2">
          Notify Future Events: {registration.notifyFutureEvents ? 'Yes' : 'No'}
        </Typography>
        <Typography variant="body2">
          Send Running Offers: {registration.sendRunningOffers ? 'Yes' : 'No'}
        </Typography>
        {registration.comments && (
          <Typography variant="body2">Comments: {registration.comments}</Typography>
        )}
        <TextField
          fullWidth
          margin="normal"
          label="Admin Comment"
          value={adminComment}
          onChange={(e) => setAdminComment(e.target.value)}
          multiline
          rows={2}
        />
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2 }}>
          <Button variant="contained" size="small" onClick={handleAddAdminComment}>
            Add Comment
          </Button>
        </Box>
        <FormControl fullWidth margin="normal">
          <InputLabel>List</InputLabel>
          <Select
            value={isOnWaitinglist ? 'waiting-list' : 'participant'}
            label="List"
            onChange={handleListChange}
          >
            <MenuItem value="participant">Participant</MenuItem>
            <MenuItem value="waiting-list">Waiting-list</MenuItem>
          </Select>
        </FormControl>

        <FormControl fullWidth margin="normal">
          <InputLabel>Status</InputLabel>
          <Select value={status} label="Status" onChange={handleStatusSelect}>
            {statuses.map((s) => (
              <MenuItem key={s.id} value={s.label}>
                {s.label}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        <Typography variant="h6" sx={{ mt: 2 }}>
          Payments
        </Typography>
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
            <Select
              value={paymentForm.method}
              onChange={(e) =>
                setPaymentForm((f) => ({ ...f, method: e.target.value as PaymentMethod }))
              }
            >
              {['vipps', 'bank transfer', 'paypal', 'cash', 'other'].map((m) => (
                <MenuItem key={m} value={m}>
                  {m}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <TextField
            size="small"
            label="Amount"
            value={paymentForm.amount}
            onChange={(e) =>
              setPaymentForm((f) => ({ ...f, amount: e.target.value }))
            }
          />
          <TextField
            size="small"
            label="Comment"
            value={paymentForm.comment}
            onChange={(e) =>
              setPaymentForm((f) => ({ ...f, comment: e.target.value }))
            }
          />
          <Button variant="contained" onClick={handleAddPayment}>
            Add
          </Button>
        </Box>

        {/* Admin comments section */}
        <Typography variant="h6" sx={{ mt: 2 }}>
          Admin Comments
        </Typography>
        <Box sx={{ maxHeight: 400, overflow: 'auto' }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Email type</TableCell>
                <TableCell>Admin comments</TableCell>
                <TableCell>Timestamp</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {(adminCommentsList || []).map((c, i) => (
                <TableRow key={i}>
                  <TableCell>{c.type || '-'}</TableCell>
                  <TableCell>{c.text || '-'}</TableCell>
                  <TableCell>
                    {c.at.toDate
                      ? c.at.toDate().toLocaleString()
                      : new Date(c.at).toLocaleString()}
                  </TableCell>
                  <TableCell>{(c.mailRef && (mailStatuses[c.mailRef] || c.state)) || c.state || '-'}</TableCell>
                  <TableCell>
                    {c.mailRef ? (
                      <Button size="small" onClick={() => openMailDetails(c.mailRef!)}>
                        Details
                      </Button>
                    ) : null}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Box>
      </DialogContent>
      <DialogActions>
        {!editMode && (
          <Button
            variant="outlined"
            onClick={() => {
              setEmailAdminComment('');
              setSelectedEmailType(EmailType.NEWSLETTER);
              setEmailCommentDialogOpen(true);
            }}
          >
            Send Email
          </Button>
        )}
        {!editMode && (
          <Button variant="contained" onClick={() => setEditMode(true)}>Edit Details</Button>
        )}
        {editMode && (
          <>
            <Button onClick={() => { setEditMode(false); setForm({
              firstName: registration.firstName || '',
              lastName: registration.lastName || '',
              email: registration.originalEmail || registration.email || '',
              raceDistance: registration.raceDistance || '',
              nationality: registration.nationality || '',
              phoneCountryCode: registration.phoneCountryCode || '',
              phoneNumber: registration.phoneNumber || '',
              representing: registration.representing || '',
              dateOfBirth: registration.dateOfBirth ? new Date(registration.dateOfBirth) : null,
              notifyFutureEvents: !!registration.notifyFutureEvents,
              sendRunningOffers: !!registration.sendRunningOffers,
              comments: registration.comments || '',
            }); }}>Cancel</Button>
            <Button variant="contained" onClick={handleSaveEdits}>Save</Button>
          </>
        )}
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
            onChange={(e) => setAdminComment(e.target.value)}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCommentDialogOpen(false)}>Cancel</Button>
          <Button onClick={confirmStatusChange} autoFocus>
            Confirm
          </Button>
        </DialogActions>
      </Dialog>

      {/* Email Admin Comment Dialog */}
      <Dialog open={emailCommentDialogOpen} onClose={() => setEmailCommentDialogOpen(false)}>
        <DialogTitle>Admin Comment</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Comment"
            fullWidth
            multiline
            minRows={3}
            value={emailAdminComment}
            onChange={(e) => setEmailAdminComment(e.target.value)}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEmailCommentDialogOpen(false)}>Cancel</Button>
          <Button
            onClick={() => {
              setEmailCommentDialogOpen(false);
              setEmailDialogOpen(true);
            }}
            autoFocus
          >
            Confirm
          </Button>
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
              onChange={(e) =>
                setSelectedEmailType(e.target.value as EmailType)
              }
            >
              {templates.map((tpl) => (
                <MenuItem key={tpl.type} value={tpl.type}>
                  {tpl.type.replace(/_/g, ' ')}
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

      {/* Mail progress dialog */}
      <Dialog
        open={mailProgressOpen}
        onClose={() => {
          setMailProgressOpen(false);
          if (unsubscribeRef.current) unsubscribeRef.current();
          if (timerRef.current) clearTimeout(timerRef.current);
        }}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>Email Sending</DialogTitle>
        <DialogContent>
          {mailError ? (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <ErrorIcon color="error" />
              <Typography color="error">{mailError}</Typography>
            </Box>
          ) : mailStatus === 'success' ? (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <CheckCircleIcon color="success" />
              <Typography>Email sent successfully.</Typography>
            </Box>
          ) : (
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <CircularProgress />
                <Typography>Sending email…</Typography>
              </Box>
              {timerExceeded && (
                <Typography variant="body2" color="textSecondary">
                  This is taking longer than expected…
                </Typography>
              )}
            </Box>
          )}
          <Typography variant="body2" sx={{ mt: 2 }}>
            You can safely close this dialog even if mail process is still running
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => {
              setMailProgressOpen(false);
              if (unsubscribeRef.current) unsubscribeRef.current();
              if (timerRef.current) clearTimeout(timerRef.current);
            }}
          >
            Close
          </Button>
        </DialogActions>
      </Dialog>

      {/* Mail Details Dialog */}
      <Dialog open={mailDetailsOpen} onClose={closeMailDetails} maxWidth="sm" fullWidth>
        <DialogTitle>Email Details</DialogTitle>
        <DialogContent>
          {selectedMailDetails && (
            <>
              <TableContainer>
                <Table size="small">
                  <TableBody>
                    <TableRow>
                      <TableCell>Created At</TableCell>
                      <TableCell>{selectedMailDetails.createdAt?.toDate
                        ? selectedMailDetails.createdAt.toDate().toLocaleString()
                        : new Date(selectedMailDetails.createdAt).toLocaleString()}
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>To</TableCell>
                      <TableCell>{selectedMailDetails.to}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>Type</TableCell>
                      <TableCell>{selectedMailDetails.type}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>Subject</TableCell>
                      <TableCell>{selectedMailDetails.message?.subject}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>Status</TableCell>
                      <TableCell>{selectedMailDetails.smtpAgent?.state || selectedMailDetails.status || 'unknown'}</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </TableContainer>
              <Typography variant="h6" sx={{ mt: 2 }}>
                Message
              </Typography>
              <Box
                sx={{
                  border: 1,
                  borderColor: 'grey.300',
                  p: 2,
                  mt: 1,
                  overflow: 'auto',
                  maxHeight: 300,
                }}
              >
                <div
                  dangerouslySetInnerHTML={{ __html: selectedMailDetails.message.html }}
                />
              </Box>
            </>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={closeMailDetails}>Close</Button>
        </DialogActions>
      </Dialog>
    </Dialog>
  );
};

export default RegistrationDetailsDialog;
