"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createRefundTasks = void 0;
const functions = __importStar(require("firebase-functions"));
const admin = __importStar(require("firebase-admin"));
const firestore_1 = require("firebase-admin/firestore");
// Firestore trigger: create refund tasks when a registration transitions to expired
exports.createRefundTasks = functions.firestore
    .document('registrations/{registrationId}')
    .onUpdate(async (change, context) => {
    const before = change.before.data();
    const after = change.after.data();
    const regId = context.params.registrationId;
    // proceed only when status changes to 'expired'
    if (before.status !== 'expired' && after.status === 'expired') {
        const paymentsMade = after.paymentsMade || 0;
        // only create a refund task if there's something to refund
        if (paymentsMade > 0) {
            const task = {
                registrationId: regId,
                type: 'refund',
                status: 'open',
                createdAt: firestore_1.FieldValue.serverTimestamp(),
                updatedAt: firestore_1.FieldValue.serverTimestamp(),
                description: {
                    editionId: after.editionId,
                    registrationNumber: after.registrationNumber,
                    firstName: after.firstName,
                    lastName: after.lastName,
                    paymentsMade,
                    list: after.isOnWaitinglist ? 'waiting-list' : 'participant'
                },
                link: `/admin/registrations/${regId}`
            };
            await admin.firestore().collection('adminTasks').add(task);
            console.log('[createRefundTasks] created refund task for', regId);
        }
        else {
            console.log('[createRefundTasks] no payments to refund for', regId);
        }
    }
    return null;
});
