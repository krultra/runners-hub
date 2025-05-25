/**
 * NOTE: This component is currently not in use and has been replaced by external results services.
 * It was originally developed for Malvikingen Opp with intentions to support multiple events,
 * but the functionality was later moved to dedicated external services.
 * 
 * The code has been preserved here for future reference and potential reuse.
 * 
 * Last updated: May 2025
 */

import React from 'react';
import { Container, Typography, Paper } from '@mui/material';

const GeneralResultsPage = () => {
  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      <Paper sx={{ p: 4, textAlign: 'center' }}>
        <Typography variant="h4" component="h1" gutterBottom>
          Resultatside under utvikling
        </Typography>
        <Typography variant="body1" paragraph>
          Denne siden er for øyeblikket ikke tilgjengelig.
        </Typography>
        <Typography variant="body1">
          Vennligst bruk den offensielle resultattjenesten for å se løpsresultater for Malvikingen Opp 2025.
        </Typography>
      </Paper>
    </Container>
  );
};

export default GeneralResultsPage;

/*
 * Original code preserved for future reference
 */

/*
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Container, Typography, Box, Paper, 
  FormControl, InputLabel, Select, MenuItem, 
  ToggleButtonGroup, ToggleButton, Alert, Divider, Grid 
} from '@mui/material';
import { DataGrid, GridColDef, GridColumnVisibilityModel, GridSortModel, GridToolbar, GridValueFormatterParams } from '@mui/x-data-grid';
import { useSearchParams } from 'react-router-dom';
import { collection, getDocs, db } from '../firebase';
import { getEventResults } from '../api/results';

// Interfaces
interface EventEdition {
  id: string;
  eventName: string;
  edition: string;
  eventDate: string;
  resultTypes?: string[];
}

interface Participant {
  id: string;
  bib: number;
  firstName: string;
  lastName: string;
  dateOfBirth?: string;
  gender?: 'M' | 'K' | '*' | string;
  club?: string;
  class?: string;
  registrationType?: 'competition' | 'recreational' | 'timed_recreational';
  totalTimeDisplay?: string;
  totalTimeSeconds?: number;
  totalAGTimeDisplay?: string;
  totalAGTimeSeconds?: number;
  totalAGGTimeDisplay?: string;
  totalAGGTimeSeconds?: number;
  age?: number;
  scratchPlace?: number | 'Trim';
  genderPlace?: number;
  agPlace?: number;
  aggPlace?: number;
  classPlace?: number;
  moRegistrations?: {
    age?: number;
    class?: string;
    className?: string;
    classDescription?: string;
    representing?: string;
  };
  sortPriority?: number;
}

// View types
type ViewType = 'konkurranse' | 'trim' | 'tur';

const GeneralResultsPage = () => {
  // URL params
  const [searchParams, setSearchParams] = useSearchParams();
  
  // State
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [eventEditions, setEventEditions] = useState<EventEdition[]>([]);
  const [selectedEventId, setSelectedEventId] = useState<string>('');
  const [selectedEvent, setSelectedEvent] = useState<EventEdition | null>(null);
  const [viewType, setViewType] = useState<ViewType>('konkurranse');
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [columnVisibility, setColumnVisibility] = useState<GridColumnVisibilityModel>({});
  const [sortModel, setSortModel] = useState<GridSortModel>([]);

  // Debug logging helper
  const logDebug = (message: string, data?: any) => {
    const debugMsg = data ? `${message}: ${JSON.stringify(data)}` : message;
    console.log(`[GeneralResultsPage] ${debugMsg}`);
  };

  // Fetch results when event selection changes
  const fetchEventResults = useCallback(async (editionId: string) => {
    try {
      logDebug(`Fetching results for editionId: ${editionId}`);
      setLoading(true);
      
      const results = await getEventResults(editionId);
      logDebug('Results received from service', {
        hasResults: !!results,
        participantsCount: results?.participants?.length || 0,
        hasEventData: !!results?.eventData
      });
      
      if (!results) {
        logDebug('No results found');
        setError('No results data found for this event.');
        setLoading(false);
        return;
      }
      
      // Check if we have any participants
      if (results.participants && results.participants.length > 0) {
        logDebug(`Setting ${results.participants.length} participants`);
        // Log sample participant data
        if (results.participants.length > 0) {
          logDebug('Sample participant', results.participants[0]);
        }
      } else {
        logDebug('No participants found in results');
      }
      
      setParticipants(results.participants);
      
      // Get the event details from the results
      if (results.eventData) {
        logDebug('Setting event data', results.eventData);
        setSelectedEvent({
          id: editionId,
          eventName: results.eventData.eventName || '',
          edition: results.eventData.edition || '',
          eventDate: results.eventData.eventDate || '',
          resultTypes: results.eventData.resultTypes || []
        });
      } else {
        logDebug('No event data available');
      }
      
      setLoading(false);
    } catch (error: any) {
      setError(`Error fetching results: ${error.message}`);
      setLoading(false);
    }
  }, []);

  // Load all event editions on component mount
  useEffect(() => {
    const fetchEventEditions = async () => {
      try {
        const eventEditionsRef = collection(db, 'eventEditions');
        const snapshot = await getDocs(eventEditionsRef);
        
        if (snapshot.empty) {
          setError('No event editions found.');
          setLoading(false);
          return;
        }

        const editions: EventEdition[] = [];
        snapshot.forEach((doc) => {
          const data = doc.data() as EventEdition;
          editions.push({
            ...data,
            id: doc.id
          });
        });

        // Sort by date (newest first)
        editions.sort((a, b) => {
          // If eventDate is available, use it
          if (a.eventDate && b.eventDate) {
            return new Date(b.eventDate).getTime() - new Date(a.eventDate).getTime();
          }
          // If edition is available and both are strings, use it
          if (typeof a.edition === 'string' && typeof b.edition === 'string') {
            return b.edition.localeCompare(a.edition);
          }
          // If eventName is available and both are strings, use it
          if (typeof a.eventName === 'string' && typeof b.eventName === 'string') {
            return a.eventName.localeCompare(b.eventName);
          }
          // Fallback to comparing IDs to ensure consistent sorting
          return a.id.localeCompare(b.id);
        });

        setEventEditions(editions);
        
        // Check for URL param and select that event if it exists
        const editionIdParam = searchParams.get('edition');
        console.log('[GeneralResultsPage] URL parameter: edition =', editionIdParam);
        
        if (editionIdParam && editionIdParam !== selectedEventId) {
          console.log(`[GeneralResultsPage] Setting selected event to: ${editionIdParam}`);
          setSelectedEventId(editionIdParam);
          fetchEventResults(editionIdParam);
        } else if (!editionIdParam && eventEditions.length > 0) {
          // If no edition parameter but we have event editions, use the first one
          console.log('[GeneralResultsPage] No edition parameter, using first available event');
          const firstEventId = eventEditions[0].id;
          setSelectedEventId(firstEventId);
          setSearchParams({ edition: firstEventId });
          fetchEventResults(firstEventId);
        }
      } catch (error: any) {
        setError(`Error fetching event editions: ${error.message}`);
        setLoading(false);
      }
    };

    fetchEventEditions();
  }, [searchParams, setSearchParams, fetchEventResults, eventEditions, selectedEventId]);

  // Handle event selection change
  const handleEventChange = (event: SelectChangeEvent) => {
    const newEditionId = event.target.value;
    console.log(`[GeneralResultsPage] Event selection changed to: ${newEditionId}`);
    setSelectedEventId(newEditionId);
    setSearchParams({ edition: newEditionId });
    fetchEventResults(newEditionId);
  };

  // Handle view type change
  const handleViewTypeChange = (_event: React.MouseEvent<HTMLElement>, newViewType: ViewType | null) => {
    if (newViewType !== null) {
      setViewType(newViewType);
    }
  };

  // Filter participants based on view type
  const filteredParticipants = useMemo(() => {
    if (!participants.length) return [];
    
    let filtered: Participant[] = [];
    
    switch (viewType) {
      case 'konkurranse':
        // Competition participants
        filtered = participants.filter(p => p.registrationType === 'competition');
        
        // Sort by place/time
        filtered.sort((a, b) => {
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
        break;
        
      case 'trim':
        // Timed recreational participants
        filtered = participants.filter(p => p.registrationType === 'timed_recreational');
        
        // Sort alphabetically by last name, then first name
        filtered.sort((a, b) => {
          const lastNameComp = a.lastName.localeCompare(b.lastName);
          return lastNameComp !== 0 ? lastNameComp : a.firstName.localeCompare(b.firstName);
        });
        break;
        
      case 'tur':
        // Recreational participants (no timing)
        filtered = participants.filter(p => p.registrationType === 'recreational');
        
        // Sort alphabetically by last name, then first name
        filtered.sort((a, b) => {
          const lastNameComp = a.lastName.localeCompare(b.lastName);
          return lastNameComp !== 0 ? lastNameComp : a.firstName.localeCompare(b.firstName);
        });
        break;
    }
    
    return filtered;
  }, [participants, viewType]);

  // Define column configurations for each view type
  const columns = useMemo<GridColDef[]>(() => {
    // Base columns for all view types
    const baseColumns: GridColDef[] = [
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
        width: 150,
        valueGetter: (params) => params.row.moRegistrations?.representing || params.row.club || ''
      },
    ];
    
    // For Konkurranse view
    if (viewType === 'konkurranse') {
      // Add position column
      baseColumns.unshift({ 
        field: 'scratchPlace', 
        headerName: 'Plass', 
        width: 80,
        headerAlign: 'center',
        align: 'center',
        valueFormatter: (params: GridValueFormatterParams) => {
          if (params.value === null || params.value === undefined) return '';
          return typeof params.value === 'number' ? `${params.value}.` : params.value;
        }
      });
      
      // Add gender, age, class, time columns
      baseColumns.push(
        { 
          field: 'gender', 
          headerName: 'Kjønn', 
          width: 70,
          headerAlign: 'center',
          align: 'center',
          valueFormatter: (params: GridValueFormatterParams) => {
            return params.value === '*' ? '' : (params.value || '');
          }
        },
        { 
          field: 'age', 
          headerName: 'Alder', 
          width: 70,
          headerAlign: 'center',
          align: 'center',
          valueGetter: (params) => params.row.moRegistrations?.age || params.row.age || ''
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
      );
      
      // Add gender placement if resultTypes includes 'gender'
      if (selectedEvent?.resultTypes?.includes('gender')) {
        baseColumns.push(
          { 
            field: 'genderPlace', 
            headerName: 'Kjønn Plass', 
            width: 110,
            headerAlign: 'center',
            align: 'center',
            description: 'Plassering i kjønnskategori',
            valueFormatter: (params: GridValueFormatterParams) => {
              return params.value ? `${params.value}.` : '';
            }
          }
        );
      }
      
      // Add AG columns if resultTypes includes 'AG'
      if (selectedEvent?.resultTypes?.includes('AG')) {
        baseColumns.push(
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
      
      // Add AGG columns if resultTypes includes 'AGG'
      if (selectedEvent?.resultTypes?.includes('AGG')) {
        baseColumns.push(
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
    } 
    // For Trim view (timed recreational)
    else if (viewType === 'trim') {
      // Add age and time columns, no gender or placement
      baseColumns.push(
        { 
          field: 'age', 
          headerName: 'Alder', 
          width: 70,
          headerAlign: 'center',
          align: 'center',
          valueGetter: (params) => params.row.moRegistrations?.age || params.row.age || ''
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
      );
      
      // Add AG columns if resultTypes includes 'AG'
      if (selectedEvent?.resultTypes?.includes('AG')) {
        baseColumns.push(
          { 
            field: 'totalAGTimeDisplay', 
            headerName: 'AG Tid', 
            width: 100,
            headerAlign: 'center',
            align: 'center',
            description: 'Aldersgradert tid'
          }
        );
      }
      
      // Add AGG columns if resultTypes includes 'AGG'
      if (selectedEvent?.resultTypes?.includes('AGG')) {
        baseColumns.push(
          { 
            field: 'totalAGGTimeDisplay', 
            headerName: 'AGG Tid', 
            width: 100,
            headerAlign: 'center',
            align: 'center',
            description: 'Alders- og kjønnsgradert tid'
          }
        );
      }
    }
    // Tur view (recreational, no timing)
    // for 'tur' view we just use the base columns (bib, name, club)
    
    return baseColumns;
  }, [viewType, selectedEvent]);

  // Render
  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 8 }}>
      <Paper elevation={2} sx={{ p: 3, mb: 4 }}>
        <Typography variant="h4" component="h1" gutterBottom>
          Resultater
        </Typography>
        
        // Event Selection 
        <FormControl fullWidth sx={{ mb: 4 }}>
          <InputLabel id="event-select-label">Velg arrangement</InputLabel>
          <Select
            labelId="event-select-label"
            id="event-select"
            value={selectedEventId}
            label="Velg arrangement"
            onChange={handleEventChange}
            disabled={loading || eventEditions.length === 0}
          >
            {eventEditions.map((edition) => (
              <MenuItem key={edition.id} value={edition.id}>
                {edition.eventName} {edition.edition}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        
        // Selected Event Header 
        {selectedEvent && (
          <Typography variant="h5" component="h2" fontWeight="bold" gutterBottom>
            {selectedEvent.eventName} {selectedEvent.edition}
          </Typography>
        )}
        
        // Loading and Error States 
        {loading && (
          <Box display="flex" justifyContent="center" my={4}>
            <CircularProgress />
          </Box>
        )}
        
        {error && (
          <Alert severity="error" sx={{ mt: 2, mb: 2 }}>
            {error}
          </Alert>
        )}
        
        // View Type Selection 
        {!loading && !error && selectedEvent && (
          <>
            <Box sx={{ mb: 2, mt: 2 }}>
              <ToggleButtonGroup
                value={viewType}
                exclusive
                onChange={handleViewTypeChange}
                aria-label="view type"
                size="small"
                color="primary"
              >
                <ToggleButton value="konkurranse" aria-label="konkurranse">
                  Konkurranse
                </ToggleButton>
                <ToggleButton value="trim" aria-label="trim">
                  Trim
                </ToggleButton>
                <ToggleButton value="tur" aria-label="tur">
                  Tur
                </ToggleButton>
              </ToggleButtonGroup>
            </Box>
            
            // Results DataGrid 
            <div style={{ height: 600, width: '100%' }}>
              <DataGrid
                rows={filteredParticipants}
                columns={columns}
                columnVisibilityModel={columnVisibility}
                onColumnVisibilityModelChange={(newModel) => setColumnVisibility(newModel)}
                sortModel={sortModel}
                onSortModelChange={(newModel) => setSortModel(newModel)}
                density="standard"
                components={{
                  Toolbar: GridToolbar,
                }}
                componentsProps={{
                  toolbar: {
                    showQuickFilter: true,
                    quickFilterProps: { debounceMs: 500 },
                  },
                }}
                disableColumnMenu={false}
                disableColumnFilter={false}
                disableSelectionOnClick
                pageSize={100}
                loading={loading}
              />
            </div>
            
            // Abbreviations Legend 
            <Box mt={4} p={2} bgcolor="background.paper" borderRadius={1}>
              <Typography variant="h6" gutterBottom>
                Forklaringer
              </Typography>
              
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6} md={4}>
                  <Typography variant="body2"><strong>AG:</strong> Aldersgradert</Typography>
                </Grid>
                <Grid item xs={12} sm={6} md={4}>
                  <Typography variant="body2"><strong>AGG:</strong> Alders- og kjønnsgradert</Typography>
                </Grid>
                {selectedEvent?.resultTypes?.includes('gender') && (
                  <Grid item xs={12} sm={6} md={4}>
                    <Typography variant="body2"><strong>Kjønn Plass:</strong> Plassering innen kjønnskategori</Typography>
                  </Grid>
                )}
              </Grid>
              
              <Divider sx={{ my: 2 }} />
              
              <Typography variant="body2" color="text.secondary">
                <strong>Konkurranse:</strong> Deltakere med konkurranseklasser<br />
                <strong>Trim:</strong> Deltakere med tidtaking som ikke konkurrerer<br />
                <strong>Tur:</strong> Deltakere uten tidtaking
              </Typography>
            </Box>
          </>
        )}
      </Paper>
    </Container>
  );
};

export default GeneralResultsPage;

*/
