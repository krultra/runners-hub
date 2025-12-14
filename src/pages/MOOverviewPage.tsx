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
  Stack
} from '@mui/material';
import { useNavigate } from 'react-router-dom';
import {
  Event,
  EventEdition,
  getEvent,
  getAdjacentEditions
} from '../services/eventEditionService';
import { getVerboseName } from '../services/codeListService';
import { Globe, PersonStanding, Facebook, Mountain, Trophy, BarChart3 } from 'lucide-react';
import { getKrultraUrl } from '../config/urls';
import { getEventLogoUrl } from '../services/strapiService';

const EVENT_ID = 'mo';



const MOOverviewPage: React.FC = () => {
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

  const COURSE_FACTS = [
    { titleKey: 'mo.classes', descKey: 'mo.classesDesc' },
    { titleKey: 'mo.since2011', descKey: 'mo.since2011Desc' }
  ];

  const REGISTRATION_INFO = [
    { titleKey: 'mo.registrationInfo', descKey: 'mo.registrationInfoDesc' },
    { titleKey: 'mo.competitionTimed', descKey: 'mo.competitionTimedDesc' },
    { titleKey: 'mo.hikingClass', descKey: 'mo.hikingClassDesc' }
  ];
  const [event, setEvent] = useState<Event | null>(null);
  const [previousEdition, setPreviousEdition] = useState<EventEdition | null>(null);
  const [nextEdition, setNextEdition] = useState<EventEdition | null>(null);
  const [previousEditionStatus, setPreviousEditionStatus] = useState<string>('');
  const [nextEditionStatus, setNextEditionStatus] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    const loadLogo = async () => {
      try {
        const url = await getEventLogoUrl(EVENT_ID);
        if (isMounted) setLogoUrl(url);
      } catch {
        if (isMounted) setLogoUrl(null);
      }
    };
    loadLogo();
    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const eventData = await getEvent(EVENT_ID);
        setEvent(eventData);

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
        console.error('Failed to load MO info:', err);
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

  // Dynamic check using RH_URL field from Firestore
  const previousEditionHasPage = previousEdition ? Boolean((previousEdition as any).RH_URL) : false;
  const nextEditionHasPage = nextEdition ? Boolean((nextEdition as any).RH_URL) : false;

  return (
    <Container maxWidth="lg" sx={{ py: 6 }}>
      <Box textAlign="center" mb={6}>
        <Box display="flex" justifyContent="center" alignItems="center" gap={1.5} flexWrap="wrap" mb={1}>
          {logoUrl && (
            <Box
              component="img"
              src={logoUrl}
              alt="MO logo"
              sx={{ width: 44, height: 44, borderRadius: 1, objectFit: 'cover' }}
            />
          )}
          <Typography variant="h2" component="h1" fontWeight={800} gutterBottom sx={{ mb: 0 }}>
            {event.name || 'Malvikingen Opp'}
          </Typography>
        </Box>
        <Typography variant="h6" color="text.secondary" sx={{ maxWidth: 640, mx: 'auto', mb: 3 }}>
          {t('mo.tagline')}
        </Typography>

        <Box display="flex" justifyContent="center" gap={2} flexWrap="wrap" mb={2}>
          <Button
            variant="contained"
            startIcon={<Globe />}
            href={getKrultraUrl('events/MO')}
          >
            {t('events.officialInfo')}
          </Button>
          <Button
            variant="outlined"
            startIcon={<BarChart3 />}
            onClick={() => navigate('/mo/results')}
          >
            {t('events.results')}
          </Button>
          <Button
            variant="outlined"
            startIcon={<BarChart3 />}
            onClick={() => navigate('/mo/all-time')}
          >
            {t('mo.allTimeLeaderboard')}
          </Button>
          <Button
            variant="outlined"
            startIcon={<Trophy />}
            onClick={() => navigate('/mo/records')}
          >
            {t('events.records')}
          </Button>
          <Button
            variant="outlined"
            startIcon={<Facebook />}
            href="https://www.facebook.com/groups/146973852042384/"
            target="_blank"
            rel="noopener noreferrer"
          >
            {t('mo.moOnFacebook')}
          </Button>
        </Box>
      </Box>

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
                  onClick={() => navigate((previousEdition as any).RH_URL)}
                  fullWidth
                >
                  {t('editions.seeEdition', { edition: previousEdition.edition })}
                </Button>
              ) : (
                <Button variant="outlined" disabled fullWidth>
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
                {t('editions.nextPlannedEdition')}
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
                  onClick={() => navigate((nextEdition as any).RH_URL)}
                  fullWidth
                >
                  {t('editions.goToEdition', { edition: nextEdition.edition })}
                </Button>
              ) : (
                <Button variant="contained" disabled fullWidth>
                  {t('editions.detailsComingSoon')}
                </Button>
              )}
            </Paper>
          </Grid>
        )}
      </Grid>

      <Grid container spacing={3} sx={{ mb: 6 }}>
        <Grid item xs={12} md={6}>
          <Paper elevation={2} sx={{ p: 3, height: '100%' }}>
            <Typography variant="h5" fontWeight={700} gutterBottom>
              {t('mo.courseFacts')}
            </Typography>
            <Divider sx={{ mb: 2 }} />
            <Stack spacing={2} alignItems="flex-start">
              {COURSE_FACTS.map((fact) => (
                <Box key={fact.titleKey} textAlign="left">
                  <Typography variant="subtitle1" fontWeight={700}>
                    {t(fact.titleKey)}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {t(fact.descKey)}
                  </Typography>
                </Box>
              ))}
            </Stack>
          </Paper>
        </Grid>
        <Grid item xs={12} md={6}>
          <Paper elevation={2} sx={{ p: 3, height: '100%' }}>
            <Typography variant="h5" fontWeight={700} gutterBottom>
              {t('mo.registrationInfo')}
            </Typography>
            <Divider sx={{ mb: 2 }} />
            <Stack spacing={2} alignItems="flex-start">
              {REGISTRATION_INFO.map((item) => (
                <Box key={item.titleKey} textAlign="left">
                  <Typography variant="subtitle1" fontWeight={700}>
                    {t(item.titleKey)}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {t(item.descKey)}
                  </Typography>
                </Box>
              ))}
            </Stack>
          </Paper>
        </Grid>
      </Grid>

      <Box textAlign="center" sx={{ mt: 6 }}>
        <Typography variant="body2" color="text.secondary">
          {t('common.questions')}{' '}
          <Box
            component="a"
            href="mailto:post@krultra.no"
            sx={{
              color: (theme) => theme.palette.mode === 'dark' ? '#69A9E1' : '#4E82B4',
              textDecoration: 'underline',
              '&:hover': {
                color: (theme) => theme.palette.mode === 'dark' ? '#8BC2F0' : '#41719C',
              }
            }}
          >
            post@krultra.no
          </Box>
        </Typography>
      </Box>
    </Container>
  );
};

export default MOOverviewPage;
