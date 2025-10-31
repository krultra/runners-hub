import React, { useEffect, useMemo, useState } from 'react';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit as fsLimit,
  orderBy,
  query,
  updateDoc,
  where,
  serverTimestamp,
} from 'firebase/firestore';
import { auth, db } from '../../config/firebase';
import {
  Box,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
  Button,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Stack,
  Chip,
} from '@mui/material';

interface CandidateDoc {
  id: string;
  userAId: string;
  userBId: string;
  score: number;
  nameSimilarity?: number;
  yobDiff?: number | null;
  emailsEqual?: boolean;
  status: 'pending' | 'approved' | 'rejected';
  targetUserId?: string;
  sourceUserId?: string;
}

interface UserDocMinimal {
  id: string;
  displayName?: string;
  firstName?: string;
  lastName?: string;
  yearOfBirth?: number | null;
  email?: string | null;
  personId?: number | string | null;
  createdAt?: any;
}

const fetchUser = async (userId: string): Promise<UserDocMinimal | null> => {
  try {
    const snap = await getDoc(doc(db, 'users', userId));
    const data = snap.data() as any;
    if (!data) return null;
    return {
      id: snap.id,
      displayName: data.displayName,
      firstName: data.firstName,
      lastName: data.lastName,
      yearOfBirth: typeof data.yearOfBirth === 'number' ? data.yearOfBirth : null,
      email: data.email || null,
      personId: typeof data.personId === 'number' || typeof data.personId === 'string' ? data.personId : null,
      createdAt: data.createdAt || null,
    };
  } catch (e) {
    return null;
  }
};

const formatCreatedAt = (value: any): string => {
  if (!value) return '—';
  try {
    const d = typeof value?.toDate === 'function' ? value.toDate() : new Date(value);
    if (!(d instanceof Date) || Number.isNaN(d.getTime())) return '—';
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  } catch {
    return '—';
  }
};

const UserDuplicatesPanel: React.FC = () => {
  const [items, setItems] = useState<CandidateDoc[]>([]);
  const [loading, setLoading] = useState(false);
  const [minScore, setMinScore] = useState<number>(0.85);

  const [usersById, setUsersById] = useState<Record<string, UserDocMinimal>>({});

  const load = async () => {
    setLoading(true);
    const q = query(
      collection(db, 'userDuplicateCandidates'),
      where('status', '==', 'pending'),
      orderBy('score', 'desc'),
      fsLimit(500)
    );
    const snap = await getDocs(q);
    const list: CandidateDoc[] = [];
    snap.forEach((d) => {
      const data: any = d.data();
      list.push({
        id: d.id,
        userAId: data.userAId,
        userBId: data.userBId,
        score: data.score,
        nameSimilarity: data.nameSimilarity,
        yobDiff: data.yobDiff ?? null,
        emailsEqual: !!data.emailsEqual,
        status: data.status,
        targetUserId: data.targetUserId,
        sourceUserId: data.sourceUserId,
      });
    });

    const filtered = list.filter((c) => c.score >= minScore);

    const toLoad = Array.from(
      new Set(
        filtered.flatMap((c) => [c.userAId, c.userBId])
      )
    );
    const newUsers: Record<string, UserDocMinimal> = { ...usersById };
    for (const uid of toLoad) {
      if (!newUsers[uid]) {
        const u = await fetchUser(uid);
        if (u) newUsers[uid] = u;
      }
    }

    setUsersById(newUsers);
    setItems(filtered);
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [minScore]);

  const approve = async (id: string, targetUserId: string, sourceUserId: string) => {
    const approver = auth.currentUser?.uid || null;
    await updateDoc(doc(db, 'userDuplicateCandidates', id), {
      status: 'approved',
      targetUserId,
      sourceUserId,
      approvedBy: approver,
      approvedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    setItems((prev) => prev.filter((x) => x.id !== id));
  };

  const reject = async (id: string) => {
    const approver = auth.currentUser?.uid || null;
    await updateDoc(doc(db, 'userDuplicateCandidates', id), {
      status: 'rejected',
      approvedBy: approver,
      approvedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    setItems((prev) => prev.filter((x) => x.id !== id));
  };

  return (
    <Box>
      <Typography variant="h6" sx={{ mb: 1 }}>User Duplicates</Typography>
      <Stack direction="row" spacing={2} sx={{ mb: 2 }}>
        <FormControl size="small">
          <InputLabel id="score-label">Min score</InputLabel>
          <Select labelId="score-label" label="Min score" value={String(minScore)} onChange={(e) => setMinScore(Number(e.target.value))} sx={{ minWidth: 140 }}>
            <MenuItem value={0.7}>0.70</MenuItem>
            <MenuItem value={0.8}>0.80</MenuItem>
            <MenuItem value={0.85}>0.85</MenuItem>
            <MenuItem value={0.9}>0.90</MenuItem>
            <MenuItem value={0.95}>0.95</MenuItem>
          </Select>
        </FormControl>
        <Button size="small" onClick={load} disabled={loading}>Refresh</Button>
      </Stack>
      <Paper variant="outlined">
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>User A</TableCell>
                <TableCell>User B</TableCell>
                <TableCell>Score</TableCell>
                <TableCell>YOB Δ</TableCell>
                <TableCell>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {items.map((c) => {
                const a = usersById[c.userAId];
                const b = usersById[c.userBId];
                return (
                  <TableRow key={c.id}>
                    <TableCell>
                      <Box display="flex" flexDirection="column">
                        <Typography variant="body2" fontWeight={600}>{a?.displayName || `${a?.firstName || ''} ${a?.lastName || ''}` || c.userAId}</Typography>
                        <Typography variant="caption" color="text.secondary">
                          yob: {a?.yearOfBirth ?? '—'} · email: {a?.email || '—'} · personId: {a?.personId ?? '—'} · created: {formatCreatedAt(a?.createdAt)}
                        </Typography>
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Box display="flex" flexDirection="column">
                        <Typography variant="body2" fontWeight={600}>{b?.displayName || `${b?.firstName || ''} ${b?.lastName || ''}` || c.userBId}</Typography>
                        <Typography variant="caption" color="text.secondary">
                          yob: {b?.yearOfBirth ?? '—'} · email: {b?.email || '—'} · personId: {b?.personId ?? '—'} · created: {formatCreatedAt(b?.createdAt)}
                        </Typography>
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Chip size="small" color={c.score >= 0.9 ? 'success' : c.score >= 0.85 ? 'warning' : 'default'} label={c.score.toFixed(2)} />
                    </TableCell>
                    <TableCell>{c.yobDiff ?? '—'}</TableCell>
                    <TableCell>
                      <Stack direction="row" spacing={1}>
                        <Button size="small" onClick={() => approve(c.id, c.userAId, c.userBId)}>Approve A→B</Button>
                        <Button size="small" onClick={() => approve(c.id, c.userBId, c.userAId)}>Approve B→A</Button>
                        <Button size="small" onClick={() => reject(c.id)}>Reject</Button>
                      </Stack>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>
    </Box>
  );
};

export default UserDuplicatesPanel;
