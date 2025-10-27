import React, { useEffect, useMemo, useState } from 'react';
import {
  Container,
  Typography,
  Box,
  CircularProgress,
  Alert,
  Paper,
  TextField,
  Stack,
  Button,
  Tooltip,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions
} from '@mui/material';
import { DataGrid, GridColDef } from '@mui/x-data-grid';
import { EmojiEvents, Leaderboard, ArrowBack, InfoOutlined, MoreHoriz } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import {
  getAllTimeLeaderboard,
  MOAllTimeParticipant,
  MOAllTimeYearDetail
} from '../services/moResultsService';

const MOAllTimeLeaderboardPage: React.FC = () => {
  const navigate = useNavigate();
  const [participants, setParticipants] = useState<MOAllTimeParticipant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchText, setSearchText] = useState('');
  const [pageSize, setPageSize] = useState(() => {
    const saved = localStorage.getItem('mo-leaderboard-pageSize');
    return saved ? Number.parseInt(saved, 10) : 25;
  });
  const [detailParticipant, setDetailParticipant] = useState<MOAllTimeParticipant | null>(null);

  useEffect(() => {
    const fetchLeaderboard = async () => {
      try {
        setLoading(true);
        const data = await getAllTimeLeaderboard();
        setParticipants(data.participants);
      } catch (err) {
        console.error('[MO All-Time] Failed to load leaderboard', err);
        setError('Klarte ikke å hente adelskalender-data.');
      } finally {
        setLoading(false);
      }
    };

    fetchLeaderboard();
  }, []);

  const filteredParticipants = useMemo(() => {
    if (!searchText) {
      return participants;
    }
    const lookup = searchText.trim().toLowerCase();
    return participants.filter((participant) =>
      participant.fullName.toLowerCase().includes(lookup)
    );
  }, [participants, searchText]);

  const visibleParticipants = useMemo(() => filteredParticipants, [filteredParticipants]);

  const formatYearRanges = useMemo(
    () =>
      (years: string[]): string => {
        if (!years.length) {
          return '—';
        }

        const numericYears = years
          .map((year) => Number.parseInt(year, 10))
          .filter((year) => Number.isFinite(year))
          .sort((a, b) => a - b);

        if (!numericYears.length) {
          return years.join(', ');
        }

        const ranges: string[] = [];
        let rangeStart = numericYears[0];
        let previous = numericYears[0];

        for (let i = 1; i < numericYears.length; i += 1) {
          const current = numericYears[i];
          if (current === previous + 1) {
            previous = current;
            continue;
          }

          ranges.push(rangeStart === previous ? `${rangeStart}` : `${rangeStart}-${previous}`);
          rangeStart = current;
          previous = current;
        }

        ranges.push(rangeStart === previous ? `${rangeStart}` : `${rangeStart}-${previous}`);

        return ranges.join(', ');
      },
    []
  );

  const columns = useMemo<GridColDef[]>(
    () => [
      {
        field: 'fullName',
        headerName: 'Navn',
        flex: 1.2,
        minWidth: 160,
        renderCell: (params) => (
          <Typography fontWeight={600} sx={{ whiteSpace: 'normal' }}>
            {params.value}
          </Typography>
        )
      },
      {
        field: 'appearances',
        headerName: 'Deltagelser',
        flex: 0.5,
        minWidth: 110,
        align: 'center',
        headerAlign: 'center'
      },
      {
        field: 'bestTimeDisplay',
        headerName: 'Beste tid',
        flex: 0.6,
        minWidth: 120,
        align: 'center',
        headerAlign: 'center',
        valueGetter: (params) => params.row.bestTimeDisplay ?? '—'
      },
      {
        field: 'bestAdjustedDisplay',
        headerName: 'Justert bestetid',
        flex: 0.7,
        minWidth: 140,
        align: 'center',
        headerAlign: 'center',
        valueGetter: (params) => params.row.bestAdjustedDisplay ?? '—',
        renderHeader: () => (
          <Tooltip title="Alders- og kjønnsjustert beste tid (AGG)" arrow>
            <Stack direction="row" alignItems="center" justifyContent="center" spacing={0.5} sx={{ width: '100%', cursor: 'help' }}>
              <Typography component="span" variant="body2" fontWeight={600}>
                Justert bestetid
              </Typography>
              <InfoOutlined fontSize="small" color="action" />
            </Stack>
          </Tooltip>
        )
      },
      {
        field: 'editionYears',
        headerName: 'År',
        flex: 1,
        minWidth: 200,
        renderCell: (params) => (
          <Stack direction="row" alignItems="center" spacing={0.5} sx={{ width: '100%' }}>
            <Typography component="span" sx={{ fontSize: '0.75rem', whiteSpace: 'normal' }}>
              {formatYearRanges(params.value as string[])}
            </Typography>
            <IconButton
              size="small"
              aria-label="Vis detaljer"
              onClick={(event) => {
                event.stopPropagation();
                setDetailParticipant(params.row as MOAllTimeParticipant);
              }}
            >
              <MoreHoriz fontSize="small" />
            </IconButton>
          </Stack>
        )
      }
    ],
    [formatYearRanges]
  );

  if (loading) {
    return (
      <Container maxWidth="xl" sx={{ mt: 4, mb: 4 }}>
        <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
          <CircularProgress />
        </Box>
      </Container>
    );
  }

  if (error) {
    return (
      <Container maxWidth="xl" sx={{ mt: 4, mb: 4 }}>
        <Alert severity="error">{error}</Alert>
      </Container>
    );
  }

  return (
    <Container maxWidth="xl" sx={{ mt: 4, mb: 4 }}>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, alignItems: 'center', mb: 2 }}>
        <Button startIcon={<ArrowBack />} onClick={() => navigate('/mo/results')}>
          Tilbake til oversikt
        </Button>
        <Box sx={{ flex: '1 1 auto' }} />
        <Button
          variant="outlined"
          startIcon={<Leaderboard />}
          onClick={() => navigate('/mo/records')}
        >
          Rekorder
        </Button>
      </Box>

      <Box sx={{ mb: 4 }}>
        <Typography variant="h3" component="h1" gutterBottom fontWeight="bold">
          <EmojiEvents sx={{ fontSize: 40, mr: 1, verticalAlign: 'middle', color: 'primary.main' }} />
          Adelskalender – Malvikingen Opp
        </Typography>
        <Typography variant="h6" color="text.secondary">
          Flest deltakelser på tvers av alle klasser og roller.
        </Typography>
      </Box>

      <Box sx={{ mb: 3 }}>
        <TextField
          label="Søk etter løper"
          fullWidth
          value={searchText}
          onChange={(event) => setSearchText(event.target.value)}
          placeholder="Skriv inn navn for å filtrere..."
        />
      </Box>

      {visibleParticipants.length === 0 ? (
        <Alert severity="info">Ingen resultater tilgjengelig for adelskalenderen.</Alert>
      ) : (
        <Paper elevation={2} sx={{ width: '100%', overflow: 'hidden' }}>
          <DataGrid
            autoHeight
            getRowHeight={() => 'auto'}
            rows={visibleParticipants.map((participant) => ({
              id: participant.runnerKey,
              ...participant
            }))}
            columns={columns}
            pageSize={pageSize}
            rowsPerPageOptions={[25, 50, 100]}
            onPageSizeChange={(newSize) => {
              setPageSize(newSize);
              localStorage.setItem('mo-leaderboard-pageSize', newSize.toString());
            }}
            disableSelectionOnClick
            sx={{
              '& .MuiDataGrid-columnHeaders': {
                backgroundColor: (theme) =>
                  theme.palette.mode === 'light' ? 'grey.100' : 'grey.900',
                fontWeight: 700
              },
              '& .MuiDataGrid-cell': {
                borderRight: '1px solid',
                borderColor: 'divider',
                whiteSpace: 'normal',
                lineHeight: 1.4
              },
              '& .MuiDataGrid-virtualScrollerRenderZone': {
                '& .MuiDataGrid-row': {
                  maxHeight: 'none !important'
                }
              }
            }}
          />
        </Paper>
      )}

      <Box sx={{ mt: 2 }}>
        <Typography variant="caption" color="text.secondary">
          DNS-oppføringer er ekskludert. Tidskolonner gjelder kun for resultater i konkurranseklassen.
        </Typography>
      </Box>

      <Dialog
        open={Boolean(detailParticipant)}
        onClose={() => setDetailParticipant(null)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>
          {detailParticipant?.fullName}
        </DialogTitle>
        <DialogContent dividers>
          {detailParticipant?.yearDetails.length ? (
            <Stack spacing={1}>
              {detailParticipant.yearDetails.map((detail: MOAllTimeYearDetail) => {
                const categoryLabels: Record<string, string> = {
                  competition: 'Konkurranse',
                  trim_tur: 'Trim / tur',
                  volunteer: 'Funksjonær'
                };
                return (
                  <Stack key={detail.year} spacing={0.25}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                      {detail.year}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {detail.categories
                        .map((category: keyof typeof categoryLabels) => categoryLabels[category])
                        .join(', ')}
                    </Typography>
                  </Stack>
                );
              })}
            </Stack>
          ) : (
            <Typography variant="body2" color="text.secondary">
              Ingen år registrert.
            </Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDetailParticipant(null)} autoFocus>
            Lukk
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default MOAllTimeLeaderboardPage;
