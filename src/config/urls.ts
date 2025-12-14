/**
 * Site configuration - URLs for cross-site linking.
 * These can be overridden via environment variables for different environments.
 */

// const defaultKrUltraURL = 'https://krultra.no'
const defaultKrUltraURL = 'http://localhost:4000/'
// const defaultRunnersHubURL = 'https://runnershub.krultra.no'
const defaultRunnersHubURL = 'https://runnershub.krultra.no'
// const defaultArchiveURL = 'https://archive.krultra.no'
const defaultArchiveURL = 'https://krultra.no'


// Base URL for the krultra.no website
export const KRULTRA_URL = process.env.REACT_APP_KRULTRA_URL || defaultKrUltraURL;

// Base URL for RunnersHub (self-reference for absolute URLs if needed)
export const RUNNERSHUB_URL = process.env.REACT_APP_RUNNERSHUB_URL || defaultRunnersHubURL;

// Archive URL for the old Drupal site
export const ARCHIVE_URL = process.env.REACT_APP_ARCHIVE_URL || defaultArchiveURL;

/**
 * Build a krultra.no URL for a specific path.
 * @param path - Path without leading slash (e.g., "events/KUTC", "kutc")
 */
export function getKrultraUrl(path?: string): string {
  if (!path) return KRULTRA_URL;
  return `${KRULTRA_URL}/${path}`;
}

/**
 * Build a RunnersHub URL for a specific path.
 * @param path - Path without leading slash (e.g., "kutc-2026", "mo/results")
 */
export function getRunnersHubUrl(path?: string): string {
  if (!path) return RUNNERSHUB_URL;
  return `${RUNNERSHUB_URL}/${path}`;
}
