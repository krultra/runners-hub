import React from 'react';
import {
  Grid,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Typography,
  Box,
  FormHelperText
} from '@mui/material';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { LocalizationProvider, DatePicker } from '@mui/x-date-pickers';
import { COUNTRIES } from '../../constants';

interface PersonalInfoFormProps {
  formData: {
    firstName: string;
    lastName: string;
    dateOfBirth: Date | null;
    nationality: string;
    email: string;
    mobilePhone: string;
    representing: string;
  };
  onChange: (field: string, value: any) => void;
}

const PersonalInfoForm: React.FC<PersonalInfoFormProps> = ({ formData, onChange }) => {
  // Calculate minimum date of birth (must be at least 18 years old)
  const today = new Date();
  const minDate = new Date(
    today.getFullYear() - 18,
    today.getMonth(),
    today.getDate()
  );

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns}>
      <Box sx={{ mt: 2, mb: 4 }}>
        <Typography variant="h6" gutterBottom>
          Personal Information
        </Typography>
        <Typography variant="body2" color="text.secondary" paragraph>
          Please provide your personal details for registration.
        </Typography>
        
        <Grid container spacing={3}>
          <Grid size={{ xs: 12, sm: 6 }}>
            <TextField
              required
              id="firstName"
              name="firstName"
              label="First Name(s)"
              fullWidth
              variant="outlined"
              value={formData.firstName}
              onChange={(e) => onChange('firstName', e.target.value)}
            />
          </Grid>
          
          <Grid size={{ xs: 12, sm: 6 }}>
            <TextField
              required
              id="lastName"
              name="lastName"
              label="Last Name"
              fullWidth
              variant="outlined"
              value={formData.lastName}
              onChange={(e) => onChange('lastName', e.target.value)}
            />
          </Grid>
          
          <Grid size={{ xs: 12, sm: 6 }}>
            <DatePicker
              label="Date of Birth *"
              value={formData.dateOfBirth}
              onChange={(date) => onChange('dateOfBirth', date)}
              maxDate={minDate}
              slotProps={{
                textField: {
                  fullWidth: true,
                  variant: 'outlined',
                  required: true,
                  helperText: 'You must be at least 18 years old'
                }
              }}
            />
          </Grid>
          
          <Grid size={{ xs: 12, sm: 6 }}>
            <FormControl fullWidth required>
              <InputLabel id="nationality-label">Nationality</InputLabel>
              <Select
                labelId="nationality-label"
                id="nationality"
                value={formData.nationality}
                label="Nationality"
                onChange={(e) => onChange('nationality', e.target.value)}
              >
                {COUNTRIES.map((country) => (
                  <MenuItem key={country.code} value={country.code}>
                    {country.name}
                  </MenuItem>
                ))}
              </Select>
              <FormHelperText>Select your country of citizenship</FormHelperText>
            </FormControl>
          </Grid>
          
          <Grid size={12}>
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
              helperText="We'll send your registration confirmation to this email"
            />
          </Grid>
          
          <Grid size={12}>
            <TextField
              required
              id="mobilePhone"
              name="mobilePhone"
              label="Mobile Phone"
              fullWidth
              variant="outlined"
              value={formData.mobilePhone}
              onChange={(e) => onChange('mobilePhone', e.target.value)}
              helperText="Include country code (e.g., +47 for Norway)"
            />
          </Grid>
          
          <Grid size={12}>
            <TextField
              id="representing"
              name="representing"
              label="Representing (Optional)"
              fullWidth
              variant="outlined"
              value={formData.representing}
              onChange={(e) => onChange('representing', e.target.value)}
              helperText="Sports club, company, charity, etc."
            />
          </Grid>
        </Grid>
      </Box>
    </LocalizationProvider>
  );
};

export default PersonalInfoForm;
