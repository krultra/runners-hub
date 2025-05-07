import React, { useState, useEffect } from 'react';
import { getFirestore, collection, getDocs, doc, getDoc } from 'firebase/firestore';
import { 
  DataGrid, 
  GridToolbar, 
  GridColDef,
  GridValueGetterParams,
  GridRenderCellParams
} from '@mui/x-data-grid';
import { 
  Box, 
  Typography, 
  Button, 
  CircularProgress, 
  Paper,
  Tooltip,
  IconButton,
  Alert
} from '@mui/material';
import InfoIcon from '@mui/icons-material/Info';
import { saveAs } from 'file-saver';

// Enhanced participant data model
interface Participant {
  id: string;
  bib: number;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  gender: string;
  club?: string;
  class?: string;
  totalTimeDisplay: string;
  totalTimeSeconds: number;
  totalAGTimeDisplay?: string;
  totalAGTimeSeconds?: number;
  totalAGGTimeDisplay?: string;
  totalAGGTimeSeconds?: number;
  scratchPlace?: number;
  genderPlace?: number;
  agPlace?: number;
  aggPlace?: number;
}

enum Status {
  notStarted = 'notStarted',
  ongoing = 'ongoing',
  waiting = 'waiting',
  incomplete = 'incomplete',
  preliminary = 'preliminary',
  unofficial = 'unofficial',
  final = 'final',
  cancelled = 'cancelled'
}

