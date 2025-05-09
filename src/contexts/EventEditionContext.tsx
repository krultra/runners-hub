import React, { createContext, useContext, useState, useEffect } from 'react';
import { listEventEditions, getEventEdition } from '../services/eventEditionService';

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
  setEvent: (event: Partial<CurrentEvent>) => void;
}

const EventEditionContext = createContext<EventContextValue>({
  event: null,
  loading: true,
  error: null,
  setEvent: () => {}, // Default no-op function
});

export const EventEditionProvider = ({ children }: { children: React.ReactNode }) => {
  const [event, setEventState] = useState<CurrentEvent | null>(null);
  
  // Wrapper function to handle partial updates
  const setEvent = async (eventData: Partial<CurrentEvent>) => {
    if (eventData.id) {
      try {
        setLoading(true);
        // If we only have an ID, fetch the full event data
        if (Object.keys(eventData).length === 1) {
          const data = await getEventEdition(eventData.id);
          const { startTime, endTime, registrationDeadline, fees, ...rest } = data;
          setEventState({
            ...rest,
            startTime: startTime.toDate(),
            endTime: endTime.toDate(),
            registrationDeadline: registrationDeadline ? registrationDeadline.toDate() : null,
            fees: fees ?? { participation: 0, baseCamp: 0, deposit: 0, total: 0 },
          });
        } else {
          // If we have more data, just update the state
          setEventState(prev => {
            if (prev === null) {
              return eventData as CurrentEvent;
            }
            return { ...prev, ...eventData } as CurrentEvent;
          });
        }
      } catch (err: any) {
        setError(err);
      } finally {
        setLoading(false);
      }
    }
  };
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const summaries = await listEventEditions();
        if (!mounted) return;
        if (summaries.length === 0) throw new Error('No event editions found');
        // pick the last (latest) edition
        const latest = summaries[summaries.length - 1];
        const data = await getEventEdition(latest.id);
        if (!mounted) return;
        const { startTime, endTime, registrationDeadline, fees, ...rest } = data;
        setEvent({
          ...rest,
          startTime: startTime.toDate(),
          endTime: endTime.toDate(),
          registrationDeadline: registrationDeadline ? registrationDeadline.toDate() : null,
          fees: fees ?? { participation: 0, baseCamp: 0, deposit: 0, total: 0 },
        });
      } catch (err: any) {
        if (!mounted) return;
        setError(err);
      } finally {
        if (!mounted) return;
        setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  return (
    <EventEditionContext.Provider value={{ event, loading, error, setEvent }}>
      {children}
    </EventEditionContext.Provider>
  );
};

export const useEventEdition = () => useContext(EventEditionContext);
