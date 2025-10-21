# Admin Scripts

These Node.js scripts use the Firebase Admin SDK with service account credentials at `~/.secrets/runners-hub/serviceAccountKey.json` (prod) or `~/.secrets/runners-hub/serviceAccountKeyTest.json` (test).

Always run a backup before making changes.

## Backup and Restore

### Production Backups

- Backup Firestore (all collections including subcollections)
  
  ```bash
  npm run backup
  ```
  
  Creates `local_firestore_backup/firestore_backup_prod_<timestamp>.json`

- Restore from backup JSON
  
  ```bash
  npm run restore -- path/to/backup.json
  ```
  
  Optional flags:
  - `--purge true` - Delete existing data before restoring
  - `--dry-run true` - Preview changes without writing

-### Test Environment Backups

- Backup test Firestore
  
  ```bash
  npm run backup:test
  ```
  
  Creates `local_firestore_backup/firestore_backup_test_<timestamp>.json`

- Restore to test Firestore
  
  ```bash
  npm run restore:test -- path/to/backup.json
  ```
  
  Same optional flags as prod restore

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
