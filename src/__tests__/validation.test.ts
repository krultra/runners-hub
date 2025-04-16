import { ERROR_MESSAGES } from '../constants/messages';
import { validateForm } from '../pages/RegistrationPage';
// Polyfill setImmediate for Jest/jsdom (in case setupTests doesn't run)
if (typeof setImmediate === 'undefined') {
  // @ts-ignore
  global.setImmediate = (fn, ...args) => setTimeout(fn, 0, ...args);
}

describe('Registration form validation', () => {
  const baseForm = {
    firstName: '',
    lastName: '',
    dateOfBirth: null,
    nationality: '',
    email: '',
    phoneCountryCode: '',
    phoneNumber: '',
    representing: '',
    raceDistance: '',
    travelRequired: '',
    termsAccepted: false,
    comments: ''
  };
  const touched = Object.fromEntries(Object.keys(baseForm).map(k => [k, true]));

  it('should require all mandatory fields', () => {
    const errors = validateForm(baseForm, touched, true, true);
    expect(errors.firstName).toBe(ERROR_MESSAGES.firstName);
    expect(errors.lastName).toBe(ERROR_MESSAGES.lastName);
    expect(errors.dateOfBirth).toBe(ERROR_MESSAGES.dateOfBirth);
    expect(errors.raceDistance).toBe(ERROR_MESSAGES.raceDistance);
    expect(errors.travelRequired).toBe(ERROR_MESSAGES.travelRequired);
    expect(errors.termsAccepted).toBe(ERROR_MESSAGES.termsAccepted);
  });

  it('should not error when all fields are valid', () => {
    const validForm = {
      ...baseForm,
      firstName: 'Test',
      lastName: 'User',
      dateOfBirth: new Date('2000-01-01'),
      nationality: 'NOR',
      email: 'test@example.com',
      phoneCountryCode: '+47',
      phoneNumber: '12345678',
      raceDistance: '10k',
      travelRequired: 'yes',
      termsAccepted: true,
    };
    const errors = validateForm(validForm, touched, true, true);
    expect(errors).toEqual({});
  });
});
