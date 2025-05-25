import React, { createContext, useContext, useState, useCallback } from 'react';
import { getEventEdition } from '../services/eventEditionService';

export interface RaceDistance {
  id: string;
  displayName: string;
  length: number;
  ascent: number;
  descent: number;
}

export interface CurrentEvent {
  id: string;
  eventId: string;
  edition: number;
  eventShortName: string;
  eventName: string;
  status: string;
  resultTypes: string[];
  resultsStatus: string;
  startTime: Date;
  endTime: Date;
  registrationDeadline: Date | null;
  maxParticipants?: number;
  loopDistance?: number;
  raceDistances?: RaceDistance[];
  fees: {
    participation: number;
    baseCamp: number;
    deposit: number;
    total: number;
  };
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

  const setEvent = useCallback(async (eventData: Partial<CurrentEvent> | string | null) => {
    if (eventData === null) {
      setEventState(null);
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

        setEventState({
          ...data,
          startTime: convertTimestamp(data.startTime),
          endTime: convertTimestamp(data.endTime),
          registrationDeadline: convertTimestamp(data.registrationDeadline),
          raceDistances: data.raceDistances || [],
          fees: data.fees ?? { participation: 0, baseCamp: 0, deposit: 0, total: 0 },
        });
      } else {
        // If an object is passed, update the event state
        setEventState(prev => prev ? { ...prev, ...eventData } as CurrentEvent : eventData as CurrentEvent);
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
