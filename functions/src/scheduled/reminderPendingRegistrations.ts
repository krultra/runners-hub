import * as functions from 'firebase-functions';
import { Timestamp, FieldValue } from 'firebase-admin/firestore';
import { db } from '../utils/admin';
import { CRON_REMINDER_PENDING } from '../config/schedules';

/**
 * Scheduled Cloud Function: send reminder for pending registrations older than 5 days and no reminders sent
 */
export const reminderPendingRegistrations = functions.pubsub
  .schedule(CRON_REMINDER_PENDING) // uses centralized schedule config
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
    console.log('[reminderPendingRegistrations] completed');
    return null;
  });
