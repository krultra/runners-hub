# Runners Hub

Runners Hub is an evolving platform designed to be a complete resource for runners—offering race information, registration, results, statistics, and eventually AI-assisted services. The current version is focused on registration for the KUTC 2025 event, but this is just the beginning. The codebase and documentation will grow as new features are added.

---

## Vision & Roadmap

- **Current:** Registration system for KUTC 2025, with admin and public participant views.
- **Planned:**
  - Central hub for race information (multiple events)
  - Results and statistics tracking
  - Community features and user profiles
  - AI-assisted services (e.g., race recommendations, training insights)
  - More integrations as ideas and needs emerge

---

## Features (Current)
- Register for KUTC 2025 event
- Admin dashboard for managing registrations
- Public participant listing
- Email notifications/testing
- Firestore (Firebase) backend
- Modern, user-friendly React UI

---

## Getting Started

### Prerequisites
- Node.js v16 or v18
- Firebase CLI (`npm install -g firebase-tools`)

### Installation
1. Clone the repository:
   ```bash
   git clone https://github.com/krultra/runners-hub.git
   cd runners-hub
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Copy `.env.example` to `.env` and fill in your Firebase config. For emulator use, you can use dummy values.

#### Environment Variables (`.env`)
- The `.env` file configures Firebase connection and app behavior. Key parameters include:
  - `REACT_APP_FIRESTORE_EMULATOR`: When set to `true`, the app connects to the local Firestore emulator instead of the production Firestore database. Use this for safe local development and testing.
  - `REACT_APP_FIREBASE_API_KEY`, `REACT_APP_FIREBASE_AUTH_DOMAIN`, `REACT_APP_FIREBASE_PROJECT_ID`, etc.: Standard Firebase configuration values. These can be dummy values when using the emulator.

### Local Development
- Start Firestore Emulator:
  ```bash
  firebase emulators:start --only firestore
  ```
- Start the App:
  ```bash
  npm start
  ```
  The app will run at [http://localhost:3000](http://localhost:3000).

---

## Usage

- **Registration:** Visit the registration page and fill out the form to participate in KUTC 2025.
- **Admin:** Log in with admin credentials to manage registrations and view participant data.
- **Public List:** View registered participants on the public listing page.

---

## Project Structure

- `src/` — Main application source code
  - `components/` — Reusable UI components (registration, auth, dialogs, etc.)
  - `pages/` — Main app pages (Home, Registration, Admin, etc.)
  - `services/` — Firebase and business logic
  - `constants/` — Centralized constants and messages
  - `config/` — Firebase and app configuration
  - `types/` — TypeScript types
  - `utils/` — Utility functions
- `public/` — Static assets and index.html
- `firebase.json`, `firestore.rules` — Firebase configuration and security rules

---

## Firestore Database Structure

The app uses several Firestore collections to manage registrations, users, admin data, and event-related emails:

### Collections

- **registrations**
  - Stores each event registration.
  - Key fields: `userId`, `editionId`, `raceDistance`, `firstName`, `lastName`, `email`, `dateOfBirth`, `payments` (array), `paymentMade`, `registrationNumber`, `createdAt`, `updatedAt`, etc.

- **users**
  - Stores user profiles and roles.
  - Key fields: `isAdmin` (boolean), `email`, `displayName`, etc.

- **admins**
  - Stores admin user references (read-only for admin checks).

- **mail**
  - Stores email messages to be sent via Firebase Extensions (e.g., registration confirmations, payment receipts).

- **emailLogs**
  - Logs sent emails for auditing and troubleshooting.

- **counters**
  - Stores sequential counters (e.g., for generating unique registration numbers).
  - Key fields: `currentValue`.

- **invitations**
  - Stores invitation data, accessible only by admins.

> More detailed data structure documentation and entity relationship diagrams may be added as the project evolves.

---

## Email System & Firebase Trigger Extension

The app uses a robust and extensible email system based on Firebase's "mail" collection and the official [Firebase Email Trigger Extension](https://firebase.google.com/products/extensions/mailgun-send-email). This pattern makes it easy to send transactional emails (such as registration confirmations, payment receipts, invitations, etc.) and will scale well as more email-based features are added.

### How It Works
- When the app needs to send an email (e.g., after a registration or payment), it creates a document in the `mail` collection in Firestore.
- The Firebase Email Trigger Extension monitors this collection. When a new document is added, the extension sends the email using the specified provider (e.g., Gmail, Mailgun, SendGrid).
- The extension supports HTML content, attachments, and advanced email features.

### Why This Pattern?
- **Decoupled:** The app doesn't need to handle email delivery directly. It simply writes to Firestore, and the extension handles the rest.
- **Scalable:** Works for any number of emails, and can be extended to support new types of notifications or workflows.
- **Auditable:** All outgoing emails are logged (see the `emailLogs` collection), making it easy to troubleshoot or audit communications.
- **Secure:** Email sending logic is centralized and can be restricted via Firestore security rules.

### Extending the System
- To add new types of emails (e.g., reminders, newsletters), simply write new documents to the `mail` collection with the appropriate content and recipient(s).
- The system can be customized to support templates, localization, and more advanced workflows as needed.

For more details, see the Firebase Email Trigger Extension [docs](https://firebase.google.com/products/extensions/mailgun-send-email) and the `src/services/emailService.ts` file in the codebase.

---

## Available Scripts

In the project directory, you can run:

### `npm start`
Runs the app in the development mode.\
Open [http://localhost:3000](http://localhost:3000) to view it in the browser.
The page will reload if you make edits.\
You will also see any lint errors in the console.

### `npm test`
Launches the test runner in the interactive watch mode.\
See the section about [running tests](https://facebook.github.io/create-react-app/docs/running-tests) for more information.

### `npm run build`
Builds the app for production to the `build` folder.\
It correctly bundles React in production mode and optimizes the build for the best performance.

### `npm run eject`
**Note: this is a one-way operation. Once you `eject`, you can’t go back!**
If you aren’t satisfied with the build tool and configuration choices, you can `eject` at any time. This command will remove the single build dependency from your project.

---

## Firestore Security Rules

**Important:** The current `firestore.rules` file allows all access for development. Before going to production, update your rules to restrict access based on authentication and user roles.
See `firestore.rules` for a TODO reminder.

---

## Learn More

- [Create React App documentation](https://facebook.github.io/create-react-app/docs/getting-started)
- [React documentation](https://reactjs.org/)
- [Firebase documentation](https://firebase.google.com/docs)

---

## Contributing & Future Updates

This project is in active development and will expand well beyond the current KUTC 2025 registration system. Contributions, suggestions, and ideas are welcome! As new features are added, both the code and documentation will be updated.

---

## About & Contact

**Lead Developer:** Torgeir Kruke  
**Company:** KrUltra ENK  
The full project name is **KrUltra Runners Hub**.

- **Email Provider:** [Domeneshop](https://domene.shop) (for krultra.no)
- **Domain:** krultra.no (owned by Torgeir Kruke)
- **Firebase Hosting:**
  - Custom domain: [https://runnershub.krultra.no](https://runnershub.krultra.no)
  - Firebase base URL: [https://runnershub-62442.firebaseapp.com](https://runnershub-62442.firebaseapp.com)

For questions, suggestions, or to get in touch, please contact Torgeir at [post@krultra.no](mailto:post@krultra.no).

---

## License

[Specify your license here]

# Getting Started with Create React App

This project was bootstrapped with [Create React App](https://github.com/facebook/create-react-app).

## Local Development

### Prerequisites
- Node.js v16 or v18
- Firebase CLI (`npm install -g firebase-tools`)

### Environment Variables
Copy `.env.example` to `.env` and fill in your Firebase config. For emulator use, you can use dummy values.

### Start Firestore Emulator
```
firebase emulators:start --only firestore
```

### Start the App
```
npm start
```

The app will run at [http://localhost:3000](http://localhost:3000).

---

## Available Scripts

In the project directory, you can run:

### `npm start`

Runs the app in the development mode.\
Open [http://localhost:3000](http://localhost:3000) to view it in the browser.

The page will reload if you make edits.\
You will also see any lint errors in the console.

### `npm test`

Launches the test runner in the interactive watch mode.\
See the section about [running tests](https://facebook.github.io/create-react-app/docs/running-tests) for more information.

### `npm run build`

Builds the app for production to the `build` folder.\
It correctly bundles React in production mode and optimizes the build for the best performance.

The build is minified and the filenames include the hashes.\
Your app is ready to be deployed!

See the section about [deployment](https://facebook.github.io/create-react-app/docs/deployment) for more information.

### `npm run eject`

**Note: this is a one-way operation. Once you `eject`, you can’t go back!**

If you aren’t satisfied with the build tool and configuration choices, you can `eject` at any time. This command will remove the single build dependency from your project.

Instead, it will copy all the configuration files and the transitive dependencies (webpack, Babel, ESLint, etc) right into your project so you have full control over them. All of the commands except `eject` will still work, but they will point to the copied scripts so you can tweak them. At this point you’re on your own.

You don’t have to ever use `eject`. The curated feature set is suitable for small and middle deployments, and you shouldn’t feel obligated to use this feature. However we understand that this tool wouldn’t be useful if you couldn’t customize it when you are ready for it.

## Firestore Security Rules

**Important:** The current `firestore.rules` file allows all access for development. Before going to production, update your rules to restrict access based on authentication and user roles.

See `firestore.rules` for a TODO reminder.

---

## Learn More

You can learn more in the [Create React App documentation](https://facebook.github.io/create-react-app/docs/getting-started).

To learn React, check out the [React documentation](https://reactjs.org/).
