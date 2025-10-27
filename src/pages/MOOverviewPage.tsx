import React, { useEffect, useState } from 'react';
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
import { Language, DirectionsRun, Facebook, Hiking, EmojiEvents, Leaderboard, Assessment } from '@mui/icons-material';

const EVENT_ID = 'mo';
const AVAILABLE_EDITION_ROUTES = new Set<string>(['mo-2025']);

const formatDate = (timestamp: any): string => {
  if (!timestamp) return 'TBA';
  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  return date.toLocaleDateString('nb-NO', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });
};

const COURSE_FACTS: { title: string; description: string }[] = [
  {
    title: 'Løype',
    description: '6 km fra fjorden på Vikhammerløkka til toppen av Solemsvåttan.'
  },
  {
    title: 'Høydemeter',
    description: 'Løypa starter ca. 3 meter over havnivå og har målgang på 423 moh. Med unntak av en liten nedoverbakke etter drøyt 2 km. er det motbakke så og si hele løypa.'
  },
  {
    title: 'Klasser',
    description: 'Løpet har konkurranseklasser med dame- og herre-klasse, men det som gjør løpet unikt er hovedklassen for alle-mot-alle hvor tiden justeres for alder og kjønn. I tillegg er det mulig å delta i klassen for trim med tidtaking, og i en familievennlig turklasse.'
  },
  {
    title: 'Siden 2011',
    description: 'Malvikingen Opp er Malviks eldste motbakkeløp og arrangeres av KrUltra på vegne av Malvik IL Friidrett. Løpet har blitt arrangert hvert år siden 2011'
  }
];

const REGISTRATION_INFO: { title: string; description: string }[] = [
  {
    title: 'Påmelding',
    description: 'Lenker til påmelding og informasjon om påmeldingsfrister publiseres i den aktuelle utgaven – følg lenken til neste løp for detaljer.'
  },
  {
    title: 'Konkurranse & trim med tidtaking',
    description: 'Deltakelse koster 250,- kroner. Engangslisens kommer i tillegg for løpere uten årslisens.'
  },
  {
    title: 'Turklasse',
    description: 'Deltakelse koster 50,- kroner.'
  }
];

