import React, { useEffect, useState } from 'react';
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
import { RACE_DISTANCES, COUNTRIES, RACE_DETAILS, PHONE_CODES } from '../../constants';
import TermsAndConditions from './TermsAndConditions';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { LocalizationProvider, DatePicker } from '@mui/x-date-pickers';
import { nb } from 'date-fns/locale';

interface ReviewRegistrationProps {
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

const ReviewRegistration: React.FC<ReviewRegistrationProps> = ({ formData, errors, fieldRefs, onChange, onBlur, isEditingExisting = false, isFull = false }) => {
  // State for terms and conditions dialog
  const [termsDialogOpen, setTermsDialogOpen] = useState(false);

  // Find the selected race distance
  const selectedDistance = RACE_DISTANCES.find(
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
                secondary={selectedDistance ? selectedDistance.displayName : 'Not selected'}
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
            <ListItemText primary="Participation Fee" />
            <Typography variant="body2">{RACE_DETAILS.fees.participation} NOK</Typography>
          </ListItem>
          <ListItem sx={{ py: 1, px: 0 }}>
            <ListItemText primary="Base Camp Services" />
            <Typography variant="body2">{RACE_DETAILS.fees.baseCamp} NOK</Typography>
          </ListItem>
          <ListItem sx={{ py: 1, px: 0 }}>
            <ListItemText primary="Refundable Deposit" secondary="Returned if you show up for the race" />
            <Typography variant="body2">{RACE_DETAILS.fees.deposit} NOK</Typography>
          </ListItem>
          <Divider />
          <ListItem sx={{ py: 1, px: 0 }}>
            <ListItemText primary="Total" />
            <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
              {RACE_DETAILS.fees.total} NOK
            </Typography>
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
            <Checkbox
              checked={formData.termsAccepted}
              name="termsAccepted"
              color="primary"
              onChange={(e) => onChange('termsAccepted', e.target.checked)}
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

        {isFull && (
          <>
            <Box sx={{ mb: 2, display: 'flex', alignItems: 'center' }}>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={formData.isOnWaitinglist}
                    name="isOnWaitinglist"
                    color="primary"
                    onChange={(e) => onChange('isOnWaitinglist', e.target.checked)}
                    inputRef={fieldRefs.isOnWaitinglist as any}
                  />
                }
                label={
                  <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                    I want to join the waiting-list, and am aware that this does not secure me a place in the race.<span style={{ color: 'grey' }}> *</span>
                  </Typography>
                }
                ref={fieldRefs.isOnWaitinglist}
              />
            </Box>
            <FormHelperText error={!!errors.isOnWaitinglist}>
              {errors.isOnWaitinglist || ''}
            </FormHelperText>

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
          </>
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
