import React, { useEffect, useMemo, useState } from 'react';
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
  Alert
} from '@mui/material';
import { useNavigate } from 'react-router-dom';
import {
  EventEdition,
  RaceDistance,
  getEventEdition
} from '../services/eventEditionService';

const KUTC_EDITION_ID = 'kutc-2025';

const toDate = (value: any): Date | null => {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value.toDate === 'function') return value.toDate();
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const formatCurrency = (value?: number) => {
  if (value === undefined || value === null) return '—';
  return `${value.toLocaleString('no-NO')} NOK`;
};

const ensureRaceDistances = (distances?: RaceDistance[]): RaceDistance[] => {
  if (distances && distances.length > 0) {
    return distances;
  }

  return [
    { id: 'kUTC-4', displayName: '4 loops', length: 26.8, ascent: 1476, descent: 1476 },
    { id: 'kUTC-8', displayName: '8 loops', length: 53.6, ascent: 2952, descent: 2952 },
    { id: 'kUTC-12', displayName: '12 loops', length: 80.4, ascent: 4428, descent: 4428 },
    { id: 'kUTC-16', displayName: '16 loops', length: 107.2, ascent: 5904, descent: 5904 },
    { id: 'kUTC-20', displayName: '20 loops', length: 134.0, ascent: 7380, descent: 7380 },
    { id: 'kUTC-24', displayName: '24 loops', length: 160.9, ascent: 8856, descent: 8856 }
  ];
};

