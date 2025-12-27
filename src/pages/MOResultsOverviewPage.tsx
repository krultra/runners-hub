import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
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
  const { i18n, t } = useTranslation();
  const [editions, setEditions] = useState<MOEventEditionSummary[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const uiLocale = useMemo(() => {
    if (i18n.language?.toLowerCase().startsWith('no')) {
      return 'nb-NO';
    }
    return 'en-GB';
  }, [i18n.language]);

  const formatDate = (value: Date | string | number | null | undefined): string => {
    if (!value) return '';
    const d = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(d.getTime())) return '';
    return new Intl.DateTimeFormat(uiLocale, {
      year: 'numeric',
      month: 'short',
      day: '2-digit'
    }).format(d);
  };

  useEffect(() => {
    const fetchEditions = async () => {
      try {
        setLoading(true);
        const list = await listMoEventEditions();
        setEditions(list);
        setError(null);
      } catch (err) {
        console.error('[MO Results] Failed to list editions', err);
        setError(t('mo.resultsOverview.loadFailed'));
      } finally {
        setLoading(false);
      }
    };

    fetchEditions();
  }, [t]);

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
            {t('mo.resultsOverview.title')}
          </Typography>
          <Typography variant="body1" color="text.secondary">
            {t('mo.resultsOverview.subtitle')}
          </Typography>
        </Box>

        <Stack direction="row" spacing={2} flexWrap="wrap">
          <Button
            variant="outlined"
            startIcon={<Trophy />}
            onClick={() => navigate('/mo/records')}
          >
            {t('events.records')}
          </Button>
          <Button
            variant="contained"
            startIcon={<BarChart3 />}
            onClick={() => navigate('/mo/all-time')}
          >
            {t('mo.allTimeLeaderboard')}
          </Button>
        </Stack>
      </Box>

      {error ? (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      ) : null}

      {sorted.length === 0 ? (
        <Alert severity="info">{t('mo.resultsOverview.noResultsYet')}</Alert>
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
                        {startTime ? formatDate(startTime) : t('mo.resultsOverview.dateUnknown')}
                      </Typography>
                      <Box display="flex" flexWrap="wrap" gap={1} mt={1.5}>
                        <Chip
                          label={t('mo.resultsOverview.statusLabel', {
                            value: status || t('mo.resultsOverview.unknownValue')
                          })}
                          color={statusColor}
                          size="small"
                        />
                        <Chip
                          label={t('mo.resultsOverview.resultsLabel', {
                            value: resultsStatus || t('mo.resultsOverview.unknownValue')
                          })}
                          color={resultsStatusColor}
                          size="small"
                        />
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
