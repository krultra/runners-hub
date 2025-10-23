import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Breadcrumbs,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Container,
  Grid,
  Link as MuiLink,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography
} from '@mui/material';
import NavigateBeforeIcon from '@mui/icons-material/NavigateBefore';
import { Link as RouterLink, useParams } from 'react-router-dom';
import {
  getCheckpointSummary,
  getEnrichedCheckpointResults,
  groupByLoop,
  formatTime,
  formatPace,
  formatSpeed,
  CheckpointSummary,
  EnrichedCheckpointResult,
  LoopAggregate
} from '../services/checkpointResultsService';

const formatDistance = (distance: number | null | undefined): string => {
  if (distance === null || distance === undefined) {
    return 'N/A';
  }
  if (Number.isFinite(distance)) {
    return `${distance.toFixed(1)} km`;
  }
  return 'N/A';
};

const formatAscent = (ascent: number | null | undefined): string => {
  if (ascent === null || ascent === undefined) {
    return 'N/A';
  }
  return `${ascent.toFixed(0)} m`;
};

const formatPosition = (position: number | null | undefined): string => {
  if (!position || position <= 0) {
    return '—';
  }
  return `#${position}`;
};

const RunnerCheckpointAnalysisPage: React.FC = () => {
  const { userId, editionId } = useParams<{ userId: string; editionId: string }>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<CheckpointSummary | null>(null);
  const [loops, setLoops] = useState<LoopAggregate[]>([]);
  const [checkpoints, setCheckpoints] = useState<EnrichedCheckpointResult[]>([]);

  useEffect(() => {
    if (!userId || !editionId) {
      setError('Missing runner or edition information.');
      setLoading(false);
      return;
    }

    let mounted = true;

    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const enriched = await getEnrichedCheckpointResults(editionId, userId);
        if (!mounted) return;
        setCheckpoints(enriched);

        const [loopAggregates, summaryData] = await Promise.all([
          groupByLoop(enriched, editionId),
          getCheckpointSummary(editionId, userId)
        ]);
        if (!mounted) return;
        setLoops(loopAggregates);
        setSummary(summaryData);
      } catch (err: any) {
        if (!mounted) return;
        setError(err?.message || 'Failed to load checkpoint analysis.');
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    load();

    return () => {
      mounted = false;
    };
  }, [editionId, userId]);

  const checkpointsByLoop = useMemo(() => {
    const map = new Map<number, EnrichedCheckpointResult[]>();
    checkpoints.forEach((cp) => {
      if (!map.has(cp.loopNumber)) {
        map.set(cp.loopNumber, []);
      }
      map.get(cp.loopNumber)!.push(cp);
    });
    return map;
  }, [checkpoints]);

  if (loading) {
    return (
      <Container maxWidth="lg" sx={{ py: 6, textAlign: 'center' }}>
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

  if (!summary) {
    return (
      <Container maxWidth="md" sx={{ py: 6 }}>
        <Alert severity="info">No checkpoint data available for this runner in the selected edition.</Alert>
      </Container>
    );
  }

  const editionLabel = summary.eventEditionId?.toUpperCase?.() || editionId?.toUpperCase?.() || editionId;
  const runnerProfileUrl = `/runners/${userId}`;

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Box sx={{ mb: 3 }}>
        <Button
          component={RouterLink}
          to={runnerProfileUrl}
          startIcon={<NavigateBeforeIcon />}
          variant="text"
          sx={{ mb: 1 }}
        >
          Back to profile
        </Button>

        <Breadcrumbs aria-label="breadcrumb">
          <MuiLink component={RouterLink} color="inherit" to="/runners/search">
            Runner search
          </MuiLink>
          <MuiLink component={RouterLink} color="inherit" to={runnerProfileUrl}>
            {summary.participantName}
          </MuiLink>
          <Typography color="text.primary">{editionLabel}</Typography>
        </Breadcrumbs>
      </Box>

      <Box sx={{ mb: 4 }}>
        <Typography variant="h3" gutterBottom>
          {summary.participantName}
        </Typography>
        <Typography variant="body1" color="text.secondary">
          {editionLabel} • {summary.raceName}
        </Typography>
      </Box>

      <Paper sx={{ p: 3, mb: 4 }}>
        <Grid container spacing={3}>
          <Grid item xs={12} md={4}>
            <Stack spacing={1}>
              <Typography variant="overline" color="text.secondary">
                Bib
              </Typography>
              <Typography variant="h5">{summary.bib || '—'}</Typography>
            </Stack>
          </Grid>
          <Grid item xs={12} md={4}>
            <Stack spacing={1}>
              <Typography variant="overline" color="text.secondary">
                Loops completed
              </Typography>
              <Typography variant="h5">{summary.totalLoops}</Typography>
            </Stack>
          </Grid>
          <Grid item xs={12} md={4}>
            <Stack spacing={1}>
              <Typography variant="overline" color="text.secondary">
                Total distance
              </Typography>
              <Typography variant="h6">{formatDistance(summary.totalDistance)}</Typography>
            </Stack>
          </Grid>
          <Grid item xs={12} md={4}>
            <Stack spacing={1}>
              <Typography variant="overline" color="text.secondary">
                Total ascent
              </Typography>
              <Typography variant="h6">{formatAscent(summary.totalAscent)}</Typography>
            </Stack>
          </Grid>
          <Grid item xs={12} md={4}>
            <Stack spacing={1}>
              <Typography variant="overline" color="text.secondary">
                Total race time
              </Typography>
              <Typography variant="h6">{summary.totalRaceTimeFormatted}</Typography>
              <Typography variant="body2" color="text.secondary">
                Moving: {summary.totalMovingTimeFormatted} • Rest: {summary.totalRestTimeFormatted}
              </Typography>
            </Stack>
          </Grid>
          <Grid item xs={12} md={4}>
            <Stack spacing={1}>
              <Typography variant="overline" color="text.secondary">
                Average pace & speed
              </Typography>
              <Typography variant="h6">{summary.averagePaceFormatted}</Typography>
              <Typography variant="body2" color="text.secondary">
                {summary.averageSpeedKmh ? formatSpeed(summary.averageSpeedKmh) : '—'}
              </Typography>
            </Stack>
          </Grid>
        </Grid>
      </Paper>

      <Box sx={{ mb: 4 }}>
        <Typography variant="h5" gutterBottom>
          Performance insights
        </Typography>
        <Grid container spacing={2}>
          {summary.fastestLeg && (
            <Grid item xs={12} md={6} lg={3}>
              <Card variant="outlined">
                <CardContent>
                  <Typography variant="subtitle2" color="success.main">
                    Fastest leg
                  </Typography>
                  <Typography variant="body2">
                    {summary.fastestLeg.checkpointName} (Loop {summary.fastestLeg.loopNumber})
                  </Typography>
                  <Typography variant="h6">{summary.fastestLeg.paceFormatted}</Typography>
                </CardContent>
              </Card>
            </Grid>
          )}
          {summary.slowestLeg && (
            <Grid item xs={12} md={6} lg={3}>
              <Card variant="outlined">
                <CardContent>
                  <Typography variant="subtitle2" color="warning.main">
                    Slowest leg
                  </Typography>
                  <Typography variant="body2">
                    {summary.slowestLeg.checkpointName} (Loop {summary.slowestLeg.loopNumber})
                  </Typography>
                  <Typography variant="h6">{summary.slowestLeg.paceFormatted}</Typography>
                </CardContent>
              </Card>
            </Grid>
          )}
          {summary.biggestGain && (
            <Grid item xs={12} md={6} lg={3}>
              <Card variant="outlined">
                <CardContent>
                  <Typography variant="subtitle2" color="info.main">
                    Biggest gain
                  </Typography>
                  <Typography variant="body2">
                    {summary.biggestGain.checkpointName} (Loop {summary.biggestGain.loopNumber})
                  </Typography>
                  <Typography variant="h6">+{summary.biggestGain.positionChange} places</Typography>
                  <Typography variant="caption" color="text.secondary">
                    {summary.biggestGain.type === 'race' ? 'Race position' : 'Overall position'}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          )}
          {summary.biggestLoss && (
            <Grid item xs={12} md={6} lg={3}>
              <Card variant="outlined">
                <CardContent>
                  <Typography variant="subtitle2" color="error.main">
                    Biggest loss
                  </Typography>
                  <Typography variant="body2">
                    {summary.biggestLoss.checkpointName} (Loop {summary.biggestLoss.loopNumber})
                  </Typography>
                  <Typography variant="h6">{summary.biggestLoss.positionChange} places</Typography>
                  <Typography variant="caption" color="text.secondary">
                    {summary.biggestLoss.type === 'race' ? 'Race position' : 'Overall position'}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          )}
        </Grid>
      </Box>

      <Box sx={{ mb: 4 }}>
        <Typography variant="h5" gutterBottom>
          Loop breakdown
        </Typography>
        <Stack spacing={3}>
          {loops.map((loop) => {
            const loopCheckpoints = checkpointsByLoop.get(loop.loopNumber) || [];
            const raceChange = loop.loopNumber > 1 ? loop.racePositionChangeThisLoop : null;
            const overallChange = loop.loopNumber > 1 ? loop.overallPositionChangeThisLoop : null;
            return (
              <Paper key={loop.loopNumber} sx={{ p: 3 }}>
                <Box sx={{ mb: 2, display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', flexWrap: 'wrap', gap: 2 }}>
                  <Typography variant="h6">Loop {loop.loopNumber}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    Distance: {formatDistance(loop.cumulativeDistance)} • Ascent: {formatAscent(loop.cumulativeAscent)}
                  </Typography>
                </Box>
                <Grid container spacing={2} sx={{ mb: 2 }}>
                  <Grid item xs={12} md={4}>
                    <Typography variant="body2">
                      <strong>Total time:</strong> {loop.totalLoopTimeFormatted}
                    </Typography>
                    <Typography variant="body2">
                      <strong>Moving time:</strong> {loop.movingTimeFormatted}
                    </Typography>
                    <Typography variant="body2">
                      <strong>Rest time:</strong> {loop.restTimeFormatted}
                    </Typography>
                    <Typography variant="body2">
                      <strong>Acc rest:</strong> {loop.accumulatedRestTimeFormatted}
                    </Typography>
                  </Grid>
                  <Grid item xs={12} md={4}>
                    <Typography variant="body2">
                      <strong>Avg pace:</strong> {formatPace(loop.averagePaceMinPerKm)}
                    </Typography>
                    <Typography variant="body2">
                      <strong>Avg speed:</strong> {loop.averageSpeedKmh ? formatSpeed(loop.averageSpeedKmh) : '—'}
                    </Typography>
                  </Grid>
                  <Grid item xs={12} md={4}>
                    <Typography variant="body2">
                      <strong>Race position:</strong> {formatPosition(loop.racePositionAtEnd)}
                      {raceChange != null && (
                        <> ({raceChange > 0 ? '+' : ''}{raceChange})</>
                      )}
                    </Typography>
                    <Typography variant="body2">
                      <strong>Overall position:</strong> {formatPosition(loop.overallPositionAtEnd)}
                      {overallChange != null && (
                        <> ({overallChange > 0 ? '+' : ''}{overallChange})</>
                      )}
                    </Typography>
                    <Typography variant="body2">
                      <strong>Checkpoints:</strong> {loopCheckpoints.length}
                    </Typography>
                  </Grid>
                </Grid>

                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Checkpoint</TableCell>
                        <TableCell>Time</TableCell>
                        <TableCell>Leg time</TableCell>
                        <TableCell>Leg pace</TableCell>
                        <TableCell>Race position</TableCell>
                        <TableCell>Overall position</TableCell>
                        <TableCell align="right">Rest (s)</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {loopCheckpoints.map((cp) => (
                        <TableRow key={cp.sequenceNumber}>
                          <TableCell>
                            <Typography variant="body2">{cp.checkpointName}</Typography>
                            <Typography variant="caption" color="text.secondary">
                              {cp.scanTimeFormatted}
                            </Typography>
                          </TableCell>
                          <TableCell>{cp.raceTimeFormatted}</TableCell>
                          <TableCell>{cp.legTimeFormatted}</TableCell>
                          <TableCell>{cp.legPaceFormatted}</TableCell>
                          <TableCell>{formatPosition(cp.racePosition)}</TableCell>
                          <TableCell>{formatPosition(cp.overallPosition)}</TableCell>
                          <TableCell align="right">{formatTime(cp.restTimeSeconds ?? null)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Paper>
            );
          })}
        </Stack>
      </Box>
    </Container>
  );
};

export default RunnerCheckpointAnalysisPage;
