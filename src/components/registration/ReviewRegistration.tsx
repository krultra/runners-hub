import React, { useState, useEffect } from 'react';
import {
  Typography,
  Box,
  Grid,
  List,
  ListItem,
  ListItemText,
  Divider,
  Paper,
  Alert,
  Checkbox,
  FormControlLabel,
  FormHelperText,
  Link,
  Button,
  TextField
} from '@mui/material';
import { COUNTRIES } from '../../constants';
import { CurrentEvent } from '../../contexts/EventEditionContext';
import TermsAndConditions from './TermsAndConditions';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { LocalizationProvider, DatePicker } from '@mui/x-date-pickers';
import { nb } from 'date-fns/locale';

// We use an interface to ensure the type safety of the props passed to the ReviewRegistration component
// The interface is used as a type for the props object
// It contains the fields that are expected to be passed as props to the ReviewRegistration component
// The fields are: event, formData, errors, fieldRefs, onChange, onBlur, isEditingExisting and isFull
interface ReviewRegistrationProps {
  event: CurrentEvent;
  formData: {
    firstName: string;
    lastName: string;
    dateOfBirth: Date | null;
    nationality: string;
    email: string;
    phoneCountryCode: string;
    phoneNumber: string;
    representing: string;
    raceDistance: string;
    travelRequired: string;
    termsAccepted: boolean;
    comments: string;
    notifyFutureEvents: boolean;
    sendRunningOffers: boolean;
    paymentRequired: number;
    paymentMade: number;
    isOnWaitinglist: boolean;
    waitinglistExpires: Date | null;
  };
  errors: Record<string, string>;
  fieldRefs: Record<string, React.RefObject<HTMLDivElement | null>>;
  onChange: (field: string, value: any) => void;
  onBlur?: (field: string) => void;
  isEditingExisting?: boolean;
  isFull?: boolean;
}

