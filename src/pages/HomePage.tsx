import React from 'react';
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
  Divider
} from '@mui/material';
import { RACE_DETAILS } from '../constants';

const HomePage: React.FC = () => {
  // Calculate time remaining until the race
  const now = new Date();
  const raceDate = RACE_DETAILS.date;
  const timeRemaining = raceDate.getTime() - now.getTime();
  const daysRemaining = Math.floor(timeRemaining / (1000 * 60 * 60 * 24));
  
  // Check if registration is still open
  const isRegistrationOpen = now < RACE_DETAILS.registrationDeadline;

  return (
    <Container maxWidth="lg">
      <Box sx={{ my: 4, textAlign: 'center' }}>
        <Typography variant="h2" component="h1" gutterBottom>
          Kruke's Ultra-Trail Challenge 2025
        </Typography>
        
        <Typography variant="h5" color="text.secondary" paragraph>
          Challenge yourself on the beautiful trails of Kruke
        </Typography>
        
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
              {daysRemaining} days remaining
            </Typography>
          </Box>
        </Paper>
        
        {isRegistrationOpen ? (
          <Button 
            component={RouterLink} 
            to="/register" 
            variant="contained" 
            size="large" 
            sx={{ mb: 4, py: 1.5, px: 4 }}
          >
            Register Now
          </Button>
        ) : (
          <Typography variant="h6" color="error" sx={{ mb: 4 }}>
            Registration is now closed
          </Typography>
        )}
      </Box>
      
      <Grid container spacing={4} sx={{ mb: 6 }}>
        <Grid size={{ xs: 12, md: 6 }}>
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
            </CardContent>
          </Card>
        </Grid>
        
        <Grid size={{ xs: 12, md: 6 }}>
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
                {RACE_DETAILS.paymentMethods.map((method, index) => (
                  <li key={index}>
                    <strong>{method.name}</strong> - {method.description}
                    {method.isPreferred && <em> (Preferred method)</em>}
                  </li>
                ))}
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
