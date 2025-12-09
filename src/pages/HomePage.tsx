import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Container,
  Typography,
  Grid,
  Card,
  CardActionArea,
  CardContent,
  Alert,
  CircularProgress,
  Box,
  FormControlLabel,
  Switch,
  Chip,
  Stack,
  Button,
  Paper,
  Divider
} from '@mui/material';
import { ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useEventEdition } from '../contexts/EventEditionContext';
import { getFullEventEditions, EventEdition } from '../services/eventEditionService';
import { deriveStatus } from '../utils/derivedStatus';
import { listCodeList, CodeListItem } from '../services/codeListService';

type EditionWithStatus = EventEdition & { statusItem?: CodeListItem; statusNum?: number; resultStatusItem?: CodeListItem; resultStatusCode?: string; RH_URL?: string };

// Helpers
const toDate = (v: any): Date | null => {
  if (!v) return null;
  if (v instanceof Date) return v;
  if (typeof v.toDate === 'function') return v.toDate();
  return null;
};
const formatDateTime = (v: any): string => {
  const d = toDate(v);
  if (!d) return '-';
  return d.toLocaleString(undefined, {
    year: 'numeric', month: 'short', day: '2-digit',
    hour: '2-digit', minute: '2-digit'
  });
};

const HomePage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { setEvent } = useEventEdition();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editions, setEditions] = useState<EditionWithStatus[]>([]);
  const [showPast, setShowPast] = useState(false);

  // Clear the selected event when HomePage loads
  useEffect(() => {
    setEvent(null);
  }, [setEvent]);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const [eds, statusList, resStatusList] = await Promise.all([
          getFullEventEditions(),
          listCodeList('status', 'eventEditions'),
          listCodeList('resultStatus', 'eventEditions')
        ]);
        const statusByCode = new Map(statusList.map(it => [String(it.code), it]));
        const resStatusByCode = new Map(resStatusList.map(it => [String(it.code), it]));
        const statusTextToCode: Record<string, number> = {
          hidden: 0, draft: 10, announced: 20, pre_registration: 30, open: 40, waitlist: 44,
          late_registration: 50, full: 54, closed: 60, in_progress: 70, suspended: 75,
          finished: 80, cancelled: 90, finalized: 100
        };
        const resultTextToCode: Record<string, number> = {
          notStarted: 1, ongoing: 2, awaitingResults: 3, incomplete: 4,
          preliminary: 5, unofficial: 6, final: 7, cancelled: 8, noResults: 9
        };
        const withStatus: EditionWithStatus[] = eds.map(e => {
          const rawStatus = String((e as any).status ?? '').trim();
          const statusNum = Number.parseInt(rawStatus, 10);
          const derivedNum = !isNaN(statusNum) ? statusNum : (statusTextToCode[rawStatus] ?? undefined);
          const statusItem = statusByCode.get(String(derivedNum ?? rawStatus));

          const rawRes = String((e as any).resultsStatus || (e as any).resultStatus || '').trim();
          const resNum = Number.parseInt(rawRes, 10);
          const resDerivedNum = !isNaN(resNum) ? resNum : (resultTextToCode[rawRes] ?? undefined);
          const resultStatusCode = String(resDerivedNum ?? rawRes);
          const resultStatusItem = resStatusByCode.get(resultStatusCode);

          return { ...e, statusItem, statusNum: derivedNum, resultStatusItem, resultStatusCode };
        });
        // Sort: status.sortOrder asc, then startTime desc (for past events) or asc (for upcoming)
        withStatus.sort((a, b) => {
          const sa = a.statusItem?.sortOrder ?? 0;
          const sb = b.statusItem?.sortOrder ?? 0;
          if (sa !== sb) return sa - sb;
          const ta = (a.startTime as any)?.toDate ? (a.startTime as any).toDate().getTime() : (a.startTime as any)?.getTime?.() || 0;
          const tb = (b.startTime as any)?.toDate ? (b.startTime as any).toDate().getTime() : (b.startTime as any)?.getTime?.() || 0;
          // For finished/finalized/cancelled events, sort descending (most recent first)
          const aFinished = sa >= 80; // finished, finalized, cancelled
          const bFinished = sb >= 80;
          if (aFinished && bFinished) return tb - ta;
          return ta - tb;
        });
        setEditions(withStatus);
      } catch (e: any) {
        console.error('Failed to load front page editions:', e);
        setError(e?.message || 'Failed to load events');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const featuredEvents = (
    <Paper
      elevation={0}
      sx={{
        mb: 5,
        p: { xs: 3, md: 4 },
        borderRadius: 3,
        border: (theme) => `1px solid ${theme.palette.divider}`,
        backgroundColor: (theme) => theme.palette.background.paper,
      }}
    >
      <Typography variant="h5" gutterBottom fontWeight={700}>
        {t('home.exploreSignatureEvents')}
      </Typography>
      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          <Paper
            elevation={4}
            sx={{
              height: '100%',
              p: 3,
              borderRadius: 3,
              display: 'flex',
              flexDirection: 'column',
              gap: 2,
              background: 'linear-gradient(135deg, rgba(25,118,210,0.24) 0%, rgba(25,118,210,0.08) 100%)',
              transition: 'transform 0.2s ease, box-shadow 0.2s ease',
              '&:hover': {
                transform: 'translateY(-4px)',
                boxShadow: '0 12px 32px rgba(0,0,0,0.18)'
              },
              cursor: 'pointer'
            }}
            role="button"
            tabIndex={0}
            onClick={() => navigate('/kutc')}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                navigate('/kutc');
              }
            }}
          >
            <Box>
              <Typography
                variant="h6"
                fontWeight={700}
                sx={{
                  color: (theme) => theme.palette.mode === 'light' ? theme.palette.text.primary : 'common.white'
                }}
                gutterBottom
              >
                {t('kutc.title')}
              </Typography>
              <Typography
                variant="body2"
                sx={{
                  color: (theme) => theme.palette.mode === 'light' ? theme.palette.text.secondary : 'rgba(255,255,255,0.85)'
                }}
              >
                {t('kutc.taglineShort')}
              </Typography>
            </Box>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ mt: 'auto' }}>
              <Button
                variant="contained"
                color="primary"
                onClick={() => navigate('/kutc')}
              >
                {t('common.explore')}
              </Button>
              <Button
                variant="outlined"
                onClick={(event) => {
                  event.stopPropagation();
                  navigate('/kutc/results');
                }}
              >
                {t('events.results')}
              </Button>
            </Stack>
          </Paper>
        </Grid>
        <Grid item xs={12} md={6}>
          <Paper
            elevation={4}
            sx={{
              height: '100%',
              p: 3,
              borderRadius: 3,
              display: 'flex',
              flexDirection: 'column',
              gap: 2,
              background: 'linear-gradient(135deg, rgba(46,125,50,0.24) 0%, rgba(46,125,50,0.08) 100%)',
              transition: 'transform 0.2s ease, box-shadow 0.2s ease',
              '&:hover': {
                transform: 'translateY(-4px)',
                boxShadow: '0 12px 32px rgba(0,0,0,0.18)'
              },
              cursor: 'pointer'
            }}
            role="button"
            tabIndex={0}
            onClick={() => navigate('/mo')}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                navigate('/mo');
              }
            }}
          >
            <Box>
              <Typography
                variant="h6"
                fontWeight={700}
                sx={{
                  color: (theme) => theme.palette.mode === 'light' ? theme.palette.text.primary : 'common.white'
                }}
                gutterBottom
              >
                {t('mo.title')}
              </Typography>
              <Typography
                variant="body2"
                sx={{
                  color: (theme) => theme.palette.mode === 'light' ? theme.palette.text.secondary : 'rgba(255,255,255,0.85)'
                }}
              >
                {t('mo.taglineShort')}
              </Typography>
            </Box>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ mt: 'auto' }}>
              <Button
                variant="contained"
                color="success"
                onClick={(event) => {
                  event.stopPropagation();
                  navigate('/mo');
                }}
              >
                {t('common.explore')}
              </Button>
              <Button
                variant="outlined"
                onClick={(event) => {
                  event.stopPropagation();
                  navigate('/mo/results');
                }}
              >
                {t('events.results')}
              </Button>
            </Stack>
          </Paper>
        </Grid>
      </Grid>
    </Paper>
  );

  const editionCards = (visible: EditionWithStatus[]) => (
    <Grid container spacing={3} justifyContent="center">
        {visible.map(ed => {
          // Determine if event has a dedicated event edition page
          // ONLY use RH_URL - resultURL/liveResultsURL are for external results, not event pages
          const hasPage = !!ed.RH_URL;
          const navigateUrl = ed.RH_URL || `/${ed.id}`;
          
          return (
          <Grid item xs={12} key={ed.id}>
            <Card
              sx={{
                borderRadius: 3,
                boxShadow: '0 4px 16px rgba(0,0,0,0.06)',
                border: (theme) => `1px solid ${theme.palette.divider}`,
                background: ed.id.startsWith('kutc-')
                  ? 'linear-gradient(135deg, rgba(25,118,210,0.18) 0%, rgba(25,118,210,0.05) 100%)'
                  : ed.id.startsWith('mo-')
                    ? 'linear-gradient(135deg, rgba(46,125,50,0.18) 0%, rgba(46,125,50,0.05) 100%)'
                    : (theme) => theme.palette.background.paper,
                transition: hasPage ? 'transform 0.2s ease, box-shadow 0.2s ease' : 'none',
                '&:hover': hasPage ? {
                  transform: 'translateY(-4px)',
                  boxShadow: '0 12px 32px rgba(0,0,0,0.18)'
                } : {},
                // Reduce opacity for events without dedicated pages (e.g., KUTC 2018-2024 backfill)
                opacity: hasPage ? 1 : 0.6,
                cursor: hasPage ? 'pointer' : 'default'
              }}
            >
              {hasPage ? (
                <CardActionArea onClick={() => navigate(navigateUrl)}>
                  <CardContent>
                  <Typography variant="h5" component="div" gutterBottom>
                    {ed.eventName}
                  </Typography>
                  {/* Event facts */}
                  <Typography variant="body2"><strong>{t('events.start')}:</strong> {formatDateTime(ed.startTime)}</Typography>
                  {typeof ed.maxParticipants === 'number' && (
                    <Typography variant="body2"><strong>{t('events.maxParticipants')}:</strong> {ed.maxParticipants}</Typography>
                  )}
                  {ed.registrationDeadline && (
                    <Typography variant="body2"><strong>{t('events.registrationDeadline')}:</strong> {formatDateTime(ed.registrationDeadline)}</Typography>
                  )}
                  {/* Status & indicators */}
                  <Box sx={{ mt: 1 }}>
                    <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                      {/* Derived status chip (only for dynamic states) */}
                      {(() => {
                        const d = deriveStatus(ed);
                        return (d === 'in_progress' || d === 'finished' || d === 'finalized' || d === 'cancelled') ? (
                          <Chip size="small" color={d === 'in_progress' ? 'success' : d === 'finished' ? 'default' : d === 'finalized' ? 'primary' : 'warning'} label={d} />
                        ) : null;
                      })()}
                      {/* Code list status verbose (authoritative display label) */}
                      {ed.statusItem?.verboseName && (
                        <Chip size="small" variant="outlined" label={ed.statusItem.verboseName} />
                      )}
                      {/* Results status (show only when results are available: 4..7) */}
                      {(() => {
                        const rs = (ed.resultStatusCode || '').toLowerCase();
                        const available = ['incomplete','preliminary','unofficial','final'].includes(rs) || ['4','5','6','7'].includes(ed.resultStatusCode || '');
                        return ed.resultStatusItem && available ? (
                        <Chip size="small" color="info" variant="outlined" label={ed.resultStatusItem.verboseName || t('common.resultsAvailable')} />
                        ) : null;
                      })()}
                      {/* Presence indicators for links (non-CTA, informative) */}
                      {(() => {
                        const rs = (ed.resultStatusCode || '').toLowerCase();
                        const isOngoing = ['ongoing', '2'].includes(rs);
                        return ed.liveResultsURL && isOngoing ? (
                          <Chip size="small" color="success" variant="outlined" label={t('common.liveResultsAvailable')} />
                        ) : null;
                      })()}
                      {ed.resultURL && (
                        <Chip size="small" color="primary" variant="outlined" label={t('common.finalResultsAvailable')} />
                      )}
                    </Stack>
                  </Box>
                  {/* Action buttons for results links */}
                  {(ed.liveResultsURL || ed.resultURL || ed.id?.startsWith?.('kutc-')) && (
                    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ mt: 1 }}>
                      {(() => {
                        const rs = (ed.resultStatusCode || '').toLowerCase();
                        const isOngoing = ['ongoing', '2'].includes(rs);
                        return ed.liveResultsURL && isOngoing ? (
                          <Button 
                            size="small" 
                            variant="contained" 
                            color="success" 
                            component="div"
                            onClick={(e) => { e.stopPropagation(); window.open(ed.liveResultsURL!, '_blank'); }}
                          >
                            {t('common.liveResults')}
                          </Button>
                        ) : null;
                      })()}
                      {ed.resultURL && (
                        <Button 
                          size="small" 
                          variant="outlined" 
                          component="div"
                          onClick={(e) => { e.stopPropagation(); window.open(ed.resultURL!, '_blank'); }}
                        >
                          {t('common.finalResults')}
                        </Button>
                      )}
                      {(() => {
                        const rs = (ed.resultStatusCode || '').toLowerCase();
                        const normalizedAvailable = ['incomplete','preliminary','unofficial','final'].includes(rs) || ['4','5','6','7'].includes(ed.resultStatusCode || '');
                        const isKUTCEdition = ed.id?.toLowerCase?.().startsWith('kutc-');
                        return normalizedAvailable && isKUTCEdition ? (
                          <Button
                            size="small"
                            variant={ed.resultURL ? 'outlined' : 'contained'}
                            color="primary"
                            component="div"
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate(`/kutc/results/${ed.id}`);
                            }}
                          >
                            {t('kutc.viewKutcResults')}
                          </Button>
                        ) : null;
                      })()}
                    </Stack>
                  )}
                  </CardContent>
                </CardActionArea>
              ) : (
                <CardContent>
                  <Typography variant="h5" component="div" gutterBottom>
                    {ed.eventName}
                  </Typography>
                  {/* Event facts */}
                  <Typography variant="body2"><strong>{t('events.start')}:</strong> {formatDateTime(ed.startTime)}</Typography>
                  {typeof ed.maxParticipants === 'number' && (
                    <Typography variant="body2"><strong>{t('events.maxParticipants')}:</strong> {ed.maxParticipants}</Typography>
                  )}
                  {ed.registrationDeadline && (
                    <Typography variant="body2"><strong>{t('events.registrationDeadline')}:</strong> {formatDateTime(ed.registrationDeadline)}</Typography>
                  )}
                  {/* Status & indicators */}
                  <Box sx={{ mt: 1 }}>
                    <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                      {/* Derived status chip (only for dynamic states) */}
                      {(() => {
                        const d = deriveStatus(ed);
                        return (d === 'in_progress' || d === 'finished' || d === 'finalized' || d === 'cancelled') ? (
                          <Chip size="small" color={d === 'in_progress' ? 'success' : d === 'finished' ? 'default' : d === 'finalized' ? 'primary' : 'warning'} label={d} />
                        ) : null;
                      })()}
                      {/* Code list status verbose (authoritative display label) */}
                      {ed.statusItem?.verboseName && (
                        <Chip size="small" variant="outlined" label={ed.statusItem.verboseName} />
                      )}
                      {/* Results status (show only when results are available: 4..7) */}
                      {(() => {
                        const rs = (ed.resultStatusCode || '').toLowerCase();
                        const available = ['incomplete','preliminary','unofficial','final'].includes(rs) || ['4','5','6','7'].includes(ed.resultStatusCode || '');
                        return ed.resultStatusItem && available ? (
                        <Chip size="small" color="info" variant="outlined" label={ed.resultStatusItem.verboseName || t('common.resultsAvailable')} />
                        ) : null;
                      })()}
                    </Stack>
                  </Box>
                  {/* Action buttons for KUTC results */}
                  {ed.id?.startsWith?.('kutc-') && (() => {
                    const rs = (ed.resultStatusCode || '').toLowerCase();
                    const normalizedAvailable = ['incomplete','preliminary','unofficial','final'].includes(rs) || ['4','5','6','7'].includes(ed.resultStatusCode || '');
                    return normalizedAvailable ? (
                      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ mt: 1 }}>
                        <Button
                          size="small"
                          variant="contained"
                          color="primary"
                          onClick={() => navigate(`/kutc/results/${ed.id}`)}
                        >
                          {t('kutc.viewKutcResults')}
                        </Button>
                      </Stack>
                    ) : null;
                  })()}
                </CardContent>
              )}
            </Card>
          </Grid>
        );})}
      </Grid>
    );

  const content = useMemo(() => {
    let visible = editions.filter(e => {
      const d = deriveStatus(e);
      const code = String(e.statusItem?.code || e.status || '').toLowerCase();
      const isDraft = code === '10' || code === 'draft';
      const isHidden = code === '0' || code === 'hidden';
      if (isDraft || isHidden) return false;
      if (showPast) return true;
      return !(d === 'finished' || d === 'finalized' || d === 'cancelled');
    });

    // Sort visible events: when showing past events, sort in reverse chronological order
    if (showPast) {
      visible = [...visible].sort((a, b) => {
        const ta = (a.startTime as any)?.toDate ? (a.startTime as any).toDate().getTime() : (a.startTime as any)?.getTime?.() || 0;
        const tb = (b.startTime as any)?.toDate ? (b.startTime as any).toDate().getTime() : (b.startTime as any)?.getTime?.() || 0;
        return tb - ta; // Descending order (newest first)
      });
    }

    if (loading) {
      return (
        <Box display="flex" justifyContent="center" alignItems="center" minHeight={160}>
          <CircularProgress />
        </Box>
      );
    }
    if (error) {
      return <Alert severity="error">{error}</Alert>;
    }

    const editionSectionTitle = showPast ? t('events.upcomingAndPastEvents') : t('events.upcomingEvents');

    return (
      <>
        {featuredEvents}
        <Paper
          elevation={0}
          sx={{
            p: { xs: 3, md: 4 },
            borderRadius: 3,
            border: (theme) => `1px solid ${theme.palette.divider}`,
            backgroundColor: (theme) => theme.palette.background.paper,
          }}
        >
          <Box display="flex" flexDirection={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ xs: 'flex-start', sm: 'center' }} gap={2} mb={2}>
            <Typography variant="h5" fontWeight={700}>
              {editionSectionTitle}
            </Typography>
            <FormControlLabel
              control={<Switch color="primary" checked={showPast} onChange={e => setShowPast(e.target.checked)} />}
              label={t('events.showPastEvents')}
              sx={{
                m: 0,
                px: 1,
                py: 0.5,
                borderRadius: 1,
                '& .MuiFormControlLabel-label': { cursor: 'pointer' }
              }}
            />
          </Box>
          <Divider sx={{ mb: 3 }} />
          {visible.length ? (
            <>
              {editionCards(visible)}
              <Typography align="center" sx={{ mt: 3 }}>
                {visible.length === 1
                  ? t('events.selectTheEvent')
                  : t('events.selectEvent')}
              </Typography>
            </>
          ) : (
            <Typography align="center" sx={{ mt: 2 }}>
              {t('events.noEventsAvailable')}
            </Typography>
          )}
        </Paper>
      </>
    );
  }, [loading, error, editions, navigate, showPast, featuredEvents]);

  return (
    <Container maxWidth="md" sx={{ pt: 8 }}>
      <Typography variant="h3" align="center" gutterBottom>
        {t('home.welcome')}
      </Typography>
      <Box textAlign="center" mb={2}>
        <Button
          variant="text"
          color="inherit"
          endIcon={<ArrowRight />}
          onClick={() => navigate('/about')}
          sx={{ fontSize: '0.9rem', textTransform: 'none' }}
        >
          {t('home.whatsRunnersHub')}
        </Button>
      </Box>
      <Box
        mb={5}
        display="flex"
        flexDirection={{ xs: 'column', sm: 'row' }}
        justifyContent="center"
        alignItems="center"
        gap={1.5}
      >
        <Typography variant="h6" align="center">
          {t('home.lookingForRunner')}
        </Typography>
        <Button
          variant="contained"
          color="primary"
          onClick={() => navigate('/runners/search')}
          sx={{ textTransform: 'none' }}
        >
          {t('home.goToRunnerSearch')}
        </Button>
      </Box>
      {content}
    </Container>
  );
};

export default HomePage;
