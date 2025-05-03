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
exports.lastNoticePendingRegistrations = void 0;
const functions = __importStar(require("firebase-functions"));
const firestore_1 = require("firebase-admin/firestore");
const admin_1 = require("../utils/admin");
const schedules_1 = require("../config/schedules");
/**
 * Scheduled Cloud Function: last notice for pending registrations >=7 days & 1 reminder sent
 */
exports.lastNoticePendingRegistrations = functions.pubsub
    .schedule(schedules_1.CRON_LAST_NOTICE) // uses centralized schedule config
    .timeZone('Europe/Oslo')
    .onRun(async () => {
    console.log('[lastNoticePendingRegistrations] triggered');
    const sevenDaysAgo = firestore_1.Timestamp.fromDate(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000));
    const snap = await admin_1.db.collection('registrations')
        .where('status', '==', 'pending')
        .where('createdAt', '<=', sevenDaysAgo)
        .get();
    const due = snap.docs.filter(d => {
        const data = d.data();
        const requests = data.actionRequests || [];
        const reminders = data.remindersSent || 0;
        const lastNotices = data.lastNoticesSent || 0;
        return reminders >= 1 && lastNotices === 0 && !requests.includes('sendLastNotice');
    });
    const today = new Date().toISOString().slice(0, 10);
    await admin_1.db.collection('dailyJobLogs').doc(today)
        .collection('lastNoticePendingRegistrations')
        .add({ count: due.length, ids: due.map(d => d.id), timestamp: firestore_1.FieldValue.serverTimestamp() });
    console.log('[lastNoticePendingRegistrations] recorded run info');
    if (!due.length) {
        console.log('[lastNoticePendingRegistrations] no records to process');
        return null;
    }
    await Promise.all(due.map(d => {
        const actionType = 'sendLastNotice';
        const p1 = admin_1.db.collection('actionRequests').add({
            registrationId: d.id,
            email: d.data().email,
            type: 'sendLastNotice',
            reason: 'Pending >7d & 1 reminder sent',
            createdAt: firestore_1.FieldValue.serverTimestamp(),
            status: 'pending'
        });
        const p2 = admin_1.db.collection('registrations').doc(d.id).update({ actionRequests: firestore_1.FieldValue.arrayUnion(actionType) });
        return Promise.all([p1, p2]);
    }));
    console.log('[lastNoticePendingRegistrations] enqueued sendLastNotice for ids=', due.map(d => d.id));
    console.log('[lastNoticePendingRegistrations] completed');
    return null;
});
