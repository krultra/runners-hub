import { ERROR_MESSAGES } from '../constants/messages';

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
  status: 'pending', // Default status
  paymentRequired: 300,
  paymentMade: 0
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

  // Email validation
  if ((touchedFields.email || showAllErrors) && formData.email.trim() === '') {
    newErrors.email = 'Email is required';
  } else if ((touchedFields.email || showAllErrors) && formData.email.trim() !== '' && !/^\S+@\S+\.\S+$/.test(formData.email)) {
    newErrors.email = 'Please enter a valid email address';
  }

  // Phone code
  if ((touchedFields.phoneCountryCode || showAllErrors) && formData.phoneCountryCode.trim() === '') {
    newErrors.phoneCountryCode = 'Country code is required';
  }

  // Phone number
  if ((touchedFields.phoneNumber || showAllErrors) && formData.phoneNumber.trim() === '') {
    newErrors.phoneNumber = 'Phone number is required';
  }

  // Race details
  if ((touchedFields.raceDistance || showAllErrors) && formData.raceDistance.trim() === '') {
    newErrors.raceDistance = ERROR_MESSAGES.raceDistance;
  }
  if ((touchedFields.travelRequired || showAllErrors) && formData.travelRequired.trim() === '') {
    newErrors.travelRequired = ERROR_MESSAGES.travelRequired;
  }

  // Terms and conditions validation
  if ((touchedFields.termsAccepted || showAllErrors) && !formData.termsAccepted) {
    newErrors.termsAccepted = ERROR_MESSAGES.termsAccepted || 'You must accept the terms and conditions';
  }

  if (setErrors && !silentValidation) {
    setErrors(newErrors);
  }
  return newErrors;
};
