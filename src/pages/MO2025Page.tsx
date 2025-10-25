import React, { useState, useEffect, useMemo } from 'react';
import { Container, Typography, Box, Paper, Divider, Button, Grid, CircularProgress, Alert } from '@mui/material';

import { useEventEdition } from '../contexts/EventEditionContext';
import { Link } from 'react-router-dom';

function formatCountdown(target: Date) {
  const now = new Date();
  const diff = target.getTime() - now.getTime();
  if (diff <= 0) return '0 dager 0 timer 0 minutter 0 sekunder';
  const dager = Math.floor(diff / (1000 * 60 * 60 * 24));
  const timer = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutter = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  const sekunder = Math.floor((diff % (1000 * 60)) / 1000);
  return `${dager} dager ${timer} timer ${minutter} minutter ${sekunder} sekunder`;
}

const toDate = (v: any): Date | null => {
  if (!v) return null;
  if (v instanceof Date) return v;
  if (typeof v.toDate === 'function') return v.toDate();
  return null;
}

const MO2025Page: React.FC = () => {

  const { event, loading, error, setEvent } = useEventEdition();
  
  // Load the MO-2025 event when the component mounts
  useEffect(() => {
    setEvent('mo-2025');
  }, [setEvent]);

  // Extract dates from event
  const raceDate = useMemo(() => toDate(event?.startTime) || new Date(), [event?.startTime]);
  const registrationDeadline = useMemo(() => toDate(event?.registrationDeadline), [event?.registrationDeadline]);
  
  const [nedtelling, setNedtelling] = useState<string>(formatCountdown(raceDate));

  useEffect(() => {
    const timer = setInterval(() => setNedtelling(formatCountdown(raceDate)), 1000);
    return () => clearInterval(timer);
  }, [raceDate]);

  // Determine if event is in the past
  const now = new Date();
  const isPastEvent = raceDate < now;
  const isRegistrationOpen = registrationDeadline ? now < registrationDeadline : false;
  const liveResultsURL = event?.liveResultsURL ?? '';
  const isEventOngoing = event?.resultsStatus === 'ongoing';
  const showLiveResultsButton = Boolean(isEventOngoing && liveResultsURL);

  let statusMessage = '';
  if (isEventOngoing) {
    statusMessage = 'Løpet pågår nå';
  } else if (isPastEvent) {
    statusMessage = 'Løpet er avsluttet';
  } else if (!isRegistrationOpen) {
    statusMessage = 'Påmeldingen er stengt';
  } else {
    statusMessage = 'Påmeldingen er åpen';
  }

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="200px">
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Box p={3}>
        <Typography color="error">Error loading event: {error.message}</Typography>
      </Box>
    );
  }

  if (!event) {
    return (
      <Box p={3}>
        <Alert severity="warning">No event data available. <Link to="/">Go back to home</Link></Alert>
      </Box>
    );
  }

  return (
    <Container maxWidth="lg">
      <Box sx={{ my: 4, textAlign: 'center' }}>
        <Typography variant="h2" component="h1" gutterBottom>
          {event.eventName || 'Malvikingen Opp 2025'}
        </Typography>
        <Typography variant="h5" color="text.secondary" paragraph>
          Malviks eldste motbakkeløp
        </Typography>
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.5 }}>
          <Button
            href="https://krultra.no/nb/node/23
            target="_blank"
            rel="noopener noreferrer"
            variant="text"
            color="inherit"
            sx={{ fontWeight: 400, px: 1, py: 0.5, minWidth: 0, fontSize: '1rem', textTransform: 'none', textDecoration: 'underline', textUnderlineOffset: 4 }}
          >
            Mer informasjon på hjemmesiden for Malvikingen Opp
          </Button>
          <Button
            href="https://www.facebook.com/groups/146973852042384/"
            target="_blank"
            rel="noopener noreferrer"
            variant="text"
            color="inherit"
            sx={{ fontWeight: 400, px: 1, py: 0.5, minWidth: 0, fontSize: '0.95rem', textTransform: 'none', textDecoration: 'underline', textUnderlineOffset: 4 }}
          >
            Se også løpets facebook-gruppe for nyheter, bilder og resultater
          </Button>
        </Box>
        <Paper elevation={1} sx={{ borderRadius: 2, p: 3, mb: 4 }}>
          <Typography variant="h4">
            {raceDate.toLocaleDateString('nb-NO', {
              weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
            })}
          </Typography>
          <Typography variant="h6">
            Start konkurranseklasser: {raceDate.toLocaleTimeString('nb-NO', { hour: '2-digit', minute: '2-digit' })}
            <br />
            Start turklasse: Fra kl. 10:00
          </Typography>
          {!isPastEvent && (
            <Box sx={{ mt: 2 }}>
              <Typography variant="h5">
                {nedtelling} igjen
              </Typography>
            </Box>
          )}
        </Paper>
        <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, justifyContent: 'center', gap: 2, mt: 2, mb: 2 }}>
          {showLiveResultsButton && liveResultsURL && (
            <Button
              variant="contained"
              color="secondary"
              size="large"
              href={liveResultsURL}
              target="_blank"
              rel="noopener noreferrer"
              sx={{ fontWeight: 700, minWidth: 220 }}
            >
              Se live resultater
            </Button>
          )}
          {!isPastEvent && !isEventOngoing && isRegistrationOpen && (
            <>
              <Button
                variant="contained"
                color="primary"
                size="large"
                href="https://docs.google.com/forms/d/e/1FAIpQLSfUjLiF7JwKMiKA8kpplwlGjmxgGZ1slE_IWNmxZucqHSj95g/viewform?usp=sharing"
                target="_blank"
                rel="noopener noreferrer"
                sx={{ fontWeight: 700, minWidth: 220 }}
              >
                Påmelding turklasse
              </Button>
              <Button
                variant="contained"
                color="primary"
                size="large"
                href="https://signup.eqtiming.com/?Event=Malvik_IL&lang=norwegian"
                target="_blank"
                rel="noopener noreferrer"
                sx={{ fontWeight: 700, minWidth: 220 }}
              >
                Påmelding konkurranseklasser
              </Button>
            </>
          )}
          <Button
            variant="outlined"
            color="inherit"
            href="https://signup.eqtiming.com/participants?Event=malvik_il&uid=76727"
            target="_blank"
            rel="noopener noreferrer"
            sx={{ fontWeight: 700, minWidth: 220 }}
          >
            Se deltakere
          </Button>
          {isPastEvent && event.resultURL && (
            <Button
              variant="contained"
              color="primary"
              size="large"
              href={event.resultURL}
              target="_blank"
              rel="noopener noreferrer"
              sx={{ fontWeight: 700, minWidth: 220 }}
            >
              Se resultater
            </Button>
          )}
        </Box>

        {statusMessage && (
          <Alert severity={isEventOngoing ? 'success' : 'info'} sx={{ mb: 4 }}>
            {statusMessage}
          </Alert>
        )}

        <Box sx={{ flexGrow: 1, mb: 4 }}>
          <Grid container spacing={4} justifyContent="center">
            <Grid item xs={12} md={6}>
              <Paper elevation={0} sx={{ p: 3, border: '1px solid', borderColor: 'divider', borderRadius: 2, height: '100%' }}>
                <Typography variant="h6" gutterBottom>Om løpet</Typography>
                <Divider sx={{ mb: 2 }} />
                <Typography paragraph>
                  Malvikingen Opp går fra Vikhammerløkka til Solemsvåttan. Lengden er 6 km, og høydeforskjellen mellom start og mål er 420 meter. I konkurranseklassen kan alle konkurrere mot alle takket være en justeringsfaktor som avhenger av kjønn og alder. Malvikingen Opp har også trimklasse og en familievennlig turklasse med innlagt natursti for de som ønsker det.
                </Typography>
                <Typography paragraph>
                  Malvikingen Opp så dagens lys i 2011 og er det eldste motbakkeløpet i Malvik. Arrangør er Malvik IL Friidrett.
                </Typography>
                <Typography><b>Løpsdato:</b> Lørdag 10. mai 2025</Typography>
                <Typography><b>Start:</b> 10:00–12:00 for tur, 12:00 for konkurranse og trim m/tidtaking</Typography>
                <Typography><b>Start:</b> Vikhammerløkka</Typography>
                <Typography><b>Mål:</b> Solemsvåttan</Typography>
                <Typography><b>Lengde:</b> 6 km</Typography>
                <Typography><b>Høydemeter:</b> Start 3 moh, mål 423 moh.</Typography>
              </Paper>
            </Grid>
            <Grid item xs={12} md={6}>
              <Paper elevation={0} sx={{ p: 3, border: '1px solid', borderColor: 'divider', borderRadius: 2, height: '100%' }}>
                <Typography variant="h6" gutterBottom>Påmelding og betaling</Typography>
                <Divider sx={{ mb: 2 }} />
                <Typography><b>Påmeldingsfrist:</b> {registrationDeadline?.toLocaleDateString('nb-NO') || 'Ikke satt'}</Typography>
                <Typography><b>Deltakeravgift:</b></Typography>
                <ul style={{ textAlign: 'left', marginTop: 4, marginBottom: 8 }}>
                  <li>200,- kroner for konkurranseklasser og trim med tidtaking <br /><span style={{ fontSize: '0.95em', color: '#555' }}>(+ evt. engangslisens 30,- for de som ikke har årslisens)</span></li>
                  <li>50,- kroner for tur/mosjonsklasse <span style={{ fontSize: '0.95em', color: '#555' }}>(ingen lisenskrav)</span></li>
                </ul>
                <Typography sx={{ mt: 2 }}>
                  <b>Påmelding:</b>
                </Typography>
                <ul style={{ textAlign: 'left', marginTop: 4, marginBottom: 8 }}>
                  <li>
                    Påmelding for konkurranse og trim med tidtaking skjer via{' '}
                    <Button
                      href="https://signup.eqtiming.com/?Event=Malvik_IL&lang=norwegian"
                      target="_blank"
                      rel="noopener noreferrer"
                      variant="text"
                      color="inherit"
                      sx={{ p: 0, minWidth: 0, fontSize: '1em', textTransform: 'none', textDecoration: 'underline', textUnderlineOffset: 4 }}
                    >
                      EQ Timing
                    </Button>.
                  </li>
                  <li>
                    Påmelding for turklassen gjøres ved å klikke på knappen for påmelding turklasse ovenfor.
                  </li>
                </ul>
                <Typography><b>Betaling for turklassen:</b> Vipps 50,- kroner til 913 51 909.</Typography>
              </Paper>
            </Grid>
          </Grid>
        </Box>
      </Box>
    </Container>
  );
};

export default MO2025Page;
