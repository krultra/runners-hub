import React, { useEffect, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocalizedField } from '../../hooks/useLocalizedField';
import {
  Grid,
  TextField,
  FormControl,
  FormControlLabel,
  RadioGroup,
  Radio,
  Typography,
  Box,
  FormLabel,
  FormHelperText,
  Alert,
  Link
} from '@mui/material';
import { CurrentEvent, DEFAULT_REGISTRATION_CONFIG, RegistrationConfig } from '../../contexts/EventEditionContext';

interface RaceDetailsFormProps {
  formData: {
    raceDistance: string;
    travelRequired: string;
    comments: string;
    hasYearLicense?: boolean;
    licenseNumber?: string;
    [key: string]: any;
  };
  onChange: (field: string, value: any) => void;
  errors: Record<string, string>;
  fieldRefs: Record<string, React.RefObject<HTMLDivElement | null>>;
  onBlur?: (field: string) => void;
  event: CurrentEvent;
  touchedFields?: Record<string, boolean>;
}

// License number format: NNNNNN-YYYY (e.g., 221393-2025)
const LICENSE_NUMBER_REGEX = /^\d{6}-\d{4}$/;

const RaceDetailsForm: React.FC<RaceDetailsFormProps> = ({ 
  formData, 
  onChange, 
  errors, 
  fieldRefs, 
  onBlur, 
  event,
  touchedFields = {}
}) => {
  const { t } = useTranslation();
  const getLocalizedField = useLocalizedField();
  const firstRadioRef = useRef<HTMLInputElement>(null);

  const eventYear = useMemo(() => {
    const d = event?.startTime instanceof Date ? event.startTime : new Date(event?.startTime as any);
    const year = d && !Number.isNaN(d.getTime()) ? d.getFullYear() : new Date().getFullYear();
    return year;
  }, [event?.startTime]);

  const licenseExample = useMemo(() => `123456-${eventYear}`, [eventYear]);

  // Get registration config with defaults
  const config: RegistrationConfig = {
    fields: {
      ...DEFAULT_REGISTRATION_CONFIG.fields,
      ...event.registrationConfig?.fields
    }
  };

  // Get the selected race distance to check if license is required
  const selectedDistance = event.raceDistances?.find(d => d.id === formData.raceDistance);
  const licenseFee = selectedDistance?.fees?.oneTimeLicense ?? event.fees?.oneTimeLicense ?? 0;
  const requiresLicense = licenseFee > 0;

  // Effect to focus on the first radio button when the form mounts
  useEffect(() => {
    window.scrollTo(0, 0);
    if (firstRadioRef.current) {
      firstRadioRef.current.focus();
    }
  }, [event]);


  return (
    <Box sx={{ mt: 2, mb: 4 }}>
      <Typography variant="h6" gutterBottom>
        {t('form.raceDetails')}
      </Typography>
      <Typography variant="body2" color="text.secondary" paragraph>
        {t('form.raceDetailsDesc')}
      </Typography>
      
      <Grid container spacing={3}>
        <Grid item xs={12}>
          <FormControl 
            component="fieldset" 
            required 
            error={!!(errors.raceDistance && touchedFields.raceDistance)}
            fullWidth
            sx={{ mb: 2 }}
          >
            <FormLabel component="legend">{t('form.selectDistance')}</FormLabel>
            <RadioGroup
              aria-label="race-distance"
              name="raceDistance"
              value={formData.raceDistance}
              onChange={(e) => {
                onChange('raceDistance', e.target.value);
              }}
              onBlur={() => onBlur && onBlur('raceDistance')}
              ref={fieldRefs.raceDistance as any}
              sx={{ gap: 1 }}
            >
              {(event.raceDistances || []).map((distance, idx) => (
                <FormControlLabel
                  key={distance.id}
                  value={distance.id}
                  control={
                    <Radio inputRef={idx === 0 ? firstRadioRef : undefined} />
                  }
                  label={getLocalizedField(distance, 'displayName') || distance.id}
                  sx={{ '& .MuiFormControlLabel-label': { fontSize: '0.9rem' } }}
                />
              ))}
            </RadioGroup>
            <FormHelperText error={!!(errors.raceDistance && touchedFields.raceDistance)}>
              {errors.raceDistance && touchedFields.raceDistance ? errors.raceDistance : t('form.raceDetailsDesc')}
            </FormHelperText>
          </FormControl>
        </Grid>
        
        {/* License Section - only show if a race is selected and license is required */}
        {formData.raceDistance && requiresLicense && (
          <Grid item xs={12}>
            <Box sx={{ mt: 2, mb: 2, p: 2, bgcolor: 'background.paper', borderRadius: 1, border: '1px solid', borderColor: 'divider' }}>
              <Typography variant="subtitle1" gutterBottom fontWeight={600}>
                {t('form.licenseSection')}
              </Typography>
              <Typography variant="body2" color="text.secondary" paragraph>
                {t('form.hasYearLicenseHelper')}
              </Typography>
              
              <FormControl 
                component="fieldset" 
                fullWidth
                error={!!errors.hasYearLicense}
                required
              >
                <FormLabel component="legend">{t('form.hasYearLicense')}</FormLabel>
                <RadioGroup
                  aria-label="has-year-license"
                  name="hasYearLicense"
                  value={formData.hasYearLicense === true ? 'yes' : formData.hasYearLicense === false ? 'no' : ''}
                  onChange={(e) => {
                    const hasLicense = e.target.value === 'yes';
                    onChange('hasYearLicense', hasLicense);
                    // Clear license number if switching to "no"
                    if (!hasLicense) {
                      onChange('licenseNumber', '');
                    }
                  }}
                  onBlur={() => onBlur && onBlur('hasYearLicense')}
                  ref={fieldRefs.hasYearLicense as any}
                >
                  <FormControlLabel
                    value="yes"
                    control={<Radio />}
                    label={t('form.licenseYes')}
                  />
                  <FormControlLabel
                    value="no"
                    control={<Radio />}
                    label={t('form.licenseNo')}
                  />
                </RadioGroup>
                {errors.hasYearLicense && (
                  <FormHelperText error>{errors.hasYearLicense}</FormHelperText>
                )}
              </FormControl>

              {/* Show license number field if user has year license */}
              {formData.hasYearLicense === true && (
                <Box sx={{ mt: 2 }}>
                  <TextField
                    required
                    id="licenseNumber"
                    name="licenseNumber"
                    label={t('form.licenseNumber')}
                    fullWidth
                    variant="outlined"
                    value={formData.licenseNumber || ''}
                    onChange={(e) => onChange('licenseNumber', e.target.value)}
                    onBlur={() => onBlur && onBlur('licenseNumber')}
                    error={!!errors.licenseNumber}
                    helperText={errors.licenseNumber || t('form.licenseNumberHelper', { example: licenseExample })}
                    inputRef={fieldRefs.licenseNumber as any}
                    placeholder={licenseExample}
                  />
                  <Typography variant="body2" sx={{ mt: 1 }}>
                    <Link
                      href="https://isonen.no/event/cm1qawqik00o613hlk5o1kjjq/#eventContentTableId"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {t('form.lookupLicense')}
                    </Link>
                  </Typography>
                </Box>
              )}

              {/* Show info about license fee */}
              {formData.hasYearLicense === true && (
                <Alert severity="success" sx={{ mt: 2 }}>
                  {t('form.yearLicenseInfo')}
                </Alert>
              )}
              {formData.hasYearLicense === false && (
                <Alert severity="info" sx={{ mt: 2 }}>
                  {t('form.oneTimeLicenseInfo', { amount: licenseFee })}
                </Alert>
              )}
            </Box>
          </Grid>
        )}

        {/* Travel Required - only show if configured */}
        {config.fields.travelRequired && (
          <Grid item xs={12}>
            <TextField
              id="travelRequired"
              name="travelRequired"
              label={t('form.travelRequired') || 'Travel Required'}
              required
              fullWidth
              multiline
              rows={3}
              variant="outlined"
              value={formData.travelRequired}
              onChange={(e) => onChange('travelRequired', e.target.value)}
              onBlur={() => onBlur && onBlur('travelRequired')}
              inputProps={{ maxLength: 200 }}
              error={!!(errors.travelRequired && touchedFields.travelRequired)}
              helperText={
                errors.travelRequired && touchedFields.travelRequired 
                  ? errors.travelRequired 
                  : t('form.travelHelper') || 'Please describe your travel plans'
              }
              inputRef={fieldRefs.travelRequired as any}
            />
          </Grid>
        )}
        
        {/* Comments - only show if configured */}
        {config.fields.comments && (
          <Grid item xs={12}>
            <TextField
              id="comments"
              name="comments"
              label={t('form.comments')}
              fullWidth
              multiline
              rows={3}
              variant="outlined"
              value={formData.comments}
              onChange={(e) => onChange('comments', e.target.value)}
              inputProps={{ maxLength: 500 }}
              helperText={t('form.commentsHelper')}
            />
          </Grid>
        )}
        {/* Terms and conditions moved to the Review & Submit page */}
      </Grid>
    </Box>
  );
};

export default RaceDetailsForm;
