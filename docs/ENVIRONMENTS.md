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

## Firestore cloning between environments

When copying Firestore data between `runnershub-62442` (prod) and `runnershubtest` (test), be aware that Firebase Auth is **not** cloned and UIDs may differ between projects for the same email address.

See `docs/CLONE_FIRESTORE.md` for details and mitigations.

## Version and Stage Badges

- Header test badge is controlled by `REACT_APP_STAGE=test`.
- Footer version comes from `REACT_APP_VERSION` at build time.

Update the appropriate `.env.*` file before building.
