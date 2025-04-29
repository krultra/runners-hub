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
exports.lastNoticePendingRegistrations = exports.reminderPendingRegistrations = exports.expirePendingRegistrations = void 0;
const functions = __importStar(require("firebase-functions"));
const admin = __importStar(require("firebase-admin"));
const firestore_1 = require("firebase-admin/firestore");
// Initialize the Firebase Admin SDK
admin.initializeApp();
const db = admin.firestore();
/**
 * Scheduled Cloud Function: expires pending registrations older than 8 days and 2 reminders sent.
 */
exports.expirePendingRegistrations = functions.pubsub
    .schedule('every 24 hours')
    .onRun(async () => {
    const eightDaysAgo = firestore_1.Timestamp.fromDate(new Date(Date.now() - 8 * 24 * 60 * 60 * 1000));
    const snap = await db.collection('registrations')
        .where('status', '==', 'pending')
        .where('createdAt', '<=', eightDaysAgo)
        .get();
    const due = snap.docs.filter(d => {
        const data = d.data();
        const requests = data.actionRequests || [];
        return data.remindersSent === 2 && !requests.includes('expireRegistration');
    });
    if (!due.length)
        return null;
    // enqueue action requests
    await Promise.all(due.map(d => {
        const actionType = 'expireRegistration';
        const p1 = db.collection('actionRequests').add({
            registrationId: d.id,
            email: d.data().email,
            type: 'expireRegistration',
            reason: 'Pending >8d & 2 reminders sent',
            createdAt: firestore_1.FieldValue.serverTimestamp(),
            status: 'pending'
        });
        const p2 = db.collection('registrations').doc(d.id).update({
            actionRequests: firestore_1.FieldValue.arrayUnion(actionType)
        });
        return Promise.all([p1, p2]);
    }));
    // summary to admins
    const adminSnap = await db.collection('admins').get();
    const admins = adminSnap.docs.map(a => a.data().email).filter(Boolean);
    const summary = due.map(d => `${d.id} (${d.data().email})`).join(', ');
    await Promise.all(admins.map(email => db.collection('mail').add({
        to: email,
        message: { subject: 'Action Requests Summary', html: `<p>Expire regs: ${summary}</p>` },
        type: 'admin_summary',
        createdAt: firestore_1.FieldValue.serverTimestamp()
    })));
    return null;
});
// Scheduled Cloud Function: send reminder for pending registrations older than 5 days and no reminders sent
exports.reminderPendingRegistrations = functions.pubsub
    .schedule('* * * * *')
    .onRun(async () => {
    const fiveDaysAgo = firestore_1.Timestamp.fromDate(new Date(Date.now() - 5 * 24 * 60 * 60 * 1000));
    const snap = await db.collection('registrations')
        .where('status', '==', 'pending')
        .where('createdAt', '<=', fiveDaysAgo)
        .get();
    const due = snap.docs.filter(d => {
        const data = d.data();
        const requests = data.actionRequests || [];
        return !data.remindersSent && !requests.includes('sendReminder');
    });
    if (!due.length)
        return null;
    await Promise.all(due.map(d => {
        const actionType = 'sendReminder';
        const p1 = db.collection('actionRequests').add({
            registrationId: d.id,
            email: d.data().email,
            type: 'sendReminder',
            reason: 'Pending >5d & no reminders',
            createdAt: firestore_1.FieldValue.serverTimestamp(),
            status: 'pending'
        });
        const p2 = db.collection('registrations').doc(d.id).update({
            actionRequests: firestore_1.FieldValue.arrayUnion(actionType)
        });
        return Promise.all([p1, p2]);
    }));
    const adminSnap = await db.collection('admins').get();
    const admins = adminSnap.docs.map(a => a.data().email).filter(Boolean);
    const summary = due.map(d => `${d.id} (${d.data().email})`).join(', ');
    await Promise.all(admins.map(email => db.collection('mail').add({
        to: email,
        message: { subject: 'Action Requests Summary', html: `<p>Send reminders: ${summary}</p>` },
        type: 'admin_summary',
        createdAt: firestore_1.FieldValue.serverTimestamp()
    })));
    return null;
});
// Scheduled Cloud Function: last notice for pending registrations >=7 days & 1 reminder sent
exports.lastNoticePendingRegistrations = functions.pubsub
    .schedule('* * * * *')
    .onRun(async () => {
    const sevenDaysAgo = firestore_1.Timestamp.fromDate(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000));
    const snap = await db.collection('registrations')
        .where('status', '==', 'pending')
        .where('createdAt', '<=', sevenDaysAgo)
        .get();
    const due = snap.docs.filter(d => {
        const data = d.data();
        const requests = data.actionRequests || [];
        return data.remindersSent === 1 && !requests.includes('sendLastNotice');
    });
    if (!due.length)
        return null;
    await Promise.all(due.map(d => {
        const actionType = 'sendLastNotice';
        const p1 = db.collection('actionRequests').add({
            registrationId: d.id,
            email: d.data().email,
            type: 'sendLastNotice',
            reason: 'Pending >7d & 1 reminder sent',
            createdAt: firestore_1.FieldValue.serverTimestamp(),
            status: 'pending'
        });
        const p2 = db.collection('registrations').doc(d.id).update({
            actionRequests: firestore_1.FieldValue.arrayUnion(actionType)
        });
        return Promise.all([p1, p2]);
    }));
    const adminSnap = await db.collection('admins').get();
    const admins = adminSnap.docs.map(a => a.data().email).filter(Boolean);
    const summary = due.map(d => `${d.id} (${d.data().email})`).join(', ');
    await Promise.all(admins.map(email => db.collection('mail').add({
        to: email,
        message: { subject: 'Action Requests Summary', html: `<p>Last notices: ${summary}</p>` },
        type: 'admin_summary',
        createdAt: firestore_1.FieldValue.serverTimestamp()
    })));
    return null;
});
