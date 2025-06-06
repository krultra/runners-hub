import React, { useState, useEffect } from 'react';
import { Container, Typography, Box, Paper, Divider, Button, Grid, CircularProgress } from '@mui/material';

import { useEventEdition } from '../contexts/EventEditionContext';
import { Link } from 'react-router-dom';

const LØPSDATO = new Date('2025-05-10T12:00:00+02:00'); // Lørdag 10. mai 2025, kl 12:00
const PÅMELDINGSFRIST = new Date('2025-05-09T23:59:59+02:00'); // Sett frist til dagen før

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

const MO2025Page: React.FC = () => {

  const { event, loading, error, setEvent } = useEventEdition();
  const [nedtelling, setNedtelling] = useState<string>(formatCountdown(LØPSDATO));
  
  // Load the MO-2025 event when the component mounts
  useEffect(() => {
    setEvent('mo-2025');
  }, [setEvent]);

  useEffect(() => {
    const timer = setInterval(() => setNedtelling(formatCountdown(LØPSDATO)), 1000);
    return () => clearInterval(timer);
  }, []);

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
        <Typography>No event data available. <Link to="/">Go back to home</Link></Typography>
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
        <Button
          href="https://krultra.no/nb/mo"
          target="_blank"
          rel="noopener noreferrer"
          variant="text"
          color="inherit"
          sx={{ fontWeight: 400, px: 1, py: 0.5, minWidth: 0, fontSize: '1rem', textTransform: 'none', textDecoration: 'underline', textUnderlineOffset: 4 }}
        >
          Mer informasjon på hjemmesiden for Malvikingen Opp
        </Button>
        <Paper elevation={1} sx={{ borderRadius: 2, p: 3, mb: 4 }}>
          <Typography variant="h4">
            {LØPSDATO.toLocaleDateString('nb-NO', {
              weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
            })}
          </Typography>
          <Typography variant="h6">
            Start konkurranseklasser: {LØPSDATO.toLocaleTimeString('nb-NO', { hour: '2-digit', minute: '2-digit' })}
            <br />
            Start turklasse: Fra kl. 10:00
          </Typography>
          <Box sx={{ mt: 2 }}>
            <Typography variant="h5">
              {nedtelling} igjen
            </Typography>
          </Box>
        </Paper>
        <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, justifyContent: 'center', gap: 2, mt: 2, mb: 4 }}>
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
          <Button
            variant="outlined"
            color="inherit"
            href="https://www.facebook.com/download/1718681152388411/Resultater%20Malvikingen%20Opp%202025.xlsx?av=595602135&eav=AfbwfpHqvI3hzavKGm2cjekFwaqwCJzPU2g55Uzd0GWjqg1zZu7H1cxBuyFpGyihbmk&paipv=0&ext=1747503216&hash=AcrFcZvBncq_x69HiQI&__cft__[0]=AZVfJPtX04bk8RjC0u3lNePyh1AHCj5BLtP2LeSXaTVKw9T_3QScCO4p-Xt1iPXlmO_rNZE6waWSHCFGjD0PsQvlhsxSitrkWgPFZXb1bhN_NTWG130Gm4VY0sv-SkPIAwBDuTzGSES4hNyoHxxxzw6Cxyn3FwaFHD7tZIqQjshL0h12yN3X3yBbY3EUO5l3VMPDXsmQH3xY1dWLBBvLpxXj&__tn__=H-R"
            target="_blank"
            rel="noopener noreferrer"
            size="large"
            sx={{ minWidth: 180 }}
            //onClick={() => navigate('/results/mo-2025')}
          >
            Last ned resultater
          </Button>
        </Box>

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
                <Typography><b>Påmeldingsfrist:</b> {PÅMELDINGSFRIST.toLocaleDateString('nb-NO')}</Typography>
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
