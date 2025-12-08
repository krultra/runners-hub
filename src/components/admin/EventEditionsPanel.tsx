// React & Hooks
import React, { useState, useEffect, FC, useCallback } from 'react';

// Firebase
import { Timestamp } from 'firebase/firestore';

// MUI Components
import {
  Box,
  TextField,
  Button,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  CircularProgress,
  IconButton,
  List,
  ListItem,
  Snackbar,
  Alert,
} from '@mui/material';
import { Trash2 } from 'lucide-react';

// Date Pickers
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { DateTimePicker } from '@mui/x-date-pickers/DateTimePicker';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import nbLocale from 'date-fns/locale/nb';

// Context
import { useEventEdition, RaceDistance } from '../../contexts/EventEditionContext';

// Services
import {
  listEventEditions,
  addEventEdition,
  getEventEdition,
  updateEventEdition,
  deleteEventEdition,
} from '../../services/eventEditionService';
import { listCodeList, CodeListItem } from '../../services/codeListService';

// Types
interface SnackbarState {
  open: boolean;
  message: string;
  severity: 'success' | 'error' | 'info' | 'warning';
}

interface RaceDistanceForm {
  id: string;               // Required to match RaceDistance
  name: string;             // Required identifier
  distance: number;         // Distance in meters
  displayName: string;      // Display name (required to match RaceDistance)
  displayName_no?: string;  // Norwegian display name
  displayName_en?: string;  // English display name
  length: number;           // Actual length in meters (required to match RaceDistance)
  ascent: number;           // Total ascent in meters (required to match RaceDistance)
  descent: number;          // Total descent in meters (required to match RaceDistance)
  fee?: number;             // Registration fee for this race class
}


// Helper function to convert RaceDistance to RaceDistanceForm
const toRaceDistanceForm = (distance: RaceDistance): RaceDistanceForm => {
  return {
    id: distance.id,
    name: distance.displayName, // Use displayName as name
    distance: distance.length, // Use length as distance
    displayName: distance.displayName,
    displayName_no: distance.displayName_no,
    displayName_en: distance.displayName_en,
    length: distance.length,
    ascent: distance.ascent,
    descent: distance.descent,
    fee: distance.fee
  };
};

interface FeesForm {
  participation: number;
  baseCamp: number;
  deposit: number;
  total: number;
}

