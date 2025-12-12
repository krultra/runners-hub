import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Container,
  Box,
  Typography,
  Grid,
  Paper,
  Button,
  Chip,
  Divider,
  CircularProgress,
  Alert,
  Link as MuiLink
} from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { Trophy, BarChart3, Globe } from 'lucide-react';
import {
  Event,
  EventEdition,
  getEvent,
  getAdjacentEditions
} from '../services/eventEditionService';
import { getVerboseName } from '../services/codeListService';

const EVENT_ID = 'kutc';

const formatCurrency = (value?: number) => {
  if (value === undefined || value === null) return '—';
  return `${value.toLocaleString('no-NO')} NOK`;
};


const KUTCOverviewPage: React.FC = () => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();

  const formatDate = (timestamp: any): string => {
    if (!timestamp) return t('editions.tba');
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString(i18n.language === 'no' ? 'nb-NO' : 'en-US', { 
      weekday: 'long', 
      day: 'numeric', 
      month: 'long', 
      year: 'numeric' 
    });
  };
  const [event, setEvent] = useState<Event | null>(null);
  const [previousEdition, setPreviousEdition] = useState<EventEdition | null>(null);
  const [nextEdition, setNextEdition] = useState<EventEdition | null>(null);
  const [previousEditionStatus, setPreviousEditionStatus] = useState<string>('');
  const [nextEditionStatus, setNextEditionStatus] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        // Fetch main event info
        const eventData = await getEvent(EVENT_ID);
        setEvent(eventData);

        // Fetch adjacent editions dynamically based on time
        const { previous, next } = await getAdjacentEditions(EVENT_ID);
        
        if (previous) {
          setPreviousEdition(previous);
          const statusLabel = await getVerboseName('eventEditions', 'status', previous.status, previous.status);
          setPreviousEditionStatus(statusLabel);
        }
        
        if (next) {
          setNextEdition(next);
          const statusLabel = await getVerboseName('eventEditions', 'status', next.status, next.status);
          setNextEditionStatus(statusLabel);
        }
      } catch (err: any) {
        console.error('Failed to load KUTC info:', err);
        setError(err?.message || t('errors.loadFailed'));
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  if (loading) {
    return (
      <Container maxWidth="md" sx={{ py: 8 }}>
        <Box display="flex" justifyContent="center" alignItems="center" minHeight={320}>
          <CircularProgress />
        </Box>
      </Container>
    );
  }

  if (error) {
    return (
      <Container maxWidth="md" sx={{ py: 8 }}>
        <Alert severity="error">{error}</Alert>
        <Box mt={2}>
          <Button variant="contained" onClick={() => navigate('/')}>{t('errors.backToHome')}</Button>
        </Box>
      </Container>
    );
  }

  if (!event) {
    return (
      <Container maxWidth="md" sx={{ py: 8 }}>
        <Alert severity="warning">{t('errors.notFound')}</Alert>
      </Container>
    );
  }

  // Check if edition has a dedicated page via RH_URL field, or fallback to known route pattern
  const previousEditionHasPage = previousEdition ? Boolean(previousEdition.RH_URL) : false;
  const nextEditionHasPage = nextEdition ? Boolean(nextEdition.RH_URL) : false;
  const activeRaceDistances = (event.raceDistances ?? []).filter((race) => {
    const { active } = race as { active?: boolean };
    return active !== false;
  });

  return (
    <Container maxWidth="lg" sx={{ py: 6 }}>
      {/* Header */}
      <Box textAlign="center" mb={6}>
        <Typography variant="h2" component="h1" fontWeight={800} gutterBottom>
          {event.name || "Kruke's Ultra-Trail Challenge"}
        </Typography>
        <Typography variant="h6" color="text.secondary" sx={{ maxWidth: 640, mx: 'auto', mb: 3 }}>
          {t('kutc.tagline')}
        </Typography>
        
        {/* Quick Links */}
        <Box display="flex" justifyContent="center" gap={2} flexWrap="wrap" mb={2}>
          <Button
            variant="contained"
            startIcon={<Globe />}
            href="https://krultra.no/kutc"
          >
            {t('kutc.officialWebsite')}
          </Button>
          <Button
            variant="outlined"
            startIcon={<BarChart3 />}
            onClick={() => navigate('/kutc/results')}
          >
            {t('events.results')}
          </Button>
          <Button
            variant="outlined"
            startIcon={<BarChart3 />}
            onClick={() => navigate('/kutc/all-time')}
          >
            {t('kutc.allTimeLeaderboard')}
          </Button>
          <Button
            variant="outlined"
            startIcon={<Trophy />}
            onClick={() => navigate('/kutc/records')}
          >
            {t('events.records')}
          </Button>
        </Box>
      </Box>

      {/* Editions Info */}
      <Grid container spacing={3} sx={{ mb: 6 }}>
        {previousEdition && (
          <Grid item xs={12} md={6}>
            <Paper elevation={2} sx={{ p: 3 }}>
              <Typography variant="h5" fontWeight={700} gutterBottom>
                {t('editions.previousEdition')}
              </Typography>
              <Divider sx={{ mb: 2 }} />
              <Typography variant="body1" sx={{ mb: 1 }}>
                <strong>{t('editions.event')}:</strong> {previousEdition.eventName}
              </Typography>
              <Typography variant="body1" sx={{ mb: 1 }}>
                <strong>{t('editions.date')}:</strong> {formatDate(previousEdition.startTime)}
              </Typography>
              <Box sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                <Typography variant="body1" component="span">
                  <strong>{t('status.label')}:</strong>
                </Typography>
                <Chip label={previousEditionStatus} size="small" />
              </Box>
              {previousEditionHasPage ? (
                <Button
                  variant="outlined"
                  onClick={() => navigate(previousEdition.RH_URL!)}
                  fullWidth
                >
                  {t('editions.viewEditionDetails', { edition: previousEdition.edition })}
                </Button>
              ) : (
                <Button
                  variant="outlined"
                  disabled
                  fullWidth
                >
                  {t('editions.detailsComingSoon')}
                </Button>
              )}
            </Paper>
          </Grid>
        )}
        
        {nextEdition && (
          <Grid item xs={12} md={6}>
            <Paper elevation={2} sx={{ p: 3 }}>
              <Typography variant="h5" fontWeight={700} gutterBottom>
                {t('editions.nextEdition')}
              </Typography>
              <Divider sx={{ mb: 2 }} />
              <Typography variant="body1" sx={{ mb: 1 }}>
                <strong>{t('editions.event')}:</strong> {nextEdition.eventName}
              </Typography>
              <Typography variant="body1" sx={{ mb: 1 }}>
                <strong>{t('editions.date')}:</strong> {formatDate(nextEdition.startTime)}
              </Typography>
              <Box sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                <Typography variant="body1" component="span">
                  <strong>{t('status.label')}:</strong>
                </Typography>
                <Chip label={nextEditionStatus} size="small" color="primary" />
              </Box>
              {nextEditionHasPage ? (
                <Button
                  variant="contained"
                  onClick={() => navigate(nextEdition.RH_URL!)}
                  fullWidth
                >
                  {t('editions.viewEditionDetails', { edition: nextEdition.edition })}
                </Button>
              ) : (
                <Button
                  variant="contained"
                  disabled
                  fullWidth
                >
                  {t('editions.detailsComingSoon')}
                </Button>
              )}
            </Paper>
          </Grid>
        )}
      </Grid>

      {/* Event Info */}
      <Grid container spacing={3} sx={{ mb: 6 }}>
        {/* Race Distances */}
        {activeRaceDistances.length > 0 && (
          <Grid item xs={12} md={6}>
            <Paper elevation={2} sx={{ p: 3 }}>
              <Typography variant="h5" fontWeight={700} gutterBottom>
                {t('kutc.raceDistances')}
              </Typography>
              <Divider sx={{ mb: 2 }} />
              <Grid container spacing={2}>
                {activeRaceDistances.map((race) => (
                  <Grid item xs={6} key={race.id}>
                    <Paper variant="outlined" sx={{ p: 2 }}>
                      <Typography variant="subtitle2" fontWeight={700} color="primary">
                        {race.displayName}
                      </Typography>
                      <Typography variant="body2">
                        {(race.length / 1000).toFixed(1)} km
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {race.ascent}m+
                      </Typography>
                    </Paper>
                  </Grid>
                ))}
              </Grid>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 2, fontStyle: 'italic' }}>
                {t('kutc.lastOneStanding')}
              </Typography>
            </Paper>
          </Grid>
        )}
        
        {/* Fees & Participants */}
        <Grid item xs={12} md={6}>
          <Paper elevation={2} sx={{ p: 3 }}>
            <Typography variant="h5" fontWeight={700} gutterBottom>
              {t('kutc.generalInfo')}
            </Typography>
            <Divider sx={{ mb: 2 }} />
            
            {event.maxParticipants && (
              <Typography variant="body1" sx={{ mb: 2 }}>
                <strong>{t('events.maxParticipants')}:</strong> {event.maxParticipants}
              </Typography>
            )}
            
            {event.fees && (
              <Box>
                <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1 }}>
                  {t('kutc.registrationFees')}
                </Typography>
                <Typography variant="body2" sx={{ mb: 0.5 }}>
                  <strong>{t('kutc.participation')}:</strong> {formatCurrency(event.fees.participation)}
                </Typography>
                <Typography variant="body2" sx={{ mb: 0.5 }}>
                  <strong>{t('kutc.baseCamp')}:</strong> {formatCurrency(event.fees.baseCamp)}
                </Typography>
                <Typography variant="body2" sx={{ mb: 0.5 }}>
                  <strong>{t('kutc.depositRefundable')}:</strong> {formatCurrency(event.fees.deposit)}
                </Typography>
                <Typography variant="h6" sx={{ mt: 1 }}>
                  <strong>{t('kutc.total')}:</strong> {formatCurrency(event.fees.total)}
                </Typography>
              </Box>
            )}
          </Paper>
        </Grid>
      </Grid>

      {/* Footer Note */}
      <Box textAlign="center" sx={{ mt: 6 }}>
        <Typography variant="body2" color="text.secondary">
          {t('kutc.footerNote')}{' '}
          <MuiLink 
            href="https://krultra.no/kutc" 
            sx={{
              color: (theme) => theme.palette.mode === 'dark' ? '#69A9E1' : '#4E82B4',
              '&:hover': {
                color: (theme) => theme.palette.mode === 'dark' ? '#8BC2F0' : '#41719C',
              }
            }}
          >
            {t('kutc.officialKutcWebsite')}
          </MuiLink>
        </Typography>
      </Box>
    </Container>
  );
};


export default KUTCOverviewPage;
