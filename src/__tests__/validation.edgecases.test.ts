import { ERROR_MESSAGES } from '../constants/messages';
import { validateForm } from '../utils/validation';

describe('Registration form validation edge cases', () => {
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

  it('should error for invalid email formats', () => {
    const invalids = ['plainaddress', 'missing@domain', 'missing@.com', 'missing@com', 'test@domain,com'];
    for (const email of invalids) {
      const errors = validateForm({ ...baseForm, email }, { ...touched, email: true }, true, true);
      expect(errors.email).toBe('Please enter a valid email address');
    }
  });

  it('should require phone number and country code', () => {
    let errors = validateForm({ ...baseForm, phoneCountryCode: '', phoneNumber: '' }, touched, true, true);
    expect(errors.phoneCountryCode).toBe('Country code is required');
    expect(errors.phoneNumber).toBe('Phone number is required');
    errors = validateForm({ ...baseForm, phoneCountryCode: '+47', phoneNumber: '' }, touched, true, true);
    expect(errors.phoneNumber).toBe('Phone number is required');
    errors = validateForm({ ...baseForm, phoneCountryCode: '', phoneNumber: '12345678' }, touched, true, true);
    expect(errors.phoneCountryCode).toBe('Country code is required');
  });

  it('should require race distance and travelRequired', () => {
    let errors = validateForm({ ...baseForm, raceDistance: '', travelRequired: '' }, touched, true, true);
    expect(errors.raceDistance).toBe(ERROR_MESSAGES.raceDistance);
    expect(errors.travelRequired).toBe(ERROR_MESSAGES.travelRequired);
  });

  it('should require termsAccepted even if everything else is valid', () => {
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
      termsAccepted: false,
    };
    const errors = validateForm(validForm, touched, true, true);
    expect(errors.termsAccepted).toBe(ERROR_MESSAGES.termsAccepted || 'You must accept the terms and conditions');
  });

  it('should allow optional comments and representing fields to be empty', () => {
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
      comments: '',
      representing: ''
    };
    const errors = validateForm(validForm, touched, true, true);
    expect(errors.comments).toBeUndefined();
    expect(errors.representing).toBeUndefined();
  });

  it('should handle dateOfBirth as null or a valid Date', () => {
    let errors = validateForm({ ...baseForm, dateOfBirth: null }, touched, true, true);
    expect(errors.dateOfBirth).toBe(ERROR_MESSAGES.dateOfBirth);
    errors = validateForm({ ...baseForm, dateOfBirth: new Date('2000-01-01') }, touched, true, true);
    expect(errors.dateOfBirth).toBeUndefined();
  });
});
