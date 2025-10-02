import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  AlertColor,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Typography,
} from '@mui/material';

import { useEventEdition } from '../../contexts/EventEditionContext';
import { listCodeList, CodeListItem } from '../../services/codeListService';
import { updateEventEdition } from '../../services/eventEditionService';

const WARNING_WINDOW_MS = 60 * 60 * 1000; // 1 hour

const formatDateTime = (value: Date | null | undefined) =>
  value ? value.toLocaleString('nb-NO', { dateStyle: 'short', timeStyle: 'short' }) : 'ukjent tidspunkt';

interface FeedbackMessage {
  severity: AlertColor;
  message: string;
}

const ResultsStatusBanner: React.FC = () => {
  const { event, setEvent } = useEventEdition();
  const [statusOptions, setStatusOptions] = useState<CodeListItem[]>([]);
  const [loadingOptions, setLoadingOptions] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState<string>('');
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<FeedbackMessage | null>(null);
  const [currentTime, setCurrentTime] = useState(() => new Date());
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Refresh current time every minute so the banner condition updates automatically
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 60_000);
    return () => clearInterval(timer);
  }, []);

  // Load result status options once
  useEffect(() => {
    let isMounted = true;
    setLoadingOptions(true);
    listCodeList('status', 'results')
      .then(items => {
        if (!isMounted) return;
        setStatusOptions(items);
        setLoadError(null);
      })
      .catch(err => {
        console.error('Failed to load results status code list', err);
        if (isMounted) setLoadError('Kunne ikke laste resultatstatusene. Prøv å laste siden på nytt.');
      })
      .finally(() => {
        if (isMounted) setLoadingOptions(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const startTime = event?.startTime ?? null;
  const endTime = event?.endTime ?? null;

  const currentStatusInfo = useMemo(() => {
    if (!event?.resultsStatus) return undefined;
    return statusOptions.find(option => option.code === event.resultsStatus);
  }, [event?.resultsStatus, statusOptions]);

  const currentStatusLabel = currentStatusInfo?.verboseName || currentStatusInfo?.code || event?.resultsStatus || 'ukjent';

  const currentStatusSortOrder = currentStatusInfo?.sortOrder ?? (event?.resultsStatus === 'notStarted' ? 0 : undefined);
  const isEarlyStatus = typeof currentStatusSortOrder === 'number' ? currentStatusSortOrder < 6 : event?.resultsStatus === 'notStarted';

  const hasReachedWarningWindow = !!startTime && currentTime.getTime() >= startTime.getTime() - WARNING_WINDOW_MS;
  const isAfterEnd = !!endTime && currentTime > endTime;

  const shouldShowBanner = Boolean(event && isEarlyStatus && hasReachedWarningWindow);

  const warningMessage = useMemo(() => {
    if (!event || !startTime) return '';

    if (isAfterEnd && isEarlyStatus) {
      return `Løpet ble avsluttet ${formatDateTime(endTime)} men resultatstatus er fortsatt «${currentStatusLabel}». Oppdater status så snart som mulig.`;
    }

    if (currentTime >= startTime) {
      return `Løpet er i gang, men resultatstatus er fortsatt «${currentStatusLabel}». Oppdater status for å vise fremdrift.`;
    }

    return `Løpet starter ${formatDateTime(startTime)} og resultatstatus er «${currentStatusLabel}». Forbered og oppdater status før start.`;
  }, [currentStatusLabel, currentTime, endTime, event, isAfterEnd, isEarlyStatus, startTime]);

  const availableStatuses = useMemo(() => {
    if (!event) return [];
    return statusOptions.filter(option => option.code !== event.resultsStatus);
  }, [event, statusOptions]);

  useEffect(() => {
    if (dialogOpen && availableStatuses.length > 0) {
      setSelectedStatus(prev => {
        if (prev && availableStatuses.some(option => option.code === prev)) {
          return prev;
        }
        return availableStatuses[0]?.code ?? '';
      });
    }
  }, [dialogOpen, availableStatuses]);

  const handleOpenDialog = () => {
    setSaveError(null);
    if (!availableStatuses.length) {
      setFeedback({ severity: 'error', message: 'Ingen alternative resultatstatuser er tilgjengelige.' });
      return;
    }
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setSaveError(null);
  };

  const handleSaveStatus = async () => {
    if (!event || !selectedStatus) return;
    try {
      setSaving(true);
      setSaveError(null);
      await updateEventEdition(event.id, { resultsStatus: selectedStatus });
      await setEvent({ resultsStatus: selectedStatus });
      const label = statusOptions.find(option => option.code === selectedStatus)?.verboseName || selectedStatus;
      setFeedback({ severity: 'success', message: `Resultatstatus oppdatert til «${label}».` });
      setDialogOpen(false);
    } catch (err) {
      console.error('Failed to update results status', err);
      setSaveError('Kunne ikke oppdatere resultatstatus. Prøv igjen.');
    } finally {
      setSaving(false);
    }
  };

  if (!shouldShowBanner) {
    return feedback ? (
      <Box sx={{ mt: 2 }}>
        <Alert severity={feedback.severity} onClose={() => setFeedback(null)}>{feedback.message}</Alert>
      </Box>
    ) : null;
  }

  return (
    <Box sx={{ mt: 2 }}>
      <Stack spacing={2}>
        <Alert
          severity={isAfterEnd ? 'error' : 'warning'}
          action={
            <Button color="inherit" size="small" onClick={handleOpenDialog} disabled={loadingOptions}>
              Oppdater status
            </Button>
          }
        >
          <Stack spacing={1}>
            <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
              Resultatstatus krever oppdatering
            </Typography>
            <Typography variant="body2">{warningMessage}</Typography>
            <Typography variant="body2">
              Nåværende status: <strong>{currentStatusLabel}</strong>
              {loadingOptions && (
                <Box component="span" sx={{ ml: 1, display: 'inline-flex', verticalAlign: 'middle' }}>
                  <CircularProgress size={16} thickness={5} />
                </Box>
              )}
            </Typography>
            {loadError && (
              <Typography variant="body2" color="error">
                {loadError}
              </Typography>
            )}
          </Stack>
        </Alert>

        {feedback && (
          <Alert severity={feedback.severity} onClose={() => setFeedback(null)}>
            {feedback.message}
          </Alert>
        )}
      </Stack>

      <Dialog open={dialogOpen} onClose={saving ? undefined : handleCloseDialog} maxWidth="sm" fullWidth>
        <DialogTitle>Oppdater resultatstatus</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ mb: 2 }}>
            Velg ny resultatstatus for {event?.eventName} {event?.edition}.
          </Typography>
          <FormControl fullWidth sx={{ mt: 1 }}>
            <InputLabel id="results-status-select-label">Ny resultatstatus</InputLabel>
            <Select
              labelId="results-status-select-label"
              label="Ny resultatstatus"
              value={selectedStatus}
              onChange={e => setSelectedStatus(e.target.value)}
              disabled={saving || !availableStatuses.length}
            >
              {availableStatuses.map(option => (
                <MenuItem key={option.id} value={option.code}>
                  {option.verboseName || option.code}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          {saveError && (
            <Alert severity="error" sx={{ mt: 2 }}>
              {saveError}
            </Alert>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={handleCloseDialog} disabled={saving}>
            Avbryt
          </Button>
          <Button onClick={handleSaveStatus} variant="contained" disabled={saving || !selectedStatus}>
            {saving ? <CircularProgress size={20} thickness={5} /> : 'Lagre status'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default ResultsStatusBanner;
