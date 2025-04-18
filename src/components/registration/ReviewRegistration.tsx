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
  Link
} from '@mui/material';
import { RACE_DISTANCES, COUNTRIES, RACE_DETAILS, PHONE_CODES } from '../../constants';
import TermsAndConditions from './TermsAndConditions';

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
  };
  errors: Record<string, string>;
  fieldRefs: Record<string, React.RefObject<HTMLDivElement | null>>;
  onChange: (field: string, value: any) => void;
  onBlur?: (field: string) => void;
}

const ReviewRegistration: React.FC<ReviewRegistrationProps> = ({ formData, errors, fieldRefs, onChange, onBlur }) => {
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

      <Alert severity="info" sx={{ mb: 3 }}>
        After submitting your registration, you will need to complete the payment process
        separately. Details will be sent to your email address.
      </Alert>

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
          After submitting your registration, you will need to pay the following fees:
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
        </List>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
          Payment instructions will be sent to your email after registration.
        </Typography>
      </Paper>

      <Box sx={{ mt: 3 }}>
        <FormControlLabel
          control={
            <Checkbox
              checked={formData.termsAccepted}
              name="termsAccepted"
              color="primary"
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => onChange('termsAccepted', e.target.checked)}
              onBlur={() => onBlur && onBlur('termsAccepted')}
            />
          }
          label={
            <Typography variant="body2">
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
              </Link> for KUTC 2025.
            </Typography>
          }
          ref={fieldRefs.termsAccepted}
        />
        <FormHelperText error={!!errors.termsAccepted}>
          {errors.termsAccepted || ''}
        </FormHelperText>
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
