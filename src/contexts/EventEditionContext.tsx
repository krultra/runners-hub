import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { getEventEdition } from '../services/eventEditionService';

const LAST_EVENT_KEY = 'runnershub_last_event_id';

export interface Fees {
  participation?: number;
  oneTimeLicense?: number;
  service?: number;
  baseCamp?: number;  // @deprecated - use service
  deposit?: number;
  total?: number;
}

/**
 * Configuration for which fields to show in the registration form.
 * This allows different events to have different registration requirements.
 */
 export interface RegistrationConfig {
  fields: {
    // Personal info fields - always shown: firstName, lastName, dateOfBirth, nationality, email, phone
    representing?: boolean;      // Show "representing" field (club/team) - default true
    travelRequired?: boolean;    // Show travel/logistics question - default false
    comments?: boolean;          // Show comments field - default true
  };
  // License is determined by fees.oneTimeLicense > 0, not by config
}

export interface RaceDistance {
  id: string;
  displayName: string;
  displayName_no?: string;
  displayName_en?: string;
  length: number;
  ascent: number;
  descent: number;
  active?: boolean;
  fee?: number;  // @deprecated - use fees.participation
  fees?: Fees;
  startTime?: any; // Firestore Timestamp
  maxParticipants?: number;
}

// Default registration config - used when event doesn't specify one
export const DEFAULT_REGISTRATION_CONFIG: RegistrationConfig = {
  fields: {
    representing: true,
    travelRequired: false,
    comments: true,
  }
};

export interface CurrentEvent {
  id: string;
  eventId: string;
  edition: number;
  eventShortName: string;
  eventName: string;
  status: string;
  resultTypes: string[];
  resultsStatus: string;
  resultURL?: string;
  liveResultsURL?: string;
  startTime: Date;
  endTime: Date;
  registrationOpens: Date | null;
  registrationDeadline: Date | null;
  maxParticipants?: number;
  loopDistance?: number;
  raceDistances?: RaceDistance[];
  fees: Fees & {
    participation: number;
    baseCamp: number;
    deposit: number;
    total: number;
  };
  registrationConfig?: RegistrationConfig;
}

interface EventContextValue {
  event: CurrentEvent | null;
  loading: boolean;
  error: Error | null;
  setEvent: (event: Partial<CurrentEvent> | string | null) => Promise<void>;
}

const EventEditionContext = createContext<EventContextValue>({
  event: null,
  loading: true,
  error: null,
  setEvent: async () => { return; } // Default no-op async function
});

export const EventEditionProvider = ({ children }: { children: React.ReactNode }) => {
  const [event, setEventState] = useState<CurrentEvent | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // Restore last event from localStorage on mount
  useEffect(() => {
    const restoreLastEvent = async () => {
      try {
        const lastEventId = localStorage.getItem(LAST_EVENT_KEY);
        if (lastEventId) {
          console.log('Restoring last event from localStorage:', lastEventId);
          await setEvent(lastEventId);
        }
      } catch (err) {
        console.error('Failed to restore last event:', err);
      } finally {
        setLoading(false);
      }
    };
    restoreLastEvent();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setEvent = useCallback(async (eventData: Partial<CurrentEvent> | string | null) => {
    if (eventData === null) {
      setEventState(null);
      localStorage.removeItem(LAST_EVENT_KEY);
      return;
    }

    try {
      setLoading(true);
      
      if (typeof eventData === 'string') {
        // If a string is passed, treat it as an event ID
        const data = await getEventEdition(eventData);
        const convertTimestamp = (timestamp: any) => {
          if (!timestamp) return null;
          if (timestamp instanceof Date) return timestamp;
          if (typeof timestamp.toDate === 'function') return timestamp.toDate();
          return timestamp; // Fallback in case it's something else
        };

        const eventState = {
          ...data,
          startTime: convertTimestamp(data.startTime),
          endTime: convertTimestamp(data.endTime),
          registrationOpens: convertTimestamp(data.registrationOpens),
          registrationDeadline: convertTimestamp(data.registrationDeadline),
          raceDistances: data.raceDistances || [],
          fees: data.fees ?? { participation: 0, baseCamp: 0, deposit: 0, total: 0 },
        };
        setEventState(eventState);
        // Save to localStorage for restoration on refresh
        localStorage.setItem(LAST_EVENT_KEY, eventData);
      } else {
        // If an object is passed, update the event state
        setEventState(prev => prev ? { ...prev, ...eventData } as CurrentEvent : eventData as CurrentEvent);
        // Save ID if available
        if ((eventData as CurrentEvent).id) {
          localStorage.setItem(LAST_EVENT_KEY, (eventData as CurrentEvent).id);
        }
      }
    } catch (err) {
      setError(err as Error);
      throw err; // Re-throw to allow components to handle the error
    } finally {
      setLoading(false);
    }
  }, []);


  return (
    <EventEditionContext.Provider value={{ event, loading, error, setEvent }}>
      {children}
    </EventEditionContext.Provider>
  );
};

export const useEventEdition = () => useContext(EventEditionContext);
