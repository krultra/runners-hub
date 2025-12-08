import { Timestamp } from 'firebase/firestore';

export interface EventEdition {
  id: string;
  eventId: string;
  edition: number;
  eventName: string;
  status: string;
  startTime?: Timestamp | Date;
  endTime?: Timestamp | Date;
  registrationOpens?: Timestamp | Date;
  registrationDeadline?: Timestamp | Date;
  maxParticipants?: number;
  loopDistance?: number;
  raceDistances?: Array<{
    id: string;
    displayName: string;
    length: number;
    ascent: number;
    descent: number;
  }>;
  fees?: {
    participation: number;
    baseCamp: number;
    deposit: number;
    total: number;
  };
}

export interface EventSelectionProps {
  selectedEvent?: EventEdition | null;
  selectedEventId?: string;
}

export interface EventSelectionWithCallbackProps extends EventSelectionProps {
  onSelectEvent?: (edition: EventEdition) => void;
}
