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
exports.expiresWaitinglistRegistrations = void 0;
const functions = __importStar(require("firebase-functions"));
const admin = __importStar(require("firebase-admin"));
const firestore_1 = require("firebase-admin/firestore");
const db = admin.firestore();
/**
 * Scheduled Cloud Function: expires waiting-list registrations with waitinglistExpires <= now
 */
exports.expiresWaitinglistRegistrations = functions.pubsub
    .schedule('19 23 * * *') // daily at 23:19
    .timeZone('Europe/Oslo')
    .onRun(async () => {
    console.log('[expiresWaitinglistRegistrations] triggered');
    const now = firestore_1.Timestamp.now();
    const snap = await db.collection('registrations')
        .where('isOnWaitinglist', '==', true)
        .where('waitinglistExpires', '<=', now)
        .get();
    const due = snap.docs;
    console.log('[expiresWaitinglistRegistrations] found due count=', due.length, 'ids=', due.map(d => d.id));
    // record run info
    const today = new Date().toISOString().slice(0, 10);
    await db.collection('dailyJobLogs').doc(today)
        .collection('expiresWaitinglistRegistrations')
        .add({ count: due.length, ids: due.map(d => d.id), timestamp: firestore_1.FieldValue.serverTimestamp() });
    if (!due.length) {
        console.log('[expiresWaitinglistRegistrations] no waiting-list registrations to expire');
        return null;
    }
    // expire and notify each
    await Promise.all(due.map(async (d) => {
        const data = d.data();
        await db.collection('registrations').doc(d.id).update({ status: 'expired' });
        // send expiration email
        await db.collection('mail').add({
            to: data.email,
            message: {
                subject: 'Registration Expired',
                html: `Your waiting-list registration ${data.registrationNumber} has expired.`
            },
            type: 'registration_expiration',
            createdAt: firestore_1.FieldValue.serverTimestamp()
        });
    }));
    console.log('[expiresWaitinglistRegistrations] processed expirations');
    // summary email to admin users
    const adminSnap = await db.collection('users').where('isAdmin', '==', true).get();
    const admins = adminSnap.docs.map(a => a.data().email).filter(Boolean);
    const summary = due.map(d => `${d.id} (${d.data().email})`).join(', ');
    await Promise.all(admins.map(email => db.collection('mail').add({
        to: email,
        message: { subject: `Waiting-list Expirations ${today}`, html: `<p>Expired waiting-list regs: ${summary}</p>` },
        type: 'admin_summary',
        createdAt: firestore_1.FieldValue.serverTimestamp()
    })));
    console.log('[expiresWaitinglistRegistrations] summary emails sent');
    return null;
});
