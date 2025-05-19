// scripts/import-to-emulator.js
const fs = require('fs');
const path = require('path');
const admin = require('firebase-admin');

// Initialize with the default app (will connect to local emulator)
process.env.FIRESTORE_EMULATOR_HOST = 'localhost:8080';
admin.initializeApp({
  projectId: 'runnershubtest', // Using test project ID although the backup data is from the production project
});

const db = admin.firestore();

async function importToEmulator(backupPath) {
  try {
    const absPath = path.resolve(backupPath);
    if (!fs.existsSync(absPath)) {
      throw new Error(`Backup file not found: ${absPath}`);
    }

    console.log(`📂 Reading backup from: ${absPath}`);
    const data = JSON.parse(fs.readFileSync(absPath, 'utf8'));
    
    console.log('🚀 Starting import to Firestore emulator...');
    
    // Process each collection
    for (const [collectionName, docs] of Object.entries(data)) {
      console.log(`📝 Importing collection: ${collectionName}`);
      const collectionRef = db.collection(collectionName);
      
      // Process each document in the collection
      for (const [docId, docData] of Object.entries(docs)) {
        try {
          await collectionRef.doc(docId).set(docData);
          process.stdout.write('.'); // Progress indicator
        } catch (docError) {
          console.error(`\n❌ Error importing document ${collectionName}/${docId}:`, docError.message);
          // Continue with next document
        }
      }
      console.log(''); // New line after each collection
    }
    
    console.log('✅ Import completed successfully!');
    console.log('   You can now access your data at http://localhost:4000/firestore');
    
  } catch (error) {
    console.error('❌ Import failed:', error.message);
    process.exit(1);
  }
}

// Get backup file path from command line arguments
const backupPath = process.argv[2];
if (!backupPath) {
  console.error('❌ Error: Please provide the path to the backup file');
  console.log('Usage: node scripts/import-to-emulator.js <backup-file-path>');
  console.log('Example: node scripts/import-to-emulator.js local_firestore_backup/backup-20230519.json');
  process.exit(1);
}

// Run the import
importToEmulator(backupPath);
