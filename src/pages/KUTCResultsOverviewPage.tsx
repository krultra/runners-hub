import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Container,
  Typography,
  Box,
  Card,
  CardContent,
  CardActionArea,
  Grid,
  CircularProgress,
  Alert,
  Chip,
  Button
} from '@mui/material';
import { Trophy, Calendar, BarChart3 } from 'lucide-react';
import { listKUTCEditions, KUTCEdition } from '../services/kutcResultsService';

const KUTCResultsOverviewPage: React.FC = () => {
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const [editions, setEditions] = useState<KUTCEdition[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const hasDataIntegrityIssues = useMemo(
    () => editions.some(edition => edition.metadata?.resultsStatus === 'error'),
    [editions]
  );

  const dateLocale = i18n.language?.startsWith('no') ? 'nb-NO' : 'en-GB';

  useEffect(() => {
    const fetchEditions = async () => {
      try {
        setLoading(true);
        const data = await listKUTCEditions();
        setEditions(data);
      } catch (err) {
        console.error('Error fetching KUTC editions:', err);
        setError(t('kutc.failedToLoadEditions'));
      } finally {
        setLoading(false);
      }
    };

    fetchEditions();
  }, [t]);

  const handleEditionClick = (editionId: string) => {
    navigate(`/kutc/results/${editionId}`);
  };

  if (loading) {
    return (
      <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
        <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
          <CircularProgress />
        </Box>
      </Container>
    );
  }

  if (error) {
    return (
      <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
        <Alert severity="error">{error}</Alert>
      </Container>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      {/* Header */}
      <Box sx={{ mb: 4 }}>
        <Box
          sx={{
            display: 'flex',
            flexWrap: 'wrap',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            gap: 2,
            mb: 2
          }}
        >
          <Box sx={{ flex: '1 1 240px' }}>
            <Typography variant="h3" component="h1" gutterBottom fontWeight="bold">
              <Trophy size={40} style={{ marginRight: 8, verticalAlign: 'middle' }} />
              {t('kutc.resultsTitle')}
            </Typography>
            <Typography variant="h6" color="text.secondary">
              {t('kutc.historicalResultsSubtitle')}
            </Typography>
          </Box>
          <Box
            sx={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: 2,
              mt: { xs: 0, sm: 1 }
            }}
          >
            <Button
              variant="contained"
              color="primary"
              startIcon={<BarChart3 />}
              onClick={() => navigate('/kutc/all-time')}
            >
              {t('kutc.allTimeLeaderboard')}
            </Button>
            <Button
              variant="outlined"
              color="primary"
              startIcon={<Trophy />}
              onClick={() => navigate('/kutc/records')}
            >
              {t('events.records')}
            </Button>
          </Box>
        </Box>

        {hasDataIntegrityIssues && (
          <Alert severity="warning">
            {t('kutc.dataIntegrityWarning')}
          </Alert>
        )}
      </Box>

      {/* Editions Grid */}
      {editions.length === 0 ? (
        <Alert severity="info">
          {t('kutc.noResultsAvailableYet')}
        </Alert>
      ) : (
        <Grid container spacing={3}>
          {editions.map((edition) => (
            <Grid item xs={12} sm={6} md={4} key={edition.id}>
              <Card 
                elevation={3}
                sx={{
                  height: '100%',
                  transition: 'transform 0.2s, box-shadow 0.2s',
                  '&:hover': {
                    transform: 'translateY(-4px)',
                    boxShadow: 6
                  }
                }}
              >
                <CardActionArea 
                  onClick={() => handleEditionClick(edition.id)}
                  sx={{ height: '100%' }}
                >
                  <CardContent sx={{ position: 'relative' }}>
                    {/* Status chip in top-right corner */}
                    {edition.metadata && (
                      <Chip
                        label={edition.metadata.resultsStatusLabel || edition.metadata.resultsStatus}
                        size="small"
                        color={
                          edition.metadata.resultsStatus === 'final' ? 'success' :
                          edition.metadata.resultsStatus === 'preliminary' ? 'warning' :
                          edition.metadata.resultsStatus === 'error' ? 'error' : 'default'
                        }
                        sx={{ position: 'absolute', top: 16, right: 16 }}
                      />
                    )}

                    {/* Year */}
                    <Typography variant="h4" component="div" fontWeight="bold" color="primary" sx={{ mb: 2 }}>
                      {edition.year}
                    </Typography>

                    {/* Metadata */}
                    {edition.metadata ? (
                      <Box>
                        {/* Date from eventEdition startTime - hide if Jan 1 */}
                        {edition.metadata.eventDate && (() => {
                          const date = edition.metadata.eventDate?.toDate ? edition.metadata.eventDate.toDate() : null;
                          const isJan1 = date && date.getMonth() === 0 && date.getDate() === 1;
                          return !isJan1 ? (
                            <Box sx={{ display: 'flex', alignItems: 'center', mb: 1.5 }}>
                              <Calendar size={16} style={{ marginRight: 8 }} />
                              <Typography variant="body2" color="text.secondary">
                                {date ? date.toLocaleDateString(dateLocale, {
                                  day: 'numeric',
                                  month: 'short',
                                  year: 'numeric'
                                }) : edition.metadata.eventDate}
                              </Typography>
                            </Box>
                          ) : null;
                        })()}

                        {/* Participants only */}
                        <Typography variant="body2" color="text.secondary">
                          {t('common.participantsCount', { count: edition.metadata.totalParticipants })}
                        </Typography>
                      </Box>
                    ) : (
                      <Typography variant="body2" color="text.secondary">
                        {t('common.noMetadataAvailable')}
                      </Typography>
                    )}
                  </CardContent>
                </CardActionArea>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}
    </Container>
  );
};

export default KUTCResultsOverviewPage;
