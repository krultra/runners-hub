import * as functions from 'firebase-functions';
import { Timestamp, FieldValue } from 'firebase-admin/firestore';
import { db } from '../utils/admin';

/**
 * Scheduled Cloud Function: send reminder for pending registrations older than 5 days and no reminders sent
 */
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
      const p2 = db.collection('registrations').doc(d.id).update({ actionRequests: FieldValue.arrayUnion(actionType) });
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
    console.log('[reminderPendingRegistrations] completed');
    return null;
  });
