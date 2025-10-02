import React, { useEffect, useMemo, useState } from 'react';
import { Container, Typography, Grid, Card, CardActionArea, CardContent, Alert, CircularProgress, Box, FormControlLabel, Switch } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { useEventEdition } from '../contexts/EventEditionContext';
import { getFullEventEditions, EventEdition } from '../services/eventEditionService';
import { listCodeList, CodeListItem } from '../services/codeListService';

type EditionWithStatus = EventEdition & { statusItem?: CodeListItem };

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
        const [eds, statusList] = await Promise.all([
          getFullEventEditions(),
          listCodeList('status', 'eventEditions')
        ]);
        const statusByCode = new Map(statusList.map(it => [it.code, it]));
        const withStatus: EditionWithStatus[] = eds.map(e => ({ ...e, statusItem: statusByCode.get(e.status) }));
        // Default filter: upcoming/current only (20..79). We'll extend at render time for 'showPast'.
        const filtered = withStatus.filter(e => {
          const so = e.statusItem?.sortOrder ?? -1;
          return so >= 20; // exclude drafts <20 here; include >=20 and decide past in view
        });
        // Sort by sortOrder asc, then startTime asc if available
        filtered.sort((a, b) => {
          const sa = a.statusItem?.sortOrder ?? 0;
          const sb = b.statusItem?.sortOrder ?? 0;
          if (sa !== sb) return sa - sb;
          const ta = (a.startTime as any)?.toDate ? (a.startTime as any).toDate().getTime() : (a.startTime as any)?.getTime?.() || 0;
          const tb = (b.startTime as any)?.toDate ? (b.startTime as any).toDate().getTime() : (b.startTime as any)?.getTime?.() || 0;
          return ta - tb;
        });
        setEditions(filtered);
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
      const so = e.statusItem?.sortOrder ?? -1;
      if (showPast) return so >= 20; // include 20..79 and >=80
      return so >= 20 && so <= 79;   // only 20..79
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
                  {/* Status at bottom, emphasized */}
                  {ed.statusItem?.verboseName && (
                    <Typography color="text.secondary" sx={{ fontStyle: 'italic', mt: 1 }}>
                      {ed.statusItem.verboseName}
                    </Typography>
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