const MOOverviewPage: React.FC = () => {
  const navigate = useNavigate();
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
        setError(err?.message || 'Klarte ikke å laste informasjon om Malvikingen Opp.');
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
          <Button variant="contained" onClick={() => navigate('/')}>Til forsiden</Button>
        </Box>
      </Container>
    );
  }

  if (!event) {
    return (
      <Container maxWidth="md" sx={{ py: 8 }}>
        <Alert severity="warning">Fant ingen informasjon om Malvikingen Opp. Prøv igjen senere.</Alert>
      </Container>
    );
  }

  const previousEditionHasPage = previousEdition ? AVAILABLE_EDITION_ROUTES.has(previousEdition.id) : false;
  const nextEditionHasPage = nextEdition ? AVAILABLE_EDITION_ROUTES.has(nextEdition.id) : false;

  return (
    <Container maxWidth="lg" sx={{ py: 6 }}>
      <Box textAlign="center" mb={6}>
        <Typography variant="h2" component="h1" fontWeight={800} gutterBottom>
          {event.name || 'Malvikingen Opp'}
        </Typography>
        <Typography variant="h6" color="text.secondary" sx={{ maxWidth: 640, mx: 'auto', mb: 3 }}>
          Malviks eldste motbakkeløp – fra Fjorden til Våttan siden 2011.
        </Typography>

        <Box display="flex" justifyContent="center" gap={2} flexWrap="wrap" mb={2}>
          <Button
            variant="contained"
            startIcon={<Language />}
            href="https://krultra.no/nb/node/23"
            target="_blank"
            rel="noopener noreferrer"
          >
            Offisiell informasjon
          </Button>
          <Button
            variant="outlined"
            startIcon={<Assessment />}
            onClick={() => navigate('/mo/results')}
          >
            Resultater
          </Button>
          <Button
            variant="outlined"
            startIcon={<Leaderboard />}
            onClick={() => navigate('/mo/all-time')}
          >
            Adelskalender
          </Button>
          <Button
            variant="outlined"
            startIcon={<EmojiEvents />}
            onClick={() => navigate('/mo/records')}
          >
            Rekorder
          </Button>
          <Button
            variant="outlined"
            startIcon={<Facebook />}
            href="https://www.facebook.com/groups/146973852042384/"
            target="_blank"
            rel="noopener noreferrer"
          >
            MO på Facebook
          </Button>
        </Box>
      </Box>

      <Grid container spacing={3} sx={{ mb: 6 }}>
        {previousEdition && (
          <Grid item xs={12} md={6}>
            <Paper elevation={2} sx={{ p: 3 }}>
              <Typography variant="h5" fontWeight={700} gutterBottom>
                Forrige utgave
              </Typography>
              <Divider sx={{ mb: 2 }} />
              <Typography variant="body1" sx={{ mb: 1 }}>
                <strong>Event:</strong> {previousEdition.eventName}
              </Typography>
              <Typography variant="body1" sx={{ mb: 1 }}>
                <strong>Dato:</strong> {formatDate(previousEdition.startTime)}
              </Typography>
              <Box sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                <Typography variant="body1" component="span">
                  <strong>Status:</strong>
                </Typography>
                <Chip label={previousEditionStatus} size="small" />
              </Box>
              {previousEditionHasPage ? (
                <Button
                  variant="outlined"
                  onClick={() => navigate(`/${previousEdition.id}`)}
                  fullWidth
                >
                  Se {previousEdition.edition}-utgaven
                </Button>
              ) : (
                <Button variant="outlined" disabled fullWidth>
                  Detaljer kommer
                </Button>
              )}
            </Paper>
          </Grid>
        )}

        {nextEdition && (
          <Grid item xs={12} md={6}>
            <Paper elevation={2} sx={{ p: 3 }}>
              <Typography variant="h5" fontWeight={700} gutterBottom>
                Neste planlagte utgave
              </Typography>
              <Divider sx={{ mb: 2 }} />
              <Typography variant="body1" sx={{ mb: 1 }}>
                <strong>Event:</strong> {nextEdition.eventName}
              </Typography>
              <Typography variant="body1" sx={{ mb: 1 }}>
                <strong>Dato:</strong> {formatDate(nextEdition.startTime)}
              </Typography>
              <Box sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                <Typography variant="body1" component="span">
                  <strong>Status:</strong>
                </Typography>
                <Chip label={nextEditionStatus} size="small" color="primary" />
              </Box>
              {nextEditionHasPage ? (
                <Button
                  variant="contained"
                  onClick={() => navigate(`/${nextEdition.id}`)}
                  fullWidth
                >
                  Gå til {nextEdition.edition}-utgaven
                </Button>
              ) : (
                <Button variant="contained" disabled fullWidth>
                  Detaljer kommer
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
              Fakta om løpet
            </Typography>
            <Divider sx={{ mb: 2 }} />
            <Stack spacing={2} alignItems="flex-start">
              {COURSE_FACTS.map((fact) => (
                <Box key={fact.title} textAlign="left">
                  <Typography variant="subtitle1" fontWeight={700}>
                    {fact.title}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {fact.description}
                  </Typography>
                </Box>
              ))}
            </Stack>
          </Paper>
        </Grid>
        <Grid item xs={12} md={6}>
          <Paper elevation={2} sx={{ p: 3, height: '100%' }}>
            <Typography variant="h5" fontWeight={700} gutterBottom>
              Påmelding
            </Typography>
            <Divider sx={{ mb: 2 }} />
            <Stack spacing={2} alignItems="flex-start">
              {REGISTRATION_INFO.map((item) => (
                <Box key={item.title} textAlign="left">
                  <Typography variant="subtitle1" fontWeight={700}>
                    {item.title}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {item.description}
                  </Typography>
                </Box>
              ))}
            </Stack>
          </Paper>
        </Grid>
      </Grid>

      <Box textAlign="center" sx={{ mt: 6 }}>
        <Typography variant="body2" color="text.secondary">
          Spørsmål? Send en e-post til <a href="mailto:post@krultra.no">post@krultra.no</a>.
        </Typography>
      </Box>
    </Container>
  );
};

export default MOOverviewPage;
