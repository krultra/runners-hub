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
exports.getNextEdition = void 0;
const functions = __importStar(require("firebase-functions"));
const admin_1 = require("../utils/admin");
const firestore_1 = require("firebase-admin/firestore");
/**
 * HTTP endpoint to get the next upcoming edition for an event.
 *
 * Usage:
 *   GET /getNextEdition?eventId=kutc
 *   GET /getNextEdition?editionId=kutc-2026
 *
 * Returns the next edition with startTime > now, or the specified edition.
 */
exports.getNextEdition = functions
    .region('europe-west1')
    .https.onRequest(async (req, res) => {
    // CORS headers
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type');
    res.set('Cache-Control', 'public, max-age=300, s-maxage=600'); // Cache for 5-10 min
    if (req.method === 'OPTIONS') {
        res.status(204).send('');
        return;
    }
    if (req.method !== 'GET') {
        res.status(405).json({ error: 'Method not allowed' });
        return;
    }
    const { eventId, editionId } = req.query;
    try {
        let editionDoc;
        if (editionId && typeof editionId === 'string') {
            // Fetch specific edition by ID (e.g., "kutc-2026")
            const docRef = admin_1.db.collection('eventEditions').doc(editionId);
            const snap = await docRef.get();
            if (!snap.exists) {
                res.status(404).json({ error: `Edition ${editionId} not found` });
                return;
            }
            editionDoc = { id: snap.id, data: snap.data() };
        }
        else if (eventId && typeof eventId === 'string') {
            // Find next upcoming edition for this event
            const now = firestore_1.Timestamp.now();
            const query = admin_1.db
                .collection('eventEditions')
                .where('eventId', '==', eventId.toLowerCase())
                .where('startTime', '>', now)
                .orderBy('startTime', 'asc')
                .limit(1);
            const snapshot = await query.get();
            if (snapshot.empty) {
                res.status(404).json({ error: `No upcoming edition found for event ${eventId}` });
                return;
            }
            const doc = snapshot.docs[0];
            editionDoc = { id: doc.id, data: doc.data() };
        }
        else {
            res.status(400).json({ error: 'Missing required parameter: eventId or editionId' });
            return;
        }
        const data = editionDoc.data;
        // Use new fields if available, fall back to legacy registrationDeadline for closes
        const regCloses = data.registrationCloses ?? data.registrationDeadline;
        // Convert raceDistances, handling optional Timestamp fields
        const raceDistances = data.raceDistances?.map((rd) => ({
            id: rd.id,
            strapiRaceId: rd.strapiRaceId,
            length: rd.length,
            ascent: rd.ascent,
            descent: rd.descent,
            maxParticipants: rd.maxParticipants,
            startTime: rd.startTime?.toDate().toISOString(),
        }));
        const response = {
            editionId: editionDoc.id,
            eventId: data.eventId,
            edition: data.edition,
            eventName: data.eventName,
            eventShortName: data.eventShortName,
            status: data.status,
            startTime: data.startTime?.toDate().toISOString(),
            endTime: data.endTime?.toDate().toISOString(),
            registrationOpens: data.registrationOpens?.toDate().toISOString(),
            registrationCloses: regCloses?.toDate().toISOString(),
            maxParticipants: data.maxParticipants,
            raceDistances,
            fees: data.fees,
        };
        res.status(200).json(response);
    }
    catch (error) {
        console.error('Error fetching edition:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
