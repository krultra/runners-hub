import React, { useState, useEffect } from 'react';
import { Box, Typography, TextField, Button, Divider } from '@mui/material';
import { db } from '../../config/firebase';
import { collection, doc, onSnapshot, setDoc } from 'firebase/firestore';

const scheduleKeys = [
  { key: 'expirePendingRegistrations', label: 'Expire Pending Registrations', default: '20 23 * * *' },
  { key: 'reminderPendingRegistrations', label: 'Reminder Pending Registrations', default: '22 23 * * *' },
  { key: 'lastNoticePendingRegistrations', label: 'Last Notice Pending Registrations', default: '21 23 * * *' },
  { key: 'sendDailySummary', label: 'Send Daily Summary', default: '23 23 * * *' },
  { key: 'expiresWaitinglistRegistrations', label: 'Expire Waiting-list Registrations', default: '19 23 * * *' },
];

const SchedulesPanel: React.FC = () => {
  const [overrides, setOverrides] = useState<Record<string,string>>({});

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'functionSchedules'), snapshot => {
      const data: Record<string,string> = {};
      snapshot.docs.forEach(d => { data[d.id] = (d.data() as any).override; });
      setOverrides(data);
    });
    return () => unsub();
  }, []);

  const saveOverride = async (key: string) => {
    const value = overrides[key] || '';
    await setDoc(doc(db, 'functionSchedules', key), { override: value });
  };

  const ciCommand = `cd functions && npm install && npm run build && cd .. && firebase deploy --only functions --project ${process.env.REACT_APP_FIREBASE_PROJECT_ID}`;

  return (
    <Box>
      <Typography variant="h4" gutterBottom>Function Schedules</Typography>
      {scheduleKeys.map(s => (
        <Box key={s.key} sx={{ mb: 2 }}>
          <Typography variant="subtitle1">{s.label}</Typography>
          <Typography>Current: {s.default}</Typography>
          <TextField
            label="Override"
            value={overrides[s.key] || ''}
            onChange={e => setOverrides(prev => ({ ...prev, [s.key]: e.target.value }))}
            size="small"
            sx={{ mr: 1, width: '250px' }}
          />
          <Button variant="contained" onClick={() => saveOverride(s.key)}>Save</Button>
        </Box>
      ))}
      <Divider sx={{ my: 2 }} />
      <Typography variant="subtitle1">To apply these changes:</Typography>
      <Typography component="pre" sx={{ backgroundColor: '#f5f5f5', p: 1 }}>{ciCommand}</Typography>
      <Typography>Don’t forget to commit and push your changes:</Typography>
      <Typography component="code">git add . && git commit -m "Update function schedules" && git push</Typography>
    </Box>
  );
};

export default SchedulesPanel;
