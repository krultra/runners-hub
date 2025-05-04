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
exports.sendDailySummary = void 0;
const functions = __importStar(require("firebase-functions"));
const admin = __importStar(require("firebase-admin"));
const firestore_1 = require("firebase-admin/firestore");
const schedules_1 = require("../config/schedules");
const db = admin.firestore();
/**
 * Scheduled Cloud Function: send daily job summary to admins
 */
exports.sendDailySummary = functions.pubsub
    .schedule(schedules_1.CRON_SEND_DAILY) // uses centralized schedule config
    .timeZone('Europe/Oslo')
    .onRun(async () => {
    console.log('[sendDailySummary] triggered');
    const today = new Date().toISOString().slice(0, 10);
    console.log('[sendDailySummary] today=', today);
    // Define keys matching dailyJobLogs subcollections
    const jobKeys = [
        { key: 'expirePendingRegistrations', label: 'Expired Registrations' },
        { key: 'lastNoticePendingRegistrations', label: 'Last Notices' },
        { key: 'reminderPendingRegistrations', label: 'Reminders' },
        { key: 'expireWaitinglistRegistrations', label: 'Waiting-list Expirations' }
    ];
    // Sum counts from each log entry instead of counting docs
    const results = await Promise.all(jobKeys.map(async ({ key, label }) => {
        const snap = await db.collection('dailyJobLogs')
            .doc(today).collection(key).get();
        const count = snap.docs.reduce((sum, d) => sum + (d.data().count || 0), 0);
        return { label, count };
    }));
    let html = `<h1>Daily Summary for ${today}</h1>`;
    console.log('[sendDailySummary] html=', html);
    results.forEach(r => { html += `<p>${r.label}: ${r.count}</p>`; });
    // extra statistics
    const actionRequestsSnap = await db.collection('actionRequests').where('status', '==', 'pending').get();
    const regSnap = await db.collection('registrations').get();
    const regsData = regSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    const participants = regsData.filter(r => !r.isOnWaitinglist);
    const participantsPending = participants.filter(r => r.status === 'pending').length;
    const participantsConfirmed = participants.filter(r => r.status === 'confirmed').length;
    const waitingList = regsData.filter(r => r.isOnWaitinglist);
    const waitingPending = waitingList.filter(r => r.status === 'pending').length;
    const waitingConfirmed = waitingList.filter(r => r.status === 'confirmed').length;
    const cancelledCount = regsData.filter(r => r.status === 'cancelled').length;
    const expiredCount = regsData.filter(r => r.status === 'expired').length;
    const paymentsReceived = regsData.reduce((sum, r) => sum + (r.paymentMade || 0), 0);
    const outstandingClaims = regsData.reduce((sum, r) => sum + Math.max(0, (r.paymentRequired || 0) - (r.paymentMade || 0)), 0);
    const pendingWithReminder = regsData.filter(r => (r.remindersSent || 0) > 0 && (r.lastNoticesSent || 0) === 0).length;
    const pendingWithLastNotice = regsData.filter(r => (r.lastNoticesSent || 0) > 0).length;
    html += '<h2>Action Requests Pending</h2>';
    html += '<table border="1" cellpadding="4"><thead><tr><th>Created</th><th>Type</th><th>#</th><th>Name</th></tr></thead><tbody>';
    actionRequestsSnap.docs.forEach(doc => {
        const data = doc.data();
        const created = data.createdAt?.toDate().toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
        const reg = regsData.find(r => r.id === data.registrationId);
        const number = reg?.registrationNumber || data.registrationId;
        const name = reg ? `${reg.firstName} ${reg.lastName}` : '';
        html += `<tr><td>${created}</td><td>${data.type}</td><td>${number}</td><td>${name}</td></tr>`;
    });
    html += '</tbody></table>';
    html += `<h2>Registration Stats</h2>`;
    html += `<p>Participants - Pending: ${participantsPending}, Confirmed: ${participantsConfirmed}, Total: ${participants.length}</p>`;
    html += `<p>Waiting-list - Pending: ${waitingPending}, Confirmed: ${waitingConfirmed}, Total: ${waitingList.length}</p>`;
    html += `<p>Cancelled: ${cancelledCount}, Expired: ${expiredCount}</p>`;
    html += `<h2>Payments</h2>`;
    html += `<p>Received: ${paymentsReceived}, Outstanding: ${outstandingClaims}</p>`;
    html += `<h2>Reminder Status</h2>`;
    html += `<p>Reminder only (no last notice): ${pendingWithReminder}</p>`;
    html += `<p>With last notice: ${pendingWithLastNotice}</p>`;
    html += '<p><a href="https://runnershub.krultra.no/admin">Admin Panel</a></p>';
    // fetch admin users from users collection
    const adminSnap = await db.collection('users').where('isAdmin', '==', true).get();
    console.log('[sendDailySummary] admin users count=', adminSnap.size);
    console.log('[sendDailySummary] admin user data=', adminSnap.docs.map(d => d.data()));
    const admins = adminSnap.docs.map(a => a.data().email).filter(Boolean);
    console.log('[sendDailySummary] admin emails=', admins);
    console.log('[sendDailySummary] sending emails to count=', admins.length);
    await Promise.all(admins.map(email => db.collection('mail').add({
        to: email,
        message: { subject: `Daily Summary ${today}`, html },
        type: 'admin_summary',
        createdAt: firestore_1.FieldValue.serverTimestamp()
    })));
    console.log('[sendDailySummary] completed');
    return null;
});
