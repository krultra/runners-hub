import React, { useState, useEffect, useMemo } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { useLocation } from 'react-router-dom';
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
import { useNavigate } from 'react-router-dom';
import { Registration } from '../types';
import { useEventEdition, CurrentEvent } from '../contexts/EventEditionContext';
import { CircularProgress } from '@mui/material';
import { countActiveParticipants, getRegistrationsByUserId, countWaitingList } from '../services/registrationService';

// Inner component with full hooks/logic, receives guaranteed `event`
const KUTC2025PageInner: React.FC<{ event: CurrentEvent }> = ({ event }) => {
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
  
  // Calculate time remaining until the race
  const now = useMemo(() => new Date(), []);
  const raceDate = useMemo(
    () => (event.startTime ? new Date(event.startTime) : new Date()),
    [event.startTime]
  );
  // const timeRemaining = raceDate.getTime() - now.getTime();
  
  // Event status and timing
  const eventStatusCode = typeof event.status === 'number' ? event.status : parseInt(String(event.status || ''), 10) || 0;
  const raceStarted = now >= raceDate;
  const raceEnded = event.endTime ? now >= new Date(event.endTime) : false;
  
  // Registration logic
  const registrationDeadlinePassed = event.registrationDeadline ? now >= event.registrationDeadline : true;
  const isRegistrationPhase = eventStatusCode >= 30 && eventStatusCode <= 60; // pre_registration (30) through closed (60)
  const isRegistrationOpen = isRegistrationPhase && !registrationDeadlinePassed && !raceStarted;
  
  // Results availability logic
  const liveResultsURL = event.liveResultsURL ?? '';
  const resultURL = event.resultURL ?? '';
  const resultsStatusCode = String(event.resultsStatus || '').toLowerCase();
  const hasResultsAvailable = ['incomplete', 'preliminary', 'unofficial', 'final'].includes(resultsStatusCode) 
    || ['4', '5', '6', '7'].includes(event.resultsStatus || '');
  const isEventOngoing = (resultsStatusCode === 'ongoing' || event.resultsStatus === '2') && raceStarted && !raceEnded;
  
  const showLiveResultsButton = Boolean(liveResultsURL && (isEventOngoing || raceStarted));
  const showFinalResultsButton = Boolean(hasResultsAvailable && resultURL);
  
  // Participants list visibility: show only before race starts and if there are participants
  const showParticipantsList = activeParticipants > 0 && !raceStarted && !hasResultsAvailable;
  
  // Check if user is authenticated and has a registration (re-run on location change)
  const location = useLocation();
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
  
  const editionId = event.id;
  
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

  const navigate = useNavigate();

  // Determine if the existing registration is invalid
  const isRegistrationInvalid = userRegistration?.status === 'cancelled' || userRegistration?.status === 'expired';

  // Determine if new registrations should go on waiting-list
  const forceQueue = waitingListCount > 0;

  const renderResultsButtons = () => {
    if (!showLiveResultsButton && !showFinalResultsButton) return null;
    
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, mb: 4 }}>
        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', justifyContent: 'center' }}>
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
              variant="outlined"
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

    // Registration closed, race not started yet
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
    <Container maxWidth="lg">
      <Box sx={{ my: 4, textAlign: 'center' }}>
        <Typography variant="h2" component="h1" gutterBottom>
          Kruke's Ultra-Trail Challenge 2025
        </Typography>
        
        <Typography variant="h5" color="text.secondary" paragraph>
          Challenge yourself on the trails to Solemsvåttan!
        </Typography>
        
        {/* Event status badge */}
        {(raceStarted || hasResultsAvailable || !isRegistrationOpen) && (
          <Box sx={{ mb: 2 }}>
            {hasResultsAvailable && (
              <Chip label="Results Available" color="success" size="medium" sx={{ fontWeight: 600 }} />
            )}
            {!hasResultsAvailable && raceStarted && !raceEnded && (
              <Chip label="Event In Progress" color="info" size="medium" sx={{ fontWeight: 600 }} />
            )}
            {!hasResultsAvailable && !raceStarted && !isRegistrationOpen && registrationDeadlinePassed && (
              <Chip label="Registration Closed" color="default" size="medium" sx={{ fontWeight: 600 }} />
            )}
          </Box>
        )}
        
        <Box sx={{ mb: 2 }}>
          <Button
            href="https://krultra.no/en/KUTC"
            target="_blank"
            rel="noopener noreferrer"
            variant="text"
            color="inherit"
            sx={{ fontWeight: 400, px: 1, py: 0.5, minWidth: 0, fontSize: '1rem', textTransform: 'none', textDecoration: 'underline', textUnderlineOffset: 4 }}
          >
            More info about KUTC
          </Button>
        </Box>
        
        {!raceEnded && (
          <Paper
            elevation={1}
            sx={{
              borderRadius: 2,
              p: 3,
              mb: 4,
              background: raceStarted 
                ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' 
                : 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
              color: 'white'
            }}
          >
            <Typography variant="h4" sx={{ color: 'white' }}>
              {raceDate.toLocaleDateString('en-US', { 
                weekday: 'long',
                year: 'numeric', 
                month: 'long', 
                day: 'numeric' 
              })}
            </Typography>
            <Typography variant="h6" sx={{ color: 'rgba(255,255,255,0.9)' }}>
              {raceStarted ? 'Started at' : 'Starting at'} {raceDate.toLocaleTimeString('en-US', { 
                hour: '2-digit', 
                minute: '2-digit' 
              })}
            </Typography>
            {!raceStarted && (
              <Box sx={{ mt: 2 }}>
                <Typography variant="h5" sx={{ color: 'white', fontWeight: 600 }}>
                  {timeLeft.days > 0 && `${timeLeft.days}d `}
                  {timeLeft.hours}h {timeLeft.minutes}m {timeLeft.seconds}s
                </Typography>
                <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.8)', mt: 0.5 }}>
                  until race start
                </Typography>
              </Box>
            )}
          </Paper>
        )}

        {renderResultsButtons()}
        {renderRegistrationActions()}
      </Box>

      <Grid container spacing={4} sx={{ mb: 4 }}>
        <Grid item xs={12} md={6}>
          <Paper
            elevation={1}
            sx={{
              backgroundColor: 'var(--color-surface)',
              color: 'var(--color-text)',
              border: '1px solid var(--color-surface-border)',
              boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
              borderRadius: 2,
              p: 3
            }}
          >
            <Typography variant="h5" component="h2" gutterBottom>
              Race Details
            </Typography>
            <Divider sx={{ mb: 2 }} />
            <Typography variant="body1" paragraph>
              <strong>Date:</strong> {raceDate.toLocaleDateString('en-US', { 
                weekday: 'long',
                year: 'numeric', 
                month: 'long', 
                day: 'numeric' 
              })}
            </Typography>
            <Typography variant="body1" paragraph>
              <strong>Start Time:</strong> {raceDate.toLocaleTimeString('en-US', { 
                hour: '2-digit', 
                minute: '2-digit' 
              })}
            </Typography>
            {!raceStarted && event.registrationDeadline && (
              <Typography variant="body1" paragraph>
                <strong>Registration Deadline:</strong> {event.registrationDeadline.toLocaleDateString('en-US', { 
                  month: 'long', 
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit'
                })}
              </Typography>
            )}
            {!raceEnded && (
              <Typography variant="body1" paragraph>
                <strong>Participants:</strong> {!isLoading ? (
                  <>
                    {activeParticipants} / {event.maxParticipants ?? 0}
                    {isRegistrationOpen && availableSpots !== null && availableSpots > 0 && (
                      <> ({availableSpots} spot{availableSpots !== 1 ? 's' : ''} available)</>
                    )}
                    {waitingListCount > 0 && (
                      <> + {waitingListCount} on waiting-list</>
                    )}
                  </>
                ) : '...'}
              </Typography>
            )}
            <Typography variant="body1" paragraph>
              <strong>Each loop:</strong> {event.loopDistance} km, 369 meter ascent/descent
            </Typography>
            <Typography variant="body1">
              <strong>Available Distances:</strong>
            </Typography>
            <ul style={{ margin: 0, paddingLeft: 16 }}>
              <li>4 loops (26.8 km / 16.7 miles)</li>
              <li>8 loops (53.6 km / 33.3 miles)</li>
              <li>12 loops (80.4 km / 50.0 miles)</li>
              <li>16 loops (107.2 km / 66.6 miles)</li>
              <li>20 loops (134.0 km / 83.3 miles)</li>
              <li>24 loops (160.9 km / 100.0 miles)</li>
            </ul>
            <Typography variant="body2" sx={{ mt: 1, fontStyle: 'italic' }}>
              All participants are part of the 'Last One Standing' challenge!
            </Typography>
          </Paper>
        </Grid>
        {/* Show fees only before race ends and if not finalized */}
        {!raceEnded && !hasResultsAvailable && (
          <Grid item xs={12} md={6}>
            <Paper
              elevation={1}
              sx={{
                backgroundColor: 'var(--color-surface)',
                color: 'var(--color-text)',
                border: '1px solid var(--color-surface-border)',
                boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
                borderRadius: 2,
                p: 3
              }}
            >
            <Typography variant="h5" component="h2" gutterBottom>
              Registration Fees
            </Typography>
            <Divider sx={{ mb: 2 }} />
            <Typography variant="body1" paragraph>
              <strong>Participation Fee:</strong> {event.fees.participation} NOK
            </Typography>
            <Typography variant="body1" paragraph>
              <strong>Base Camp Services:</strong> {event.fees.baseCamp} NOK
            </Typography>
            <Typography variant="body1" paragraph>
              <strong>Refundable Deposit:</strong> {event.fees.deposit} NOK
              <br />
              <em>(Returned to all participants who show up for the race)</em>
            </Typography>
            <Typography variant="body1" paragraph>
              <strong>Total:</strong> {event.fees.total} NOK
            </Typography>
            <Typography variant="h6" sx={{ mt: 2 }}>
              Payment Methods
            </Typography>
            <ul>
                  <li>
                    <strong>Vipps and MobilePay</strong> - Available in Norway, Sweden, Denmark and Finland (Preferred method)
                  </li>
                  <li>
                    <strong>PayPal and Bank Transfer</strong> - Available for participants from all countries
                  </li>
                </ul>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 2, fontStyle: 'italic' }}>
                  Note: Any fees charged for payment services must be covered by the participant.
                </Typography>
            </Paper>
          </Grid>
        )}
      </Grid>
    </Container>
  );
};

// Wrapper component handles loading/error and injects `event` into inner
const KUTC2025Page: React.FC = () => {
  const { event, loading, error, setEvent } = useEventEdition();

  // Load the KUTC-2025 event when the component mounts
  useEffect(() => {
    setEvent('kutc-2025');
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

  return <KUTC2025PageInner event={event} />;
};

export default KUTC2025Page;
