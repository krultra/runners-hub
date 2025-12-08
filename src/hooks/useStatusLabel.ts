import { useTranslation } from 'react-i18next';

// Map status codes to translation keys
const STATUS_KEY_MAP: Record<string, string> = {
  hidden: 'status.hidden',
  draft: 'status.draft',
  announced: 'status.announced',
  pre_registration: 'status.preRegistration',
  open: 'status.open',
  waitlist: 'status.waitlist',
  late_registration: 'status.lateRegistration',
  full: 'status.full',
  closed: 'status.closed',
  in_progress: 'status.inProgress',
  suspended: 'status.suspended',
  finished: 'status.finished',
  cancelled: 'status.cancelled',
  finalized: 'status.finalized',
};

/**
 * Hook to get a translated status label for an event status code
 */
export function useStatusLabel(statusCode: string | undefined): string {
  const { t } = useTranslation();

  if (!statusCode) {
    return t('status.pending');
  }

  const normalizedCode = String(statusCode).toLowerCase();
  const translationKey = STATUS_KEY_MAP[normalizedCode];

  if (translationKey) {
    return t(translationKey);
  }

  // Fallback to the raw status code if no translation found
  return statusCode;
}

export default useStatusLabel;
