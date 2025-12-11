import { ERROR_MESSAGES } from '../constants/messages';
import { RegistrationConfig } from '../contexts/EventEditionContext';

// License number format: NNNNNN-YYYY (e.g., 221393-2025)
export const LICENSE_NUMBER_REGEX = /^\d{6}-\d{4}$/;

/**
 * Validation options for controlling when errors are shown
 */
export interface ValidationOptions {
  /** Only validate fields that have been touched */
  touchedFields?: Record<string, boolean>;
  /** Show all errors regardless of touched state */
  showAllErrors?: boolean;
}

/**
 * Validation context for race-specific settings
 */
export interface RaceValidationContext {
  /** Whether the selected race requires a license (licenseFee > 0) */
  requiresLicense: boolean;
  /** Registration config from the event */
  registrationConfig: RegistrationConfig;
}

// Helper to check if a field should be validated
const shouldValidate = (field: string, options: ValidationOptions): boolean => {
  if (options.showAllErrors) return true;
  return options.touchedFields?.[field] ?? false;
};

/**
 * Validates personal info fields (Step 0)
 */
export const validatePersonalInfo = (
  formData: any,
  options: ValidationOptions = {}
): Record<string, string> => {
  const errors: Record<string, string> = {};

  // First name
  if (shouldValidate('firstName', options)) {
    if (!formData.firstName || formData.firstName.trim() === '') {
      errors.firstName = ERROR_MESSAGES.firstName;
    } else if (formData.firstName.trim().length > 60) {
      errors.firstName = 'First and middle names cannot exceed 60 characters';
    }
  }

  // Last name
  if (shouldValidate('lastName', options)) {
    if (!formData.lastName || formData.lastName.trim() === '') {
      errors.lastName = ERROR_MESSAGES.lastName;
    } else if (formData.lastName.trim().length > 60) {
      errors.lastName = 'Last name cannot exceed 60 characters';
    }
  }

  // Date of birth
  if (shouldValidate('dateOfBirth', options)) {
    if (formData.dateOfBirth === null) {
      errors.dateOfBirth = ERROR_MESSAGES.dateOfBirth;
    } else if (formData.dateOfBirth !== null) {
      if (!(formData.dateOfBirth instanceof Date) || isNaN(formData.dateOfBirth.getTime())) {
        errors.dateOfBirth = 'Please enter a complete, valid date of birth';
      } else if (formData.dateOfBirth.getFullYear() === 0 || formData.dateOfBirth.getFullYear() < 1900) {
        errors.dateOfBirth = 'Please enter a complete date with year of birth';
      } else {
        const birthYear = formData.dateOfBirth.getFullYear();
        const eventYear = 2025;
        const age = eventYear - birthYear;
        
        if (age < 15) {
          errors.dateOfBirth = 'Participants must be at least 15 years old in the year of the event';
        } else if (age > 100) {
          errors.dateOfBirth = 'Please enter a valid date of birth (maximum age is 100 years)';
        }
      }
    }
  }

  // Nationality
  if (shouldValidate('nationality', options)) {
    if (!formData.nationality || formData.nationality.trim() === '') {
      errors.nationality = 'Nationality is required';
    }
  }

  // Email
  if (shouldValidate('email', options)) {
    if (!formData.email || formData.email.trim() === '') {
      errors.email = 'Email is required';
    } else if (!/^\S+@\S+\.\S+$/.test(formData.email)) {
      errors.email = 'Please enter a valid email address';
    } else if (formData.email.trim().length > 60) {
      errors.email = 'Email cannot exceed 60 characters';
    }
  }

  // Phone country code
  if (shouldValidate('phoneCountryCode', options)) {
    if (!formData.phoneCountryCode || formData.phoneCountryCode.trim() === '') {
      errors.phoneCountryCode = 'Country code is required';
    }
  }

  // Phone number
  if (shouldValidate('phoneNumber', options)) {
    if (!formData.phoneNumber || formData.phoneNumber.trim() === '') {
      errors.phoneNumber = 'Phone number is required';
    } else {
      const digitsOnly = formData.phoneNumber.replace(/\D/g, '');
      if (digitsOnly.length < 6) {
        errors.phoneNumber = 'Phone number is too short (minimum 6 digits)';
      } else if (digitsOnly.length > 15) {
        errors.phoneNumber = 'Phone number is too long (maximum 15 digits)';
      }
    }
  }

  // Representing (optional based on config, but we don't validate it as required)
  // The representing field is optional - no validation needed

  return errors;
};

