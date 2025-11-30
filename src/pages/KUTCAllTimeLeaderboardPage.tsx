import React, { useEffect, useState, useMemo } from 'react';
import {
  Container,
  Typography,
  Box,
  CircularProgress,
  Alert,
  Paper,
  TextField,
  Button
} from '@mui/material';
import { DataGrid, GridColDef } from '@mui/x-data-grid';
import { Trophy, Medal, ArrowLeft } from 'lucide-react';
import { getAllTimeLeaderboard, AllTimeParticipant, KUTCEdition } from '../services/kutcResultsService';
import { getUserIdByPersonId } from '../services/runnerNavigationService';
import { useNavigate } from 'react-router-dom';

type RankedParticipant = AllTimeParticipant & {
  rank: number;
  medal: 'gold' | 'silver' | 'bronze' | null;
};

const KUTCAllTimeLeaderboardPage: React.FC = () => {
  const navigate = useNavigate();
  const [participants, setParticipants] = useState<AllTimeParticipant[]>([]);
  const [editions, setEditions] = useState<KUTCEdition[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchText, setSearchText] = useState('');
  const [pageSize, setPageSize] = useState(() => {
    const saved = localStorage.getItem('kutc-leaderboard-pageSize');
    return saved ? parseInt(saved, 10) : 25;
  });
  const hasDataIntegrityIssues = useMemo(
    () => editions.some(edition => edition.metadata?.resultsStatus === 'error'),
    [editions]
  );

  const goToRunnerByPersonId = async (personId: number) => {
    try {
      const userId = await getUserIdByPersonId(personId);
      if (userId) {
        navigate(`/runners/${userId}`);
        return;
      }
    } catch (err) {
      console.warn('[KUTC All-Time] Failed to resolve userId by personId', { personId, err });
    }
    navigate('/runners/search');
  };

  const rankedParticipants: RankedParticipant[] = useMemo(
    () => participants.map((participant, index) => ({
      ...participant,
      rank: index + 1,
      medal:
        index === 0
          ? 'gold'
          : index === 1
          ? 'silver'
          : index === 2
          ? 'bronze'
          : null
    })),
    [participants]
  );

  useEffect(() => {
    const fetchLeaderboard = async () => {
      try {
        setLoading(true);
        const data = await getAllTimeLeaderboard();
        setParticipants(data.participants);
        setEditions(data.editions);
      } catch (err) {
        console.error('Error fetching all-time leaderboard:', err);
        setError('Failed to load leaderboard data');
      } finally {
        setLoading(false);
      }
    };

    fetchLeaderboard();
  }, []);

  // Filter participants based on search text
  const filteredParticipants = useMemo(() => {
    if (!searchText) return rankedParticipants;
    const search = searchText.toLowerCase();
    return rankedParticipants.filter(p =>
      p.firstName.toLowerCase().includes(search) ||
      p.lastName.toLowerCase().includes(search)
    );
  }, [rankedParticipants, searchText]);

  const filteredTotalLoops = useMemo(
    () => filteredParticipants.reduce((sum, participant) => sum + (participant.totalLoops || 0), 0),
    [filteredParticipants]
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

  // Build dynamic columns: Name, Total, each edition year
  const columns: GridColDef[] = [
    {
      field: 'rank',
      headerName: '#',
      width: 70,
      align: 'center' as const,
      headerAlign: 'center' as const,
      valueGetter: (params) => params.row.rank
    },
    {
      field: 'name',
      headerName: 'Participant',
      width: 220,
      renderCell: (params) => (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          {params.row.medal && (
            <Medal
              size={20}
              color={
                params.row.medal === 'gold'
                  ? '#FFD700'
                  : params.row.medal === 'silver'
                  ? '#C0C0C0'
                  : '#CD7F32'
              }
            />
          )}
          <Button
            variant="text"
            size="small"
            onClick={(e) => {
              e.stopPropagation();
              goToRunnerByPersonId(params.row.id as number);
            }}
            sx={{ textTransform: 'none', fontWeight: 600, p: 0, minWidth: 0 }}
          >
            {params.row.firstName} {params.row.lastName}
          </Button>
        </Box>
      )
    },
    {
      field: 'totalLoops',
      headerName: 'Total',
      width: 100,
      align: 'center' as const,
      headerAlign: 'center' as const,
      renderCell: (params) => (
        <Box
          sx={{
            bgcolor: 'primary.light',
            color: 'primary.contrastText',
            px: 1.5,
            py: 0.5,
            borderRadius: 1,
            fontWeight: 700,
            mx: 'auto',
            minWidth: 48
          }}
        >
          {params.value}
        </Box>
      )
    },
    // Dynamic columns for each edition (oldest to newest)
    ...editions.map((edition) => ({
      field: `edition_${edition.id}`,
      headerName: edition.year.toString(),
      width: 80,
      align: 'center' as const,
      headerAlign: 'center' as const,
      renderCell: (params: any) => {
        const loops = params.row.editionResults.get(edition.id);
        if (loops === null || loops === undefined) {
          return <Typography variant="body2" color="text.disabled">-</Typography>;
        }
        return (
          <Typography 
            variant="body2" 
            fontWeight={loops > 0 ? 600 : 400}
            color={loops > 0 ? 'text.primary' : 'text.secondary'}
          >
            {loops}
          </Typography>
        );
      }
    }))
  ];

  // Transform data for DataGrid
  const rows = filteredParticipants.map((p) => ({
    id: p.personId,
    rank: p.rank,
    firstName: p.firstName,
    lastName: p.lastName,
    editionResults: p.editionResults,
    totalLoops: p.totalLoops,
    medal: p.medal
  }));

  return (
    <Container maxWidth="xl" sx={{ mt: 4, mb: 4 }}>
      {/* Navigation */}
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, alignItems: 'center', mb: 2 }}>
        <Button
          startIcon={<ArrowLeft />}
          onClick={() => navigate('/kutc/results')}
        >
          Back to Overview
        </Button>
        <Box sx={{ flex: '1 1 auto' }} />
        <Button
          variant="outlined"
          startIcon={<Trophy />}
          onClick={() => navigate('/kutc/records')}
        >
          Records
        </Button>
      </Box>

      {/* Header */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="h3" component="h1" gutterBottom fontWeight="bold">
          <Trophy size={40} style={{ marginRight: 8, verticalAlign: 'middle' }} />
          KUTC All-Time Leaderboard
        </Typography>
        <Typography variant="h6" color="text.secondary">
          Total loops completed across all KUTC editions
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
          Showing {filteredParticipants.length} participants across {editions.length} editions with a total of {filteredTotalLoops.toLocaleString()} completed loops
        </Typography>
      </Box>

      {hasDataIntegrityIssues && (
        <Alert severity="warning" sx={{ mb: 3 }}>
          Some historical editions currently contain data errors. We are working to correct them as soon as possible.
        </Alert>
      )}

      {/* Search Field */}
      <Box sx={{ mb: 3 }}>
        <TextField
          id="participant-search"
          name="participantSearch"
          fullWidth
          label="Search participants"
          variant="outlined"
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          placeholder="Type name to filter..."
        />
      </Box>

      {/* Leaderboard Table */}
      <Paper elevation={2} sx={{ width: '100%', overflow: 'hidden' }}>
        <DataGrid
          rows={rows}
          columns={columns}
          pageSize={pageSize}
          rowsPerPageOptions={[25, 50, 100]}
          onPageSizeChange={(newSize) => {
            setPageSize(newSize);
            localStorage.setItem('kutc-leaderboard-pageSize', newSize.toString());
          }}
          disableSelectionOnClick
          style={{ height: 600 }}
          componentsProps={{
            pagination: {
              SelectProps: {
                inputProps: {
                  id: 'page-size-select',
                  name: 'pageSize'
                }
              }
            }
          }}
          sx={{
            '& .MuiDataGrid-cell': {
              borderRight: '1px solid',
              borderColor: 'divider'
            },
            '& .MuiDataGrid-columnHeaders': {
              backgroundColor: (theme) => theme.palette.mode === 'light' ? 'grey.100' : 'grey.900',
              fontWeight: 700
            }
          }}
        />
      </Paper>

      {/* Explanation */}
      <Box sx={{ mt: 2 }}>
        <Typography variant="body2" color="text.secondary">
          Numbers show completed loops for that edition. A value of <strong>0</strong> means the runner registered but did not start (DNS). A dash (<strong>-</strong>) means the runner did not participate that year.
        </Typography>
      </Box>
    </Container>
  );
};

export default KUTCAllTimeLeaderboardPage;
