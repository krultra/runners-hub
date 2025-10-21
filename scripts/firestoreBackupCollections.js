#!/usr/bin/env node
"use strict";

/**
 * Backup / restore specific Firestore collections (with subcollections) to/from a JSON file.
 *
 * Backup usage:
 *   node scripts/firestoreBackupCollections.js backup \
 *     --credentials ~/.secrets/runners-hub/serviceAccountKey.json \
 *     --collections eventEditions,kutcResults \
 *     --output ./local_firestore_backup/kutc_backup.json
 *
 * Restore usage:
 *   node scripts/firestoreBackupCollections.js restore \
 *     --credentials ~/.secrets/runners-hub/serviceAccountKey.json \
 *     --input ./local_firestore_backup/kutc_backup.json \
 *     --collections eventEditions,kutcResults \
 *     --purge true
 */

const fs = require("fs");
const path = require("path");
const os = require("os");
const admin = require("firebase-admin");

function parseArgs(argv) {
  const args = { _: [] };
  for (let i = 2; i < argv.length; i++) {
    const token = argv[i];
    if (!token.startsWith("--")) {
      args._.push(token);
      continue;
    }
    const stripped = token.slice(2);
    const eq = stripped.indexOf("=");
    if (eq >= 0) {
      const key = stripped.slice(0, eq);
      const value = stripped.slice(eq + 1);
      args[key] = value;
    } else {
      const key = stripped;
      const next = argv[i + 1];
      if (next && !next.startsWith("--")) {
        args[key] = next;
        i++;
      } else {
        args[key] = true;
      }
    }
  }
  return args;
}

function expandHome(p) {
  if (!p) return p;
  if (p.startsWith("~")) {
    return path.join(os.homedir(), p.slice(1));
  }
  if (p.startsWith("$HOME/")) {
    return path.join(os.homedir(), p.slice(6));
  }
  return p;
}

function toBool(value) {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    const lowered = value.toLowerCase();
    return lowered === "1" || lowered === "true" || lowered === "yes";
  }
  return false;
}

function ensureDir(filePath) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function timestamp() {
  const now = new Date();
  const pad = (n) => n.toString().padStart(2, "0");
  return (
    `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_` +
    `${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`
  );
}

function inferEnvironmentLabel(credentialPath, serviceAccount) {
  const normalizedCandidates = [];
  if (serviceAccount?.project_id) {
    normalizedCandidates.push(String(serviceAccount.project_id).toLowerCase());
  }
  if (credentialPath) {
    normalizedCandidates.push(path.basename(credentialPath).toLowerCase());
  }

  for (const value of normalizedCandidates) {
    if (value.includes("test")) return "test";
  }
  for (const value of normalizedCandidates) {
    if (value.includes("prod")) return "prod";
  }

  const fallback = normalizedCandidates.find(Boolean);
  if (fallback) {
    return fallback.replace(/[^a-z0-9-]+/g, "-");
  }
  return "default";
}

function isTimestamp(value) {
  return (
    value &&
    typeof value.toDate === "function" &&
    typeof value.toMillis === "function" &&
    typeof value.seconds === "number" &&
    typeof value.nanoseconds === "number"
  );
}

function isGeoPoint(value) {
  return (
    value &&
    typeof value.latitude === "number" &&
    typeof value.longitude === "number" &&
    typeof value.isEqual === "function"
  );
}

function isDocumentReference(value) {
  return (
    value &&
    typeof value.path === "string" &&
    typeof value.id === "string" &&
    typeof value.firestore === "object" &&
    typeof value.parent === "object"
  );
}

function isBlob(value) {
  return value && typeof value.toBase64 === "function" && typeof value.size === "number";
}

function serializeValue(value) {
  if (value === null || value === undefined) {
    return value === undefined ? null : value;
  }

  if (isTimestamp(value)) {
    return {
      __type: "timestamp",
      seconds: value.seconds,
      nanoseconds: value.nanoseconds
    };
  }

  if (isGeoPoint(value)) {
    return {
      __type: "geopoint",
      latitude: value.latitude,
      longitude: value.longitude
    };
  }

  if (isDocumentReference(value)) {
    return {
      __type: "document_ref",
      path: value.path
    };
  }

  if (isBlob(value)) {
    return {
      __type: "blob",
      base64: value.toBase64()
    };
  }

  if (Array.isArray(value)) {
    return value.map((item) => serializeValue(item));
  }

  if (typeof value === "object") {
    const out = {};
    for (const [key, nested] of Object.entries(value)) {
      out[key] = serializeValue(nested);
    }
    return out;
  }

  return value;
}

