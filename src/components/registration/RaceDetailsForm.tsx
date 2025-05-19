import React, { useEffect, useRef } from 'react';
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
  FormHelperText
} from '@mui/material';
import { CurrentEvent } from '../../contexts/EventEditionContext';

interface RaceDetailsFormProps {
  formData: {
    raceDistance: string;
    travelRequired: string;
    comments: string;
    [key: string]: any;
  };
  onChange: (field: string, value: any) => void;
  errors: Record<string, string>;
  fieldRefs: Record<string, React.RefObject<HTMLDivElement | null>>;
  onBlur?: (field: string) => void;
  event: CurrentEvent;
  touchedFields?: Record<string, boolean>;
}

const RaceDetailsForm: React.FC<RaceDetailsFormProps> = ({ 
  formData, 
  onChange, 
  errors, 
  fieldRefs, 
  onBlur, 
  event,
  touchedFields = {}
}) => {
  const firstRadioRef = useRef<HTMLInputElement>(null);

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
        Race Details
      </Typography>
      <Typography variant="body2" color="text.secondary" paragraph>
        Please select your preferred race distance and provide additional details.
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
            <FormLabel component="legend">Race Distance</FormLabel>
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
                  label={distance.displayName || distance.id}
                  sx={{ '& .MuiFormControlLabel-label': { fontSize: '0.9rem' } }}
                />
              ))}
            </RadioGroup>
            <FormHelperText error={!!(errors.raceDistance && touchedFields.raceDistance)}>
              {errors.raceDistance && touchedFields.raceDistance ? errors.raceDistance : 'Select the distance you wish to participate in'}
            </FormHelperText>
          </FormControl>
        </Grid>
        
        <Grid item xs={12}>
          <TextField
            id="travelRequired"
            name="travelRequired"
            label="Travel Required"
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
                : 'Please describe your travel plans to help us minimize our carbon footprint'
            }
            inputRef={fieldRefs.travelRequired as any}
          />
        </Grid>
        
        <Grid item xs={12}>
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
            inputProps={{ maxLength: 500 }}
            helperText="Any additional information you'd like to share with the organizers"
          />
        </Grid>
        {/* Terms and conditions moved to the Review & Submit page */}
      </Grid>
    </Box>
  );
};

export default RaceDetailsForm;
