import React from 'react';
import { Container, Typography, Box } from '@mui/material';

const MOResultsOverviewPage: React.FC = () => {
  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h3" gutterBottom>
          Resultater – Malvikingen Opp
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Oversikt over resultater per år. Velg en utgave for detaljerte resultater.
        </Typography>
      </Box>
    </Container>
  );
};

export default MOResultsOverviewPage;