/**
 * Validates race details fields (Step 1)
 */
export const validateRaceDetails = (
  formData: any,
  context: RaceValidationContext,
  options: ValidationOptions = {}
): Record<string, string> => {
  const errors: Record<string, string> = {};
  const { requiresLicense, registrationConfig } = context;

  // Race distance (always required)
  if (shouldValidate('raceDistance', options)) {
    if (!formData.raceDistance || formData.raceDistance === '') {
      errors.raceDistance = ERROR_MESSAGES.raceDistance;
    }
  }

  // License validation - only if license is required for the selected race
  if (requiresLicense) {
    // Must answer the license question
    if (shouldValidate('hasYearLicense', options)) {
      if (formData.hasYearLicense === undefined) {
        errors.hasYearLicense = 'Please indicate if you have a full-year license';
      }
    }
    
    // If user has year license, license number is required and must be valid
    if (formData.hasYearLicense === true && shouldValidate('licenseNumber', options)) {
      if (!formData.licenseNumber || formData.licenseNumber.trim() === '') {
        errors.licenseNumber = 'License number is required';
      } else if (!LICENSE_NUMBER_REGEX.test(formData.licenseNumber.trim())) {
        errors.licenseNumber = 'Invalid license number format (expected: 123456-2025)';
      }
    }
  }

  // Travel requirements - only if enabled in config
  if (registrationConfig.fields.travelRequired) {
    if (shouldValidate('travelRequired', options)) {
      if (!formData.travelRequired || formData.travelRequired.trim() === '') {
        errors.travelRequired = ERROR_MESSAGES.travelRequired;
      } else if (formData.travelRequired.trim().length > 200) {
        errors.travelRequired = 'Travel requirements cannot exceed 200 characters';
      }
    }
  }

  // Comments length validation (optional field, just check max length)
  if (shouldValidate('comments', options)) {
    if (formData.comments && formData.comments.trim().length > 500) {
      errors.comments = 'Comments cannot exceed 500 characters';
    }
  }

  return errors;
};

/**
 * Validates review/submit fields (Step 2)
 */
export const validateReviewSubmit = (
  formData: any,
  options: ValidationOptions = {}
): Record<string, string> => {
  const errors: Record<string, string> = {};

  // Terms and conditions
  if (shouldValidate('termsAccepted', options)) {
    if (!formData.termsAccepted) {
      errors.termsAccepted = ERROR_MESSAGES.termsAccepted || 'You must accept the terms and conditions';
    }
  }

  // Waiting list validation (if applicable)
  if (formData.isOnWaitinglist && shouldValidate('waitinglistExpires', options) && formData.waitinglistExpires !== null) {
    const expirationYear = formData.waitinglistExpires.getFullYear();
    const eventYear = 2025;
    const expirationDate = formData.waitinglistExpires.getTime();
    const today = new Date().getTime();
    
    if (expirationYear < eventYear) {
      errors.waitinglistExpires = 'Waiting list expiration date must be in the year of the event or later';
    } else if (expirationDate < today) {
      errors.waitinglistExpires = 'Waiting list expiration date must be in the future';
    }
  }

  return errors;
};

/**
 * Validates all form fields (for final submission)
 */
export const validateAll = (
  formData: any,
  context: RaceValidationContext,
  options: ValidationOptions = {}
): Record<string, string> => {
  return {
    ...validatePersonalInfo(formData, options),
    ...validateRaceDetails(formData, context, options),
    ...validateReviewSubmit(formData, options),
  };
};

/**
 * Get all field names for a specific step
 */
export const getStepFields = (step: number): string[] => {
  switch (step) {
    case 0: // Personal Info
      return [
        'firstName', 'lastName', 'dateOfBirth', 'nationality',
        'email', 'phoneCountryCode', 'phoneNumber', 'representing'
      ];
    case 1: // Race Details
      return [
        'raceDistance', 'hasYearLicense', 'licenseNumber',
        'travelRequired', 'comments'
      ];
    case 2: // Review/Submit
      return ['termsAccepted', 'isOnWaitinglist', 'waitinglistExpires'];
    default:
      return [];
  }
};

/**
 * Mark all fields for a step as touched
 */
export const markStepFieldsTouched = (
  step: number,
  currentTouched: Record<string, boolean>
): Record<string, boolean> => {
  const fields = getStepFields(step);
  const newTouched = { ...currentTouched };
  fields.forEach(field => newTouched[field] = true);
  return newTouched;
};
