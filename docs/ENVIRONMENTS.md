# Environments

This project uses multiple environments with distinct Firebase projects and .env files.

- Production
  - Firebase project: `runnershub-62442`
  - Build: `npm run build`
  - Deploy: `npm run deploy`
  - Env vars: `.env.production`
  - Hosting: https://runnershub-62442.firebaseapp.com (custom domain: https://runnershub.krultra.no)

- Test
  - Firebase project: `runnershubtest`
  - Build: `npm run build:test`
  - Local dev with test config: `npm run start:test`
  - Deploy: `npm run deploy:test`
  - Env vars: `.env.test`

- Local emulator (Firestore)
  - Start emulator: `npm run emulator:start`
  - Clean start: `npm run emulator:start:clean`
  - Export data: `npm run emulator:export`
  - Import JSON to emulator: `npm run emulator:import`

## Version and Stage Badges

- Header test badge is controlled by `REACT_APP_STAGE=test`.
- Footer version comes from `REACT_APP_VERSION` at build time.

Update the appropriate `.env.*` file before building.