const EventEditionsPanel: FC = () => {
  // Loading states
  const [loadingData, setLoadingData] = useState<boolean>(false);
  
  // Form state
  const [dirty, setDirty] = useState<boolean>(false);
  const [eventId, setEventId] = useState<string>('');
  const [editionNum, setEditionNum] = useState<number>(1);
  const [eventShortName, setEventShortName] = useState<string>('');
  const [eventName, setEventName] = useState<string>('');
  const [status, setStatus] = useState<string>('draft');
  const [resultTypes, setResultTypes] = useState<string[]>([]);
  const [resultsStatus, setResultsStatus] = useState<string>('');
  const [resultURL, setResultURL] = useState<string>('');
  const [liveResultsURL, setLiveResultsURL] = useState<string>('');
  const [startDate, setStartDate] = useState<Date | null>(new Date());
  const [endDate, setEndDate] = useState<Date | null>(new Date());
  const [registrationOpens, setRegistrationOpens] = useState<Date | null>(null);
  const [registrationDeadline, setRegistrationDeadline] = useState<Date | null>(null);
  const [maxParticipants, setMaxParticipants] = useState<number>(0);
  const [loopDistance, setLoopDistance] = useState<number>(0);
  const [newRtSelect, setNewRtSelect] = useState<string>('');
  
  // Complex state objects
  const [fees, setFees] = useState<FeesForm>({ 
    participation: 0, 
    baseCamp: 0, 
    deposit: 0, 
    total: 0 
  });
  
  const [raceDistances, setRaceDistances] = useState<RaceDistance[]>([]);
  const [newDistance, setNewDistance] = useState<RaceDistanceForm>({ 
    id: '', 
    name: '', 
    distance: 0, 
    displayName: '', 
    displayName_no: '',
    displayName_en: '',
    length: 0, 
    ascent: 0, 
    descent: 0,
    fee: 0
  });
  
  // UI state
  const [, setSnackbar] = useState<SnackbarState>({ 
    open: false, 
    message: '', 
    severity: 'success' 
  });
  
  const [snackbarOpen, setSnackbarOpen] = useState<boolean>(false);
  const [eventStatusOptions, setEventStatusOptions] = useState<CodeListItem[]>([]);
  const [resultsStatusOptions, setResultsStatusOptions] = useState<CodeListItem[]>([]);
  
  // Context
  const { 
    event: selectedEvent, 
    setEvent, 
    loading: eventLoading, 
    error: eventError 
  } = useEventEdition();
  
  // Log context values for debugging
  useEffect(() => {
    console.log('Selected Event:', selectedEvent);
    console.log('Event Loading:', eventLoading);
    if (eventError) {
      console.error('Event Error:', eventError);
    }
  }, [selectedEvent, eventLoading, eventError]);

  useEffect(() => {
    let isMounted = true;

    const loadStatuses = async () => {
      try {
        const [eventStatuses, resultStatuses] = await Promise.all([
          listCodeList('status', 'eventEditions'),
          listCodeList('status', 'results')
        ]);
        if (!isMounted) return;
        setEventStatusOptions(eventStatuses);
        setResultsStatusOptions(resultStatuses);
      } catch (err) {
        console.error('Failed to load status code lists', err);
      }
    };

    loadStatuses();

    return () => {
      isMounted = false;
    };
  }, []);

  // Load event data from Firestore by ID
  const loadEventData = useCallback(async (eventId: string) => {
    if (!eventId) return;
    
    setLoadingData(true);
    try {
      const data = await getEventEdition(eventId);
      setEventId(data.eventId);
      setEditionNum(data.edition);
      setEventShortName(data.eventShortName);
      setEventName(data.eventName);
      setStatus(data.status);
      setResultTypes(data.resultTypes || []);
      setResultsStatus(data.resultsStatus || '');
      setResultURL((data as any).resultURL || '');
      setLiveResultsURL((data as any).liveResultsURL || '');
      setStartDate(data.startTime.toDate());
      setEndDate(data.endTime.toDate());
      setRegistrationOpens(data.registrationOpens?.toDate() || null);
      setRegistrationDeadline(data.registrationDeadline?.toDate() || null);
      setMaxParticipants(data.maxParticipants || 0);
      setLoopDistance(data.loopDistance || 0);
      setFees(data.fees || { participation: 0, baseCamp: 0, deposit: 0, total: 0 });
      // Convert RaceDistance array from Firestore to RaceDistanceForm array for our component
      setRaceDistances((data.raceDistances || []).map(dist => toRaceDistanceForm(dist)));
      // Convert Firestore Timestamps to Dates for the context
      const contextEvent = {
        ...data,
        startTime: data.startTime.toDate(),
        endTime: data.endTime.toDate(),
        registrationOpens: data.registrationOpens?.toDate() || null,
        registrationDeadline: data.registrationDeadline?.toDate() || null,
      };
      await setEvent(contextEvent);
    } catch (error) {
      console.error('Error loading event data:', error);
    } finally {
      setLoadingData(false);
      setDirty(false);
    }
  }, [setEvent]);
  
  // Load data when selected event changes in context
  useEffect(() => {
    if (selectedEvent?.id) {
      loadEventData(selectedEvent.id);
    } else {
      // Clear form when no event is selected
      resetForm();
    }
  }, [selectedEvent?.id, loadEventData]);

  // Reset form to initial state
  const resetForm = () => {
    setEventId('');
    setEditionNum(1);
    setEventShortName('');
    setEventName('');
    setStatus('draft');
    setResultTypes([]);
    setResultsStatus('');
    setResultURL('');
    setLiveResultsURL('');
    setStartDate(new Date());
    setEndDate(new Date());
    setRegistrationOpens(null);
    setRegistrationDeadline(new Date());
    setMaxParticipants(0);
    setLoopDistance(0);
    setFees({ participation: 0, baseCamp: 0, deposit: 0, total: 0 });
    setRaceDistances([]);
    setNewDistance({ id: '', name: '', distance: 0, displayName: '', length: 0, ascent: 0, descent: 0, fee: 0 });
    setDirty(false);
  };
  
  const handleCreate = () => {
    if (dirty && !window.confirm('Discard unsaved changes and create a new edition?')) return;
    
    // Clear the context to indicate we're creating a new event edition
    setEvent(null);
    
    // Reset form to initial state
    resetForm();
    
    // Set dirty to true to indicate we have unsaved changes
    setDirty(true);
    
    console.log('New event edition form initialized - not yet saved to database');
  };

  const handleSave = async () => {
    // Validate required fields regardless of create/update
    if (!eventId || eventId.trim() === '') {
      setSnackbar({
        open: true,
        message: 'Event ID is required. Please enter a valid ID like "mo" for Malvikingen Opp.',
        severity: 'error'
      });
      return;
    }
    
    if (editionNum < 1) {
      setSnackbar({
        open: true,
        message: 'Edition number must be at least 1',
        severity: 'error'
      });
      return;
    }
    
    // Remove spaces, special chars from eventId to make a 'safe' version for the document ID
    const safeEventId = eventId.toLowerCase().replace(/[^a-z0-9]/g, '');
    const documentId = `${safeEventId}-${editionNum}`;
    
    // Validate that we're not overwriting an existing event with a different ID
    if (selectedEvent?.id && selectedEvent.id !== documentId) {
      const confirmChange = window.confirm(`Changing the eventId or edition will create a new document with ID ${documentId}.\n\nThe original document ${selectedEvent.id} will remain unchanged.\n\nAre you sure you want to continue?`);
      if (!confirmChange) return;
    }

    // Prepare dates for Firestore (convert to Timestamp)
    const d1 = startDate || new Date();
    const d2 = endDate || new Date();

    // Build the payload
    const payload = {
      eventId,
      edition: editionNum,
      eventShortName,
      eventName,
      status,
      resultTypes,
      resultsStatus,
      resultURL,
      liveResultsURL,
      startTime: Timestamp.fromDate(d1),
      endTime: Timestamp.fromDate(d2),
      registrationOpens: registrationOpens ? Timestamp.fromDate(registrationOpens) : undefined,
      registrationDeadline: registrationDeadline ? Timestamp.fromDate(registrationDeadline) : undefined,
      maxParticipants,
      loopDistance,
      fees,
      // Convert RaceDistanceForm array to RaceDistance array for Firestore
      raceDistances: raceDistances.map(form => ({
        id: form.id,
        displayName: form.displayName,
        displayName_no: form.displayName_no || undefined,
        displayName_en: form.displayName_en || undefined,
        length: form.length,
        ascent: form.ascent,
        descent: form.descent,
        fee: form.fee || 0
      })) as RaceDistance[],
    };
    
    try {
      let newId = selectedEvent?.id || '';
      
      // Creating a new document
      if (!selectedEvent?.id) {
        console.log(`Creating new event edition with ID: ${documentId}, eventId: ${eventId}, edition: ${editionNum}`);
        newId = await addEventEdition(payload);
        console.log(`New event edition created with ID: ${newId}`);
      } 
      // Updating an existing document
      else {
        console.log(`Updating event edition with ID: ${selectedEvent.id}, eventId: ${eventId}, edition: ${editionNum}`);
        await updateEventEdition(selectedEvent.id, payload);
        console.log('Event edition updated successfully');
      }
      
      // Get the full event data with proper Date objects for the context
      const updatedEvent = await getEventEdition(newId);
      const contextEvent = {
        ...updatedEvent,
        startTime: updatedEvent.startTime.toDate(),
        endTime: updatedEvent.endTime.toDate(),
        registrationOpens: updatedEvent.registrationOpens?.toDate() || null,
        registrationDeadline: updatedEvent.registrationDeadline?.toDate() || null,
      };
      
      // Update the context with the latest data
      await setEvent(contextEvent);
      
      // Show success message
      setSnackbar({
        open: true,
        message: selectedEvent?.id ? 'Event edition updated successfully' : 'New event edition created successfully',
        severity: 'success'
      });
      
      setDirty(false);
    } catch (error) {
      console.error('Error saving event edition:', error);
      setSnackbar({
        open: true,
        message: `Error saving event: ${error instanceof Error ? error.message : String(error)}`,
        severity: 'error'
      });
    }
  };

  const handleDelete = async () => {
    if (!selectedEvent?.id) return;
    const ok = window.confirm('Delete this event edition? This cannot be undone.');
    if (!ok) return;
    
    try {
      await deleteEventEdition(selectedEvent.id);
      
      // Clear context
      setEvent(null);
      
      // Reset form fields
      resetForm();
      
      // Show success message
      setSnackbar({
        open: true,
        message: 'Event edition successfully deleted',
        severity: 'success'
      });
    } catch (error) {
      console.error('Error deleting event:', error);
      setSnackbar({
        open: true,
        message: `Error deleting event: ${error instanceof Error ? error.message : String(error)}`,
        severity: 'error'
      });
    }
  };

  const handleCopy = async () => {
    if (!selectedEvent?.id) return;
    if (dirty && !window.confirm('Discard unsaved changes and copy edition?')) return;
    if (!startDate || !endDate) { 
      setSnackbar({
        open: true,
        message: 'Please set both start and end dates',
        severity: 'error'
      });
      return; 
    }
    
    // Create dates for the next year
    const d1 = new Date(startDate);
    d1.setFullYear(d1.getFullYear() + 1);
    const d2 = new Date(endDate);
    d2.setFullYear(d2.getFullYear() + 1);
    const newEdition = editionNum + 1;
    
    // Check if an edition with this ID and number already exists
    const allEditions = await listEventEditions();
    if (allEditions.some(e => e.eventId === eventId && e.edition === newEdition)) { 
      setSnackbar({
        open: true,
        message: 'An edition with this Event ID and edition number already exists',
        severity: 'error'
      });
      return; 
    }
    
    // Build payload for the new edition
    const payload = {
      eventId,
      edition: newEdition,
      eventShortName,
      eventName,
      status,
      resultTypes,
      resultsStatus,
      startTime: Timestamp.fromDate(d1),
      endTime: Timestamp.fromDate(d2),
      registrationOpens: registrationOpens ? Timestamp.fromDate(registrationOpens) : undefined,
      registrationDeadline: registrationDeadline ? Timestamp.fromDate(registrationDeadline) : undefined,
      maxParticipants,
      loopDistance,
      fees,
      // Copy race distances if any
      raceDistances: raceDistances.map(form => ({
        id: form.id,
        displayName: form.displayName,
        length: form.length,
        ascent: form.ascent,
        descent: form.descent
      })) as RaceDistance[],
    };
    
    try {
      // Create new event edition
      const newId = await addEventEdition(payload);
      
      // Load the newly created event into the context
      const updatedEvent = await getEventEdition(newId);
      const contextEvent = {
        ...updatedEvent,
        startTime: updatedEvent.startTime.toDate(),
        endTime: updatedEvent.endTime.toDate(),
        registrationOpens: updatedEvent.registrationOpens?.toDate() || null,
        registrationDeadline: updatedEvent.registrationDeadline?.toDate() || null,
      };
      
      // Update the context with the new event
      await setEvent(contextEvent);
      
      // Show success message
      setSnackbar({
        open: true,
        message: 'Event edition successfully copied with next year dates',
        severity: 'success'
      });
      
      setDirty(false);
    } catch (error) {
      console.error('Error copying event edition:', error);
      setSnackbar({
        open: true,
        message: `Error copying event: ${error instanceof Error ? error.message : String(error)}`,
        severity: 'error'
      });
    }
  };

  const handleAddResultType = () => {
    if (!newRtSelect) return;
    setResultTypes(prev => [...prev, newRtSelect]);
    setNewRtSelect('');
    setDirty(true);
  };

  const handleRemoveResultType = (rt: string) => {
    setResultTypes(prev => prev.filter(item => item !== rt));
    setDirty(true);
  };

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={nbLocale}>
      <Box p={2} mb={2} border={1} borderColor="divider" borderRadius={1}>
        <Box mb={2} display="flex" justifyContent="space-between" alignItems="center">
          <Box fontWeight="bold">Event Edition Details</Box>
          <Box>
            <Button variant="contained" onClick={handleCreate} sx={{ mr: 1 }}>New Edition</Button>
            <Button variant="contained" onClick={handleCopy} disabled={!selectedEvent?.id}>Copy</Button>
          </Box>
        </Box>

        {loadingData ? (
          <CircularProgress size={24} />
        ) : (
          (selectedEvent?.id || dirty) && (
            <Box display="flex" flexDirection="column" gap={2}>
              <TextField label="Short Event Name" value={eventShortName} onChange={e => { setEventShortName(e.target.value); setDirty(true); }} />
              <TextField label="Full Event Name" value={eventName} onChange={e => { setEventName(e.target.value); setDirty(true); }} />
              <FormControl>
                <InputLabel id="event-status-label">Status</InputLabel>
                <Select
                  labelId="event-status-label"
                  value={status}
                  label="Status"
                  renderValue={(selected) => {
                    const option = eventStatusOptions.find(opt => opt.code === selected);
                    if (!option) return selected;
                    const label = option.verboseName && option.verboseName !== option.code
                      ? `${option.code} – ${option.verboseName}`
                      : option.code;
                    return label;
                  }}
                  onChange={e => { setStatus(e.target.value); setDirty(true); }}
                >
                  {eventStatusOptions.map(option => (
                    <MenuItem key={option.code} value={option.code}>
                      {option.verboseName && option.verboseName !== option.code
                        ? `${option.code} – ${option.verboseName}`
                        : option.code}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <TextField label="Results URL" value={resultURL} onChange={e => { setResultURL(e.target.value); setDirty(true); }} />
              <TextField label="Live Results URL" value={liveResultsURL} onChange={e => { setLiveResultsURL(e.target.value); setDirty(true); }} />
              <TextField
                label="Event ID"
                value={eventId}
                onChange={e => { setEventId(e.target.value); setDirty(true); }}
              />
              <TextField
                label="Edition"
                type="number"
                value={editionNum}
                onChange={e => { setEditionNum(Number(e.target.value)); setDirty(true); }}
              />
              {/* Result Types Array Editor */}
              <Box>
                <Box display="flex" gap={1} alignItems="center">
                  <TextField
                    label="Add Result Type"
                    size="small"
                    value={newRtSelect}
                    onChange={e => { setNewRtSelect(e.target.value); setDirty(true); }}
                  />
                  <Button size="small" variant="contained" onClick={handleAddResultType} disabled={!newRtSelect}>
                    Add
                  </Button>
                </Box>
                <List dense>
                  {resultTypes.map(rt => (
                    <ListItem
                      key={rt}
                      secondaryAction={
                        <IconButton edge="end" onClick={() => handleRemoveResultType(rt)}>
                          <Trash2 />
                        </IconButton>
                      }
                    >
                      {rt}
                    </ListItem>
                  ))}
                </List>
              </Box>
              <FormControl>
                <InputLabel id="status-label">Results Status</InputLabel>
                <Select
                  labelId="status-label"
                  value={resultsStatus}
                  label="Results Status"
                  renderValue={(selected) => {
                    const option = resultsStatusOptions.find(opt => opt.code === selected);
                    if (!option) return selected;
                    const label = option.verboseName && option.verboseName !== option.code
                      ? `${option.code} – ${option.verboseName}`
                      : option.code;
                    return label;
                  }}
                  onChange={e => { setResultsStatus(e.target.value); setDirty(true); }}
                >
                  {resultsStatusOptions.map(option => (
                    <MenuItem key={option.code} value={option.code}>
                      {option.verboseName && option.verboseName !== option.code
                        ? `${option.code} – ${option.verboseName}`
                        : option.code}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <DateTimePicker
                label="Start Time"
                value={startDate}
                onChange={val => { setStartDate(val); setDirty(true); }}
                inputFormat="dd.MM.yyyy HH:mm"
                renderInput={params => <TextField {...params} size="small" />}
              />
              <DateTimePicker
                label="End Time"
                value={endDate}
                onChange={val => { setEndDate(val); setDirty(true); }}
                inputFormat="dd.MM.yyyy HH:mm"
                renderInput={params => <TextField {...params} size="small" />}
              />
              <DateTimePicker
                label="Registration Opens"
                value={registrationOpens}
                onChange={val => { setRegistrationOpens(val); setDirty(true); }}
                inputFormat="dd.MM.yyyy HH:mm"
                renderInput={params => <TextField {...params} size="small" />}
              />
              <DateTimePicker
                label="Registration Deadline"
                value={registrationDeadline}
                onChange={val => { setRegistrationDeadline(val); setDirty(true); }}
                inputFormat="dd.MM.yyyy HH:mm"
                renderInput={params => <TextField {...params} size="small" />}
              />
              <TextField
                label="Max Participants"
                type="number"
                size="small"
                value={maxParticipants}
                onChange={e => { setMaxParticipants(Number(e.target.value)); setDirty(true); }}
              />
              <TextField
                label="Loop Distance (km)"
                type="number"
                size="small"
                value={loopDistance}
                onChange={e => { setLoopDistance(Number(e.target.value)); setDirty(true); }}
              />
              <Box display="flex" gap={1}>
                <TextField
                  label="Fee: Participation"
                  type="number"
                  size="small"
                  value={fees.participation}
                  onChange={e => { setFees(prev => ({ ...prev, participation: Number(e.target.value) })); setDirty(true); }}
                />
                <TextField
                  label="Fee: Base Camp"
                  type="number"
                  size="small"
                  value={fees.baseCamp}
                  onChange={e => { setFees(prev => ({ ...prev, baseCamp: Number(e.target.value) })); setDirty(true); }}
                />
                <TextField
                  label="Fee: Deposit"
                  type="number"
                  size="small"
                  value={fees.deposit}
                  onChange={e => { setFees(prev => ({ ...prev, deposit: Number(e.target.value) })); setDirty(true); }}
                />
                <TextField
                  label="Fee: Total"
                  type="number"
                  size="small"
                  value={fees.total}
                  onChange={e => { setFees(prev => ({ ...prev, total: Number(e.target.value) })); setDirty(true); }}
                />
              </Box>
              <Box sx={{ mt: 4, mb: 2 }}>
                <h3>Race Distances</h3>
                <List>
                  {raceDistances.map((distance, index) => (
                    <ListItem key={index} sx={{ display: 'flex', gap: 2 }}>
                      <TextField
                        label="ID"
                        value={distance.id}
                        onChange={(e) => {
                          const newDistances = [...raceDistances];
                          newDistances[index] = { ...distance, id: e.target.value };
                          setRaceDistances(newDistances);
                          setDirty(true);
                        }}
                        size="small"
                      />
                      <TextField
                        label="Display Name"
                        value={distance.displayName}
                        onChange={(e) => {
                          const newDistances = [...raceDistances];
                          newDistances[index] = { ...distance, displayName: e.target.value };
                          setRaceDistances(newDistances);
                          setDirty(true);
                        }}
                        size="small"
                      />
                      <TextField
                        label="Name (NO)"
                        value={(distance as any).displayName_no || ''}
                        onChange={(e) => {
                          const newDistances = [...raceDistances];
                          newDistances[index] = { ...distance, displayName_no: e.target.value } as any;
                          setRaceDistances(newDistances);
                          setDirty(true);
                        }}
                        size="small"
                        placeholder="Norwegian name"
                      />
                      <TextField
                        label="Name (EN)"
                        value={(distance as any).displayName_en || ''}
                        onChange={(e) => {
                          const newDistances = [...raceDistances];
                          newDistances[index] = { ...distance, displayName_en: e.target.value } as any;
                          setRaceDistances(newDistances);
                          setDirty(true);
                        }}
                        size="small"
                        placeholder="English name"
                      />
                      <TextField
                        label="Length (m)"
                        type="number"
                        value={distance.length}
                        onChange={(e) => {
                          const newDistances = [...raceDistances];
                          newDistances[index] = { ...distance, length: Number(e.target.value) };
                          setRaceDistances(newDistances);
                          setDirty(true);
                        }}
                        size="small"
                      />
                      <TextField
                        label="Ascent (m)"
                        type="number"
                        value={distance.ascent}
                        onChange={(e) => {
                          const newDistances = [...raceDistances];
                          newDistances[index] = { ...distance, ascent: Number(e.target.value) };
                          setRaceDistances(newDistances);
                          setDirty(true);
                        }}
                        size="small"
                      />
                      <TextField
                        label="Descent (m)"
                        type="number"
                        value={distance.descent}
                        onChange={(e) => {
                          const newDistances = [...raceDistances];
                          newDistances[index] = { ...distance, descent: Number(e.target.value) };
                          setRaceDistances(newDistances);
                          setDirty(true);
                        }}
                        size="small"
                      />
                      <TextField
                        label="Fee (kr)"
                        type="number"
                        value={(distance as any).fee || 0}
                        onChange={(e) => {
                          const newDistances = [...raceDistances];
                          newDistances[index] = { ...distance, fee: Number(e.target.value) } as any;
                          setRaceDistances(newDistances);
                          setDirty(true);
                        }}
                        size="small"
                      />
                      <IconButton
                        onClick={() => {
                          const newDistances = raceDistances.filter((_, i) => i !== index);
                          setRaceDistances(newDistances);
                          setDirty(true);
                        }}
                      >
                        <Trash2 />
                      </IconButton>
                    </ListItem>
                  ))}
                </List>
                <Box sx={{ display: 'flex', gap: 2, mt: 2, mb: 4 }}>
                  <TextField
                    label="ID"
                    value={newDistance.id}
                    onChange={(e) => setNewDistance({ ...newDistance, id: e.target.value })}
                    size="small"
                  />
                  <TextField
                    label="Display Name"
                    value={newDistance.displayName}
                    onChange={(e) => setNewDistance({ ...newDistance, displayName: e.target.value })}
                    size="small"
                  />
                  <TextField
                    label="Name (NO)"
                    value={newDistance.displayName_no || ''}
                    onChange={(e) => setNewDistance({ ...newDistance, displayName_no: e.target.value })}
                    size="small"
                    placeholder="Norwegian"
                  />
                  <TextField
                    label="Name (EN)"
                    value={newDistance.displayName_en || ''}
                    onChange={(e) => setNewDistance({ ...newDistance, displayName_en: e.target.value })}
                    size="small"
                    placeholder="English"
                  />
                  <TextField
                    label="Length (m)"
                    type="number"
                    value={newDistance.length}
                    onChange={(e) => setNewDistance({ ...newDistance, length: Number(e.target.value) })}
                    size="small"
                  />
                  <TextField
                    label="Ascent (m)"
                    type="number"
                    value={newDistance.ascent}
                    onChange={(e) => setNewDistance({ ...newDistance, ascent: Number(e.target.value) })}
                    size="small"
                  />
                  <TextField
                    label="Descent (m)"
                    type="number"
                    value={newDistance.descent}
                    onChange={(e) => setNewDistance({ ...newDistance, descent: Number(e.target.value) })}
                    size="small"
                  />
                  <TextField
                    label="Fee (kr)"
                    type="number"
                    value={newDistance.fee || 0}
                    onChange={(e) => setNewDistance({ ...newDistance, fee: Number(e.target.value) })}
                    size="small"
                  />
                  <Button
                    variant="contained"
                    onClick={() => {
                      if (!newDistance.id || !newDistance.displayName) {
                        window.alert('ID and Display Name are required for race distances');
                        return;
                      }
                      setRaceDistances([...raceDistances, newDistance]);
                      setNewDistance({ id: '', name: '', distance: 0, displayName: '', displayName_no: '', displayName_en: '', length: 0, ascent: 0, descent: 0, fee: 0 });
                      setDirty(true);
                    }}
                  >
                    Add Distance
                  </Button>
                </Box>
                <Box sx={{ mt: 2 }}>
                  <Button variant="contained" color="primary" onClick={handleSave} disabled={!dirty}>
                    Save
                  </Button>
                </Box>
              </Box>
              <Box display="flex" gap={1}>
                <Button variant="outlined" size="small" color="error" onClick={handleDelete}>Delete</Button>
              </Box>
            </Box>
          )
        )}
        <Snackbar open={snackbarOpen} autoHideDuration={3000} onClose={() => setSnackbarOpen(false)}>
          <Alert severity="success" onClose={() => setSnackbarOpen(false)}>Saved successfully</Alert>
        </Snackbar>
      </Box>
    </LocalizationProvider>
  );
};

export default EventEditionsPanel;
