import * as functions from 'firebase-functions';
import { Timestamp, FieldValue } from 'firebase-admin/firestore';
import { db } from '../utils/admin';

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
      return data.remindersSent === 1 && data.lastNoticesSent === 1 && !requests.includes('expireRegistration');
    });
    console.log('[expirePendingRegistrations] found due count=', due.length, 'ids=', due.map(d => d.id));
    if (!due.length) {
      console.log('[expirePendingRegistrations] no matching registrations to expire');
      return null;
    }
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
    const adminSnap = await db.collection('users').where('isAdmin', '==', true).get();
    const admins = adminSnap.docs.map(a => (a.data() as any).email).filter(Boolean);
    const summary = due.map(d => `${d.id} (${d.data().email})`).join(', ');
    await Promise.all(admins.map(email => db.collection('mail').add({
      to: email,
      message: { subject: 'Action Requests Summary', html: `<p>Expire regs: ${summary}</p>` },
      type: 'admin_summary',
      createdAt: FieldValue.serverTimestamp()
    })));
    const today = new Date().toISOString().slice(0,10);
    await db.collection('dailyJobLogs').doc(today)
      .collection('expirePendingRegistrations')
      .add({ count: due.length, ids: due.map(d => d.id), timestamp: FieldValue.serverTimestamp() });
    console.log('[expirePendingRegistrations] completed');
    return null;
  });
