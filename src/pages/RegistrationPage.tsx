import React, { useState, useEffect, useRef } from 'react';
import { getAuth, onAuthStateChanged, sendSignInLinkToEmail, isSignInWithEmailLink, signInWithEmailLink } from 'firebase/auth';
import { ERROR_MESSAGES } from '../constants/messages';
import { useNavigate } from 'react-router-dom';
import { createRegistration } from '../services/registrationService';
import { testFirestoreConnection } from '../services/testFirestore';
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

// Top-level initialFormData for validation utility
export const initialFormData = {
  firstName: '',
  lastName: '',
  dateOfBirth: null as Date | null,
  nationality: 'NOR', // Default to Norway
  email: '',
  phoneCountryCode: '+47', // Default to Norway country code
  phoneNumber: '',
  representing: '',
  raceDistance: '',
  travelRequired: '',
  termsAccepted: false,
  comments: ''
};

// Refactored: validateForm now takes formData and touchedFields as arguments for testability
/**
 * @param {object} formData
 * @param {object} touchedFields
 * @param {boolean} [showAllErrors=false]
 * @param {boolean} [silentValidation=false]
 * @param {function} [setErrors]
 */
export const validateForm = (
  formData: any,
  touchedFields: any,
  showAllErrors: boolean = false,
  silentValidation: boolean = false,
  setErrors?: (errors: Record<string, string>) => void
) => {
  const newErrors: Record<string, string> = {};

  // Personal info validation
  if ((touchedFields.firstName || showAllErrors) && formData.firstName.trim() === '') {
    newErrors.firstName = ERROR_MESSAGES.firstName;
  }

  if ((touchedFields.lastName || showAllErrors) && formData.lastName.trim() === '') {
    newErrors.lastName = ERROR_MESSAGES.lastName;
  }

  if ((touchedFields.dateOfBirth || showAllErrors) && formData.dateOfBirth === null) {
    newErrors.dateOfBirth = ERROR_MESSAGES.dateOfBirth;
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
    newErrors.raceDistance = ERROR_MESSAGES.raceDistance;
  }

  if ((touchedFields.travelRequired || showAllErrors) && formData.travelRequired.trim() === '') {
    newErrors.travelRequired = ERROR_MESSAGES.travelRequired;
  }

  // Terms and conditions validation
  if ((touchedFields.termsAccepted || showAllErrors) && !formData.termsAccepted) {
    newErrors.termsAccepted = ERROR_MESSAGES.termsAccepted;
  }

  // Only update the errors state if not in silent validation mode and setErrors is provided
  if (!silentValidation && setErrors) {
    setErrors(newErrors);
  }

  return newErrors;
};