const ResultsPage: React.FC = () => {
  const [status, setStatus] = useState<Status>(Status.incomplete);
  const [rows, setRows] = useState<Participant[]>([]);
  const [loading, setLoading] = useState(true);
  const [preset, setPreset] = useState<string>('default');
  const [eventName, setEventName] = useState<string>('Malvikingen Opp 2025');
  const [resultTypes, setResultTypes] = useState<string[]>([]);
  const [columns, setColumns] = useState<GridColDef[]>([]);
  const [visibleColumns, setVisibleColumns] = useState<string[]>([]);
  const [sortModel, setSortModel] = useState<any[]>([]);
  const [filterModel, setFilterModel] = useState<any>({ items: [] });
  // These state variables are planned for future filter/export functionality
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [filterActive, setFilterActive] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [columnSelectActive, setColumnSelectActive] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [exportActive, setExportActive] = useState(false);
  const [presetConfig, setPresetConfig] = useState<Record<string, any>>({});

  // Function to determine age from birth date
  const getAge = (dob: string) => {
    if (!dob) return '';
    const yearMatch = dob.match(/(\d{4})$/);
    if (!yearMatch) return '';
    return new Date().getFullYear() - Number(yearMatch[1]);
  };

  // Format time for Excel (using comma as decimal separator)
  const formatExcelTime = (timeStr: string) => {
    if (!timeStr) return '';
    return timeStr.replace('.', ',');
  };

  // Calculate placements for different categories
  const calculatePlacements = (participants: Participant[], resultTypes: string[]): Participant[] => {
    const withPlacements = [...participants];

    // Scratch places (overall by raw time)
    withPlacements.sort((a, b) => a.totalTimeSeconds - b.totalTimeSeconds);
    withPlacements.forEach((p, i) => { p.scratchPlace = i + 1; });

    // Gender places
    // Now calculated within each gender group but without separate filtering in UI
    const byGender = withPlacements.reduce((acc, p) => {
      if (!acc[p.gender]) acc[p.gender] = [];
      acc[p.gender].push(p);
      return acc;
    }, {} as Record<string, Participant[]>);
    
    // Sort and assign places within each gender group
    Object.values(byGender).forEach(group => {
      group.sort((a, b) => a.totalTimeSeconds - b.totalTimeSeconds);
      group.forEach((p, i) => { p.genderPlace = i + 1; });
    });

    // Age-graded places (if in resultTypes) - consolidated for all participants
    if (resultTypes.includes('AG')) {
      // Get all participants with AG times
      const withAGTimes = withPlacements.filter(p => p.totalAGTimeSeconds);
      
      // Sort by AG time
      withAGTimes.sort((a, b) => (a.totalAGTimeSeconds || 999999) - (b.totalAGTimeSeconds || 999999));
      
      // Assign AG places
      withAGTimes.forEach((p, i) => { p.agPlace = i + 1; });
    }

    // Age-and-gender-graded places (if in resultTypes)
    if (resultTypes.includes('AGG')) {
      const withAGG = withPlacements.filter(p => p.totalAGGTimeSeconds);
      withAGG.sort((a, b) => (a.totalAGGTimeSeconds || 999999) - (b.totalAGGTimeSeconds || 999999));
      withAGG.forEach((p, i) => { p.aggPlace = i + 1; });
    }

    return withPlacements;
  };

  useEffect(() => { 
    fetchData(); 
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchData = async () => {
    try {
      const db = getFirestore();
      
      // Fetch event data
      const edSnap = await getDoc(doc(db, 'eventEditions', 'mo-2025'));
      const edData = edSnap.data();
      if (!edData) {
        setLoading(false);
        return;
      }
      
      const rs = (edData.resultsStatus as Status) || Status.incomplete;
      setStatus(rs);
      setEventName(edData.name || 'Malvikingen Opp 2025');
      setResultTypes(edData.resultTypes || []);

      // Fetch timing data
      const timingSnap = await getDocs(collection(db, 'moTiming'));
      const timingData = timingSnap.docs.map(d => ({ 
        id: d.id, 
        ...d.data() 
      }));

      // Fetch registration data
      const regSnap = await getDocs(collection(db, 'moRegistrations'));
      const regData = regSnap.docs.reduce((acc, doc) => {
        const data = doc.data();
        if (data.registrationNumber) {
          acc[data.registrationNumber] = data;
        }
        return acc;
      }, {} as Record<string, any>);

      // Combine timing and registration data
      const participants = timingData.map((t: any) => {
        const reg = regData[t.bib] || {};
        
        // Handle either format of totalTime (object or array)
        let totalTimeDisplay = '', totalTimeSeconds = 0;
        if (t.totalTime) {
          if (typeof t.totalTime === 'object' && 'display' in t.totalTime) {
            totalTimeDisplay = t.totalTime.display;
            totalTimeSeconds = t.totalTime.seconds;
          } else if (Array.isArray(t.totalTime) && t.totalTime.length === 2) {
            totalTimeDisplay = t.totalTime[0];
            totalTimeSeconds = t.totalTime[1];
          }
        }

        // Handle AG time
        let totalAGTimeDisplay = '', totalAGTimeSeconds = 0;
        if (t.totalAGTime) {
          if (Array.isArray(t.totalAGTime) && t.totalAGTime.length === 2) {
            totalAGTimeDisplay = t.totalAGTime[0];
            totalAGTimeSeconds = t.totalAGTime[1];
          } else if (typeof t.totalAGTime === 'object' && 'display' in t.totalAGTime) {
            totalAGTimeDisplay = t.totalAGTime.display;
            totalAGTimeSeconds = t.totalAGTime.seconds;
          }
        }

        // Handle AGG time
        let totalAGGTimeDisplay = '', totalAGGTimeSeconds = 0;
        if (t.totalAGGTime) {
          if (Array.isArray(t.totalAGGTime) && t.totalAGGTime.length === 2) {
            totalAGGTimeDisplay = t.totalAGGTime[0];
            totalAGGTimeSeconds = t.totalAGGTime[1];
          } else if (typeof t.totalAGGTime === 'object' && 'display' in t.totalAGGTime) {
            totalAGGTimeDisplay = t.totalAGGTime.display;
            totalAGGTimeSeconds = t.totalAGGTime.seconds;
          }
        }
        
        return {
          id: t.id,
          bib: t.bib,
          firstName: reg.firstName || '',
          lastName: reg.lastName || '',
          dateOfBirth: reg.dateOfBirth || '',
          gender: reg.gender || '',
          club: reg.club || '',
          class: reg.class || '',
          totalTimeDisplay,
          totalTimeSeconds,
          totalAGTimeDisplay,
          totalAGTimeSeconds,
          totalAGGTimeDisplay,
          totalAGGTimeSeconds
        } as Participant;
      });

      // Calculate placements
      const participantsWithPlaces = calculatePlacements(participants, edData.resultTypes || []);
      setRows(participantsWithPlaces);

      // Define preset configurations
      const presets: Record<string, any> = {
        default: {
          label: 'Standard visning',
          columns: [
            'scratchPlace', 'bib', 'firstName', 'lastName', 'gender', 
            'club', 'age', 'totalTime'
          ],
          sort: [{ field: 'scratchPlace', sort: 'asc' }]
        },
        nfif: {
          label: 'NFIF-rapport',
          columns: [
            'scratchPlace', 'bib', 'firstName', 'lastName', 'dateOfBirth', 'gender', 
            'club', 'class', 'totalTime'
          ],
          sort: [{ field: 'scratchPlace', sort: 'asc' }]
        },
        // Gender-specific presets removed
      };

      // If AG is available
      if (edData.resultTypes?.includes('AG')) {
        // Single AG preset that includes all participants
        presets.ag = {
          label: 'Aldersgradert',
          columns: [
            'agPlace', 'bib', 'firstName', 'lastName', 'gender',
            'age', 'club', 'totalTime', 'totalAGTime'
          ],
          sort: [{ field: 'agPlace', sort: 'asc' }]
        };
      }
      
      // If AGG is available, add an AGG preset
      if (edData.resultTypes?.includes('AGG')) {
        presets.agg = {
          label: 'Alle-mot-alle',
          columns: [
            'aggPlace', 'bib', 'firstName', 'lastName', 'gender', 
            'age', 'club', 'totalTime', 'totalAGGTime'
          ],
          sort: [{ field: 'aggPlace', sort: 'asc' }]
        };
      }

      setPresetConfig(presets);

      // Build columns based on available data and resultTypes
      const columnDefs: GridColDef[] = [
        { 
          field: 'scratchPlace', 
          headerName: 'Plass', 
          width: 80,
          headerAlign: 'center',
          align: 'center'
        },
        { 
          field: 'bib', 
          headerName: 'Snr', 
          width: 70,
          headerAlign: 'center',
          align: 'center',
          description: 'Startnummer'
        },
        { 
          field: 'firstName', 
          headerName: 'Fornavn', 
          width: 120 
        },
        { 
          field: 'lastName', 
          headerName: 'Etternavn', 
          width: 120 
        },
        { 
          field: 'gender', 
          headerName: 'Kjønn', 
          width: 70,
          headerAlign: 'center',
          align: 'center'
        },
        { 
          field: 'club', 
          headerName: 'Klubb', 
          width: 150 
        },
        { 
          field: 'age', 
          headerName: 'Alder', 
          width: 80,
          valueGetter: (params: GridValueGetterParams) => getAge(params.row.dateOfBirth),
          headerAlign: 'center',
          align: 'center'
        },
        {
          field: 'genderPlace',
          headerName: 'Plass (Kjønn)',
          width: 110,
          headerAlign: 'center',
          align: 'center',
          valueFormatter: (params) => params.value ? `${params.value}.` : ''
        },
        { 
          field: 'totalTime', 
          headerName: 'Tid',
          width: 100,
          sortable: true,
          valueGetter: (params: GridValueGetterParams) => params.row.totalTimeSeconds,
          renderCell: (params: GridRenderCellParams) => params.row.totalTimeDisplay,
          headerAlign: 'center',
          align: 'center'
        }
      ];

      // Add AG time columns if applicable
      if (edData.resultTypes?.includes('AG')) {
        columnDefs.push(
          {
            field: 'agPlace',
            headerName: 'AG Plass',
            width: 90,
            headerAlign: 'center',
            align: 'center',
            valueFormatter: (params) => params.value ? `${params.value}.` : '',
            description: 'Aldersgradert plassering'
          },
          {
            field: 'totalAGTime',
            headerName: 'AG Tid',
            width: 100,
            sortable: true,
            valueGetter: (params: GridValueGetterParams) => params.row.totalAGTimeSeconds || 999999,
            renderCell: (params: GridRenderCellParams) => params.row.totalAGTimeDisplay || '-',
            headerAlign: 'center',
            align: 'center',
            description: 'Aldersgradert tid'
          }
        );
      }

      // Add AGG time columns if applicable
      if (edData.resultTypes?.includes('AGG')) {
        columnDefs.push(
          {
            field: 'aggPlace',
            headerName: 'AGG Plass',
            width: 90,
            headerAlign: 'center',
            align: 'center',
            valueFormatter: (params) => params.value ? `${params.value}.` : '',
            description: 'Alders- og kjønnsgradert plassering'
          },
          {
            field: 'totalAGGTime',
            headerName: 'AGG Tid',
            width: 100,
            sortable: true,
            valueGetter: (params: GridValueGetterParams) => params.row.totalAGGTimeSeconds || 999999,
            renderCell: (params: GridRenderCellParams) => params.row.totalAGGTimeDisplay || '-',
            headerAlign: 'center',
            align: 'center',
            description: 'Alders- og kjønnsgradert tid'
          }
        );
      }
      
      setColumns(columnDefs);
      
      // Set initial visible columns based on default preset
      if (presets.default) {
        setVisibleColumns(presets.default.columns);
        setSortModel(presets.default.sort);
      } else {
        setVisibleColumns(columnDefs.map(c => c.field as string));
      }
      
      // Apply default preset
      handlePreset('default')();
      
      setLoading(false);
    } catch (error) {
      console.error('Error fetching data:', error);
      setLoading(false);
    }
  };

  const getStatusMessage = () => {
    switch (status) {
      case Status.notStarted:
        return 'Løpet er ikke startet ennå.';
      case Status.ongoing:
        return 'Løpet pågår.';
      case Status.waiting:
        return 'Resultatene er i gang med å bli registrert og kan bli gjenstand for endringer';
      case Status.incomplete:
        return 'NB: Resultatene er ufullstendige!';
      case Status.preliminary:
        return 'NB: Resultatene er foreløpige og kan bli gjenstand for endringer';
      case Status.unofficial:
        return 'NB: Resultatene er uoffisielle og kan bli gjenstand for endringer';
      case Status.final:
        return 'Resultatene er ferdige. Vennligst meld fra hvis du ser noe som er galt.';
      case Status.cancelled:
        return 'Løpet er kansellert.';
      default:
        return 'Vennligst meld fra hvis du mener noe er galt.';
    }
  };

  const handlePreset = (p: string) => () => {
    if (!presetConfig[p]) return;
    
    // Make sure we're not in the same state - this prevents double-clicking issues
    if (preset === p) return;
    
    setPreset(p);
    
    // Apply column visibility
    setVisibleColumns(presetConfig[p].columns);
    
    // Apply sorting
    setSortModel(presetConfig[p].sort);
    
    // Apply filtering if any
    if (presetConfig[p].filter) {
      // Create proper filter model structure that DataGrid expects
      const newFilterModel = {
        items: Object.entries(presetConfig[p].filter).map(([field, value]) => ({
          id: Math.random().toString(36).substring(2, 9), // Generate unique ID
          field,
          operator: 'equals',
          value
        }))
      };
      
      // Set the filter model with correct structure
      setFilterModel(newFilterModel);
    } else {
      // Clear filters
      setFilterModel({ items: [] });
    }
  };

  // Function for future filter panel implementation
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const closeFilterPanel = () => {
    setFilterActive(false);
    setColumnSelectActive(false);
    setExportActive(false);
    
    // When any filter or column change is made, deselect all preset buttons
    setPreset('');
  };

  const exportCsv = () => {
    // Get visible columns first
    const visibleColumnDefs = columns.filter(col => visibleColumns.includes(col.field as string));

    // Format data according to NFIF or standard format
    let headers: string[] = [];
    let csvRows: string[][] = [];
    
    if (preset === 'nfif') {
      headers = [
        'Startnummer', 'Fornavn', 'Etternavn', 'Fødselsdato', 'Kjønn', 
        'Klubb', 'Klasse', 'Starttid', 'Punkt', 'Slutttid', 'ExitStatus', 'Plassering'
      ];
      
      csvRows = rows.map(r => [
        String(r.bib),
        r.firstName,
        r.lastName,
        r.dateOfBirth,
        r.gender,
        r.club || '',
        r.class || '',
        '', // Starttid
        '', // Punkt
        formatExcelTime(r.totalTimeDisplay), // Slutttid - formatted for Excel
        '', // ExitStatus
        String(r.scratchPlace || '')
      ]);
    } else {
      // Get header names from visible columns
      headers = visibleColumnDefs.map(col => col.headerName || col.field as string);
      
      // Map row data according to visible columns and current sort
      csvRows = rows.map(row => {
        return visibleColumnDefs.map(col => {
          const field = col.field as string;
          if (field === 'totalTime') return formatExcelTime(row.totalTimeDisplay);
          if (field === 'totalAGTime') return formatExcelTime(row.totalAGTimeDisplay || '');
          if (field === 'totalAGGTime') return formatExcelTime(row.totalAGGTimeDisplay || '');
          if (field === 'age') return String(getAge(row.dateOfBirth));
          
          // Handle default fields
          if (field === 'scratchPlace' || field === 'genderPlace' || field === 'agPlace' || field === 'aggPlace') {
            return row[field] ? `${row[field]}.` : '';
          }
          
          return String(row[field as keyof Participant] || '');
        });
      });
    }
    
    // Generate CSV content with semicolon delimiter
    const csv = [
      headers.join(';'),
      ...csvRows.map(row => row.join(';'))
    ].join('\n');
    
    // Create blob and save file
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    saveAs(blob, `resultater-${eventName.replace(/\s+/g, '-').toLowerCase()}.csv`);
  };

  return (
    <Box p={2}>
      <Typography variant="h4" gutterBottom>{eventName}</Typography>
      
      <Paper elevation={1} sx={{ p: 2, mb: 2 }}>
        <Alert severity={
          status === Status.notStarted ? 'info' : 
          status === Status.ongoing ? 'info' : 
          status === Status.waiting ? 'warning' : 
          status === Status.incomplete ? 'warning' : 
          status === Status.unofficial ? 'warning' : 
          status === Status.final ? 'success' : 
          status === Status.preliminary ? 'warning' : 
          status === Status.cancelled ? 'error' : 'warning'} sx={{ mb: 2 }}>
          {getStatusMessage()}
        </Alert>
        
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Velg en forhåndsdefinert visning eller tilpass filtrering, kolonner og sortering selv.
        </Typography>
        
        <Box sx={{ mb: 1, display: 'flex', flexWrap: 'wrap', gap: 1 }}>
          <Button variant={preset==='default'?'contained':'outlined'} onClick={handlePreset('default')}>Standard visning</Button>
          {/* Gender-specific buttons removed */}
          {resultTypes.includes('AG') && (
            <Button variant={preset==='ag'?'contained':'outlined'} onClick={handlePreset('ag')}>Aldersgradert</Button>
          )}
          {resultTypes.includes('AGG') && (
            <Button variant={preset==='agg'?'contained':'outlined'} onClick={handlePreset('agg')}>Alle-mot-alle</Button>
          )}
          <Button variant={preset==='nfif'?'contained':'outlined'} onClick={handlePreset('nfif')}>NFIF-rapport</Button>
          <Button variant="outlined" color="primary" onClick={exportCsv} sx={{ ml: 'auto' }}>Last ned CSV</Button>
        </Box>
      </Paper>
      
      {loading ? <CircularProgress /> : (
        <>
          <Paper elevation={1} sx={{ height: 600, width: '100%', mb: 2 }}>
            <DataGrid 
              rows={rows} 
              columns={columns}
              columnVisibilityModel={Object.fromEntries(
                columns.map(col => [col.field, visibleColumns.includes(col.field as string)])
              )}
              filterModel={filterModel}
              onFilterModelChange={(model) => {
                // Always update the filter model
                setFilterModel(model);
                
                // Check if we need to deselect the preset
                if (preset) {
                  const presetFilter = presetConfig[preset]?.filter;
                  
                  if (presetFilter) {
                    // Get all current filter values as a map
                    const currentFilterValues: Record<string, any> = {};
                    model.items.forEach((item: any) => {
                      if (item.field && item.value !== undefined) {
                        currentFilterValues[item.field] = item.value;
                      }
                    });
                    
                    // Check if current filters match preset filters
                    const filtersMatch = Object.entries(presetFilter).every(
                      ([field, value]) => currentFilterValues[field] === value
                    );
                    
                    // Only if filters don't match, reset the preset
                    if (!filtersMatch) {
                      setPreset('');
                    }
                  } else if (model.items.length > 0) {
                    // If preset has no filter but user added filters, deselect preset
                    setPreset('');
                  }
                }
              }}
              sortModel={sortModel}
              onSortModelChange={(model) => {
                setSortModel(model);
                setPreset(''); // Deselect preset buttons when sorting changes
              }}
              onColumnVisibilityModelChange={(model) => {
                setVisibleColumns(Object.entries(model)
                  .filter(([_, isVisible]) => isVisible)
                  .map(([field]) => field));
                setPreset(''); // Deselect preset buttons when columns change
              }}
              // Using the standard toolbar component
              components={{ 
                Toolbar: () => {
                  return (
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0' }}>
                      <GridToolbar />
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <Button 
                          size="small"
                          onClick={() => {
                            // Select all columns
                            const allColumns = columns.map(col => col.field as string);
                            setVisibleColumns(allColumns);
                          }}
                        >
                          Vis alle kolonner
                        </Button>
                        <Button 
                          size="small"
                          onClick={() => {
                            // Hide all except essential columns
                            setVisibleColumns(['bib', 'firstName', 'lastName']);
                          }}
                        >
                          Skjul fleste kolonner
                        </Button>
                      </div>
                    </div>
                  );
                }
              }}
              pageSize={25}
              rowsPerPageOptions={[25, 50, 100]}
              disableSelectionOnClick
                localeText={{
                columnMenuLabel: "Meny",
                columnMenuShowColumns: "Vis kolonner",
                columnMenuFilter: "Filter",
                columnMenuHideColumn: "Skjul",
                columnMenuUnsort: "Fjern sortering",
                columnMenuSortAsc: "Sorter stigende",
                columnMenuSortDesc: "Sorter synkende",
                
                // Toolbar
                toolbarDensity: "Tetthet",
                toolbarExport: "Eksport",
                toolbarExportLabel: "Eksport",
                toolbarExportCSV: "Last ned CSV",
                toolbarExportPrint: "Skriv ut",
                toolbarColumns: "Kolonner",
                toolbarFilters: "Filtre",
                
                // Column selector
                columnsPanelTextFieldLabel: "Finn kolonne",
                columnsPanelTextFieldPlaceholder: "Søk...",
                columnsPanelDragIconLabel: "Endre rekkefølge",
                // columnsPanelShowAllButton: "Vis alle",
                // columnsPanelHideAllButton: "Skjul alle"
              }}
            />
          </Paper>
          
          <Paper elevation={1} sx={{ p: 2 }}>
            <Typography variant="h6" gutterBottom>Forklaringer</Typography>
            <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
              <Box>
                <Typography variant="body2">
                  <strong>Snr</strong> - Startnummer
                </Typography>
              </Box>
              
              {resultTypes.includes('AG') && (
                <Box>
                  <Typography variant="body2">
                    <strong>AG</strong> - Aldersgradert
                    <Tooltip title="Aldersgradert betyr at tiden er justert basert på deltakerens alder innenfor samme kjønn.">
                      <IconButton size="small">
                        <InfoIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </Typography>
                </Box>
              )}
              
              {resultTypes.includes('AGG') && (
                <Box>
                  <Typography variant="body2">
                    <strong>AGG</strong> - Alders- og kjønnsgradert
                    <Tooltip title="Alders- og kjønnsgradert betyr at tiden er justert basert på både alder og kjønn, slik at alle deltakere konkurrerer på like vilkår.">
                      <IconButton size="small">
                        <InfoIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </Typography>
                </Box>
              )}
            </Box>
          </Paper>
        </>
      )}
    </Box>
  );
};

export default ResultsPage;
