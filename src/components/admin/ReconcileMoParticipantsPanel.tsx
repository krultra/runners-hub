import React, { useEffect, useState } from 'react';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
  limit,
} from 'firebase/firestore';
import { db } from '../../config/firebase';
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

interface MatchCandidateDoc {
  id: string;
  participantRunnerKey: string;
  userId: string;
  score: number;
  matchType: string;
  details?: Record<string, any>;
  status: 'pending' | 'approved' | 'rejected';
}

interface ParticipantStagingDoc {
  runnerKey: string;
  fullName: string;
  displayName: string;
  nameSource: string;
  yearOfBirth: number | null;
  gender: string | null;
  email: string | null;
  editions: string[];
  sourceDocIds: string[];
}

interface UserDocMinimal {
  id: string;
  fullName?: string;
  yearOfBirth?: number | null;
  email?: string | null;
}

const fetchUser = async (userId: string): Promise<UserDocMinimal | null> => {
  try {
    const snap = await getDoc(doc(db, 'users', userId));
    const data = snap.data();
    if (!data) return null;
    return { id: snap.id, fullName: data.fullName, yearOfBirth: data.yearOfBirth ?? null, email: data.email ?? null };
  } catch (e) {
    return null;
  }
};

const ReconcileMoParticipantsPanel: React.FC = () => {
  const [items, setItems] = useState<MatchCandidateDoc[]>([]);
  const [loading, setLoading] = useState(false);
  const [filterType, setFilterType] = useState<string>('');
  const [minScore, setMinScore] = useState<number>(0);

  const [participantsByKey, setParticipantsByKey] = useState<Record<string, ParticipantStagingDoc>>({});
  const [usersById, setUsersById] = useState<Record<string, UserDocMinimal>>({});

  const load = async () => {
    setLoading(true);
    const q = query(collection(db, 'moMatchCandidates'), orderBy('matchType'), orderBy('score', 'desc'), limit(500));
    const snap = await getDocs(q);
    const candidates: MatchCandidateDoc[] = [];
    snap.forEach((d) => {
      const data: any = d.data();
      candidates.push({
        id: d.id,
        participantRunnerKey: data.participantRunnerKey,
        userId: data.userId,
        score: data.score,
        matchType: data.matchType,
        details: data.details || {},
        status: data.status,
      });
    });

    const filtered = candidates.filter((c) => (filterType ? c.matchType === filterType : true) && c.score >= minScore);

    // Load participant docs
    const participantKeys = Array.from(new Set(filtered.map((c) => c.participantRunnerKey)));
    const newParticipants: Record<string, ParticipantStagingDoc> = { ...participantsByKey };
    for (const key of participantKeys) {
      if (!newParticipants[key]) {
        const snap = await getDocs(query(collection(db, 'moParticipantStaging'), where('runnerKey', '==', key), limit(1)));
        if (!snap.empty) {
          const d = snap.docs[0];
          const data: any = d.data();
          newParticipants[key] = {
            runnerKey: data.runnerKey,
            fullName: data.fullName,
            displayName: data.displayName,
            nameSource: data.nameSource,
            yearOfBirth: data.yearOfBirth ?? null,
            gender: data.gender ?? null,
            email: data.email ?? null,
            editions: data.editions || [],
            sourceDocIds: data.sourceDocIds || [],
          };
        }
      }
    }

    // Load target users
    const userIds = Array.from(new Set(filtered.map((c) => c.userId)));
    const newUsers: Record<string, UserDocMinimal> = { ...usersById };
    for (const uid of userIds) {
      if (!newUsers[uid]) {
        const u = await fetchUser(uid);
        if (u) newUsers[uid] = u;
      }
    }

    setUsersById(newUsers);
    setParticipantsByKey(newParticipants);
    setItems(filtered);
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterType, minScore]);

  const approve = async (id: string) => {
    await updateDoc(doc(db, 'moMatchCandidates', id), { status: 'approved', updatedAt: serverTimestamp() });
    setItems((prev) => prev.filter((x) => x.id !== id));
  };

  const reject = async (id: string) => {
    await updateDoc(doc(db, 'moMatchCandidates', id), { status: 'rejected', updatedAt: serverTimestamp() });
    setItems((prev) => prev.filter((x) => x.id !== id));
  };

  const approveAllEmailExact = async () => {
    const toApprove = items.filter((x) => x.matchType === 'email_exact');
    for (const c of toApprove) {
      await approve(c.id);
    }
  };

  return (
    <Box>
      <Typography variant="h6" sx={{ mb: 1 }}>Reconcile MO Participants</Typography>
      <Stack direction="row" spacing={2} sx={{ mb: 2 }}>
        <FormControl size="small">
          <InputLabel id="type-label">Type</InputLabel>
          <Select labelId="type-label" label="Type" value={filterType} onChange={(e) => setFilterType(e.target.value)} sx={{ minWidth: 180 }}>
            <MenuItem value="">All</MenuItem>
            <MenuItem value="email_exact">Email exact</MenuItem>
            <MenuItem value="name_high">Name high</MenuItem>
            <MenuItem value="name_fuzzy">Name fuzzy</MenuItem>
          </Select>
        </FormControl>
        <FormControl size="small">
          <InputLabel id="score-label">Min score</InputLabel>
          <Select labelId="score-label" label="Min score" value={String(minScore)} onChange={(e) => setMinScore(Number(e.target.value))} sx={{ minWidth: 120 }}>
            <MenuItem value={0}>0</MenuItem>
            <MenuItem value={0.5}>0.5</MenuItem>
            <MenuItem value={0.75}>0.75</MenuItem>
            <MenuItem value={0.9}>0.9</MenuItem>
          </Select>
        </FormControl>
        <Button size="small" variant="outlined" onClick={approveAllEmailExact} disabled={items.filter((x) => x.matchType === 'email_exact').length === 0}>
          Approve all email exact
        </Button>
        <Button size="small" onClick={load} disabled={loading}>Refresh</Button>
      </Stack>
      <Paper variant="outlined">
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Participant</TableCell>
                <TableCell>User</TableCell>
                <TableCell>Score</TableCell>
                <TableCell>Type</TableCell>
                <TableCell>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {items.map((c) => {
                const p = participantsByKey[c.participantRunnerKey];
                const u = usersById[c.userId];
                return (
                  <TableRow key={c.id}>
                    <TableCell>
                      <Box display="flex" flexDirection="column">
                        <Typography variant="body2" fontWeight={600}>{p?.displayName || p?.fullName || c.participantRunnerKey}</Typography>
                        <Typography variant="caption" color="text.secondary">
                          yob: {p?.yearOfBirth ?? '—'} · email: {p?.email || '—'} · editions: {p?.editions?.length ?? 0}
                        </Typography>
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Box display="flex" flexDirection="column">
                        <Typography variant="body2" fontWeight={600}>{u?.fullName || u?.id}</Typography>
                        <Typography variant="caption" color="text.secondary">
                          yob: {u?.yearOfBirth ?? '—'} · email: {u?.email || '—'}
                        </Typography>
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Chip size="small" color={c.score >= 0.9 ? 'success' : c.score >= 0.75 ? 'warning' : 'default'} label={c.score.toFixed(2)} />
                    </TableCell>
                    <TableCell>
                      <Chip size="small" label={c.matchType} />
                    </TableCell>
                    <TableCell>
                      <Stack direction="row" spacing={1}>
                        <Button size="small" onClick={() => approve(c.id)}>Approve</Button>
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

export default ReconcileMoParticipantsPanel;
