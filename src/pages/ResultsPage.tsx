import React, { useState, useEffect, MouseEvent } from 'react';
import { getFirestore, collection, getDocs, doc, getDoc, query, where } from 'firebase/firestore';
import { DataGrid, GridToolbar } from '@mui/x-data-grid';
import { Box, Typography, Button, Menu, MenuItem, CircularProgress } from '@mui/material';
import { saveAs } from 'file-saver';

interface ResultRow {
  id: string;
  bib: number;
  totalTimeDisplay: string;
  totalTimeSeconds: number;
  totalAGTimeDisplay?: string;
  totalAGTimeSeconds?: number;
  totalAGGTimeDisplay?: string;
  totalAGGTimeSeconds?: number;
}

enum Status {
  incomplete = 'incomplete',
  preliminary = 'preliminary',
  final = 'final'
}

const ResultsPage: React.FC = () => {
  const [status, setStatus] = useState<Status>(Status.incomplete);
  const [rows, setRows] = useState<ResultRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [preset, setPreset] = useState<string>('default');
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [delimiter, setDelimiter] = useState<string>(';');

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    const db = getFirestore();
    const edSnap = await getDoc(doc(db, 'eventEditions', 'mo-2025'));
    const rs = (edSnap.data()?.resultsStatus as Status) || Status.incomplete;
    setStatus(rs);

    const timingSnap = await getDocs(collection(db, 'moTiming'));
    const data = timingSnap.docs.map(d => {
      const t = d.data() as any;
      return {
        id: d.id,
        bib: t.bib,
        totalTimeDisplay: t.totalTime.display,
        totalTimeSeconds: t.totalTime.seconds,
        totalAGTimeDisplay: t.totalAGTime?.display,
        totalAGTimeSeconds: t.totalAGTime?.seconds,
        totalAGGTimeDisplay: t.totalAGGTime?.display,
        totalAGGTimeSeconds: t.totalAGGTime?.seconds
      } as ResultRow;
    });
    setRows(data);
    setLoading(false);
  };

  const columns = [
    { field: 'bib', headerName: 'Startnr', width: 80 },
    {
      field: 'totalTime', headerName: 'Tid', width: 120, sortable: true,
      valueGetter: (p: any) => p.row.totalTimeSeconds,
      renderCell: (p: any) => p.row.totalTimeDisplay
    },
    {
      field: 'totalAGTime', headerName: 'AG Tid', width: 120, sortable: true,
      valueGetter: (p: any) => p.row.totalAGTimeSeconds || 0,
      renderCell: (p: any) => p.row.totalAGTimeDisplay || '-'
    },
    {
      field: 'totalAGGTime', headerName: 'AGG Tid', width: 120, sortable: true,
      valueGetter: (p: any) => p.row.totalAGGTimeSeconds || 0,
      renderCell: (p: any) => p.row.totalAGGTimeDisplay || '-'
    }
  ];

  const getStatusMessage = () => {
    switch (status) {
      case Status.incomplete:
        return 'NB: Resultatene er ufullstendige!';
      case Status.preliminary:
        return 'Resultatene er uoffisielle og kan bli gjenstand for endringer';
      case Status.final:
        return 'Resultatene er ferdige. Vennligst meld fra hvis du ser noe som er galt.';
      default:
        return '';
    }
  };

  const handlePreset = (p: string) => () => {
    setPreset(p);
    // apply filter/sort presets as needed
  };

  const handleMenuOpen = (e: MouseEvent<HTMLElement>) => setAnchorEl(e.currentTarget);
  const handleMenuClose = () => setAnchorEl(null);

  const exportCsv = (delim: string) => {
    const headers = columns.map(c => c.headerName).join(delim);
    const lines = rows.map(r => [r.bib, r.totalTimeDisplay, r.totalAGTimeDisplay, r.totalAGGTimeDisplay].join(delim));
    const csv = [headers, ...lines].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    saveAs(blob, `resultater-${preset}.csv`);
    handleMenuClose();
  };

  return (
    <Box p={2}>
      <Typography variant="h5">Race Results</Typography>
      <Typography color={status === Status.final ? 'primary' : status === Status.incomplete ? 'error' : 'info'} gutterBottom>
        {getStatusMessage()}
      </Typography>
      <Box sx={{ mb: 1 }}>
        <Button variant={preset==='default'?'contained':'outlined'} onClick={handlePreset('default')}>Standard visning</Button>
        <Button variant={preset==='nfif'?'contained':'outlined'} onClick={handlePreset('nfif')} sx={{ ml:1 }}>NFIF-rapport</Button>
        <Button onClick={handleMenuOpen} sx={{ ml:2 }}>Last ned</Button>
        <Menu anchorEl={anchorEl} open={!!anchorEl} onClose={handleMenuClose}>
          <MenuItem onClick={() => exportCsv(',')}>Comma (,)</MenuItem>
          <MenuItem onClick={() => exportCsv(';')}>Semicolon (;)</MenuItem>
        </Menu>
      </Box>
      {loading ? <CircularProgress /> : (
        <div style={{ height: 600, width: '100%' }}>
          <DataGrid rows={rows} columns={columns} components={{ Toolbar: GridToolbar }} />
        </div>
      )}
    </Box>
  );
};

export default ResultsPage;
