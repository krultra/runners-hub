import React, { useEffect, useMemo, useState } from 'react';
import {
  Container,
  Typography,
  Box,
  CircularProgress,
  Alert,
  Paper,
  Grid,
  Chip,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Button,
  Divider,
  Collapse,
  TextField,
  Tooltip,
  InputAdornment
} from '@mui/material';
import { useParams, useNavigate, Link as RouterLink } from 'react-router-dom';
import { ChevronRight, ExpandMore, InfoOutlined } from '@mui/icons-material';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import { isAdminUser } from '../utils/adminUtils';
import {
  getRunnerProfile,
  RunnerParticipation,
  RunnerProfile,
  RunnerProfileEditableDetails,
  updateRunnerProfileDetails
} from '../services/runnerProfileService';

const formatTimeDisplay = (display: string | null | undefined, seconds: number | null | undefined): string => {
  if (display && display.trim().length > 0) {
    return display;
  }
  if (!seconds || seconds <= 0) {
    return '—';
  }
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  const parts = [hrs, mins, secs]
    .map((value) => value.toString().padStart(2, '0'))
    .join(':');
  return parts;
};

const formatRank = (rank: number | null | undefined): string => {
  if (rank === null || rank === undefined || rank <= 0) {
    return '—';
  }
  return `#${rank}`;
};

const formatLoops = (loops: number | undefined): string => {
  if (!loops || loops <= 0) {
    return '—';
  }
  return loops.toString();
};

const formatYears = (years: number[]): string => {
  if (!years || years.length === 0) {
    return '—';
  }
  return years.join(', ');
};

