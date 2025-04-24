import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Box, Button, Typography, Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TextField, Checkbox, CircularProgress, FormControl, InputLabel, Select, MenuItem } from '@mui/material';
import Editor from '@monaco-editor/react';
import Handlebars from 'handlebars';
import { html as beautifyHtml } from 'js-beautify';
import { EmailType } from '../services/emailService';
import { getEmailTemplate, updateEmailTemplate } from '../services/templateService';
import InviteSummaryDialog from '../components/InviteSummaryDialog';
import { fetchInvitations, addInvitation, updateInvitationSent, Invitation } from '../utils/invitationUtils';
import { getRegistrationsByEdition, updateRegistration, addPaymentToRegistration, generateTestRegistrations } from '../services/registrationService';
import { Registration, PaymentMethod } from '../types';
import { sendPaymentConfirmationEmail } from '../services/emailService';

const EDITION_ID = 'kutc-2025';

const AdminPage: React.FC = () => {
  const [invitees, setInvitees] = useState<Invitation[]>([]);
  const [loading, setLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [addEmail, setAddEmail] = useState('');
  const [addName, setAddName] = useState('');
  const [addLoading, setAddLoading] = useState(false);
  const [numToSend, setNumToSend] = useState(0);
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [regLoading, setRegLoading] = useState(false);
  const [editValues, setEditValues] = useState<{ [id: string]: number }>({});
  const [paymentForms, setPaymentForms] = useState<{ [id: string]: { amount: string; method: PaymentMethod; comment: string; date: string } }>({});
  const [testCount, setTestCount] = useState<string>('');
  const [testLoading, setTestLoading] = useState(false);

  // Email template editor state
  const [selectedTemplateType, setSelectedTemplateType] = useState<EmailType>(EmailType.WELCOME);
  const [subjectTemplate, setSubjectTemplate] = useState('');
  const [bodyTemplate, setBodyTemplate] = useState('');
  const [loadingTpl, setLoadingTpl] = useState(false);
  const [savingTpl, setSavingTpl] = useState(false);
  const [previewHtml, setPreviewHtml] = useState('');
  // Sample data for preview
  const sampleContext = { name: 'John Doe', firstName: 'John', lastName: 'Doe', registrationNumber: 123, editionId: 'kutc-2025', raceDistance: '10K', paymentMade: 300, paymentRequired: 300, status: 'confirmed', comments: 'No comments', phoneCountryCode: '+47', phoneNumber: '12345678', representing: 'ACME', dateOfBirth: '1990-01-01', waitinglistExpires: '2025-05-01' };

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

  // Fetch registrations on mount
  useEffect(() => {
    const fetchRegs = async () => {
      setRegLoading(true);
      const regs = await getRegistrationsByEdition(EDITION_ID);
      setRegistrations(regs);
      setRegLoading(false);
    };
    fetchRegs();
  }, []);

  // Load template when type changes
  useEffect(() => {
    const loadTpl = async () => {
      setLoadingTpl(true);
      const tpl = await getEmailTemplate(selectedTemplateType, 'en');
      setSubjectTemplate(tpl.subjectTemplate);
      setBodyTemplate(tpl.bodyTemplate);
      setLoadingTpl(false);
      setPreviewHtml('');
    };
    loadTpl();
  }, [selectedTemplateType]);

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

  const handlePaymentChange = (id: string, value: string) => {
    setEditValues(prev => ({ ...prev, [id]: Number(value) }));
  };

  // Handle payment form field changes
  const handlePaymentFormChange = (id: string, field: string, value: string) => {
    setPaymentForms(prev => ({
      ...prev,
      [id]: {
        ...prev[id],
        [field]: value
      }
    }));
  };

  const handleAddPayment = async (id: string) => {
    const form = paymentForms[id] || {};
    if (!form.amount || isNaN(Number(form.amount))) return;

    // Find the registration before the payment is added
    const regBefore = registrations.find(r => r.id === id);
    const payment = {
      amount: Number(form.amount),
      method: form.method || 'vipps',
      comment: form.comment || '',
      date: new Date(),
    };
    // Remove undefined fields
    Object.keys(payment).forEach(key => {
      if (payment[key as keyof typeof payment] === undefined) {
        delete payment[key as keyof typeof payment];
      }
    });
    await addPaymentToRegistration(id, payment);
    // Refresh registrations
    const regs = await getRegistrationsByEdition(EDITION_ID);
    setRegistrations(regs);
    // Find the updated registration
    const regAfter = regs.find(r => r.id === id);
    if (
      regBefore && regAfter &&
      regBefore.paymentMade < regBefore.paymentRequired &&
      regAfter.paymentMade >= regAfter.paymentRequired &&
      regAfter.email
    ) {
      try {
        // Always send email with status 'confirmed' in the registration object
        await sendPaymentConfirmationEmail({ ...regAfter, status: 'confirmed' });
        // Update registration status to 'confirmed'
        try {
          await updateRegistration(id, { status: 'confirmed' }, false);
        } catch (updateError) {
          console.error('Failed to update registration status to confirmed:', updateError);
        }
      } catch (e) {
        console.error('Failed to send payment confirmation email:', e);
      }
    }
    // Clear form
    setPaymentForms(prev => ({ ...prev, [id]: { amount: '', method: 'vipps', comment: '', date: '' } }));
  };

  const handlePaymentUpdate = async (id: string) => {
    const newPayment = editValues[id];
    await updateRegistration(id, { paymentMade: newPayment });
    // Optionally, refetch or update local state
    setRegistrations(regs => regs.map(reg => reg.id === id ? { ...reg, paymentMade: newPayment } : reg));
  };

  const handleSaveTemplate = async () => {
    setSavingTpl(true);
    await updateEmailTemplate(selectedTemplateType, 'en', subjectTemplate, bodyTemplate);
    setSavingTpl(false);
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
        <Box mt={2} mb={2}>
          <Typography variant="h6">Generate Test Registrations</Typography>
          <Box display="flex" gap={2} alignItems="center">
            <TextField
              label="Count"
              type="number"
              size="small"
              value={testCount}
              onChange={e => setTestCount(e.target.value)}
            />
            <Button
              variant="contained"
              color="secondary"
              onClick={async () => {
                setTestLoading(true);
                await generateTestRegistrations(EDITION_ID, parseInt(testCount, 10));
                const regs = await getRegistrationsByEdition(EDITION_ID);
                setRegistrations(regs);
                setTestLoading(false);
                alert(`Generated ${testCount} test registrations.`);
              }}
              disabled={!testCount || testLoading}
            >
              {testLoading ? <CircularProgress size={20} /> : 'Generate Test Registrations'}
            </Button>
          </Box>
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
      {/* Email Template Editor */}
      <Paper sx={{ mt: 4, p: 2, width: '100%', maxWidth: '98%' }}>
        <Typography variant="h5" gutterBottom>Email Templates (English)</Typography>
        <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
          <FormControl size="small">
            <InputLabel>Type</InputLabel>
            <Select value={selectedTemplateType} label="Type" onChange={e => setSelectedTemplateType(e.target.value as EmailType)} disabled={loadingTpl}>
              {Object.values(EmailType).map(t => (<MenuItem key={t} value={t}>{t}</MenuItem>))}
            </Select>
          </FormControl>
        </Box>
        <TextField label="Subject Template" fullWidth size="small" value={subjectTemplate} onChange={e => setSubjectTemplate(e.target.value)} disabled={loadingTpl} sx={{ mb: 2 }} />
        <Editor height="400px" width="100%" defaultLanguage="handlebars" value={bodyTemplate} onChange={val => setBodyTemplate(val || '')} />
        <Box sx={{ mt: 2 }}>
          <Button variant="contained" onClick={handleSaveTemplate} disabled={savingTpl}>
            {savingTpl ? <CircularProgress size={20} /> : 'Save Template'}
          </Button>
          <Button variant="outlined" sx={{ ml: 2 }} onClick={() => setPreviewHtml(Handlebars.compile(bodyTemplate)(sampleContext))}>
            Preview
          </Button>
          <Button variant="outlined" sx={{ ml: 2 }} onClick={() => setBodyTemplate(beautifyHtml(bodyTemplate, { indent_size: 2, wrap_line_length: 0 }))}>
            Format
          </Button>
        </Box>
        {previewHtml && (
          <Box sx={{ mt: 2, border: '1px solid #ccc', p: 2 }} dangerouslySetInnerHTML={{ __html: previewHtml }} />
        )}
      </Paper>
      <Paper sx={{ mt: 4, p: 2 }}>
        <Typography variant="h5" gutterBottom sx={{ fontWeight: 'bold', letterSpacing: 1, mb: 2 }}>
          Registrations & Payment Status
        </Typography>
        {regLoading ? (
          <CircularProgress />
        ) : (
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow sx={{ backgroundColor: '#f5f5f5' }}>
                  <TableCell sx={{ fontWeight: 'bold' }}>#</TableCell>
                  <TableCell sx={{ fontWeight: 'bold' }}>Name</TableCell>
                  <TableCell sx={{ fontWeight: 'bold' }}>Race</TableCell>
                  <TableCell sx={{ fontWeight: 'bold' }}>Payment Required</TableCell>
                  <TableCell sx={{ fontWeight: 'bold' }}>Payment Made</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {[...registrations]
                  .sort((a, b) => {
                    if (a.registrationNumber == null && b.registrationNumber == null) return 0;
                    if (a.registrationNumber == null) return 1;
                    if (b.registrationNumber == null) return -1;
                    return a.registrationNumber - b.registrationNumber;
                  })
                  .map(reg => (
                    <TableRow key={reg.id}>
                      <TableCell>{reg.registrationNumber ?? ''}</TableCell>
                      <TableCell>{reg.firstName} {reg.lastName}</TableCell>
                      <TableCell>{reg.raceDistance}</TableCell>
                      <TableCell>{reg.paymentRequired}</TableCell>
                      <TableCell>
                        {/* List all payments */}
                        <Table size="small">
                          <TableBody>
                            {(reg.payments || []).map((p, i) => (
                              <TableRow key={i}>
                                <TableCell>{p.date ? new Date(p.date).toLocaleString() : ''}</TableCell>
                                <TableCell>{p.method}</TableCell>
                                <TableCell>{p.amount}</TableCell>
                                <TableCell>{p.comment}</TableCell>
                              </TableRow>
                            ))}
                            {/* Add payment form as a single row */}
                            <TableRow>
                              <TableCell colSpan={1}></TableCell>
                              <TableCell>
                                <TextField
                                  size="small"
                                  select
                                  SelectProps={{ native: true }}
                                  value={paymentForms[reg.id!]?.method ?? 'vipps'}
                                  onChange={e => handlePaymentFormChange(reg.id!, 'method', e.target.value)}
                                  sx={{ width: 110 }}
                                  label=""
                                  placeholder=""
                                >
                                  <option value="vipps">Vipps</option>
                                  <option value="bank transfer">Bank Transfer</option>
                                  <option value="paypal">PayPal</option>
                                  <option value="cash">Cash</option>
                                  <option value="other">Other</option>
                                </TextField>
                              </TableCell>
                              <TableCell>
                                <TextField
                                  type="number"
                                  size="small"
                                  value={paymentForms[reg.id!]?.amount ?? ''}
                                  onChange={e => handlePaymentFormChange(reg.id!, 'amount', e.target.value)}
                                  sx={{ width: 80 }}
                                  label=""
                                  placeholder=""
                                />
                              </TableCell>
                              <TableCell>
                                <TextField
                                  size="small"
                                  value={paymentForms[reg.id!]?.comment ?? ''}
                                  onChange={e => handlePaymentFormChange(reg.id!, 'comment', e.target.value)}
                                  sx={{ width: 120 }}
                                  label=""
                                  placeholder=""
                                />
                                <Button
                                  variant="contained"
                                  color="success"
                                  size="small"
                                  sx={{ ml: 1 }}
                                  onClick={() => handleAddPayment(reg.id!)}
                                  disabled={!paymentForms[reg.id!] || !paymentForms[reg.id!].amount}
                                >
                                  Add
                                </Button>
                              </TableCell>
                            </TableRow>
                          </TableBody>
                        </Table>
                      </TableCell>
                      <TableCell>
                        <TextField
                          type="number"
                          size="small"
                          value={editValues[reg.id!] ?? reg.paymentMade}
                          onChange={e => handlePaymentChange(reg.id!, e.target.value)}
                          inputProps={{ min: 0 }}
                          sx={{ width: 100 }}
                          variant="outlined"
                        />
                      </TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Paper>
    </Box>
  );
};

export default AdminPage;
