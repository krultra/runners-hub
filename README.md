# Runners Hub Registration App

This project allows users to register for running events, with data stored in Firestore (Firebase). It supports local development with the Firestore emulator and has a modern, user-friendly UI.

## Quick Wins & Improvements
- Centralized error messages in `src/constants/messages.ts` for easier localization and maintenance.
- Added a TODO reminder in `firestore.rules` to secure rules before production.
- (Recommended) Add explicit types to all functions/components and consider schema-based validation for scalability.

---

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