const ReviewRegistration: React.FC<ReviewRegistrationProps> = ({ event, formData, errors, fieldRefs, onChange, onBlur, isEditingExisting = false, isFull = false }) => {
  // State for terms and conditions dialog
  const [termsDialogOpen, setTermsDialogOpen] = useState(false);

  // Find the selected race distance
  const selectedDistance = event.raceDistances?.find(
    (distance) => distance.id === formData.raceDistance
  );

  // Find the selected nationality and phone code
  const selectedCountry = COUNTRIES.find(
    (country) => country.code === formData.nationality
  );
  
  // Handle opening and closing the terms dialog
  const handleOpenTermsDialog = () => setTermsDialogOpen(true);
  const handleCloseTermsDialog = () => setTermsDialogOpen(false);
  
  // Effect to scroll to top when component mounts
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  return (
    <Box sx={{ mt: 2, mb: 4 }}>
      <Typography variant="h6" gutterBottom>
        Review Your Registration
      </Typography>
      <Typography variant="body2" color="text.secondary" paragraph>
        Please review your registration details before submitting.
      </Typography>

      {!isEditingExisting && (
        <Alert severity="info" sx={{ mb: 3 }}>
          After submitting your registration, you will need to complete the payment process
          separately. Details will be sent to your email address.
        </Alert>
      )}

      <Paper variant="outlined" sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          Personal Information
        </Typography>
        <Grid container spacing={2}>
          <Grid item xs={12} sm={6}>
            <ListItem disablePadding>
              <ListItemText
                primary="Full Name"
                secondary={`${formData.firstName} ${formData.lastName}`}
              />
            </ListItem>
          </Grid>
          <Grid item xs={12} sm={6}>
            <ListItem disablePadding>
              <ListItemText
                primary="Date of Birth"
                secondary={formData.dateOfBirth ? formData.dateOfBirth.toLocaleDateString() : 'Not provided'}
              />
            </ListItem>
          </Grid>
          <Grid item xs={12} sm={6}>
            <ListItem disablePadding>
              <ListItemText
                primary="Nationality"
                secondary={selectedCountry ? selectedCountry.name : formData.nationality}
              />
            </ListItem>
          </Grid>
          <Grid item xs={12} sm={6}>
            <ListItem disablePadding>
              <ListItemText
                primary="Email"
                secondary={formData.email}
              />
            </ListItem>
          </Grid>
          <Grid item xs={12} sm={6}>
            <ListItem disablePadding>
              <ListItemText
                primary="Mobile Phone"
                secondary={`${formData.phoneCountryCode} ${formData.phoneNumber}`}
              />
            </ListItem>
          </Grid>
          {formData.representing && (
            <Grid item xs={12} sm={6}>
              <ListItem disablePadding>
                <ListItemText
                  primary="Representing"
                  secondary={formData.representing}
                />
              </ListItem>
            </Grid>
          )}
        </Grid>
      </Paper>

      <Paper variant="outlined" sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          Race Details
        </Typography>
        <Grid container spacing={2}>
          <Grid item xs={12}>
            <ListItem disablePadding>
              <ListItemText
                primary="Race Distance"
                secondary={selectedDistance?.displayName || formData.raceDistance}
              />
            </ListItem>
          </Grid>
          {formData.travelRequired && (
            <Grid item xs={12}>
              <ListItem disablePadding>
                <ListItemText
                  primary="Travel Required"
                  secondary={formData.travelRequired}
                />
              </ListItem>
            </Grid>
          )}
          {formData.comments && (
            <Grid item xs={12}>
              <ListItem disablePadding>
                <ListItemText
                  primary="Comments"
                  secondary={formData.comments}
                />
              </ListItem>
            </Grid>
          )}
        </Grid>
      </Paper>

      <Paper variant="outlined" sx={{ p: 3 }}>
        <Typography variant="h6" gutterBottom>
          Payment Information
        </Typography>
        <Typography variant="body2" paragraph>
          {!isEditingExisting ? 
            'After submitting your registration, you will need to pay the following fees:' :
            'Your registration requires the following payments:'
          }
        </Typography>
        <List disablePadding>
          <ListItem sx={{ py: 1, px: 0 }}>
            <ListItemText primary="Entry Fee" secondary={`${event.fees.participation} kr`} />
          </ListItem>
          <ListItem sx={{ py: 1, px: 0 }}>
            <ListItemText primary="Base Camp Fee" secondary={`${event.fees.baseCamp} kr`} />
          </ListItem>
          <ListItem sx={{ py: 1, px: 0 }}>
            <ListItemText primary="Deposit" secondary={`${event.fees.deposit} kr`} />
          </ListItem>
          <ListItem sx={{ py: 1, px: 0 }}>
            <ListItemText primary="Total Fee" secondary={`${event.fees.total} kr`} />
          </ListItem>
          {isEditingExisting && (
            <>
              <ListItem sx={{ py: 1, px: 0 }}>
                <ListItemText primary="Payment Made" />
                <Typography variant="body2">
                  {formData.paymentMade} NOK
                </Typography>
              </ListItem>
              
              {formData.paymentMade < formData.paymentRequired && (
                <ListItem sx={{ py: 1, px: 0 }}>
                  <ListItemText primary="Payment Remaining" />
                  <Typography variant="subtitle1" color="error" sx={{ fontWeight: 700 }}>
                    {formData.paymentRequired - formData.paymentMade} NOK
                  </Typography>
                </ListItem>
              )}
            </>
          )}
        </List>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
          {!isEditingExisting ? 
            'Payment instructions will be sent to your email after registration.' :
            formData.paymentMade < formData.paymentRequired ?
              'Registration is not valid until the full payment has been made.' :
              'Required payments have been made.'
          }
        </Typography>
      </Paper>

      <Box sx={{ mt: 3 }}>
        <Box sx={{ mb: 2 }}>
          <FormControlLabel
            control={
              <Checkbox
                checked={formData.notifyFutureEvents}
                name="notifyFutureEvents"
                color="primary"
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => onChange('notifyFutureEvents', e.target.checked)}
              />
            }
            label={
              <Typography variant="body2">
                Notify me and send me information about future events
              </Typography>
            }
          />
        </Box>
        
        <Box sx={{ mb: 2 }}>
          <FormControlLabel
            control={
              <Checkbox
                checked={formData.sendRunningOffers}
                name="sendRunningOffers"
                color="primary"
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => onChange('sendRunningOffers', e.target.checked)}
              />
            }
            label={
              <Typography variant="body2">
                Send me relevant information and offers related to trail and ultra running
              </Typography>
            }
          />
        </Box>
        
        <FormControlLabel
          control={
            // This is a controlled checkbox component that is responsible for managing the state of the
            // "termsAccepted" field in the form data. The checkbox is checked if the value of
            // formData.termsAccepted is true, and unchecked if it is false.
            <Checkbox
              checked={formData.termsAccepted}
              name="termsAccepted"
              color="primary"
              // The "onChange" property is a function that is called whenever the checkbox is clicked.
              // The function takes a single argument, which is the event object that was generated by
              // the browser when the checkbox was clicked.
              onChange={(e) => onChange('termsAccepted', e.target.checked)}
              // The "onBlur" property is a function that is called whenever the checkbox loses focus.
              // The function takes no arguments. The reason we have an onBlur handler here is to validate
              // the field when the user clicks away from it.
              onBlur={() => onBlur && onBlur('termsAccepted')}
            />
          }
          label={
            <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
              I confirm that all information provided is accurate and I accept the <Link 
                component="button" 
                variant="body2" 
                onClick={(e) => {
                  e.preventDefault();
                  handleOpenTermsDialog();
                }}
                sx={{ textDecoration: 'underline' }}
              >
                terms and conditions
              </Link> for KUTC 2025.<span style={{ color: 'grey' }}> *</span>
            </Typography>
          }
          ref={fieldRefs.termsAccepted}
        />
        <FormHelperText error={!!errors.termsAccepted}>
          {errors.termsAccepted || ''}
        </FormHelperText>
        
        <Box sx={{ mb: 2, display: 'flex', justifyContent: 'flex-start' }}>
          <Button
            variant="outlined"
            size="small"
            onClick={() => {
              onChange('notifyFutureEvents', true);
              onChange('sendRunningOffers', true);
              onChange('termsAccepted', true);
            }}
          >
            Accept all the above
          </Button>
        </Box>

        { (formData.isOnWaitinglist || (isFull && !isEditingExisting)) && (
          <Box sx={{ mb: 2, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
            <Typography variant="body2">
              I want my spot on the waiting-list to expire if I'm not promoted to the participants list before the following date:
            </Typography>
            <LocalizationProvider dateAdapter={AdapterDateFns as any} adapterLocale={nb}>
              <DatePicker
                value={formData.waitinglistExpires}
                onChange={(date) => onChange('waitinglistExpires', date)}
                onClose={() => onBlur && onBlur('waitinglistExpires')}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    error={!!errors.waitinglistExpires}
                    helperText={errors.waitinglistExpires || ''}
                    inputRef={fieldRefs.waitinglistExpires as any}
                    sx={{
                      width: { xs: '100%', sm: '50%' },
                      '& .MuiInputBase-input': {
                        color: 'text.primary',
                      },
                    }}
                  />
                )}
              />
            </LocalizationProvider>
          </Box>
        )}
        
      </Box>
      
      {/* Terms and Conditions Dialog */}
      <TermsAndConditions 
        open={termsDialogOpen} 
        onClose={handleCloseTermsDialog} 
      />
    </Box>
  );
};

export default ReviewRegistration;
