import React, { useState, useEffect, SyntheticEvent, useCallback } from 'react';
import { useEventEdition } from '../contexts/EventEditionContext';
import { getEventResults } from '../services/resultsService';
import { 
  DataGrid, 
  GridToolbar, 
  GridColDef,
  GridSortModel,
  GridColumnVisibilityModel,
  GridValueFormatterParams,
} from '@mui/x-data-grid';
import { 
  Box, 
  Typography, 
  Button, 
  CircularProgress, 
  Paper,
  Tooltip,
  IconButton,
  Alert,
  Tabs,
  Tab,
  Stack
} from '@mui/material';
import { Info } from 'lucide-react';
import { saveAs } from 'file-saver';

// Status enum for race status display
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

// Enhanced participant data model
interface Participant {
  id: string;
  bib: number;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  gender: 'M' | 'K' | '*' | string;
  club?: string;
  class?: string;
  registrationType?: 'competition' | 'recreational' | 'timed_recreational';
  totalTimeDisplay: string;
  totalTimeSeconds: number;
  totalAGTimeDisplay?: string;
  totalAGTimeSeconds?: number;
  totalAGGTimeDisplay?: string;
  totalAGGTimeSeconds?: number;
  scratchPlace?: number | 'Trim';
  genderPlace?: number;
  agPlace?: number;
  aggPlace?: number;
  age?: number;
}

// Event edition data interface
interface EventEditionData {
  name?: string;
  date?: string;
  status?: string;
  resultTypes?: string[];
  participants?: Participant[];
}

// Tab panel props interface
interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

// Tab panel component for showing content based on selected tab
function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`results-tabpanel-${index}`}
      aria-labelledby={`results-tab-${index}`}
      {...other}
    >
      {value === index && (
        <Box sx={{ pt: 2 }}>
          {children}
        </Box>
      )}
    </div>
  );
}

// Function to get accessible props for tabs
function a11yProps(index: number) {
  return {
    id: `results-tab-${index}`,
    'aria-controls': `results-tabpanel-${index}`,
  };
}

