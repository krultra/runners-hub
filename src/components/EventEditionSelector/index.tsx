import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  Box, 
  FormControl, 
  InputLabel, 
  Select, 
  MenuItem, 
  TextField, 
  Paper,
  Grid,
  CircularProgress,
  Alert,
  InputAdornment,
  IconButton,
  Typography,
  SelectChangeEvent
} from '@mui/material';
import { X } from 'lucide-react';
import { formatLongDate } from '../../utils/dateFormatter';
import { Timestamp } from 'firebase/firestore';
import { useEventEdition, CurrentEvent } from '../../contexts/EventEditionContext';
import { getFullEventEditions } from '../../services/eventEditionService';

interface EventEditionSelectorProps {
  label?: string;
  fullWidth?: boolean;
  variant?: 'outlined' | 'standard' | 'filled';
  size?: 'small' | 'medium';
  className?: string;
  showFilters?: boolean;
  defaultStatusFilter?: string[];
  defaultYearFilter?: number | 'all';
  defaultNameFilter?: string;
  onSelect?: (edition: CurrentEvent | null) => void;
}

// Helper function to safely convert Firestore Timestamp to Date
const toDate = (timestamp?: Timestamp | Date | null): Date | undefined => {
  if (!timestamp) return undefined;
  return timestamp instanceof Date ? timestamp : timestamp.toDate();
};

// Helper function to get year from a date
const getYear = (date: Date | Timestamp | undefined): number => {
  const dateObj = toDate(date);
  return dateObj ? dateObj.getFullYear() : new Date().getFullYear();
};

// Helper function to format date in a user-friendly way with Oslo timezone
const formatDisplayDate = (date: Date | Timestamp | undefined): string => {
  if (!date) return 'N/A';
  const dateObj = toDate(date);
  return dateObj ? formatLongDate(dateObj, 'Europe/Oslo') : 'N/A';
};

