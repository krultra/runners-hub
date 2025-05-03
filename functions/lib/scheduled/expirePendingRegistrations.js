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
exports.expirePendingRegistrations = void 0;
const functions = __importStar(require("firebase-functions"));
const firestore_1 = require("firebase-admin/firestore");
const admin_1 = require("../utils/admin");
const schedules_1 = require("../config/schedules");
/**
 * Scheduled Cloud Function: expires pending registrations older than 9 days and 2 reminders sent.
 */
exports.expirePendingRegistrations = functions.pubsub
    .schedule(schedules_1.CRON_EXPIRE_PENDING) // uses centralized config
    .timeZone('Europe/Oslo')
    .onRun(async () => {
    console.log('[expirePendingRegistrations] triggered');
    const nineDaysAgo = firestore_1.Timestamp.fromDate(new Date(Date.now() - 9 * 24 * 60 * 60 * 1000));
    const snap = await admin_1.db.collection('registrations')
        .where('status', '==', 'pending')
        .where('createdAt', '<=', nineDaysAgo)
        .get();
    const due = snap.docs.filter(d => {
        const data = d.data();
        const requests = data.actionRequests || [];
        return data.remindersSent === 1 && data.lastNoticesSent === 1 && !requests.includes('expireRegistration');
    });
    console.log('[expirePendingRegistrations] found due count=', due.length, 'ids=', due.map(d => d.id));
    // record run info regardless of matches
    const today = new Date().toISOString().slice(0, 10);
    await admin_1.db.collection('dailyJobLogs').doc(today)
        .collection('expirePendingRegistrations')
        .add({ count: due.length, ids: due.map(d => d.id), timestamp: firestore_1.FieldValue.serverTimestamp() });
    if (!due.length) {
        console.log('[expirePendingRegistrations] no matching registrations to expire');
        console.log('[expirePendingRegistrations] completed');
        return null;
    }
    await Promise.all(due.map(d => {
        const actionType = 'expireRegistration';
        const p1 = admin_1.db.collection('actionRequests').add({
            registrationId: d.id,
            email: d.data().email,
            type: 'expireRegistration',
            reason: 'Pending >9d & 2 reminders sent',
            createdAt: firestore_1.FieldValue.serverTimestamp(),
            status: 'pending'
        });
        const p2 = admin_1.db.collection('registrations').doc(d.id).update({
            actionRequests: firestore_1.FieldValue.arrayUnion(actionType)
        });
        return Promise.all([p1, p2]);
    }));
    console.log('[expirePendingRegistrations] enqueued expireRegistration for ids=', due.map(d => d.id));
    console.log('[expirePendingRegistrations] completed');
    return null;
});
