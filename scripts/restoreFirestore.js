// scripts/restoreFirestore.js
const fs = require('fs')
const path = require('path')
const os = require('os')
const admin = require('firebase-admin')

// Initialize with your service account
admin.initializeApp({
  credential: admin.credential.cert(require(path.join(os.homedir(), '.secrets/runners-hub/serviceAccountKey.json'))),
})
const db = admin.firestore()

async function restore(backupPath) {
  const absPath = path.resolve(backupPath)
  if (!fs.existsSync(absPath)) {
    console.error('Backup file not found:', absPath)
    process.exit(1)
  }
  const data = JSON.parse(fs.readFileSync(absPath, 'utf8'))
  for (const [colName, docs] of Object.entries(data)) {
    console.log(`Restoring collection: ${colName}`)
    const colRef = db.collection(colName)
    for (const [docId, docData] of Object.entries(docs)) {
      await colRef.doc(docId).set(docData)
    }
  }
  console.log('Restore completed from', absPath)
}

const arg = process.argv[2]
if (!arg) {
  console.error('Usage: node scripts/restoreFirestore.js <backup-file-path>')
  process.exit(1)
}

restore(arg).catch(err => {
  console.error('Restore failed:', err)
  process.exit(1)
})
