import { Country } from '../types';

// Common countries that will appear at the top of the list
export const COMMON_COUNTRIES: Country[] = [
  { name: 'Norway', code: 'NOR', isCommon: true },
  { name: 'Sweden', code: 'SWE', isCommon: true },
  { name: 'Denmark', code: 'DNK', isCommon: true },
  { name: 'Finland', code: 'FIN', isCommon: true }
];

// All countries list (including common countries)
export const COUNTRIES: Country[] = [
  ...COMMON_COUNTRIES,
  { name: 'Australia', code: 'AUS' },
  { name: 'Austria', code: 'AUT' },
  { name: 'Belgium', code: 'BEL' },
  { name: 'Brazil', code: 'BRA' },
  { name: 'Canada', code: 'CAN' },
  { name: 'China', code: 'CHN' },
  { name: 'Czech Republic', code: 'CZE' },
  { name: 'Estonia', code: 'EST' },
  { name: 'France', code: 'FRA' },
  { name: 'Germany', code: 'DEU' },
  { name: 'Greece', code: 'GRC' },
  { name: 'Iceland', code: 'ISL' },
  { name: 'India', code: 'IND' },
  { name: 'Ireland', code: 'IRL' },
  { name: 'Italy', code: 'ITA' },
  { name: 'Japan', code: 'JPN' },
  { name: 'Latvia', code: 'LVA' },
  { name: 'Lithuania', code: 'LTU' },
  { name: 'Luxembourg', code: 'LUX' },
  { name: 'Netherlands', code: 'NLD' },
  { name: 'New Zealand', code: 'NZL' },
  { name: 'Poland', code: 'POL' },
  { name: 'Portugal', code: 'PRT' },
  { name: 'Russia', code: 'RUS' },
  { name: 'South Africa', code: 'ZAF' },
  { name: 'Spain', code: 'ESP' },
  { name: 'Switzerland', code: 'CHE' },
  { name: 'United States', code: 'USA' },
  { name: 'United Kingdom', code: 'GBR' }
  // More countries can be added here or loaded from a database in the future
];
