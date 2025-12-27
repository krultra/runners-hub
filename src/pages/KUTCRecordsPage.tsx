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
import { Trophy, Medal, Timer, MapPin, ArrowLeft, BarChart3 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
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
  const { t } = useTranslation();
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
    '2-loops': t('kutc.records.raceAvailabilityNotes.2Loops'),
    '3-loops': t('kutc.records.raceAvailabilityNotes.3Loops'),
    '7-loops': t('kutc.records.raceAvailabilityNotes.7Loops')
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
        setError(t('kutc.records.loadFailed'));
      } finally {
        setLoading(false);
      }
    };

    fetchRecords();
  }, [t]);

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
    return <Medal size={28} color={colors[index]} style={{ marginRight: 8 }} />;
  };

  const formatAppearances = (count: number) => t('kutc.records.appearancesCount', { count });
  const topGroup = appearanceGroups.top;
  const runnerUpGroup = appearanceGroups.runnerUp;
  const topAppearancesLabel = topGroup.length > 0 ? formatAppearances(topGroup[0].appearances) : null;
  const runnerUpAppearancesLabel = runnerUpGroup.length > 0 ? formatAppearances(runnerUpGroup[0].appearances) : null;

  return (
    <Container maxWidth="xl" sx={{ mt: 4, mb: 4 }}>
      {/* Navigation */}
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, alignItems: 'center', mb: 2 }}>
        <Button
          startIcon={<ArrowLeft />}
          onClick={() => navigate('/kutc/results')}
        >
          {t('kutc.backToOverview')}
        </Button>
        <Box sx={{ flex: '1 1 auto' }} />
        <Button
          variant="outlined"
          startIcon={<BarChart3 />}
          onClick={() => navigate('/kutc/all-time')}
        >
          {t('kutc.allTimeLeaderboard')}
        </Button>
      </Box>

      {/* Header */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="h3" component="h1" gutterBottom fontWeight="bold">
          <Trophy size={40} style={{ marginRight: 8, verticalAlign: 'middle' }} />
          {t('kutc.records.title')}
        </Typography>
        <Typography variant="h6" color="text.secondary">
          {t('kutc.records.subtitle')}
        </Typography>
      </Box>

      {hasDataIntegrityIssues && (
        <Alert severity="warning" sx={{ mb: 3 }}>
          {t('kutc.dataIntegrityWarning')}
        </Alert>
      )}

      {/* Max Loops Section */}
      <Box sx={{ mb: 6 }}>
        <Typography variant="h4" component="h2" gutterBottom fontWeight="bold" sx={{ mb: 3 }}>
          <Trophy size={32} style={{ marginRight: 8, verticalAlign: 'middle' }} />
          {t('kutc.records.mostLoopsCompleted')}
        </Typography>

        {loopRecords.length > 0 ? (
          <Paper elevation={2} sx={{ p: 3 }}>
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell><strong>{t('kutc.records.table.rank')}</strong></TableCell>
                    <TableCell><strong>{t('kutc.records.table.participant')}</strong></TableCell>
                    <TableCell align="center"><strong>{t('kutc.records.table.loops')}</strong></TableCell>
                    <TableCell align="center"><strong>{t('kutc.records.table.time')}</strong></TableCell>
                    <TableCell align="center"><strong>{t('kutc.records.table.edition')}</strong></TableCell>
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
          <Alert severity="info">{t('kutc.records.noLoopRecords')}</Alert>
        )}
      </Box>

      {/* Fastest Times Section */}
      <Box sx={{ mb: 6 }}>
        <Typography variant="h4" component="h2" gutterBottom fontWeight="bold" sx={{ mb: 3 }}>
          <Timer size={32} style={{ marginRight: 8, verticalAlign: 'middle' }} />
          {t('kutc.records.fastestRaceTimesTitle')}
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3, maxWidth: 720 }}>
          {t('kutc.records.fastestRaceTimesIntro')}
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
                    <TableCell><strong>{t('kutc.records.table.rank')}</strong></TableCell>
                    <TableCell><strong>{t('kutc.records.table.participant')}</strong></TableCell>
                    <TableCell align="center"><strong>{t('kutc.records.table.time')}</strong></TableCell>
                    <TableCell align="center"><strong>{t('kutc.records.table.edition')}</strong></TableCell>
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
          <Alert severity="info">{t('kutc.records.noRaceTimeRecords')}</Alert>
        )}
      </Box>

      {/* Most Appearances Section */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" component="h2" gutterBottom fontWeight="bold" sx={{ mb: 3 }}>
          <MapPin size={32} style={{ marginRight: 8, verticalAlign: 'middle' }} />
          {t('kutc.records.mostAppearancesTitle')}
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
                          {t('kutc.records.participatedIn', { editions: leader.editions.join(', ').replace(/kutc-/g, '') })}
                        </Typography>
                      </CardContent>
                    </Card>
                  </Grid>
                ))}
              </Grid>

              {runnerUpGroup.length > 0 && runnerUpAppearancesLabel && (
                <>
                  <Typography variant="h6" fontWeight="bold" sx={{ mt: 4 }}>
                    {t('kutc.records.runnersUp', { label: runnerUpAppearancesLabel })}
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
                              {t('kutc.records.participatedIn', { editions: leader.editions.join(', ').replace(/kutc-/g, '') })}
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
            <Alert severity="info">{t('kutc.records.noAppearanceRecords')}</Alert>
          )}
        </Paper>
      </Box>
    </Container>
  );
};

export default KUTCRecordsPage;
