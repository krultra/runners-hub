import * as functions from 'firebase-functions';
import { Timestamp, FieldValue } from 'firebase-admin/firestore';
import { db } from '../utils/admin';
import { CRON_LAST_NOTICE } from '../config/schedules';

/**
 * Scheduled Cloud Function: last notice for pending registrations >=7 days & 1 reminder sent
 */
export const lastNoticePendingRegistrations = functions.pubsub
  .schedule(CRON_LAST_NOTICE) // uses centralized schedule config
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
      const p2 = db.collection('registrations').doc(d.id).update({ actionRequests: FieldValue.arrayUnion(actionType) });
      return Promise.all([p1, p2]);
    }));
    console.log('[lastNoticePendingRegistrations] enqueued sendLastNotice for ids=', due.map(d => d.id));
    console.log('[lastNoticePendingRegistrations] completed');
    return null;
  });
