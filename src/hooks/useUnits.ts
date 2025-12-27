import { useEffect, useSyncExternalStore } from 'react';
import type { UnitSystem } from '../utils/units';

// Simple pub/sub for same-window updates
const listeners = new Set<() => void>();
function subscribe(callback: () => void) {
  listeners.add(callback);
  return () => listeners.delete(callback);
}
function getSnapshot(): UnitSystem {
  const stored = localStorage.getItem('pref_units');
  return stored === 'mi' ? 'imperial' : 'metric';
}
function getServerSnapshot(): UnitSystem {
  return 'metric';
}

// Notify all listeners when units change
export function notifyUnitsChange() {
  listeners.forEach((listener) => listener());
}

/**
 * Hook to get the user's preferred unit system from localStorage.
 * Returns 'metric' by default until client-side hydration completes.
 * Automatically updates when the preference changes.
 */
export function useUnits(): UnitSystem {
  const units = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  useEffect(() => {
    // Listen for storage changes from other tabs
    const handleStorage = (e: StorageEvent) => {
      if (e.key === 'pref_units') {
        notifyUnitsChange();
      }
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  return units;
}
