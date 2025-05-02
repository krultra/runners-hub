import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, Link as RouterLink } from 'react-router-dom';
import { getAuth, onAuthStateChanged, isSignInWithEmailLink, signInWithEmailLink } from 'firebase/auth';
import { ERROR_MESSAGES } from '../constants/messages';
import { createRegistration, getRegistrationsByEdition, getRegistrationsByUserId } from '../services/registrationService';
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
import { RACE_DETAILS, CURRENT_EDITION_ID } from '../constants';

import PersonalInfoForm from '../components/registration/PersonalInfoForm';
import RaceDetailsForm from '../components/registration/RaceDetailsForm';
import ReviewRegistration from '../components/registration/ReviewRegistration';
import RegistrationStepper from '../components/registration/RegistrationStepper';
import RegistrationSnackbar from '../components/registration/RegistrationSnackbar';
import { initialFormData, validateForm } from '../utils/validation';

const steps = ['Personal Information', 'Race Details', 'Review & Submit'];

const RegistrationPage: React.FC = () => {
  const navigate = useNavigate();
  // Firebase Auth state
  const [user, setUser] = useState<any>(null);
  const [authChecked, setAuthChecked] = useState(false);

  // Prefill/edit registration state
  const [isEditingExisting, setIsEditingExisting] = useState(false);
  const [existingRegistrationId, setExistingRegistrationId] = useState<string | null>(null);

  useEffect(() => {
    const fetchAndPrefill = async () => {
      if (authChecked && user && user.uid) {
        try {
          // Dynamically import to avoid SSR issues
          const { getRegistrationsByUserId } = await import('../services/registrationService');
          const registrations = await getRegistrationsByUserId(user.uid);
          if (registrations && registrations.length > 0) {
            // Use the first registration (should only be one per user)
            const reg = registrations[0];
            setFormData({
              ...initialFormData,
              ...reg,
              email: user.email || reg.email || '',
              dateOfBirth: reg.dateOfBirth ? new Date(reg.dateOfBirth) : null,
              waitinglistExpires: reg.waitinglistExpires
                ? (reg.waitinglistExpires instanceof Date
                  ? reg.waitinglistExpires
                  : typeof (reg.waitinglistExpires as any).toDate === 'function'
                    ? (reg.waitinglistExpires as any).toDate()
                    : new Date(reg.waitinglistExpires))
                : null,
              termsAccepted: false // Always require explicit acceptance
            });
            setIsEditingExisting(true);
            setExistingRegistrationId(reg.id ?? null);
          } else {
            setIsEditingExisting(false);
            setExistingRegistrationId(null);
            setFormData({ ...initialFormData, email: user.email || '' });
          }
        } catch (err: any) {
          if (err && err.code === 'unavailable') {
            setSnackbarMessage('Could not connect to the database. Please check your internet connection.');
            setSnackbarSeverity('error');
            setSnackbarOpen(true);
          } else {
            console.error('Error fetching existing registration:', err);
          }
        }
      }
    };
    fetchAndPrefill();
  }, [authChecked, user]);

  useEffect(() => {
    const auth = getAuth();
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setAuthChecked(true);
      if (u && u.email) {
        setFormData((prev: any) => ({ ...prev, email: u.email }));
      }
    });
    return unsub;
  }, []);

  useEffect(() => {
    if (authChecked && !user) {
      navigate('/auth?returnTo=/register', { replace: true });
    }
  }, [authChecked, user, navigate]);

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
    termsAccepted: useRef<HTMLDivElement>(null),
    isOnWaitinglist: useRef<HTMLDivElement>(null),
    waitinglistExpires: useRef<HTMLDivElement>(null)
  };
  
  // Snackbar state
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [snackbarSeverity, setSnackbarSeverity] = useState<'success' | 'error' | 'info' | 'warning'>('error');

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

  const [isFull, setIsFull] = useState(false); // event full -> waiting list

  // Check if event is full
  useEffect(() => {
    const loadCount = async () => {
      try {
        const regs = await getRegistrationsByEdition(CURRENT_EDITION_ID);
        const openRegs = regs.filter(r => !r.isOnWaitinglist && (r.status === 'pending' || r.status === 'confirmed'));
        const waitingRegs = regs.filter(r => r.isOnWaitinglist && (r.status === 'pending' || r.status === 'confirmed'));
        setIsFull(openRegs.length >= RACE_DETAILS.maxParticipants || waitingRegs.length > 0);
      } catch (err) {
        console.error('Error checking registration count:', err);
      }
    };
    loadCount();
  }, []);

  // Default waiting-list expiration to event date
  useEffect(() => {
    if (isFull && (formData.waitinglistExpires === null || formData.waitinglistExpires === undefined)) {
      setFormData(prev => ({ ...prev, waitinglistExpires: RACE_DETAILS.date }));
    }
  }, [isFull, formData.waitinglistExpires]);

  const handleNext = () => {
    // For final step (from Race Details to Review), check all fields except terms
    if (activeStep === steps.length - 2) {
      setValidationAttempted(true);
      // Validate all fields except terms and conditions
      const currentErrors = validateForm(formData, touchedFields, true, true, undefined); // Silent validation
      const errorsWithoutTerms = { ...currentErrors };
      delete errorsWithoutTerms.termsAccepted;
      // Only advance if no errors
      if (Object.keys(errorsWithoutTerms).length === 0) {
        setActiveStep((prevActiveStep) => prevActiveStep + 1);
        window.scrollTo(0, 0);
        setTimeout(() => showCurrentStepErrors(), 100);
      } else {
        setErrors(errorsWithoutTerms);
        setSnackbarMessage('Please complete all required fields before submitting');
        setSnackbarOpen(true);
        // Do NOT advance step if there are errors
        // Optionally scroll to first error
        if (hasPersonalInfoErrors()) {
          setActiveStep(0); // Go to personal info step
          setTimeout(() => {
            const personalInfoFields = ['firstName', 'lastName', 'dateOfBirth', 'nationality', 'email', 'phoneCountryCode', 'phoneNumber'];
            const personalInfoErrors: Record<string, string> = {};
            personalInfoFields.forEach(field => {
              if (field in errorsWithoutTerms) {
                personalInfoErrors[field] = errorsWithoutTerms[field];
              }
            });
            setErrors(personalInfoErrors);
            scrollToFirstError(personalInfoErrors);
          }, 100);
        } else {
          scrollToFirstError(errorsWithoutTerms);
        }
      }
    } else {
      // For other steps, validate only relevant fields
      // Only advance if current step is valid
      let stepValid = true;
      if (activeStep === 0 && hasPersonalInfoErrors()) stepValid = false;
      if (activeStep === 1 && hasRaceDetailsErrors()) stepValid = false;
      if (stepValid) {
        setActiveStep((prevActiveStep) => prevActiveStep + 1);
        window.scrollTo(0, 0);
        clearAllErrors();
      } else {
        setValidationAttempted(true);
        showCurrentStepErrors();
        setSnackbarMessage('Please complete all required fields before proceeding');
        setSnackbarOpen(true);
      }
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
    
    // Require waiting-list agreement if event full
    if (isFull) {
      if (!formData.isOnWaitinglist) {
        setErrors(prev => ({ ...prev, isOnWaitinglist: 'You must agree to join the waiting-list' }));
        setSnackbarMessage('Please agree to join the waiting-list before submitting');
        setSnackbarSeverity('error');
        setSnackbarOpen(true);
        fieldRefs.isOnWaitinglist.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return;
      }
      if (!formData.waitinglistExpires) {
        setErrors(prev => ({ ...prev, waitinglistExpires: 'Select expiration date' }));
        setSnackbarMessage('Please select a waiting-list expiration date');
        setSnackbarSeverity('error');
        setSnackbarOpen(true);
        fieldRefs.waitinglistExpires.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return;
      }
    }
    
    // Only submit if the form is completely valid
    if (isFormValidForSubmission()) {
      // First test the Firestore connection
      const isConnected = await testFirestoreConnection();
      if (!isConnected) {
        setSnackbarMessage('Error connecting to the database. Please check your internet connection and try again.');
        setSnackbarSeverity('error');
        setSnackbarOpen(true);
        return;
      }
      try {
        setIsSubmitting(true);
        // Prepare registration data with trimmed text fields
        const registrationData = {
          firstName: formData.firstName?.trim() || '',
          lastName: formData.lastName?.trim() || '',
          dateOfBirth: formData.dateOfBirth,
          nationality: formData.nationality,
          email: formData.email?.trim() || '',
          phoneCountryCode: formData.phoneCountryCode,
          phoneNumber: formData.phoneNumber?.trim() || '',
          representing: formData.representing?.trim() || '',
          raceDistance: formData.raceDistance,
          travelRequired: formData.travelRequired?.trim() || '',
          termsAccepted: formData.termsAccepted,
          comments: formData.comments?.trim() || '',
          // Include marketing preferences
          notifyFutureEvents: formData.notifyFutureEvents ?? false,
          sendRunningOffers: formData.sendRunningOffers ?? false,
          // Include edition ID
          editionId: formData.editionId || CURRENT_EDITION_ID,
          // Waiting list info
          isOnWaitinglist: formData.isOnWaitinglist,
          waitinglistExpires: formData.waitinglistExpires,
          paymentRequired: formData.paymentRequired ?? 300,
          paymentMade: formData.paymentMade ?? 0
        };
        let registrationId = existingRegistrationId;
        if (isEditingExisting && existingRegistrationId) {
          // Update
          const { updateRegistration } = await import('../services/registrationService');
          await updateRegistration(existingRegistrationId, registrationData);
          setSnackbarMessage('Registration updated successfully!');
          setSnackbarSeverity('success');
        } else {
          // Create
          const { createRegistration, getRegistrationsByUserId } = await import('../services/registrationService');
          // Check for existing registration for this user
          const existingRegs = await getRegistrationsByUserId(user?.uid);
          if (existingRegs && existingRegs.length > 0) {
            setSnackbarMessage('You have already submitted a registration. Duplicate entries are not allowed.');
            setSnackbarSeverity('warning');
            setSnackbarOpen(true);
            setIsSubmitting(false);
            return;
          }
          registrationId = await createRegistration(registrationData, user?.uid);
          if (registrationData.isOnWaitinglist) {
            setSnackbarMessage('Successful waiting-list registration!');
          } else {
            setSnackbarMessage('Registration submitted successfully!');
          }
          setSnackbarSeverity('success');
        }
        setSnackbarOpen(true);
        localStorage.removeItem('registrationFormData');
        setTimeout(() => {
          navigate('/', { state: { registrationSuccess: true, registrationId } });
        }, 2000);
      } catch (error) {
        console.error('Error submitting registration:', error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        setSnackbarMessage(`Error submitting registration: ${errorMessage}`);
        setSnackbarSeverity('error');
        setSnackbarOpen(true);
        setIsSubmitting(false);
        return;
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

  // Restore getStepContent so it is in scope for rendering
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
            isEmailReadOnly={true}
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
            isEditingExisting={isEditingExisting}
            isFull={isFull}
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
      <RegistrationSnackbar open={snackbarOpen} message={snackbarMessage} severity={snackbarSeverity} onClose={handleSnackbarClose} />
      <Paper 
  elevation={0}
  sx={{
    backgroundColor: 'var(--color-surface)',
    color: 'var(--color-text)',
    border: '1px solid var(--color-surface-border)',
    boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
    borderRadius: 2,
    p: 3,
    mb: 4
  }}
>
            {/* Registration Stepper */}
            <RegistrationStepper 
              steps={steps}
              activeStep={activeStep}
              onStepClick={setActiveStep}
            />
            <Typography variant="h4" component="h1" align="center" gutterBottom>
              {isFull ? 'KUTC 2025 - Sign up for the Waiting-list' : 'Register for KUTC 2025'}
            </Typography>
            {isEditingExisting && (
              <React.Fragment>
                <Alert severity="info" sx={{ mb: 2 }}>
                  You have already registered. You may update your registration below.
                </Alert>
                <Box sx={{ mb: 2 }}>
                  <Alert severity={
                    formData.paymentMade >= formData.paymentRequired ? 'success' :
                    formData.paymentMade < formData.paymentRequired ? 'warning' :
                    'info'
                  }>
                    Status: {formData.paymentMade >= formData.paymentRequired ? 'Payment Made' :
                      formData.paymentMade < formData.paymentRequired ? 'Payment Required' :
                      'Pending'}
                  </Alert>
                </Box>
              </React.Fragment>
            )}
            {getStepContent(activeStep)}
            <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 3 }}>
              {activeStep !== 0 && (
                <Button onClick={handleBack} sx={{ mr: 2 }}>
                  Back
                </Button>
              )}
              <Button
                variant="contained"
                color="primary"
                onClick={activeStep === steps.length - 1 ? handleSubmit : handleNext}
                disabled={
                  isSubmitting ||
                  (activeStep === steps.length - 1 && (
                    !isFormValidForSubmission() ||
                    (isFull && (!formData.isOnWaitinglist || !formData.waitinglistExpires))
                  ))
                }
              >
                {activeStep === steps.length - 1 ? 'Submit' : 'Next'}
              </Button>
            </Box>
          </Paper>
          <Grid container justifyContent="center" sx={{ mb: 4 }}>
            <Grid>
               <Button
                 component={RouterLink}
                 to="/"
                 variant="text"
                 color="inherit"
                 sx={{ fontWeight: 400, px: 1, py: 0.5, minWidth: 0, fontSize: '1rem', textTransform: 'none', textDecoration: 'underline', textUnderlineOffset: 4 }}
               >
                 Return to Home
               </Button>
            </Grid>
          </Grid>
    </Container>
  );
};

export default RegistrationPage;
