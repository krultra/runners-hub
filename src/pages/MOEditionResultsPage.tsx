import React from 'react';
import { useParams } from 'react-router-dom';
import { Container, Typography, Box, Chip, Stack } from '@mui/material';

const MOEditionResultsPage: React.FC = () => {
  const { editionId } = useParams<{ editionId: string }>();

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 2 }}>
        <Typography variant="h3">Resultater</Typography>
        {editionId ? <Chip label={editionId} /> : null}
      </Stack>
      <Box>
        <Typography variant="body1" color="text.secondary">
          Her kommer resultater for valgt utgave.
        </Typography>
      </Box>
    </Container>
  );
};

export default MOEditionResultsPage;
