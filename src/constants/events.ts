// Event-specific constants (stub values)
export const CURRENT_EDITION_ID = '';

// Race distances available for registration
export interface RaceDistance {
  id: string;
  displayName: string;
}
export const RACE_DISTANCES: RaceDistance[] = [
  { id: '4-loops', displayName: '4 loops' },
  { id: '8-loops', displayName: '8 loops' },
  { id: '12-loops', displayName: '12 loops' },
  { id: '16-loops', displayName: '16 loops' },
  { id: '20-loops', displayName: '20 loops' },
  { id: '24-loops', displayName: '24 loops' }
];

// Current event details (stub values)
export const RACE_DETAILS = {
  date: new Date(),
  registrationDeadline: new Date(),
  maxParticipants: 0,
  loopDistance: 0,
  fees: {
    participation: 0,
    baseCamp: 0,
    deposit: 0,
    total: 0
  }
};
