import React, { useState, useEffect } from 'react';
import { Box, Typography, TextField, Button, Dialog, DialogTitle, DialogContent, CircularProgress } from '@mui/material';
import { db } from '../../config/firebase';
import { collection, doc, onSnapshot, setDoc } from 'firebase/firestore';

const scheduleKeys = [
  {
    key: 'expireWaitinglistRegistrations',
    label: 'Expire Waiting-list Registrations',
    default: '19 23 * * *',
    description: 'This function will look for waiting-list registrations whose expiration date has passed and expire them.'
  },
  {
    key: 'expirePendingRegistrations',
    label: 'Expire Pending Registrations',
    default: '20 23 * * *',
    description: 'This function will look for registrations with status "pending" that were registered more than 9 days ago, have received a reminder and a last notice, and then expire them.'
  },
  {
    key: 'lastNoticePendingRegistrations',
    label: 'Last Notice Pending Registrations',
    default: '21 23 * * *',
    description: 'This function will look for registrations with status "pending" that were registered more than 7 days ago, have received a reminder but no last notice, and then send a final notice.'
  },
  {
    key: 'reminderPendingRegistrations',
    label: 'Reminder Pending Registrations',
    default: '22 23 * * *',
    description: 'This function will look for registrations with status "pending" that were registered more than 5 days ago and have no previous reminders or last notices, and then send a reminder.'
  },
  {
    key: 'sendDailySummary',
    label: 'Send Daily Summary',
    default: '23 23 * * *',
    description: 'This function compiles today’s job results and registration statistics, then sends a summary email to admins.'
  },
];

const SchedulesPanel: React.FC = () => {
  const [inputValues, setInputValues] = useState<Record<string,string>>(() =>
    scheduleKeys.reduce((acc, s) => ({ ...acc, [s.key]: '' }), {} as Record<string,string>)
  );
  const [savingTarget, setSavingTarget] = useState<{ key: string; value: string } | null>(null);
  // actual schedules from Cloud Function
  const [currentSchedules, setCurrentSchedules] = useState<Record<string,string>>({});
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    const unsub = onSnapshot(
      collection(db, 'currentSchedules'),
      snapshot => {
        const data: Record<string,string> = {};
        snapshot.docs.forEach(d => { data[d.id] = (d.data() as any).schedule; });
        setCurrentSchedules(data);
        setErrorMsg(null);
      },
      err => {
        console.error('currentSchedules listener error', err);
        setErrorMsg(err.message);
        setSavingTarget(null);
      }
    );
    return () => unsub();
  }, []);

  // simple cron validator: 5 space-separated fields
  const isValidCron = (s: string) => s.trim().split(/\s+/).length === 5;
  // close dialog when actual schedule matches override
  useEffect(() => {
    if (savingTarget) {
      const cur = currentSchedules[savingTarget.key];
      if (cur === savingTarget.value) {
        setSavingTarget(null);
      }
    }
  }, [currentSchedules, savingTarget]);

  const saveOverride = async (key: string) => {
    const value = inputValues[key];
    if (!isValidCron(value)) return;
    setSavingTarget({ key, value });
    await setDoc(doc(db, 'functionSchedules', key), { override: value });
    setInputValues(prev => ({ ...prev, [key]: '' }));
  };

  return (
    <Box>
      <Typography variant="h4" gutterBottom>Function Schedules</Typography>
      {errorMsg && (
        <Typography color="error" gutterBottom>
          Error loading schedules: {errorMsg}
        </Typography>
      )}
      {scheduleKeys.map(s => {
        return (
        <Box key={s.key} sx={{ mb: 2 }}>
          <Typography variant="subtitle1">{s.label}</Typography>
          <Typography variant="body2" color="textSecondary">{s.description}</Typography>
          <Typography>Schedule: {currentSchedules[s.key] || s.default}</Typography>
          <TextField
            label="New Cron"
            value={inputValues[s.key]}
            onChange={e => setInputValues(prev => ({ ...prev, [s.key]: e.target.value }))}
            size="small"
            sx={{ mr: 1, width: '250px' }}
          />
          <Button
            variant="contained"
            onClick={() => saveOverride(s.key)}
            disabled={!inputValues[s.key] || Boolean(savingTarget) || !isValidCron(inputValues[s.key])}
          >
            Update
          </Button>
          {inputValues[s.key] && !isValidCron(inputValues[s.key]) && (
            <Typography color="error" variant="caption">
              Invalid cron format (expected 5 fields)
            </Typography>
          )}
        </Box>
        );
      })}
      <Dialog open={Boolean(savingTarget)} disableEscapeKeyDown>
        <DialogTitle>Please wait</DialogTitle>
        <DialogContent sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <CircularProgress size={24} />
          <Typography>Updating {savingTarget?.key}…</Typography>
        </DialogContent>
      </Dialog>
    </Box>
  );
};

export default SchedulesPanel;
