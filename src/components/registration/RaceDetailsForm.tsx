import React, { useEffect } from 'react';
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
  Checkbox,
  FormHelperText,
  Link
} from '@mui/material';
import { RACE_DISTANCES } from '../../constants';

interface RaceDetailsFormProps {
  formData: {
    raceDistance: string;
    travelRequired: string;
    termsAccepted: boolean;
    comments: string;
  };
  onChange: (field: string, value: any) => void;
}

const RaceDetailsForm: React.FC<RaceDetailsFormProps> = ({ formData, onChange }) => {
  // Effect to scroll to top when component mounts
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);
  return (
    <Box sx={{ mt: 2, mb: 4 }}>
      <Typography variant="h6" gutterBottom>
        Race Details
      </Typography>
      <Typography variant="body2" color="text.secondary" paragraph>
        Please select your preferred race distance and provide additional details.
      </Typography>
      
      <Grid container spacing={3}>
        <Grid size={12}>
          <FormControl component="fieldset" required>
            <FormLabel component="legend">Race Distance</FormLabel>
            <RadioGroup
              aria-label="race-distance"
              name="raceDistance"
              value={formData.raceDistance}
              onChange={(e) => onChange('raceDistance', e.target.value)}
            >
              {RACE_DISTANCES.map((distance) => (
                <FormControlLabel
                  key={distance.id}
                  value={distance.id}
                  control={<Radio />}
                  label={distance.displayName}
                />
              ))}
            </RadioGroup>
            <FormHelperText>Select the distance you wish to participate in</FormHelperText>
          </FormControl>
        </Grid>
        
        <Grid size={12}>
          <TextField
            id="travelRequired"
            name="travelRequired"
            label="Travel Required (Optional)"
            fullWidth
            multiline
            rows={3}
            variant="outlined"
            value={formData.travelRequired}
            onChange={(e) => onChange('travelRequired', e.target.value)}
            helperText="Please describe your travel plans to help us minimize our carbon footprint"
          />
        </Grid>
        
        <Grid size={12}>
          <TextField
            id="comments"
            name="comments"
            label="Comments and Remarks (Optional)"
            fullWidth
            multiline
            rows={3}
            variant="outlined"
            value={formData.comments}
            onChange={(e) => onChange('comments', e.target.value)}
            helperText="Any additional information you'd like to share with the organizers"
          />
        </Grid>
        
        <Grid size={12}>
          <FormControlLabel
            control={
              <Checkbox
                checked={formData.termsAccepted}
                onChange={(e) => onChange('termsAccepted', e.target.checked)}
                name="termsAccepted"
                color="primary"
                required
              />
            }
            label={
              <span>
                I accept the{' '}
                <Link href="#" target="_blank" rel="noopener">
                  terms and conditions
                </Link>{' '}
                for participation in KUTC 2025 *
              </span>
            }
          />
          <FormHelperText>
            You must accept the terms and conditions to complete your registration
          </FormHelperText>
        </Grid>
      </Grid>
    </Box>
  );
};

export default RaceDetailsForm;
