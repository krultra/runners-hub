import React from 'react';
import { Box, Container, Typography, Grid, Card, CardActionArea, CardContent } from '@mui/material';
import { useNavigate } from 'react-router-dom';

const EVENTS = [
  {
    key: 'kutc-2025',
    name: "Kruke's Ultra-Trail Challenge 2025",
    description: "Challenge yourself on the trails to Solemsvåttan!",
    route: '/', // For now, routes to the current HomePage
  },
  {
    key: 'malvikingen-opp-2025',
    name: "Malvikingen Opp 2025",
    description: "Take on the vertical challenge in Malvik!",
    route: '/malvikingen-opp-2025', // Placeholder for future event page
  },
];

const NewHomePage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <Container maxWidth="md" sx={{ pt: 8 }}>
      <Typography variant="h3" align="center" gutterBottom>
        Select an Event
      </Typography>
      <Grid container spacing={4} justifyContent="center">
        {EVENTS.map(event => (
          <Grid item xs={12} sm={6} md={5} key={event.key}>
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

export default NewHomePage;
