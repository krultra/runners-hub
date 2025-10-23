import React, { useEffect, useMemo, useState } from 'react';
import {
  Container,
  Typography,
  Box,
  CircularProgress,
  Alert,
  Paper,
  Grid,
  Chip,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Button
} from '@mui/material';
import { useParams, Link as RouterLink } from 'react-router-dom';
import { getRunnerProfile, RunnerParticipation, RunnerProfile } from '../services/runnerProfileService';

const formatTimeDisplay = (display: string | null | undefined, seconds: number | null | undefined): string => {
  if (display && display.trim().length > 0) {
    return display;
  }
  if (!seconds || seconds <= 0) {
    return '—';
  }
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  const parts = [hrs, mins, secs]
    .map((value) => value.toString().padStart(2, '0'))
    .join(':');
  return parts;
};

const formatRank = (rank: number | null | undefined): string => {
  if (rank === null || rank === undefined || rank <= 0) {
    return '—';
  }
  return `#${rank}`;
};

const formatLoops = (loops: number | undefined): string => {
  if (!loops || loops <= 0) {
    return '—';
  }
  return loops.toString();
};

const formatYears = (years: number[]): string => {
  if (!years || years.length === 0) {
    return '—';
  }
  return years.join(', ');
};

const RunnerProfilePage: React.FC = () => {
  const { userId } = useParams<{ userId: string }>();
  const [profile, setProfile] = useState<RunnerProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) return;
    let isMounted = true;

    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await getRunnerProfile(userId);
        if (isMounted) {
          setProfile(data);
        }
      } catch (err: any) {
        if (isMounted) {
          setError(err?.message || 'Failed to load runner profile');
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    load();
    return () => {
      isMounted = false;
    };
  }, [userId]);

  const stats = useMemo(() => {
    if (!profile) {
      return null;
    }
    const appearanceLabel = profile.totalAppearances === 1 ? 'appearance' : 'appearances';
    const totalLoopsLabel = profile.totalLoops === 1 ? 'loop' : 'loops';
    return {
      name: `${profile.firstName} ${profile.lastName}`.trim(),
      appearances: `${profile.totalAppearances} ${appearanceLabel}`,
      years: formatYears(profile.appearanceYears),
      totalLoops: `${profile.totalLoops} ${totalLoopsLabel}`,
      best: profile.bestPerformance
        ? `${profile.bestPerformance.loops} loops • ${formatTimeDisplay(profile.bestPerformance.totalTimeDisplay, profile.bestPerformance.totalTimeSeconds)} (${profile.bestPerformance.year})`
        : '—'
    };
  }, [profile]);

  const renderParticipations = (participations: RunnerParticipation[]) => {
    if (participations.length === 0) {
      return (
        <Paper sx={{ p: 4, textAlign: 'center' }}>
          <Typography variant="body1" color="text.secondary">
            This runner has no results registered in the Runners Hub so far.
          </Typography>
        </Paper>
      );
    }

    return (
      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Edition</TableCell>
              <TableCell>Race</TableCell>
              <TableCell align="right">Race rank</TableCell>
              <TableCell align="right">Race time</TableCell>
              <TableCell align="right">Total rank</TableCell>
              <TableCell align="right">Total loops</TableCell>
              <TableCell align="right">Total time</TableCell>
              <TableCell>Status</TableCell>
              <TableCell align="right">Analysis</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {participations.map((participation) => {
              const editionLabel = `KUTC ${participation.year}`;
              const raceTime = formatTimeDisplay(participation.raceTimeDisplay, participation.raceTimeSeconds);
              const totalTime = formatTimeDisplay(participation.totalTimeDisplay, participation.totalTimeSeconds);
              const loops = formatLoops(participation.loopsCompleted);
              return (
                <TableRow key={participation.editionId}>
                  <TableCell>{editionLabel}</TableCell>
                  <TableCell>{participation.raceName}</TableCell>
                  <TableCell align="right">{formatRank(participation.raceRank)}</TableCell>
                  <TableCell align="right">{raceTime}</TableCell>
                  <TableCell align="right">{formatRank(participation.totalRank)}</TableCell>
                  <TableCell align="right">{loops}</TableCell>
                  <TableCell align="right">{totalTime}</TableCell>
                  <TableCell>{participation.status || '—'}</TableCell>
                  <TableCell align="right">
                    {participation.hasCheckpointData ? (
                      <Button
                        component={RouterLink}
                        to={`/runners/${profile?.userId}/kutc/${participation.editionId}`}
                        size="small"
                        variant="outlined"
                      >
                        View
                      </Button>
                    ) : (
                      <Typography variant="body2" color="text.secondary">
                        N/A
                      </Typography>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>
    );
  };

  if (loading) {
    return (
      <Container maxWidth="md" sx={{ py: 6, textAlign: 'center' }}>
        <CircularProgress />
      </Container>
    );
  }

  if (error) {
    return (
      <Container maxWidth="md" sx={{ py: 6 }}>
        <Alert severity="error">{error}</Alert>
      </Container>
    );
  }

  if (!profile || !stats) {
    return (
      <Container maxWidth="md" sx={{ py: 6 }}>
        <Alert severity="info">Runner not found.</Alert>
      </Container>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Box sx={{ mb: 4 }}>
        <Typography variant="h3" gutterBottom>
          {stats.name}
        </Typography>
        <Typography variant="body1" color="text.secondary">
          KUTC runner profile
        </Typography>
      </Box>

      <Paper sx={{ p: 3, mb: 4 }}>
        <Grid container spacing={3}>
          <Grid item xs={12} md={4}>
            <Stack spacing={1}>
              <Typography variant="overline" color="text.secondary">
                Total appearances
              </Typography>
              <Typography variant="h5">{stats.appearances}</Typography>
              <Chip label={`Years: ${stats.years}`} size="small" />
            </Stack>
          </Grid>
          <Grid item xs={12} md={4}>
            <Stack spacing={1}>
              <Typography variant="overline" color="text.secondary">
                Total loops completed
              </Typography>
              <Typography variant="h5">{stats.totalLoops}</Typography>
            </Stack>
          </Grid>
          <Grid item xs={12} md={4}>
            <Stack spacing={1}>
              <Typography variant="overline" color="text.secondary">
                Best performance
              </Typography>
              <Typography variant="h6">{stats.best}</Typography>
            </Stack>
          </Grid>
        </Grid>
      </Paper>

      <Box>
        <Typography variant="h5" gutterBottom>
          KUTC participation history
        </Typography>
        {renderParticipations(profile.participations)}
      </Box>
    </Container>
  );
};

export default RunnerProfilePage;
