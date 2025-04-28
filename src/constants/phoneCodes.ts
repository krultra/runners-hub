import { PhoneCode } from '../types';

// Common phone country codes
export const COMMON_PHONE_CODES: PhoneCode[] = [
  { country: 'Norway', code: '+47', flag: '🇳🇴', isCommon: true },
  { country: 'Sweden', code: '+46', flag: '🇸🇪', isCommon: true },
  { country: 'Denmark', code: '+45', flag: '🇩🇰', isCommon: true }
];

// All phone country codes
export const PHONE_CODES: PhoneCode[] = [
  ...COMMON_PHONE_CODES,
  { country: 'Australia', code: '+61', flag: '🇦🇺' },
  { country: 'Austria', code: '+43', flag: '🇦🇹' },
  { country: 'Belgium', code: '+32', flag: '🇧🇪' },
  { country: 'Brazil', code: '+55', flag: '🇧🇷' },
  { country: 'Canada', code: '+1', flag: '🇨🇦' },
  { country: 'China', code: '+86', flag: '🇨🇳' },
  { country: 'Czech Republic', code: '+420', flag: '🇨🇿' },
  { country: 'Estonia', code: '+372', flag: '🇪🇪' },
  { country: 'France', code: '+33', flag: '🇫🇷' },
  { country: 'Germany', code: '+49', flag: '🇩🇪' },
  { country: 'Greece', code: '+30', flag: '🇬🇷' },
  { country: 'Iceland', code: '+354', flag: '🇮🇸' },
  { country: 'India', code: '+91', flag: '🇮🇳' },
  { country: 'Ireland', code: '+353', flag: '🇮🇪' },
  { country: 'Italy', code: '+39', flag: '🇮🇹' },
  { country: 'Japan', code: '+81', flag: '🇯🇵' },
  { country: 'Latvia', code: '+371', flag: '🇱🇻' },
  { country: 'Lithuania', code: '+370', flag: '🇱🇹' },
  { country: 'Luxembourg', code: '+352', flag: '🇱🇺' },
  { country: 'Netherlands', code: '+31', flag: '🇳🇱' },
  { country: 'New Zealand', code: '+64', flag: '🇳🇿' },
  { country: 'Poland', code: '+48', flag: '🇵🇱' },
  { country: 'Portugal', code: '+351', flag: '🇵🇹' },
  { country: 'Russia', code: '+7', flag: '🇷🇺' },
  { country: 'South Africa', code: '+27', flag: '🇿🇦' },
  { country: 'Spain', code: '+34', flag: '🇪🇸' },
  { country: 'Switzerland', code: '+41', flag: '🇨🇭' },
  { country: 'United States', code: '+1', flag: '🇺🇸' },
  { country: 'United Kingdom', code: '+44', flag: '🇬🇧' }
];
// More phone codes can be added here or loaded from a database in the future
