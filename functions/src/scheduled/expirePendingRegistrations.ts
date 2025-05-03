import * as functions from 'firebase-functions';
import { Timestamp, FieldValue } from 'firebase-admin/firestore';
import { db } from '../utils/admin';
import { CRON_EXPIRE_PENDING } from '../config/schedules';

/**
 * Scheduled Cloud Function: expires pending registrations older than 9 days and 2 reminders sent.
 */
export const expirePendingRegistrations = functions.pubsub
  .schedule(CRON_EXPIRE_PENDING) // uses centralized config
  .timeZone('Europe/Oslo')
  .onRun(async () => {
    console.log('[expirePendingRegistrations] triggered');
    const nineDaysAgo = Timestamp.fromDate(new Date(Date.now() - 9 * 24 * 60 * 60 * 1000));
    const snap = await db.collection('registrations')
      .where('status', '==', 'pending')
      .where('createdAt', '<=', nineDaysAgo)
      .get();
    const due = snap.docs.filter(d => {
      const data = d.data();
      const requests = data.actionRequests || [];
      return data.remindersSent === 1 && data.lastNoticesSent === 1 && !requests.includes('expireRegistration');
    });
    // record run info regardless of matches
    const today = new Date().toISOString().slice(0,10);
    await db.collection('dailyJobLogs').doc(today)
      .collection('expirePendingRegistrations')
      .add({ count: due.length, ids: due.map(d => d.id), timestamp: FieldValue.serverTimestamp() });
    if (!due.length) {
      console.log('[expirePendingRegistrations] no matching registrations to expire');
      console.log('[expirePendingRegistrations] completed');
      return null;
    }
    await Promise.all(due.map(d => {
      const actionType = 'expireRegistration';
      const p1 = db.collection('actionRequests').add({
        registrationId: d.id,
        email: d.data().email,
        type: 'expireRegistration',
        reason: 'Pending >9d & 2 reminders sent',
        createdAt: FieldValue.serverTimestamp(),
        status: 'pending'
      });
      const p2 = db.collection('registrations').doc(d.id).update({
        actionRequests: FieldValue.arrayUnion(actionType)
      });
      return Promise.all([p1, p2]);
    }));
    console.log('[expirePendingRegistrations] enqueued expireRegistration for ids=', due.map(d => d.id));
    console.log('[expirePendingRegistrations] completed');
    return null;
  });
