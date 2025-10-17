import React, { useEffect, useMemo, useState } from 'react';
import { Container, Typography, Grid, Card, CardActionArea, CardContent, Alert, CircularProgress, Box, FormControlLabel, Switch, Chip, Stack, Button } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { useEventEdition } from '../contexts/EventEditionContext';
import { getFullEventEditions, EventEdition } from '../services/eventEditionService';
import { deriveStatus } from '../utils/derivedStatus';
import { listCodeList, CodeListItem } from '../services/codeListService';

type EditionWithStatus = EventEdition & { statusItem?: CodeListItem; statusNum?: number; resultStatusItem?: CodeListItem; resultStatusCode?: string };

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
        // Sort: status.sortOrder asc, then startTime asc
        withStatus.sort((a, b) => {
          const sa = a.statusItem?.sortOrder ?? 0;
          const sb = b.statusItem?.sortOrder ?? 0;
          if (sa !== sb) return sa - sb;
          const ta = (a.startTime as any)?.toDate ? (a.startTime as any).toDate().getTime() : (a.startTime as any)?.getTime?.() || 0;
          const tb = (b.startTime as any)?.toDate ? (b.startTime as any).toDate().getTime() : (b.startTime as any)?.getTime?.() || 0;
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

  const content = useMemo(() => {
    // Apply 'showPast' (>=80) vs current/upcoming (20..79)
    const visible = editions.filter(e => {
      const d = deriveStatus(e);
      // Exclude drafts/hidden always
      const code = String(e.statusItem?.code || e.status || '').toLowerCase();
      const isDraft = code === '10' || code === 'draft';
      const isHidden = code === '0' || code === 'hidden';
      if (isDraft || isHidden) return false;
      if (showPast) return true; // include all non-drafts
      return !(d === 'finished' || d === 'finalized' || d === 'cancelled');
    });
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
    if (!visible.length) {
      return (
        <>
          <Grid container spacing={4} justifyContent="center" />
          <Typography align="center" sx={{ mt: 2 }}>
            No events are currently available - please check in again soon!
          </Typography>
        </>
      );
    }
    return (
      <>
        <Grid container spacing={4} justifyContent="center">
          {visible.map(ed => (
          <Grid item xs={12} key={ed.id}>
            <Card sx={{ borderRadius: 3, boxShadow: 3 }}>
              <CardActionArea onClick={() => navigate(`/${ed.id}`)}>
                <CardContent>
                  <Typography variant="h5" component="div" gutterBottom>
                    {ed.eventName}
                  </Typography>
                  {/* Event facts */}
                  <Typography variant="body2"><strong>Start:</strong> {formatDateTime(ed.startTime)}</Typography>
                  {typeof ed.maxParticipants === 'number' && (
                    <Typography variant="body2"><strong>Max participants:</strong> {ed.maxParticipants}</Typography>
                  )}
                  {ed.registrationDeadline && (
                    <Typography variant="body2"><strong>Registration deadline:</strong> {formatDateTime(ed.registrationDeadline)}</Typography>
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
                        <Chip size="small" color="info" variant="outlined" label={ed.resultStatusItem.verboseName || 'Results available'} />
                        ) : null;
                      })()}
                      {/* Presence indicators for links (non-CTA, informative) */}
                      {ed.liveResultsURL && (
                        <Chip size="small" color="success" variant="outlined" label="Live results available" />
                      )}
                      {ed.resultURL && (
                        <Chip size="small" color="primary" variant="outlined" label="Final results available" />
                      )}
                    </Stack>
                  </Box>
                  {/* Action buttons for results links */}
                  {(ed.liveResultsURL || ed.resultURL) && (
                    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ mt: 1 }}>
                      {ed.liveResultsURL && (
                        <Button size="small" variant="contained" color="success" onClick={(e) => { e.stopPropagation(); window.open(ed.liveResultsURL!, '_blank'); }}>
                          Live Results
                        </Button>
                      )}
                      {ed.resultURL && (
                        <Button size="small" variant="outlined" onClick={(e) => { e.stopPropagation(); window.open(ed.resultURL!, '_blank'); }}>
                          Final Results
                        </Button>
                      )}
                    </Stack>
                  )}
                </CardContent>
              </CardActionArea>
            </Card>
          </Grid>
          ))}
        </Grid>
        <Typography align="center" sx={{ mt: 2 }}>
          {visible.length === 1
            ? 'Select the event for more details'
            : 'Select an event for more details'}
        </Typography>
      </>
    );
  }, [loading, error, editions, navigate, showPast]);

  return (
    <Container maxWidth="md" sx={{ pt: 8 }}>
      <Typography variant="h3" align="center" gutterBottom>
        Welcome to the KrUltra Runners Hub!
      </Typography>
      <Box display="flex" justifyContent="flex-end" mb={2}>
        <FormControlLabel
          control={<Switch color="primary" checked={showPast} onChange={e => setShowPast(e.target.checked)} />}
          label="Show past events"
          sx={{
            m: 0,
            px: 1,
            py: 0.5,
            borderRadius: 1,
            '& .MuiFormControlLabel-label': { cursor: 'pointer' }
          }}
        />
      </Box>
      {content}
    </Container>
  );
};

export default HomePage;
