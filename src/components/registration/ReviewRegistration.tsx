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
  Radio,
  RadioGroup,
  FormControl,
  FormLabel,
  FormControlLabel,
  FormHelperText,
  Tooltip,
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
    termsAccepted: boolean | undefined;
    comments: string;
    notifyFutureEvents: boolean | undefined;
    sendRunningOffers: boolean | undefined;
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
  showUpdateRunnerProfileOption?: boolean;
  updateRunnerProfileChecked?: boolean;
  onUpdateRunnerProfileChange?: (checked: boolean) => void;
}

const ReviewRegistration: React.FC<ReviewRegistrationProps> = ({
  event,
  formData,
  errors,
  fieldRefs,
  onChange,
  onBlur,
  isEditingExisting = false,
  isFull = false,
  showUpdateRunnerProfileOption,
  updateRunnerProfileChecked,
  onUpdateRunnerProfileChange
}) => {
  const { t, i18n } = useTranslation();
  const getLocalizedField = useLocalizedField();
  const lang = i18n.language?.toLowerCase() || '';
  const currencyUnit = (lang.startsWith('no') || lang.startsWith('nb') || lang.startsWith('nn')) ? 'kr' : 'NOK';
  
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
  const paymentRemaining = Math.max(0, totalFee - (formData.paymentMade ?? 0));

  const renderInfo = (title: string) => (
    <Tooltip title={title} arrow placement="top">
      <Box
        component="span"
        sx={{
          ml: 1,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 18,
          height: 18,
          borderRadius: '50%',
          border: '1px solid',
          borderColor: 'text.secondary',
          color: 'text.secondary',
          fontSize: 12,
          lineHeight: 1,
          cursor: 'help',
          userSelect: 'none'
        }}
        aria-label="Info"
      >
        i
      </Box>
    </Tooltip>
  );

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
            <ListItemText primary={t('form.entryFee')} secondary={`${participationFee} ${currencyUnit}`} />
          </ListItem>
          {/* Show license fee line - either charged or waived */}
          {licenseFee > 0 && (
            <ListItem sx={{ py: 1, px: 0 }}>
              <ListItemText 
                primary={t('form.oneTimeLicenseFee')} 
                secondary={
                  formData.hasYearLicense === true 
                    ? t('form.yearLicenseInfo')
                    : `${licenseFee} ${currencyUnit}`
                } 
              />
            </ListItem>
          )}
          {serviceFee > 0 && (
            <ListItem sx={{ py: 1, px: 0 }}>
              <ListItemText primary={t('form.baseCampFee')} secondary={`${serviceFee} ${currencyUnit}`} />
            </ListItem>
          )}
          {depositFee > 0 && (
            <ListItem sx={{ py: 1, px: 0 }}>
              <ListItemText primary={t('form.deposit')} secondary={`${depositFee} ${currencyUnit}`} />
            </ListItem>
          )}
          <ListItem sx={{ py: 1, px: 0, borderTop: '1px solid', borderColor: 'divider' }}>
            <ListItemText 
              primary={<Typography fontWeight={600}>{t('form.totalFee')}</Typography>} 
              secondary={`${totalFee} ${currencyUnit}`} 
            />
          </ListItem>
          {isEditingExisting && (
            <>
              <ListItem sx={{ py: 1, px: 0 }}>
                <ListItemText primary={t('form.paymentMadeLabel')} />
                <Typography variant="body2">
                  {formData.paymentMade} {currencyUnit}
                </Typography>
              </ListItem>
              
              {paymentRemaining > 0 && (
                <ListItem sx={{ py: 1, px: 0 }}>
                  <ListItemText primary={t('form.paymentRemaining')} />
                  <Typography variant="subtitle1" color="error" sx={{ fontWeight: 700 }}>
                    {paymentRemaining} {currencyUnit}
                  </Typography>
                </ListItem>
              )}
            </>
          )}
        </List>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
          {!isEditingExisting ? 
            t('form.paymentInstructions') :
            paymentRemaining > 0 ?
              t('form.paymentNotValid') :
              t('form.paymentComplete')
          }
        </Typography>
      </Paper>

      <Box sx={{ mt: 3 }}>
        {showUpdateRunnerProfileOption && onUpdateRunnerProfileChange && (
          <Box sx={{ mb: 2 }}>
            <FormControl component="fieldset" variant="standard">
              <FormLabel component="legend">
                <Box sx={{ display: 'inline-flex', alignItems: 'center' }}>
                  <Typography variant="body2">{t('registration.updateRunnerProfile')}</Typography>
                  {renderInfo(t('registration.updateRunnerProfileInfo'))}
                </Box>
              </FormLabel>
              <RadioGroup
                row
                name="updateRunnerProfile"
                value={Boolean(updateRunnerProfileChecked) ? 'yes' : 'no'}
                onChange={(e) => {
                  const v = e.target.value;
                  onUpdateRunnerProfileChange(v === 'yes');
                }}
              >
                <FormControlLabel value="yes" control={<Radio />} label={t('common.yes')} />
                <FormControlLabel value="no" control={<Radio />} label={t('common.no')} />
              </RadioGroup>
            </FormControl>
          </Box>
        )}
        <Box sx={{ mb: 2 }} ref={fieldRefs.notifyFutureEvents}>
          <FormControl error={!!errors.notifyFutureEvents} component="fieldset" variant="standard">
            <FormLabel component="legend">
              <Box sx={{ display: 'inline-flex', alignItems: 'center' }}>
                <Typography variant="body2">
                  {t('form.notifyFutureEventsLabel')}<span style={{ color: 'grey' }}> *</span>
                </Typography>
                {renderInfo(t('form.notifyFutureEventsInfo'))}
              </Box>
            </FormLabel>
            <RadioGroup
              row
              name="notifyFutureEvents"
              value={formData.notifyFutureEvents === true ? 'yes' : formData.notifyFutureEvents === false ? 'no' : ''}
              onChange={(e) => {
                const v = e.target.value;
                onChange('notifyFutureEvents', v === 'yes');
                if (onBlur) {
                  setTimeout(() => onBlur('notifyFutureEvents'), 0);
                }
              }}
            >
              <FormControlLabel value="yes" control={<Radio inputRef={notifyCheckboxRef} />} label={t('common.yes')} />
              <FormControlLabel value="no" control={<Radio />} label={t('common.no')} />
            </RadioGroup>
            <FormHelperText>{errors.notifyFutureEvents || ''}</FormHelperText>
          </FormControl>
        </Box>

        <Box sx={{ mb: 2 }} ref={fieldRefs.sendRunningOffers}>
          <FormControl error={!!errors.sendRunningOffers} component="fieldset" variant="standard">
            <FormLabel component="legend">
              <Box sx={{ display: 'inline-flex', alignItems: 'center' }}>
                <Typography variant="body2">
                  {t('form.sendRunningOffersLabel')}<span style={{ color: 'grey' }}> *</span>
                </Typography>
                {renderInfo(t('form.sendRunningOffersInfo'))}
              </Box>
            </FormLabel>
            <RadioGroup
              row
              name="sendRunningOffers"
              value={formData.sendRunningOffers === true ? 'yes' : formData.sendRunningOffers === false ? 'no' : ''}
              onChange={(e) => {
                const v = e.target.value;
                onChange('sendRunningOffers', v === 'yes');
                if (onBlur) {
                  setTimeout(() => onBlur('sendRunningOffers'), 0);
                }
              }}
            >
              <FormControlLabel value="yes" control={<Radio />} label={t('common.yes')} />
              <FormControlLabel value="no" control={<Radio />} label={t('common.no')} />
            </RadioGroup>
            <FormHelperText>{errors.sendRunningOffers || ''}</FormHelperText>
          </FormControl>
        </Box>
        
        <Box sx={{ mb: 1 }} ref={fieldRefs.termsAccepted}>
          <FormControl error={!!errors.termsAccepted} component="fieldset" variant="standard">
            <FormLabel component="legend">
              <Box sx={{ display: 'inline-flex', alignItems: 'center', flexWrap: 'wrap' }}>
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
                {renderInfo(t('form.termsAcceptedInfo'))}
              </Box>
            </FormLabel>
            <RadioGroup
              row
              name="termsAccepted"
              value={formData.termsAccepted === true ? 'yes' : formData.termsAccepted === false ? 'no' : ''}
              onChange={(e) => {
                const v = e.target.value;
                onChange('termsAccepted', v === 'yes');
                if (onBlur) {
                  setTimeout(() => onBlur('termsAccepted'), 0);
                }
              }}
            >
              <FormControlLabel value="yes" control={<Radio />} label={t('common.yes')} />
              <FormControlLabel value="no" control={<Radio />} label={t('common.no')} />
            </RadioGroup>
            <FormHelperText>{errors.termsAccepted || ''}</FormHelperText>
          </FormControl>
        </Box>
        
        <Box sx={{ mb: 2, display: 'flex', justifyContent: 'flex-start' }}>
          <Button
            variant="outlined"
            size="small"
            onClick={() => {
              onChange('notifyFutureEvents', true);
              onChange('sendRunningOffers', true);
              onChange('termsAccepted', true);
              if (onUpdateRunnerProfileChange) onUpdateRunnerProfileChange(true);
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