const RunnerProfilePage: React.FC = () => {
  const { userId } = useParams<{ userId: string }>();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<RunnerProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [authUserId, setAuthUserId] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);
  const [detailsExpanded, setDetailsExpanded] = useState(false);
  const [editableDetails, setEditableDetails] = useState<RunnerProfileEditableDetails | null>(null);
  const [detailsSaving, setDetailsSaving] = useState(false);
  const [detailsSuccess, setDetailsSuccess] = useState(false);
  const [detailsError, setDetailsError] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) return;
    let isMounted = true;

    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await getRunnerProfile(userId);
        if (isMounted) {
          setProfile(data);
        }
      } catch (err: any) {
        if (isMounted) {
          setError(err?.message || 'Failed to load runner profile');
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    load();
    return () => {
      isMounted = false;
    };
  }, [userId]);

  useEffect(() => {
    let isMounted = true;
    const auth = getAuth();
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (!isMounted) {
        return;
      }
      setAuthUserId(user?.uid ?? null);
      if (user?.email) {
        isAdminUser(user.email)
          .then((flag) => {
            if (isMounted) {
              setIsAdmin(Boolean(flag));
              setAuthLoading(false);
            }
          })
          .catch(() => {
            if (isMounted) {
              setIsAdmin(false);
              setAuthLoading(false);
            }
          });
      } else {
        setIsAdmin(false);
        setAuthLoading(false);
      }
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!profile) {
      setEditableDetails(null);
      return;
    }

    const sanitizedCode = (profile.phoneCountryCode ?? '').replace(/^\+/, '').replace(/\D/g, '');
    const sanitizedPhone = (profile.phone ?? '').replace(/\D/g, '');

    setEditableDetails({
      firstName: profile.firstName ?? '',
      lastName: profile.lastName ?? '',
      phoneCountryCode: sanitizedCode,
      phone: sanitizedPhone
    });
    setDetailsError(null);
  }, [profile]);

  const stats = useMemo(() => {
    if (!profile) {
      return null;
    }
    const appearanceLabel = profile.totalAppearances === 1 ? 'appearance' : 'appearances';
    const totalLoopsLabel = profile.totalLoops === 1 ? 'loop' : 'loops';
    return {
      name: `${profile.firstName} ${profile.lastName}`.trim(),
      appearances: `${profile.totalAppearances} ${appearanceLabel}`,
      years: formatYears(profile.appearanceYears),
      totalLoops: `${profile.totalLoops} ${totalLoopsLabel}`,
      best: profile.bestPerformance
        ? `${profile.bestPerformance.loops} loops • ${formatTimeDisplay(profile.bestPerformance.totalTimeDisplay, profile.bestPerformance.totalTimeSeconds)} (${profile.bestPerformance.year})`
        : '—'
    };
  }, [profile]);

  const canEdit = Boolean(profile) && !authLoading && (authUserId === profile?.userId || isAdmin);

  const hasDetailsChanged = useMemo(() => {
    if (!profile || !editableDetails) {
      return false;
    }
    const sanitizedProfileCode = (profile.phoneCountryCode ?? '').replace(/^\+/, '').replace(/\D/g, '');
    const sanitizedProfilePhone = (profile.phone ?? '').replace(/\D/g, '');
    return (
      editableDetails.firstName !== (profile.firstName ?? '') ||
      editableDetails.lastName !== (profile.lastName ?? '') ||
      (editableDetails.phoneCountryCode ?? '') !== sanitizedProfileCode ||
      (editableDetails.phone ?? '') !== sanitizedProfilePhone
    );
  }, [profile, editableDetails]);

  const handleDetailChange = (field: keyof RunnerProfileEditableDetails) => (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    let value = event.target.value;
    if (field === 'phoneCountryCode') {
      value = value.replace(/\D/g, '').slice(0, 4);
    } else if (field === 'phone') {
      value = value.replace(/\D/g, '').slice(0, 15);
    }

    setEditableDetails((prev) => (prev ? { ...prev, [field]: value } : prev));
    setDetailsSuccess(false);
    setDetailsError(null);
  };

  const handleCancelDetails = () => {
    if (!profile) {
      return;
    }
    const sanitizedCode = (profile.phoneCountryCode ?? '').replace(/^\+/, '').replace(/\D/g, '');
    const sanitizedPhone = (profile.phone ?? '').replace(/\D/g, '');

    setEditableDetails({
      firstName: profile.firstName ?? '',
      lastName: profile.lastName ?? '',
      phoneCountryCode: sanitizedCode,
      phone: sanitizedPhone
    });
    setDetailsSuccess(false);
    setDetailsError(null);
  };

  const handleSaveDetails = async () => {
    if (!profile || !editableDetails || !hasDetailsChanged) {
      return;
    }

    setDetailsSaving(true);
    setDetailsError(null);
    try {
      const sanitizedCode = (editableDetails.phoneCountryCode ?? '').replace(/\D/g, '');
      const sanitizedPhone = (editableDetails.phone ?? '').replace(/\D/g, '');
      const storedCode = sanitizedCode ? `+${sanitizedCode}` : '';

      await updateRunnerProfileDetails(profile.userId, {
        firstName: editableDetails.firstName,
        lastName: editableDetails.lastName,
        phoneCountryCode: storedCode,
        phone: sanitizedPhone
      });

      setProfile((prev) =>
        prev
          ? {
              ...prev,
              firstName: editableDetails.firstName,
              lastName: editableDetails.lastName,
              phoneCountryCode: storedCode,
              phone: sanitizedPhone
            }
          : prev
      );
      setDetailsSuccess(true);
    } catch (err: any) {
      setDetailsError(err?.message || 'Failed to update personal details');
    } finally {
      setDetailsSaving(false);
    }
  };

  const renderParticipations = (participations: RunnerParticipation[]) => {
    if (participations.length === 0) {
      return (
        <Paper sx={{ p: 4, textAlign: 'center' }}>
          <Typography variant="body1" color="text.secondary">
            This runner has no results registered in the Runners Hub so far.
          </Typography>
        </Paper>
      );
    }

    return (
      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Edition</TableCell>
              <TableCell>Race</TableCell>
              <TableCell align="right">Race rank</TableCell>
              <TableCell align="right">Race time</TableCell>
              <TableCell align="right">Total rank</TableCell>
              <TableCell align="right">Total loops</TableCell>
              <TableCell align="right">Total time</TableCell>
              <TableCell>Status</TableCell>
              <TableCell align="right">Analysis</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {participations.map((participation) => {
              const editionLabel = `KUTC ${participation.year}`;
              const raceTime = formatTimeDisplay(participation.raceTimeDisplay, participation.raceTimeSeconds);
              const totalTime = formatTimeDisplay(participation.totalTimeDisplay, participation.totalTimeSeconds);
              const loops = formatLoops(participation.loopsCompleted);
              const distanceKey = participation.distanceKey || 'total';
              return (
                <TableRow key={participation.editionId}>
                  <TableCell>
                    <Button
                      variant="outlined"
                      size="small"
                      color="primary"
                      endIcon={<ChevronRight fontSize="small" />}
                      onClick={() => navigate(`/kutc/results/${participation.editionId}?distance=total`)}
                      sx={{ textTransform: 'none', fontWeight: 600 }}
                    >
                      {editionLabel}
                    </Button>
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="outlined"
                      size="small"
                      color="primary"
                      endIcon={<ChevronRight fontSize="small" />}
                      onClick={() => {
                        const key = distanceKey || 'total';
                        navigate(`/kutc/results/${participation.editionId}?distance=${encodeURIComponent(key)}`);
                      }}
                      sx={{ textTransform: 'none' }}
                    >
                      {participation.raceName}
                    </Button>
                  </TableCell>
                  <TableCell align="right">{formatRank(participation.raceRank)}</TableCell>
                  <TableCell align="right">{raceTime}</TableCell>
                  <TableCell align="right">{formatRank(participation.totalRank)}</TableCell>
                  <TableCell align="right">{loops}</TableCell>
                  <TableCell align="right">{totalTime}</TableCell>
                  <TableCell>{participation.status || '—'}</TableCell>
                  <TableCell align="right">
                    {participation.hasCheckpointData ? (
                      <Button
                        component={RouterLink}
                        to={`/runners/${profile?.userId}/kutc/${participation.editionId}`}
                        size="small"
                        variant="outlined"
                      >
                        View
                      </Button>
                    ) : (
                      <Typography variant="body2" color="text.secondary">
                        N/A
                      </Typography>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>
    );
  };

  if (loading) {
    return (
      <Container maxWidth="md" sx={{ py: 6, textAlign: 'center' }}>
        <CircularProgress />
      </Container>
    );
  }

  if (error) {
    return (
      <Container maxWidth="md" sx={{ py: 6 }}>
        <Alert severity="error">{error}</Alert>
      </Container>
    );
  }

  if (!profile || !stats) {
    return (
      <Container maxWidth="md" sx={{ py: 6 }}>
        <Alert severity="info">Runner not found.</Alert>
      </Container>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Box sx={{ mb: 4 }}>
        <Typography variant="h3" gutterBottom>
          {stats.name}
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Runner's page
        </Typography>
      </Box>

      <Typography variant="h5" gutterBottom sx={{ mb: 2 }}>
        KUTC participation history
      </Typography>

      <Paper sx={{ p: 3, mb: 4 }}>
        <Grid container spacing={3}>
          <Grid item xs={12} md={4}>
            <Stack spacing={1}>
              <Typography variant="overline" color="text.secondary">
                Total appearances
              </Typography>
              <Typography variant="h5">{stats.appearances}</Typography>
              <Chip label={`Years: ${stats.years}`} size="small" />
            </Stack>
          </Grid>
          <Grid item xs={12} md={4}>
            <Stack spacing={1}>
              <Typography variant="overline" color="text.secondary">
                Total loops completed
              </Typography>
              <Typography variant="h5">{stats.totalLoops}</Typography>
            </Stack>
          </Grid>
          <Grid item xs={12} md={4}>
            <Stack spacing={1}>
              <Typography variant="overline" color="text.secondary">
                Best performance
              </Typography>
              <Typography variant="h6">{stats.best}</Typography>
            </Stack>
          </Grid>
        </Grid>
      </Paper>

      {canEdit && (
        <Paper sx={{ mb: 4 }}>
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              px: 3,
              py: 2
            }}
          >
            <Typography variant="h5">Personal details</Typography>
            <Button
              variant="text"
              size="small"
              endIcon={<ExpandMore sx={{ transform: detailsExpanded ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }} />}
              onClick={() => setDetailsExpanded((prev) => !prev)}
              sx={{ textTransform: 'none' }}
            >
              {detailsExpanded ? 'Hide details' : 'Show details'}
            </Button>
          </Box>
          <Collapse in={detailsExpanded} timeout="auto" unmountOnExit>
            <Divider />
            <Box sx={{ px: 3, py: 3 }}>
              {detailsSuccess && (
                <Alert severity="success" sx={{ mb: 2 }}>
                  Changes saved successfully.
                </Alert>
              )}
              {detailsError && (
                <Alert severity="error" sx={{ mb: 2 }}>
                  {detailsError}
                </Alert>
              )}
              <Grid container spacing={3}>
                <Grid item xs={12} md={6}>
                  <TextField
                    label="First name"
                    fullWidth
                    value={editableDetails?.firstName ?? ''}
                    onChange={handleDetailChange('firstName')}
                    disabled={detailsSaving}
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    label="Last name"
                    fullWidth
                    value={editableDetails?.lastName ?? ''}
                    onChange={handleDetailChange('lastName')}
                    disabled={detailsSaving}
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    label="Phone country code"
                    fullWidth
                    value={editableDetails?.phoneCountryCode ?? ''}
                    onChange={handleDetailChange('phoneCountryCode')}
                    disabled={detailsSaving}
                    placeholder="47"
                    InputProps={{
                      startAdornment: <InputAdornment position="start">+</InputAdornment>,
                      inputMode: 'numeric'
                    }}
                    inputProps={{ pattern: '[0-9]*', maxLength: 4 }}
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    label="Phone number"
                    fullWidth
                    value={editableDetails?.phone ?? ''}
                    onChange={handleDetailChange('phone')}
                    disabled={detailsSaving}
                    placeholder="e.g. 12345678"
                    InputProps={{ inputMode: 'numeric' }}
                    inputProps={{ pattern: '[0-9]*', maxLength: 15 }}
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    label="Email"
                    fullWidth
                    value={profile.email}
                    disabled
                    helperText="Email is your unique identifier. To update it, contact post@krultra.no."
                    InputProps={{
                      endAdornment: (
                        <InputAdornment position="end">
                          <Tooltip title="Email updates require contacting post@krultra.no">
                            <InfoOutlined fontSize="small" color="action" />
                          </Tooltip>
                        </InputAdornment>
                      )
                    }}
                  />
                </Grid>
              </Grid>
              <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 2, mt: 3 }}>
                <Button
                  variant="text"
                  onClick={handleCancelDetails}
                  disabled={detailsSaving || !hasDetailsChanged}
                >
                  Cancel
                </Button>
                <Button
                  variant="contained"
                  onClick={handleSaveDetails}
                  disabled={detailsSaving || !hasDetailsChanged}
                >
                  {detailsSaving ? 'Saving…' : 'Save changes'}
                </Button>
              </Box>
            </Box>
          </Collapse>
        </Paper>
      )}

      <Box>
        {renderParticipations(profile.participations)}
      </Box>
    </Container>
  );
};

export default RunnerProfilePage;
