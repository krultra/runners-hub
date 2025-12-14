/**
 * Unit conversion utilities for metric/imperial measurements.
 * All database values are stored in meters.
 */

const METERS_PER_MILE = 1609.344;
const FEET_PER_METER = 3.28084;

export type UnitSystem = 'metric' | 'imperial';

/**
 * Format a number with thousands separator (uses comma for consistency).
 */
function formatNumber(n: number): string {
  return n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

/**
 * Convert meters to kilometers or miles based on unit system.
 * Always shows one decimal place for consistency.
 */
export function formatDistance(meters: number | null | undefined, units: UnitSystem): string {
  if (meters == null || !Number.isFinite(meters)) return '';
  
  if (units === 'imperial') {
    const miles = meters / METERS_PER_MILE;
    return `${miles.toFixed(1)} mi`;
  }
  
  // Metric (km) - always one decimal
  const km = meters / 1000;
  return `${km.toFixed(1)} km`;
}

/**
 * Convert meters to meters or feet based on unit system.
 * Used for elevation values (ascent, descent, altitude).
 */
export function formatElevation(meters: number | null | undefined, units: UnitSystem): string {
  if (meters == null || !Number.isFinite(meters)) return '';
  
  if (units === 'imperial') {
    const feet = Math.round(meters * FEET_PER_METER);
    return `${formatNumber(feet)} ft`;
  }
  
  // Metric (m)
  return `${formatNumber(Math.round(meters))} m`;
}

/**
 * Get the unit label for distance.
 */
export function getDistanceUnit(units: UnitSystem): string {
  return units === 'imperial' ? 'mi' : 'km';
}

/**
 * Get the unit label for elevation.
 */
export function getElevationUnit(units: UnitSystem): string {
  return units === 'imperial' ? 'ft' : 'm';
}

/**
 * Get the stored unit preference from localStorage.
 * Returns 'metric' by default.
 */
export function getStoredUnits(): UnitSystem {
  if (typeof window === 'undefined') return 'metric';
  const stored = localStorage.getItem('pref_units');
  return stored === 'mi' ? 'imperial' : 'metric';
}

/**
 * Store the unit preference in localStorage.
 */
export function setStoredUnits(units: UnitSystem): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem('pref_units', units === 'imperial' ? 'mi' : 'km');
}
