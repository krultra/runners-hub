import React from 'react';
import { Container, Typography, Box } from '@mui/material';

const MOAllTimeLeaderboardPage: React.FC = () => {
  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h3" gutterBottom>
          Adelskalender – Malvikingen Opp
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Samlede lister og statistikk på tvers av alle år.
        </Typography>
      </Box>
    </Container>
  );
};

export default MOAllTimeLeaderboardPage;
