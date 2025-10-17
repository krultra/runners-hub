import { Timestamp } from 'firebase/firestore';
import { EventEdition } from '../services/eventEditionService';

export type DerivedStatus = 'hidden' | 'cancelled' | 'planned' | 'registration_open' | 'in_progress' | 'finished' | 'finalized';

const toDate = (v: any): Date | null => {
  if (!v) return null;
  if (v instanceof Date) return v;
  if (typeof (v as Timestamp).toDate === 'function') return (v as Timestamp).toDate();
  return null;
};

const toNumber = (v: any): number => {
  if (typeof v === 'number') return v;
  const n = parseInt(String(v ?? '').trim(), 10);
  return isNaN(n) ? -1 : n;
};

export function deriveStatus(ed: Partial<EventEdition>, now = new Date()): DerivedStatus {
  const start = toDate((ed as any).startTime);
  const end = toDate((ed as any).endTime);
  const statusStr = String((ed as any).status ?? '').toLowerCase();
  const statusNum = toNumber((ed as any).status);
  const resultStatus = (ed as any).resultsStatus || (ed as any).resultStatus || '';

  if (statusNum === 0 || statusStr.includes('hidden')) return 'hidden';
  if (statusNum === 90 || statusStr.includes('cancel')) return 'cancelled';
  if (statusNum === 100 || statusStr.includes('final')) return 'finalized';
  if (String(resultStatus).toLowerCase() === 'final') return 'finalized';

  if (end && now >= end) return 'finished';
  if (start && now >= start) return 'in_progress';

  // registration phases (published and visible states before the race)
  const registrationCodes = new Set([30, 40, 44, 50, 54, 60]);
  if (registrationCodes.has(statusNum)) return 'registration_open';

  return 'planned';
}
