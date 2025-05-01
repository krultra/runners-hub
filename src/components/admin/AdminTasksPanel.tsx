import React, { useEffect, useState } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper, Typography, Box, TextField, Checkbox, FormControlLabel, Link as MuiLink, Button } from '@mui/material';
import RegistrationDetailsDialog from './RegistrationDetailsDialog';
import { getRegistrationById } from '../../services/registrationService';
import { listRegistrationStatuses, RegistrationStatus } from '../../services/statusService';
import { Registration } from '../../types';

interface AdminTask {
  registrationId: string;
  id: string;
  type: string;
  status: string;
  description?: any;
  link?: string;
  createdAt?: Date;
}

const AdminTasksPanel: React.FC = () => {
  const [tasks, setTasks] = useState<AdminTask[]>([]);
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [openOnly, setOpenOnly] = useState(true);
  const [statuses, setStatuses] = useState<RegistrationStatus[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedReg, setSelectedReg] = useState<Registration | null>(null);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'adminTasks'), snapshot => {
      const arr: AdminTask[] = snapshot.docs.map(doc => {
        const d = doc.data() as any;
        return {
          registrationId: d.registrationId,
          id: doc.id,
          type: d.type,
          status: d.status,
          description: d.description,
          link: d.link,
          createdAt: d.createdAt?.toDate()
        };
      });
      setTasks(arr);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    listRegistrationStatuses().then(setStatuses).catch(console.error);
  }, []);

  const parseDateNb = (s: string): Date | null => {
    const [d, m, y] = s.split(/[.\/]/).map(n => parseInt(n, 10));
    return isNaN(d)||isNaN(m)||isNaN(y) ? null : new Date(y, m-1, d);
  };

  const filteredTasks = tasks.filter(t => {
    if (openOnly && t.status !== 'open') return false;
    if (fromDate) {
      const from = parseDateNb(fromDate);
      if (!from || !t.createdAt || t.createdAt < from) return false;
    }
    if (toDate) {
      const to = parseDateNb(toDate);
      if (!to || !t.createdAt || t.createdAt > to) return false;
    }
    return true;
  });

  const openDetails = async (regId: string) => {
    const reg = await getRegistrationById(regId);
    if (reg) {
      setSelectedReg(reg);
      setDialogOpen(true);
    }
  };

  return (
    <>
      <Typography variant="h4" gutterBottom>Admin Tasks</Typography>
      <Box mb={2} display="flex" alignItems="center" gap={2}>
        <TextField label="From" type="text" placeholder="dd.mm.yyyy" value={fromDate} onChange={e => setFromDate(e.target.value)} size="small" InputLabelProps={{shrink:true}} />
        <TextField label="To" type="text" placeholder="dd.mm.yyyy" value={toDate} onChange={e => setToDate(e.target.value)} size="small" InputLabelProps={{shrink:true}} />
        <FormControlLabel control={<Checkbox checked={openOnly} onChange={e => setOpenOnly(e.target.checked)} />} label="Open Only" />
      </Box>
      <TableContainer component={Paper} sx={{ overflowX: 'auto' }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Date</TableCell>
              <TableCell>Type</TableCell>
              <TableCell>Status</TableCell>
              <TableCell sx={{minWidth:400}}>Description</TableCell>
              <TableCell>Link</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filteredTasks.map(t => (
              <TableRow key={t.id}>
                <TableCell>
                  {t.createdAt ? t.createdAt.toLocaleDateString('nb-NO',{day:'2-digit',month:'2-digit',year:'numeric'}) : ''}
                </TableCell>
                <TableCell>{t.type}</TableCell>
                <TableCell>{t.status}</TableCell>
                <TableCell>
                  {t.type === 'refund' && t.description
                    ? `Edition: ${t.description.editionId} / Reg#: ${t.description.registrationNumber} – ${t.description.firstName} ${t.description.lastName}, paid: ${t.description.paymentsMade}, list: ${t.description.list}`
                    : t.description
                      ? JSON.stringify(t.description)
                      : ''}
                </TableCell>
                <TableCell>
                  <Button size="small" onClick={() => openDetails(t.registrationId)}>View</Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
      {selectedReg && (
        <RegistrationDetailsDialog
          open={dialogOpen}
          registration={selectedReg}
          statuses={statuses}
          onClose={() => { setDialogOpen(false); setSelectedReg(null); }}
          onUpdate={() => {}}
        />
      )}
    </>
  );
};

export default AdminTasksPanel;
