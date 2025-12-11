import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocalizedField } from '../../hooks/useLocalizedField';
import {
  Typography,
  Box,
  Grid,
  List,
  ListItem,
  ListItemText,
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
import { CurrentEvent, DEFAULT_REGISTRATION_CONFIG, RegistrationConfig } from '../../contexts/EventEditionContext';
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
    hasYearLicense?: boolean;
    licenseNumber?: string;
  };
  errors: Record<string, string>;
  fieldRefs: Record<string, React.RefObject<HTMLDivElement | null>>;
  onChange: (field: string, value: any) => void;
  onBlur?: (field: string) => void;
  isEditingExisting?: boolean;
  isFull?: boolean;
}

const ReviewRegistration: React.FC<ReviewRegistrationProps> = ({ event, formData, errors, fieldRefs, onChange, onBlur, isEditingExisting = false, isFull = false }) => {
  const { t } = useTranslation();
  const getLocalizedField = useLocalizedField();
  
  // Get registration config with defaults
  const config: RegistrationConfig = {
    fields: {
      ...DEFAULT_REGISTRATION_CONFIG.fields,
      ...event.registrationConfig?.fields
    }
  };
  
  // State for terms and conditions dialog
  const [termsDialogOpen, setTermsDialogOpen] = useState(false);

  // Find the selected race distance
  const selectedDistance = event.raceDistances?.find(
    (distance) => distance.id === formData.raceDistance
  );

  // Calculate fees based on selected distance
  const participationFee = selectedDistance?.fees?.participation ?? event.fees?.participation ?? 0;
  const licenseFee = selectedDistance?.fees?.oneTimeLicense ?? event.fees?.oneTimeLicense ?? 0;
  const serviceFee = selectedDistance?.fees?.service ?? event.fees?.service ?? event.fees?.baseCamp ?? 0;
  const depositFee = selectedDistance?.fees?.deposit ?? event.fees?.deposit ?? 0;
  
  // Only charge license fee if user doesn't have year license
  const actualLicenseFee = (licenseFee > 0 && formData.hasYearLicense !== true) ? licenseFee : 0;
  const totalFee = participationFee + actualLicenseFee + serviceFee + depositFee;

  // Find the selected nationality and phone code
  const selectedCountry = COUNTRIES.find(
    (country) => country.code === formData.nationality
  );
  
  // Handle opening and closing the terms dialog
  const handleOpenTermsDialog = () => setTermsDialogOpen(true);
  const handleCloseTermsDialog = () => setTermsDialogOpen(false);
  
  const notifyCheckboxRef = useRef<HTMLInputElement>(null);

  // Effect to scroll to top and focus on the notify checkbox when component mounts
  useEffect(() => {
    window.scrollTo(0, 0);
    // Focus on the notify checkbox after a small delay to ensure it's rendered
    const timer = setTimeout(() => {
      if (notifyCheckboxRef.current) {
        notifyCheckboxRef.current.focus();
      }
    }, 100);
    
    return () => clearTimeout(timer);
  }, []);

  return (
    <Box sx={{ mt: 2, mb: 4 }}>
      <Typography variant="h6" gutterBottom>
        {t('form.review')}
      </Typography>
      <Typography variant="body2" color="text.secondary" paragraph>
        {t('form.reviewDesc')}
      </Typography>

      {!isEditingExisting && (
        <Alert severity="info" sx={{ mb: 3 }}>
          {t('form.paymentInfoAlert')}
        </Alert>
      )}

      <Paper variant="outlined" sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          {t('form.personalInfo')}
        </Typography>
        <Grid container spacing={2}>
          <Grid item xs={12} sm={6}>
            <ListItem disablePadding>
              <ListItemText
                primary={t('form.fullName')}
                secondary={`${formData.firstName} ${formData.lastName}`}
              />
            </ListItem>
          </Grid>
          <Grid item xs={12} sm={6}>
            <ListItem disablePadding>
              <ListItemText
                primary={t('form.dateOfBirth')}
                secondary={formData.dateOfBirth ? formData.dateOfBirth.toLocaleDateString() : t('form.notProvided')}
              />
            </ListItem>
          </Grid>
          <Grid item xs={12} sm={6}>
            <ListItem disablePadding>
              <ListItemText
                primary={t('form.nationality')}
                secondary={selectedCountry ? selectedCountry.name : formData.nationality}
              />
            </ListItem>
          </Grid>
          <Grid item xs={12} sm={6}>
            <ListItem disablePadding>
              <ListItemText
                primary={t('form.email')}
                secondary={formData.email}
              />
            </ListItem>
          </Grid>
          <Grid item xs={12} sm={6}>
            <ListItem disablePadding>
              <ListItemText
                primary={t('form.mobilePhone')}
                secondary={`${formData.phoneCountryCode} ${formData.phoneNumber}`}
              />
            </ListItem>
          </Grid>
          {formData.representing && (
            <Grid item xs={12} sm={6}>
              <ListItem disablePadding>
                <ListItemText
                  primary={t('form.representing')}
                  secondary={formData.representing}
                />
              </ListItem>
            </Grid>
          )}
        </Grid>
      </Paper>

      <Paper variant="outlined" sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          {t('form.raceDetails')}
        </Typography>
        <Grid container spacing={2}>
          <Grid item xs={12}>
            <ListItem disablePadding>
              <ListItemText
                primary={t('form.selectDistance')}
                secondary={selectedDistance ? getLocalizedField(selectedDistance, 'displayName') : formData.raceDistance}
              />
            </ListItem>
          </Grid>
          {config.fields.travelRequired && formData.travelRequired && (
            <Grid item xs={12}>
              <ListItem disablePadding>
                <ListItemText
                  primary={t('form.travelRequired')}
                  secondary={formData.travelRequired}
                />
              </ListItem>
            </Grid>
          )}
          {config.fields.comments && formData.comments && (
            <Grid item xs={12}>
              <ListItem disablePadding>
                <ListItemText
                  primary={t('form.comments')}
                  secondary={formData.comments}
                />
              </ListItem>
            </Grid>
          )}
          {/* License info */}
          {licenseFee > 0 && (
            <Grid item xs={12}>
              <ListItem disablePadding>
                <ListItemText
                  primary={t('form.licenseSection')}
                  secondary={
                    formData.hasYearLicense === true 
                      ? `${t('form.licenseYes')} - ${formData.licenseNumber || ''}`
                      : t('form.licenseNo')
                  }
                />
              </ListItem>
            </Grid>
          )}
        </Grid>
      </Paper>

      <Paper variant="outlined" sx={{ p: 3 }}>
        <Typography variant="h6" gutterBottom>
          {t('form.paymentInfo')}
        </Typography>
        <Typography variant="body2" paragraph>
          {!isEditingExisting ? 
            t('form.paymentAfterSubmit') :
            t('form.paymentRequired')
          }
        </Typography>
        <List disablePadding>
          <ListItem sx={{ py: 1, px: 0 }}>
            <ListItemText primary={t('form.entryFee')} secondary={`${participationFee} kr`} />
          </ListItem>
          {/* Show license fee line - either charged or waived */}
          {licenseFee > 0 && (
            <ListItem sx={{ py: 1, px: 0 }}>
              <ListItemText 
                primary={t('form.oneTimeLicenseFee')} 
                secondary={
                  formData.hasYearLicense === true 
                    ? t('form.yearLicenseInfo')
                    : `${licenseFee} kr`
                } 
              />
            </ListItem>
          )}
          {serviceFee > 0 && (
            <ListItem sx={{ py: 1, px: 0 }}>
              <ListItemText primary={t('form.baseCampFee')} secondary={`${serviceFee} kr`} />
            </ListItem>
          )}
          {depositFee > 0 && (
            <ListItem sx={{ py: 1, px: 0 }}>
              <ListItemText primary={t('form.deposit')} secondary={`${depositFee} kr`} />
            </ListItem>
          )}
          <ListItem sx={{ py: 1, px: 0, borderTop: '1px solid', borderColor: 'divider' }}>
            <ListItemText 
              primary={<Typography fontWeight={600}>{t('form.totalFee')}</Typography>} 
              secondary={`${totalFee} kr`} 
            />
          </ListItem>
          {isEditingExisting && (
            <>
              <ListItem sx={{ py: 1, px: 0 }}>
                <ListItemText primary={t('form.paymentMadeLabel')} />
                <Typography variant="body2">
                  {formData.paymentMade} NOK
                </Typography>
              </ListItem>
              
              {formData.paymentMade < formData.paymentRequired && (
                <ListItem sx={{ py: 1, px: 0 }}>
                  <ListItemText primary={t('form.paymentRemaining')} />
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
            t('form.paymentInstructions') :
            formData.paymentMade < formData.paymentRequired ?
              t('form.paymentNotValid') :
              t('form.paymentComplete')
          }
        </Typography>
      </Paper>

      <Box sx={{ mt: 3 }}>
        <Box sx={{ mb: 2 }}>
          <FormControlLabel
            control={
              <Checkbox
                inputRef={notifyCheckboxRef}
                checked={formData.notifyFutureEvents}
                name="notifyFutureEvents"
                color="primary"
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => onChange('notifyFutureEvents', e.target.checked)}
              />
            }
            label={
              <Typography variant="body2">
                {t('form.notifyFutureEventsLabel')}
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
                {t('form.sendRunningOffersLabel')}
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
              {t('form.confirmTerms')} <Link 
                component="button" 
                variant="body2" 
                onClick={(e) => {
                  e.preventDefault();
                  handleOpenTermsDialog();
                }}
                sx={{ textDecoration: 'underline' }}
              >
                {t('form.termsLink')}
              </Link> {t('form.forEvent')} {event.eventName}.<span style={{ color: 'grey' }}> *</span>
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
            {t('form.acceptAll')}
          </Button>
        </Box>

        { (formData.isOnWaitinglist || (isFull && !isEditingExisting)) && (
          <Box sx={{ mb: 2, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
            <Typography variant="body2">
              {t('form.waitlistExpiryLabel')}
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
        eventId={event.eventId}
      />
    </Box>
  );
};

export default ReviewRegistration;
