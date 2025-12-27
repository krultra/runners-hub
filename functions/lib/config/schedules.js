"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CRON_SEND_DAILY = exports.CRON_REMINDER_PENDING = exports.CRON_LAST_NOTICE = exports.CRON_EXPIRE_PENDING = exports.CRON_EXPIRE_WAITINGLIST = void 0;
// Centralized cron schedules for scheduled functions (fallback defaults)
const getCron = (envKey, fallback) => {
    const value = process.env[envKey];
    return typeof value === 'string' && value.trim().length > 0 ? value.trim() : fallback;
};
exports.CRON_EXPIRE_WAITINGLIST = getCron('CRON_EXPIRE_WAITINGLIST', '00 18 * 3-9 *');
exports.CRON_EXPIRE_PENDING = getCron('CRON_EXPIRE_PENDING', '01 18 * 3-9 *');
exports.CRON_LAST_NOTICE = getCron('CRON_LAST_NOTICE_PENDING', '02 18 * 3-9 *');
exports.CRON_REMINDER_PENDING = getCron('CRON_REMINDER_PENDING', '03 18 * 3-9 *');
exports.CRON_SEND_DAILY = getCron('CRON_SEND_DAILY_SUMMARY', '04 18 * 3-9 *');