const EventEditionSelector: React.FC<EventEditionSelectorProps> = ({
  label = 'Select Event Edition',
  fullWidth = true,
  variant = 'outlined',
  size = 'medium',
  className = '',
  showFilters = true,
  defaultStatusFilter = [],
  defaultYearFilter = 'all',
  defaultNameFilter = '',
  onSelect
}) => {
  const { event: selectedEvent, setEvent } = useEventEdition();
  const [editions, setEditions] = useState<CurrentEvent[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string[]>(defaultStatusFilter);
  const [yearFilter, setYearFilter] = useState<number | 'all'>(defaultYearFilter);
  const [nameFilter, setNameFilter] = useState<string>(defaultNameFilter);

  // Fetch event editions on mount
  useEffect(() => {
    const fetchEventEditions = async () => {
      try {
        setLoading(true);
        const editionsList = await getFullEventEditions();
        // Convert Firestore Timestamps to Date objects
        const convertedEditions = editionsList.map(edition => ({
          ...edition,
          startTime: toDate(edition.startTime) || new Date(),
          endTime: toDate(edition.endTime) || new Date(),
          registrationDeadline: edition.registrationDeadline ? toDate(edition.registrationDeadline) : null
        }));
        setEditions(convertedEditions as CurrentEvent[]);
      } catch (err) {
        console.error('Error fetching event editions:', err);
        setError('Failed to load event editions');
      } finally {
        setLoading(false);
      }
    };

    fetchEventEditions();
  }, []);

  // Filter and sort editions based on current filters
  const filteredEditions = useMemo(() => {
    return editions
      .filter(edition => {
        const matchesStatus = statusFilter.length === 0 || 
          (edition.status && statusFilter.includes(edition.status));
        const matchesYear = yearFilter === 'all' || 
          (edition.startTime && getYear(edition.startTime) === yearFilter);
        const matchesSearch = nameFilter === '' || 
          (edition.eventName && edition.eventName.toLowerCase().includes(nameFilter.toLowerCase()));
        return matchesStatus && matchesYear && matchesSearch;
      })
      .sort((a, b) => {
        const aStart = a.startTime ? new Date(a.startTime).getTime() : 0;
        const bStart = b.startTime ? new Date(b.startTime).getTime() : 0;
        return bStart - aStart; // Sort newest first
      });
  }, [editions, statusFilter, yearFilter, nameFilter]);

  // Get unique years from all editions for the year filter
  const availableYears = useMemo(() => {
    const years = new Set<number>();
    editions.forEach(edition => {
      if (edition.startTime) {
        years.add(getYear(edition.startTime));
      }
    });
    return Array.from(years).sort((a, b) => b - a); // Sort years in descending order
  }, [editions]);

  // Get unique statuses from all editions for the status filter
  const availableStatuses = useMemo(() => {
    const statuses = new Set<string>();
    editions.forEach(edition => {
      if (edition.status) {
        statuses.add(edition.status);
      }
    });
    return Array.from(statuses).sort();
  }, [editions]);

  const handleEditionSelect = useCallback((event: SelectChangeEvent<string>) => {
    const editionId = event.target.value;
    if (editionId === '') {
      setEvent(null);
      if (onSelect) onSelect(null);
      return;
    }

    const selected = editions.find(e => e.id === editionId);
    if (selected) {
      setEvent(selected);
      if (onSelect) onSelect(selected);
    }
  }, [editions, onSelect, setEvent]);

  const handleStatusFilterChange = (event: SelectChangeEvent<string[]>) => {
    const value = event.target.value;
    setStatusFilter(typeof value === 'string' ? value.split(',') : value);
  };

  const handleYearFilterChange = (event: SelectChangeEvent<string | number>) => {
    const value = event.target.value;
    setYearFilter(value === 'all' ? 'all' : Number(value));
  };

  const handleNameFilterChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setNameFilter(event.target.value);
  };

  const clearFilters = () => {
    setStatusFilter([]);
    setYearFilter('all');
    setNameFilter('');
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" p={2}>
        <CircularProgress size={24} />
      </Box>
    );
  }

  if (error) {
    return (
      <Alert severity="error" sx={{ mb: 2 }}>
        {error}
      </Alert>
    );
  }

  return (
    <Paper elevation={1} sx={{ p: 2, mb: 3 }}>
      <Grid container spacing={2}>
        {/* Event Selection */}
        <Grid item xs={12} md={showFilters ? 6 : 12}>
          <FormControl fullWidth variant={variant} size={size}>
            <InputLabel id="event-edition-select-label">{label}</InputLabel>
            <Select
              labelId="event-edition-select-label"
              id="event-edition-select"
              value={selectedEvent?.id || ''}
              label={label}
              onChange={handleEditionSelect}
              fullWidth={fullWidth}
            >
              <MenuItem value="">
                <em>None</em>
              </MenuItem>
              {filteredEditions.map((edition) => (
                <MenuItem key={edition.id} value={edition.id}>
                  {edition.eventName} ({formatDisplayDate(edition.startTime)})
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Grid>

        {showFilters && (
          <Grid item xs={12} md={6}>
            <Box display="flex" gap={2} flexWrap="wrap">
              {/* Status Filter */}
              <FormControl variant={variant} size={size} sx={{ minWidth: 120, flex: 1 }}>
                <InputLabel>Status</InputLabel>
                <Select
                  multiple
                  value={statusFilter}
                  onChange={handleStatusFilterChange}
                  renderValue={(selected) => (
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                      {selected.map((value) => (
                        <span key={value}>{value}</span>
                      ))}
                    </Box>
                  )}
                  label="Status"
                >
                  {availableStatuses.map((status) => (
                    <MenuItem key={status} value={status}>
                      {status}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              {/* Year Filter */}
              <FormControl variant={variant} size={size} sx={{ minWidth: 120 }}>
                <InputLabel>Year</InputLabel>
                <Select
                  value={yearFilter}
                  onChange={handleYearFilterChange}
                  label="Year"
                >
                  <MenuItem value="all">All Years</MenuItem>
                  {availableYears.map((year) => (
                    <MenuItem key={year} value={year}>
                      {year}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              {/* Name Search */}
              <TextField
                variant={variant}
                size={size}
                placeholder="Search events..."
                value={nameFilter}
                onChange={handleNameFilterChange}
                InputProps={{
                  endAdornment: nameFilter && (
                    <InputAdornment position="end">
                      <IconButton size="small" onClick={() => setNameFilter('')}>
                        <X size={16} />
                      </IconButton>
                    </InputAdornment>
                  ),
                }}
              />

              {(statusFilter.length > 0 || yearFilter !== 'all' || nameFilter) && (
                <IconButton size="small" onClick={clearFilters} title="Clear filters">
                  <X />
                </IconButton>
              )}
            </Box>
          </Grid>
        )}
      </Grid>

      {selectedEvent && (
        <Box mt={2} p={2} bgcolor="action.hover" borderRadius={1}>
          <Typography variant="subtitle2" gutterBottom>
            Selected Event Details:
          </Typography>
          <Typography variant="body2">
            <strong>Name:</strong> {selectedEvent.eventName}
          </Typography>
          <Typography variant="body2">
            <strong>Status:</strong> {selectedEvent.status}
          </Typography>
          <Typography variant="body2">
            <strong>Date:</strong> {formatDisplayDate(selectedEvent.startTime)}
            {selectedEvent.endTime && ` to ${formatDisplayDate(selectedEvent.endTime)}`}
          </Typography>
          {selectedEvent.registrationDeadline && (
            <Typography variant="body2">
              <strong>Registration Deadline:</strong> {formatDisplayDate(selectedEvent.registrationDeadline)}
            </Typography>
          )}
          {selectedEvent.maxParticipants && (
            <Typography variant="body2">
              <strong>Max Participants:</strong> {selectedEvent.maxParticipants}
            </Typography>
          )}
        </Box>
      )}
    </Paper>
  );
};

export default EventEditionSelector;
