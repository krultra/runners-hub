import React, { useState, useEffect } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { 
  Container, 
  Typography, 
  Box, 
  Button, 
  Card, 
  CardContent, 
  Grid,
  Paper,
  Divider,
  Link
} from '@mui/material';
import { RACE_DETAILS } from '../constants';
import { getTotalRegistrationsCount } from '../services/registrationService';

const HomePage: React.FC = () => {
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
  
  // Calculate time remaining until the race
  const now = new Date();
  const raceDate = RACE_DETAILS.date;
  const timeRemaining = raceDate.getTime() - now.getTime();
  
  // Check if registration is still open
  const isRegistrationOpen = now < RACE_DETAILS.registrationDeadline;
  
  // Fetch registration count on component mount
  useEffect(() => {
    const fetchRegistrationCount = async () => {
      try {
        const count = await getTotalRegistrationsCount();
        setAvailableSpots(Math.max(0, RACE_DETAILS.maxParticipants - count));
      } catch (error) {
        console.error('Error fetching registration count:', error);
        setAvailableSpots(null);
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchRegistrationCount();
  }, []);
  
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

  return (
    <Container maxWidth="lg">
      <Box sx={{ my: 4, textAlign: 'center' }}>
        <Typography variant="h2" component="h1" gutterBottom>
          Kruke's Ultra-Trail Challenge 2025
        </Typography>
        
        <Typography variant="h5" color="text.secondary" paragraph>
          Challenge yourself on the trails to Solemsvåttan!
        </Typography>
        
        <Box sx={{ mb: 2 }}>
          <Link 
            href="https://krultra.no/en/KUTC" 
            target="_blank" 
            rel="noopener noreferrer"
            color="primary"
            sx={{ fontSize: '0.9rem' }}
          >
            More info about KUTC
          </Link>
        </Box>
        
        <Paper 
          elevation={0} 
          sx={{ 
            p: 3, 
            mb: 4, 
            backgroundColor: 'primary.light', 
            color: 'primary.contrastText',
            borderRadius: 2
          }}
        >
          <Typography variant="h4">
            {raceDate.toLocaleDateString('en-US', { 
              weekday: 'long',
              year: 'numeric', 
              month: 'long', 
              day: 'numeric' 
            })}
          </Typography>
          <Typography variant="h6">
            Starting at {raceDate.toLocaleTimeString('en-US', { 
              hour: '2-digit', 
              minute: '2-digit' 
            })}
          </Typography>
          <Box sx={{ mt: 2 }}>
            <Typography variant="h5">
              {timeLeft.days} days {timeLeft.hours} hours {timeLeft.minutes} minutes {timeLeft.seconds} seconds remaining
            </Typography>
          </Box>
        </Paper>
        
        {isRegistrationOpen ? (
          availableSpots === 0 ? (
            <Typography variant="h6" color="error" sx={{ mb: 4 }}>
              Event is fully booked
            </Typography>
          ) : (
            <>
              <Button 
                component={RouterLink} 
                to="/register" 
                variant="contained" 
                size="large" 
                sx={{ mb: 2, py: 1.5, px: 4 }}
                disabled={isLoading}
              >
                Register Now
              </Button>
              {!isLoading && availableSpots !== null && (
                <Typography variant="body1" sx={{ mb: 4 }}>
                  {availableSpots} spots still available
                </Typography>
              )}
            </>
          )
        ) : (
          <Typography variant="h6" color="error" sx={{ mb: 4 }}>
            Registration is now closed
          </Typography>
        )}
      </Box>
      
      <Grid container spacing={4} sx={{ mb: 6 }}>
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h5" component="h2" gutterBottom>
                Race Details
              </Typography>
              <Divider sx={{ mb: 2 }} />
              
              <Typography variant="body1" paragraph>
                <strong>Date:</strong> {raceDate.toLocaleDateString()}
              </Typography>
              <Typography variant="body1" paragraph>
                <strong>Registration Deadline:</strong> {RACE_DETAILS.registrationDeadline.toLocaleDateString()}
              </Typography>
              <Typography variant="body1" paragraph>
                <strong>Maximum Participants:</strong> {RACE_DETAILS.maxParticipants}
                {!isLoading && availableSpots !== null && (
                  <> ({availableSpots} spots still available)</>  
                )}
              </Typography>
              <Typography variant="body1" paragraph>
                <strong>Loop Distance:</strong> {RACE_DETAILS.loopDistance} km
              </Typography>
              <Typography variant="body1">
                <strong>Available Distances:</strong>
              </Typography>
              <ul>
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
            </CardContent>
          </Card>
        </Grid>
        
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h5" component="h2" gutterBottom>
                Registration Fees
              </Typography>
              <Divider sx={{ mb: 2 }} />
              
              <Typography variant="body1" paragraph>
                <strong>Participation Fee:</strong> {RACE_DETAILS.fees.participation} NOK
              </Typography>
              <Typography variant="body1" paragraph>
                <strong>Base Camp Services:</strong> {RACE_DETAILS.fees.baseCamp} NOK
              </Typography>
              <Typography variant="body1" paragraph>
                <strong>Refundable Deposit:</strong> {RACE_DETAILS.fees.deposit} NOK
                <br />
                <em>(Returned to all participants who show up for the race)</em>
              </Typography>
              <Typography variant="body1" paragraph>
                <strong>Total:</strong> {RACE_DETAILS.fees.total} NOK
              </Typography>
              
              <Typography variant="h6" sx={{ mt: 2 }}>
                Payment Methods
              </Typography>
              <ul>
                <li>
                  <strong>Vipps</strong> - Available in Norway, Sweden, Denmark and Finland (Preferred method)
                </li>
                <li>
                  <strong>PayPal and International Bank Transfer</strong> - Available for participants from all countries
                </li>
              </ul>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 2, fontStyle: 'italic' }}>
                Note: Any fees charged for payment services must be covered by the participant.
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Container>
  );
};

export default HomePage;
