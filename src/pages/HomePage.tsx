import React, { useEffect } from 'react';
import { Container, Typography, Grid, Card, CardActionArea, CardContent } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { useEventEdition } from '../contexts/EventEditionContext';

const EVENTS = [
  {
    key: 'mo-2025',
    name: "Malvikingen Opp 2025",
    description: "Få med deg vårens vakreste eventyr i Malvik! Lørdag 10. mai 2025 fra Vikhammerløkka til Solemsvåttan.",
    route: '/mo-2025',
  },
  {
    key: 'kutc-2025',
    name: "Kruke's Ultra-Trail Challenge 2025",
    description: "Challenge yourself on the trails to Solemsvåttan! Saturday 10th of October 2025.",
    route: '/kutc-2025',
  },
];

const HomePage: React.FC = () => {
  const navigate = useNavigate();
  const { setEvent } = useEventEdition();

  // Clear the selected event when HomePage loads
  useEffect(() => {
    setEvent(null);
  }, [setEvent]);

  return (
    <Container maxWidth="md" sx={{ pt: 8 }}>
      <Typography variant="h3" align="center" gutterBottom>
        Velg et arrangement
      </Typography>
      <Grid container spacing={4} justifyContent="center">
        {EVENTS.map(event => (
          <Grid item xs={12} key={event.key}>
            <Card sx={{ borderRadius: 3, boxShadow: 3 }}>
              <CardActionArea onClick={() => navigate(event.route)}>
                <CardContent>
                  <Typography variant="h5" component="div" gutterBottom>
                    {event.name}
                  </Typography>
                  <Typography color="text.secondary">
                    {event.description}
                  </Typography>
                </CardContent>
              </CardActionArea>
            </Card>
          </Grid>
        ))}
      </Grid>
    </Container>
  );
};

export default HomePage;
