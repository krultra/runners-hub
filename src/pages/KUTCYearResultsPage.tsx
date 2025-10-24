import React, { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
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
  listKUTCEditions,
  KUTCEdition,
  KUTCEditionMetadata,
  KUTCResultEntry,
  KUTCRaceInfo
} from '../services/kutcResultsService';
import { getEventEdition, EventEdition } from '../services/eventEditionService';
import KUTCResultsTable from '../components/KUTCResultsTable';

type EditionResult = KUTCResultEntry & { editionId: string };

const KUTCYearResultsPage: React.FC = () => {
  const { year } = useParams<{ year: string }>();
  const navigate = useNavigate();
  const location = useLocation();

  const [metadata, setMetadata] = useState<KUTCEditionMetadata | null>(null);
  const [totalResults, setTotalResults] = useState<EditionResult[]>([]);
  const [selectedRace, setSelectedRace] = useState<string | null>(null);
  const [raceResults, setRaceResults] = useState<EditionResult[]>([]);
  const [eventDetails, setEventDetails] = useState<EventEdition | null>(null);
  const [sortedEditions, setSortedEditions] = useState<KUTCEdition[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingRace, setLoadingRace] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const eventTitle = useMemo(() => {
    if (!metadata) return '';
    const baseName = (eventDetails?.eventName || '').trim() || (eventDetails?.eventShortName || '').trim() || 'KUTC';
    return `${baseName} ${metadata.year}`.trim();
  }, [metadata, eventDetails]);

  const hasDataIntegrityIssue = useMemo(() => {
    if (!metadata) return false;
    if (metadata.resultsStatus === 'error') return true;
    return eventDetails?.resultsStatus === 'error';
  }, [metadata, eventDetails?.resultsStatus]);

  // Fetch metadata and total results
  useEffect(() => {
    const fetchData = async () => {
      if (!year) return;

      try {
        setLoading(true);

        // Fetch available editions once per mount/change
        const editions = await listKUTCEditions();
        const filtered = editions
          .filter((edition): edition is KUTCEdition => Boolean(edition && typeof edition.id === 'string'))
          .sort((a, b) => {
            const yearA = Number.isFinite(a.year) ? a.year : Number.MAX_SAFE_INTEGER;
            const yearB = Number.isFinite(b.year) ? b.year : Number.MAX_SAFE_INTEGER;
            if (yearA === yearB) {
              return a.id.localeCompare(b.id);
            }
            return yearA - yearB;
          });
        setSortedEditions(filtered);

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
        setTotalResults(total.map((entry) => ({ ...entry, editionId: year })));

      } catch (err) {
        console.error('Error fetching KUTC results:', err);
        setError('Failed to load results');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [year]);

  const { previousEdition, nextEdition } = useMemo(() => {
    if (!year || sortedEditions.length === 0) {
      return { previousEdition: null, nextEdition: null };
    }
    const index = sortedEditions.findIndex((edition) => edition.id === year);
    if (index === -1) {
      return { previousEdition: null, nextEdition: null };
    }
    const previous = index > 0 ? sortedEditions[index - 1] : null;
    const next = index < sortedEditions.length - 1 ? sortedEditions[index + 1] : null;
    return { previousEdition: previous, nextEdition: next };
  }, [year, sortedEditions]);

  // Fetch race-specific results when a race is selected
  const handleRaceClick = (distanceKey: string) => {
    if (!year) return;
    navigate(`/kutc/results/${year}?distance=${encodeURIComponent(distanceKey)}`);
  };

  // Show total competition
  const handleShowTotal = () => {
    if (!year) return;
    navigate(`/kutc/results/${year}?distance=total`);
  };

  useEffect(() => {
    if (!year || !metadata) {
      return;
    }

    const params = new URLSearchParams(location.search);
    const distanceParam = params.get('distance');

    if (!distanceParam) {
      setSelectedRace(null);
      setRaceResults([]);
      setLoadingRace(false);
      return;
    }

    if (distanceParam === 'total') {
      setSelectedRace('total');
      setRaceResults([]);
      setLoadingRace(false);
      return;
    }

    const raceExists = metadata.races.some((race) => race.distanceKey === distanceParam);
    if (!raceExists) {
      console.warn(`Unknown distance "${distanceParam}" for edition ${year}`);
      setSelectedRace(null);
      setRaceResults([]);
      setLoadingRace(false);
      return;
    }

    let isMounted = true;
    const fetchRaceResults = async () => {
      try {
        setSelectedRace(distanceParam);
        setLoadingRace(true);
        const results = await getRaceDistanceResults(year, distanceParam);
        if (!isMounted) {
          return;
        }
        setRaceResults(results.map((entry) => ({ ...entry, editionId: year })));
        setLoadingRace(false);
      } catch (err) {
        console.error('Error fetching race results:', err);
        if (!isMounted) {
          return;
        }
        setLoadingRace(false);
        setError('Failed to load race results');
      }
    };

    fetchRaceResults();

    return () => {
      isMounted = false;
    };
  }, [year, metadata, location.search]);

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
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, alignItems: 'center', mb: 2 }}>
        <Button
          startIcon={<ArrowBack />}
          onClick={() => navigate('/kutc/results')}
        >
          Back to Overview
        </Button>
        <Box sx={{ flex: '1 1 auto' }} />
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button
            variant="outlined"
            disabled={!previousEdition}
            onClick={() => previousEdition && navigate(`/kutc/results/${previousEdition.id}`)}
          >
            ← {previousEdition ? `KUTC ${previousEdition.year || previousEdition.id}` : 'No earlier edition'}
          </Button>
          <Button
            variant="outlined"
            disabled={!nextEdition}
            onClick={() => nextEdition && navigate(`/kutc/results/${nextEdition.id}`)}
          >
            {nextEdition ? `KUTC ${nextEdition.year || nextEdition.id}` : 'No later edition'} →
          </Button>
        </Box>
      </Box>

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
              metadata.resultsStatus === 'preliminary' ? 'warning' :
              metadata.resultsStatus === 'error' ? 'error' : 'default'
            }
          />
          <Typography variant="body1" color="text.secondary">
            {metadata.totalParticipants} participants • {metadata.totalFinishers} finishers
          </Typography>
        </Box>
        {hasDataIntegrityIssue && (
          <Alert severity="warning" sx={{ mt: 2 }}>
            We have some errors in the data for this edition. We are working to correct them as soon as possible.
          </Alert>
        )}
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
