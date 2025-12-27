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
exports.projectPublicRegistrations = void 0;
const functions = __importStar(require("firebase-functions"));
const admin_1 = require("../utils/admin");
const normalizeString = (value) => String(value ?? '').trim();
const toBoolean = (value) => Boolean(value);
const toNumberOrNull = (value) => {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
};
async function resolvePersonId(data) {
    const direct = toNumberOrNull(data?.personId);
    if (direct != null) {
        return direct;
    }
    const userId = normalizeString(data?.userId);
    if (!userId) {
        return null;
    }
    let userSnap = await admin_1.db.collection('users').doc(userId).get();
    if (!userSnap.exists) {
        const qUid = await admin_1.db.collection('users').where('uid', '==', userId).limit(1).get();
        if (!qUid.empty) {
            userSnap = qUid.docs[0];
        }
        else {
            const qLegacy = await admin_1.db.collection('users').where('userId', '==', userId).limit(1).get();
            if (!qLegacy.empty) {
                userSnap = qLegacy.docs[0];
            }
        }
    }
    if (!userSnap.exists) {
        return null;
    }
    return toNumberOrNull(userSnap.data()?.personId);
}
exports.projectPublicRegistrations = functions.firestore
    .document('registrations/{registrationId}')
    .onWrite(async (change, context) => {
    const registrationId = context.params.registrationId;
    if (!change.after.exists) {
        await admin_1.db.collection('publicRegistrations').doc(registrationId).delete();
        return null;
    }
    const data = change.after.data();
    if (!data)
        return null;
    const personId = await resolvePersonId(data);
    const payload = {
        editionId: normalizeString(data.editionId),
        registrationNumber: Number.isFinite(Number(data.registrationNumber)) ? Number(data.registrationNumber) : 0,
        personId,
        firstName: normalizeString(data.firstName),
        lastName: normalizeString(data.lastName),
        nationality: normalizeString(data.nationality),
        representing: normalizeString(data.representing),
        raceDistance: normalizeString(data.raceDistance),
        status: normalizeString(data.status),
        isOnWaitinglist: toBoolean(data.isOnWaitinglist),
        waitinglistExpires: data.waitinglistExpires ?? null,
        bib: data.bib ?? null,
        updatedAt: (data.updatedAt ?? null),
    };
    await admin_1.db.collection('publicRegistrations').doc(registrationId).set(payload, { merge: true });
    return null;
});
