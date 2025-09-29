# Admin Scripts

These Node.js scripts use the Firebase Admin SDK with service account credentials at `~/.secrets/runners-hub/serviceAccountKey.json`.

Always run a backup before making changes.

## Backup and Restore

- Backup Firestore (all top-level collections)
  
  ```bash
  npm run backup
  ```

- Restore from backup JSON
  
  ```bash
  npm run restore -- path/to/backup.json
  ```

## Collection Utilities

- Copy a collection (default source is `users`) to a target collection
  
  ```bash
  npm run copy:users
  ```

- Compare current `users` collection with a backup JSON
  
  ```bash
  npm run compare:users -- local_firestore_backup/firestore_backup_YYYYMMDD_HHMMSS.json
  ```

- Backfill `uid` for users missing it (sets `uid = document ID`)
  
  ```bash
  npm run backfill:uids
  ```

## Registration → Users Sync

- Manual admin sync (CLI) for a given `editionId` (same logic as the Admin UI button)
  
  ```bash
  npm run sync:users
  ```

You will be prompted for `editionId` and confirmation.
