import * as functions from 'firebase-functions';
import { Timestamp, FieldValue } from 'firebase-admin/firestore';
import { db } from '../utils/admin';

/**
 * Scheduled Cloud Function: last notice for pending registrations >=7 days & 1 reminder sent
 */
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
    const adminSnap = await db.collection('users').where('isAdmin', '==', true).get();
    const admins = adminSnap.docs.map(a => (a.data() as any).email).filter(Boolean);
    const summary = due.map(d => `${d.id} (${d.data().email})`).join(', ');
    await Promise.all(admins.map(email => db.collection('mail').add({
      to: email,
      message: { subject: 'Action Requests Summary', html: `<p>Last notices: ${summary}</p>` },
      type: 'admin_summary',
      createdAt: FieldValue.serverTimestamp()
    })));
    console.log('[lastNoticePendingRegistrations] completed');
    return null;
  });
