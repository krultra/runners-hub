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
exports.reminderPendingRegistrations = void 0;
const functions = __importStar(require("firebase-functions"));
const firestore_1 = require("firebase-admin/firestore");
const admin_1 = require("../utils/admin");
const schedules_1 = require("../config/schedules");
/**
 * Scheduled Cloud Function: send reminder for pending registrations older than 5 days and no reminders sent
 */
exports.reminderPendingRegistrations = functions.pubsub
    .schedule(schedules_1.CRON_REMINDER_PENDING) // uses centralized schedule config
    .timeZone('Europe/Oslo')
    .onRun(async () => {
    console.log('[reminderPendingRegistrations] triggered');
    const fiveDaysAgo = firestore_1.Timestamp.fromDate(new Date(Date.now() - 5 * 24 * 60 * 60 * 1000));
    const snap = await admin_1.db.collection('registrations')
        .where('status', '==', 'pending')
        .where('createdAt', '<=', fiveDaysAgo)
        .get();
    const due = snap.docs.filter(d => {
        const data = d.data();
        const requests = data.actionRequests || [];
        const reminders = data.remindersSent || 0;
        const lastNotices = data.lastNoticesSent || 0;
        return reminders === 0 && lastNotices === 0 && !requests.includes('sendReminder');
    });
    console.log('[reminderPendingRegistrations] snap size=', snap.size, 'due count=', due.length, 'ids=', due.map(d => d.id));
    const today = new Date().toISOString().slice(0, 10);
    await admin_1.db.collection('dailyJobLogs').doc(today)
        .collection('reminderPendingRegistrations')
        .add({ count: due.length, ids: due.map(d => d.id), timestamp: firestore_1.FieldValue.serverTimestamp() });
    console.log('[reminderPendingRegistrations] recorded run info');
    if (!due.length) {
        console.log('[reminderPendingRegistrations] no records to process');
        return null;
    }
    await Promise.all(due.map(d => {
        const actionType = 'sendReminder';
        const p1 = admin_1.db.collection('actionRequests').add({
            registrationId: d.id,
            email: d.data().email,
            type: 'sendReminder',
            reason: 'Pending >5d & no reminders',
            createdAt: firestore_1.FieldValue.serverTimestamp(),
            status: 'pending'
        });
        const p2 = admin_1.db.collection('registrations').doc(d.id).update({ actionRequests: firestore_1.FieldValue.arrayUnion(actionType) });
        return Promise.all([p1, p2]);
    }));
    console.log('[reminderPendingRegistrations] enqueued sendReminder for ids=', due.map(d => d.id));
    console.log('[reminderPendingRegistrations] completed');
    return null;
});