// Main ResultsPage component
const ResultsPage = () => {
  // Get event edition from context
  const { event: contextEvent } = useEventEdition();
  
  // State variables
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [eventEditionData, setEventEditionData] = useState<EventEditionData>({});
  const [status, setStatus] = useState<Status>(Status.notStarted);
  
  // Participants state
  const [competitiveParticipants, setCompetitiveParticipants] = useState<Participant[]>([]);
  const [timedRecreationalParticipants, setTimedRecreationalParticipants] = useState<Participant[]>([]);
  const [recreationalParticipants, setRecreationalParticipants] = useState<Participant[]>([]);
  
  // DataGrid state
  const [competitiveColumnVisibility, setCompetitiveColumnVisibility] = useState<GridColumnVisibilityModel>({});
  const [timedRecreationalColumnVisibility, setTimedRecreationalColumnVisibility] = useState<GridColumnVisibilityModel>({});
  const [recreationalColumnVisibility, setRecreationalColumnVisibility] = useState<GridColumnVisibilityModel>({});
  
  const [competitiveSortModel, setCompetitiveSortModel] = useState<GridSortModel>([]);
  const [timedRecreationalSortModel, setTimedRecreationalSortModel] = useState<GridSortModel>([]);
  const [recreationalSortModel, setRecreationalSortModel] = useState<GridSortModel>([]);
  
  // Tab state
  const [tabValue, setTabValue] = useState(0);

  // Format time for Excel (using comma as decimal separator)
  const formatExcelTime = (timeStr: string): string => {
    if (!timeStr) return '';
    return timeStr.replace('.', ',');
  };

  // Categorize participants into competitive, timed recreational, and non-timed recreational
  const categorizeParticipants = useCallback((participants: Participant[]): void => {
    if (!participants || participants.length === 0) return;
    
    // Competitive participants (has registrationType === 'competition')
    const competitive = participants.filter(p => p.registrationType === 'competition');
    
    // Timed recreational participants (has registrationType === 'timed_recreational')
    const timedRec = participants.filter(p => p.registrationType === 'timed_recreational');
    
    // Recreational participants without timing (has registrationType === 'recreational')
    const recreational = participants.filter(p => p.registrationType === 'recreational');
    
    // Sort competitive participants by their pre-calculated placements
    // Participants with times first, sorted by placement, followed by those without times
    competitive.sort((a, b) => {
      // Check if participants have timing data (times)
      const aHasTime = a.totalTimeDisplay && a.totalTimeDisplay.length > 0;
      const bHasTime = b.totalTimeDisplay && b.totalTimeDisplay.length > 0;
      
      // If one has time and the other doesn't, the one with time comes first
      if (aHasTime && !bHasTime) return -1;
      if (!aHasTime && bHasTime) return 1;
      
      // If both have times or both don't have times, sort by placement
      const aPlace = typeof a.scratchPlace === 'number' ? a.scratchPlace : Number.MAX_SAFE_INTEGER;
      const bPlace = typeof b.scratchPlace === 'number' ? b.scratchPlace : Number.MAX_SAFE_INTEGER;
      return aPlace - bPlace;
    });
    
    // Sort recreational participants alphabetically
    const sortAlphabetically = (a: Participant, b: Participant) => {
      const lastNameComp = a.lastName.localeCompare(b.lastName);
      return lastNameComp !== 0 ? lastNameComp : a.firstName.localeCompare(b.firstName);
    };
    
    timedRec.sort(sortAlphabetically);
    recreational.sort(sortAlphabetically);
    
    // Update state
    setCompetitiveParticipants(competitive);
    setTimedRecreationalParticipants(timedRec);
    setRecreationalParticipants(recreational);
  }, [setCompetitiveParticipants, setTimedRecreationalParticipants, setRecreationalParticipants]);
  
  // Handle tab change
  const handleTabChange = (_event: SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  // Main effect for data fetching
  useEffect(() => {
    const fetchData = async () => {
      try {
        if (!contextEvent?.id) return;
        
        setLoading(true);
        setError(null);
        
        // Get event edition ID from URL path, query parameters, or context
        let editionId;
        
        // First check if the ID is in the URL path (e.g., /results/mo-2025)
        const pathParts = window.location.pathname.split('/');
        if (pathParts.length > 0) {
          const lastPathSegment = pathParts[pathParts.length - 1];
          // If the last segment looks like an event ID (contains letters and possibly a hyphen)
          if (lastPathSegment && /^[a-zA-Z0-9]+-\d+$/.test(lastPathSegment)) {
            editionId = lastPathSegment;
            console.log(`Found event ID in URL path: ${editionId}`);
          }
        }
        
        // If not found in the path, check query parameters
        if (!editionId) {
          const urlParams = new URLSearchParams(window.location.search);
          editionId = urlParams.get('id');
          if (editionId) {
            console.log(`Found event ID in query parameter: ${editionId}`);
          }
        }
        
        // If still not found, try context
        if (!editionId && contextEvent) {
          editionId = contextEvent.id;
          console.log(`Using event ID from context: ${editionId}`);
        }
        
        if (!editionId) {
          setError('No event edition specified. Please select an event from the main page.');
          setLoading(false);
          return;
        }
        
        // Fetch event results using our service function
        const { eventData, participants } = await getEventResults(editionId);
        
        if (!eventData) {
          setError('Event edition not found. Please check the URL and try again.');
          setLoading(false);
          return;
        }
        
        setEventEditionData(eventData);
        
        // Set status
        if (eventData.status) {
          setStatus(eventData.status as Status);
        }
        
        // If there are no participants, just return
        if (!participants || participants.length === 0) {
          setLoading(false);
          return; // No error, just no participants yet
        }
        
        // Categorize participants
        categorizeParticipants(participants);
        
        // Set up default column visibility for competitive participants
        setCompetitiveColumnVisibility({
          bib: true,
          scratchPlace: true,
          firstName: true,
          lastName: true,
          genderDisplay: true, // Updated from gender to genderDisplay
          age: true,
          club: true,
          class: true,
          totalTimeDisplay: true,
          ...(eventData.resultTypes?.includes('AG') ? { totalAGTimeDisplay: true, agPlace: true } : {}),
          ...(eventData.resultTypes?.includes('AGG') ? { totalAGGTimeDisplay: true, aggPlace: true } : {})
        });
        
        // Set up default column visibility for timed recreational participants
        setTimedRecreationalColumnVisibility({
          bib: true,
          firstName: true,
          lastName: true,
          age: true,
          club: true,
          class: true,
          totalTimeDisplay: true
        });
        
        // Set up default column visibility for recreational participants
        setRecreationalColumnVisibility({
          bib: true,
          firstName: true,
          lastName: true,
          club: true,
          class: true
        });
        
        // Only include competitors that have timing data
        // Filter out participants without timing data entirely
        const competitiveWithPlacement = participants.filter(p => 
          p.registrationType === 'competition' && 
          p.totalTimeDisplay && 
          p.totalTimeDisplay.length > 0
        );
        
        // Update state with our sorted competitors
        setCompetitiveParticipants(competitiveWithPlacement);
        
        // Use simple placement-based sorting
        setCompetitiveSortModel([
          { field: 'scratchPlace', sort: 'asc' }
        ]);
        
        // Set default sort model for recreational participants
        setTimedRecreationalSortModel([{ field: 'lastName', sort: 'asc' }]);
        setRecreationalSortModel([{ field: 'lastName', sort: 'asc' }]);
        
        setLoading(false);
      } catch (error) {
        console.error('Error fetching data:', error);
        setError('Failed to load results. Please try again later.');
        setLoading(false);
      }
    };
    
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contextEvent]);

  // Export data to CSV
  const exportCsv = (participants: Participant[], fileName: string) => {
    // Base headers for CSV
    let headers = [
      'Startnummer', 'Fornavn', 'Etternavn', 'Fødselsdato', 'Klubb', 'Klasse'
    ];
    
    // Add type-specific headers
    if (fileName.includes('_konkurranse')) {
      headers = [
        ...headers,
        'Kjønn', 'Tid', 'Plassering',
        ...(eventEditionData.resultTypes?.includes('AG') ? ['AG Tid', 'AG Plassering'] : []),
        ...(eventEditionData.resultTypes?.includes('AGG') ? ['AGG Tid', 'AGG Plassering'] : [])
      ];
    } else if (fileName.includes('_trim')) {
      headers = [...headers, 'Tid'];
    }
    
    // Format data rows based on participant type
    const csvRows = participants.map(p => {
      // Base fields for all participant types
      const baseFields = [
        String(p.bib),
        p.firstName,
        p.lastName,
        p.dateOfBirth,
        p.club || '',
        p.class || ''
      ];
      
      // Add type-specific fields
      if (fileName.includes('_konkurranse')) {
        return [
          ...baseFields,
          p.gender || '',
          formatExcelTime(p.totalTimeDisplay || ''),
          typeof p.scratchPlace === 'number' ? String(p.scratchPlace) : '',
          ...(eventEditionData.resultTypes?.includes('AG') ? [formatExcelTime(p.totalAGTimeDisplay || ''), String(p.agPlace || '')] : []),
          ...(eventEditionData.resultTypes?.includes('AGG') ? [formatExcelTime(p.totalAGGTimeDisplay || ''), String(p.aggPlace || '')] : [])
        ];
      } else if (fileName.includes('_trim')) {
        return [
          ...baseFields,
          formatExcelTime(p.totalTimeDisplay || '')
        ];
      } else {
        // For tur participants (non-timed)
        return baseFields;
      }
    });
    
    // Add headers
    csvRows.unshift(headers);
    
    // Convert to CSV format
    const csvContent = csvRows.map(row => row.map(cell => {
      // Escape quotes and wrap in quotes if the cell contains a comma
      const escapedCell = String(cell || '').replace(/"/g, '""');
      return cell && String(cell).includes(',') ? `"${escapedCell}"` : escapedCell;
    }).join(',')).join('\n');
    
    // Create blob and save file
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8' });
    saveAs(blob, `${fileName}.csv`);
  };

  // Get status message
  const getStatusMessage = (): string => {
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

  // Define columns for competitive participants
  const competitiveColumns: GridColDef[] = [
    { 
      field: 'scratchPlace', 
      headerName: 'Plass', 
      width: 80,
      headerAlign: 'center',
      align: 'center',
      valueFormatter: (params: GridValueFormatterParams) => {
        return params.value ? `${params.value}.` : '';
      }
    },
    { 
      field: 'bib', 
      headerName: 'Snr', 
      width: 70,
      headerAlign: 'center',
      align: 'center'
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
    // Use a computed column for display to handle gender filtering properly
    { 
      field: 'genderDisplay', 
      headerName: 'Kjønn', 
      width: 70,
      headerAlign: 'center',
      align: 'center',
      valueGetter: (params) => {
        if (params.row.gender === 'M') return 'Mann';
        if (params.row.gender === 'K') return 'Kvinne';
        return '';
      },
      // Override the filtering logic to filter on the original gender field
      filterOperators: [
        {
          label: 'er',
          value: 'equals',
          getApplyFilterFn: (filterItem) => {
            if (!filterItem.value) return null;
            
            // Map the filter value back to M/K
            let genderCode = filterItem.value === 'Mann' ? 'M' : 
                            filterItem.value === 'Kvinne' ? 'K' : filterItem.value;
                            
            return (params) => params.row.gender === genderCode;
          }
        }
      ]
    },
    { 
      field: 'age', 
      headerName: 'Alder', 
      width: 70,
      headerAlign: 'center',
      align: 'center',
      valueGetter: (params) => {
        // First try to get age from moRegistrations.age
        if (params.row.moRegistrations?.age) return params.row.moRegistrations.age;
        // Fall back to the participant's age field if available
        if (params.row.age) return params.row.age;
        // Otherwise return empty string
        return '';
      }
    },
    { 
      field: 'club', 
      headerName: 'Klubb', 
      width: 150 
    },
    { 
      field: 'class', 
      headerName: 'Klasse', 
      width: 100 
    },
    { 
      field: 'totalTimeDisplay', 
      headerName: 'Tid', 
      width: 100,
      headerAlign: 'center',
      align: 'center'
    }
  ];

  // Additional columns for AG/AGG if available
  if (eventEditionData.resultTypes?.includes('AG')) {
    competitiveColumns.push(
      { 
        field: 'totalAGTimeDisplay', 
        headerName: 'AG Tid', 
        width: 100,
        headerAlign: 'center',
        align: 'center',
        description: 'Aldersgradert tid'
      },
      { 
        field: 'agPlace', 
        headerName: 'AG Plass', 
        width: 100,
        headerAlign: 'center',
        align: 'center',
        description: 'Aldersgradert plassering',
        valueFormatter: (params: GridValueFormatterParams) => {
          return params.value ? `${params.value}.` : '';
        }
      }
    );
  }

  if (eventEditionData.resultTypes?.includes('AGG')) {
    competitiveColumns.push(
      { 
        field: 'totalAGGTimeDisplay', 
        headerName: 'AGG Tid', 
        width: 100,
        headerAlign: 'center',
        align: 'center',
        description: 'Alders- og kjønnsgradert tid'
      },
      { 
        field: 'aggPlace', 
        headerName: 'AGG Plass', 
        width: 100,
        headerAlign: 'center',
        align: 'center',
        description: 'Alders- og kjønnsgradert plassering',
        valueFormatter: (params: GridValueFormatterParams) => {
          return params.value ? `${params.value}.` : '';
        }
      }
    );
  }

  // Define columns for timed recreational participants
  const timedRecreationalColumns: GridColDef[] = [
    { 
      field: 'bib', 
      headerName: 'Snr', 
      width: 70,
      headerAlign: 'center',
      align: 'center'
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
    // Age column (calculated from dateOfBirth)
    { 
      field: 'age', 
      headerName: 'Alder', 
      width: 80,
      headerAlign: 'center',
      align: 'center',
      valueGetter: (params) => {
        // First try to get age from moRegistrations.age
        if (params.row.moRegistrations?.age) return params.row.moRegistrations.age;
        // Otherwise return empty string
        return '';
      }
    },
    { 
      field: 'club', 
      headerName: 'Klubb', 
      width: 150,
      valueGetter: (params) => params.row.moRegistrations?.representing || params.row.club || ''
    },
    { 
      field: 'class', 
      headerName: 'Klasse', 
      width: 100,
      valueGetter: (params) => params.row.moRegistrations?.className || params.row.moRegistrations?.class || params.row.class || ''
    },
    { 
      field: 'totalTimeDisplay', 
      headerName: 'Tid', 
      width: 100,
      headerAlign: 'center',
      align: 'center'
    }
  ];

  // Define columns for non-timed recreational participants
  const recreationalColumns: GridColDef[] = [
    { 
      field: 'bib', 
      headerName: 'Snr', 
      width: 70,
      headerAlign: 'center',
      align: 'center'
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
    // Age column (calculated from dateOfBirth)
    { 
      field: 'age', 
      headerName: 'Alder', 
      width: 80,
      headerAlign: 'center',
      align: 'center',
      valueGetter: (params) => {
        // First try to get age from moRegistrations.age
        if (params.row.moRegistrations?.age) return params.row.moRegistrations.age;
        // Otherwise return empty string
        return '';
      }
    },
    { 
      field: 'club', 
      headerName: 'Klubb', 
      width: 150,
      valueGetter: (params) => params.row.moRegistrations?.representing || params.row.club || ''
    },
    { 
      field: 'class', 
      headerName: 'Klasse', 
      width: 100,
      valueGetter: (params) => params.row.moRegistrations?.className || params.row.moRegistrations?.class || params.row.class || ''
    }
  ];

  // Render explanation panels based on available result types
  const renderExplanations = () => {
    const resultTypes = eventEditionData.resultTypes || [];
    
    return (
      <Paper elevation={1} sx={{ p: 2, mt: 2 }}>
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
                    <Info size={16} />
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
                    <Info size={16} />
                  </IconButton>
                </Tooltip>
              </Typography>
            </Box>
          )}
        </Box>
      </Paper>
    );
  };

  // Main render
  return (
    <Box sx={{ padding: 2, maxWidth: '100%', overflow: 'hidden' }}>
      <Typography variant="h4" gutterBottom>
        {eventEditionData.name || 'Resultater'}
      </Typography>
      
      {eventEditionData.date && (
        <Typography variant="subtitle1" gutterBottom>
          {new Date(eventEditionData.date).toLocaleDateString('nb-NO', { 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
          })}
        </Typography>
      )}
      
      {status && (
        <Alert 
          severity={
            status === Status.final ? 'success' : 
            status === Status.cancelled ? 'error' : 
            status === Status.incomplete || status === Status.preliminary ? 'warning' : 
            'info'
          } 
          sx={{ mb: 2 }}
        >
          {getStatusMessage()}
        </Alert>
      )}
      
      {error ? (
        <Alert severity="error">{error}</Alert>
      ) : loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
          <CircularProgress />
        </Box>
      ) : (
        <>
          <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
            <Tabs value={tabValue} onChange={handleTabChange} aria-label="results tabs">
              <Tab label="Konkurranse" {...a11yProps(0)} />
              <Tab label="Trim" {...a11yProps(1)} />
              <Tab label="Tur" {...a11yProps(2)} />
            </Tabs>
          </Box>
          
          {/* Competitive Results Tab */}
          <TabPanel value={tabValue} index={0}>
            <Stack spacing={2}>
              <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
                <Button 
                  variant="outlined" 
                  size="small" 
                  onClick={() => exportCsv(competitiveParticipants, `${eventEditionData.name || 'resultater'}_konkurranse`)}
                >
                  Last ned CSV
                </Button>
              </Box>
              
              <Paper elevation={1} sx={{ height: 'calc(100vh - 350px)', minHeight: 400 }}>
                <DataGrid
                  rows={competitiveParticipants}
                  columns={competitiveColumns}
                  disableSelectionOnClick
                  pageSize={25}
                  rowsPerPageOptions={[25, 50, 100]}
                  components={{ Toolbar: GridToolbar }}
                  sortModel={competitiveSortModel}
                  onSortModelChange={setCompetitiveSortModel}
                  columnVisibilityModel={competitiveColumnVisibility}
                  onColumnVisibilityModelChange={setCompetitiveColumnVisibility}
                  disableColumnSelector={false}
                  localeText={{
                    toolbarDensity: "Tetthet",
                    toolbarExport: "Eksport",
                    toolbarExportLabel: "Eksport",
                    toolbarExportCSV: "Last ned CSV",
                    toolbarExportPrint: "Skriv ut",
                    toolbarColumns: "Kolonner",
                    toolbarFilters: "Filtre",
                    columnsPanelTextFieldLabel: "Finn kolonne",
                    columnsPanelTextFieldPlaceholder: "Søk...",
                    columnsPanelDragIconLabel: "Endre rekkefølge",
                    columnsPanelShowAllButton: "Vis alle",
                    columnsPanelHideAllButton: "Skjul alle"
                  }}
                />
              </Paper>
            </Stack>
          </TabPanel>
          
          {/* Timed Recreational Results Tab (Trim) */}
          <TabPanel value={tabValue} index={1}>
            <Stack spacing={2}>
              <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
                <Button 
                  variant="outlined" 
                  size="small" 
                  onClick={() => exportCsv(timedRecreationalParticipants, `${eventEditionData.name || 'resultater'}_trim`)}
                >
                  Last ned CSV
                </Button>
              </Box>
              
              <Paper elevation={1} sx={{ height: 'calc(100vh - 350px)', minHeight: 400 }}>
                <DataGrid
                  rows={timedRecreationalParticipants}
                  columns={timedRecreationalColumns}
                  disableSelectionOnClick
                  pageSize={25}
                  rowsPerPageOptions={[25, 50, 100]}
                  components={{ Toolbar: GridToolbar }}
                  sortModel={timedRecreationalSortModel}
                  onSortModelChange={setTimedRecreationalSortModel}
                  columnVisibilityModel={timedRecreationalColumnVisibility}
                  onColumnVisibilityModelChange={setTimedRecreationalColumnVisibility}
                  disableColumnSelector={false}
                  localeText={{
                    toolbarDensity: "Tetthet",
                    toolbarExport: "Eksport",
                    toolbarExportLabel: "Eksport",
                    toolbarExportCSV: "Last ned CSV",
                    toolbarExportPrint: "Skriv ut",
                    toolbarColumns: "Kolonner",
                    toolbarFilters: "Filtre",
                    columnsPanelTextFieldLabel: "Finn kolonne",
                    columnsPanelTextFieldPlaceholder: "Søk...",
                    columnsPanelDragIconLabel: "Endre rekkefølge",
                    columnsPanelShowAllButton: "Vis alle",
                    columnsPanelHideAllButton: "Skjul alle"
                  }}
                />
              </Paper>
            </Stack>
          </TabPanel>

          {/* Non-timed Recreational Results Tab (Tur) */}
          <TabPanel value={tabValue} index={2}>
            <Stack spacing={2}>
              <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
                <Button 
                  variant="outlined" 
                  size="small" 
                  onClick={() => exportCsv(recreationalParticipants, `${eventEditionData.name || 'resultater'}_tur`)}
                >
                  Last ned CSV
                </Button>
              </Box>
              
              <Paper elevation={1} sx={{ height: 'calc(100vh - 350px)', minHeight: 400 }}>
                <DataGrid
                  rows={recreationalParticipants}
                  columns={recreationalColumns}
                  disableSelectionOnClick
                  pageSize={25}
                  rowsPerPageOptions={[25, 50, 100]}
                  components={{ Toolbar: GridToolbar }}
                  sortModel={recreationalSortModel}
                  onSortModelChange={setRecreationalSortModel}
                  columnVisibilityModel={recreationalColumnVisibility}
                  onColumnVisibilityModelChange={setRecreationalColumnVisibility}
                  disableColumnSelector={false}
                  localeText={{
                    toolbarDensity: "Tetthet",
                    toolbarExport: "Eksport",
                    toolbarExportLabel: "Eksport",
                    toolbarExportCSV: "Last ned CSV",
                    toolbarExportPrint: "Skriv ut",
                    toolbarColumns: "Kolonner",
                    toolbarFilters: "Filtre",
                    columnsPanelTextFieldLabel: "Finn kolonne",
                    columnsPanelTextFieldPlaceholder: "Søk...",
                    columnsPanelDragIconLabel: "Endre rekkefølge",
                    columnsPanelShowAllButton: "Vis alle",
                    columnsPanelHideAllButton: "Skjul alle"
                  }}
                />
              </Paper>
            </Stack>
          </TabPanel>
          
          {renderExplanations()}
        </>
      )}
    </Box>
  );
};

export default ResultsPage;