function deserializeValue(value, db) {
  if (value === null || value === undefined) {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((item) => deserializeValue(item, db));
  }

  if (typeof value === "object") {
    if (value.__type === "timestamp") {
      const TimestampCtor = admin.firestore.Timestamp;
      if (TimestampCtor && typeof TimestampCtor.fromMillis === "function") {
        const ms = value.seconds * 1000 + value.nanoseconds / 1e6;
        return TimestampCtor.fromMillis(ms);
      }
      return new TimestampCtor(value.seconds, value.nanoseconds);
    }
    if (value.__type === "geopoint") {
      const GeoPointCtor = admin.firestore.GeoPoint;
      return new GeoPointCtor(value.latitude, value.longitude);
    }
    if (value.__type === "document_ref") {
      return db.doc(value.path);
    }
    if (value.__type === "blob") {
      const BlobCtor = admin.firestore.Blob;
      return BlobCtor.fromBase64String(value.base64);
    }
    const out = {};
    for (const [key, nested] of Object.entries(value)) {
      out[key] = deserializeValue(nested, db);
    }
    return out;
  }

  return value;
}

async function exportDocRecursive(docRef) {
  const snap = await docRef.get();
  const payload = {
    data: snap.exists ? serializeValue(snap.data()) : null,
    subcollections: {}
  };

  const subcollections = await docRef.listCollections();
  for (const sub of subcollections) {
    const docs = await sub.listDocuments();
    const subData = {};
    for (const child of docs) {
      subData[child.id] = await exportDocRecursive(child);
    }
    payload.subcollections[sub.id] = subData;
  }

  return payload;
}

async function importDocRecursive(docRef, payload, { dryRun }, db) {
  const data = payload.data ? deserializeValue(payload.data, db) : {};
  if (!dryRun) {
    if (payload.data) {
      await docRef.set(data, { merge: false });
    } else {
      await docRef.set({}, { merge: true });
    }
  }

  for (const [subName, docs] of Object.entries(payload.subcollections || {})) {
    for (const [docId, docPayload] of Object.entries(docs)) {
      const childRef = docRef.collection(subName).doc(docId);
      await importDocRecursive(childRef, docPayload, { dryRun }, db);
    }
  }
}

async function deleteDocRecursive(docRef, { dryRun }) {
  const subcollections = await docRef.listCollections();
  for (const sub of subcollections) {
    const docs = await sub.listDocuments();
    for (const child of docs) {
      await deleteDocRecursive(child, { dryRun });
    }
  }
  if (!dryRun) {
    await docRef.delete();
  }
}

async function purgeCollection(db, collectionName, options) {
  const colRef = db.collection(collectionName);
  const snap = await colRef.get();
  for (const doc of snap.docs) {
    await deleteDocRecursive(doc.ref, options);
  }
}

async function backupCollections(db, collectionNames) {
  const result = {};
  for (const name of collectionNames) {
    const colRef = db.collection(name);
    const docs = await colRef.listDocuments();
    const colData = {};
    for (const docRef of docs) {
      colData[docRef.id] = await exportDocRecursive(docRef);
    }
    result[name] = colData;
  }
  return result;
}

async function restoreCollections(db, data, collectionNames, options) {
  const targetCollections = collectionNames.length > 0 ? collectionNames : Object.keys(data);
  for (const name of targetCollections) {
    if (!(name in data)) {
      console.warn(`Collection '${name}' not found in backup payload, skipping.`);
      continue;
    }
    const colData = data[name];
    if (options.purge) {
      await purgeCollection(db, name, options);
    }
    for (const [docId, payload] of Object.entries(colData)) {
      const docRef = db.collection(name).doc(docId);
      await importDocRecursive(docRef, payload, options, db);
    }
  }
}

