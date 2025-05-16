import React, { useState, useEffect, FC } from 'react';
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
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { DateTimePicker } from '@mui/x-date-pickers/DateTimePicker';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import nbLocale from 'date-fns/locale/nb';
import DeleteIcon from '@mui/icons-material/Delete';
import {
  Timestamp
} from 'firebase/firestore';
import {
  listEventEditions,
  addEventEdition,
  getEventEdition,
  updateEventEdition,
  deleteEventEdition,
  EventEditionSummary
} from '../../services/eventEditionService';
import { listCodeList } from '../../services/codeListService';

const EventEditionsPanel: FC = () => {
  const [summaries, setSummaries] = useState<EventEditionSummary[]>([]);
  const [selectedId, setSelectedId] = useState<string>('');
  const [loadingSummaries, setLoadingSummaries] = useState(false);
  const [loadingData, setLoadingData] = useState(false);

  const [availableStatuses, setAvailableStatuses] = useState<string[]>([]);

  const [eventId, setEventId] = useState<string>('');
  const [editionNum, setEditionNum] = useState<number>(1);
  const [eventShortName, setEventShortName] = useState<string>('');
  const [eventName, setEventName] = useState<string>('');
  const [status, setStatus] = useState<string>('');
  const [resultTypes, setResultTypes] = useState<string[]>([]);
  const [resultsStatus, setResultsStatus] = useState<string>('');
  const [startDate, setStartDate] = useState<Date | null>(null);
  const [endDate, setEndDate] = useState<Date | null>(null);
  const [registrationDeadline, setRegistrationDeadline] = useState<Date | null>(null);
  const [maxParticipants, setMaxParticipants] = useState<number>(0);
  const [loopDistance, setLoopDistance] = useState<number>(0);
  const [fees, setFees] = useState<{ participation: number; baseCamp: number; deposit: number; total: number }>({ participation: 0, baseCamp: 0, deposit: 0, total: 0 });
  const [raceDistances, setRaceDistances] = useState<Array<{ id: string; displayName: string; length: number; ascent: number; descent: number }>>([]);
  const [newDistance, setNewDistance] = useState<{ id: string; displayName: string; length: number; ascent: number; descent: number }>({ id: '', displayName: '', length: 0, ascent: 0, descent: 0 });
  const [dirty, setDirty] = useState(false);
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [newRtSelect, setNewRtSelect] = useState<string>('');


  useEffect(() => {
    (async () => {
      setLoadingSummaries(true);
      const data = await listEventEditions();
      setSummaries(data);
      setLoadingSummaries(false);
    })();
  }, []);

  useEffect(() => {
    listCodeList('status', 'results').then(data =>
      setAvailableStatuses(data.map(d => d.code))
    );
  }, []);

  useEffect(() => {
    if (!selectedId) {
      return;
    }
    (async () => {
      setLoadingData(true);
      const data = await getEventEdition(selectedId);
      setEventId(data.eventId);
      setEditionNum(data.edition);
      setEventShortName(data.eventShortName);
      setEventName(data.eventName);
      setStatus(data.status);
      setResultTypes(data.resultTypes || []);
      setResultsStatus(data.resultsStatus || '');
      setStartDate(data.startTime.toDate());
      setEndDate(data.endTime.toDate());
      setRegistrationDeadline(data.registrationDeadline?.toDate() || null);
      setMaxParticipants(data.maxParticipants || 0);
      setLoopDistance(data.loopDistance || 0);
      setFees(data.fees || { participation: 0, baseCamp: 0, deposit: 0, total: 0 });
      setRaceDistances(data.raceDistances || []);
      setLoadingData(false);
      setDirty(false);
    })();
  }, [selectedId]);

  const handleCreate = () => {
    if (dirty && !window.confirm('Discard unsaved changes and create a new edition?')) return;
    
    // Clear the selected ID to indicate we're creating a new event
    // that hasn't been saved to the database yet
    setSelectedId('');
    
    // Initialize form with empty values
    setEventId('');
    setEditionNum(1);
    setEventShortName('');
    setEventName('');
    setStatus('');
    setResultTypes([]);
    setResultsStatus('');
    setStartDate(new Date());
    setEndDate(new Date());
    setRegistrationDeadline(new Date());
    setMaxParticipants(0);
    setLoopDistance(0);
    setFees({ participation: 0, baseCamp: 0, deposit: 0, total: 0 });
    setRaceDistances([]);
    setNewDistance({ id: '', displayName: '', length: 0, ascent: 0, descent: 0 });
    
    // Set dirty to true to indicate we have unsaved changes
    setDirty(true);
    
    console.log('New event edition form initialized - not yet saved to database');
  };

  const handleSave = async () => {
    // Validate required fields regardless of create/update
    if (!eventId || eventId.trim() === '') {
      window.alert('Event ID is required. Please enter a valid ID like "mo" for Malvikingen Opp.');
      return;
    }
    
    if (typeof editionNum !== 'number' || isNaN(editionNum) || editionNum <= 0) {
      window.alert('Edition must be a positive number, like 2025 for the year of the event.');
      return;
    }
    
    if (!startDate || !endDate) { 
      window.alert('Please set both start and end dates'); 
      return; 
    }
    
    if (startDate > endDate) { 
      window.alert('Start time must be before end time'); 
      return; 
    }
    
    if (!dirty) return;
    
    // Check for duplicate event editions
    const safeEventId = eventId.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
    const documentId = `${safeEventId}-${editionNum}`;
    
    // Only check for duplicates that aren't the current document
    if (summaries.some(s => s.eventId === eventId && s.edition === editionNum && 
                          (!selectedId || s.id !== selectedId))) { 
      window.alert('An edition with this Event ID and edition number already exists'); 
      return; 
    }
    
    // Prepare the payload for both create and update
    const payload = {
      eventId: eventId.trim(),
      edition: editionNum,
      eventShortName,
      eventName,
      status,
      resultTypes,
      resultsStatus,
      startTime: Timestamp.fromDate(startDate),
      endTime: Timestamp.fromDate(endDate),
      registrationDeadline: registrationDeadline ? Timestamp.fromDate(registrationDeadline) : undefined,
      maxParticipants,
      loopDistance,
      fees,
      raceDistances
    };
    
    try {
      let newId = selectedId;
      
      // Creating a new document
      if (!selectedId) {
        console.log(`Creating new event edition with ID: ${documentId}, eventId: ${eventId}, edition: ${editionNum}`);
        newId = await addEventEdition(payload);
        console.log(`New event edition created with ID: ${newId}`);
      } 
      // Updating an existing document
      else {
        console.log(`Updating event edition with ID: ${selectedId}, eventId: ${eventId}, edition: ${editionNum}`);
        await updateEventEdition(selectedId, payload);
        console.log('Event edition updated successfully');
      }
      
      // Refresh the list and select the newly created or updated item
      const data = await listEventEditions();
      setSummaries(data);
      setSelectedId(newId);
      setSnackbarOpen(true);
      setDirty(false);
    } catch (error) {
      console.error('Error saving event edition:', error);
      window.alert(`Error saving event: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  const handleDelete = async () => {
    if (!selectedId) return;
    const ok = window.confirm('Delete this event edition? This cannot be undone.');
    if (!ok) return;
    await deleteEventEdition(selectedId);
    setSelectedId('');
    const data = await listEventEditions();
    setSummaries(data);
  };

  const handleCopy = async () => {
    if (dirty && !window.confirm('Discard unsaved changes and copy edition?')) return;
    if (!startDate || !endDate) { window.alert('Please set both dates'); return; }
    const d1 = new Date(startDate);
    d1.setFullYear(d1.getFullYear() + 1);
    const d2 = new Date(endDate);
    d2.setFullYear(d2.getFullYear() + 1);
    const newEdition = editionNum + 1;
    if (summaries.some(s => s.eventId === eventId && s.edition === newEdition)) { window.alert('An edition with this Event ID and edition number already exists'); return; }
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
      registrationDeadline: registrationDeadline ? Timestamp.fromDate(registrationDeadline) : Timestamp.fromDate(new Date()),
      maxParticipants,
      loopDistance,
      fees
    };
    const newId = await addEventEdition(payload);
    const summariesData = await listEventEditions();
    setSummaries(summariesData);
    setSelectedId(newId);
    setDirty(false);
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
        <Box mb={2} fontWeight="bold">Event Editions</Box>
        <Box display="flex" gap={2} mb={2} alignItems="center">
          <FormControl sx={{ minWidth: 250 }}>
            <InputLabel id="edition-select-label">Select Edition</InputLabel>
            <Select
              labelId="edition-select-label"
              value={selectedId}
              label="Select Edition"
              onChange={e => {
                if (dirty && !window.confirm('Discard unsaved changes?')) return;
                setSelectedId(e.target.value);
              }}
              disabled={loadingSummaries}
            >
              {summaries.map(s => (
                <MenuItem key={s.id} value={s.id}>
                  {`${s.eventId}-${s.edition}`}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <Button variant="contained" onClick={handleCreate}>New Edition</Button>
          <Button variant="contained" onClick={handleCopy} disabled={!selectedId}>Copy</Button>

        </Box>

        {loadingData ? (
          <CircularProgress size={24} />
        ) : (
          selectedId && (
            <Box display="flex" flexDirection="column" gap={2}>
              <TextField label="Short Event Name" value={eventShortName} onChange={e => { setEventShortName(e.target.value); setDirty(true); }} />
              <TextField label="Full Event Name" value={eventName} onChange={e => { setEventName(e.target.value); setDirty(true); }} />
              <TextField label="Status" value={status} onChange={e => { setStatus(e.target.value); setDirty(true); }} />
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
                          <DeleteIcon />
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
                  onChange={e => { setResultsStatus(e.target.value); setDirty(true); }}
                >
                  {availableStatuses.map(st => (
                    <MenuItem key={st} value={st}>{st}</MenuItem>
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
                        label="Length (km)"
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
                      <IconButton
                        onClick={() => {
                          const newDistances = raceDistances.filter((_, i) => i !== index);
                          setRaceDistances(newDistances);
                          setDirty(true);
                        }}
                      >
                        <DeleteIcon />
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
                    label="Length (km)"
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
                  <Button
                    variant="contained"
                    onClick={() => {
                      if (!newDistance.id || !newDistance.displayName) {
                        window.alert('ID and Display Name are required for race distances');
                        return;
                      }
                      setRaceDistances([...raceDistances, newDistance]);
                      setNewDistance({ id: '', displayName: '', length: 0, ascent: 0, descent: 0 });
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
