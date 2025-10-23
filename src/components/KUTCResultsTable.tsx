import React, { useMemo, useState } from 'react';
import {
  Paper,
  Typography,
  Box,
  TextField,
  InputAdornment
} from '@mui/material';
import { DataGrid, GridColDef, GridToolbar } from '@mui/x-data-grid';
import { Search } from '@mui/icons-material';
import { KUTCResultEntry } from '../services/kutcResultsService';

interface KUTCResultsTableProps {
  results: KUTCResultEntry[];
  title: string;
  subtitle?: string;
  type: 'total' | 'race';
}

const KUTCResultsTable: React.FC<KUTCResultsTableProps> = ({
  results,
  title,
  subtitle,
  type
}) => {
  const [searchText, setSearchText] = useState('');
  const [pageSize, setPageSize] = useState(() => {
    const saved = localStorage.getItem(`kutc-results-${type}-pageSize`);
    return saved ? parseInt(saved, 10) : 25;
  });

  const filteredResults = useMemo(() => {
    const searchLower = searchText.toLowerCase();
    return results.filter((result) => {
      return (
        result.firstName?.toLowerCase().includes(searchLower) ||
        result.lastName?.toLowerCase().includes(searchLower) ||
        result.bib?.toLowerCase().includes(searchLower)
      );
    });
  }, [results, searchText]);

  const sortedResults = useMemo(() => {
    const rankField = type === 'total' ? 'finalRank' : 'raceRank';

    const getWeight = (entry: KUTCResultEntry) => {
      const rank = entry[rankField as keyof KUTCResultEntry] as number | null | undefined;
      const status = (entry.status || '').toUpperCase();
      if (typeof rank === 'number' && rank > 0) {
        return { weight: 0, rank };
      }
      if (status === 'FINISHED') {
        return { weight: 1, rank: Number.POSITIVE_INFINITY };
      }
      if (status === 'DNF') {
        return { weight: 2, rank: Number.POSITIVE_INFINITY };
      }
      if (status === 'DNS') {
        return { weight: 3, rank: Number.POSITIVE_INFINITY };
      }
      return { weight: 4, rank: Number.POSITIVE_INFINITY };
    };

    return [...filteredResults].sort((a, b) => {
      const aWeight = getWeight(a);
      const bWeight = getWeight(b);

      if (aWeight.weight !== bWeight.weight) {
        return aWeight.weight - bWeight.weight;
      }

      if (aWeight.rank !== bWeight.rank) {
        return aWeight.rank - bWeight.rank;
      }

      const aLoops = typeof a.loopsCompleted === 'number' ? a.loopsCompleted : (a.loopsCompleted ? Number(a.loopsCompleted) : 0);
      const bLoops = typeof b.loopsCompleted === 'number' ? b.loopsCompleted : (b.loopsCompleted ? Number(b.loopsCompleted) : 0);
      if (aLoops !== bLoops) {
        return bLoops - aLoops; // more loops first
      }

      const timeField = type === 'total' ? 'totalTimeSeconds' : 'raceTimeSeconds';
      const aTime = a[timeField as keyof KUTCResultEntry] as number | null | undefined;
      const bTime = b[timeField as keyof KUTCResultEntry] as number | null | undefined;
      const aTimeVal = typeof aTime === 'number' && aTime > 0 ? aTime : Number.POSITIVE_INFINITY;
      const bTimeVal = typeof bTime === 'number' && bTime > 0 ? bTime : Number.POSITIVE_INFINITY;
      if (aTimeVal !== bTimeVal) {
        return aTimeVal - bTimeVal;
      }

      return (a.personId ?? 0) - (b.personId ?? 0);
    });
  }, [filteredResults, type]);

  // Column definitions for total competition
  const totalColumns: GridColDef[] = [
    {
      field: 'finalRank',
      headerName: 'Rank',
      width: 80,
      type: 'number'
    },
    {
      field: 'bib',
      headerName: 'Bib',
      width: 80
    },
    {
      field: 'name',
      headerName: 'Name',
      width: 200,
      flex: 1,
      valueGetter: (params) => `${params.row.firstName || ''} ${params.row.lastName || ''}`.trim(),
      renderCell: (params) => (
        <Typography variant="body2" sx={{ whiteSpace: 'normal', lineHeight: 1.4 }}>
          {`${params.row.firstName || ''} ${params.row.lastName || ''}`.trim()}
        </Typography>
      )
    },
    {
      field: 'loopsCompleted',
      headerName: 'Loops',
      width: 100,
      type: 'number'
    },
    {
      field: 'totalTimeDisplay',
      headerName: 'Total Time',
      width: 120
    },
    {
      field: 'status',
      headerName: 'Status',
      width: 100
    }
  ];

  // Column definitions for race-specific results
  const raceColumns: GridColDef[] = [
    {
      field: 'raceRank',
      headerName: 'Rank',
      width: 80,
      type: 'number'
    },
    {
      field: 'bib',
      headerName: 'Bib',
      width: 80
    },
    {
      field: 'name',
      headerName: 'Name',
      width: 200,
      flex: 1,
      valueGetter: (params) => `${params.row.firstName || ''} ${params.row.lastName || ''}`.trim(),
      renderCell: (params) => (
        <Typography variant="body2" sx={{ whiteSpace: 'normal', lineHeight: 1.4 }}>
          {`${params.row.firstName || ''} ${params.row.lastName || ''}`.trim()}
        </Typography>
      )
    },
    {
      field: 'raceTimeDisplay',
      headerName: 'Race Time',
      width: 120,
      renderCell: (params) => params.value || '-'
    },
    {
      field: 'status',
      headerName: 'Status',
      width: 100
    }
  ];

  const columns = type === 'total' ? totalColumns : raceColumns;

  return (
    <Paper elevation={3} sx={{ p: 3 }}>
      {/* Header */}
      <Box sx={{ mb: 3 }}>
        <Typography variant="h5" fontWeight="bold" gutterBottom>
          {title}
        </Typography>
        {subtitle && (
          <Typography variant="body2" color="text.secondary">
            {subtitle}
          </Typography>
        )}
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
          {results.length} {results.length === 1 ? 'result' : 'results'}
        </Typography>
      </Box>

      {/* Search */}
      <Box sx={{ mb: 2 }}>
        <TextField
          fullWidth
          variant="outlined"
          placeholder="Search by name or bib..."
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <Search />
              </InputAdornment>
            ),
          }}
        />
      </Box>

      {/* DataGrid */}
      <Box sx={{ height: 600, width: '100%' }}>
        <DataGrid
          rows={sortedResults}
          columns={columns}
          getRowId={(row) => row.personId}
          pageSize={pageSize}
          rowsPerPageOptions={[10, 25, 50, 100]}
          onPageSizeChange={(newSize) => {
            setPageSize(newSize);
            localStorage.setItem(`kutc-results-${type}-pageSize`, newSize.toString());
          }}
          disableSelectionOnClick
          components={{
            Toolbar: GridToolbar
          }}
          componentsProps={{
            toolbar: {
              showQuickFilter: false,
              printOptions: { disableToolbarButton: true },
              csvOptions: {
                fileName: `kutc-${type}-results`,
                delimiter: ',',
                utf8WithBom: true
              }
            },
            pagination: {
              SelectProps: {
                inputProps: {
                  id: `kutc-${type}-page-size-select`,
                  name: 'pageSize'
                }
              }
            }
          }}
          sx={{
            '& .MuiDataGrid-row:hover': {
              backgroundColor: 'action.hover'
            }
          }}
        />
      </Box>
    </Paper>
  );
};

export default KUTCResultsTable;
