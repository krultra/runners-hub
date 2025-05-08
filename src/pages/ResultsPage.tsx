import React, { useState, useEffect, SyntheticEvent } from 'react';
import { useEventEdition } from '../contexts/EventEditionContext';
import { getEventResults } from '../services/resultsService';
import { 
  DataGrid, 
  GridToolbar, 
  GridColDef,
  GridSortModel,
  GridFilterModel,
  GridColumnVisibilityModel,
  GridValueFormatterParams,
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
  Alert,
  Tabs,
  Tab,
  Stack,
  Divider
} from '@mui/material';
import InfoIcon from '@mui/icons-material/Info';
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
  const { event: contextEvent, loading: contextLoading } = useEventEdition();
  
  // State variables
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [eventEditionData, setEventEditionData] = useState<EventEditionData>({});
  const [status, setStatus] = useState<Status>(Status.notStarted);
  
  // Participants state
  const [allParticipants, setAllParticipants] = useState<Participant[]>([]);
  const [competitiveParticipants, setCompetitiveParticipants] = useState<Participant[]>([]);
  const [recreationalParticipants, setRecreationalParticipants] = useState<Participant[]>([]);
  
  // DataGrid state
  const [competitiveColumnVisibility, setCompetitiveColumnVisibility] = useState<GridColumnVisibilityModel>({});
  const [recreationalColumnVisibility, setRecreationalColumnVisibility] = useState<GridColumnVisibilityModel>({});
  const [competitiveSortModel, setCompetitiveSortModel] = useState<GridSortModel>([]);
  const [recreationalSortModel, setRecreationalSortModel] = useState<GridSortModel>([]);
  
  // Tab state
  const [tabValue, setTabValue] = useState(0);

  // Handle tab change
  const handleTabChange = (_event: SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  // Calculate age from date of birth
  const getAge = (dob: string): number => {
    if (!dob) return 0;
    const yearMatch = dob.match(/(\d{4})/);
    if (!yearMatch) return 0;
    return new Date().getFullYear() - Number(yearMatch[1]);
  };

  // Format time for Excel (using comma as decimal separator)
  const formatExcelTime = (timeStr: string): string => {
    if (!timeStr) return '';
    return timeStr.replace('.', ',');
  };

  // Process participants and separate into competitive and recreational
  const processParticipants = (participants: Participant[]): void => {
    // Create a copy to avoid mutating the original
    const processedParticipants = [...participants];
    
    // Add age to all participants
    processedParticipants.forEach(p => {
      p.age = getAge(p.dateOfBirth);
    });
    
    // Separate competitive from recreational participants using both registrationType and gender
    // for backward compatibility
    const recreational = processedParticipants.filter(p => 
      p.registrationType === 'timed_recreational' || p.gender === '*'
    );
    
    const competitive = processedParticipants.filter(p => 
      p.registrationType !== 'timed_recreational' && p.gender !== '*'
    );
    
    // Process competitive participants
    processCompetitiveParticipants(competitive, eventEditionData.resultTypes || []);
    
    // Process recreational participants separately
    processRecreationalParticipants(recreational);
    
    // Store all participant groups
    setAllParticipants(processedParticipants);
    setCompetitiveParticipants(competitive);
    setRecreationalParticipants(recreational);
  };
  
  // Process only competitive participants
  const processCompetitiveParticipants = (participants: Participant[], resultTypes: string[]): void => {
    // Sort by finish time first (ascending)
    participants.sort((a, b) => a.totalTimeSeconds - b.totalTimeSeconds);
    
    // Calculate overall scratch places
    let scratchPlace = 1;
    participants.forEach(p => {
      p.scratchPlace = scratchPlace++;
    });
    
    // Calculate gender places if needed
    if (resultTypes.includes('gender')) {
      const maleParticipants = participants.filter(p => p.gender === 'M');
      const femaleParticipants = participants.filter(p => p.gender === 'K');
      
      // Sort by time and assign gender places
      maleParticipants.sort((a, b) => a.totalTimeSeconds - b.totalTimeSeconds);
      femaleParticipants.sort((a, b) => a.totalTimeSeconds - b.totalTimeSeconds);
      
      let malePlace = 1;
      let femalePlace = 1;
      
      maleParticipants.forEach(p => {
        p.genderPlace = malePlace++;
      });
      
      femaleParticipants.forEach(p => {
        p.genderPlace = femalePlace++;
      });
    }
    
    // Calculate age-graded places if needed
    if (resultTypes.includes('AG') && participants.some(p => p.totalAGTimeSeconds)) {
      participants.sort((a, b) => {
        const aTime = a.totalAGTimeSeconds || Number.MAX_VALUE;
        const bTime = b.totalAGTimeSeconds || Number.MAX_VALUE;
        return aTime - bTime;
      });
      
      let agPlace = 1;
      participants.forEach(p => {
        if (p.totalAGTimeSeconds) {
          p.agPlace = agPlace++;
        }
      });
    }
    
    // Calculate age-and-gender-graded places if needed
    if (resultTypes.includes('AGG') && participants.some(p => p.totalAGGTimeSeconds)) {
      participants.sort((a, b) => {
        const aTime = a.totalAGGTimeSeconds || Number.MAX_VALUE;
        const bTime = b.totalAGGTimeSeconds || Number.MAX_VALUE;
        return aTime - bTime;
      });
      
      let aggPlace = 1;
      participants.forEach(p => {
        if (p.totalAGGTimeSeconds) {
          p.aggPlace = aggPlace++;
        }
      });
    }
    
    // Restore original sort by finish time
    participants.sort((a, b) => a.totalTimeSeconds - b.totalTimeSeconds);
  };
  
  // Process recreational participants
  const processRecreationalParticipants = (participants: Participant[]): void => {
    // For recreational participants, set "Trim" for placement
    participants.forEach(p => {
      p.scratchPlace = 'Trim';
      p.genderPlace = undefined;
      p.agPlace = undefined;
      p.aggPlace = undefined;
    });
    
    // Sort recreational participants alphabetically by last name, then first name
    participants.sort((a, b) => {
      const lastNameComp = a.lastName.localeCompare(b.lastName);
      if (lastNameComp !== 0) return lastNameComp;
      
      // If last names are the same, sort by first name
      return a.firstName.localeCompare(b.firstName);
    });
  };

  // Fetch data from the results service
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        
        // Get event edition ID from URL or context
        const urlParams = new URLSearchParams(window.location.search);
        let editionId = urlParams.get('id');
        
        // If no ID in URL, try to use the one from context
        if (!editionId && contextEvent) {
          editionId = contextEvent.id;
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
        
        // Process participants and calculate placements
        processParticipants(participants);
        
        // Set up default column visibility for competitive participants
        setCompetitiveColumnVisibility({
          bib: true,
          scratchPlace: true,
          firstName: true,
          lastName: true,
          gender: true,
          club: true,
          totalTimeDisplay: true,
          ...(eventData.resultTypes?.includes('AG') ? { totalAGTimeDisplay: true, agPlace: true } : {}),
          ...(eventData.resultTypes?.includes('AGG') ? { totalAGGTimeDisplay: true, aggPlace: true } : {})
        });
        
        // Set up default column visibility for recreational participants
        setRecreationalColumnVisibility({
          bib: true,
          firstName: true,
          lastName: true,
          club: true,
          totalTimeDisplay: true
        });
        
        // Set default sort model for competitive participants
        setCompetitiveSortModel([{ field: 'scratchPlace', sort: 'asc' }]);
        
        // Set default sort model for recreational participants
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
    // Headers for CSV
    const headers = [
      'Startnummer', 'Fornavn', 'Etternavn', 'Fødselsdato', 'Kjønn', 
      'Klubb', 'Klasse', 'Tid', 'Plassering'
    ];
    
    // Format data rows
    const csvRows = participants.map(p => [
      String(p.bib),
      p.firstName,
      p.lastName,
      p.dateOfBirth,
      p.gender === '*' ? '' : p.gender,
      p.club || '',
      p.class || '',
      formatExcelTime(p.totalTimeDisplay),
      p.scratchPlace === 'Trim' ? 'Trim' : String(p.scratchPlace || '')
    ]);
    
    // Add headers
    csvRows.unshift(headers);
    
    // Convert to CSV format
    const csvContent = csvRows.map(row => row.map(cell => {
      // Escape quotes and wrap in quotes if the cell contains a comma
      const escapedCell = String(cell).replace(/"/g, '""');
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
    { 
      field: 'gender', 
      headerName: 'Kjønn', 
      width: 70,
      headerAlign: 'center',
      align: 'center',
      valueFormatter: (params: GridValueFormatterParams) => {
        if (params.value === 'M') return 'Mann';
        if (params.value === 'K') return 'Kvinne';
        return '';
      }
    },
    { 
      field: 'age', 
      headerName: 'Alder', 
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
    },
    { 
      field: 'genderPlace', 
      headerName: 'Kjønnsplassering', 
      width: 140,
      headerAlign: 'center',
      align: 'center',
      valueFormatter: (params: GridValueFormatterParams) => {
        return params.value ? `${params.value}.` : '';
      }
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

  // Define columns for recreational participants
  const recreationalColumns: GridColDef[] = [
    { 
      field: 'scratchPlace', 
      headerName: 'Type', 
      width: 80,
      headerAlign: 'center',
      align: 'center',
      valueFormatter: (params: GridValueFormatterParams) => {
        return params.value === 'Trim' ? 'Trim' : '';
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
    { 
      field: 'club', 
      headerName: 'Klubb', 
      width: 150 
    },
    { 
      field: 'totalTimeDisplay', 
      headerName: 'Tid', 
      width: 100,
      headerAlign: 'center',
      align: 'center'
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
          
          {/* Recreational Results Tab */}
          <TabPanel value={tabValue} index={1}>
            <Stack spacing={2}>
              <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
                <Button 
                  variant="outlined" 
                  size="small" 
                  onClick={() => exportCsv(recreationalParticipants, `${eventEditionData.name || 'resultater'}_trim`)}
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
