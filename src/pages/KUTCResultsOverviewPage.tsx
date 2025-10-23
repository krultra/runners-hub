import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
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
import { EmojiEvents, CalendarToday, Leaderboard, EmojiEventsOutlined } from '@mui/icons-material';
import { listKUTCEditions, KUTCEdition } from '../services/kutcResultsService';

const KUTCResultsOverviewPage: React.FC = () => {
  const navigate = useNavigate();
  const [editions, setEditions] = useState<KUTCEdition[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const hasDataIntegrityIssues = useMemo(
    () => editions.some(edition => edition.metadata?.resultsStatus === 'error'),
    [editions]
  );

  useEffect(() => {
    const fetchEditions = async () => {
      try {
        setLoading(true);
        const data = await listKUTCEditions();
        setEditions(data);
      } catch (err) {
        console.error('Error fetching KUTC editions:', err);
        setError('Failed to load KUTC editions');
      } finally {
        setLoading(false);
      }
    };

    fetchEditions();
  }, []);

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
              <EmojiEvents sx={{ fontSize: 40, mr: 1, verticalAlign: 'middle', color: 'primary.main' }} />
              KUTC Results
            </Typography>
            <Typography variant="h6" color="text.secondary">
              Kruke's Ultra-Trail Challenge - Historical Results
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
              startIcon={<Leaderboard />}
              onClick={() => navigate('/kutc/all-time')}
            >
              All-Time Leaderboard
            </Button>
            <Button
              variant="outlined"
              color="primary"
              startIcon={<EmojiEventsOutlined />}
              onClick={() => navigate('/kutc/records')}
            >
              Records
            </Button>
          </Box>
        </Box>

        {hasDataIntegrityIssues && (
          <Alert severity="warning">
            Some historical editions currently contain data errors. We are working to correct them as soon as possible.
          </Alert>
        )}
      </Box>

      {/* Editions Grid */}
      {editions.length === 0 ? (
        <Alert severity="info">
          No results available yet. Check back after the first KUTC event!
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
                              <CalendarToday sx={{ fontSize: 16, mr: 1, color: 'text.secondary' }} />
                              <Typography variant="body2" color="text.secondary">
                                {date ? date.toLocaleDateString('en-GB', {
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
                          <strong>{edition.metadata.totalParticipants}</strong> participants
                        </Typography>
                      </Box>
                    ) : (
                      <Typography variant="body2" color="text.secondary">
                        No metadata available
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