const KUTCOverviewPage: React.FC = () => {
  const navigate = useNavigate();
  const [event, setEvent] = useState<EventEdition | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const edition = await getEventEdition(KUTC_EDITION_ID);
        setEvent(edition);
      } catch (err: any) {
        console.error('Failed to load KUTC overview:', err);
        setError(err?.message || 'Kunne ikke hente KUTC-informasjon.');
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  const startDate = useMemo(() => toDate(event?.startTime), [event?.startTime]);
  const registrationDeadline = useMemo(() => toDate(event?.registrationDeadline), [event?.registrationDeadline]);
  const raceDistances = useMemo(() => ensureRaceDistances(event?.raceDistances), [event?.raceDistances]);

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
        <Alert severity="warning">Fant ikke informasjon om KUTC akkurat nå. Prøv igjen senere.</Alert>
      </Container>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ py: 6 }}>
      <Box textAlign="center" mb={6}>
        <Typography variant="h2" component="h1" fontWeight={800} gutterBottom>
          {event.eventName || "Kruke's Ultra-Trail Challenge"}
        </Typography>
        <Typography variant="h6" color="text.secondary" sx={{ maxWidth: 720, mx: 'auto' }}>
          KUTC er en Last One Standing-utfordring gjennom skogene ved Solemsvåttan. Utforsk distansene, avgifter og historikken fra arrangementet.
        </Typography>
        <StackedActions navigate={navigate} />
        <Box mt={2}>
          <Chip label="Last One Standing" color="primary" sx={{ fontWeight: 600, mr: 1 }} />
          <Chip label="Backyard Ultra" variant="outlined" sx={{ fontWeight: 600 }} />
        </Box>
      </Box>

      <Grid container spacing={4} alignItems="stretch">
        <Grid item xs={12} md={5}>
          <Paper elevation={3} sx={{ p: 3, borderRadius: 3, height: '100%', display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Typography variant="h5" fontWeight={700}>Neste utgave</Typography>
            <Divider />
            <Typography variant="body1">
              <strong>Dato:</strong>{' '}
              {startDate ? startDate.toLocaleDateString('no-NO', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) : 'TBA'}
            </Typography>
            <Typography variant="body1">
              <strong>Start:</strong>{' '}
              {startDate ? startDate.toLocaleTimeString('no-NO', { hour: '2-digit', minute: '2-digit' }) : 'TBA'}
            </Typography>
            <Typography variant="body1">
              <strong>Sted:</strong> Lysløypa ved Solemsvåttan, Trondheim
            </Typography>
            {registrationDeadline && (
              <Typography variant="body1">
                <strong>Påmeldingsfrist:</strong>{' '}
                {registrationDeadline.toLocaleDateString('no-NO', { day: 'numeric', month: 'long', year: 'numeric' })}
              </Typography>
            )}
            {event.maxParticipants && (
              <Typography variant="body1">
                <strong>Antall plasser:</strong> {event.maxParticipants}
              </Typography>
            )}
          </Paper>
        </Grid>
        <Grid item xs={12} md={7}>
          <Paper elevation={3} sx={{ p: 3, borderRadius: 3, height: '100%', display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Typography variant="h5" fontWeight={700}>Startpakke og fasiliteter</Typography>
            <Divider />
            <Typography variant="body1">
              • Fullt bemannet basecamp med varme fasiliteter, matservering og Crew-støtte.
            </Typography>
            <Typography variant="body1">
              • Oppmerkede løyper (4,47 km) med kontrollposter, varme drikker og energi mellom rundene.
            </Typography>
            <Typography variant="body1">
              • Eget restitusjonsområde, garderober og tilgang til trackingsystem for familie og support.
            </Typography>
            <Typography variant="body1">
              • Premiering til last one standing, loop-rekorder og årlige klassevinnere.
            </Typography>
          </Paper>
        </Grid>
      </Grid>

      <Box mt={6}>
        <Typography variant="h4" component="h2" fontWeight={700} gutterBottom>
          Distanser og format
        </Typography>
        <Typography variant="body1" color="text.secondary" sx={{ maxWidth: 720, mb: 3 }}>
          Alle deltakerne starter samtidig. Hver loop er 4,47 km med 369 høydemeter. Du må være tilbake i basecamp i tide for neste start hver time. Siste løper igjen på banen vinner.
        </Typography>
        <Grid container spacing={3}>
          {raceDistances.map((race) => (
            <Grid item xs={12} sm={6} md={4} key={race.id}>
              <Paper elevation={1} sx={{ p: 3, borderRadius: 2, height: '100%', display: 'flex', flexDirection: 'column', gap: 1 }}>
                <Typography variant="h6" fontWeight={700} color="primary">
                  {race.displayName}
                </Typography>
                <Divider sx={{ my: 1 }} />
                <Typography variant="body2">
                  <strong>Distanse:</strong> {(race.length ?? 0).toFixed(1)} km
                </Typography>
                <Typography variant="body2">
                  <strong>Stigning:</strong> {(race.ascent ?? 0).toLocaleString('no-NO')} m
                </Typography>
                <Typography variant="body2">
                  <strong>Nedstigning:</strong> {(race.descent ?? 0).toLocaleString('no-NO')} m
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 'auto' }}>
                  Du kan alltid velge å fortsette på flere loops så lenge du rekker tidsfristen.
                </Typography>
              </Paper>
            </Grid>
          ))}
        </Grid>
      </Box>

      <Box mt={6}>
        <Typography variant="h4" component="h2" fontWeight={700} gutterBottom>
          Påmeldingsavgifter
        </Typography>
        <Grid container spacing={3}>
          <Grid item xs={12} md={6}>
            <Paper elevation={1} sx={{ p: 3, borderRadius: 2, height: '100%', display: 'flex', flexDirection: 'column', gap: 1.5 }}>
              <Typography variant="h6" fontWeight={700}>Standardpakke</Typography>
              <Divider />
              <Typography><strong>Deltakeravgift:</strong> {formatCurrency(event.fees?.participation)}</Typography>
              <Typography><strong>Basecamp-tjenester:</strong> {formatCurrency(event.fees?.baseCamp)}</Typography>
              <Typography><strong>Refunderbart depositum:</strong> {formatCurrency(event.fees?.deposit)}</Typography>
              <Typography variant="h6" sx={{ mt: 1.5 }}>
                Totalt: {formatCurrency(event.fees?.total)}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 'auto' }}>
                Depositum returneres til alle som møter til start. Betaling kan gjøres via Vipps/MobilePay eller internasjonalt med PayPal/bankoverføring.
              </Typography>
            </Paper>
          </Grid>
          <Grid item xs={12} md={6}>
            <Paper elevation={1} sx={{ p: 3, borderRadius: 2, height: '100%', display: 'flex', flexDirection: 'column', gap: 1.5 }}>
              <Typography variant="h6" fontWeight={700}>Hva inngår?</Typography>
              <Divider />
              <Typography variant="body2">• Full tilgang til basecamp med servering og crew-støtte gjennom hele døgnet.</Typography>
              <Typography variant="body2">• Live tracking, tidtaking og offisiell «Last One Standing»-resultatservice.</Typography>
              <Typography variant="body2">• Tilgang til varmestue, søvnkapasitet og bagasjeområde mellom loopene.</Typography>
              <Typography variant="body2">• Medalje, KUTC-gave og deltagelse i loop-rekordprogrammet.</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 'auto' }}>
                Spørsmål om lagdeltakere eller support kan rettes til arrangøren på <a href="mailto:post@krultra.no">post@krultra.no</a>.
              </Typography>
            </Paper>
          </Grid>
        </Grid>
      </Box>

      <Box mt={6}>
        <Typography variant="h4" component="h2" fontWeight={700} gutterBottom>
          Veien videre
        </Typography>
        <Grid container spacing={2}>
          <Grid item xs={12} sm={6} md={4}>
            <Button
              fullWidth
              variant="contained"
              color="primary"
              size="large"
              onClick={() => navigate('/kutc-2025')}
            >
              Besøk årets utgave
            </Button>
          </Grid>
          <Grid item xs={12} sm={6} md={4}>
            <Button
              fullWidth
              variant="outlined"
              size="large"
              onClick={() => navigate('/kutc/results')}
            >
              Se historiske resultater
            </Button>
          </Grid>
          <Grid item xs={12} sm={6} md={4}>
            <Button
              fullWidth
              variant="outlined"
              size="large"
              href="https://krultra.no/en/KUTC"
              target="_blank"
              rel="noopener noreferrer"
            >
              Offisiell infoside
            </Button>
          </Grid>
        </Grid>
      </Box>
    </Container>
  );
};

interface StackedActionsProps {
  navigate: ReturnType<typeof useNavigate>;
}

const StackedActions: React.FC<StackedActionsProps> = ({ navigate }) => (
  <Box mt={3} display="flex" justifyContent="center" gap={2} flexWrap="wrap">
    <Button
      variant="contained"
      color="primary"
      onClick={() => navigate('/kutc-2025')}
      sx={{ fontWeight: 700 }}
    >
      Siste utgave
    </Button>
    <Button
      variant="outlined"
      color="primary"
      onClick={() => navigate('/kutc/results')}
      sx={{ fontWeight: 700 }}
    >
      Resultater
    </Button>
    <Button
      variant="text"
      color="inherit"
      href="https://krultra.no/nb/KUTC"
      target="_blank"
      rel="noopener noreferrer"
      sx={{ fontWeight: 700 }}
    >
      krultra.no/KUTC
    </Button>
  </Box>
);

export default KUTCOverviewPage;
