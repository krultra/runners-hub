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
      setLoadingData(false);
      setDirty(false);
    })();
  }, [selectedId]);

  const handleCreate = async () => {
    if (dirty && !window.confirm('Discard unsaved changes and create a new edition?')) return;
    const payload = {
      eventId: '',
      edition: 1,
      eventShortName: '',
      eventName: '',
      status: '',
      resultTypes: [],
      resultsStatus: '',
      startTime: Timestamp.fromDate(new Date()),
      endTime: Timestamp.fromDate(new Date()),
      registrationDeadline: Timestamp.fromDate(new Date()),
      maxParticipants: 0,
      loopDistance: 0,
      fees: { participation: 0, baseCamp: 0, deposit: 0, total: 0 }
    };
    const id = await addEventEdition(payload);
    setSelectedId(id);
    const data = await listEventEditions();
    setSummaries(data);
  };

  const handleSave = async () => {
    if (!selectedId) return;
    if (!startDate || !endDate) { window.alert('Please set both dates'); return; }
    if (startDate > endDate) { window.alert('Start time must be before end time'); return; }
    if (!dirty) return;
    if (summaries.some(s => s.eventId === eventId && s.edition === editionNum && s.id !== selectedId)) { window.alert('An edition with this Event ID and edition number already exists'); return; }
    await updateEventEdition(selectedId, {
      eventId,
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
      fees
    });
    const data = await listEventEditions();
    setSummaries(data);
    setSnackbarOpen(true);
    setDirty(false);
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
              <Box display="flex" gap={1}>
                <Button variant="contained" size="small" onClick={handleSave} disabled={!dirty}>Save Changes</Button>
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
