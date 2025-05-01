import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { Timestamp, FieldValue } from 'firebase-admin/firestore';

// Initialize the Firebase Admin SDK
admin.initializeApp();

const db = admin.firestore();

/**
 * Scheduled Cloud Function: expires pending registrations older than 8 days and 2 reminders sent.
 */
export const expirePendingRegistrations = functions.pubsub
  .schedule('20 23 * * *') // daily at 22:50
  .timeZone('Europe/Oslo')
  .onRun(async () => {
    console.log('[expirePendingRegistrations] triggered');
    const eightDaysAgo = Timestamp.fromDate(new Date(Date.now() - 8 * 24 * 60 * 60 * 1000));
    const snap = await db.collection('registrations')
      .where('status', '==', 'pending')
      .where('createdAt', '<=', eightDaysAgo)
      .get();
    const due = snap.docs.filter(d => {
      const data = d.data();
      const requests = data.actionRequests || [];
      // trigger when exactly one reminder and one last notice sent
      return data.remindersSent === 1 && data.lastNoticesSent === 1 && !requests.includes('expireRegistration');
    });
    console.log('[expirePendingRegistrations] found due count=', due.length, 'ids=', due.map(d => d.id));
    if (!due.length) {
      console.log('[expirePendingRegistrations] no matching registrations to expire');
      return null;
    }
    // enqueue action requests
    await Promise.all(due.map(d => {
      const actionType = 'expireRegistration';
      const p1 = db.collection('actionRequests').add({
        registrationId: d.id,
        email: d.data().email,
        type: 'expireRegistration',
        reason: 'Pending >8d & 2 reminders sent',
        createdAt: FieldValue.serverTimestamp(),
        status: 'pending'
      });
      const p2 = db.collection('registrations').doc(d.id).update({
        actionRequests: FieldValue.arrayUnion(actionType)
      });
      return Promise.all([p1, p2]);
    }));
    console.log('[expirePendingRegistrations] enqueued expireRegistration for ids=', due.map(d => d.id));
    // summary to admins
    const adminSnap = await db.collection('users').where('isAdmin', '==', true).get();
    const admins = adminSnap.docs.map(a => (a.data() as any).email).filter(Boolean);
    const summary = due.map(d => `${d.id} (${d.data().email})`).join(', ');
    await Promise.all(admins.map(email => db.collection('mail').add({
      to: email,
      message: { subject: 'Action Requests Summary', html: `<p>Expire regs: ${summary}</p>` },
      type: 'admin_summary',
      createdAt: FieldValue.serverTimestamp()
    })));
    // record run info for summary
    const today = new Date().toISOString().slice(0,10);
    await db.collection('dailyJobLogs').doc(today)
      .collection('expirePendingRegistrations')
      .add({ count: due.length, ids: due.map(d => d.id), timestamp: FieldValue.serverTimestamp() });
    return null;
  });

