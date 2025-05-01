import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';

// Firestore trigger: create refund tasks when a registration transitions to expired
export const createRefundTasks = functions.firestore
  .document('registrations/{registrationId}')
  .onUpdate(async (change, context) => {
    const before = change.before.data();
    const after = change.after.data();
    const regId = context.params.registrationId;
    // proceed only when status changes to 'expired'
    if (before.status !== 'expired' && after.status === 'expired') {
      const paymentMade = after.paymentMade || 0;
      // only create a refund task if there's something to refund
      if (paymentMade > 0) {
        const task = {
          registrationId: regId,
          type: 'refund',
          status: 'open',
          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
          description: {
            editionId: after.editionId,
            registrationNumber: after.registrationNumber,
            firstName: after.firstName,
            lastName: after.lastName,
            paymentsMade: paymentMade,
            list: after.isOnWaitinglist ? 'waiting-list' : 'participant'
          },
          link: `/admin/registrations/${regId}`
        };
        await admin.firestore().collection('adminTasks').add(task);
        console.log('[createRefundTasks] created refund task for', regId);
      } else {
        console.log('[createRefundTasks] no payments to refund for', regId);
      }
    }
    return null;
  });
