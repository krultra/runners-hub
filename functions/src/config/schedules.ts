// Centralized cron schedules for scheduled functions (fallback defaults)
const getCron = (envKey: string, fallback: string): string => {
  const value = process.env[envKey];
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : fallback;
};

export const CRON_EXPIRE_WAITINGLIST = getCron('CRON_EXPIRE_WAITINGLIST', '00 18 * 3-9 *');
export const CRON_EXPIRE_PENDING = getCron('CRON_EXPIRE_PENDING', '01 18 * 3-9 *');
export const CRON_LAST_NOTICE = getCron('CRON_LAST_NOTICE_PENDING', '02 18 * 3-9 *');
export const CRON_REMINDER_PENDING = getCron('CRON_REMINDER_PENDING', '03 18 * 3-9 *');
export const CRON_SEND_DAILY = getCron('CRON_SEND_DAILY_SUMMARY', '04 18 * 3-9 *');
