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
const db = admin.firestore();
/**
 * Scheduled Cloud Function: send daily job summary to admins
 */
exports.sendDailySummary = functions.pubsub
    .schedule('23 23 * * *') // daily at 22:53
    .timeZone('Europe/Oslo')
    .onRun(async () => {
    console.log('[sendDailySummary] triggered');
    const today = new Date().toISOString().slice(0, 10);
    console.log('[sendDailySummary] today=', today);
    const jobKeys = [
        { key: 'expirePendingRegistrations', label: 'Expired Registrations' },
        { key: 'lastNoticePendingRegistrations', label: 'Last Notices' },
        { key: 'reminderPendingRegistrations', label: 'Reminders' },
        { key: 'expiresWaitinglistRegistrations', label: 'Waiting-list Expirations' }
    ];
    const results = await Promise.all(jobKeys.map(async ({ key, label }) => {
        const snap = await db.collection('dailyJobLogs')
            .doc(today).collection(key).get();
        return { label, count: snap.size };
    }));
    let html = `<h1>Daily Job Summary for ${today}</h1>`;
    console.log('[sendDailySummary] html=', html);
    results.forEach(r => { html += `<p>${r.label}: ${r.count}</p>`; });
    const adminSnap = await db.collection('admins').get();
    console.log('[sendDailySummary] admin docs count=', adminSnap.size);
    console.log('[sendDailySummary] admin docs data=', adminSnap.docs.map(d => d.data()));
    // use userId as admin email
    const admins = adminSnap.docs.map(a => a.data().userId).filter(Boolean);
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
