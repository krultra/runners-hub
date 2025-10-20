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
import { EmojiEvents, MilitaryTech, Timer, PersonPin } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import {
  getMaxLoopsRecords,
  getFastestRaceTimes,
  getAppearanceLeaders,
  LoopRecord,
  FastestTimeRecord,
  AppearanceRecord
} from '../services/kutcResultsService';

const KUTCRecordsPage: React.FC = () => {
  const navigate = useNavigate();
  const [loopRecords, setLoopRecords] = useState<LoopRecord[]>([]);
  const [fastestTimes, setFastestTimes] = useState<Map<string, FastestTimeRecord[]>>(new Map());
  const [appearanceLeaders, setAppearanceLeaders] = useState<AppearanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchRecords = async () => {
      try {
        setLoading(true);
        const [loops, times, appearances] = await Promise.all([
          getMaxLoopsRecords(),
          getFastestRaceTimes(),
          getAppearanceLeaders()
        ]);
        
        setLoopRecords(loops);
        setFastestTimes(times);
        setAppearanceLeaders(appearances);
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

  return (
    <Container maxWidth="xl" sx={{ mt: 4, mb: 4 }}>
      {/* Header */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="h3" component="h1" gutterBottom fontWeight="bold">
          <EmojiEvents sx={{ fontSize: 40, mr: 1, verticalAlign: 'middle', color: 'primary.main' }} />
          KUTC Records
        </Typography>
        <Typography variant="h6" color="text.secondary">
          All-time records and achievements
        </Typography>
        <Button
          variant="outlined"
          onClick={() => navigate('/kutc/results')}
          sx={{ mt: 2 }}
        >
          Back to overview
        </Button>
      </Box>

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
          {appearanceLeaders.length > 0 ? (
            <>
              <Typography variant="h5" color="primary" gutterBottom>
                {appearanceLeaders[0].appearances} {appearanceLeaders[0].appearances === 1 ? 'Edition' : 'Editions'}
              </Typography>
              
              <Grid container spacing={2}>
                {appearanceLeaders.map((leader) => (
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