// Scheduled Cloud Function: send reminder for pending registrations older than 5 days and no reminders sent
export const reminderPendingRegistrations = functions.pubsub
  .schedule('22 23 * * *') // daily at 22:52
  .timeZone('Europe/Oslo')
  .onRun(async () => {
    console.log('[reminderPendingRegistrations] triggered');
    const fiveDaysAgo = Timestamp.fromDate(new Date(Date.now() - 5 * 24 * 60 * 60 * 1000));
    const snap = await db.collection('registrations')
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
    const today = new Date().toISOString().slice(0,10);
    await db.collection('dailyJobLogs').doc(today)
      .collection('reminderPendingRegistrations')
      .add({ count: due.length, ids: due.map(d => d.id), timestamp: FieldValue.serverTimestamp() });
    console.log('[reminderPendingRegistrations] recorded run info');
    if (!due.length) {
      console.log('[reminderPendingRegistrations] no records to process');
      return null;
    }
    await Promise.all(due.map(d => {
      const actionType = 'sendReminder';
      const p1 = db.collection('actionRequests').add({
        registrationId: d.id,
        email: d.data().email,
        type: 'sendReminder',
        reason: 'Pending >5d & no reminders',
        createdAt: FieldValue.serverTimestamp(),
        status: 'pending'
      });
      const p2 = db.collection('registrations').doc(d.id).update({
        actionRequests: FieldValue.arrayUnion(actionType)
      });
      return Promise.all([p1, p2]);
    }));
    console.log('[reminderPendingRegistrations] enqueued sendReminder for ids=', due.map(d => d.id));
    const adminSnap = await db.collection('users').where('isAdmin', '==', true).get();
    const admins = adminSnap.docs.map(a => (a.data() as any).email).filter(Boolean);
    const summary = due.map(d => `${d.id} (${d.data().email})`).join(', ');
    await Promise.all(admins.map(email => db.collection('mail').add({
      to: email,
      message: { subject: 'Action Requests Summary', html: `<p>Send reminders: ${summary}</p>` },
      type: 'admin_summary',
      createdAt: FieldValue.serverTimestamp()
    })));
    return null;
  });

// Scheduled Cloud Function: last notice for pending registrations >=7 days & 1 reminder sent
export const lastNoticePendingRegistrations = functions.pubsub
  .schedule('21 23 * * *') // daily at 22:51
  .timeZone('Europe/Oslo')
  .onRun(async () => {
    console.log('[lastNoticePendingRegistrations] triggered');
    const sevenDaysAgo = Timestamp.fromDate(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000));
    const snap = await db.collection('registrations')
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
    console.log('[lastNoticePendingRegistrations] snap size=', snap.size, 'due count=', due.length, 'ids=', due.map(d => d.id));
    // record run info for summary (even if none matched)
    const today = new Date().toISOString().slice(0,10);
    await db.collection('dailyJobLogs').doc(today)
      .collection('lastNoticePendingRegistrations')
      .add({ count: due.length, ids: due.map(d => d.id), timestamp: FieldValue.serverTimestamp() });
    console.log('[lastNoticePendingRegistrations] recorded run info');
    if (!due.length) {
      console.log('[lastNoticePendingRegistrations] no records to process');
      return null;
    }
    await Promise.all(due.map(d => {
      const actionType = 'sendLastNotice';
      const p1 = db.collection('actionRequests').add({
        registrationId: d.id,
        email: d.data().email,
        type: 'sendLastNotice',
        reason: 'Pending >7d & 1 reminder sent',
        createdAt: FieldValue.serverTimestamp(),
        status: 'pending'
      });
      const p2 = db.collection('registrations').doc(d.id).update({
        actionRequests: FieldValue.arrayUnion(actionType)
      });
      return Promise.all([p1, p2]);
    }));
    console.log('[lastNoticePendingRegistrations] enqueued sendLastNotice for ids=', due.map(d => d.id));
    const adminSnap = await db.collection('users').where('isAdmin', '==', true).get();
    const admins = adminSnap.docs.map(a => (a.data() as any).email).filter(Boolean);
    const summary = due.map(d => `${d.id} (${d.data().email})`).join(', ');
    await Promise.all(admins.map(email => db.collection('mail').add({
      to: email,
      message: { subject: 'Action Requests Summary', html: `<p>Last notices: ${summary}</p>` },
      type: 'admin_summary',
      createdAt: FieldValue.serverTimestamp()
    })));
    console.log('[lastNoticePendingRegistrations] summary emails sent to count=', admins.length);
    return null;
  });

// Scheduled Cloud Function: send daily summary to admins (moved to scheduled/sendDailySummary.ts)
export { sendDailySummary } from './scheduled/sendDailySummary';

// new scheduled expiration of waiting-list registrations
export { expiresWaitinglistRegistrations } from './scheduled/expiresWaitinglistRegistrations';
// create admin refund tasks on status change
export { createRefundTasks } from './triggers/createRefundAdminTasks';
