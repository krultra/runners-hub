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
import { Trophy, BarChart3, ArrowLeft, Info, MoreHorizontal } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  getAllTimeLeaderboard,
  MOAllTimeParticipant,
  MOAllTimeYearDetail
} from '../services/moResultsService';

const MOAllTimeLeaderboardPage: React.FC = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
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
        setError(t('mo.allTime.loadFailed'));
      } finally {
        setLoading(false);
      }
    };

    fetchLeaderboard();
  }, [t]);

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
        headerName: t('mo.allTime.columns.name'),
        flex: 1.2,
        minWidth: 160,
        renderCell: (params) => {
          const userId = (params.row as any).userId as string | undefined;
          const name = params.value as string;
          return userId ? (
            <Button
              variant="text"
              size="small"
              onClick={(e) => {
                e.stopPropagation();
                navigate(`/runners/${userId}`);
              }}
              sx={{ textTransform: 'none', fontWeight: 600, p: 0, minWidth: 0 }}
            >
              {name}
            </Button>
          ) : (
            <Typography fontWeight={600} sx={{ whiteSpace: 'normal' }}>
              {name}
            </Typography>
          );
        }
      },
      {
        field: 'appearances',
        headerName: t('mo.allTime.columns.appearances'),
        flex: 0.5,
        minWidth: 110,
        align: 'center',
        headerAlign: 'center'
      },
      {
        field: 'bestTimeDisplay',
        headerName: t('mo.allTime.columns.bestTime'),
        flex: 0.6,
        minWidth: 120,
        align: 'center',
        headerAlign: 'center',
        valueGetter: (params) => params.row.bestTimeDisplay ?? '—'
      },
      {
        field: 'bestAdjustedDisplay',
        headerName: t('mo.allTime.columns.bestAdjusted'),
        flex: 0.7,
        minWidth: 140,
        align: 'center',
        headerAlign: 'center',
        valueGetter: (params) => params.row.bestAdjustedDisplay ?? '—',
        renderHeader: () => (
          <Tooltip title={t('mo.allTime.bestAdjustedTooltip')} arrow>
            <Stack direction="row" alignItems="center" justifyContent="center" spacing={0.5} sx={{ width: '100%', cursor: 'help' }}>
              <Typography component="span" variant="body2" fontWeight={600}>
                {t('mo.allTime.columns.bestAdjusted')}
              </Typography>
              <Info size={16} />
            </Stack>
          </Tooltip>
        )
      },
      {
        field: 'editionYears',
        headerName: t('mo.allTime.columns.years'),
        flex: 1,
        minWidth: 200,
        renderCell: (params) => (
          <Stack direction="row" alignItems="center" spacing={0.5} sx={{ width: '100%' }}>
            <Typography component="span" sx={{ fontSize: '0.75rem', whiteSpace: 'normal' }}>
              {formatYearRanges(params.value as string[])}
            </Typography>
            <IconButton
              size="small"
              aria-label={t('mo.allTime.showDetails')}
              onClick={(event) => {
                event.stopPropagation();
                setDetailParticipant(params.row as MOAllTimeParticipant);
              }}
            >
              <MoreHorizontal size={16} />
            </IconButton>
          </Stack>
        )
      }
    ],
    [formatYearRanges, t]
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
        <Button startIcon={<ArrowLeft />} onClick={() => navigate('/mo/results')}>
          {t('mo.backToOverview')}
        </Button>
        <Box sx={{ flex: '1 1 auto' }} />
        <Button
          variant="outlined"
          startIcon={<BarChart3 />}
          onClick={() => navigate('/mo/records')}
        >
          {t('events.records')}
        </Button>
      </Box>

      <Box sx={{ mb: 4 }}>
        <Typography variant="h3" component="h1" gutterBottom fontWeight="bold">
          <Trophy size={40} style={{ marginRight: 8, verticalAlign: 'middle' }} />
          {t('mo.allTime.title')}
        </Typography>
        <Typography variant="h6" color="text.secondary">
          {t('mo.allTime.subtitle')}
        </Typography>
      </Box>

      <Box sx={{ mb: 3 }}>
        <TextField
          label={t('mo.allTime.searchLabel')}
          fullWidth
          value={searchText}
          onChange={(event) => setSearchText(event.target.value)}
          placeholder={t('mo.allTime.searchPlaceholder')}
        />
      </Box>

      {visibleParticipants.length === 0 ? (
        <Alert severity="info">{t('mo.allTime.noResults')}</Alert>
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
          {t('mo.allTime.dnsExcludedNote')}
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
                  competition: t('mo.allTime.categories.competition'),
                  trim_tur: t('mo.allTime.categories.trimHike'),
                  volunteer: t('mo.allTime.categories.volunteer')
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
              {t('mo.allTime.noYearsRegistered')}
            </Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDetailParticipant(null)} autoFocus>
            {t('common.close')}
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default MOAllTimeLeaderboardPage;
