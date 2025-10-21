#!/usr/bin/env node
"use strict";

/**
 * Move or copy a Firestore document (including subcollections) within the same project.
 *
 * Example:
 *   node scripts/moveFirestoreDoc.js \
 *     --credentials ~/.secrets/runners-hub/serviceAccountKey.json \
 *     --source kutcResults/kutc-2020/races/8-loops \
 *     --target kutcResults/kutc-2020/races/7-loops \
 *     --confirm
 *
 * Flags:
 *   --credentials  Path to service account JSON (falls back to FIREBASE_ADMIN_SA if set)
 *   --source       Source document path (must exist)
 *   --target       Target document path (will be created, must not already exist unless --overwrite)
 *   --confirm      Required to actually write/delete
 *   --overwrite    Allow overwriting an existing target document
 *   --keep-source  Copy without deleting the source document afterwards
 *   --dry-run      Show what would happen without writing/deleting data
 */

const fs = require("fs");
const path = require("path");
const readline = require("readline");
const admin = require("firebase-admin");

function parseArgs(argv) {
  const args = {};
  const tokens = argv.slice(2);
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    if (!token.startsWith("--")) continue;
    const stripped = token.slice(2);
    const eq = stripped.indexOf("=");
    if (eq >= 0) {
      const key = stripped.slice(0, eq);
      const value = stripped.slice(eq + 1);
      args[key] = value;
    } else {
      const key = stripped;
      const next = tokens[i + 1];
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
    return path.join(require("os").homedir(), p.slice(1));
  }
  if (p.startsWith("$HOME/")) {
    return path.join(require("os").homedir(), p.slice(6));
  }
  return p;
}

async function confirmPrompt(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim().toLowerCase());
    });
  });
}

async function copyDocRecursive(srcDocRef, dstDocRef, { dryRun = false, overwrite = false }) {
  const snap = await srcDocRef.get();
  const subcollections = await srcDocRef.listCollections();

  if (!snap.exists && subcollections.length === 0) {
    throw new Error(`Source document not found: ${srcDocRef.path}`);
  }

  const dstSnap = await dstDocRef.get();
  if (dstSnap.exists && !overwrite) {
    throw new Error(`Target document already exists (use --overwrite to allow): ${dstDocRef.path}`);
  }

  if (!dryRun) {
    if (snap.exists) {
      await dstDocRef.set(snap.data(), { merge: false });
    } else if (!dstSnap.exists) {
      await dstDocRef.set({}, { merge: true });
    }
  }

  for (const sub of subcollections) {
    const childDocs = await sub.listDocuments();
    for (const childDoc of childDocs) {
      const targetChild = dstDocRef.collection(sub.id).doc(childDoc.id);
      await copyDocRecursive(childDoc, targetChild, { dryRun, overwrite: true });
    }
  }
}

async function deleteDocRecursive(docRef, { dryRun = false }) {
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

async function main() {
  const args = parseArgs(process.argv);
  const sourcePath = args.source;
  const targetPath = args.target;
  const dryRun = Boolean(args["dry-run"]);
  const overwrite = Boolean(args.overwrite);
  const keepSource = Boolean(args["keep-source"]);
  const confirm = Boolean(args.confirm);

  if (!sourcePath || !targetPath) {
    throw new Error("Both --source and --target paths are required");
  }

  const credPath = expandHome(args.credentials || process.env.FIREBASE_ADMIN_SA);
  if (!credPath) {
    throw new Error("Provide --credentials or set FIREBASE_ADMIN_SA env with service account JSON path");
  }
  if (!fs.existsSync(credPath)) {
    throw new Error(`Service account file not found: ${credPath}`);
  }

  const credential = admin.credential.cert(JSON.parse(fs.readFileSync(credPath, "utf8")));
  admin.initializeApp({ credential });
  const db = admin.firestore();

  console.log(`Preparing to ${keepSource ? "copy" : "move"} document:`);
  console.log(`  Source: ${sourcePath}`);
  console.log(`  Target: ${targetPath}`);
  console.log(`  Dry run: ${dryRun ? "yes" : "no"}`);
  console.log(`  Overwrite target: ${overwrite ? "yes" : "no"}`);
  console.log(`  Keep source: ${keepSource ? "yes" : "no"}`);

  if (!dryRun && !confirm) {
    const answer = await confirmPrompt("Type 'yes' to proceed: ");
    if (answer !== "yes") {
      console.log("Aborted by user.");
      process.exit(0);
    }
  }

  const srcDocRef = db.doc(sourcePath);
  const dstDocRef = db.doc(targetPath);

  await copyDocRecursive(srcDocRef, dstDocRef, { dryRun, overwrite });
  console.log(`Document copied ${dryRun ? "(dry run)" : ""}`);

  if (!keepSource) {
    await deleteDocRecursive(srcDocRef, { dryRun });
    console.log(`Source document ${dryRun ? "would be deleted" : "deleted"}.`);
  }

  await admin.app().delete();
}

main().catch((err) => {
  console.error("Error:", err.message);
  if (process.env.DEBUG) {
    console.error(err);
  }
  process.exit(1);
});
