import React, { useState } from 'react';
import {
  Container,
  Box,
  Typography,
  TextField,
  Button,
  Paper,
  CircularProgress,
  Alert,
  Divider,
  Grid,
  Card,
  CardContent
} from '@mui/material';
import {
  getCheckpointResults,
  getEnrichedCheckpointResults,
  getCheckpointSummary,
  groupByLoop,
  CheckpointSummary,
  LoopAggregate
} from '../services/checkpointResultsService';

const CheckpointTestPage: React.FC = () => {
  const [eventEditionId, setEventEditionId] = useState('kutc-2025');
  const [userId, setUserId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<CheckpointSummary | null>(null);
  const [loops, setLoops] = useState<LoopAggregate[]>([]);

  const handleTest = async () => {
    if (!userId.trim()) {
      setError('Please enter a user ID');
      return;
    }

    setLoading(true);
    setError(null);
    setSummary(null);
    setLoops([]);

    try {
      console.log('Testing checkpoint service...');
      console.log('Event:', eventEditionId);
      console.log('User:', userId);

      // Test 1: Get raw checkpoint results
      console.log('\n1. Fetching raw checkpoint results...');
      const raw = await getCheckpointResults(eventEditionId, userId);
      console.log(`✓ Found ${raw.length} checkpoint results`);
      console.log('First checkpoint:', raw[0]);

      // Test 2: Get enriched checkpoint results
      console.log('\n2. Fetching enriched checkpoint results...');
      const enriched = await getEnrichedCheckpointResults(eventEditionId, userId);
      console.log(`✓ Enriched ${enriched.length} checkpoint results`);
      console.log('First enriched checkpoint:', enriched[0]);

      // Test 3: Group by loop
      console.log('\n3. Grouping by loop...');
      const loopAggregates = await groupByLoop(enriched, eventEditionId);
      console.log(`✓ Found ${loopAggregates.length} loops`);
      console.log('Loop aggregates:', loopAggregates);
      setLoops(loopAggregates);

      // Test 4: Get summary
      console.log('\n4. Generating summary...');
      const summaryData = await getCheckpointSummary(eventEditionId, userId);
      console.log('✓ Summary generated');
      console.log('Summary:', summaryData);
      setSummary(summaryData);

      console.log('\n✓ All tests passed!');
    } catch (err: any) {
      console.error('Test failed:', err);
      setError(err.message || 'Test failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Typography variant="h3" gutterBottom>
        Checkpoint Service Test
      </Typography>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
        Test the checkpoint results service with real data. Check browser console for detailed logs.
      </Typography>

      {/* Input Form */}
      <Paper sx={{ p: 3, mb: 4 }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} sm={5}>
            <TextField
              fullWidth
              label="Event Edition ID"
              value={eventEditionId}
              onChange={(e) => setEventEditionId(e.target.value)}
              placeholder="kutc-2025"
            />
          </Grid>
          <Grid item xs={12} sm={5}>
            <TextField
              fullWidth
              label="User ID"
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              placeholder="Enter user ID from Firestore"
            />
          </Grid>
          <Grid item xs={12} sm={2}>
            <Button
              fullWidth
              variant="contained"
              onClick={handleTest}
              disabled={loading}
            >
              {loading ? <CircularProgress size={24} /> : 'Test'}
            </Button>
          </Grid>
        </Grid>
      </Paper>

      {/* Error Display */}
      {error && (
        <Alert severity="error" sx={{ mb: 4 }}>
          {error}
        </Alert>
      )}

      {/* Summary Display */}
      {summary && (
        <>
          <Paper sx={{ p: 3, mb: 4 }}>
            <Typography variant="h5" gutterBottom>
              Summary
            </Typography>
            <Divider sx={{ mb: 2 }} />
            
            <Grid container spacing={2}>
              <Grid item xs={12} md={6}>
                <Typography variant="body2"><strong>Participant:</strong> {summary.participantName}</Typography>
                <Typography variant="body2"><strong>Bib:</strong> {summary.bib}</Typography>
                <Typography variant="body2"><strong>Race:</strong> {summary.raceName}</Typography>
                <Typography variant="body2"><strong>Distance:</strong> {summary.raceDistance} km</Typography>
              </Grid>
              <Grid item xs={12} md={6}>
                <Typography variant="body2"><strong>Checkpoints:</strong> {summary.totalCheckpoints}</Typography>
                <Typography variant="body2"><strong>Loops:</strong> {summary.totalLoops}</Typography>
                <Typography variant="body2"><strong>Total Distance:</strong> {summary.totalDistance ? `${summary.totalDistance} km` : 'N/A'}</Typography>
                <Typography variant="body2"><strong>Total Ascent:</strong> {summary.totalAscent ? `${summary.totalAscent} m` : 'N/A'}</Typography>
              </Grid>
              <Grid item xs={12}>
                <Divider sx={{ my: 2 }} />
              </Grid>
              <Grid item xs={12} md={4}>
                <Typography variant="body2"><strong>Race Time:</strong> {summary.totalRaceTimeFormatted}</Typography>
                <Typography variant="body2"><strong>Moving Time:</strong> {summary.totalMovingTimeFormatted}</Typography>
                <Typography variant="body2"><strong>Rest Time:</strong> {summary.totalRestTimeFormatted}</Typography>
              </Grid>
              <Grid item xs={12} md={4}>
                <Typography variant="body2"><strong>Average Pace:</strong> {summary.averagePaceFormatted}</Typography>
                <Typography variant="body2"><strong>Average Speed:</strong> {summary.averageSpeedKmh ? `${summary.averageSpeedKmh.toFixed(1)} km/h` : 'N/A'}</Typography>
              </Grid>
              <Grid item xs={12} md={4}>
                <Typography variant="body2"><strong>Final Race Position:</strong> {summary.finalRacePosition}</Typography>
                <Typography variant="body2"><strong>Final Overall Position:</strong> {summary.finalOverallPosition}</Typography>
              </Grid>
            </Grid>

            {/* Performance Insights */}
            <Box sx={{ mt: 3 }}>
              <Typography variant="h6" gutterBottom>Performance Insights</Typography>
              <Grid container spacing={2}>
                {summary.fastestLeg && (
                  <Grid item xs={12} sm={6}>
                    <Card variant="outlined">
                      <CardContent>
                        <Typography variant="subtitle2" color="success.main">Fastest Leg</Typography>
                        <Typography variant="body2">{summary.fastestLeg.checkpointName} (Loop {summary.fastestLeg.loopNumber})</Typography>
                        <Typography variant="body2"><strong>{summary.fastestLeg.paceFormatted}</strong></Typography>
                      </CardContent>
                    </Card>
                  </Grid>
                )}
                {summary.slowestLeg && (
                  <Grid item xs={12} sm={6}>
                    <Card variant="outlined">
                      <CardContent>
                        <Typography variant="subtitle2" color="warning.main">Slowest Leg</Typography>
                        <Typography variant="body2">{summary.slowestLeg.checkpointName} (Loop {summary.slowestLeg.loopNumber})</Typography>
                        <Typography variant="body2"><strong>{summary.slowestLeg.paceFormatted}</strong></Typography>
                      </CardContent>
                    </Card>
                  </Grid>
                )}
                {summary.biggestGain && (
                  <Grid item xs={12} sm={6}>
                    <Card variant="outlined">
                      <CardContent>
                        <Typography variant="subtitle2" color="info.main">Biggest Gain</Typography>
                        <Typography variant="body2">{summary.biggestGain.checkpointName} (Loop {summary.biggestGain.loopNumber})</Typography>
                        <Typography variant="body2"><strong>+{summary.biggestGain.positionChange} places</strong> ({summary.biggestGain.type})</Typography>
                      </CardContent>
                    </Card>
                  </Grid>
                )}
                {summary.biggestLoss && (
                  <Grid item xs={12} sm={6}>
                    <Card variant="outlined">
                      <CardContent>
                        <Typography variant="subtitle2" color="error.main">Biggest Loss</Typography>
                        <Typography variant="body2">{summary.biggestLoss.checkpointName} (Loop {summary.biggestLoss.loopNumber})</Typography>
                        <Typography variant="body2"><strong>{summary.biggestLoss.positionChange} places</strong> ({summary.biggestLoss.type})</Typography>
                      </CardContent>
                    </Card>
                  </Grid>
                )}
              </Grid>
            </Box>
          </Paper>

          {/* Loop Aggregates */}
          <Paper sx={{ p: 3 }}>
            <Typography variant="h5" gutterBottom>
              Loop Aggregates
            </Typography>
            <Divider sx={{ mb: 2 }} />
            
            {loops.map((loop) => (
              <Box key={loop.loopNumber} sx={{ mb: 3 }}>
                <Typography variant="h6" gutterBottom>
                  Loop {loop.loopNumber}
                </Typography>
                <Grid container spacing={2}>
                  <Grid item xs={12} md={4}>
                    <Typography variant="body2"><strong>Total Time:</strong> {loop.totalLoopTimeFormatted}</Typography>
                    <Typography variant="body2"><strong>Moving Time:</strong> {loop.movingTimeFormatted}</Typography>
                    <Typography variant="body2"><strong>Rest Time:</strong> {loop.restTimeFormatted}</Typography>
                  </Grid>
                  <Grid item xs={12} md={4}>
                    <Typography variant="body2"><strong>Distance:</strong> {loop.totalDistance ? `${loop.totalDistance.toFixed(1)} km` : 'N/A'}</Typography>
                    <Typography variant="body2"><strong>Ascent:</strong> {loop.totalAscent ? `${loop.totalAscent} m` : 'N/A'}</Typography>
                    <Typography variant="body2"><strong>Avg Pace:</strong> {loop.averagePaceFormatted}</Typography>
                  </Grid>
                  <Grid item xs={12} md={4}>
                    <Typography variant="body2">
                      <strong>Race Position:</strong> {loop.racePositionAtEnd}
                      {loop.racePositionChangeThisLoop != null && (
                        <> ({loop.racePositionChangeThisLoop > 0 ? '+' : ''}{loop.racePositionChangeThisLoop})</>
                      )}
                    </Typography>
                    <Typography variant="body2">
                      <strong>Overall Position:</strong> {loop.overallPositionAtEnd}
                      {loop.overallPositionChangeThisLoop != null && (
                        <> ({loop.overallPositionChangeThisLoop > 0 ? '+' : ''}{loop.overallPositionChangeThisLoop})</>
                      )}
                    </Typography>
                    <Typography variant="body2"><strong>Checkpoints:</strong> {loop.checkpoints.length}</Typography>
                  </Grid>
                </Grid>
                <Divider sx={{ mt: 2 }} />
              </Box>
            ))}
          </Paper>
        </>
      )}
    </Container>
  );
};

export default CheckpointTestPage;
