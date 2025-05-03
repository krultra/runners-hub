"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CRON_SEND_DAILY = exports.CRON_REMINDER_PENDING = exports.CRON_LAST_NOTICE = exports.CRON_EXPIRE_PENDING = exports.CRON_EXPIRE_WAITINGLIST = void 0;
const functions = __importStar(require("firebase-functions"));
// Centralized cron schedules for scheduled functions (fallback defaults)
exports.CRON_EXPIRE_WAITINGLIST = functions.config().schedule?.expire_waitinglist || '00 18 * 3-9 *';
exports.CRON_EXPIRE_PENDING = functions.config().schedule?.expire_pending || '01 18 * 3-9 *';
exports.CRON_LAST_NOTICE = functions.config().schedule?.last_notice_pending || '02 18 * 3-9 *';
exports.CRON_REMINDER_PENDING = functions.config().schedule?.reminder_pending || '03 18 * 3-9 *';
exports.CRON_SEND_DAILY = functions.config().schedule?.send_daily_summary || '04 18 * 3-9 *';
