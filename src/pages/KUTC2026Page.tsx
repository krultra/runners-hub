import React, { useState, useEffect, useMemo } from 'react';
import { Link as RouterLink, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { 
  Container, 
  Typography, 
  Box, 
  Button, 
  Grid,
  Paper,
  Divider,
  Alert,
  Chip
} from '@mui/material';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import { Registration } from '../types';
import { useEventEdition, CurrentEvent } from '../contexts/EventEditionContext';
import { CircularProgress } from '@mui/material';
import { countActiveParticipants, getRegistrationsByUserId, countWaitingList } from '../services/registrationService';
import { Globe, BarChart3, Trophy, Info } from 'lucide-react';
import { useStatusLabel } from '../hooks/useStatusLabel';
import { useLocalizedField } from '../hooks/useLocalizedField';

// Status code mapping for KUTC
const STATUS_MAP: Record<string, number> = {
  hidden: 0, draft: 10, announced: 20, pre_registration: 30, open: 40,
  waitlist: 44, late_registration: 50, full: 54, closed: 60,
  in_progress: 70, suspended: 75, finished: 80, cancelled: 90, finalized: 100
};

// Inner component with full hooks/logic, receives guaranteed `event`
const KUTC2026PageInner: React.FC<{ event: CurrentEvent }> = ({ event }) => {
  const { t } = useTranslation();
  const getLocalizedField = useLocalizedField();
  const navigate = useNavigate();
  const location = useLocation();
  const editionId = 'kutc-2026';

  // State for countdown timer
  const [timeLeft, setTimeLeft] = useState<{
    days: number;
    hours: number;
    minutes: number;
    seconds: number;
  }>({ days: 0, hours: 0, minutes: 0, seconds: 0 });
  
  // State for available spots
  const [availableSpots, setAvailableSpots] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [waitingListCount, setWaitingListCount] = useState<number>(0);
  const [activeParticipants, setActiveParticipants] = useState<number>(0);
  
  // State for user authentication and registration
  const [user, setUser] = useState<any>(null);
  const [isUserRegistered, setIsUserRegistered] = useState(false);
  const [userRegistration, setUserRegistration] = useState<Registration | null>(null);
  const [isCheckingRegistration, setIsCheckingRegistration] = useState(true);
  
  // Get status label using hook
  const statusLabel = useStatusLabel(event.status);
  
  // Calculate time remaining until the race
  const now = useMemo(() => new Date(), []);
  const raceDate = useMemo(
    () => (event.startTime ? new Date(event.startTime) : new Date()),
    [event.startTime]
  );
  const raceDistances = useMemo(
    () => (event.raceDistances ?? []).filter((rd) => {
      const { active } = rd as { active?: boolean };
      return active !== false;
    }),
    [event.raceDistances]
  );
  // const timeRemaining = raceDate.getTime() - now.getTime();
  
  // Event status and timing
  // Status can be stored as numeric sortOrder (e.g., 40) or string code (e.g., "open")
  const statusValue = String(event.status || '').toLowerCase();
  const statusNumeric = parseInt(statusValue, 10);
  // Map string codes to their sortOrder for comparison, or use numeric value directly
  const STATUS_MAP: Record<string, number> = {
    hidden: 0, draft: 10, announced: 20, pre_registration: 30, open: 40,
    waitlist: 44, late_registration: 50, full: 54, closed: 60,
    in_progress: 70, suspended: 75, finished: 80, cancelled: 90, finalized: 100
  };
  const eventStatusCode = !isNaN(statusNumeric) ? statusNumeric : (STATUS_MAP[statusValue] ?? 0);
  const raceStarted = now >= raceDate;
  const raceEnded = event.endTime ? now >= new Date(event.endTime) : false;
  
  // Registration logic
  // Registration is allowed for: pre_registration (30), open (40), waitlist (44), late_registration (50)
  // NOT allowed for: full (54), closed (60)
  const registrationDeadlinePassed = event.registrationDeadline ? now >= event.registrationDeadline : true;
  const REGISTRATION_OPEN_STATUSES = [30, 40, 44, 50]; // pre_registration, open, waitlist, late_registration
  const isRegistrationPhase = REGISTRATION_OPEN_STATUSES.includes(eventStatusCode);
  const isRegistrationOpen = isRegistrationPhase && !registrationDeadlinePassed && !raceStarted;
  // Handle registrationOpens - could be Date, Timestamp, or string
  const registrationOpensDate = (() => {
    const val = event.registrationOpens;
    if (!val) return null;
    if (val instanceof Date) return val;
    if (typeof (val as any).toDate === 'function') return (val as any).toDate();
    return new Date(val);
  })();
  const registrationNotYetOpen = eventStatusCode < 30 && registrationOpensDate && now < registrationOpensDate;
  
  // Results availability logic
  const liveResultsURL = event.liveResultsURL ?? '';
  const resultURL = event.resultURL ?? '';
  const resultsStatusCode = String(event.resultsStatus || '').toLowerCase();
  const hasResultsAvailable = ['incomplete', 'preliminary', 'unofficial', 'final'].includes(resultsStatusCode) 
    || ['4', '5', '6', '7'].includes(event.resultsStatus || '');
  const isEventOngoing = (resultsStatusCode === 'ongoing' || event.resultsStatus === '2') && raceStarted && !raceEnded;
  const hasFinalResults = resultsStatusCode === 'final' || resultsStatusCode === '7';
  
  const showLiveResultsButton = Boolean(liveResultsURL && !hasFinalResults);
  const showFinalResultsButton = Boolean(resultURL && hasFinalResults);
  const showKUTCResultsButton = Boolean(hasResultsAvailable);
  
  // Participants list visibility: show only before race starts and if there are participants
  const showParticipantsList = activeParticipants > 0 && !raceStarted && !hasResultsAvailable;

  const formatCurrency = (value?: number) => {
    if (value === undefined || value === null) return '—';
    return `${value.toLocaleString('no-NO')} NOK`;
  };
  
  // Check if user is authenticated and has a registration (re-run on location change)
  useEffect(() => {
    setIsCheckingRegistration(true);
    const auth = getAuth();
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      
      if (currentUser) {
        try {
          const regs = await getRegistrationsByUserId(currentUser.uid, event.id);
          const reg = regs.length > 0 ? regs[0] : null;
          setIsUserRegistered(!!reg);
          setUserRegistration(reg);
        } catch (error) {
          console.error('Error checking user registration:', error);
        } finally {
          setIsCheckingRegistration(false);
        }
      } else {
        setIsUserRegistered(false);
        setUserRegistration(null);
        setIsCheckingRegistration(false);
      }
    });
    
    return () => unsubscribe();
  }, [location.key, event.id]);
  
  // Fetch active participant count (pending/confirmed) and compute available spots
  useEffect(() => {
    setIsLoading(true);
    const fetchCounts = async () => {
      try {
        const [activeCount, wlCount] = await Promise.all([
          countActiveParticipants(editionId),
          countWaitingList(editionId)
        ]);
        setActiveParticipants(activeCount);
        setWaitingListCount(wlCount);
        setAvailableSpots(Math.max(0, (event.maxParticipants ?? 0) - activeCount));
      } catch (error) {
        console.error('Error fetching counts:', error);
        setAvailableSpots(null);
        setWaitingListCount(0);
        setActiveParticipants(0);
      } finally {
        setIsLoading(false);
      }
    };
    fetchCounts();
  }, [location.key, editionId, event.maxParticipants, event.id]);
  
  // Update countdown timer every second
  useEffect(() => {
    const calculateTimeLeft = () => {
      const now = new Date();
      const difference = raceDate.getTime() - now.getTime();
      
      if (difference > 0) {
        const days = Math.floor(difference / (1000 * 60 * 60 * 24));
        const hours = Math.floor((difference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((difference % (1000 * 60)) / 1000);
        
        setTimeLeft({ days, hours, minutes, seconds });
      }
    };
    
    calculateTimeLeft();
    const timer = setInterval(calculateTimeLeft, 1000);
    
    return () => clearInterval(timer);
  }, [raceDate]);

  // Determine if the existing registration is invalid
  const isRegistrationInvalid = userRegistration?.status === 'cancelled' || userRegistration?.status === 'expired';

  // Determine if new registrations should go on waiting-list
  const forceQueue = waitingListCount > 0;

  const renderResultsButtons = (options?: { compact?: boolean }) => {
    const compact = options?.compact ?? false;

    if (!showLiveResultsButton && !showFinalResultsButton && !showKUTCResultsButton) {
      return (
        <Typography variant="body2" color="text.secondary">
          Results will be published here when available.
        </Typography>
      );
    }

    return (
      <Box
        sx={{
          display: 'flex',
          flexDirection: compact ? 'row' : 'column',
          alignItems: compact ? 'flex-start' : 'center',
          gap: 2,
          flexWrap: 'wrap',
          justifyContent: compact ? 'flex-start' : 'center',
          mb: compact ? 0 : 4
        }}
      >
        {showKUTCResultsButton && (
          <Button
            component={RouterLink}
            to={`/kutc/results/${editionId}`}
            variant="contained"
            color="primary"
            size="large"
            sx={{ fontWeight: 700, px: 4, py: 1.5, minWidth: 220 }}
          >
            KUTC Results
          </Button>
        )}
        {showLiveResultsButton && (
          <Button
            variant="contained"
            color="success"
            size="large"
            href={liveResultsURL}
            target="_blank"
            rel="noopener noreferrer"
            sx={{ fontWeight: 700, px: 4, py: 1.5, minWidth: 220 }}
          >
            Live Results
          </Button>
        )}
        {showFinalResultsButton && (
          <Button
            variant={showKUTCResultsButton ? 'outlined' : 'contained'}
            color="primary"
            size="large"
            href={resultURL}
            target="_blank"
            rel="noopener noreferrer"
            sx={{ fontWeight: 700, px: 4, py: 1.5, minWidth: 220, borderWidth: 2 }}
          >
            Final Results
          </Button>
        )}
      </Box>
    );
  };

  const isLoggedIn = Boolean(user);
  const hasActiveRegistration = userRegistration && !isRegistrationInvalid;

  const registrationAlert = () => {
    if (!isLoggedIn || !userRegistration) return null;
    
    if (isRegistrationInvalid) {
      return (
        <Alert severity="warning" sx={{ mb: 2 }}>
          Your registration has been {userRegistration.status}. You can contact the organizer for assistance.
        </Alert>
      );
    }
    
    if (userRegistration.isOnWaitinglist) {
      return (
        <Alert severity="info" sx={{ mb: 2 }}>
          You are on the waiting-list (position: {waitingListCount > 0 ? 'pending confirmation' : 'check with organizer'}).
        </Alert>
      );
    }
    
    return (
      <Alert severity="success" sx={{ mb: 2 }}>
        ✓ You are registered for this event!
      </Alert>
    );
  };

  const renderRegistrationActions = () => {
    // After race ended with results available
    if (raceEnded && hasResultsAvailable) {
      return null; // Results buttons are shown separately
    }

    // Race ongoing - minimal info
    if (raceStarted && !raceEnded) {
      return (
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', mb: 4 }}>
          <Typography variant="h6" color="info.main" sx={{ mb: 2 }}>
            🏃 Event is ongoing
          </Typography>
        </Box>
      );
    }

    // User is logged in
    if (isLoggedIn) {
      return (
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', mb: 4 }}>
          {registrationAlert()}
          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', justifyContent: 'center' }}>
            {/* Show "Edit registration" if user has any registration (active or not) */}
            {userRegistration && (
              <Button
                component={RouterLink}
                to="/register"
                variant={hasActiveRegistration ? "outlined" : "contained"}
                color="primary"
                size="large"
                sx={{ py: 1.5, px: 4, minWidth: 210, fontWeight: 700 }}
              >
                {hasActiveRegistration ? 'View my registration' : 'Update registration'}
              </Button>
            )}
            {/* Show "Register Now" if no registration exists and registration is open */}
            {!userRegistration && isRegistrationOpen && (
              <Button
                component={RouterLink}
                to="/register"
                variant="contained"
                color="primary"
                size="large"
                sx={{ py: 1.5, px: 4, minWidth: 210, fontWeight: 700 }}
              >
                {availableSpots === 0 || forceQueue ? 'Join waiting-list' : 'Register Now'}
              </Button>
            )}
            {/* Show participants list if relevant */}
            {showParticipantsList && (
              <Button
                component={RouterLink}
                to="/participants"
                variant="outlined"
                color="inherit"
                size="large"
                sx={{ py: 1.5, px: 4, minWidth: 210 }}
              >
                {waitingListCount > 0 ? 'Participants & Waiting-list' : 'See Participants'}
              </Button>
            )}
          </Box>
          {/* Show availability info for non-registered users during open registration */}
          {!userRegistration && isRegistrationOpen && !isLoading && availableSpots !== null && (
            <Typography variant="body1" sx={{ mt: 2, fontWeight: 500 }}>
              {availableSpots > 0 
                ? `${availableSpots} spot${availableSpots !== 1 ? 's' : ''} available`
                : '⚠️ Event is fully booked - join the waiting-list'}
            </Typography>
          )}
        </Box>
      );
    }

    // User NOT logged in
    if (isRegistrationOpen) {
      return (
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', mb: 4 }}>
          {availableSpots === 0 || forceQueue ? (
            <Alert severity="warning" sx={{ mb: 2, maxWidth: 600 }}>
              ⚠️ This event is fully booked. Sign in to join the waiting-list.
            </Alert>
          ) : null}
          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', justifyContent: 'center' }}>
            <Button
              onClick={() => navigate('/auth?returnTo=/register')}
              variant="contained"
              color="primary"
              size="large"
              sx={{ py: 1.5, px: 4, minWidth: 210, fontWeight: 700 }}
              disabled={isLoading || isCheckingRegistration}
            >
              {availableSpots === 0 || forceQueue ? 'Sign in to join waiting-list' : 'Sign in to register'}
            </Button>
            {showParticipantsList && (
              <Button
                component={RouterLink}
                to="/participants"
                variant="outlined"
                color="inherit"
                size="large"
                sx={{ py: 1.5, px: 4, minWidth: 210 }}
              >
                See Participants
              </Button>
            )}
          </Box>
          {!isLoading && availableSpots !== null && availableSpots > 0 && (
            <Typography variant="body1" sx={{ mt: 2, fontWeight: 500 }}>
              {availableSpots} spot{availableSpots !== 1 ? 's' : ''} available
            </Typography>
          )}
        </Box>
      );
    }

    // Registration not yet open - show when it opens
    // Check: status is before registration phase (< 30) OR registrationOpens date is in the future
    const showRegistrationOpensMessage = registrationOpensDate && now < registrationOpensDate;
    if (showRegistrationOpensMessage) {
      return (
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', mb: 4 }}>
          <Alert severity="info" sx={{ mb: 2, maxWidth: 600 }}>
            <Typography variant="body1" fontWeight={600}>
              Registration opens on {registrationOpensDate.toLocaleDateString('en-US', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
              })}
            </Typography>
          </Alert>
        </Box>
      );
    }

    // Registration closed, race not started yet (and registration opens date has passed or not set)
    if (!isRegistrationOpen && !raceStarted) {
      return (
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', mb: 4 }}>
          <Typography variant="h6" color="text.secondary" sx={{ mb: 2 }}>
            Registration is now closed
          </Typography>
          {showParticipantsList && (
            <Button
              component={RouterLink}
              to="/participants"
              variant="outlined"
              color="inherit"
              size="large"
              sx={{ py: 1.5, px: 4, minWidth: 210 }}
            >
              {waitingListCount > 0 ? 'Participants & Waiting-list' : 'See Participants'}
            </Button>
          )}
        </Box>
      );
    }

    return null;
  };

  return (
    <Container maxWidth="lg" sx={{ py: 6 }}>
      {/* Hero Section */}
      <Box textAlign="center" mb={6}>
        <Typography variant="h2" component="h1" fontWeight={800} gutterBottom>
          {event.eventName || "Kruke's Ultra-Trail Challenge 2026"}
        </Typography>
        <Typography variant="h5" color="text.secondary" sx={{ mb: 3 }}>
          {t('kutc.tagline')}
        </Typography>

        {/* Quick links */}
        <Box display="flex" justifyContent="center" gap={2} flexWrap="wrap" mb={4}>
          <Button
            variant="outlined"
            startIcon={<Globe />}
            href="https://krultra.no/kutc"
          >
            {t('events.officialInfo')}
          </Button>
          <Button
            variant="outlined"
            startIcon={<BarChart3 />}
            onClick={() => navigate('/kutc/results')}
          >
            {t('events.results')}
          </Button>
          <Button
            variant="outlined"
            startIcon={<Trophy />}
            onClick={() => navigate('/kutc/records')}
          >
            {t('events.records')}
          </Button>
        </Box>

        {/* Countdown */}
        {!raceStarted && (
          <Paper elevation={2} sx={{ p: 3, mb: 4, maxWidth: 600, mx: 'auto' }}>
            <Typography variant="h6" gutterBottom>
              {t('events.countdown')}
            </Typography>
            <Box display="flex" justifyContent="center" gap={3}>
              <Box textAlign="center">
                <Typography variant="h3" fontWeight={700}>{timeLeft.days}</Typography>
                <Typography variant="body2" color="text.secondary">{t('events.days')}</Typography>
              </Box>
              <Box textAlign="center">
                <Typography variant="h3" fontWeight={700}>{timeLeft.hours}</Typography>
                <Typography variant="body2" color="text.secondary">{t('events.hours')}</Typography>
              </Box>
              <Box textAlign="center">
                <Typography variant="h3" fontWeight={700}>{timeLeft.minutes}</Typography>
                <Typography variant="body2" color="text.secondary">{t('events.minutes')}</Typography>
              </Box>
              <Box textAlign="center">
                <Typography variant="h3" fontWeight={700}>{timeLeft.seconds}</Typography>
                <Typography variant="body2" color="text.secondary">{t('events.seconds')}</Typography>
              </Box>
            </Box>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 2, textAlign: 'center' }}>
              {t('events.eventDate')}: {raceDate.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
            </Typography>
          </Paper>
        )}

        {/* Registration Actions */}
        {renderRegistrationActions()}

        {/* Results buttons */}
        {(showLiveResultsButton || showFinalResultsButton) && (
          <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center', mb: 4 }}>
            {showLiveResultsButton && (
              <Button
                variant="contained"
                color="secondary"
                size="large"
                href={liveResultsURL}
                target="_blank"
                rel="noopener noreferrer"
                sx={{ fontWeight: 700 }}
              >
                {t('events.liveResults')}
              </Button>
            )}
            {showFinalResultsButton && (
              <Button
                variant="contained"
                color="primary"
                size="large"
                onClick={() => navigate('/kutc/results')}
                sx={{ fontWeight: 700 }}
              >
                {t('events.seeResults')}
              </Button>
            )}
          </Box>
        )}
      </Box>

      {/* Event Info Grid */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        {/* Status Card */}
        <Grid item xs={12} md={6}>
          <Paper elevation={2} sx={{ p: 3, height: '100%' }}>
            <Grid container spacing={3} alignItems="center">
              <Grid item xs={12}>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                  <Typography variant="overline" sx={{ fontWeight: 700, color: 'text.secondary' }}>
                    {t('status.label')}
                  </Typography>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Chip
                      icon={<Info />}
                      label={statusLabel || t('status.pending')}
                      color={
                        hasResultsAvailable ? 'success' :
                        raceStarted ? 'info' :
                        isRegistrationOpen ? 'success' :
                        'default'
                      }
                      sx={{ fontWeight: 600 }}
                    />
                  </Box>
                  {event.registrationDeadline && (
                    <Typography variant="body2" color="text.secondary">
                      {t('events.registrationDeadline')}: {event.registrationDeadline.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                    </Typography>
                  )}
                  {!raceEnded && !isLoading && (
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                      <strong>{t('events.participants')}:</strong>{' '}
                      {activeParticipants} / {event.maxParticipants ?? '∞'}
                      {availableSpots !== null && availableSpots > 0 && (
                        <> ({t('events.spotsAvailable', { count: availableSpots })})</>
                      )}
                      {waitingListCount > 0 && (
                        <> + {waitingListCount} {t('events.onWaitlistCount')}</>
                      )}
                    </Typography>
                  )}
                </Box>
              </Grid>
            </Grid>
          </Paper>
        </Grid>

        {/* Quick Facts Card */}
        <Grid item xs={12} md={6}>
          <Paper elevation={2} sx={{ p: 3, height: '100%' }}>
            <Typography variant="overline" sx={{ fontWeight: 700, color: 'text.secondary' }}>
              {t('events.facts')}
            </Typography>
            <Box sx={{ mt: 1 }}>
              <Typography variant="body1"><strong>{t('events.format')}:</strong> Last One Standing</Typography>
              <Typography variant="body1"><strong>{t('events.loop')}:</strong> {event.loopDistance || 6.7} km / 369 m+</Typography>
              <Typography variant="body1"><strong>{t('events.baseCamp')}:</strong> Jamthaugvegen 37, Saksvik</Typography>
              <Typography variant="body1"><strong>{t('events.distances')}:</strong> 4–24 loops (27–161 km)</Typography>
            </Box>
          </Paper>
        </Grid>
      </Grid>

      {/* Race Classes with Fees */}
      {raceDistances.length > 0 && (
        <Grid container spacing={3} sx={{ mb: 4 }}>
          <Grid item xs={12}>
            <Paper elevation={2} sx={{ p: 3 }}>
              <Typography variant="h5" fontWeight={700} gutterBottom>
                {t('events.classesAndFees')}
              </Typography>
              <Divider sx={{ mb: 2 }} />
              <Grid container spacing={2}>
                {raceDistances.map((rd) => {
                  const startDate = rd.startTime?.toDate?.() || rd.startTime;
                  return (
                    <Grid item xs={12} sm={6} md={4} key={rd.id}>
                      <Paper variant="outlined" sx={{ p: 2 }}>
                        <Typography variant="h6" fontWeight={600}>
                          {getLocalizedField(rd, 'displayName')}
                        </Typography>
                        {rd.length > 0 && (
                          <Typography variant="body2" color="text.secondary">
                            {(rd.length / 1000).toFixed(1)} km
                            {rd.ascent > 0 && ` • ${rd.ascent} m ${t('events.ascent').toLowerCase()}`}
                          </Typography>
                        )}
                        {startDate && (
                          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                            {t('events.start')}: {startDate.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
                          </Typography>
                        )}
                        {rd.fee !== undefined && rd.fee !== null && (
                          <Typography variant="body1" sx={{ mt: 1, fontWeight: 500 }}>
                            {t('events.participationFee')}: {rd.fee},- kr
                          </Typography>
                        )}
                      </Paper>
                    </Grid>
                  );
                })}
              </Grid>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 2, fontStyle: 'italic' }}>
                {t('kutc.allParticipantsLOS')}
              </Typography>
            </Paper>
          </Grid>
        </Grid>
      )}

      {/* Registration Fees - show only before race ends */}
      {!raceEnded && event.fees && (event.fees.participation > 0 || event.fees.total > 0) && (
        <Grid container spacing={3} sx={{ mb: 4 }}>
          <Grid item xs={12} md={6}>
            <Paper elevation={2} sx={{ p: 3 }}>
              <Typography variant="h5" fontWeight={700} gutterBottom>
                {t('kutc.registrationFees')}
              </Typography>
              <Divider sx={{ mb: 2 }} />
              {event.fees.participation > 0 && (
                <Typography variant="body1" paragraph>
                  <strong>{t('kutc.participation')}:</strong> {event.fees.participation.toLocaleString('no-NO')},- kr
                </Typography>
              )}
              {event.fees.baseCamp > 0 && (
                <Typography variant="body1" paragraph>
                  <strong>{t('kutc.serviceFee')}:</strong> {event.fees.baseCamp.toLocaleString('no-NO')},- kr
                </Typography>
              )}
              {event.fees.deposit > 0 && (
                <Typography variant="body1" paragraph>
                  <strong>{t('kutc.depositRefundable')}:</strong> {event.fees.deposit.toLocaleString('no-NO')},- kr
                  <br />
                  <Typography component="span" variant="body2" color="text.secondary" sx={{ fontStyle: 'italic' }}>
                    ({t('kutc.depositNote')})
                  </Typography>
                </Typography>
              )}
              {event.fees.total > 0 && (
                <Typography variant="body1" sx={{ fontWeight: 600, mt: 1 }}>
                  <strong>{t('kutc.total')}:</strong> {event.fees.total.toLocaleString('no-NO')},- kr
                </Typography>
              )}
            </Paper>
          </Grid>
        </Grid>
      )}

      {/* Contact */}
      <Box textAlign="center" sx={{ mt: 6 }}>
        <Typography variant="body2" color="text.secondary">
          {t('common.questions')}{' '}
          <Box
            component="a"
            href="mailto:post@krultra.no"
            sx={{
              color: (theme) => theme.palette.mode === 'dark' ? '#69A9E1' : '#4E82B4',
              textDecoration: 'underline',
              '&:hover': {
                color: (theme) => theme.palette.mode === 'dark' ? '#8BC2F0' : '#41719C',
              }
            }}
          >
            post@krultra.no
          </Box>
        </Typography>
      </Box>
    </Container>
  );
};

// Wrapper component handles loading/error and injects `event` into inner
const KUTC2026Page: React.FC = () => {
  const { event, loading, error, setEvent } = useEventEdition();

  // Load the KUTC-2026 event when the component mounts
  useEffect(() => {
    setEvent('kutc-2026');
  }, [setEvent]);

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="200px">
        <CircularProgress />
      </Box>
    );
  }


  if (error) {
    return (
      <Box p={3}>
        <Alert severity="error">Error loading event: {error.message}</Alert>
      </Box>
    );
  }

  if (!event) {
    return (
      <Box p={3}>
        <Alert severity="warning">No event data available. Please try again later.</Alert>
      </Box>
    );
  }

  return <KUTC2026PageInner event={event} />;
};

export default KUTC2026Page;
