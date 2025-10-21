#!/usr/bin/env node
"use strict";

/**
 * One-time helper to upsert KUTC event edition documents for 2018-2024.
 *
 * Usage examples:
 *   node scripts/fillKutcEventEditions.js --confirm
 *   node scripts/fillKutcEventEditions.js --credentials ~/.secrets/runners-hub/serviceAccountKeyTest.json --dry-run
 */

const fs = require("fs");
const path = require("path");
const os = require("os");
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
    return lowered === "true" || lowered === "1" || lowered === "yes";
  }
  return false;
}

function buildEditionPayload(year) {
  const shortYear = String(year).slice(-2);
  const isLegacy = year <= 2021;
  const baseCamp = year <= 2022 ? 0 : 50;
  let deposit;
  if (year <= 2020) {
    deposit = 0;
  } else if (year === 2021) {
    deposit = 100;
  } else {
    deposit = 200;
  }
  const participation = 50;
  const total = baseCamp + deposit + participation;
  const maxParticipants = year <= 2020 ? 25 : 30;

  return {
    status: "finished",
    edition: year,
    eventId: "kutc",
    eventName: isLegacy ? "Kruke's Backyard Ultra-Trail Challenge" : "Kruke's Ultra-Trail Challenge",
    eventShortName: isLegacy ? "KBUTC" : "KUTC",
    fees: {
      baseCamp,
      deposit,
      participation,
      total
    },
    loopDistance: 6.7,
    maxParticipants,
    resultTypes: ["scratch"],
    resultURL: `https://runnershub.krultra.no/kutc/results/kutc-${year}`
  };
}

async function main() {
  const args = parseArgs(process.argv);
  const dryRun = toBool(args["dry-run"]) || toBool(args.dryrun);
  const confirm = toBool(args.confirm);

  const credentialPath = expandHome(
    args.credentials ||
      process.env.FIREBASE_ADMIN_SA ||
      path.join(os.homedir(), ".secrets/runners-hub/serviceAccountKey.json")
  );

  if (!credentialPath || !fs.existsSync(credentialPath)) {
    throw new Error(`Service account credential not found: ${credentialPath}`);
  }

  const serviceAccount = JSON.parse(fs.readFileSync(credentialPath, "utf8"));
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
  const db = admin.firestore();

  const years = [2018, 2019, 2020, 2021, 2022, 2023, 2024];

  console.log("Preparing to upsert KUTC event editions:");
  console.log(`  Credential: ${credentialPath}`);
  console.log(`  Dry run: ${dryRun ? "yes" : "no"}`);
  console.log(`  Years: ${years.join(", ")}`);

  if (!dryRun && !confirm) {
    console.error("ERROR: --confirm is required when not running in dry-run mode.");
    process.exit(1);
  }

  for (const year of years) {
    const docId = `kutc-${year}`;
    const payload = buildEditionPayload(year);
    console.log(`\nDoc: eventEditions/${docId}`);
    console.log("Payload:", JSON.stringify(payload, null, 2));

    if (!dryRun) {
      await db.collection("eventEditions").doc(docId).set(payload, { merge: true });
      console.log("→ Upserted.");
    }
  }

  await admin.app().delete();
  console.log("\nAll done.");
}

main().catch((err) => {
  console.error("Error:", err.message || err);
  if (process.env.DEBUG) {
    console.error(err);
  }
  process.exit(1);
});
