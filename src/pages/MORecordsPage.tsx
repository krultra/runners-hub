import React from 'react';
import { Container, Typography, Box } from '@mui/material';

const MORecordsPage: React.FC = () => {
  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h3" gutterBottom>
          Rekorder – Malvikingen Opp
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Raskeste tider og alders-/kjønnsjusterte rekorder.
        </Typography>
      </Box>
    </Container>
  );
};

export default MORecordsPage;
