import * as functions from 'firebase-functions';

// Centralized cron schedules for scheduled functions (fallback defaults)
export const CRON_EXPIRE_WAITINGLIST = functions.config().schedule?.expire_waitinglist || '00 18 * 3-9 *';
export const CRON_EXPIRE_PENDING    = functions.config().schedule?.expire_pending    || '01 18 * 3-9 *';
export const CRON_LAST_NOTICE       = functions.config().schedule?.last_notice_pending || '02 18 * 3-9 *';
export const CRON_REMINDER_PENDING  = functions.config().schedule?.reminder_pending   || '03 18 * 3-9 *';
export const CRON_SEND_DAILY        = functions.config().schedule?.send_daily_summary|| '04 18 * 3-9 *';
