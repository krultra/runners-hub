import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Container,
  Typography,
  Box,
  Grid,
  Card,
  CardActionArea,
  CardContent,
  Chip,
  CircularProgress,
  Alert
} from '@mui/material';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import { CalendarCheck, Trophy, BarChart3 } from 'lucide-react';
import { listMoEventEditions, MOEventEditionSummary } from '../services/moResultsService';
import { formatDateNb } from '../utils/localeNb';

const statusChipColor: Record<string, 'default' | 'success' | 'warning' | 'error'> = {
  finalized: 'success',
  draft: 'warning',
  cancelled: 'error'
};

const resultsStatusChipColor: Record<string, 'default' | 'success' | 'warning' | 'error'> = {
  final: 'success',
  published: 'success',
  preliminary: 'warning',
  draft: 'warning',
  cancelled: 'error'
};

const MOResultsOverviewPage: React.FC = () => {
  const navigate = useNavigate();
  const [editions, setEditions] = useState<MOEventEditionSummary[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchEditions = async () => {
      try {
        setLoading(true);
        const list = await listMoEventEditions();
        setEditions(list);
        setError(null);
      } catch (err) {
        console.error('[MO Results] Failed to list editions', err);
        setError('Kunne ikke hente resultater. Prøv igjen senere.');
      } finally {
        setLoading(false);
      }
    };

    fetchEditions();
  }, []);

  const sorted = useMemo(() => {
    return editions
      .slice()
      .sort((a, b) => (Number(b.edition) || 0) - (Number(a.edition) || 0));
  }, [editions]);

  if (loading) {
    return (
      <Container maxWidth="lg" sx={{ mt: 6 }}>
        <Box display="flex" justifyContent="center" alignItems="center" minHeight="40vh">
          <CircularProgress />
        </Box>
      </Container>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      <Box
        sx={{
          mb: 3,
          display: 'flex',
          flexWrap: 'wrap',
          gap: 2,
          justifyContent: 'space-between',
          alignItems: { xs: 'stretch', sm: 'center' }
        }}
      >
        <Box>
          <Typography variant="h3" gutterBottom component="h1">
            Resultater – Malvikingen Opp
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Velg en utgave for detaljerte resultater, rekorder og statistikk.
          </Typography>
        </Box>

        <Stack direction="row" spacing={2} flexWrap="wrap">
          <Button
            variant="outlined"
            startIcon={<Trophy />}
            onClick={() => navigate('/mo/records')}
          >
            Rekorder
          </Button>
          <Button
            variant="contained"
            startIcon={<BarChart3 />}
            onClick={() => navigate('/mo/all-time')}
          >
            Adelskalender
          </Button>
        </Stack>
      </Box>

      {error ? (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      ) : null}

      {sorted.length === 0 ? (
        <Alert severity="info">Ingen resultater tilgjengelig ennå.</Alert>
      ) : (
        <Grid container spacing={3}>
          {sorted.map((edition) => {
            const { id, edition: editionNumber, startTime, status, resultsStatus } = edition;
            const statusColor = statusChipColor[status] || 'default';
            const resultsStatusColor = resultsStatusChipColor[resultsStatus] || 'default';

            return (
              <Grid item xs={12} sm={6} md={4} key={id}>
                <Card variant="outlined">
                  <CardActionArea onClick={() => navigate(`/mo/results/${id}`)}>
                    <CardContent>
                      <Box display="flex" alignItems="center" gap={1} mb={1.5}>
                        <CalendarCheck color="primary" />
                        <Typography variant="h5" component="h2">
                          {editionNumber}
                        </Typography>
                      </Box>
                      <Typography variant="body2" color="text.secondary" gutterBottom>
                        {startTime ? formatDateNb(startTime) : 'Dato ukjent'}
                      </Typography>
                      <Box display="flex" flexWrap="wrap" gap={1} mt={1.5}>
                        <Chip label={`Status: ${status || 'ukjent'}`} color={statusColor} size="small" />
                        <Chip label={`Resultater: ${resultsStatus || 'ukjent'}`} color={resultsStatusColor} size="small" />
                      </Box>
                    </CardContent>
                  </CardActionArea>
                </Card>
              </Grid>
            );
          })}
        </Grid>
      )}
    </Container>
  );
};

export default MOResultsOverviewPage;
