// scripts/backupFirestore.js
const fs = require('fs')
const path = require('path')
const os = require('os')
const admin = require('firebase-admin')

// Initialize with your service account
admin.initializeApp({
  credential: admin.credential.cert(require(path.join(os.homedir(), '.secrets/runners-hub/serviceAccountKey.json'))),
})
const db = admin.firestore()

async function backup() {
  // Prepare backup directory and timestamped filename
  const backupDir = path.resolve(__dirname, '../local_firestore_backup')
  if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true })
  const now = new Date()
  const pad = n => n.toString().padStart(2, '0')
  const ts = `${now.getFullYear()}${pad(now.getMonth()+1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`
  const fileName = `firestore_backup_${ts}.json`
  const filePath = path.join(backupDir, fileName)

  const out = {}
  const collections = await db.listCollections()
  for (const col of collections) {
    const snap = await col.get()
    out[col.id] = {}
    snap.forEach(doc => { out[col.id][doc.id] = doc.data() })
  }
  fs.writeFileSync(
    filePath,
    JSON.stringify(out, null, 2),
  )
  console.log('Backup saved to', filePath)
}

// Run backup and exit on error
backup().catch(err => {
  console.error('Backup failed:', err);
  process.exit(1);
});