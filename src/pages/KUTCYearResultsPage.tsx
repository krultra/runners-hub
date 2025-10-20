import React, { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Container,
  Typography,
  Box,
  Card,
  CardContent,
  CardActionArea,
  Grid,
  CircularProgress,
  Alert,
  Chip,
  Button,
  Divider
} from '@mui/material';
import { ArrowBack, EmojiEvents, Groups, CheckCircle } from '@mui/icons-material';
import {
  getEditionMetadata,
  getTotalCompetitionResults,
  getRaceDistanceResults,
  KUTCEditionMetadata,
  KUTCResultEntry,
  KUTCRaceInfo
} from '../services/kutcResultsService';
import { getEventEdition, EventEdition } from '../services/eventEditionService';
import KUTCResultsTable from '../components/KUTCResultsTable';

const KUTCYearResultsPage: React.FC = () => {
  const { year } = useParams<{ year: string }>();
  const navigate = useNavigate();

  const [metadata, setMetadata] = useState<KUTCEditionMetadata | null>(null);
  const [totalResults, setTotalResults] = useState<KUTCResultEntry[]>([]);
  const [selectedRace, setSelectedRace] = useState<string | null>(null);
  const [raceResults, setRaceResults] = useState<KUTCResultEntry[]>([]);
  const [eventDetails, setEventDetails] = useState<EventEdition | null>(null);
  
  const [loading, setLoading] = useState(true);
  const [loadingRace, setLoadingRace] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const eventTitle = useMemo(() => {
    if (!metadata) return '';
    const baseName = (eventDetails?.eventName || '').trim() || (eventDetails?.eventShortName || '').trim() || 'KUTC';
    return `${baseName} ${metadata.year}`.trim();
  }, [metadata, eventDetails]);

  // Fetch metadata and total results
  useEffect(() => {
    const fetchData = async () => {
      if (!year) return;

      try {
        setLoading(true);
        
        // Fetch metadata
        const meta = await getEditionMetadata(year);
        if (!meta) {
          setError(`No results found for KUTC ${year}`);
          return;
        }
        setMetadata(meta);

        // Fetch event edition details for proper naming
        try {
          const edition = await getEventEdition(year);
          setEventDetails(edition);
        } catch (detailsError) {
          console.warn('Unable to fetch event edition details for', year, detailsError);
        }

        // Fetch total competition results
        const total = await getTotalCompetitionResults(year);
        setTotalResults(total);

      } catch (err) {
        console.error('Error fetching KUTC results:', err);
        setError('Failed to load results');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [year]);

  // Fetch race-specific results when a race is selected
  const handleRaceClick = async (distanceKey: string) => {
    if (!year) return;

    try {
      setLoadingRace(true);
      setSelectedRace(distanceKey);
      
      const results = await getRaceDistanceResults(year, distanceKey);
      setRaceResults(results);
    } catch (err) {
      console.error('Error fetching race results:', err);
      setError('Failed to load race results');
    } finally {
      setLoadingRace(false);
    }
  };

  // Show total competition
  const handleShowTotal = () => {
    setSelectedRace('total');
  };

  if (loading) {
    return (
      <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
        <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
          <CircularProgress />
        </Box>
      </Container>
    );
  }

  if (error || !metadata) {
    return (
      <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
        <Button
          startIcon={<ArrowBack />}
          onClick={() => navigate('/kutc/results')}
          sx={{ mb: 2 }}
        >
          Back to Overview
        </Button>
        <Alert severity="error">{error || 'No results found'}</Alert>
      </Container>
    );
  }

  // Get race info for display
  const distanceRaces = metadata.races.filter(r => r.distanceKey !== 'total');
  const totalRace = metadata.races.find(r => r.distanceKey === 'total');

  return (
    <Container maxWidth="xl" sx={{ mt: 4, mb: 4 }}>
      {/* Header */}
      <Button
        startIcon={<ArrowBack />}
        onClick={() => navigate('/kutc/results')}
        sx={{ mb: 2 }}
      >
        Back to Overview
      </Button>

      <Box sx={{ mb: 4 }}>
        <Typography variant="h3" component="h1" gutterBottom fontWeight="bold">
          <EmojiEvents sx={{ fontSize: 40, mr: 1, verticalAlign: 'middle', color: 'primary.main' }} />
          {eventTitle || `KUTC ${metadata.year}`}
        </Typography>
        <Box display="flex" alignItems="center" gap={2} flexWrap="wrap">
          <Chip
            label={metadata.resultsStatus.toUpperCase()}
            color={
              metadata.resultsStatus === 'final' ? 'success' :
              metadata.resultsStatus === 'preliminary' ? 'warning' : 'default'
            }
          />
          <Typography variant="body1" color="text.secondary">
            {metadata.totalParticipants} participants • {metadata.totalFinishers} finishers
          </Typography>
        </Box>
      </Box>

      {/* If no race selected, show distance cards */}
      {!selectedRace && (
        <>
          {/* Total Competition Card */}
          {totalRace && (
            <Box sx={{ mb: 4 }}>
              <Typography variant="h5" gutterBottom fontWeight="bold">
                Overall Competition
              </Typography>
              <Card 
                elevation={4}
                sx={{
                  backgroundColor: 'primary.main',
                  color: 'primary.contrastText',
                  transition: 'transform 0.2s',
                  '&:hover': {
                    transform: 'translateY(-2px)',
                  }
                }}
              >
                <CardActionArea onClick={handleShowTotal}>
                  <CardContent>
                    <Box display="flex" justifyContent="space-between" alignItems="center">
                      <Box>
                        <Typography variant="h4" fontWeight="bold">
                          Total Competition
                        </Typography>
                        <Typography variant="body1" sx={{ mt: 1 }}>
                          Last One Standing - All Participants
                        </Typography>
                      </Box>
                      <Box textAlign="right">
                        <Typography variant="h6">
                          <Groups sx={{ verticalAlign: 'middle', mr: 0.5 }} />
                          {totalRace.participants} runners
                        </Typography>
                        <Typography variant="body2">
                          <CheckCircle sx={{ verticalAlign: 'middle', mr: 0.5, fontSize: 16 }} />
                          {totalRace.finishers} with valid results
                        </Typography>
                      </Box>
                    </Box>
                  </CardContent>
                </CardActionArea>
              </Card>
            </Box>
          )}

          {/* Distance Cards */}
          <Typography variant="h5" gutterBottom fontWeight="bold" sx={{ mt: 4 }}>
            Race Distances
          </Typography>
          <Grid container spacing={3}>
            {distanceRaces.map((race) => (
              <Grid item xs={12} sm={6} md={4} key={race.distanceKey}>
                <Card 
                  elevation={3}
                  sx={{
                    height: '100%',
                    transition: 'transform 0.2s, box-shadow 0.2s',
                    '&:hover': {
                      transform: 'translateY(-4px)',
                      boxShadow: 6
                    }
                  }}
                >
                  <CardActionArea 
                    onClick={() => handleRaceClick(race.distanceKey)}
                    sx={{ height: '100%' }}
                  >
                    <CardContent>
                      <Typography variant="h5" fontWeight="bold" color="primary" gutterBottom>
                        {race.raceName}
                      </Typography>
                      
                      <Divider sx={{ my: 2 }} />
                      
                      <Box>
                        <Typography variant="body1" color="text.secondary">
                          <Groups sx={{ verticalAlign: 'middle', mr: 0.5 }} />
                          {race.participants} participants
                        </Typography>
                        <Typography variant="body1" color="text.secondary">
                          <CheckCircle sx={{ verticalAlign: 'middle', mr: 0.5 }} />
                          {race.finishers} finishers
                        </Typography>
                      </Box>
                    </CardContent>
                  </CardActionArea>
                </Card>
              </Grid>
            ))}
          </Grid>
        </>
      )}

      {/* If race selected, show results table */}
      {selectedRace && (
        <Box>
          <Button
            variant="outlined"
            onClick={() => setSelectedRace(null)}
            sx={{ mb: 3 }}
          >
            ← Back to Distances
          </Button>

          {loadingRace ? (
            <Box display="flex" justifyContent="center" py={4}>
              <CircularProgress />
            </Box>
          ) : (
            <>
              {selectedRace === 'total' ? (
                <KUTCResultsTable
                  results={totalResults}
                  title="Total Competition - Last One Standing"
                  subtitle="Ranked by loops completed (descending), then total time (ascending)"
                  type="total"
                />
              ) : (
                <KUTCResultsTable
                  results={raceResults}
                  title={distanceRaces.find(r => r.distanceKey === selectedRace)?.raceName || 'Race Results'}
                  subtitle="Ranked by finish time for registered distance"
                  type="race"
                />
              )}
            </>
          )}
        </Box>
      )}
    </Container>
  );
};

export default KUTCYearResultsPage;
