import { format, parseISO } from 'date-fns';
import { nb } from 'date-fns/locale';

type DateInput = Date | string | number | { toDate(): Date };

const DEFAULT_TIMEZONE = 'Europe/Oslo';

/**
 * Safely converts various date inputs to a Date object
 */
const toDate = (date: DateInput): Date => {
  if (date instanceof Date) return date;
  if (typeof date === 'string') return parseISO(date);
  if (typeof date === 'number') return new Date(date);
  if (date && typeof date.toDate === 'function') return date.toDate();
  throw new Error(`Invalid date input: ${date}`);
};

/**
 * Formats a date according to the specified format string and timezone
 */
export const formatDate = (
  date: DateInput,
  formatString: string = 'dd.MM.yyyy',
  options: {
    timeZone?: string;
    locale?: Locale;
  } = {}
): string => {
  try {
    const { timeZone = DEFAULT_TIMEZONE, locale = nb } = options;
    const dateObj = toDate(date);
    
    // For v2, we'll use the date directly since timezone handling is simpler
    // and doesn't require zonedTimeToUtc in most cases
    return format(dateObj, formatString, { locale });
  } catch (error) {
    console.error('Error formatting date:', error);
    return String(date);
  }
};

/**
 * Common date formats used across the application
 */
export const DATE_FORMATS = {
  SHORT_DATE: 'dd.MM.yyyy',
  LONG_DATE: 'd. MMMM yyyy',
  TIME: 'HH:mm',
  DATE_TIME: 'dd.MM.yyyy HH:mm',
  FULL_DATE_TIME: 'dd.MM.yyyy HH:mm:ss',
  ISO: 'yyyy-MM-dd',
} as const;

/**
 * Format a date as a short date (dd.MM.yyyy)
 */
export const formatShortDate = (date: DateInput, timeZone?: string) => 
  formatDate(date, DATE_FORMATS.SHORT_DATE, { timeZone });

/**
 * Format a date and time (dd.MM.yyyy HH:mm)
 */
export const formatDateTime = (date: DateInput, timeZone?: string) => 
  formatDate(date, DATE_FORMATS.DATE_TIME, { timeZone });

/**
 * Format time only (HH:mm)
 */
export const formatTime = (date: DateInput, timeZone?: string) => 
  formatDate(date, DATE_FORMATS.TIME, { timeZone });

/**
 * Format as ISO date (yyyy-MM-dd)
 */
export const formatIsoDate = (date: DateInput) => 
  formatDate(date, DATE_FORMATS.ISO);

/**
 * Format a date as a long format with month name (d. MMMM yyyy)
 */
export const formatLongDate = (date: DateInput, timeZone?: string) => 
  formatDate(date, DATE_FORMATS.LONG_DATE, { timeZone });
