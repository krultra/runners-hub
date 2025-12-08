import * as functions from 'firebase-functions';
import { db } from '../utils/admin';
import { Timestamp } from 'firebase-admin/firestore';

interface RaceDistance {
  id: string;           // internal RunnersHub ID, e.g., "4-loops"
  strapiRaceId?: string; // maps to Strapi race_id, e.g., "KUTC-04"
  length: number;       // meters
  ascent: number;       // meters
  descent: number;      // meters
  maxParticipants?: number; // optional per-race limit
  startTime?: Timestamp;    // optional per-race start time
}

interface EditionData {
  eventId: string;
  edition: number;
  eventName: string;
  eventShortName: string;
  status: string;
  resultsStatus: string;
  startTime: Timestamp;
  endTime?: Timestamp;
  registrationOpens?: Timestamp;
  registrationCloses?: Timestamp;
  registrationDeadline?: Timestamp; // legacy, use registrationCloses
  maxParticipants?: number;
  raceDistances?: RaceDistance[];
  fees?: {
    participation: number;
    deposit: number;
    baseCamp: number;
    total: number;
  };
}

interface RaceDistanceResponse {
  id: string;
  strapiRaceId?: string;
  length: number;
  ascent: number;
  descent: number;
  maxParticipants?: number;
  startTime?: string;
}

interface NextEditionResponse {
  editionId: string;
  eventId: string;
  edition: number;
  eventName: string;
  eventShortName: string;
  status: string;
  startTime: string;
  endTime?: string;
  registrationOpens?: string;
  registrationCloses?: string;
  maxParticipants?: number;
  raceDistances?: RaceDistanceResponse[];
  fees?: {
    participation: number;
    deposit: number;
    baseCamp: number;
    total: number;
  };
}

/**
 * HTTP endpoint to get the next upcoming edition for an event.
 * 
 * Usage:
 *   GET /getNextEdition?eventId=kutc
 *   GET /getNextEdition?editionId=kutc-2026
 * 
 * Returns the next edition with startTime > now, or the specified edition.
 */
export const getNextEdition = functions
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
        const docRef = db.collection('eventEditions').doc(editionId);
        const snap = await docRef.get();
        if (!snap.exists) {
          res.status(404).json({ error: `Edition ${editionId} not found` });
          return;
        }
        editionDoc = { id: snap.id, data: snap.data() as EditionData };
      } else if (eventId && typeof eventId === 'string') {
        // Find next upcoming edition for this event
        const now = Timestamp.now();
        const query = db
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
        editionDoc = { id: doc.id, data: doc.data() as EditionData };
      } else {
        res.status(400).json({ error: 'Missing required parameter: eventId or editionId' });
        return;
      }

      const data = editionDoc.data;
      // Use new fields if available, fall back to legacy registrationDeadline for closes
      const regCloses = data.registrationCloses ?? data.registrationDeadline;
      
      // Convert raceDistances, handling optional Timestamp fields
      const raceDistances: RaceDistanceResponse[] | undefined = data.raceDistances?.map((rd) => ({
        id: rd.id,
        strapiRaceId: rd.strapiRaceId,
        length: rd.length,
        ascent: rd.ascent,
        descent: rd.descent,
        maxParticipants: rd.maxParticipants,
        startTime: rd.startTime?.toDate().toISOString(),
      }));

      const response: NextEditionResponse = {
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
    } catch (error) {
      console.error('Error fetching edition:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });
