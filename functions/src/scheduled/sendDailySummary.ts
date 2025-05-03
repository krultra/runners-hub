import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { Timestamp, FieldValue } from 'firebase-admin/firestore';
import { CRON_SEND_DAILY } from '../config/schedules';

const db = admin.firestore();

/**
 * Scheduled Cloud Function: send daily job summary to admins
 */
export const sendDailySummary = functions.pubsub
  .schedule(CRON_SEND_DAILY) // uses centralized schedule config
  .timeZone('Europe/Oslo')
  .onRun(async () => {
    console.log('[sendDailySummary] triggered');
    const today = new Date().toISOString().slice(0,10);
    console.log('[sendDailySummary] today=', today);

    // Define keys matching dailyJobLogs subcollections
    const jobKeys = [
      { key: 'expirePendingRegistrations', label: 'Expired Registrations' },
      { key: 'lastNoticePendingRegistrations', label: 'Last Notices' },
      { key: 'reminderPendingRegistrations', label: 'Reminders' },
      { key: 'expireWaitinglistRegistrations', label: 'Waiting-list Expirations' }
    ];

    // Sum counts from each log entry instead of counting docs
    const results = await Promise.all(jobKeys.map(async ({ key, label }) => {
      const snap = await db.collection('dailyJobLogs')
        .doc(today).collection(key).get();
      const count = snap.docs.reduce((sum, d) => sum + ((d.data() as any).count || 0), 0);
      return { label, count };
    }));

    let html = `<h1>Daily Job Summary for ${today}</h1>`;
    console.log('[sendDailySummary] html=', html);
    results.forEach(r => { html += `<p>${r.label}: ${r.count}</p>` });

    // extra statistics
    const actionRequestsSnap = await db.collection('actionRequests').where('status', '==', 'pending').get();
    const pendingRequests = actionRequestsSnap.size;
    const regSnap = await db.collection('registrations').get();
    const regsData = regSnap.docs.map(d => d.data());
    const participants = regsData.filter(r => !r.isOnWaitinglist);
    const participantsPending = participants.filter(r => r.status === 'pending').length;
    const participantsConfirmed = participants.filter(r => r.status === 'confirmed').length;
    const waitingList = regsData.filter(r => r.isOnWaitinglist);
    const waitingPending = waitingList.filter(r => r.status === 'pending').length;
    const waitingConfirmed = waitingList.filter(r => r.status === 'confirmed').length;
    const cancelledCount = regsData.filter(r => r.status === 'cancelled').length;
    const expiredCount = regsData.filter(r => r.status === 'expired').length;
    const paymentsReceived = regsData.reduce((sum, r) => sum + (r.paymentMade || 0), 0);
    const outstandingClaims = regsData.reduce((sum, r) => sum + Math.max(0, (r.paymentRequired || 0) - (r.paymentMade || 0)), 0);
    const pendingWithReminder = regsData.filter(r => (r.remindersSent || 0) > 0 && (r.lastNoticesSent || 0) === 0).length;
    const pendingWithLastNotice = regsData.filter(r => (r.lastNoticesSent || 0) > 0).length;
    html += `<h2>Action Requests Pending</h2><p>${pendingRequests}</p>`;
    html += `<h2>Registration Stats</h2>`;
    html += `<p>Participants - Pending: ${participantsPending}, Confirmed: ${participantsConfirmed}, Total: ${participants.length}</p>`;
    html += `<p>Waiting-list - Pending: ${waitingPending}, Confirmed: ${waitingConfirmed}, Total: ${waitingList.length}</p>`;
    html += `<p>Cancelled: ${cancelledCount}, Expired: ${expiredCount}</p>`;
    html += `<h2>Payments</h2>`;
    html += `<p>Received: ${paymentsReceived}, Outstanding: ${outstandingClaims}</p>`;
    html += `<h2>Reminder Status</h2>`;
    html += `<p>Reminder only (no last notice): ${pendingWithReminder}</p>`;
    html += `<p>With last notice: ${pendingWithLastNotice}</p>`;

    // fetch admin users from users collection
    const adminSnap = await db.collection('users').where('isAdmin', '==', true).get();
    console.log('[sendDailySummary] admin users count=', adminSnap.size);
    console.log('[sendDailySummary] admin user data=', adminSnap.docs.map(d => d.data()));
    const admins = adminSnap.docs.map(a => (a.data() as any).email).filter(Boolean);
    console.log('[sendDailySummary] admin emails=', admins);
    console.log('[sendDailySummary] sending emails to count=', admins.length);

    await Promise.all(admins.map(email =>
      db.collection('mail').add({
        to: email,
        message: { subject: `Daily Summary ${today}`, html },
        type: 'admin_summary',
        createdAt: FieldValue.serverTimestamp()
      })
    ));

    console.log('[sendDailySummary] completed');
    return null;
  });
