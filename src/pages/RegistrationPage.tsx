import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  query,
  setDoc,
  where,
  serverTimestamp
} from "firebase/firestore";
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
import { initialFormData } from "../utils/validation";
import {
  validatePersonalInfo,
  validateRaceDetails,
  validateReviewSubmit,
  validateAll,
  markStepFieldsTouched,
  RaceValidationContext,
  LICENSE_NUMBER_REGEX,
} from "../utils/registrationValidation";
import { useEventEdition, CurrentEvent, DEFAULT_REGISTRATION_CONFIG, RegistrationConfig } from "../contexts/EventEditionContext";
import PersonalInfoForm from "../components/registration/PersonalInfoForm";
import RaceDetailsForm from "../components/registration/RaceDetailsForm";
import ReviewRegistration from "../components/registration/ReviewRegistration";
import RegistrationStepper from "../components/registration/RegistrationStepper";
import RegistrationSnackbar from "../components/registration/RegistrationSnackbar";
import { db } from "../config/firebase";


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
  const [profilePrefillChecked, setProfilePrefillChecked] = useState(false);
  const [updateRunnerProfile, setUpdateRunnerProfile] = useState(true);
  const [representingOptions, setRepresentingOptions] = useState<string[]>([]);

  // Form state
  const [activeStep, setActiveStep] = useState(0);
  const [formData, setFormData] = useState({
    ...initialFormData,
    isOnWaitinglist: false,
    waitinglistExpires: null as Date | null
  });
  const formDataRef = useRef<any>(formData);
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

  const [isSubmitting, setIsSubmitting] = useState(false);

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

  // Get registration config with defaults
  const registrationConfig: RegistrationConfig = useMemo(() => ({
    fields: {
      ...DEFAULT_REGISTRATION_CONFIG.fields,
      ...event.registrationConfig?.fields
    }
  }), [event.registrationConfig?.fields]);

  // Compute whether license is required for the selected race distance
  const selectedDistance = event.raceDistances?.find(d => d.id === formData.raceDistance);
  const licenseFee = selectedDistance?.fees?.oneTimeLicense ?? event.fees?.oneTimeLicense ?? 0;
  const requiresLicense = licenseFee > 0;

  const eventYear = useMemo(() => {
    const d = event?.startTime instanceof Date ? event.startTime : new Date(event?.startTime as any);
    const year = d && !Number.isNaN(d.getTime()) ? d.getFullYear() : new Date().getFullYear();
    return year;
  }, [event?.startTime]);

  const calculatedPaymentRequired = useMemo(() => {
    const participationFee = selectedDistance?.fees?.participation ?? event.fees?.participation ?? 0;
    const oneTimeLicenseFee = selectedDistance?.fees?.oneTimeLicense ?? event.fees?.oneTimeLicense ?? 0;
    const serviceFee = selectedDistance?.fees?.service ?? event.fees?.service ?? (event.fees as any)?.baseCamp ?? 0;
    const depositFee = selectedDistance?.fees?.deposit ?? event.fees?.deposit ?? 0;
    const actualLicenseFee = (oneTimeLicenseFee > 0 && formData.hasYearLicense !== true) ? oneTimeLicenseFee : 0;
    return participationFee + actualLicenseFee + serviceFee + depositFee;
  }, [event.fees, formData.hasYearLicense, selectedDistance]);

  useEffect(() => {
    if (calculatedPaymentRequired > 0 && formData.paymentRequired !== calculatedPaymentRequired) {
      setFormData((prev: any) => ({ ...prev, paymentRequired: calculatedPaymentRequired }));
    }
  }, [calculatedPaymentRequired, formData.paymentRequired]);

  useEffect(() => {
    formDataRef.current = formData;
  }, [formData]);

  // Validation context for race-specific settings (passed explicitly to validators)
  const validationContext: RaceValidationContext = useMemo(() => ({
    requiresLicense,
    eventYear,
    registrationConfig,
  }), [requiresLicense, eventYear, registrationConfig]);

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
    setFormData((prev) => {
      const next = { ...prev, [field]: value };
      formDataRef.current = next;
      return next;
    });
    setTouchedFields((prev) => ({ ...prev, [field]: true }));
  }, []);

  const handleFieldTouch = (field: string) => {
    setTouchedFields((prev) => ({ ...prev, [field]: true }));

    const currentFormData = formDataRef.current;
    
    // Validate the field immediately and show errors
    if (field) {
      const options = { touchedFields: { [field]: true } };
      
      // Get validation result for just this field based on which step it belongs to
      let fieldErrors: Record<string, string> = {};
      const personalInfoFields = ['firstName', 'lastName', 'dateOfBirth', 'nationality', 'email', 'phoneCountryCode', 'phoneNumber', 'representing'];
      const raceDetailsFields = ['raceDistance', 'hasYearLicense', 'licenseNumber', 'travelRequired', 'comments'];
      
      if (personalInfoFields.includes(field)) {
        fieldErrors = validatePersonalInfo(currentFormData, options);
      } else if (raceDetailsFields.includes(field)) {
        fieldErrors = validateRaceDetails(currentFormData, validationContext, options);
      } else {
        fieldErrors = validateReviewSubmit(currentFormData, options);
      }
      
      // Get the current field value to check if it's empty
      const fieldValue = currentFormData[field as keyof typeof currentFormData];
      const isEmpty = fieldValue === '' || fieldValue === null || fieldValue === undefined;
      
      // Update the errors state for this field
      setErrors(prev => {
        const newErrors = { ...prev };
        if (field in fieldErrors) {
          newErrors[field] = fieldErrors[field];
        } else {
          delete newErrors[field];
        }
        return newErrors;
      });
      
      // If this is a required field and it's empty, we want to force visual validation
      if (isEmpty) {
        setValidationAttempted(true);
      }
    }
  };

  const clearAllErrors = useCallback(() => {
    setErrors({});
  }, []);

  const showCurrentStepErrors = useCallback(() => {
    const options = { showAllErrors: true };
    let currentErrors: Record<string, string> = {};
    
    if (activeStep === 0) {
      currentErrors = validatePersonalInfo(formData, options);
    } else if (activeStep === 1) {
      currentErrors = validateRaceDetails(formData, validationContext, options);
    } else {
      currentErrors = validateReviewSubmit(formData, options);
    }
    
    setErrors(currentErrors);
    return Object.keys(currentErrors).length > 0;
  }, [formData, validationContext, activeStep]);

  const hasPersonalInfoErrors = useCallback(() => {
    const errors = validatePersonalInfo(formData, { showAllErrors: true });
    
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
          let registrations = await getRegistrationsByUserId(
            user.uid,
            event.id
          );

          if ((!registrations || registrations.length === 0) && user.email) {
            const { getRegistrationsByEmail } = await import(
              "../services/registrationService"
            );
            registrations = await getRegistrationsByEmail(user.email, event.id);
          }
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
    t,
    event.id
  ]);

  useEffect(() => {
    const auth = getAuth();
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setAuthChecked(true);
      setProfilePrefillChecked(false);
      if (u && u.email) {
        setFormData((prev: any) => ({ ...prev, email: u.email }));
      }
    });
    return unsub;
  }, []);

  type FirestoreUserProfile = {
    uid?: string | null;
    email?: string;
    firstName?: string;
    lastName?: string;
    nationality?: string;
    dateOfBirth?: any;
    phoneCountryCode?: string | null;
    phone?: string | null;
    representing?: string[] | string | null;
    nfifLicenseNumber?: string | null;
  };

  const normalizeEmail = (value: string) => value.trim().toLowerCase();

  const normalizePhoneCountryCode = (value: string | null | undefined): string => {
    const trimmed = String(value ?? '').trim();
    if (!trimmed) return '';
    return trimmed.startsWith('+') ? trimmed : `+${trimmed.replace(/^\+/, '')}`;
  };

  const normalizePhoneDigits = (value: string | null | undefined): string => {
    return String(value ?? '').replace(/\D/g, '').slice(0, 15);
  };

  const getLicenseYear = (licenseNumber: string): number | null => {
    const trimmed = String(licenseNumber ?? '').trim();
    if (!LICENSE_NUMBER_REGEX.test(trimmed)) return null;
    const parts = trimmed.split('-');
    const year = Number(parts[1]);
    return Number.isFinite(year) ? year : null;
  };

  const extractRepresentingValue = (value: unknown): string => {
    if (Array.isArray(value)) {
      const arr = value.map((v) => String(v ?? '').trim()).filter(Boolean);
      return arr.length ? arr[arr.length - 1] : '';
    }
    return String(value ?? '').trim();
  };

  const extractRepresentingOptions = (value: unknown): string[] => {
    const arr = Array.isArray(value)
      ? value.map((v) => String(v ?? '').trim()).filter(Boolean)
      : (typeof value === 'string' && value.trim())
        ? [value.trim()]
        : [];
    return Array.from(new Set(arr));
  };

  const resolveUserProfileDoc = useCallback(async (uid: string, email: string | null | undefined) => {
    const usersRef = collection(db, 'users');

    const directSnap = await getDoc(doc(db, 'users', uid));
    if (directSnap.exists()) {
      return { id: directSnap.id, data: directSnap.data() as FirestoreUserProfile };
    }

    const byUidSnap = await getDocs(query(usersRef, where('uid', '==', uid), limit(1)));
    if (!byUidSnap.empty) {
      const d = byUidSnap.docs[0];
      return { id: d.id, data: d.data() as FirestoreUserProfile };
    }

    if (email) {
      const normalized = normalizeEmail(email);
      const byEmailSnap = await getDocs(query(usersRef, where('email', '==', normalized), limit(1)));
      if (!byEmailSnap.empty) {
        const d = byEmailSnap.docs[0];
        return { id: d.id, data: d.data() as FirestoreUserProfile };
      }
    }

    return null;
  }, []);

  // Prefill from runner profile when user is logged in and has no existing registration for this edition.
  useEffect(() => {
    if (!authChecked || !prefillChecked || !user || !user.uid) {
      return;
    }
    if (isEditingExisting) {
      return;
    }
    if (profilePrefillChecked) {
      return;
    }

    let isMounted = true;
    const loadProfilePrefill = async () => {
      try {
        const resolved = await resolveUserProfileDoc(user.uid, user.email);
        if (!isMounted) return;
        if (!resolved) {
          return;
        }

        const profile = resolved.data;
        const normalizedPhoneCountryCode = normalizePhoneCountryCode(profile.phoneCountryCode ?? null);
        const normalizedPhone = normalizePhoneDigits(profile.phone ?? null);
        const normalizedDob = toDate(profile.dateOfBirth);
        const representingValue = extractRepresentingValue(profile.representing);
        const representingOpts = extractRepresentingOptions(profile.representing);
        const storedLicenseNumber = String(profile.nfifLicenseNumber ?? '').trim();
        const storedLicenseYear = getLicenseYear(storedLicenseNumber);
        const currentEventYear = eventYear;

        setRepresentingOptions(representingOpts);

        setFormData((prev: any) => {
          const next: any = { ...prev };
          if (!next.firstName && profile.firstName) next.firstName = profile.firstName;
          if (!next.lastName && profile.lastName) next.lastName = profile.lastName;

          if ((!next.nationality || next.nationality === initialFormData.nationality) && profile.nationality) {
            next.nationality = profile.nationality;
          }

          if (!next.dateOfBirth && normalizedDob) next.dateOfBirth = normalizedDob;

          if ((next.phoneCountryCode === initialFormData.phoneCountryCode || !next.phoneCountryCode) && normalizedPhoneCountryCode) {
            next.phoneCountryCode = normalizedPhoneCountryCode;
          }
          if (!next.phoneNumber && normalizedPhone) next.phoneNumber = normalizedPhone;
          if (!next.representing && representingValue) next.representing = representingValue;

          // Prefill NFIF year license only if the stored license number is for the current event year.
          if (
            storedLicenseNumber &&
            storedLicenseYear === currentEventYear &&
            next.hasYearLicense === initialFormData.hasYearLicense &&
            String(next.licenseNumber ?? '').trim() === ''
          ) {
            next.hasYearLicense = true;
            next.licenseNumber = storedLicenseNumber;
          }

          return next;
        });
      } catch (err) {
        console.warn('[RegistrationPage] Failed to prefill from runner profile', err);
      } finally {
        if (isMounted) setProfilePrefillChecked(true);
      }
    };

    loadProfilePrefill();
    return () => {
      isMounted = false;
    };
  }, [authChecked, eventYear, prefillChecked, user, isEditingExisting, profilePrefillChecked, resolveUserProfileDoc]);

  // Always load representing options for the Club dropdown when logged in.
  useEffect(() => {
    if (!authChecked || !user?.uid) return;
    let isMounted = true;
    const loadRepresenting = async () => {
      try {
        const resolved = await resolveUserProfileDoc(user.uid, user.email);
        if (!isMounted) return;
        const opts = extractRepresentingOptions(resolved?.data?.representing);
        setRepresentingOptions(opts);
      } catch {
        // ignore
      }
    };
    loadRepresenting();
    return () => {
      isMounted = false;
    };
  }, [authChecked, user, resolveUserProfileDoc]);

  const upsertRunnerProfileFromForm = useCallback(async () => {
    if (!user?.uid) {
      return;
    }
    const resolved = await resolveUserProfileDoc(user.uid, user.email);
    const docId = resolved?.id || user.uid;
    const existing = resolved?.data;
    const existingRepresenting = existing?.representing;
    const representingArr = Array.isArray(existingRepresenting)
      ? existingRepresenting.map((v) => String(v ?? '').trim()).filter(Boolean)
      : (typeof existingRepresenting === 'string' && existingRepresenting.trim())
        ? [existingRepresenting.trim()]
        : [];

    const newRepresenting = String(formData.representing ?? '').trim();
    const mergedRepresenting = newRepresenting && !representingArr.includes(newRepresenting)
      ? [...representingArr, newRepresenting]
      : representingArr;

    const payload: Record<string, any> = {
      uid: user.uid,
      email: normalizeEmail(String(user.email || formData.email || '')),
      firstName: String(formData.firstName || '').trim(),
      lastName: String(formData.lastName || '').trim(),
      nationality: String(formData.nationality || '').trim(),
      dateOfBirth: formData.dateOfBirth ?? null,
      phoneCountryCode: normalizePhoneCountryCode(formData.phoneCountryCode),
      phone: normalizePhoneDigits(formData.phoneNumber),
      updatedAt: serverTimestamp()
    };
    if (mergedRepresenting.length) {
      payload.representing = mergedRepresenting;
    }

    await setDoc(doc(db, 'users', docId), payload, { merge: true });
  }, [user, formData, resolveUserProfileDoc]);

  const upsertRunnerLicenseFromForm = useCallback(async () => {
    if (!user?.uid) return;

    const licenseNumber = String(formData.licenseNumber ?? '').trim();
    if (formData.hasYearLicense !== true) return;
    const licenseYear = getLicenseYear(licenseNumber);
    if (!licenseYear) return;

    const resolved = await resolveUserProfileDoc(user.uid, user.email);
    const docId = resolved?.id || user.uid;

    await setDoc(
      doc(db, 'users', docId),
      {
        nfifLicenseNumber: licenseNumber,
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
  }, [user, formData.hasYearLicense, formData.licenseNumber, resolveUserProfileDoc]);

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
    const errors = validateAll(formData, validationContext, { showAllErrors: true });
    if (!formData.termsAccepted) errors.termsAccepted = "You must accept the terms and conditions";
    if (!user || !user.email) return false;
    return Object.keys(errors).length === 0;
  };

  const isFinalStep = activeStep === steps.length - 1;
  const submitDisabled =
    isSubmitting ||
    (isFinalStep &&
      (!isFormValidForSubmission() ||
        (isFull &&
          !isEditingExisting &&
          !formData.waitinglistExpires)));

  const submitBlockedReasons: string[] = [];
  if (isFinalStep) {
    if (formData.notifyFutureEvents !== true && formData.notifyFutureEvents !== false) {
      submitBlockedReasons.push(t('registration.submitBlock.notifyFutureEvents'));
    }
    if (formData.sendRunningOffers !== true && formData.sendRunningOffers !== false) {
      submitBlockedReasons.push(t('registration.submitBlock.sendRunningOffers'));
    }
    if (formData.termsAccepted !== true) {
      submitBlockedReasons.push(t('registration.submitBlock.termsAccepted'));
    }
    if (isFull && !isEditingExisting && !formData.waitinglistExpires) {
      submitBlockedReasons.push(t('registration.submitBlock.waitinglistExpires'));
    }
  }

  const handleNext = () => {
    // Mark all fields for the current step as touched
    const updatedTouchedFields = markStepFieldsTouched(activeStep, touchedFields);
    setTouchedFields(updatedTouchedFields);
    setValidationAttempted(true);
    
    // For final step (from Race Details to Review), check all fields except terms
    if (activeStep === steps.length - 2) {
      // Validate all fields except terms and conditions
      const currentErrors = validateAll(formData, validationContext, { showAllErrors: true });
      const errorsWithoutTerms = { ...currentErrors };
      delete errorsWithoutTerms.notifyFutureEvents;
      delete errorsWithoutTerms.sendRunningOffers;
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
        // Go to step with errors
        if (hasPersonalInfoErrors()) {
          setActiveStep(0);
          setTimeout(() => scrollToFirstError(errors), 100);
        } else {
          scrollToFirstError(errorsWithoutTerms);
        }
      }
    } else {
      // For other steps, validate only the CURRENT step's fields
      let stepErrors: Record<string, string> = {};
      
      if (activeStep === 0) {
        stepErrors = validatePersonalInfo(formData, { showAllErrors: true });
      } else if (activeStep === 1) {
        stepErrors = validateRaceDetails(formData, validationContext, { showAllErrors: true });
      }
      
      setErrors(stepErrors);
      const stepValid = Object.keys(stepErrors).length === 0;

      if (stepValid) {
        setActiveStep((prevActiveStep) => prevActiveStep + 1);
        window.scrollTo(0, 0);
        clearAllErrors();
      } else {
        scrollToFirstError(stepErrors);
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
      // Only show errors for race details step
      const stepErrors = validateRaceDetails(formData, validationContext, { showAllErrors: true });
      setErrors(stepErrors);
    } else if (!validationAttempted) {
      // Clear errors if validation hasn't been attempted
      clearAllErrors();
    }
  }, [activeStep, validationAttempted, formData, validationContext, clearAllErrors]);

  const handleSubmit = async () => {
    // Validate the entire form including terms and conditions
    setValidationAttempted(true);
    const currentErrors = validateAll(formData, validationContext, { showAllErrors: true });

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
          termsAccepted: formData.termsAccepted === true,
          comments: formData.comments?.trim() || "",
          // Include marketing preferences
          notifyFutureEvents: formData.notifyFutureEvents ?? false,
          sendRunningOffers: formData.sendRunningOffers ?? false,
          // Include edition ID
          editionId: formData.editionId || event.id,
          // Waiting list info
          isOnWaitinglist: formData.isOnWaitinglist,
          waitinglistExpires: formData.waitinglistExpires,
          paymentRequired: calculatedPaymentRequired > 0 ? calculatedPaymentRequired : (formData.paymentRequired ?? 0),
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

          try {
            await upsertRunnerLicenseFromForm();
          } catch (err) {
            console.error('[RegistrationPage] Failed to store NFIF license number', err);
          }

          if (updateRunnerProfile) {
            try {
              await upsertRunnerProfileFromForm();
            } catch (err) {
              console.error('[RegistrationPage] Failed to update runner profile from registration', err);
            }
          }

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

          try {
            await upsertRunnerLicenseFromForm();
          } catch (err) {
            console.error('[RegistrationPage] Failed to store NFIF license number', err);
          }

          if (updateRunnerProfile) {
            try {
              await upsertRunnerProfileFromForm();
            } catch (err) {
              console.error('[RegistrationPage] Failed to update runner profile from registration', err);
            }
          }

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
      setErrors(currentErrors);
      setSnackbarMessage(t('registration.completeFieldsBeforeSubmitting'));
      setSnackbarOpen(true);
      setSnackbarSeverity("error");
      scrollToFirstError(currentErrors);
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
            registrationConfig={registrationConfig}
            representingOptions={representingOptions}
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
            isEditingExisting={isEditingExisting}
            isFull={isFull}
            showUpdateRunnerProfileOption={Boolean(isLoggedIn)}
            updateRunnerProfileChecked={updateRunnerProfile}
            onUpdateRunnerProfileChange={(checked) => setUpdateRunnerProfile(checked)}
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
              {(() => {
                const s = String((formData as any).status || 'pending').toLowerCase();
                const label = t(`registrationStatus.${s}`, { defaultValue: s });
                return (
                  <Alert severity={s === 'confirmed' ? 'success' : 'warning'}>
                    {t('registrationStatus.label')}: {label}
                    {formData.isOnWaitinglist ? ` (${t('events.onWaitlistCount')})` : ''}
                  </Alert>
                );
              })()}
            </Box>
            <Box sx={{ mb: 2 }}>
              <Alert
                severity={
                  formData.paymentMade >= (calculatedPaymentRequired > 0 ? calculatedPaymentRequired : formData.paymentRequired)
                    ? "success"
                    : formData.paymentMade < (calculatedPaymentRequired > 0 ? calculatedPaymentRequired : formData.paymentRequired)
                      ? "warning"
                      : "info"
                }
              >
                {t('status.label')}: {" "}
                {formData.paymentMade >= (calculatedPaymentRequired > 0 ? calculatedPaymentRequired : formData.paymentRequired)
                  ? t('registration.paymentMade')
                  : formData.paymentMade < (calculatedPaymentRequired > 0 ? calculatedPaymentRequired : formData.paymentRequired)
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
            disabled={submitDisabled}
          >
            {activeStep === steps.length - 1 ? t('registration.submit') : t('registration.next')}
          </Button>
        </Box>
        {isFinalStep && submitDisabled && !isSubmitting && submitBlockedReasons.length > 0 && (
          <Box sx={{ mt: 1 }}>
            <Typography variant="body2" color="text.secondary">
              {t('registration.submitDisabledHelp')}
            </Typography>
            {submitBlockedReasons.map((r) => (
              <Typography key={r} variant="body2" color="text.secondary">
                - {r}
              </Typography>
            ))}
          </Box>
        )}
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
