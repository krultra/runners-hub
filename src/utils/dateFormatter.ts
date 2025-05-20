import { parseISO } from 'date-fns';
import { formatInTimeZone } from 'date-fns-tz';
import { nb } from 'date-fns/locale';

type DateInput = Date | string | number | { toDate(): Date };

export const DEFAULT_TIMEZONE = 'Europe/Oslo';

/**
 * Safely converts various date inputs to a Date object
 */
const toDate = (date: DateInput): Date => {
  try {
    if (!date) return new Date(); // Return current date for null/undefined
    if (date instanceof Date) return date;
    if (typeof date === 'string') return parseISO(date);
    if (typeof date === 'number') return new Date(date);
    if (date && typeof date.toDate === 'function') return date.toDate();
    
    // If we get here, it's an object that's not a Date and doesn't have toDate()
    console.warn('Received unexpected date input - Stack trace:', new Error().stack, '\nInput:', date);
    return new Date(); // Fallback to current date
  } catch (error) {
    console.error('Error converting to date:', error);
    return new Date(); // Fallback to current date on error
  }
};

/**
 * Formats a date according to the specified format string and timezone
 * @param date - The date to format (Date, string, number, or object with toDate() method)
 * @param formatString - The format string (using date-fns format tokens)
 * @param options - Formatting options including timezone and locale
 * @returns Formatted date string in the specified timezone
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
    
    // Format the date in the specified timezone
    return formatInTimeZone(dateObj, timeZone, formatString, { locale });
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
