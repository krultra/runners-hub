import React, { useEffect, useState } from 'react';
import {
  Container,
  Typography,
  Box,
  CircularProgress,
  Alert,
  Paper,
  Grid,
  Card,
  CardContent,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip
} from '@mui/material';
import { EmojiEvents, MilitaryTech, Timer, PersonPin, ArrowBack, Leaderboard } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import {
  getMaxLoopsRecords,
  getFastestRaceTimes,
  getAppearanceLeaders,
  listKUTCEditions,
  LoopRecord,
  FastestTimeRecord,
  AppearanceRecord
} from '../services/kutcResultsService';

const KUTCRecordsPage: React.FC = () => {
  const navigate = useNavigate();
  const [loopRecords, setLoopRecords] = useState<LoopRecord[]>([]);
  const [fastestTimes, setFastestTimes] = useState<Map<string, FastestTimeRecord[]>>(new Map());
  const [appearanceGroups, setAppearanceGroups] = useState<{ top: AppearanceRecord[]; runnerUp: AppearanceRecord[] }>({
    top: [],
    runnerUp: []
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasDataIntegrityIssues, setHasDataIntegrityIssues] = useState(false);

  const raceAvailabilityNotes: Record<string, string> = {
    '2-loops': '(this race distance was only available in 2018)',
    '3-loops': '(this race distance was only available in 2018)',
    '7-loops': '(this race distance was only available in 2018, 2019 and 2020)'
  };

  useEffect(() => {
    const fetchRecords = async () => {
      try {
        setLoading(true);
        const editions = await listKUTCEditions();
        setHasDataIntegrityIssues(editions.some(edition => edition.metadata?.resultsStatus === 'error'));

        const [loops, times, appearances] = await Promise.all([
          getMaxLoopsRecords(),
          getFastestRaceTimes(),
          getAppearanceLeaders()
        ]);
        
        setLoopRecords(loops);
        setFastestTimes(times);
        setAppearanceGroups(appearances);
      } catch (err) {
        console.error('Error fetching records:', err);
        setError('Failed to load records data');
      } finally {
        setLoading(false);
      }
    };

    fetchRecords();
  }, []);

  if (loading) {
    return (
      <Container maxWidth="xl" sx={{ mt: 4, mb: 4 }}>
        <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
          <CircularProgress />
        </Box>
      </Container>
    );
  }

  if (error) {
    return (
      <Container maxWidth="xl" sx={{ mt: 4, mb: 4 }}>
        <Alert severity="error">{error}</Alert>
      </Container>
    );
  }

  const getMedalIcon = (index: number) => {
    const colors = ['#FFD700', '#C0C0C0', '#CD7F32']; // gold, silver, bronze
    if (index >= 3) return null;
    return <MilitaryTech sx={{ fontSize: 28, color: colors[index], mr: 1 }} />;
  };

  const formatAppearances = (count: number) => `${count} ${count === 1 ? 'Edition' : 'Editions'}`;
  const topGroup = appearanceGroups.top;
  const runnerUpGroup = appearanceGroups.runnerUp;
  const topAppearancesLabel = topGroup.length > 0 ? formatAppearances(topGroup[0].appearances) : null;
  const runnerUpAppearancesLabel = runnerUpGroup.length > 0 ? formatAppearances(runnerUpGroup[0].appearances) : null;

  return (
    <Container maxWidth="xl" sx={{ mt: 4, mb: 4 }}>
      {/* Navigation */}
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, alignItems: 'center', mb: 2 }}>
        <Button
          startIcon={<ArrowBack />}
          onClick={() => navigate('/kutc/results')}
        >
          Back to Overview
        </Button>
        <Box sx={{ flex: '1 1 auto' }} />
        <Button
          variant="outlined"
          startIcon={<Leaderboard />}
          onClick={() => navigate('/kutc/all-time')}
        >
          All-Time Leaderboard
        </Button>
      </Box>

      {/* Header */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="h3" component="h1" gutterBottom fontWeight="bold">
          <EmojiEvents sx={{ fontSize: 40, mr: 1, verticalAlign: 'middle', color: 'primary.main' }} />
          KUTC Records
        </Typography>
        <Typography variant="h6" color="text.secondary">
          All-time records and achievements
        </Typography>
      </Box>

      {hasDataIntegrityIssues && (
        <Alert severity="warning" sx={{ mb: 3 }}>
          Some historical editions currently contain data errors. We are working to correct them as soon as possible.
        </Alert>
      )}

      {/* Max Loops Section */}
      <Box sx={{ mb: 6 }}>
        <Typography variant="h4" component="h2" gutterBottom fontWeight="bold" sx={{ mb: 3 }}>
          <EmojiEvents sx={{ fontSize: 32, mr: 1, verticalAlign: 'middle', color: 'primary.main' }} />
          Most Loops Completed
        </Typography>

        {loopRecords.length > 0 ? (
          <Paper elevation={2} sx={{ p: 3 }}>
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell><strong>Rank</strong></TableCell>
                    <TableCell><strong>Participant</strong></TableCell>
                    <TableCell align="center"><strong>Loops</strong></TableCell>
                    <TableCell align="center"><strong>Time</strong></TableCell>
                    <TableCell align="center"><strong>Edition</strong></TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {loopRecords.map((record, index) => (
                    <TableRow key={`${record.personId}-${record.editionId}`}>
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center' }}>
                          {getMedalIcon(index)}
                          <Typography variant="body2">{index + 1}</Typography>
                        </Box>
                      </TableCell>
                      <TableCell>
                        {record.firstName} {record.lastName}
                      </TableCell>
                      <TableCell align="center">
                        <Chip label={record.loopsCompleted} color="primary" size="small" />
                      </TableCell>
                      <TableCell align="center">{record.totalTimeDisplay}</TableCell>
                      <TableCell align="center">{record.year}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>
        ) : (
          <Alert severity="info">No loop completion records available</Alert>
        )}
      </Box>

      {/* Fastest Times Section */}
      <Box sx={{ mb: 6 }}>
        <Typography variant="h4" component="h2" gutterBottom fontWeight="bold" sx={{ mb: 3 }}>
          <Timer sx={{ fontSize: 32, mr: 1, verticalAlign: 'middle', color: 'primary.main' }} />
          Fastest Race Times
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3, maxWidth: 720 }}>
          The records listed for the various distances below are based only on times recorded by runners who were registered for that specific race distance. Split times from runners registered for a different race distance do not count as records, even if the time is faster than that of those registered as records for the race distance in question.
        </Typography>

        {Array.from(fastestTimes.entries())
          .sort(([, recordsA], [, recordsB]) => {
            // Sort by loops descending (highest loops first)
            const loopsA = recordsA[0]?.loops || 0;
            const loopsB = recordsB[0]?.loops || 0;
            return loopsB - loopsA;
          })
          .map(([distanceKey, records]) => (
          <Paper key={distanceKey} elevation={2} sx={{ mb: 3, p: 3 }}>
            <Typography variant="h6" fontWeight="bold" gutterBottom>
              {records[0]?.raceName || distanceKey}
            </Typography>
            {raceAvailabilityNotes[distanceKey] && (
              <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 2 }}>
                {raceAvailabilityNotes[distanceKey]}
              </Typography>
            )}
            
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell><strong>Rank</strong></TableCell>
                    <TableCell><strong>Participant</strong></TableCell>
                    <TableCell align="center"><strong>Time</strong></TableCell>
                    <TableCell align="center"><strong>Edition</strong></TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {records.map((record, index) => (
                    <TableRow key={`${record.personId}-${record.editionId}`}>
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center' }}>
                          {getMedalIcon(index)}
                          <Typography variant="body2">{index + 1}</Typography>
                        </Box>
                      </TableCell>
                      <TableCell>
                        {record.firstName} {record.lastName}
                      </TableCell>
                      <TableCell align="center">
                        <Chip label={record.timeDisplay} color="primary" size="small" />
                      </TableCell>
                      <TableCell align="center">{record.year}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>
        ))}

        {fastestTimes.size === 0 && (
          <Alert severity="info">No race time records available</Alert>
        )}
      </Box>

      {/* Most Appearances Section */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" component="h2" gutterBottom fontWeight="bold" sx={{ mb: 3 }}>
          <PersonPin sx={{ fontSize: 32, mr: 1, verticalAlign: 'middle', color: 'primary.main' }} />
          Most Appearances
        </Typography>

        <Paper elevation={2} sx={{ p: 3 }}>
          {topGroup.length > 0 ? (
            <>
              {topAppearancesLabel && (
                <Typography variant="h5" color="primary" gutterBottom>
                  {topAppearancesLabel}
                </Typography>
              )}
              
              <Grid container spacing={2}>
                {topGroup.map((leader) => (
                  <Grid item xs={12} sm={6} md={4} key={leader.personId}>
                    <Card variant="outlined">
                      <CardContent>
                        <Typography variant="h6" fontWeight="bold" gutterBottom>
                          {leader.firstName} {leader.lastName}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          Participated in: {leader.editions.join(', ').replace(/kutc-/g, '')}
                        </Typography>
                      </CardContent>
                    </Card>
                  </Grid>
                ))}
              </Grid>

              {runnerUpGroup.length > 0 && runnerUpAppearancesLabel && (
                <>
                  <Typography variant="h6" fontWeight="bold" sx={{ mt: 4 }}>
                    Runners-up – {runnerUpAppearancesLabel}
                  </Typography>
                  <Grid container spacing={2} sx={{ mt: 1 }}>
                    {runnerUpGroup.map((leader) => (
                      <Grid item xs={12} sm={6} md={4} key={`runner-${leader.personId}`}>
                        <Card variant="outlined">
                          <CardContent>
                            <Typography variant="h6" fontWeight="bold" gutterBottom>
                              {leader.firstName} {leader.lastName}
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                              Participated in: {leader.editions.join(', ').replace(/kutc-/g, '')}
                            </Typography>
                          </CardContent>
                        </Card>
                      </Grid>
                    ))}
                  </Grid>
                </>
              )}
            </>
          ) : (
            <Alert severity="info">No appearance records available</Alert>
          )}
        </Paper>
      </Box>
    </Container>
  );
};

export default KUTCRecordsPage;
