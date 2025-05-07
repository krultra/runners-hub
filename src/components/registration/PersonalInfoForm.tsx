import React, { useEffect } from 'react';
import {
  Grid,
  TextField,
  Typography,
  Box,
  FormHelperText,
  Autocomplete,
  InputAdornment
} from '@mui/material';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { LocalizationProvider, DatePicker } from '@mui/x-date-pickers';
// import { format } from 'date-fns'; // Not needed
import { nb } from 'date-fns/locale';
import { COUNTRIES, PHONE_CODES } from '../../constants';

interface PersonalInfoFormProps {
  formData: {
    firstName: string;
    lastName: string;
    dateOfBirth: Date | null;
    nationality: string;
    email: string;
    phoneCountryCode: string;
    phoneNumber: string;
    representing: string;
  };
  onChange: (field: string, value: any) => void;
  errors: Record<string, string>;
  fieldRefs: Record<string, React.RefObject<HTMLDivElement | null>>;
  onBlur?: (field: string) => void;
  isEmailReadOnly?: boolean;
}

const PersonalInfoForm: React.FC<PersonalInfoFormProps> = ({ formData, onChange, errors, fieldRefs, onBlur, isEmailReadOnly }) => {
  // No longer needed with Autocomplete component

  // Effect to scroll to top when component mounts
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  // Find selected country and phone code
  const selectedPhoneCode = PHONE_CODES.find(pc => pc.code === formData.phoneCountryCode) || PHONE_CODES[0];

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns as any} adapterLocale={nb}>
      <Box sx={{ mt: 2, mb: 4 }}>
        <Typography variant="h6" gutterBottom>
          Personal Information
        </Typography>
        <Typography variant="body2" color="text.secondary" paragraph>
          Please provide your personal details for registration.
        </Typography>
        
        <Grid container spacing={3}>
          <Grid item xs={12} sm={6}>
            <TextField
              required
              id="firstName"
              name="firstName"
              label="First and Middle Names"
              fullWidth
              variant="outlined"
              value={formData.firstName}
              onChange={(e) => onChange('firstName', e.target.value)}
              inputProps={{ maxLength: 60 }}
              onBlur={() => onBlur && onBlur('firstName')}
              error={!!errors.firstName}
              helperText={errors.firstName || ''}
              inputRef={fieldRefs.firstName as any}
              autoFocus
              sx={{
                '& .MuiInputBase-input': {
                  color: 'text.primary',
                }
              }}
            />
          </Grid>
          
          <Grid item xs={12} sm={6}>
            <TextField
              required
              id="lastName"
              name="lastName"
              label="Last Name"
              fullWidth
              variant="outlined"
              value={formData.lastName}
              onChange={(e) => onChange('lastName', e.target.value)}
              inputProps={{ maxLength: 60 }}
              onBlur={() => onBlur && onBlur('lastName')}
              error={!!errors.lastName}
              helperText={errors.lastName || ''}
              inputRef={fieldRefs.lastName as any}
              sx={{
                '& .MuiInputBase-input': {
                  color: 'text.primary',
                }
              }}
            />
          </Grid>
          
          <Grid item xs={12} sm={6}>
            <DatePicker
              label="Date of Birth"
              value={formData.dateOfBirth}
              onChange={(date) => onChange('dateOfBirth', date)}
              onClose={() => onBlur && onBlur('dateOfBirth')}
              renderInput={(params) => (
                <TextField
                  {...params}
                  fullWidth
                  variant="outlined"
                  required
                  error={!!errors.dateOfBirth}
                  helperText={errors.dateOfBirth || ''}
                  inputRef={fieldRefs.dateOfBirth}
                  sx={{
                    '& .MuiInputBase-input': {
                      color: 'text.primary',
                    }
                  }}
                />
              )}
              // Norwegian date format
              // Using Norwegian date format
              // formatDensity="spacious" removed as it's not supported in this version
            />
          </Grid>
          
          <Grid item xs={12} sm={6}>
            <Autocomplete
              id="nationality-autocomplete"
              options={COUNTRIES}
              getOptionLabel={(option) => option.name}
              groupBy={(option) => option.isCommon ? 'Common Countries' : 'All Countries'}
              value={COUNTRIES.find(country => country.code === formData.nationality) || null}
              onChange={(_, newValue) => {
                if (newValue) {
                  onChange('nationality', newValue.code);
                }
              }}
              onBlur={() => onBlur && onBlur('nationality')}
              renderInput={(params) => (
                <TextField
                  {...params}
                  required
                  label="Nationality"
                  variant="outlined"
                  helperText={errors.nationality || 'Select your country of citizenship'}
                  error={!!errors.nationality}
                  inputRef={fieldRefs.nationality}
                  sx={{
                    '& .MuiInputBase-input': {
                      color: 'text.primary',
                    }
                  }}
                />
              )}
            />
          </Grid>
          
          <Grid item xs={12}>
            {isEmailReadOnly ? (
              <Box sx={{ mt: 2, mb: 1 }}>
                <Typography variant="subtitle2" color="text.secondary">
                  Email Address
                </Typography>
                <Typography
  variant="body1"
  sx={theme => ({
    px: 1,
    py: 1,
    bgcolor: theme.palette.mode === 'dark' ? theme.palette.grey[900] : theme.palette.grey[100],
    color: theme.palette.text.primary,
    borderRadius: 1,
    wordBreak: 'break-all',
    fontFamily: 'monospace',
    fontSize: '1rem',
    fontWeight: 500
  })}
  tabIndex={-1}
>
  {formData.email}
</Typography>
                <FormHelperText sx={{ ml: 0 }}>{errors.email || "We'll send your registration confirmation to this email"}</FormHelperText>
              </Box>
            ) : (
              <TextField
                required
                id="email"
                name="email"
                label="Email Address"
                fullWidth
                variant="outlined"
                type="email"
                value={formData.email}
                onChange={(e) => onChange('email', e.target.value)}
                inputProps={{ maxLength: 60 }}
                onBlur={() => onBlur && onBlur('email')}
                error={!!errors.email}
                helperText={errors.email || "We'll send your registration confirmation to this email"}
                inputRef={fieldRefs.email as any}
                sx={{
                  '& .MuiInputBase-input': {
                    color: 'text.primary',
                  }
                }}
              />
            )}
          </Grid>
          
          <Grid item xs={12} sm={6}>
            <Autocomplete
              id="phone-code-autocomplete"
              options={PHONE_CODES}
              getOptionLabel={(option) => `${option.flag} ${option.code} (${option.country})`}
              groupBy={(option) => option.isCommon ? 'Common Countries' : 'All Countries'}
              value={selectedPhoneCode}
              onChange={(_, newValue) => {
                if (newValue) {
                  onChange('phoneCountryCode', newValue.code);
                }
              }}
              onBlur={() => onBlur && onBlur('phoneCountryCode')}
              renderInput={(params) => (
                <TextField
                  {...params}
                  required
                  label="Country Code"
                  variant="outlined"
                  error={!!errors.phoneCountryCode}
                  helperText={errors.phoneCountryCode || ''}
                  inputRef={fieldRefs.phoneCountryCode}
                  sx={{
                    '& .MuiInputBase-input': {
                      color: 'text.primary',
                    }
                  }}
                />
              )}
            />
          </Grid>
          
          <Grid item xs={12} sm={6}>
            <TextField
              required
              id="phoneNumber"
              name="phoneNumber"
              label="Phone Number"
              fullWidth
              variant="outlined"
              value={formData.phoneNumber}
              onChange={(e) => onChange('phoneNumber', e.target.value.replace(/[^0-9+\-\s()]/g, ''))}
              onBlur={() => onBlur && onBlur('phoneNumber')}
              error={!!errors.phoneNumber}
              helperText={errors.phoneNumber || "Enter number without country code"}
              inputRef={fieldRefs.phoneNumber as any}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    {selectedPhoneCode.flag}
                  </InputAdornment>
                ),
              }}
              sx={{
                '& .MuiInputBase-input': {
                  color: 'text.primary',
                }
              }}
            />
          </Grid>
          
          <Grid item xs={12}>
            <TextField
              id="representing"
              name="representing"
              label="Representing (Optional)"
              fullWidth
              variant="outlined"
              value={formData.representing}
              onChange={(e) => onChange('representing', e.target.value)}
              inputProps={{ maxLength: 60 }}
              helperText="Sports club, company, charity, etc."
            />
          </Grid>
        </Grid>
      </Box>
    </LocalizationProvider>
  );
};

export default PersonalInfoForm;
