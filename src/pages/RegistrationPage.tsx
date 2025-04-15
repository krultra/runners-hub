import React, { useState, useEffect } from 'react';
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
  Link
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

  // Check if registration is still open
  const now = new Date();
  const isRegistrationOpen = now < RACE_DETAILS.registrationDeadline;

  // Validate form data based on current step
  const validateCurrentStep = () => {
    if (activeStep === 0) {
      // Validate personal info
      return (
        formData.firstName.trim() !== '' &&
        formData.lastName.trim() !== '' &&
        formData.dateOfBirth !== null &&
        formData.nationality.trim() !== '' &&
        formData.email.trim() !== '' &&
        formData.phoneCountryCode.trim() !== '' &&
        formData.phoneNumber.trim() !== ''
      );
    } else if (activeStep === 1) {
      // Validate race details
      return (
        formData.raceDistance.trim() !== '' &&
        formData.travelRequired.trim() !== ''
      );
    }
    return true;
  };

  const [validationError, setValidationError] = useState(false);

  const handleNext = () => {
    // Validate current step before proceeding
    if (validateCurrentStep()) {
      setValidationError(false);
      setActiveStep((prevActiveStep) => prevActiveStep + 1);
      // Scroll to top when moving to next step
      window.scrollTo(0, 0);
    } else {
      setValidationError(true);
    }
  };

  const handleBack = () => {
    setValidationError(false);
    setActiveStep((prevActiveStep) => prevActiveStep - 1);
    // Scroll to top when moving to previous step
    window.scrollTo(0, 0);
  };

  const handleFormChange = (field: string, value: any) => {
    setFormData({
      ...formData,
      [field]: value
    });
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

  const handleSubmit = async () => {
    // Here we would submit the registration to Firebase
    // For now, we'll just navigate back to the home page
    
    // Mock submission
    console.log('Submitting registration:', formData);
    
    // Navigate to success page or home page
    navigate('/');
  };

  const getStepContent = (step: number) => {
    switch (step) {
      case 0:
        return (
          <PersonalInfoForm 
            formData={formData} 
            onChange={handleFormChange} 
          />
        );
      case 1:
        return (
          <RaceDetailsForm 
            formData={formData} 
            onChange={handleFormChange} 
          />
        );
      case 2:
        return (
          <ReviewRegistration 
            formData={formData} 
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
      <Paper elevation={3} sx={{ p: 4, my: 4 }}>
        <Typography variant="h4" component="h1" align="center" gutterBottom>
          Register for KUTC 2025
        </Typography>
        
        {validationError && (
          <Box sx={{ mt: 2, mb: 2, p: 2, bgcolor: '#ffebee', borderRadius: 1 }}>
            <Typography color="error" align="center" variant="body1">
              Please fill in all required fields before proceeding.
            </Typography>
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
