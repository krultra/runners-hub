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
import { ArrowLeft, Trophy, Users, CheckCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import {
  getEditionMetadata,
  getTotalCompetitionResults,
  getRaceDistanceResults,
  listKUTCEditions,
  KUTCEdition,
  KUTCEditionMetadata,
  KUTCResultEntry,
} from '../services/kutcResultsService';
import { getEventEdition, EventEdition } from '../services/eventEditionService';
import KUTCResultsTable from '../components/KUTCResultsTable';

type EditionResult = KUTCResultEntry & { editionId: string };

const KUTCYearResultsPage: React.FC = () => {
  const { t } = useTranslation();
  const { year: routeYear, editionId: routeEditionId } = useParams<{ year?: string; editionId?: string }>();
  const editionId = (() => {
    const raw = (routeEditionId ?? routeYear ?? '').toString();
    if (!raw) return '';
    return raw.startsWith('kutc-') ? raw : `kutc-${raw}`;
  })();
  const year = editionId.startsWith('kutc-') ? editionId.slice(5) : editionId;
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
        const meta = await getEditionMetadata(editionId);
        if (!meta) {
          setError(t('kutc.yearResults.noResultsForYear', { year }));
          return;
        }
        setMetadata(meta);

        // Fetch event edition details for proper naming
        try {
          const edition = await getEventEdition(editionId);
          setEventDetails(edition);
        } catch (detailsError) {
          console.warn('Unable to fetch event edition details for', year, detailsError);
        }

        // Fetch total competition results
        const total = await getTotalCompetitionResults(editionId);
        setTotalResults(total.map((entry) => ({ ...entry, editionId })));

      } catch (err) {
        console.error('Error fetching KUTC results:', err);
        setError(t('kutc.yearResults.loadFailed'));
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [editionId, t, year]);

  const { previousEdition, nextEdition } = useMemo(() => {
    if (!year || sortedEditions.length === 0) {
      return { previousEdition: null, nextEdition: null };
    }
    const index = sortedEditions.findIndex((edition) => edition.id === editionId);
    if (index === -1) {
      return { previousEdition: null, nextEdition: null };
    }
    const previous = index > 0 ? sortedEditions[index - 1] : null;
    const next = index < sortedEditions.length - 1 ? sortedEditions[index + 1] : null;
    return { previousEdition: previous, nextEdition: next };
  }, [editionId, year, sortedEditions]);

  // Fetch race-specific results when a race is selected
  const handleRaceClick = (distanceKey: string) => {
    if (!editionId) return;
    navigate(`/kutc/results/${editionId}?distance=${encodeURIComponent(distanceKey)}`);
  };

  // Show total competition
  const handleShowTotal = () => {
    if (!editionId) return;
    navigate(`/kutc/results/${editionId}?distance=total`);
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
        setError(t('kutc.yearResults.loadRaceFailed'));
      }
    };

    fetchRaceResults();

    return () => {
      isMounted = false;
    };
  }, [editionId, metadata, location.search, t, year]);

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
          startIcon={<ArrowLeft />}
          onClick={() => navigate('/kutc/results')}
          sx={{ mb: 2 }}
        >
          {t('kutc.backToOverview')}
        </Button>
        <Alert severity="error">{error || t('kutc.yearResults.noResultsFound')}</Alert>
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
          startIcon={<ArrowLeft />}
          onClick={() => navigate('/kutc/results')}
        >
          {t('kutc.backToOverview')}
        </Button>
        <Box sx={{ flex: '1 1 auto' }} />
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button
            variant="outlined"
            disabled={!previousEdition}
            onClick={() => previousEdition && navigate(`/kutc/results/${previousEdition.id}`)}
          >
            ← {previousEdition ? `KUTC ${previousEdition.year || previousEdition.id}` : t('kutc.yearResults.noEarlierEdition')}
          </Button>
          <Button
            variant="outlined"
            disabled={!nextEdition}
            onClick={() => nextEdition && navigate(`/kutc/results/${nextEdition.id}`)}
          >
            {nextEdition ? `KUTC ${nextEdition.year || nextEdition.id}` : t('kutc.yearResults.noLaterEdition')} →
          </Button>
        </Box>
      </Box>

      <Box sx={{ mb: 4 }}>
        <Typography variant="h3" component="h1" gutterBottom fontWeight="bold">
          <Trophy size={40} style={{ marginRight: 8, verticalAlign: 'middle' }} />
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
            {t('kutc.yearResults.participantsFinishers', {
              participants: metadata.totalParticipants,
              finishers: metadata.totalFinishers
            })}
          </Typography>
        </Box>
        {hasDataIntegrityIssue && (
          <Alert severity="warning" sx={{ mt: 2 }}>
            {t('kutc.dataIntegrityWarning')}
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
                {t('kutc.yearResults.overallCompetition')}
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
                          {t('kutc.yearResults.totalCompetition')}
                        </Typography>
                        <Typography variant="body1" sx={{ mt: 1 }}>
                          {t('kutc.yearResults.lastOneStandingAllParticipants')}
                        </Typography>
                      </Box>
                      <Box textAlign="right">
                        <Typography variant="h6">
                          <Users size={18} style={{ verticalAlign: 'middle', marginRight: 4 }} />
                          {t('kutc.yearResults.runnersCount', { count: totalRace.participants })}
                        </Typography>
                        <Typography variant="body2">
                          <CheckCircle size={16} style={{ verticalAlign: 'middle', marginRight: 4 }} />
                          {t('kutc.yearResults.withValidResults', { count: totalRace.finishers })}
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
            {t('kutc.yearResults.raceDistances')}
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
                          <Users size={18} style={{ verticalAlign: 'middle', marginRight: 4 }} />
                          {t('common.participantsCount', { count: race.participants })}
                        </Typography>
                        <Typography variant="body1" color="text.secondary">
                          <CheckCircle size={18} style={{ verticalAlign: 'middle', marginRight: 4 }} />
                          {t('kutc.yearResults.finishersCount', { count: race.finishers })}
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
            ← {t('kutc.yearResults.backToDistances')}
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
                  title={t('kutc.yearResults.totalCompetitionTitle')}
                  subtitle={t('kutc.yearResults.totalCompetitionSubtitle')}
                  type="total"
                />
              ) : (
                <KUTCResultsTable
                  results={raceResults}
                  title={distanceRaces.find(r => r.distanceKey === selectedRace)?.raceName || t('kutc.yearResults.raceResultsTitleFallback')}
                  subtitle={t('kutc.yearResults.raceResultsSubtitle')}
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