async function runBackup({ credentialPath, collections = [], outputPath, log = console.log }) {
  if (!credentialPath) {
    throw new Error("Missing credentials path");
  }
  const resolvedCredential = path.resolve(expandHome(credentialPath));
  if (!fs.existsSync(resolvedCredential)) {
    throw new Error(`Service account file not found: ${resolvedCredential}`);
  }

  const serviceAccount = require(resolvedCredential);
  if (!serviceAccount.project_id) {
    log("[WARN] Service account JSON missing project_id field.");
  }

  const app = admin.initializeApp(
    { credential: admin.credential.cert(serviceAccount) },
    `firestore-backup-${Date.now()}`
  );
  const db = admin.firestore(app);

  try {
    let targetCollections = collections;
    if (!targetCollections || targetCollections.length === 0) {
      const rootCollections = await db.listCollections();
      targetCollections = rootCollections.map((col) => col.id).sort();
    }

    if (!targetCollections.length) {
      throw new Error("No collections found to back up");
    }

    const envLabel = inferEnvironmentLabel(resolvedCredential, serviceAccount);
    const finalOutput = outputPath
      ? path.resolve(expandHome(outputPath))
      : path.resolve(
          __dirname,
          "../local_firestore_backup",
          `firestore_backup_${envLabel}_${timestamp()}.json`
        );
    ensureDir(finalOutput);

    log(`Backing up collections: ${targetCollections.join(", ")}`);
    const data = await backupCollections(db, targetCollections);
    fs.writeFileSync(finalOutput, JSON.stringify(data, null, 2));
    log(`Backup saved to ${finalOutput}`);
    return finalOutput;
  } finally {
    await app.delete();
  }
}

async function runRestore({
  credentialPath,
  inputPath,
  collections = [],
  dryRun = false,
  purge = false,
  log = console.log
}) {
  if (!credentialPath) {
    throw new Error("Missing credentials path");
  }
  if (!inputPath) {
    throw new Error("Missing backup input path");
  }

  const resolvedCredential = path.resolve(expandHome(credentialPath));
  if (!fs.existsSync(resolvedCredential)) {
    throw new Error(`Service account file not found: ${resolvedCredential}`);
  }

  const resolvedInput = path.resolve(expandHome(inputPath));
  if (!fs.existsSync(resolvedInput)) {
    throw new Error(`Backup file not found: ${resolvedInput}`);
  }

  const payload = JSON.parse(fs.readFileSync(resolvedInput, "utf8"));
  const serviceAccount = require(resolvedCredential);
  if (!serviceAccount.project_id) {
    log("[WARN] Service account JSON missing project_id field.");
  }

  const app = admin.initializeApp(
    { credential: admin.credential.cert(serviceAccount) },
    `firestore-restore-${Date.now()}`
  );
  const db = admin.firestore(app);

  try {
    const targetCollections = collections && collections.length ? collections : Object.keys(payload);
    if (!targetCollections.length) {
      throw new Error("No collections found in backup payload");
    }

    log(`Restoring collections: ${targetCollections.join(", ")}`);
    if (dryRun) {
      log("Running in dry-run mode. No writes will be performed.");
    }

    await restoreCollections(
      db,
      payload,
      targetCollections,
      {
        dryRun,
        purge
      }
    );

    log(`Restore ${dryRun ? "simulation completed" : "completed"} from ${resolvedInput}`);
  } finally {
    await app.delete();
  }
}

async function main(argv = process.argv) {
  const args = parseArgs(argv);
  const mode = args._[0] || args.mode;

  if (!mode || !["backup", "restore"].includes(mode)) {
    console.error("Usage: node scripts/firestoreBackupCollections.js <backup|restore> [options]");
    process.exit(1);
  }

  try {
    if (mode === "backup") {
      const collectionsRaw = args.collections || args.collection || "";
      const collections = collectionsRaw
        .split(",")
        .map((c) => c.trim())
        .filter(Boolean);
      await runBackup({
        credentialPath: args.credentials || process.env.FIREBASE_ADMIN_SA,
        collections,
        outputPath: args.output
      });
    } else {
      const collectionsRaw = args.collections || args.collection || "";
      const collections = collectionsRaw
        .split(",")
        .map((c) => c.trim())
        .filter(Boolean);
      await runRestore({
        credentialPath: args.credentials || process.env.FIREBASE_ADMIN_SA,
        inputPath: args.input || args.file || args.backup,
        collections,
        dryRun: toBool(args["dry-run"]) || toBool(args.dryrun),
        purge: toBool(args.purge)
      });
    }
  } catch (err) {
    console.error("Error:", err.message || err);
    if (process.env.DEBUG) {
      console.error(err);
    }
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  runBackup,
  runRestore,
  backupCollections,
  restoreCollections,
  exportDocRecursive,
  importDocRecursive
};
