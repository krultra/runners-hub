#!/usr/bin/env node
/**
 * Extract sample documents from a Firestore backup JSON file.
 * 
 * Usage:
 *   node extract-firestore-samples.js <backup.json> <output.json> [collection/docId ...]
 * 
 * Examples:
 *   node extract-firestore-samples.js backup.json samples.json eventEditions/kutc-2026 events/KUTC
 *   node extract-firestore-samples.js backup.json samples.json "eventEditions/*" # all docs in collection
 */

const fs = require('fs');
const path = require('path');

function main() {
  const args = process.argv.slice(2);
  
  if (args.length < 3) {
    console.log(`Usage: node ${path.basename(__filename)} <backup.json> <output.json> <collection/docId> [...]`);
    console.log(`\nExamples:`);
    console.log(`  node ${path.basename(__filename)} backup.json samples.json eventEditions/kutc-2026`);
    console.log(`  node ${path.basename(__filename)} backup.json samples.json "eventEditions/*" events/KUTC`);
    process.exit(1);
  }

  const [backupFile, outputFile, ...paths] = args;

  console.log(`Reading ${backupFile}...`);
  const backup = JSON.parse(fs.readFileSync(backupFile, 'utf8'));

  const samples = {};

  for (const docPath of paths) {
    const [collection, docId] = docPath.split('/');
    
    if (!backup[collection]) {
      console.warn(`Collection "${collection}" not found in backup.`);
      continue;
    }

    if (!samples[collection]) {
      samples[collection] = {};
    }

    if (docId === '*') {
      // Extract all documents in collection (just IDs and top-level fields, no subcollections)
      const docs = backup[collection];
      for (const [id, doc] of Object.entries(docs)) {
        samples[collection][id] = {
          fields: doc.fields || doc,
          // Indicate if subcollections exist but don't include them
          _hasSubcollections: doc.subcollections && Object.keys(doc.subcollections).length > 0
        };
      }
      console.log(`Extracted ${Object.keys(docs).length} documents from "${collection}"`);
    } else if (docId) {
      // Extract specific document
      const doc = backup[collection][docId];
      if (!doc) {
        console.warn(`Document "${collection}/${docId}" not found.`);
        continue;
      }
      samples[collection][docId] = {
        fields: doc.fields || doc,
        _hasSubcollections: doc.subcollections && Object.keys(doc.subcollections).length > 0
      };
      console.log(`Extracted "${collection}/${docId}"`);
    } else {
      // Just list document IDs in collection
      const docIds = Object.keys(backup[collection]);
      console.log(`Collection "${collection}" has ${docIds.length} documents: ${docIds.slice(0, 10).join(', ')}${docIds.length > 10 ? '...' : ''}`);
    }
  }

  fs.writeFileSync(outputFile, JSON.stringify(samples, null, 2));
  console.log(`\nSamples written to ${outputFile}`);
}

main();
