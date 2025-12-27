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
import { Globe, BarChart3, Trophy, Info, Facebook } from 'lucide-react';
import { useStatusLabel } from '../hooks/useStatusLabel';
import { useLocalizedField } from '../hooks/useLocalizedField';
import { useUnits } from '../hooks/useUnits';
import { formatDistance, formatElevation } from '../utils/units';
import { getKrultraUrl } from '../config/urls';
import { getEventLogoUrl } from '../services/strapiService';

// Status code mapping for MO (same as KUTC)
const STATUS_MAP: Record<string, number> = {
  hidden: 0, draft: 10, announced: 20, pre_registration: 30, open: 40,
  waitlist: 44, late_registration: 50, full: 54, closed: 60,
  in_progress: 70, suspended: 75, finished: 80, cancelled: 90, finalized: 100
};

// Inner component with full hooks/logic, receives guaranteed `event`
const MO2026PageInner: React.FC<{ event: CurrentEvent }> = ({ event }) => {
  const { t } = useTranslation();
  const getLocalizedField = useLocalizedField();
  const units = useUnits();
  const navigate = useNavigate();
  const location = useLocation();
  const editionId = 'mo-2026';

  useEffect(() => {
    let isMounted = true;
    const loadLogo = async () => {
      try {
        const url = await getEventLogoUrl(String(event.eventId || ''));
        if (isMounted) setLogoUrl(url);
      } catch {
        if (isMounted) setLogoUrl(null);
      }
    };
    loadLogo();
    return () => {
      isMounted = false;
    };
  }, [event.eventId]);

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
  const [, setIsUserRegistered] = useState(false);
  const [userRegistration, setUserRegistration] = useState<Registration | null>(null);
  const [isCheckingRegistration, setIsCheckingRegistration] = useState(true);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  
  // Calculate time remaining until the race
  const now = useMemo(() => new Date(), []);
  const raceDate = useMemo(
    () => (event.startTime ? new Date(event.startTime) : new Date()),
    [event.startTime]
  );
  
  // Get active race distances
  const raceDistances = useMemo(
    () => (event.raceDistances ?? []).filter((rd) => {
      const { active } = rd as { active?: boolean };
      return active !== false;
    }),
    [event.raceDistances]
  );
  
  // Event status and timing
  const statusValue = String(event.status || '').toLowerCase();
  const statusNumeric = parseInt(statusValue, 10);
  const eventStatusCode = !isNaN(statusNumeric) ? statusNumeric : (STATUS_MAP[statusValue] ?? 0);
  const raceStarted = now >= raceDate;
  const raceEnded = event.endTime ? now >= new Date(event.endTime) : false;
  
  // Registration logic
  const registrationDeadlinePassed = event.registrationDeadline ? now >= event.registrationDeadline : true;
  const REGISTRATION_OPEN_STATUSES = [30, 40, 44, 50];
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
  
  // Results availability logic
  const liveResultsURL = event.liveResultsURL ?? '';
  const resultURL = event.resultURL ?? '';
  const resultsStatusCode = String(event.resultsStatus || '').toLowerCase();
  const hasResultsAvailable = ['incomplete', 'preliminary', 'unofficial', 'final'].includes(resultsStatusCode) 
    || ['4', '5', '6', '7'].includes(event.resultsStatus || '');
  const hasFinalResults = resultsStatusCode === 'final' || resultsStatusCode === '7';
  
  const showLiveResultsButton = Boolean(liveResultsURL && !hasFinalResults);
  const showFinalResultsButton = Boolean(resultURL && hasFinalResults);
  const showParticipantsList = eventStatusCode >= 30 && eventStatusCode < 80;
  
  // Derived state
  const forceQueue = waitingListCount > 0;
  const isLoggedIn = Boolean(user);
  const hasActiveRegistration = userRegistration && 
    (userRegistration.status === 'pending' || userRegistration.status === 'confirmed') &&
    !userRegistration.isOnWaitinglist;

  // Get translated status label
  const statusLabel = useStatusLabel(event.status);

  // Check if user is authenticated and has a registration
  useEffect(() => {
    const auth = getAuth();
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      setIsCheckingRegistration(true);
      
      if (currentUser) {
        try {
          const registrations = await getRegistrationsByUserId(currentUser.uid, editionId);
          const eventRegistration = registrations.length > 0 ? registrations[0] : null;
          setUserRegistration(eventRegistration || null);
          setIsUserRegistered(Boolean(eventRegistration));
        } catch (error) {
          console.error('Error checking registration:', error);
          setUserRegistration(null);
          setIsUserRegistered(false);
        }
      } else {
        setUserRegistration(null);
        setIsUserRegistered(false);
      }
      
      setIsCheckingRegistration(false);
    });

    return () => unsubscribe();
  }, [location.pathname]);

  // Fetch participant counts
  useEffect(() => {
    const fetchCounts = async () => {
      try {
        const [activeCount, wlCount] = await Promise.all([
          countActiveParticipants(editionId),
          countWaitingList(editionId)
        ]);
        setActiveParticipants(activeCount);
        setWaitingListCount(wlCount);
        
        const maxParticipants = event.maxParticipants ?? 0;
        if (maxParticipants > 0) {
          setAvailableSpots(Math.max(0, maxParticipants - activeCount));
        } else {
          setAvailableSpots(null);
        }
      } catch (error) {
        console.error('Error fetching counts:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchCounts();
  }, [event.maxParticipants]);

  // Countdown timer
  useEffect(() => {
    const calculateTimeLeft = () => {
      const difference = raceDate.getTime() - new Date().getTime();
      
      if (difference > 0) {
        setTimeLeft({
          days: Math.floor(difference / (1000 * 60 * 60 * 24)),
          hours: Math.floor((difference / (1000 * 60 * 60)) % 24),
          minutes: Math.floor((difference / 1000 / 60) % 60),
          seconds: Math.floor((difference / 1000) % 60)
        });
      } else {
        setTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0 });
      }
    };

    calculateTimeLeft();
    const timer = setInterval(calculateTimeLeft, 1000);
    return () => clearInterval(timer);
  }, [raceDate]);

  // Registration alert component
  const registrationAlert = () => {
    if (isCheckingRegistration) {
      return null;
    }
    
    if (!userRegistration) {
      return null;
    }
    
    if (userRegistration.status === 'cancelled' || userRegistration.status === 'expired') {
      return (
        <Alert severity="warning" sx={{ mb: 2 }}>
          {userRegistration.status === 'cancelled' ? t('events.registrationCancelled') : t('events.registrationExpired')}
        </Alert>
      );
    }
    
    if (userRegistration.isOnWaitinglist) {
      return (
        <Alert severity="info" sx={{ mb: 2 }}>
          {t('events.onWaitlist')}
        </Alert>
      );
    }
    
    return (
      <Alert severity="success" sx={{ mb: 2 }}>
        ✓ {t('events.youAreRegistered')}
      </Alert>
    );
  };

  const renderRegistrationActions = () => {
    // After race ended with results available
    if (raceEnded && hasResultsAvailable) {
      return null;
    }

    // Race ongoing
    if (raceStarted && !raceEnded) {
      return (
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', mb: 4 }}>
          <Typography variant="h6" color="info.main" sx={{ mb: 2 }}>
            🏃 {t('events.raceOngoing')}
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
            {userRegistration && (
              <Button
                component={RouterLink}
                to="/register"
                variant={hasActiveRegistration ? "outlined" : "contained"}
                color="primary"
                size="large"
                sx={{ py: 1.5, px: 4, minWidth: 210, fontWeight: 700 }}
              >
                {hasActiveRegistration ? t('events.viewRegistration') : t('events.updateRegistration')}
              </Button>
            )}
            {!userRegistration && isRegistrationOpen && (
              <Button
                component={RouterLink}
                to="/register"
                variant="contained"
                color="primary"
                size="large"
                sx={{ py: 1.5, px: 4, minWidth: 210, fontWeight: 700 }}
              >
                {availableSpots === 0 || forceQueue ? t('events.joinWaitlist') : t('events.registerNow')}
              </Button>
            )}
            {showParticipantsList && (
              <Button
                component={RouterLink}
                to="/participants"
                variant="outlined"
                color="inherit"
                size="large"
                sx={{ py: 1.5, px: 4, minWidth: 210 }}
              >
                {waitingListCount > 0 ? t('events.participantsAndWaitlist') : t('events.seeParticipants')}
              </Button>
            )}
          </Box>
          {!userRegistration && isRegistrationOpen && !isLoading && availableSpots !== null && (
            <Typography variant="body1" sx={{ mt: 2, fontWeight: 500 }}>
              {availableSpots > 0 
                ? t('events.spotsAvailable', { count: availableSpots })
                : t('events.fullWaitlistOnly')}
            </Typography>
          )}
        </Box>
      );
    }

    // Not logged in but registration is open
    if (isRegistrationOpen) {
      return (
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', mb: 4 }}>
          <Button
            component={RouterLink}
            to={`/auth?returnTo=/register`}
            variant="contained"
            color="primary"
            size="large"
            sx={{ py: 1.5, px: 4, minWidth: 210, fontWeight: 700 }}
          >
            {availableSpots === 0 || forceQueue ? t('events.loginForWaitlist') : t('events.loginToRegister')}
          </Button>
          {!isLoading && availableSpots !== null && (
            <Typography variant="body1" sx={{ mt: 2, fontWeight: 500 }}>
              {availableSpots > 0 
                ? t('events.spotsAvailable', { count: availableSpots })
                : t('events.fullWaitlistOnly')}
            </Typography>
          )}
        </Box>
      );
    }

    // Registration not yet open - show when it opens
    const showRegistrationOpensMessage = registrationOpensDate && now < registrationOpensDate;
    if (showRegistrationOpensMessage) {
      return (
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', mb: 4 }}>
          <Alert severity="info" sx={{ mb: 2, maxWidth: 600 }}>
            <Typography variant="body1" fontWeight={600}>
              {t('events.registrationOpensOn', { date: registrationOpensDate.toLocaleDateString(undefined, {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
              })})}
            </Typography>
          </Alert>
        </Box>
      );
    }

    // Registration closed, race not started yet
    if (!isRegistrationOpen && !raceStarted) {
      return (
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', mb: 4 }}>
          <Typography variant="h6" color="text.secondary" sx={{ mb: 2 }}>
            {t('events.registrationClosed')}
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
              {waitingListCount > 0 ? t('events.participantsAndWaitlist') : t('events.seeParticipants')}
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
        <Box display="flex" justifyContent="center" alignItems="center" gap={1.5} flexWrap="wrap" mb={1}>
          {logoUrl && (
            <Box
              component="img"
              src={logoUrl}
              alt="MO logo"
              sx={{ width: 44, height: 44, borderRadius: 1, objectFit: 'cover' }}
            />
          )}
          <Typography variant="h2" component="h1" fontWeight={800} gutterBottom sx={{ mb: 0 }}>
            {event.eventName || 'Malvikingen Opp 2026'}
          </Typography>
        </Box>
        <Typography variant="h5" color="text.secondary" sx={{ mb: 3 }}>
          {t('mo.tagline')}
        </Typography>

        {/* Quick links */}
        <Box display="flex" justifyContent="center" gap={2} flexWrap="wrap" mb={4}>
          <Button
            variant="outlined"
            startIcon={<Globe />}
            href={getKrultraUrl('events/MO')}
          >
            {t('events.officialInfo')}
          </Button>
          <Button
            variant="outlined"
            startIcon={<Facebook />}
            href="https://www.facebook.com/groups/146973852042384/"
            target="_blank"
            rel="noopener noreferrer"
          >
            Facebook
          </Button>
          <Button
            variant="outlined"
            startIcon={<BarChart3 />}
            onClick={() => navigate('/mo/results')}
          >
            {t('events.results')}
          </Button>
          <Button
            variant="outlined"
            startIcon={<Trophy />}
            onClick={() => navigate('/mo/records')}
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
                Se live resultater
              </Button>
            )}
            {showFinalResultsButton && (
              <Button
                variant="contained"
                color="primary"
                size="large"
                onClick={() => navigate('/mo/results')}
                sx={{ fontWeight: 700 }}
              >
                Se resultater
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
              <Typography variant="body1"><strong>{t('events.length')}:</strong> {formatDistance(6000, units)}</Typography>
              <Typography variant="body1"><strong>{t('events.elevation')}:</strong> +{formatElevation(420, units)}</Typography>
              <Typography variant="body1"><strong>{t('events.start')}:</strong> Vikhammerløkka ({formatElevation(3, units)})</Typography>
              <Typography variant="body1"><strong>{t('events.finish')}:</strong> Solemsvåttan ({formatElevation(423, units)})</Typography>
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
                            {formatDistance(rd.length, units)}
                            {rd.ascent > 0 && ` • +${formatElevation(rd.ascent, units)} ${t('events.ascent').toLowerCase()}`}
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
                {t('events.licenseNote')}
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
                {t('mo.registrationFees')}
              </Typography>
              <Divider sx={{ mb: 2 }} />
              {event.fees.participation > 0 && (
                <Typography variant="body1" paragraph>
                  <strong>{t('mo.participation')}:</strong> {event.fees.participation.toLocaleString('no-NO')},- kr
                </Typography>
              )}
              {event.fees.oneTimeLicense && event.fees.oneTimeLicense > 0 && (
                <Typography variant="body1" paragraph>
                  <strong>{t('mo.oneTimeLicense')}:</strong> {event.fees.oneTimeLicense.toLocaleString('no-NO')},- kr
                  <br />
                  <Typography component="span" variant="body2" color="text.secondary" sx={{ fontStyle: 'italic' }}>
                    ({t('mo.oneTimeLicenseNote')})
                  </Typography>
                </Typography>
              )}
              {event.fees.baseCamp > 0 && (
                <Typography variant="body1" paragraph>
                  <strong>{t('mo.serviceFee')}:</strong> {event.fees.baseCamp.toLocaleString('no-NO')},- kr
                </Typography>
              )}
              {event.fees.deposit > 0 && (
                <Typography variant="body1" paragraph>
                  <strong>{t('mo.depositRefundable')}:</strong> {event.fees.deposit.toLocaleString('no-NO')},- kr
                  <br />
                  <Typography component="span" variant="body2" color="text.secondary" sx={{ fontStyle: 'italic' }}>
                    ({t('mo.depositNote')})
                  </Typography>
                </Typography>
              )}
              {event.fees.total > 0 && (
                <Typography variant="body1" sx={{ fontWeight: 600, mt: 1 }}>
                  <strong>{t('mo.total')}:</strong> {event.fees.total.toLocaleString('no-NO')},- kr
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
              color: (theme) => theme.palette.mode === 'dark' ? '#69A9E1' : '#4E82B4', // brand-400 / brand-600
              textDecoration: 'underline',
              '&:hover': {
                color: (theme) => theme.palette.mode === 'dark' ? '#8BC2F0' : '#41719C', // brand-300 / brand-700
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
const MO2026Page: React.FC = () => {
  const { event, loading, error, setEvent } = useEventEdition();

  // Load the MO-2026 event when the component mounts
  useEffect(() => {
    setEvent('mo-2026');
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
        <Alert severity="error">Feil ved lasting av arrangement: {error.message}</Alert>
      </Box>
    );
  }

  if (!event) {
    return (
      <Box p={3}>
        <Alert severity="warning">Ingen data tilgjengelig. Prøv igjen senere.</Alert>
      </Box>
    );
  }

  return <MO2026PageInner event={event} />;
};

export default MO2026Page;
