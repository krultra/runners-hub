import { ERROR_MESSAGES } from '../constants/messages';

// License number format: NNNNNN-YYYY (e.g., 221393-2025)
export const LICENSE_NUMBER_REGEX = /^\d{6}-\d{4}$/;

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
  comments: '',
  // Marketing preferences (default to false)
  notifyFutureEvents: false,
  sendRunningOffers: false,
  // Event edition ID
  editionId: '',
  status: 'pending', // Default status
  paymentRequired: 300,
  paymentMade: 0,
  // License fields
  hasYearLicense: undefined as boolean | undefined,
  licenseNumber: ''
};

/**
 * Validates the registration form data.
 * @param formData The form data to validate
 * @param touchedFields The fields that have been touched
 * @param showAllErrors Whether to show all errors
 * @param silentValidation Whether to suppress error setting
 * @param setErrors Optional callback to set errors
 * @returns An object containing field errors
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
  // First name validation (with length check)
  if ((touchedFields.firstName || showAllErrors) && formData.firstName.trim() === '') {
    newErrors.firstName = ERROR_MESSAGES.firstName;
  } else if ((touchedFields.firstName || showAllErrors) && formData.firstName.trim().length > 60) {
    newErrors.firstName = 'First and middle names cannot exceed 60 characters';
  }

  // Last name validation (with length check)
  if ((touchedFields.lastName || showAllErrors) && formData.lastName.trim() === '') {
    newErrors.lastName = ERROR_MESSAGES.lastName;
  } else if ((touchedFields.lastName || showAllErrors) && formData.lastName.trim().length > 60) {
    newErrors.lastName = 'Last name cannot exceed 60 characters';
  }

  // Date of birth validation with age restrictions
  if ((touchedFields.dateOfBirth || showAllErrors) && formData.dateOfBirth === null) {
    newErrors.dateOfBirth = ERROR_MESSAGES.dateOfBirth;
  } else if ((touchedFields.dateOfBirth || showAllErrors) && formData.dateOfBirth !== null) {
    // Check if the date is valid and complete (not just day/month with missing year)
    if (!(formData.dateOfBirth instanceof Date) || isNaN(formData.dateOfBirth.getTime())) {
      newErrors.dateOfBirth = 'Please enter a complete, valid date of birth';
    } else if (formData.dateOfBirth.getFullYear() === 0 || formData.dateOfBirth.getFullYear() < 1900) {
      // Catch partial dates with missing or implausible year
      newErrors.dateOfBirth = 'Please enter a complete date with year of birth';
    } else {
      const birthYear = formData.dateOfBirth.getFullYear();
      const eventYear = 2025; // Year of the event
      const age = eventYear - birthYear;
      
      if (age < 15) {
        newErrors.dateOfBirth = 'Participants must be at least 15 years old in the year of the event';
      } else if (age > 100) {
        newErrors.dateOfBirth = 'Please enter a valid date of birth (maximum age is 100 years)';
      }
    }
  }

  if ((touchedFields.nationality || showAllErrors) && formData.nationality.trim() === '') {
    newErrors.nationality = 'Nationality is required';
  }

  // Email validation (with length check)
  if ((touchedFields.email || showAllErrors) && formData.email.trim() === '') {
    newErrors.email = 'Email is required';
  } else if ((touchedFields.email || showAllErrors) && formData.email.trim() !== '' && !/^\S+@\S+\.\S+$/.test(formData.email)) {
    newErrors.email = 'Please enter a valid email address';
  } else if ((touchedFields.email || showAllErrors) && formData.email.trim().length > 60) {
    newErrors.email = 'Email cannot exceed 60 characters';
  }

  // Phone code
  if ((touchedFields.phoneCountryCode || showAllErrors) && formData.phoneCountryCode.trim() === '') {
    newErrors.phoneCountryCode = 'Country code is required';
  }

  // Phone number validation with basic format check
  if ((touchedFields.phoneNumber || showAllErrors) && formData.phoneNumber.trim() === '') {
    newErrors.phoneNumber = 'Phone number is required';
  } else if ((touchedFields.phoneNumber || showAllErrors) && formData.phoneNumber.trim() !== '') {
    // Remove any non-digit characters for validation
    const digitsOnly = formData.phoneNumber.replace(/\D/g, '');
    
    // Basic phone number validation - must have at least 6 digits and no more than 15
    if (digitsOnly.length < 6) {
      newErrors.phoneNumber = 'Phone number is too short (minimum 6 digits)';
    } else if (digitsOnly.length > 15) {
      newErrors.phoneNumber = 'Phone number is too long (maximum 15 digits)';
    }
  }

  // Race details
  if ((touchedFields.raceDistance || showAllErrors) && (!formData.raceDistance || formData.raceDistance === '')) {
    newErrors.raceDistance = ERROR_MESSAGES.raceDistance;
  }

  // License validation - only if license is required for the selected race
  // The requiresLicense flag should be passed via formData._requiresLicense (set by the form component)
  if (formData._requiresLicense) {
    // Must answer the license question
    if ((touchedFields.hasYearLicense || showAllErrors) && formData.hasYearLicense === undefined) {
      newErrors.hasYearLicense = 'Please indicate if you have a full-year license';
    }
    
    // If user has year license, license number is required and must be valid
    if (formData.hasYearLicense === true) {
      if ((touchedFields.licenseNumber || showAllErrors) && (!formData.licenseNumber || formData.licenseNumber.trim() === '')) {
        newErrors.licenseNumber = 'License number is required';
      } else if ((touchedFields.licenseNumber || showAllErrors) && formData.licenseNumber && !LICENSE_NUMBER_REGEX.test(formData.licenseNumber.trim())) {
        newErrors.licenseNumber = 'Invalid license number format (expected: 123456-2025)';
      }
    }
  }
  
  // Travel requirements validation with length check
  if ((touchedFields.travelRequired || showAllErrors) && (!formData.travelRequired || formData.travelRequired.trim() === '')) {
    newErrors.travelRequired = ERROR_MESSAGES.travelRequired;
  } else if ((touchedFields.travelRequired || showAllErrors) && formData.travelRequired.trim().length > 200) {
    newErrors.travelRequired = 'Travel requirements cannot exceed 200 characters';
  }

  // Terms and conditions validation
  if ((touchedFields.termsAccepted || showAllErrors) && !formData.termsAccepted) {
    newErrors.termsAccepted = ERROR_MESSAGES.termsAccepted || 'You must accept the terms and conditions';
  }
  
  // Comments length validation
  if ((touchedFields.comments || showAllErrors) && formData.comments && formData.comments.trim().length > 500) {
    newErrors.comments = 'Comments cannot exceed 500 characters';
  }

  // Waiting list expiration date validation - only if this is a waiting list registration
  if (formData.isOnWaitinglist && (touchedFields.waitinglistExpires || showAllErrors) && formData.waitinglistExpires !== null) {
    const expirationYear = formData.waitinglistExpires.getFullYear();
    const eventYear = 2025; // Year of the event
    const expirationDate = formData.waitinglistExpires.getTime();
    const today = new Date().getTime();
    
    if (expirationYear < eventYear) {
      newErrors.waitinglistExpires = 'Waiting list expiration date must be in the year of the event or later';
    } else if (expirationDate < today) {
      newErrors.waitinglistExpires = 'Waiting list expiration date must be in the future';
    }
  }

  if (!silentValidation && setErrors) {
    setErrors(newErrors);
  }
  

  return newErrors;
};