const RegistrationPage: React.FC = () => {
  // Firebase Auth state
  const [user, setUser] = useState<any>(null);
  const [emailForVerification, setEmailForVerification] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [verificationStatus, setVerificationStatus] = useState('');

  useEffect(() => {
    const auth = getAuth();
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      if (u && u.email) {
        setFormData((prev: any) => ({ ...prev, email: u.email }));
        setVerificationStatus('verified');
      }
    });
    return unsub;
  }, []);

  // Handle sign-in link in URL for email link authentication
  useEffect(() => {
    const auth = getAuth();
    if (isSignInWithEmailLink(auth, window.location.href)) {
      let email = window.localStorage.getItem('emailForSignIn') || '';
      if (!email) {
        email = window.prompt('Please provide your email for confirmation') || '';
      }
      signInWithEmailLink(auth, email, window.location.href)
        .then((result) => {
          setVerificationStatus('verified');
          setUser(result.user);
          setFormData((prev: any) => ({ ...prev, email: result.user.email }));
          window.localStorage.removeItem('emailForSignIn');
        })
        .catch((error) => {
          setVerificationStatus('error');
        });
    }
  }, []);

  const handleSendVerificationLink = async () => {
    setVerifying(true);
    setVerificationStatus('sending');
    try {
      const auth = getAuth();
      const actionCodeSettings = {
        url: window.location.origin + '/register',
        handleCodeInApp: true,
      };
      await sendSignInLinkToEmail(auth, emailForVerification, actionCodeSettings);
      window.localStorage.setItem('emailForSignIn', emailForVerification);
      setVerificationStatus('sent');
    } catch (error: any) {
      setVerificationStatus('error');
    } finally {
      setVerifying(false);
    }
  };

  const navigate = useNavigate();
  const [activeStep, setActiveStep] = useState(0);
  const [formData, setFormData] = useState(initialFormData);

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

  // Check if final review step is valid
  const isFinalStepValid = () => {
    const currentErrors = validateForm(formData, touchedFields, true, true, undefined);
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
    const currentErrors = validateForm(formData, touchedFields, true, true, undefined);
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
    validateForm(formData, touchedFields, false, false, setErrors);
  };

  // Check if there are any errors in the personal info step
  const hasPersonalInfoErrors = () => {
    const errors = validateForm(formData, touchedFields, true, true, undefined);
    const personalInfoFields = ['firstName', 'lastName', 'dateOfBirth', 'nationality', 'email', 'phoneCountryCode', 'phoneNumber'];
    return personalInfoFields.some(field => field in errors);
  };
  
  // Check if there are any errors in the race details step
  const hasRaceDetailsErrors = () => {
    const errors = validateForm(formData, touchedFields, true, true, undefined);
    const raceDetailsFields = ['raceDistance', 'travelRequired'];
    return raceDetailsFields.some(field => field in errors);
  };
  
  // Check if the form is valid for final submission (including terms)
  const isFormValidForSubmission = () => {
    const errors = validateForm(formData, touchedFields, true, true, undefined); // Silent validation
    // Block submission if not authenticated
    if (!user || !user.email) return false;
    return Object.keys(errors).length === 0;
  };


  const handleNext = () => {
    // For final step (from Race Details to Review), check all fields except terms
    if (activeStep === steps.length - 2) {
      // Set validation state to true for validation
      setValidationAttempted(true);
      
      // Validate all fields except terms and conditions
      const currentErrors = validateForm(formData, touchedFields, true, true, undefined); // Silent validation
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
    setFormData(prev => {
      const updated = { ...prev, [field]: value };
      // Validate using the updated form data
      validateForm(updated, { ...touchedFields, [field]: true }, false, false, setErrors);
      return updated;
    });
    // Mark the field as touched
    setTouchedFields(prev => ({ ...prev, [field]: true }));
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

  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    // Validate the entire form including terms and conditions
    setValidationAttempted(true);
    const currentErrors = validateForm(formData, touchedFields, true, undefined, undefined);
    
    // Only submit if the form is completely valid
    if (isFormValidForSubmission()) {
      // First test the Firestore connection
      const isConnected = await testFirestoreConnection();
      if (!isConnected) {
        setSnackbarMessage('Error connecting to the database. Please check your internet connection and try again.');
        setSnackbarOpen(true);
        return;
      }
      try {
        setIsSubmitting(true);
        
        // Prepare registration data
        const registrationData = {
          firstName: formData.firstName,
          lastName: formData.lastName,
          dateOfBirth: formData.dateOfBirth,
          nationality: formData.nationality,
          email: formData.email,
          phoneCountryCode: formData.phoneCountryCode,
          phoneNumber: formData.phoneNumber,
          representing: formData.representing,
          raceDistance: formData.raceDistance,
          travelRequired: formData.travelRequired,
          termsAccepted: formData.termsAccepted,
          comments: formData.comments
        };
        
        // Submit to Firestore
        const registrationId = await createRegistration(registrationData);
        console.log('Registration submitted successfully with ID:', registrationId);
        
        // Show success message
        setSnackbarMessage('Registration submitted successfully!');
        setSnackbarOpen(true);
        
        // Clear form data from localStorage
        localStorage.removeItem('registrationFormData');
        
        // Navigate to success page or home page after a short delay
        setTimeout(() => {
          navigate('/', { state: { registrationSuccess: true, registrationId } });
        }, 2000);
      } catch (error) {
        console.error('Error submitting registration:', error);
        // Show more detailed error message for debugging
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        setSnackbarMessage(`Error submitting registration: ${errorMessage}`);
        setSnackbarOpen(true);
      } finally {
        setIsSubmitting(false);
      }
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
                    disabled={!formData.termsAccepted || isSubmitting}
                  >
                    {isSubmitting ? 'Submitting...' : 'Submit Registration'}
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
