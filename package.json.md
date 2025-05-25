# Runners Hub - NPM Scripts Documentation

## Development

### `npm start`
Start the development server.

### `npm run build`
Build the app for production to the `build` folder.

### `npm test`
Run tests in interactive watch mode.

### `npm run test:ci`
Run tests in CI mode with coverage reporting.

### `npm run lint`
Check for linting errors in the codebase.

### `npm run lint:fix`
Automatically fix linting errors where possible.

## Firebase Emulator

### `npm run emulator:start`
Start the Firestore emulator with data from `./emulator-data`.

### `npm run emulator:start:clean`
Clear all emulator data and start fresh.

### `npm run emulator:export`
Export data from the local emulator to `./emulator-data`.

### `npm run emulator:clear`
Clear all data from the emulator.

### `npm run emulator:ui`
Start just the Firebase Emulator UI (http://localhost:4000).

### `npm run emulator:import <backup-file>`
Import data from a backup file into the local emulator.
Example: `npm run emulator:import local_firestore_backup/backup-20230519.json`

#### Populating Emulator with Production Data
To get a fresh copy of production data into your local emulator:
1. Create a backup of production data:
   ```bash
   npm run backup
   ```
2. Clear the emulator and start fresh:
   ```bash
   npm run emulator:start:clean
   ```
3. Import the backup file (use the exact filename from the backup):
   ```bash
   npm run emulator:import local_firestore_backup/backup-YYYYMMDD_HHMMSS.json
   ```

## Deployment

### `npm run deploy`
Build and deploy the app to production hosting.

### `npm run deploy:test`
Build and deploy the app to test hosting.

### `npm run deploy:functions`
Deploy Cloud Functions to production.

### `npm run deploy:functions:test`
Deploy Cloud Functions to test environment.

### `npm run deploy:rules`
Deploy Firestore security rules to production.

### `npm run deploy:rules:test`
Deploy Firestore security rules to test environment.

## Cleanup

### `npm run clean:functions:images`
Clean up old function container images from production.

### `npm run clean:functions:images:test`
Clean up old function container images from test environment.

## Backup & Restore

### `npm run backup`
Create a backup of Firestore data.
- Creates a timestamped JSON file in `local_firestore_backup/`
- Requires `serviceAccountKey.json` in the project root

### `npm run restore <backup-file>`
Restore Firestore data from a backup file.
- Usage: `npm run restore path/to/backup.json`
- Requires `serviceAccountKey.json` in the project root
- **Note:** This will overwrite existing data in the target project

## Environment-Specific

### `npm run start:test`
Start the development server with test environment variables.

### `npm run build:test`
Build the app with test environment variables.

---

For detailed information about each script, refer to the `scripts` section in `package.json`.
