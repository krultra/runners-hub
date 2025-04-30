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
  .schedule('0 0 1 1 *') // once a year
  .onRun(async () => {
    const eightDaysAgo = Timestamp.fromDate(new Date(Date.now() - 8 * 24 * 60 * 60 * 1000));
    const snap = await db.collection('registrations')
      .where('status', '==', 'pending')
      .where('createdAt', '<=', eightDaysAgo)
      .get();
    const due = snap.docs.filter(d => {
      const data = d.data();
      const requests = data.actionRequests || [];
      return data.remindersSent === 2 && !requests.includes('expireRegistration');
    });
    if (!due.length) return null;
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
    // summary to admins
    const adminSnap = await db.collection('admins').get();
    const admins = adminSnap.docs.map(a => a.data().email).filter(Boolean);
    const summary = due.map(d => `${d.id} (${d.data().email})`).join(', ');
    await Promise.all(admins.map(email => db.collection('mail').add({
      to: email,
      message: { subject: 'Action Requests Summary', html: `<p>Expire regs: ${summary}</p>` },
      type: 'admin_summary',
      createdAt: FieldValue.serverTimestamp()
    })));
    return null;
  });

// Scheduled Cloud Function: send reminder for pending registrations older than 5 days and no reminders sent
export const reminderPendingRegistrations = functions.pubsub
  .schedule('0 0 1 1 *') // once a year
  .onRun(async () => {
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
    if (!due.length) return null;
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
    const adminSnap = await db.collection('admins').get();
    const admins = adminSnap.docs.map(a => a.data().email).filter(Boolean);
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
  .schedule('0 0 1 1 *') // once a year
  .onRun(async () => {
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
    if (!due.length) return null;
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
    const adminSnap = await db.collection('admins').get();
    const admins = adminSnap.docs.map(a => a.data().email).filter(Boolean);
    const summary = due.map(d => `${d.id} (${d.data().email})`).join(', ');
    await Promise.all(admins.map(email => db.collection('mail').add({
      to: email,
      message: { subject: 'Action Requests Summary', html: `<p>Last notices: ${summary}</p>` },
      type: 'admin_summary',
      createdAt: FieldValue.serverTimestamp()
    })));
    return null;
  });
