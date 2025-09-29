import React, { useEffect, useMemo, useState } from 'react';
import {
  Box,
  Button,
  Checkbox,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  FormControlLabel,
  InputLabel,
  MenuItem,
  Select,
  TextField,
  Typography,
} from '@mui/material';
import { collection, doc, getDocs, query, updateDoc, where, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { useEventEdition } from '../../contexts/EventEditionContext';
import { listEmailTemplates, EmailTemplate } from '../../services/templateService';
import Handlebars from 'handlebars';
import { registerDefaultEmailHelpers } from '../../services/handlebarsHelpers';
import { enqueueRawEmail } from '../../services/emailService';
import { listEventEditions, EventEditionSummary } from '../../services/eventEditionService';

// Basic statuses available on registrations
const REG_STATUSES = ['pending', 'confirmed', 'cancelled', 'expired'] as const;

type SourceType = 'registrations' | 'users';

const BulkEmailPanel: React.FC = () => {
  const { event } = useEventEdition();

  const [loading, setLoading] = useState(false);

  // Filters
  const [source, setSource] = useState<SourceType>('registrations');
  const [editionId, setEditionId] = useState<string>('');
  const [statuses, setStatuses] = useState<string[]>(['confirmed']);
  const [excludeCancelled, setExcludeCancelled] = useState(true);
  const [flagWaitinglist, setFlagWaitinglist] = useState<boolean | 'any'>('any');
  const [flagNotifyFuture, setFlagNotifyFuture] = useState<boolean | 'any'>('any');
  const [flagSendOffers, setFlagSendOffers] = useState<boolean | 'any'>('any');

  // Template selection
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const locales = useMemo(() => Array.from(new Set(templates.map(t => t.locale))), [templates]);
  const [tplLocale, setTplLocale] = useState('en');
  const tplTypes = useMemo(() => templates.filter(t => t.locale === tplLocale).map(t => t.type), [templates, tplLocale]);
  const [tplType, setTplType] = useState<string>('');

  // Computed recipients
  type RecipientRow = {
    id?: string;
    email: string;
    status?: string;
    isOnWaitinglist?: boolean;
    notifyFutureEvents?: boolean;
    sendRunningOffers?: boolean;
    editionId?: string;
    // registration fields to support template variables
    registrationId?: string;
    userId?: string;
    firstName?: string;
    lastName?: string;
    name?: string;
    registrationNumber?: number | string;
    dateOfBirth?: any;
    nationality?: string;
    phoneCountryCode?: string;
    phoneNumber?: string;
    waitinglistExpires?: any;
    comments?: string;
    termsAccepted?: boolean;
    travelRequired?: string | boolean;
    representing?: string | string[];
    raceDistance?: string;
    paymentMade?: number;
    paymentRequired?: number;
    originalEmail?: string;
  };
  const [recipients, setRecipients] = useState<RecipientRow[]>([]);
  const [selectedEmails, setSelectedEmails] = useState<Set<string>>(new Set());
  const [dryRunOpen, setDryRunOpen] = useState(false);

  // Send test dialog
  const [testOpen, setTestOpen] = useState(false);
  const [testRecipient, setTestRecipient] = useState('');

  // Campaign execution
  const [campaignName, setCampaignName] = useState('');
  const [enqueueing, setEnqueueing] = useState(false);
  const [progress, setProgress] = useState({ total: 0, enqueued: 0 });
  const [batchSize, setBatchSize] = useState(100);
  const [batchDelayMs, setBatchDelayMs] = useState(200);

  // Utilities to normalize and format date-like values
  const toDateOrNull = (v: any): Date | null => {
    try {
      if (!v) return null;
      if (v instanceof Date) return v;
      if (typeof v?.toDate === 'function') return v.toDate();
      if (typeof v === 'object' && typeof v.seconds === 'number') {
        // Firestore Timestamp-like
        return new Date(v.seconds * 1000);
      }
      if (typeof v === 'number') {
        // milliseconds epoch or seconds epoch
        return new Date(v > 1e12 ? v : v * 1000);
      }
      const parsed = new Date(v);
      return isNaN(parsed.getTime()) ? null : parsed;
    } catch {
      return null;
    }
  };
  const fmtDate = (d: Date | null, locale: string): string | null =>
    d ? d.toLocaleDateString(locale || undefined, { year: 'numeric', month: '2-digit', day: '2-digit' }) : null;
  const fmtDateTime = (d: Date | null, locale: string): string | null =>
    d ? d.toLocaleString(locale || undefined, { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }) : null;

  useEffect(() => {
    registerDefaultEmailHelpers(Handlebars);
    listEmailTemplates().then(setTemplates).catch(console.error);
    listEventEditions().then(setEditionOptions).catch(console.error);
  }, []);

  // Initialize editionId from context
  useEffect(() => {
    if (event?.id) setEditionId(event.id);
  }, [event?.id]);

  const [editionOptions, setEditionOptions] = useState<EventEditionSummary[]>([]);
  const [editionCache, setEditionCache] = useState<Record<string, { eventName?: string; eventShortName?: string; edition?: number; startTime?: any }>>({});

  const fetchRecipients = async () => {
    setLoading(true);
    try {
      const rows: RecipientRow[] = [];
      const emailSet = new Set<string>();
      if (source === 'registrations') {
        let q: any = collection(db, 'registrations');
        const clauses: any[] = [];
        if (editionId) clauses.push(where('editionId', '==', editionId));
        // status filter: allow multiple values
        if (statuses.length === 1) {
          clauses.push(where('status', '==', statuses[0]));
        }
        // If multiple statuses, we’ll filter in code after fetching (to avoid composite constraints).
        if (clauses.length) {
          q = query(q, ...clauses);
        }
        const snap = await getDocs(q);
        snap.forEach(d => {
          const r: any = d.data();
          // In-code filters
          if (statuses.length > 1 && r.status && !statuses.includes(String(r.status))) return;
          if (excludeCancelled && String(r.status) === 'cancelled') return;
          if (flagWaitinglist !== 'any' && Boolean(r.isOnWaitinglist) !== flagWaitinglist) return;
          if (flagNotifyFuture !== 'any' && Boolean(r.notifyFutureEvents) !== flagNotifyFuture) return;
          if (flagSendOffers !== 'any' && Boolean(r.sendRunningOffers) !== flagSendOffers) return;
          const email = r.originalEmail || r.email;
          if (email) {
            const key = String(email).toLowerCase();
            if (!emailSet.has(key)) {
              emailSet.add(key);
              rows.push({
                id: d.id,
                email: key,
                status: r.status,
                isOnWaitinglist: !!r.isOnWaitinglist,
                notifyFutureEvents: !!r.notifyFutureEvents,
                sendRunningOffers: !!r.sendRunningOffers,
                editionId: r.editionId,
                registrationId: d.id,
                userId: r.userId,
                firstName: r.firstName,
                lastName: r.lastName,
                name: r.name || `${r.firstName || ''} ${r.lastName || ''}`.trim(),
                registrationNumber: r.registrationNumber,
                dateOfBirth: r.dateOfBirth,
                nationality: r.nationality,
                phoneCountryCode: r.phoneCountryCode,
                phoneNumber: r.phoneNumber,
                waitinglistExpires: r.waitinglistExpires,
                comments: r.comments,
                termsAccepted: r.termsAccepted,
                travelRequired: r.travelRequired,
                representing: r.representing,
                raceDistance: r.raceDistance,
                paymentMade: r.paymentMade,
                paymentRequired: r.paymentRequired,
                originalEmail: r.originalEmail,
              });
            }
          }
        });
      } else {
        // users source (simple initial version: include all users)
        let q: any = collection(db, 'users');
        const snap = await getDocs(q);
        snap.forEach(d => {
          const u: any = d.data();
          if (u.email) {
            const key = String(u.email).toLowerCase();
            if (!emailSet.has(key)) {
              emailSet.add(key);
              rows.push({ email: key });
            }
          }
        });
      }
      setRecipients(rows);
      setSelectedEmails(new Set(rows.map(r => r.email)));
      setDryRunOpen(true);
    } catch (e) {
      alert('Failed to fetch recipients: ' + (e as any)?.message || e);
    } finally {
      setLoading(false);
    }
  };

  const currentTemplate = useMemo(() => templates.find(t => t.locale === tplLocale && t.type === tplType) || null, [templates, tplLocale, tplType]);
  const recipientsByEmail = useMemo(() => {
    const m = new Map<string, RecipientRow>();
    recipients.forEach(r => m.set(r.email, r));
    return m;
  }, [recipients]);

  const getEditionInfo = async (id?: string) => {
    if (!id) return {} as any;
    if (editionCache[id]) return editionCache[id];
    // Lazy load full edition doc using existing service
    try {
      const mod = await import('../../services/eventEditionService');
      const ed = await mod.getEventEdition(id);
      const info = {
        eventName: ed.eventName,
        eventShortName: ed.eventShortName,
        edition: ed.edition,
        startTime: ed.startTime,
      };
      setEditionCache(prev => ({ ...prev, [id]: info }));
      return info;
    } catch {
      return {} as any;
    }
  };

  const renderTemplate = async (email: string) => {
    if (!currentTemplate) return { subject: '', html: '' };
    const row = recipientsByEmail.get(email);
    const edInfo = row?.editionId ? (editionCache[row.editionId] || await getEditionInfo(row.editionId)) : {};
    // Normalize dates from registration
    const dobDate = toDateOrNull(row?.dateOfBirth);
    const waitExpDate = toDateOrNull(row?.waitinglistExpires);
    const eventStartDate = toDateOrNull(edInfo?.startTime || event?.startTime);
    const dobText = fmtDate(dobDate, tplLocale) || undefined;
    const waitExpText = fmtDateTime(waitExpDate, tplLocale) || undefined;
    const eventDateText = fmtDateTime(eventStartDate, tplLocale) || undefined;
    const ctx: any = {
      // Registration fields
      email,
      id: row?.registrationId,
      registrationId: row?.registrationId,
      userId: row?.userId,
      name: row?.name,
      firstName: row?.firstName,
      lastName: row?.lastName,
      registrationNumber: row?.registrationNumber,
      // Dates: provide formatted defaults and expose raw values separately
      dateOfBirth: dobText,
      dateOfBirthText: dobText,
      dateOfBirthRaw: row?.dateOfBirth,
      nationality: row?.nationality,
      phoneCountryCode: row?.phoneCountryCode,
      phoneNumber: row?.phoneNumber,
      waitinglistExpires: waitExpText,
      waitinglistExpiresText: waitExpText,
      waitinglistExpiresRaw: row?.waitinglistExpires,
      comments: row?.comments,
      termsAccepted: row?.termsAccepted,
      travelRequired: row?.travelRequired,
      representing: row?.representing,
      raceDistance: row?.raceDistance,
      paymentMade: row?.paymentMade,
      paymentRequired: row?.paymentRequired,
      originalEmail: row?.originalEmail,
      isOnWaitinglist: row?.isOnWaitinglist,
      notifyFutureEvents: row?.notifyFutureEvents,
      sendRunningOffers: row?.sendRunningOffers,
      status: row?.status,
      // Event edition fields (from selected event or fetched edition)
      eventEdition: edInfo?.edition ?? event?.edition,
      eventName: edInfo?.eventName ?? event?.eventName,
      eventShortName: edInfo?.eventShortName ?? event?.eventShortName,
      eventDate: eventDateText,
      eventDateText,
      eventDateRaw: edInfo?.startTime || event?.startTime,
      // Common
      today: new Date(),
      locale: tplLocale,
    };
    const subject = Handlebars.compile(currentTemplate.subjectTemplate)(ctx);
    const html = Handlebars.compile(currentTemplate.bodyTemplate)(ctx);
    return { subject, html };
  };

  const startCampaign = async () => {
    if (!currentTemplate) {
      alert('Select a template first.');
      return;
    }
    const selectedList = Array.from(selectedEmails);
    if (!selectedList.length) {
      alert('No recipients. Run Dry-run to load recipients.');
      return;
    }
    const name = campaignName.trim() || `${tplType} ${new Date().toISOString()}`;
    try {
      setEnqueueing(true);
      setProgress({ total: selectedList.length, enqueued: 0 });
      // Create campaign doc
      const campRef = await addDoc(collection(db, 'campaigns'), {
        name,
        createdAt: serverTimestamp(),
        createdBy: 'admin', // TODO: replace with auth user
        filters: {
          source, editionId, statuses, excludeCancelled,
          isOnWaitinglist: flagWaitinglist,
          notifyFutureEvents: flagNotifyFuture,
          sendRunningOffers: flagSendOffers,
        },
        template: { type: tplType, locale: tplLocale },
        counts: { total: selectedList.length, enqueued: 0, sent: 0, error: 0 },
        status: 'RUNNING',
      });
      const campaignId = campRef.id;

      // Enqueue in batches
      for (let i = 0; i < selectedList.length; i += batchSize) {
        const batch = selectedList.slice(i, i + batchSize);
        await Promise.all(batch.map(async (email) => {
          const { subject, html } = await renderTemplate(email);
          await enqueueRawEmail(email, subject, html, {
            type: tplType,
            context: { locale: tplLocale },
            eventEditionId: editionId,
            campaignId,
          });
        }));
        const enqueued = Math.min(i + batch.length, selectedList.length);
        setProgress({ total: selectedList.length, enqueued });
        // Update campaign progress
        await updateDoc(doc(db, 'campaigns', campaignId), {
          'counts.enqueued': enqueued,
          lastUpdatedAt: serverTimestamp(),
        });
        if (i + batch.length < selectedList.length) {
          await new Promise(res => setTimeout(res, batchDelayMs));
        }
      }
      await updateDoc(doc(db, 'campaigns', campaignId), {
        status: 'COMPLETED',
        completedAt: serverTimestamp(),
      });
      alert('Campaign enqueued.');
    } catch (e: any) {
      alert('Failed to enqueue campaign: ' + (e?.message || e));
    } finally {
      setEnqueueing(false);
    }
  };

  const sendTest = async () => {
    if (!currentTemplate) {
      alert('Select a template first.');
      return;
    }
    if (!testRecipient) return;
    try {
      const { subject, html } = await renderTemplate(testRecipient);
      await enqueueRawEmail(testRecipient, subject, html, {
        type: tplType,
        context: { locale: tplLocale },
        eventEditionId: editionId,
      });
      alert('Test email enqueued.');
      setTestOpen(false);
      setTestRecipient('');
    } catch (e: any) {
      alert('Failed to enqueue test email: ' + (e?.message || e));
    }
  };

  return (
    <Box>
      <Typography variant="h5">Bulk Email</Typography>
      <Typography variant="body2" sx={{ mt: 1 }}>
        Build a recipient segment, select a template, dry-run to see count, then enqueue as a campaign. Emails are delivered by the SMTP agent.
      </Typography>

      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 2, mt: 2 }}>
        <FormControl fullWidth>
          <InputLabel>Source</InputLabel>
          <Select value={source} label="Source" onChange={e => setSource(e.target.value as SourceType)}>
            <MenuItem value="registrations">Registrations</MenuItem>
            <MenuItem value="users">Users</MenuItem>
          </Select>
        </FormControl>

        <FormControl fullWidth>
          <InputLabel>Edition</InputLabel>
          <Select value={editionId} label="Edition" onChange={e => setEditionId(e.target.value)}>
            <MenuItem value="">All editions</MenuItem>
            {editionOptions.map(ed => (
              <MenuItem key={ed.id} value={ed.id}>{`${ed.eventId}-${ed.edition}`}</MenuItem>
            ))}
          </Select>
        </FormControl>

        <FormControl fullWidth>
          <InputLabel>Status</InputLabel>
          <Select
            multiple
            value={statuses}
            label="Status"
            onChange={e => setStatuses(typeof e.target.value === 'string' ? [e.target.value] : (e.target.value as string[]))}
          >
            {REG_STATUSES.map(s => (
              <MenuItem key={s} value={s}>{s}</MenuItem>
            ))}
          </Select>
        </FormControl>

        <FormControlLabel
          control={<Checkbox checked={excludeCancelled} onChange={e => setExcludeCancelled(e.target.checked)} />}
          label="Exclude cancelled"
        />

        {/* Flags */}
        <FormControl fullWidth>
          <InputLabel>On Waiting-list</InputLabel>
          <Select
            value={String(flagWaitinglist)}
            label="On Waiting-list"
            onChange={e => setFlagWaitinglist((e.target.value as string) === 'any' ? 'any' : e.target.value === 'true')}
          >
            <MenuItem value="any">Any</MenuItem>
            <MenuItem value="true">Yes</MenuItem>
            <MenuItem value="false">No</MenuItem>
          </Select>
        </FormControl>

        <FormControl fullWidth>
          <InputLabel>Notify Future Events</InputLabel>
          <Select
            value={String(flagNotifyFuture)}
            label="Notify Future Events"
            onChange={e => setFlagNotifyFuture((e.target.value as string) === 'any' ? 'any' : e.target.value === 'true')}
          >
            <MenuItem value="any">Any</MenuItem>
            <MenuItem value="true">Yes</MenuItem>
            <MenuItem value="false">No</MenuItem>
          </Select>
        </FormControl>

        <FormControl fullWidth>
          <InputLabel>Send Running Offers</InputLabel>
          <Select
            value={String(flagSendOffers)}
            label="Send Running Offers"
            onChange={e => setFlagSendOffers((e.target.value as string) === 'any' ? 'any' : e.target.value === 'true')}
          >
            <MenuItem value="any">Any</MenuItem>
            <MenuItem value="true">Yes</MenuItem>
            <MenuItem value="false">No</MenuItem>
          </Select>
        </FormControl>
      </Box>

      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 2, mt: 2 }}>
        <FormControl fullWidth>
          <InputLabel>Locale</InputLabel>
          <Select value={tplLocale} label="Locale" onChange={e => setTplLocale(e.target.value)}>
            {locales.map(loc => (
              <MenuItem key={loc} value={loc}>{loc}</MenuItem>
            ))}
          </Select>
        </FormControl>
        <FormControl fullWidth>
          <InputLabel>Template Type</InputLabel>
          <Select value={tplType} label="Template Type" onChange={e => setTplType(e.target.value)}>
            {tplTypes.map(t => (
              <MenuItem key={t} value={t}>{t}</MenuItem>
            ))}
          </Select>
        </FormControl>
      </Box>

      <Box sx={{ display: 'flex', gap: 2, mt: 2, alignItems: 'center' }}>
        <Button variant="outlined" onClick={fetchRecipients} disabled={loading}>
          {loading ? <><CircularProgress size={16} sx={{ mr: 1 }} /> Loading…</> : 'Dry-run (load recipients)'}
        </Button>
        <Button variant="outlined" onClick={() => setTestOpen(true)} disabled={!tplType}>Send Test</Button>
        <TextField label="Campaign Name" value={campaignName} onChange={e => setCampaignName(e.target.value)} sx={{ minWidth: 240 }} />
        <TextField type="number" label="Batch Size" value={batchSize} onChange={e => setBatchSize(Number(e.target.value) || 100)} sx={{ width: 140 }} />
        <TextField type="number" label="Delay (ms)" value={batchDelayMs} onChange={e => setBatchDelayMs(Number(e.target.value) || 200)} sx={{ width: 140 }} />
        <Button variant="contained" onClick={startCampaign} disabled={!recipients.length || !tplType || enqueueing || selectedEmails.size === 0}>
          {enqueueing ? `Enqueueing ${progress.enqueued}/${progress.total}…` : `Start Campaign (${selectedEmails.size} selected)`}
        </Button>
      </Box>

      <Dialog open={dryRunOpen} onClose={() => setDryRunOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Dry-run Recipients ({recipients.length})</DialogTitle>
        <DialogContent>
          <Box sx={{ mb: 1 }}>
            <FormControlLabel
              control={<Checkbox checked={selectedEmails.size === recipients.length && recipients.length > 0}
                                 indeterminate={selectedEmails.size > 0 && selectedEmails.size < recipients.length}
                                 onChange={e => {
                                   if (e.target.checked) setSelectedEmails(new Set(recipients.map(r => r.email)));
                                   else setSelectedEmails(new Set());
                                 }} />}
              label={`Select all (${selectedEmails.size}/${recipients.length})`}
            />
          </Box>
          <Box sx={{ maxHeight: 360, overflow: 'auto', border: 1, borderColor: 'grey.300' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={{ textAlign: 'left', padding: 8 }}>Sel</th>
                  <th style={{ textAlign: 'left', padding: 8 }}>Email</th>
                  <th style={{ textAlign: 'left', padding: 8 }}>Status</th>
                  <th style={{ textAlign: 'left', padding: 8 }}>Waiting-list</th>
                  <th style={{ textAlign: 'left', padding: 8 }}>Notify</th>
                  <th style={{ textAlign: 'left', padding: 8 }}>Offers</th>
                  <th style={{ textAlign: 'left', padding: 8 }}>Edition</th>
                </tr>
              </thead>
              <tbody>
                {recipients.map((r) => (
                  <tr key={r.email} style={{ borderTop: '1px solid #ddd' }}>
                    <td style={{ padding: 8 }}>
                      <Checkbox size="small" checked={selectedEmails.has(r.email)} onChange={(e) => {
                        setSelectedEmails(prev => {
                          const next = new Set(prev);
                          if (e.target.checked) next.add(r.email); else next.delete(r.email);
                          return next;
                        });
                      }} />
                    </td>
                    <td style={{ padding: 8 }}>{r.email}</td>
                    <td style={{ padding: 8 }}>{r.status || '-'}</td>
                    <td style={{ padding: 8 }}>{r.isOnWaitinglist ? 'Yes' : 'No'}</td>
                    <td style={{ padding: 8 }}>{r.notifyFutureEvents ? 'Yes' : 'No'}</td>
                    <td style={{ padding: 8 }}>{r.sendRunningOffers ? 'Yes' : 'No'}</td>
                    <td style={{ padding: 8 }}>{r.editionId || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDryRunOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={testOpen} onClose={() => setTestOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Send Test Email</DialogTitle>
        <DialogContent>
          <TextField
            label="Recipient Email"
            type="email"
            fullWidth
            value={testRecipient}
            onChange={e => setTestRecipient(e.target.value)}
            placeholder="you@example.com"
            sx={{ mt: 1 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setTestOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={sendTest} disabled={!testRecipient || !tplType}>Send</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default BulkEmailPanel;
