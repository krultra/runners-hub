import React, { useEffect, useState } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper, Link, Typography } from '@mui/material';

interface AdminTask {
  id: string;
  registrationId: string;
  type: string;
  status: string;
  description?: any;
  link?: string;
}

const AdminTasksPanel: React.FC = () => {
  const [tasks, setTasks] = useState<AdminTask[]>([]);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'adminTasks'), snapshot => {
      const arr: AdminTask[] = snapshot.docs.map(doc => {
        const d = doc.data() as any;
        return {
          id: doc.id,
          registrationId: d.registrationId,
          type: d.type,
          status: d.status,
          description: d.description,
          link: d.link
        };
      });
      setTasks(arr);
    });
    return () => unsub();
  }, []);

  return (
    <>
      <Typography variant="h4" gutterBottom>Admin Tasks</Typography>
      <TableContainer component={Paper} sx={{ overflowX: 'auto' }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Registration ID</TableCell>
              <TableCell>Type</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Description</TableCell>
              <TableCell>Link</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {tasks.map(t => (
              <TableRow key={t.id}>
                <TableCell>{t.registrationId}</TableCell>
                <TableCell>{t.type}</TableCell>
                <TableCell>{t.status}</TableCell>
                <TableCell>{t.description ? JSON.stringify(t.description) : ''}</TableCell>
                <TableCell>
                  {t.link ? <Link href={t.link}>View</Link> : ''}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </>
  );
};

export default AdminTasksPanel;
