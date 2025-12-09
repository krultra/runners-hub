import React, { useState, useEffect, useRef, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import { getRegistrationsByEdition } from "../services/registrationService";
import { testFirestoreConnection } from "../services/testFirestore";
import {
  Container,
  Typography,
  Box,
  Paper,
  Button,
  Alert,
  CircularProgress,
} from "@mui/material";
import { initialFormData, validateForm } from "../utils/validation";
import { useEventEdition, CurrentEvent } from "../contexts/EventEditionContext";
import PersonalInfoForm from "../components/registration/PersonalInfoForm";
import RaceDetailsForm from "../components/registration/RaceDetailsForm";
import ReviewRegistration from "../components/registration/ReviewRegistration";
import RegistrationStepper from "../components/registration/RegistrationStepper";
import RegistrationSnackbar from "../components/registration/RegistrationSnackbar";


// Inner component containing all hooks and logic, now receiving event as prop
const RegistrationPageInner: React.FC<{ event: CurrentEvent }> = ({
  event,
}) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  
  const steps = [
    t('registration.steps.personalInfo'),
    t('registration.steps.raceDetails'),
    t('registration.steps.reviewSubmit')
  ];
  // Firebase Auth state
  const [user, setUser] = useState<any>(null);
  const [authChecked, setAuthChecked] = useState(false);

  // Prefill/edit registration state
  const [isEditingExisting, setIsEditingExisting] = useState(false);
  const [existingRegistrationId, setExistingRegistrationId] = useState<
    string | null
  >(null);
  const [prefillChecked, setPrefillChecked] = useState(false);

  // Form state
  const [activeStep, setActiveStep] = useState(0);
  const [formData, setFormData] = useState({
    ...initialFormData,
    isOnWaitinglist: false,
    waitinglistExpires: null as Date | null
  });
  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const [touchedFields, setTouchedFields] = useState<{
    [key: string]: boolean;
  }>({});
  const [validationAttempted, setValidationAttempted] = useState(false);
  const [isFull, setIsFull] = useState(false);
//  const [waitingListConsent, setWaitingListConsent] = useState(false);

  // Snackbar state
  const [snackbarMessage, setSnackbarMessage] = useState("");
  const [snackbarSeverity, setSnackbarSeverity] = useState<
    "success" | "error" | "info" | "warning"
  >("info");
  const [snackbarOpen, setSnackbarOpen] = useState(false);

  // Field refs for input elements
  const fieldRefs = useRef<{
    isOnWaitinglist: HTMLInputElement | null;
    waitinglistExpires: HTMLInputElement | null;
    termsAccepted: HTMLInputElement | null;
  }>({ isOnWaitinglist: null, waitinglistExpires: null, termsAccepted: null });

  // Div refs for container elements
  const divRefs = useRef<
    Record<string, React.RefObject<HTMLDivElement | null>>
  >({});

  // Compute whether license is required for the selected race distance
  const selectedDistance = event.raceDistances?.find(d => d.id === formData.raceDistance);
  const licenseFee = selectedDistance?.fees?.oneTimeLicense ?? event.fees?.oneTimeLicense ?? 0;
  const requiresLicense = licenseFee > 0;

  // Helper to get formData with _requiresLicense flag for validation
  const getFormDataForValidation = useCallback(() => ({
    ...formData,
    _requiresLicense: requiresLicense
  }), [formData, requiresLicense]);

  // Reset validation state when switching to Race Details step
  useEffect(() => {
    if (activeStep === 1) { // Race Details step
      setTouchedFields(prev => ({
        ...prev,
        raceDistance: false,
        travelRequired: false,
        hasYearLicense: false,
        licenseNumber: false
      }));
      setErrors(prev => {
        const newErrors = {...prev};
        delete newErrors.raceDistance;
        delete newErrors.travelRequired;
        delete newErrors.hasYearLicense;
        delete newErrors.licenseNumber;
        return newErrors;
      });
    }
  }, [activeStep]);

  // Handlers
  const handleFormChange = useCallback((field: string, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setTouchedFields((prev) => ({ ...prev, [field]: true }));
  }, []);

  const handleFieldTouch = (field: string) => {
    setTouchedFields((prev) => ({ ...prev, [field]: true }));
    
    // Validate the field immediately and show errors
    if (field) {
      // Create a simple validation context with just this field
      const touchedContext = { [field]: true };
      
      // Get validation result for just this field
      const fieldErrors = validateForm(getFormDataForValidation(), touchedContext, false, false, undefined);
      
      // Get the current field value to check if it's empty
      const fieldValue = formData[field as keyof typeof formData];
      const isEmpty = fieldValue === '' || fieldValue === null || fieldValue === undefined;
      
      // Update the errors state for this field
      setErrors(prev => {
        // Keep all previous errors
        const newErrors = { ...prev };
        
        // If there's an error for this field, add it
        if (Object.keys(fieldErrors).includes(field)) {
          newErrors[field] = fieldErrors[field];
        } else {
          // Otherwise remove any previous error for this field
          delete newErrors[field];
        }
        
        return newErrors;
      });
      
      // If this is a required field and it's empty, we want to force visual validation
      if (isEmpty) {
        // This helps ensure the visual indicator shows up
        setValidationAttempted(true);
      }
    }
  };

  const clearAllErrors = useCallback(() => {
    setErrors({});
  }, []);

  const showCurrentStepErrors = useCallback(() => {
    const currentErrors = validateForm(getFormDataForValidation(), activeStep);
    setErrors(currentErrors);
    return Object.keys(currentErrors).length > 0;
  }, [getFormDataForValidation, activeStep]);

  const hasPersonalInfoErrors = useCallback(() => {
    const personalInfoFields = [
      "firstName",
      "lastName",
      "dateOfBirth",
      "nationality",
      "email",
      "phoneCountryCode",
      "phoneNumber",
      "representing",
    ];
    // Validate only personal info fields
    const personalInfoTouched: Record<string, boolean> = {};
    personalInfoFields.forEach((field) => {
      personalInfoTouched[field] = true;
    });
    const errors = validateForm(
      getFormDataForValidation(),
      personalInfoTouched,
      false,
      undefined,
      undefined,
    );
    
    // Store these errors for display when showing current step errors
    if (Object.keys(errors).length > 0 && activeStep === 0) {
      setErrors(errors);
    }
    
    return Object.keys(errors).length > 0;
  }, [formData, activeStep]);


  // Check if event is full
  useEffect(() => {
    if (!event) return;
    const loadCount = async () => {
      try {
        const regs = await getRegistrationsByEdition(event.id);
        const openRegs = regs.filter(
          (r) =>
            !r.isOnWaitinglist &&
            (r.status === "pending" || r.status === "confirmed"),
        );
        const waitingRegs = regs.filter(
          (r) =>
            r.isOnWaitinglist &&
            (r.status === "pending" || r.status === "confirmed"),
        );
        setIsFull(
          openRegs.length >= (event.maxParticipants ?? 0) ||
            waitingRegs.length > 0,
        );
      } catch (err) {
        console.error("Error checking registration count:", err);
      }
    };
    loadCount();
  }, [event, event?.id]);

  // Handle waiting list expiration date when event is full
  useEffect(() => {
    if (!event) return;
    if (isFull && !isEditingExisting) {
      setFormData((prev) => ({
        ...prev,
        isOnWaitinglist: true,
        waitinglistExpires: prev.waitinglistExpires ?? event.startTime,
      }));
    }
  }, [isFull, event, event.startTime, isEditingExisting]);

  // Fetch and prefill existing registration
  useEffect(() => {
    let isMounted = true;
    const fetchAndPrefill = async () => {
      if (!authChecked) return;
      if (isMounted) setPrefillChecked(false);

      if (user && user.uid) {
        try {
          const { getRegistrationsByUserId } = await import(
            "../services/registrationService"
          );
          const registrations = await getRegistrationsByUserId(
            user.uid,
            event.id
          );
          if (registrations && registrations.length > 0) {
            const reg = registrations[0];
            if (!isMounted) return;
            setFormData(prev => ({
              ...initialFormData,
              ...reg,
              email: user.email || reg.email || "",
              dateOfBirth: reg.dateOfBirth ? new Date(reg.dateOfBirth) : null,
              isOnWaitinglist: reg.isOnWaitinglist || false,
              waitinglistExpires: reg.waitinglistExpires
                ? reg.waitinglistExpires instanceof Date
                  ? reg.waitinglistExpires
                  : typeof (reg.waitinglistExpires as any).toDate === "function"
                    ? (reg.waitinglistExpires as any).toDate()
                    : new Date(reg.waitinglistExpires)
                : null,
              termsAccepted: reg.termsAccepted || false,
            }));
            setIsEditingExisting(true);
            setExistingRegistrationId(reg.id ?? null);
          } else {
            if (!isMounted) return;
            setIsEditingExisting(false);
            setExistingRegistrationId(null);
            setFormData(prev => ({
              ...initialFormData,
              email: user.email || "",
              isOnWaitinglist: prev.isOnWaitinglist,
              waitinglistExpires: prev.waitinglistExpires
            }));
          }
        } catch (err: any) {
          if (err && err.code === "unavailable") {
            setSnackbarMessage(
              t('registration.couldNotConnect'),
            );
            setSnackbarSeverity("error");
            setSnackbarOpen(true);
          } else {
            console.error("Error fetching existing registration:", err);
          }
        } finally {
          if (isMounted) setPrefillChecked(true);
        }
      } else {
        if (!isMounted) return;
        setIsEditingExisting(false);
        setExistingRegistrationId(null);
        setPrefillChecked(true);
      }
    };

    fetchAndPrefill();

    return () => {
      isMounted = false;
    };
  }, [
    authChecked,
    user,
    setSnackbarMessage,
    setSnackbarSeverity,
    setSnackbarOpen,
    event.id
  ]);

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
      navigate("/auth?returnTo=/register", { replace: true });
    }
  }, [authChecked, user, navigate]);

  const isLoggedIn = Boolean(user);

  const toDate = (value: any): Date | null => {
    if (!value) return null;
    if (value instanceof Date) return value;
    if (typeof value.toDate === "function") return value.toDate();
    return new Date(value);
  };

  // Check if registration is still open / event has started
  const now = new Date();
  const eventStartDate = toDate(event.startTime);
  const registrationDeadlineDate = toDate(event.registrationDeadline);
  const hasEventStarted = eventStartDate ? now >= eventStartDate : false;
  const isRegistrationOpen = registrationDeadlineDate
    ? now < registrationDeadlineDate
    : !hasEventStarted;
  const canEditExisting = isEditingExisting && !hasEventStarted;
  const isRegistrationAccessible = isRegistrationOpen || canEditExisting;

  // Check if the form is valid for final submission (including terms)
  const isFormValidForSubmission = () => {
    const errors = validateForm(getFormDataForValidation(), touchedFields, true, true, undefined); // Silent validation
    if (!formData.termsAccepted) errors.termsAccepted = "You must accept the terms and conditions";
    if (!user || !user.email) return false;
    return Object.keys(errors).length === 0;
  };

  const handleNext = () => {
    // Mark all fields for the current step as touched
    const markCurrentStepFieldsAsTouched = () => {
      let fieldsToMark: string[] = [];
      
      if (activeStep === 0) { // Personal Info
        fieldsToMark = [
          "firstName",
          "lastName",
          "dateOfBirth",
          "nationality",
          "email",
          "phoneCountryCode",
          "phoneNumber",
          "representing",
        ];
      } else if (activeStep === 1) { // Race Details
        fieldsToMark = [
          "raceDistance",
          "travelRequired",
          "hasYearLicense",
          "licenseNumber",
        ];
      }
      
      // Mark all these fields as touched
      const newTouchedFields = { ...touchedFields };
      fieldsToMark.forEach(field => newTouchedFields[field] = true);
      setTouchedFields(newTouchedFields);
      
      return newTouchedFields;
    };
    
    // Mark appropriate fields as touched immediately
    const updatedTouchedFields = markCurrentStepFieldsAsTouched();
    setValidationAttempted(true);
    
    // For final step (from Race Details to Review), check all fields except terms
    if (activeStep === steps.length - 2) {
      // Validate all fields except terms and conditions
      const currentErrors = validateForm(
        getFormDataForValidation(),
        updatedTouchedFields, // Use newly updated touched fields
        true,
        true,
        undefined,
      ); // Silent validation
      const errorsWithoutTerms = { ...currentErrors };
      delete errorsWithoutTerms.termsAccepted;
      // Only advance if no errors
      if (Object.keys(errorsWithoutTerms).length === 0) {
        setActiveStep((prevActiveStep) => prevActiveStep + 1);
        window.scrollTo(0, 0);
        setTimeout(() => showCurrentStepErrors(), 100);
      } else {
        setErrors(errorsWithoutTerms);
        setSnackbarMessage(
          t('registration.completeFieldsBeforeSubmitting'),
        );
        setSnackbarOpen(true);
        // Do NOT advance step if there are errors
        // Optionally scroll to first error
        if (hasPersonalInfoErrors()) {
          setActiveStep(0); // Go to personal info step
          setTimeout(() => {
            // The hasPersonalInfoErrors function already updates the errors state
            // Just need to scroll to the first error
            scrollToFirstError(errors);
          }, 100);
        } else {
          scrollToFirstError(errorsWithoutTerms);
        }
      }
    } else {
      // For other steps, validate only relevant fields using newly touched fields
      // Force validation against all fields for current step
      let stepValid = true;
      if (activeStep === 0) {
        // Force validation for personal info and immediately show errors
        const personalInfoErrors = validateForm(
          getFormDataForValidation(),
          updatedTouchedFields,
          false,
          false,
          undefined
        );
        setErrors(personalInfoErrors);
        stepValid = Object.keys(personalInfoErrors).length === 0;
      }
      
      if (activeStep === 1) {
        // Force validation for race details and immediately show errors
        const raceDetailsErrors = validateForm(
          getFormDataForValidation(),
          updatedTouchedFields,
          false,
          false, 
          undefined
        );
        setErrors(raceDetailsErrors);
        stepValid = Object.keys(raceDetailsErrors).length === 0;
      }

      if (stepValid) {
        setActiveStep((prevActiveStep) => prevActiveStep + 1);
        window.scrollTo(0, 0);
        clearAllErrors();
      } else {
        // Errors are already set above
        // Scroll to first error
        scrollToFirstError(errors);
        setSnackbarMessage(
          t('registration.completeFieldsBeforeProceeding'),
        );
        setSnackbarOpen(true);
      }
    }
  };

  // Scroll to the first error field
  const scrollToFirstError = (currentErrors: Record<string, string>) => {
    const errorFields = Object.keys(currentErrors);
    if (errorFields.length > 0) {
      const firstErrorField = errorFields[0];

      // Try input refs first
      const inputRef =
        fieldRefs.current[firstErrorField as keyof typeof fieldRefs.current];
      if (inputRef) {
        inputRef.scrollIntoView({ behavior: "smooth", block: "center" });
        return;
      }

      // Try div refs if input ref not found
      const divRef = divRefs.current[firstErrorField];
      if (divRef?.current) {
        divRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
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

  // Store form data in localStorage when it changes
  useEffect(() => {
    const dataToStore = { ...formData };
    localStorage.setItem("registrationFormData", JSON.stringify(dataToStore));
  }, [formData]);

  // Load form data from localStorage on component mount, ONLY if not editing existing
  useEffect(() => {
    // If we are editing an existing registration, don't load from local storage
    // as the fetchAndPrefill effect handles prefilling from the database.
    if (isEditingExisting) {
      return; // Skip loading from localStorage
    }

    const savedFormData = localStorage.getItem("registrationFormData");
    if (savedFormData) {
      try {
        const parsedData = JSON.parse(savedFormData);
        // Convert date string back to Date object if it exists
        if (parsedData.dateOfBirth) {
          parsedData.dateOfBirth = new Date(parsedData.dateOfBirth);
        }
        // Convert waitinglistExpires string back to Date object if it exists
        if (parsedData.waitinglistExpires) {
          parsedData.waitinglistExpires = new Date(
            parsedData.waitinglistExpires,
          );
        }
        setFormData(parsedData);
      } catch (error) {
        console.error("Error parsing saved form data:", error);
        // Clear potentially corrupted local storage
        localStorage.removeItem("registrationFormData");
      }
    }
  }, [isEditingExisting]); // Add isEditingExisting dependency

  // Effect to show appropriate validation errors when changing steps
  useEffect(() => {
    if (validationAttempted && activeStep === 1) {
      // Only show errors for step 2 (race details) if we're on that step
      const errors = validateForm(
        formData,
        touchedFields,
        true,
        true,
        undefined,
      );
      const raceDetailsFields = ["raceDistance", "travelRequired"];
      const stepErrors: Record<string, string> = {};
      raceDetailsFields.forEach((field) => {
        if (field in errors) {
          stepErrors[field] = errors[field];
        }
      });
      setErrors(stepErrors);
    } else if (!validationAttempted) {
      // Clear errors if validation hasn't been attempted
      clearAllErrors();
    }
  }, [activeStep, validationAttempted, formData, touchedFields, clearAllErrors]);

  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    // Validate the entire form including terms and conditions
    setValidationAttempted(true);
    const currentErrors = validateForm(
      formData,
      touchedFields,
      true,
      undefined,
      undefined,
    );

    // Require waiting-list agreement if event full AND user is not already registered
    if (isFull && !isEditingExisting) {
      if (!formData.isOnWaitinglist) {
        setErrors((prev) => ({
          ...prev,
          isOnWaitinglist: t('registration.mustAcceptWaitlist'),
        }));
        setSnackbarMessage(
          t('registration.agreeToWaitlist'),
        );
        setSnackbarSeverity("error");
        setSnackbarOpen(true);
        fieldRefs.current.isOnWaitinglist?.scrollIntoView({
          behavior: "smooth",
          block: "center",
        });
        return;
      }
      if (!formData.waitinglistExpires) {
        setErrors((prev) => ({
          ...prev,
          waitinglistExpires: t('registration.selectExpirationDate'),
        }));
        setSnackbarMessage(t('registration.selectWaitlistExpiration'));
        setSnackbarSeverity("error");
        setSnackbarOpen(true);
        fieldRefs.current.waitinglistExpires?.scrollIntoView({
          behavior: "smooth",
          block: "center",
        });
        return;
      }
    }

    // Only submit if the form is completely valid
    if (isFormValidForSubmission()) {
      // First test the Firestore connection
      const isConnected = await testFirestoreConnection();
      if (!isConnected) {
        setSnackbarMessage(
          t('registration.errorConnecting'),
        );
        setSnackbarSeverity("error");
        setSnackbarOpen(true);
        return;
      }
      try {
        setIsSubmitting(true);
        // Prepare registration data with trimmed text fields
        const registrationData = {
          firstName: formData.firstName?.trim() || "",
          lastName: formData.lastName?.trim() || "",
          dateOfBirth: formData.dateOfBirth,
          nationality: formData.nationality,
          email: formData.email?.trim() || "",
          phoneCountryCode: formData.phoneCountryCode,
          phoneNumber: formData.phoneNumber?.trim() || "",
          representing: formData.representing?.trim() || "",
          raceDistance: formData.raceDistance,
          travelRequired: formData.travelRequired?.trim() || "",
          termsAccepted: formData.termsAccepted,
          comments: formData.comments?.trim() || "",
          // Include marketing preferences
          notifyFutureEvents: formData.notifyFutureEvents ?? false,
          sendRunningOffers: formData.sendRunningOffers ?? false,
          // Include edition ID
          editionId: formData.editionId || event.id,
          // Waiting list info
          isOnWaitinglist: formData.isOnWaitinglist,
          waitinglistExpires: formData.waitinglistExpires,
          paymentRequired: formData.paymentRequired ?? 300,
          paymentMade: formData.paymentMade ?? 0,
          // License info - only include if license is required for this race
          // Use null instead of undefined for Firestore compatibility
          ...(requiresLicense ? {
            hasYearLicense: formData.hasYearLicense ?? false,
            licenseNumber: formData.licenseNumber?.trim() || "",
          } : {}),
        };
        let registrationId = existingRegistrationId;
        if (isEditingExisting && existingRegistrationId) {
          // Update
          const { updateRegistration } = await import(
            "../services/registrationService"
          );
          await updateRegistration(existingRegistrationId, registrationData);
          setSnackbarMessage(t('registration.registrationUpdated'));
          setSnackbarSeverity("success");
        } else {
          // Create
          const { createRegistration, getRegistrationsByUserId } = await import(
            "../services/registrationService"
          );
          // Check for existing registration for this user
          const existingRegs = await getRegistrationsByUserId(user.uid, event.id);
          if (existingRegs && existingRegs.length > 0) {
            setSnackbarMessage(
              t('registration.duplicateRegistration'),
            );
            setSnackbarSeverity("warning");
            setSnackbarOpen(true);
            setIsSubmitting(false);
            return;
          }
          registrationId = await createRegistration(
            registrationData,
            user?.uid,
          );
          if (registrationData.isOnWaitinglist) {
            setSnackbarMessage(t('registration.waitlistSuccess'));
          } else {
            setSnackbarMessage(t('registration.registrationSuccess'));
          }
          setSnackbarSeverity("success");
        }
        setSnackbarOpen(true);
        localStorage.removeItem("registrationFormData");
        setTimeout(() => {
          // Navigate back to the event page instead of home
          const eventPath = `/${event.id}`;
          navigate(eventPath, {
            state: { registrationSuccess: true, registrationId },
          });
        }, 2000);
      } catch (error) {
        console.error("Error submitting registration:", error);
        const errorMessage =
          error instanceof Error ? error.message : "Unknown error";
        setSnackbarMessage(`${t('registration.errorSubmitting')}: ${errorMessage}`);
        setSnackbarSeverity("error");
        setSnackbarOpen(true);
        setIsSubmitting(false);
        return;
      } finally {
        setIsSubmitting(false);
      }
    } else {
      // Show error message
      setSnackbarMessage(
        t('registration.acceptTermsBeforeSubmitting'),
      );
      setSnackbarOpen(true);
      // Scroll to terms checkbox
      if (currentErrors.termsAccepted) {
        const ref = fieldRefs.current.termsAccepted;
        if (ref) {
          ref.scrollIntoView({ behavior: "smooth", block: "center" });
        }
      }
    }
  };

  // Restore getStepContent so it is in scope for rendering
  const getStepContent = (step: number) => {
//    console.log("RegistrationPage - current event:", event);
    switch (step) {
      case 0:
        return (
          <PersonalInfoForm
            formData={formData}
            onChange={handleFormChange}
            errors={errors}
            fieldRefs={divRefs.current}
            onBlur={handleFieldTouch}
            isEditingExisting={isEditingExisting}
            isFull={isFull}
            isEmailReadOnly={true}  /* Make email field read-only since it comes from auth */
          />
        );
      case 1:
        return (
          <RaceDetailsForm
            formData={formData}
            onChange={handleFormChange}
            errors={errors}
            fieldRefs={divRefs.current}
            onBlur={handleFieldTouch}
            event={event}
            touchedFields={touchedFields}
          />
        );
      case 2:
        return (
          <ReviewRegistration
            event={event}
            formData={formData}
            onChange={handleFormChange}
            errors={errors}
            fieldRefs={divRefs.current}
            onBlur={handleFieldTouch}
          />
        );
      default:
        return "Unknown step";
    }
  };

  if (!isRegistrationAccessible) {
    if (isLoggedIn && !prefillChecked) {
      return (
        <Container maxWidth="md">
          <Box sx={{ my: 8, textAlign: "center" }}>
            <CircularProgress />
          </Box>
        </Container>
      );
    }

    const messageTitle = hasEventStarted ? t('registration.eventStarted') : t('registration.registrationClosed');
    const messageBody = hasEventStarted
      ? t('registration.eventStartedMessage')
      : t('registration.registrationClosedMessage');

    return (
      <Container maxWidth="md">
        <Box sx={{ my: 8, textAlign: "center" }}>
          <Typography variant="h4" component="h1" gutterBottom>
            {messageTitle}
          </Typography>
          <Typography variant="body1" paragraph>
            {messageBody}
          </Typography>
          <Button variant="contained" onClick={() => navigate("/")}>
            {t('registration.returnToHome')}
          </Button>
        </Box>
      </Container>
    );
  }

  return (
    <Container maxWidth="md">
      <RegistrationSnackbar
        open={snackbarOpen}
        message={snackbarMessage}
        severity={snackbarSeverity}
        onClose={handleSnackbarClose}
      />
      <Paper
        elevation={0}
        sx={{
          backgroundColor: "var(--color-surface)",
          color: "var(--color-text)",
          border: "1px solid var(--color-surface-border)",
          boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
          borderRadius: 2,
          p: 3,
          mb: 4,
        }}
      >
        {/* Registration Stepper */}
        <RegistrationStepper
          steps={steps}
          activeStep={activeStep}
          onStepClick={setActiveStep}
        />
        <Typography variant="h4" component="h1" align="center" gutterBottom>
          <span>
            {event.eventName}
            {event.edition && ` ${event.edition}`}
            {' - '}
          </span>
          {isEditingExisting
            ? formData.isOnWaitinglist 
              ? t('registration.reviewingWaitlistRegistration')
              : t('registration.reviewingRegistration')
            : isFull
              ? t('registration.waitlistRegistration')
              : t('registration.title')}
        </Typography>
        {isEditingExisting && (
          <React.Fragment>
            <Alert severity="info" sx={{ mb: 2 }}>
              {t('registration.updateInfo')}
            </Alert>
            <Box sx={{ mb: 2 }}>
              <Alert
                severity={
                  formData.paymentMade >= formData.paymentRequired
                    ? "success"
                    : formData.paymentMade < formData.paymentRequired
                      ? "warning"
                      : "info"
                }
              >
                {t('status.label')}:{" "}
                {formData.paymentMade >= formData.paymentRequired
                  ? t('registration.paymentMade')
                  : formData.paymentMade < formData.paymentRequired
                    ? t('registration.paymentRequired')
                    : t('registration.paymentPending')}
              </Alert>
            </Box>
          </React.Fragment>
        )}
        {getStepContent(activeStep)}
        <Box sx={{ display: "flex", justifyContent: "flex-end", mt: 3 }}>
          {activeStep !== 0 && (
            <Button onClick={handleBack} sx={{ mr: 2 }}>
              {t('registration.back')}
            </Button>
          )}
          <Button
            variant="contained"
            color="primary"
            onClick={
              activeStep === steps.length - 1 ? handleSubmit : handleNext
            }
            disabled={
              isSubmitting ||
              (activeStep === steps.length - 1 &&
                (!isFormValidForSubmission() ||
                  (isFull &&
                    !isEditingExisting &&
                    !formData.waitinglistExpires)))
            }
          >
            {activeStep === steps.length - 1 ? t('registration.submit') : t('registration.next')}
          </Button>
        </Box>
      </Paper>
    </Container>
  );
};

// Main RegistrationPage component
const RegistrationPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { event, loading, error } = useEventEdition();

  if (loading) {
    return (
      <Container
        maxWidth="md"
        sx={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          minHeight: "200px",
        }}
      >
        <CircularProgress />
      </Container>
    );
  }

  if (error || !event) {
    return (
      <Container maxWidth="md" sx={{ mt: 4, mb: 4 }}>
        <Alert severity="error">
          {error
            ? `${t('errors.loadFailed')}: ${error.message}`
            : t('errors.notFound')}
        </Alert>
        <Button
          variant="contained"
          onClick={() => navigate("/")}
          sx={{ mt: 2 }}
        >
          {t('errors.backToHome')}
        </Button>
      </Container>
    );
  }

  return <RegistrationPageInner event={event} />;
};

export default RegistrationPage;
