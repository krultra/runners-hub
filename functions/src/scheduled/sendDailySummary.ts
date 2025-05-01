import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { Timestamp, FieldValue } from 'firebase-admin/firestore';

const db = admin.firestore();

/**
 * Scheduled Cloud Function: send daily job summary to admins
 */
export const sendDailySummary = functions.pubsub
  .schedule('23 23 * * *') // daily at 22:53
  .timeZone('Europe/Oslo')
  .onRun(async () => {
    console.log('[sendDailySummary] triggered');
    const today = new Date().toISOString().slice(0,10);
    console.log('[sendDailySummary] today=', today);

    const jobKeys = [
      { key: 'expirePendingRegistrations', label: 'Expired Registrations' },
      { key: 'lastNoticePendingRegistrations', label: 'Last Notices' },
      { key: 'reminderPendingRegistrations', label: 'Reminders' },
      { key: 'expiresWaitinglistRegistrations', label: 'Waiting-list Expirations' }
    ];

    const results = await Promise.all(jobKeys.map(async ({ key, label }) => {
      const snap = await db.collection('dailyJobLogs')
        .doc(today).collection(key).get();
      return { label, count: snap.size };
    }));

    let html = `<h1>Daily Job Summary for ${today}</h1>`;
    console.log('[sendDailySummary] html=', html);
    results.forEach(r => { html += `<p>${r.label}: ${r.count}</p>` });

    const adminSnap = await db.collection('admins').get();
    console.log('[sendDailySummary] admin docs count=', adminSnap.size);
    console.log('[sendDailySummary] admin docs data=', adminSnap.docs.map(d => d.data()));
    // use userId as admin email
    const admins = adminSnap.docs.map(a => (a.data() as any).userId).filter(Boolean);
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
