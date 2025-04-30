import React, { useState, useEffect } from 'react';
import {
  collection,
  query,
  where,
  onSnapshot,
  doc,
  getDoc,
  updateDoc,
  serverTimestamp,
  arrayUnion
} from 'firebase/firestore';
import { db } from '../../config/firebase';
import { EmailType, sendEmail } from '../../services/emailService';
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Button,
  Paper,
  Checkbox,
  Box
} from '@mui/material';
import { ActionRequest } from '../../types';

// Extend ActionRequest with registration details
interface ActionRequestWithReg extends ActionRequest {
  firstName?: string;
  lastName?: string;
  registrationNumber?: number;
}

const ActionRequestsPanel: React.FC = () => {
  const [requests, setRequests] = useState<ActionRequestWithReg[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  useEffect(() => {
    const q = query(collection(db, 'actionRequests'), where('status', '==', 'pending'));
    const unsub = onSnapshot(q, snap => {
      (async () => {
        const items = await Promise.all(
          snap.docs.map(async d => {
            const req = d.data() as ActionRequest;
            const regSnap = await getDoc(doc(db, 'registrations', req.registrationId));
            const regData = regSnap.data();
            return {
              id: d.id,
              ...req,
              firstName: regData?.firstName,
              lastName: regData?.lastName,
              registrationNumber: regData?.registrationNumber,
            };
          })
        );
        setRequests(items);
      })();
    });
    return () => unsub();
  }, []);

  const handleApprove = async (req: ActionRequestWithReg) => {
    const reqRef = doc(db, 'actionRequests', req.id!);
    const regRef = doc(db, 'registrations', req.registrationId);
    try {
      if (req.type === 'sendReminder') {
        const mailRef = await sendEmail(EmailType.REMINDER, req.email, { id: req.registrationId });
        // remindersSent incremented inside sendEmail
        const regSnap = await getDoc(regRef);
        const currentStatus = regSnap.data()?.status || '';
        await updateDoc(regRef, { adminComments: arrayUnion({
          text: 'Action request processed by admin',
          at: new Date(),
          type: req.type,
          mailRef: mailRef.id,
          state: currentStatus
        }) });
      } else if (req.type === 'sendLastNotice') {
        const mailRef = await sendEmail(EmailType.LAST_NOTICE, req.email, { id: req.registrationId });
        // lastNoticesSent incremented inside sendEmail
        const regSnap = await getDoc(regRef);
        const currentStatus = regSnap.data()?.status || '';
        await updateDoc(regRef, { adminComments: arrayUnion({
          text: 'Action request processed by admin',
          at: new Date(),
          type: req.type,
          mailRef: mailRef.id,
          state: currentStatus
        }) });
      } else if (req.type === 'expireRegistration') {
        await updateDoc(regRef, { status: 'expired', updatedAt: serverTimestamp() });
        const mailRef = await sendEmail(EmailType.EXPIRATION, req.email, { id: req.registrationId });
        const currentStatus = 'expired';
        await updateDoc(regRef, { adminComments: arrayUnion({
          text: 'Action request processed by admin',
          at: new Date(),
          type: req.type,
          mailRef: mailRef.id,
          state: currentStatus
        }) });
      }
      await updateDoc(reqRef, { status: 'done', actedAt: serverTimestamp() });
    } catch (err) {
      console.error('Error processing action request:', err);
    }
  };

  const handleReject = async (req: ActionRequestWithReg) => {
    const reqRef = doc(db, 'actionRequests', req.id!);
    await updateDoc(reqRef, { status: 'rejected', actedAt: serverTimestamp() });
  };

  // bulk action handlers
  const handleBulkApprove = async () => {
    const toApprove = requests.filter(r => selected.has(r.id!));
    for (const req of toApprove) { await handleApprove(req); }
    setSelected(new Set());
  };

  const handleBulkReject = async () => {
    const toReject = requests.filter(r => selected.has(r.id!));
    for (const req of toReject) { await handleReject(req); }
    setSelected(new Set());
  };

  return (
    <>
      <Box mb={2} display="flex" gap={1}>
        <Button size="small" onClick={handleBulkApprove} disabled={selected.size === 0}>Approve Selected</Button>
        <Button size="small" onClick={handleBulkReject} disabled={selected.size === 0}>Reject Selected</Button>
      </Box>
      <TableContainer component={Paper} sx={{ overflowX: 'auto', width: '100%' }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell padding="checkbox">
                <Checkbox
                  indeterminate={selected.size > 0 && selected.size < requests.length}
                  checked={requests.length > 0 && selected.size === requests.length}
                  onChange={e => {
                    if (e.target.checked) setSelected(new Set(requests.map(r => r.id!)));
                    else setSelected(new Set());
                  }}
                />
              </TableCell>
              <TableCell>Reg #</TableCell>
              <TableCell>Name</TableCell>
              <TableCell>Type</TableCell>
              <TableCell>Email</TableCell>
              <TableCell>Reason</TableCell>
              <TableCell>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {requests.map(r => (
              <TableRow key={r.id}>
                <TableCell padding="checkbox">
                  <Checkbox
                    checked={selected.has(r.id!)}
                    onChange={() => {
                      const newSel = new Set(selected);
                      if (newSel.has(r.id!)) newSel.delete(r.id!);
                      else newSel.add(r.id!);
                      setSelected(newSel);
                    }}
                  />
                </TableCell>
                <TableCell>{r.registrationNumber}</TableCell>
                <TableCell>{r.firstName} {r.lastName}</TableCell>
                <TableCell>{r.type}</TableCell>
                <TableCell>{r.email}</TableCell>
                <TableCell>{r.reason}</TableCell>
                <TableCell>
                  <Button size="small" onClick={() => handleApprove(r)}>Approve</Button>
                  <Button size="small" onClick={() => handleReject(r)}>Reject</Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </>
  );
};

export default ActionRequestsPanel;
