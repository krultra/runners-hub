// Event and edition constants
export const EVENTS = {
  KUTC: {
    id: 'kutc',
    name: "Kruke's Ultra-Trail Challenge",
    description: 'A challenging trail running event in the beautiful mountains of Norway'
  }
};

export const EDITIONS = {
  KUTC_2025: {
    id: 'kutc-2025',
    eventId: EVENTS.KUTC.id,
    name: "Kruke's Ultra-Trail Challenge 2025",
    year: 2025
  }
};

// Current edition being used throughout the application
export const CURRENT_EDITION_ID = EDITIONS.KUTC_2025.id;
