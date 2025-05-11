// Event-specific constants (stub values)
export const CURRENT_EDITION_ID = '';

// Race distances available for registration
export interface RaceDistance {
  id: string;
  displayName: string;
}
export const RACE_DISTANCES: RaceDistance[] = [];

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
