import { parseISO } from 'date-fns';
import { formatInTimeZone } from 'date-fns-tz';
import { nb } from 'date-fns/locale';

type DateInput = Date | string | number | { toDate(): Date };

export const DEFAULT_TIMEZONE = 'Europe/Oslo';

/**
 * Safely converts various date inputs to a Date object
 */
/**
 * Safely converts various date inputs to a Date object
 * Handles: Date objects, timestamps, ISO strings, and date strings in format dd.MM.yyyy
 */
const toDate = (date: DateInput): Date => {
  try {
    // Handle null/undefined
    if (!date) return new Date();
    
    // If it's already a Date object, return it
    if (date instanceof Date) return date;
    
    // Handle Firestore Timestamps
    if (date && typeof (date as any).toDate === 'function') {
      return (date as any).toDate();
    }
    
    // Handle timestamps (numbers)
    if (typeof date === 'number') return new Date(date);
    
    // Handle string dates
    if (typeof date === 'string') {
      // Try parsing as ISO string first
      if (date.includes('T') || date.includes('Z') || /^\d{4}-\d{2}-\d{2}/.test(date)) {
        return parseISO(date);
      }
      
      // Try parsing as dd.MM.yyyy format
      const parts = date.split('.');
      if (parts.length === 3) {
        const [day, month, year] = parts;
        // Note: months are 0-indexed in JS Date
        return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
      }
      
      // Fallback to Date.parse
      const parsed = new Date(date);
      if (!isNaN(parsed.getTime())) return parsed;
    }
    
    // If we get here, we couldn't parse the date
    console.warn('Could not parse date, returning current date. Input:', date);
    return new Date();
  } catch (error) {
    console.error('Error converting to date:', error, 'Input type:', typeof date, 'Value:', date);
    return new Date();
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
