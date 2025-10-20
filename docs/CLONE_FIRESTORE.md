# Firestore Clone Script Documentation

## User Guide

### Overview
`scripts/cloneFirestoreProject.js` copies Firestore data between two Firebase projects (production `runnershub-62442` and test `runnershubtest`). It supports selective collections, dry-run verification, reversing source/target, and purging target collections before cloning.

### Prerequisites
- Node.js (matching the repository toolchain).
- `firebase-admin`, `@google-cloud/firestore`, and other dependencies installed via `npm install`.
- Two Firebase service account JSON files with appropriate IAM roles:
  - Production (default path `~/.secrets/runners-hub/runnershub-service-account-readwrite.json`).
  - Test (default path `~/.secrets/runners-hub/runnershubtest-service-account-readwrite.json`).
- Environment variables or CLI flags pointing to those JSON files:
  - `FIREBASE_ADMIN_SA_PROD`
  - `FIREBASE_ADMIN_SA_TEST`
- Optional: `dotenv-cli` to load `.env.production` or `.env.test` when running commands.

### Quick Start
```bash
# Install dotenv CLI if not already installed
npm install --save-dev dotenv-cli

# Dry run: copy KUTC-related collections from prod to test
npx dotenv-cli -e .env.test -- \
  node scripts/cloneFirestoreProject.js \
  --dry-run \
  --include codeLists,eventEditions,resultsSummary,resultsAggregates,allTime

# Real copy with confirmation prompt skipped
npx dotenv-cli -e .env.test -- \
  node scripts/cloneFirestoreProject.js \
  --confirm \
  --include codeLists,eventEditions,resultsSummary,resultsAggregates,allTime
```

### Common Scenarios
- **Prod → Test (default direction)**
  ```bash
  npx dotenv-cli -e .env.test -- \
    node scripts/cloneFirestoreProject.js \
    --confirm \
    --include users
  ```
- **Test → Prod (recovery)**
  ```bash
  npx dotenv-cli -e .env.test -- \
    node scripts/cloneFirestoreProject.js \
    --confirm \
    --include users \
    --reverse true
  ```
  Adjust prod service-account permissions to allow temporary writes when reversing.

- **Purge target data before cloning**
  ```bash
  npx dotenv-cli -e .env.test -- \
    node scripts/cloneFirestoreProject.js \
    --confirm \
    --include users \
    --purge true
  ```
  
- **Capture verbose logs to file**
  ```bash
  npx dotenv-cli -e .env.test -- \
    node scripts/cloneFirestoreProject.js \
    --confirm \
    --include users \
    --verbose true \
    --log-file ./clone-debug.log
  ```

### CLI Options
| Option | Type | Description |
| --- | --- | --- |
| `--include a,b,c` | string | Comma-separated root collections to copy. Defaults to a
| `--exclude x,y` | string | Root collections to skip.
| `--merge` | flag | Use Firestore merge writes (preserve target fields not present in source).
| `--dry-run` | flag | Traverse and log without writing/deleting anything.
| `--confirm` | flag | Skip interactive confirmation prompt.
| `--reverse` | flag or `true/false` | Swap source/target (test → prod).
| `--purge` | flag | Delete selected collections in the target before cloning.
| `--batchSize N` | number | Max writes per batch commit (default 400).
| `--verbose` | flag | Re-enable detailed console output (normally suppressed).
| `--log-file path` | string | Append detailed logs to file (timestamped lines).
| `--source-credentials path` | string | Override source service-account JSON path.
| `--target-credentials path` | string | Override target service-account JSON path.

### Safety Notes
- Always start with `--dry-run` to verify counts and selections.
- Use `--include` and `--exclude` to avoid copying sensitive collections (e.g., `mail`).
- Use `--purge true` cautiously—it deletes all docs (with subcollections) in selected target collections.
- Ensure Cloud Functions in the target project are guarded or disabled to avoid side effects during bulk writes.
- Keep service-account JSON files secure and revert prod permissions after reverse clones.

## Technical Documentation

### Architecture Overview
- Entrypoint `scripts/cloneFirestoreProject.js` uses the Firebase Admin SDK to create two Firestore clients.
- CLI parsing supports both `--flag=value` and `--flag value` forms, turning them into a simple options object.
- Direction control (`--reverse`) swaps env-variable lookups, defaults, and logging labels for source vs. target.
- Credential resolution: `loadServiceAccount()` chooses CLI paths, environment variables, or fallback paths and validates presence.

### Data Copy
- `copyCollection()` loops through source documents, counting progress and calling `copyDocRecursive()` for each doc.
- `copyDocRecursive()` writes the document via batcher and recursively processes every subcollection (depth-first), ensuring nested data moves along with parent documents.
- The batcher accumulates Firestore writes (`set` and `delete`) and commits them in chunks (default 400 operations) to respect Firestore API limits, then reinitializes after each commit.

### Purge Mode
- `--purge` triggers `purgeCollection()` before copying each selected collection.
- `purgeCollection()` fetches the entire target collection and deletes documents recursively (`deleteDocRecursive()`), removing nested subcollections before issuing `batch.delete` on the parent doc.
- After purge, the batcher is flushed so that subsequent writes start with an empty batch.

### Logging & Warning Control
- Non-verbose runs silence Firestore’s internal logging via `@google-cloud/firestore.setLogFunction` and mute `debug` output.
- Console output is narrowed to high-level status unless `--verbose true` is provided.
- Timestamps are gathered into `debugLines` when `--log-file` is specified, and flushed to disk after the run.
- `process.env.GOOGLE_CLOUD_DISABLE_AUTO_PAGE_WARNING` is set to prevent noisy auto-pagination warnings.

### Error Handling & Confirmation
- Without `--confirm`, the script prompts interactively to reduce accidental execution.
- Fatal errors are logged and exit with status `1`.
- Invalid paths or missing service-account JSON files throw descriptive errors before any Firestore calls.

### Extensibility
- Additional filters can be added by adjusting `include`/`exclude` parsing logic or extending `copyCollection()` (e.g., per-document transforms).
- For extremely large datasets, pagination can be introduced by replacing `collection.get()` with manual `orderBy` + `startAfter`, but the current batching is sufficient for moderate-scale copies.

### Related Files & Utilities
- `package.json` exposes helper scripts:
  - `clone:firestore:prod-to-test`
  - `clone:firestore:prod-to-test:kutc`
- Legacy scripts (`backupFirestore.js`, `restoreFirestore.js`) provide JSON backup/restore but lack recursive subcollection support.

## Change Log
- **2025-10-16** Added reverse direction, purge mode, quiet logging, and documentation.
