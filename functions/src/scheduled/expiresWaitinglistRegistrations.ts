import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { Timestamp, FieldValue } from 'firebase-admin/firestore';

const db = admin.firestore();

/**
 * Scheduled Cloud Function: expires waiting-list registrations with waitinglistExpires <= now
 */
export const expiresWaitinglistRegistrations = functions.pubsub
  .schedule('19 23 * * *') // daily at 23:19
  .timeZone('Europe/Oslo')
  .onRun(async () => {
    console.log('[expiresWaitinglistRegistrations] triggered');
    const now = Timestamp.now();
    const snap = await db.collection('registrations')
      .where('isOnWaitinglist', '==', true)
      .where('waitinglistExpires', '<=', now)
      .get();
    const due = snap.docs;
    console.log('[expiresWaitinglistRegistrations] found due count=', due.length, 'ids=', due.map(d => d.id));

    // record run info
    const today = new Date().toISOString().slice(0,10);
    await db.collection('dailyJobLogs').doc(today)
      .collection('expiresWaitinglistRegistrations')
      .add({ count: due.length, ids: due.map(d => d.id), timestamp: FieldValue.serverTimestamp() });

    if (!due.length) {
      console.log('[expiresWaitinglistRegistrations] no waiting-list registrations to expire');
      return null;
    }

    // expire and notify each
    await Promise.all(due.map(async d => {
      const data = d.data();
      await db.collection('registrations').doc(d.id).update({ status: 'expired' });
      // send expiration email
      await db.collection('mail').add({
        to: data.email,
        message: {
          subject: 'Registration Expired',
          html: `Your waiting-list registration ${data.registrationNumber} has expired.`
        },
        type: 'registration_expiration',
        createdAt: FieldValue.serverTimestamp()
      });
    }));
    console.log('[expiresWaitinglistRegistrations] processed expirations');

    // summary email to admin users
    const adminSnap = await db.collection('users').where('isAdmin', '==', true).get();
    const admins = adminSnap.docs.map(a => (a.data() as any).email).filter(Boolean);
    const summary = due.map(d => `${d.id} (${d.data().email})`).join(', ');
    await Promise.all(admins.map(email =>
      db.collection('mail').add({
        to: email,
        message: { subject: `Waiting-list Expirations ${today}`, html: `<p>Expired waiting-list regs: ${summary}</p>` },
        type: 'admin_summary',
        createdAt: FieldValue.serverTimestamp()
      })
    ));
    console.log('[expiresWaitinglistRegistrations] summary emails sent');
    return null;
  });
