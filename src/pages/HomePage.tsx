import React from 'react';
import { Box, Container, Typography, Grid, Card, CardActionArea, CardContent } from '@mui/material';
import { useNavigate } from 'react-router-dom';

const EVENTS = [
  {
    key: 'mo-2025',
    name: "Malvikingen Opp 2025",
    description: "Vårens vakreste eventyr iMalvik!",
    route: '/mo-2025', // Placeholder for future event page
  },
  {
    key: 'kutc-2025',
    name: "Kruke's Ultra-Trail Challenge 2025",
    description: "Challenge yourself on the trails to Solemsvåttan!",
    route: '/kutc-2025', // For now, routes to the current HomePage
  },
];

const HomePage: React.FC = () => {
  const navigate = useNavigate();

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
