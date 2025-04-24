// Event configuration for email templates and registration context
export const EVENT_NAME = "Kruke's Ultra-Trail Challenge";
export const EVENT_SHORT_NAME = "KUTC";
export const EVENT_EDITION = "2025";
// Slug used in document IDs (e.g. kutc_2025)
export const EVENT_SHORT_NAME_SLUG = EVENT_SHORT_NAME.toLowerCase().replace(/\s+/g, '_');
export const EVENT_EDITION_ID = `${EVENT_SHORT_NAME_SLUG}_${EVENT_EDITION}`;
