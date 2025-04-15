import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Container,
  Typography,
  Box,
  Paper,
  Stepper,
  Step,
  StepLabel,
  Button,
  Grid,
  Link,
  Snackbar,
  Alert,
  List,
  ListItem,
  ListItemText
} from '@mui/material';
import { RACE_DETAILS } from '../constants';

// We'll create these components next
import PersonalInfoForm from '../components/registration/PersonalInfoForm';
import RaceDetailsForm from '../components/registration/RaceDetailsForm';
import ReviewRegistration from '../components/registration/ReviewRegistration';

const steps = ['Personal Information', 'Race Details', 'Review & Submit'];

const RegistrationPage: React.FC = () => {
  const navigate = useNavigate();
  const [activeStep, setActiveStep] = useState(0);
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    dateOfBirth: null as Date | null,
    nationality: 'NOR', // Default to Norway
    email: '',
    phoneCountryCode: '+47', // Default to Norway country code
    phoneNumber: '', // Phone number without country code
    representing: '',
    raceDistance: '',
    travelRequired: '',
    termsAccepted: false,
    comments: ''
  });

  // Track which fields have been touched by the user
  const [touchedFields, setTouchedFields] = useState<Record<string, boolean>>({
    firstName: false,
    lastName: false,
    dateOfBirth: false,
    nationality: false,
    email: false,
    phoneCountryCode: false,
    phoneNumber: false,
    raceDistance: false,
    travelRequired: false,
    termsAccepted: false
  });
  
  // Track validation errors
  const [errors, setErrors] = useState<Record<string, string>>({});
  
  // Refs for scrolling to invalid fields
  const fieldRefs = {
    firstName: useRef<HTMLDivElement>(null),
    lastName: useRef<HTMLDivElement>(null),
    dateOfBirth: useRef<HTMLDivElement>(null),
    nationality: useRef<HTMLDivElement>(null),
    email: useRef<HTMLDivElement>(null),
    phoneCountryCode: useRef<HTMLDivElement>(null),
    phoneNumber: useRef<HTMLDivElement>(null),
    raceDistance: useRef<HTMLDivElement>(null),
    travelRequired: useRef<HTMLDivElement>(null),
    termsAccepted: useRef<HTMLDivElement>(null)
  };
  
  // Snackbar state
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');

  // Check if registration is still open
  const now = new Date();
  const isRegistrationOpen = now < RACE_DETAILS.registrationDeadline;

  // Validate form data and return errors
  const validateForm = (showAllErrors = false, silentValidation = false) => {
    const newErrors: Record<string, string> = {};
    
    // Personal info validation
    if ((touchedFields.firstName || showAllErrors) && formData.firstName.trim() === '') {
      newErrors.firstName = 'First name is required';
    }
    
    if ((touchedFields.lastName || showAllErrors) && formData.lastName.trim() === '') {
      newErrors.lastName = 'Last name is required';
    }
    
    if ((touchedFields.dateOfBirth || showAllErrors) && formData.dateOfBirth === null) {
      newErrors.dateOfBirth = 'Date of birth is required';
    }
    
    if ((touchedFields.nationality || showAllErrors) && formData.nationality.trim() === '') {
      newErrors.nationality = 'Nationality is required';
    }
    
    if ((touchedFields.email || showAllErrors) && formData.email.trim() === '') {
      newErrors.email = 'Email is required';
    } else if ((touchedFields.email || showAllErrors) && formData.email.trim() !== '' && !/^\S+@\S+\.\S+$/.test(formData.email)) {
      newErrors.email = 'Please enter a valid email address';
    }
    
    if ((touchedFields.phoneCountryCode || showAllErrors) && formData.phoneCountryCode.trim() === '') {
      newErrors.phoneCountryCode = 'Country code is required';
    }
    
    if ((touchedFields.phoneNumber || showAllErrors) && formData.phoneNumber.trim() === '') {
      newErrors.phoneNumber = 'Phone number is required';
    }
    
    // Race details validation
    if ((touchedFields.raceDistance || showAllErrors) && formData.raceDistance.trim() === '') {
      newErrors.raceDistance = 'Please select a race distance';
    }
    
    if ((touchedFields.travelRequired || showAllErrors) && formData.travelRequired.trim() === '') {
      newErrors.travelRequired = 'Please select if you need travel assistance';
    }
    
    // Terms and conditions validation
    if ((touchedFields.termsAccepted || showAllErrors) && !formData.termsAccepted) {
      newErrors.termsAccepted = 'You must accept the terms and conditions';
    }
    
    // Only update the errors state if not in silent validation mode
    if (!silentValidation) {
      setErrors(newErrors);
    }
    
    return newErrors;
  };
  
  // Check if final review step is valid
  const isFinalStepValid = () => {
    const currentErrors = validateForm(true);
    // Check all fields for the final step
    return Object.keys(currentErrors).length === 0;
  };
  
  // Clear all validation errors
  const clearAllErrors = () => {
    setErrors({});
  };
  
  // Show only errors for the current step
  const showCurrentStepErrors = () => {
    // Run full validation to get all errors
    const currentErrors = validateForm(true, true); // Get all errors silently
    const newErrors: Record<string, string> = {};
    
    // Define fields for each step
    const personalInfoFields = ['firstName', 'lastName', 'dateOfBirth', 'nationality', 'email', 'phoneCountryCode', 'phoneNumber'];
    const raceDetailsFields = ['raceDistance', 'travelRequired'];
    const reviewFields = ['termsAccepted'];
    
    let relevantFields: string[] = [];
    
    if (activeStep === 0) {
      relevantFields = personalInfoFields;
    } else if (activeStep === 1) {
      relevantFields = raceDetailsFields;
    } else if (activeStep === 2) {
      relevantFields = reviewFields;
    }
    
    // Only keep errors for the current step
    relevantFields.forEach(field => {
      if (field in currentErrors) {
        newErrors[field] = currentErrors[field];
      }
    });
    
    // Update the errors state
    setErrors(newErrors);
    
    // Mark all fields in the current step as touched
    const newTouchedFields = { ...touchedFields };
    relevantFields.forEach(field => {
      newTouchedFields[field] = true;
    });
    setTouchedFields(newTouchedFields);
  };

  // Track if validation has been attempted
  const [validationAttempted, setValidationAttempted] = useState(false);
  
  // Handle field touch
  const handleFieldTouch = (field: string) => {
    setTouchedFields(prev => ({
      ...prev,
      [field]: true
    }));
    
    // Validate the field when it's touched
    validateForm();
  };

  // Check if there are any errors in the personal info step
  const hasPersonalInfoErrors = () => {
    const errors = validateForm(true, true); // Silent validation
    const personalInfoFields = ['firstName', 'lastName', 'dateOfBirth', 'nationality', 'email', 'phoneCountryCode', 'phoneNumber'];
    return personalInfoFields.some(field => field in errors);
  };
  
  // Check if there are any errors in the race details step
  const hasRaceDetailsErrors = () => {
    const errors = validateForm(true, true); // Silent validation
    const raceDetailsFields = ['raceDistance', 'travelRequired'];
    return raceDetailsFields.some(field => field in errors);
  };
  
  // Check if the form is valid for final submission (including terms)
  const isFormValidForSubmission = () => {
    const errors = validateForm(true, true); // Silent validation
    return Object.keys(errors).length === 0;
  };

  const handleNext = () => {
    // For final step (from Race Details to Review), check all fields except terms
    if (activeStep === steps.length - 2) {
      // Set validation state to true for validation
      setValidationAttempted(true);
      
      // Validate all fields except terms and conditions
      const currentErrors = validateForm(true, true); // Silent validation
      const errorsWithoutTerms = { ...currentErrors };
      delete errorsWithoutTerms.termsAccepted;
      
      // Check if there are any errors in the form (excluding terms)
      if (Object.keys(errorsWithoutTerms).length === 0) {
        setActiveStep((prevActiveStep) => prevActiveStep + 1);
        window.scrollTo(0, 0);
        // Show validation errors for the current step
        setTimeout(() => showCurrentStepErrors(), 100);
      } else {
        // Update the visible errors
        setErrors(errorsWithoutTerms);
        
        // Show snackbar with error message
        setSnackbarMessage('Please complete all required fields before submitting');
        setSnackbarOpen(true);
        
        // If there are errors in the personal info step, go back to that step
        if (hasPersonalInfoErrors()) {
          setActiveStep(0); // Go to personal info step
          setTimeout(() => {
            // Get personal info errors
            const personalInfoFields = ['firstName', 'lastName', 'dateOfBirth', 'nationality', 'email', 'phoneCountryCode', 'phoneNumber'];
            const personalInfoErrors: Record<string, string> = {};
            
            // Only keep errors for personal info fields
            personalInfoFields.forEach(field => {
              if (field in errorsWithoutTerms) {
                personalInfoErrors[field] = errorsWithoutTerms[field];
              }
            });
            
            // Update the errors state with only personal info errors
            setErrors(personalInfoErrors);
            
            // Scroll to the first error
            scrollToFirstError(personalInfoErrors);
          }, 100);
        } else {
          // Otherwise, find the first error field in the current step and scroll to it
          scrollToFirstError(errorsWithoutTerms);
        }
      }
    } else {
      // For navigation from Personal Info to Race Details
      // Don't mark validation as attempted yet
      
      // Move to next step
      setActiveStep((prevActiveStep) => prevActiveStep + 1);
      window.scrollTo(0, 0);
      
      // Clear all errors when navigating forward
      clearAllErrors();
    }
  };

  // Scroll to the first error field
  const scrollToFirstError = (currentErrors: Record<string, string>) => {
    const errorFields = Object.keys(currentErrors);
    if (errorFields.length > 0) {
      const firstErrorField = errorFields[0];
      const ref = fieldRefs[firstErrorField as keyof typeof fieldRefs];
      
      if (ref && ref.current) {
        ref.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  };

  const handleBack = () => {
    setActiveStep((prevActiveStep) => prevActiveStep - 1);
    // Scroll to top when moving to previous step
    window.scrollTo(0, 0);
    
    // When going back, keep validation attempted state but show errors for the previous step
    setTimeout(() => showCurrentStepErrors(), 100);
  };
  
  // Handle snackbar close
  const handleSnackbarClose = () => {
    setSnackbarOpen(false);
  };

  const handleFormChange = (field: string, value: any) => {
    setFormData({
      ...formData,
      [field]: value
    });
    
    // Mark the field as touched
    if (!touchedFields[field]) {
      handleFieldTouch(field);
    }
    
    // Validate the field when it changes
    validateForm();
  };
  
  // Store form data in localStorage when it changes
  useEffect(() => {
    localStorage.setItem('registrationFormData', JSON.stringify(formData));
  }, [formData]);
  
  // Load form data from localStorage on component mount
  useEffect(() => {
    const savedFormData = localStorage.getItem('registrationFormData');
    if (savedFormData) {
      try {
        const parsedData = JSON.parse(savedFormData);
        // Convert date string back to Date object if it exists
        if (parsedData.dateOfBirth) {
          parsedData.dateOfBirth = new Date(parsedData.dateOfBirth);
        }
        setFormData(parsedData);
      } catch (error) {
        console.error('Error parsing saved form data:', error);
      }
    }
  }, []);
  
  // Effect to show appropriate validation errors when changing steps
  useEffect(() => {
    if (validationAttempted) {
      // If validation has been attempted, show errors for the current step
      showCurrentStepErrors();
    } else {
      // Otherwise, clear all errors
      clearAllErrors();
    }
  }, [activeStep, validationAttempted]);

  const handleSubmit = async () => {
    // Validate the entire form including terms and conditions
    setValidationAttempted(true);
    const currentErrors = validateForm(true);
    
    // Only submit if the form is completely valid
    if (isFormValidForSubmission()) {
      // Here we would submit the registration to Firebase
      // For now, we'll just navigate back to the home page
      
      // Mock submission
      console.log('Submitting registration:', formData);
      
      // Clear form data from localStorage before navigating away
      localStorage.removeItem('registrationFormData');
      
      // Navigate to success page or home page
      navigate('/');
    } else {
      // Show error message
      setSnackbarMessage('Please accept the terms and conditions before submitting');
      setSnackbarOpen(true);
      
      // Scroll to terms checkbox
      if (currentErrors.termsAccepted) {
        const ref = fieldRefs.termsAccepted;
        if (ref && ref.current) {
          ref.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }
    }
  };

  const getStepContent = (step: number) => {
    switch (step) {
      case 0:
        return (
          <PersonalInfoForm 
            formData={formData} 
            onChange={handleFormChange}
            errors={errors}
            fieldRefs={fieldRefs}
            onBlur={handleFieldTouch}
          />
        );
      case 1:
        return (
          <RaceDetailsForm 
            formData={formData} 
            onChange={handleFormChange}
            errors={errors}
            fieldRefs={fieldRefs}
            onBlur={handleFieldTouch}
          />
        );
      case 2:
        return (
          <ReviewRegistration 
            formData={formData}
            onChange={handleFormChange}
            errors={errors}
            fieldRefs={fieldRefs}
            onBlur={handleFieldTouch}
          />
        );
      default:
        return 'Unknown step';
    }
  };

  if (!isRegistrationOpen) {
    return (
      <Container maxWidth="md">
        <Box sx={{ my: 8, textAlign: 'center' }}>
          <Typography variant="h4" component="h1" gutterBottom>
            Registration Closed
          </Typography>
          <Typography variant="body1" paragraph>
            We're sorry, but registration for KUTC 2025 is now closed.
          </Typography>
          <Button
            variant="contained"
            onClick={() => navigate('/')}
          >
            Return to Home
          </Button>
        </Box>
      </Container>
    );
  }

  return (
    <Container maxWidth="md">
      {/* Snackbar for validation errors */}
      <Snackbar
        open={snackbarOpen}
        autoHideDuration={10000}
        onClose={handleSnackbarClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert 
          onClose={handleSnackbarClose} 
          severity="error" 
          variant="filled"
          sx={{ width: '100%' }}
        >
          {snackbarMessage}
        </Alert>
      </Snackbar>
      
      <Paper elevation={3} sx={{ p: 4, my: 4 }}>
        <Typography variant="h4" component="h1" align="center" gutterBottom>
          Register for KUTC 2025
        </Typography>
        
        {validationAttempted && activeStep !== 2 && (
          <Box sx={{ mt: 2, mb: 2, p: 2, bgcolor: '#ffebee', borderRadius: 1 }}>
            <Typography color="error" variant="body1" gutterBottom>
              {Object.keys(errors).length > 0 
                ? 'Please complete the following required fields:'
                : 'Please complete all required fields before proceeding.'}
            </Typography>
            {Object.keys(errors).length > 0 && (
              <List dense>
                {Object.entries(errors).map(([field, message]) => (
                  <ListItem key={field} sx={{ py: 0 }}>
                    <ListItemText 
                      primary={message}
                      primaryTypographyProps={{ color: 'error' }}
                    />
                  </ListItem>
                ))}
              </List>
            )}
          </Box>
        )}
        
        <Stepper activeStep={activeStep} sx={{ pt: 3, pb: 5 }}>
          {steps.map((label) => (
            <Step key={label}>
              <StepLabel>{label}</StepLabel>
            </Step>
          ))}
        </Stepper>
        
        <React.Fragment>
          {activeStep === steps.length ? (
            <React.Fragment>
              <Typography variant="h5" gutterBottom>
                Thank you for your registration!
              </Typography>
              <Typography variant="subtitle1">
                Your registration has been submitted. You will receive a confirmation email shortly.
              </Typography>
              <Button
                variant="contained"
                onClick={() => navigate('/')}
                sx={{ mt: 3 }}
              >
                Return to Home
              </Button>
            </React.Fragment>
          ) : (
            <React.Fragment>
              {getStepContent(activeStep)}
              <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 3 }}>
                {activeStep !== 0 && (
                  <Button onClick={handleBack} sx={{ mr: 1 }}>
                    Back
                  </Button>
                )}
                {activeStep === steps.length - 1 ? (
                  <Button
                    variant="contained"
                    color="primary"
                    onClick={handleSubmit}
                    disabled={!formData.termsAccepted}
                  >
                    Submit Registration
                  </Button>
                ) : (
                  <Button
                    variant="contained"
                    color="primary"
                    onClick={handleNext}
                  >
                    Next
                  </Button>
                )}
              </Box>
            </React.Fragment>
          )}
        </React.Fragment>
      </Paper>

      <Grid container justifyContent="center" sx={{ mb: 4 }}>
        <Grid>
          <Link href="/" underline="hover">
            Return to Home
          </Link>
        </Grid>
      </Grid>
    </Container>
  );
};

export default RegistrationPage;
