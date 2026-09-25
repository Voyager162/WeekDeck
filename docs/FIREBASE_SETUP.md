# Firebase setup, starting from zero

Firebase hosts the backend. You do not need to rent a machine or keep your computer running. You create the Firebase project under your Google account; this repository provides the client code and the database access rules.

## 1. Sign in to Firebase

Open [Firebase Console](https://console.firebase.google.com/). Sign in with a Google account. An existing Gmail account works; otherwise choose **Create account** in Google's sign-in screen. Complete sign-in and any identity checks yourself.

## 2. Create the project

Choose the button to create a Firebase project. Name it **Weekdeck** (or **Weekdeck Dev** for a development environment). Firebase assigns a globally unique project ID; record that ID. Analytics and Gemini assistance are optional and not needed by this app.

Start on the **Spark** plan. Email/password accounts and this small Firestore prototype can use Firebase's no-cost allowances without adding a payment method. Quotas still apply. Optional paid services, including deploying Cloud Functions, may require **Blaze** later. See [Firebase's plan documentation](https://firebase.google.com/docs/projects/billing/firebase-pricing-plans).

Wait for project creation and open its dashboard. [Official project setup](https://firebase.google.com/docs/web/setup).

## 3. Enable accounts

In **Build > Authentication**, choose **Get started**, then **Sign-in method**. Enable **Email/Password** and save. Leave email-link sign-in off for now.

Under Authentication's settings, add `localhost` and `127.0.0.1` to **Authorized domains** for browser development if they are missing. Later add the real web hostname. The initial app uses passwords, not Google OAuth or native social-login redirects.

The app supports registration, sign-in, password reset, sign-out, and password-confirmed account deletion. It does not yet require email verification. Before a broad public launch, add verification and appropriate abuse controls. [Password authentication documentation](https://firebase.google.com/docs/auth/web/password-auth).

## 4. Create the database

Open **Build > Firestore Database**, then **Create database**. Choose **Standard edition** if prompted, and the **(default)** database. Choose a region near your expected users. For a mostly western-US audience, an available western-US region is reasonable; choose deliberately because a database's location cannot be changed in place.

Choose **Production mode**, not open/test access. The app will be denied access until the repository's rules are deployed in step 7. You do not need to manually create collections or documents.

Use **Cloud Firestore**, not the separate product named Realtime Database. Firestore also supports realtime subscriptions. [Firestore setup](https://firebase.google.com/docs/firestore/quickstart).

## 5. Register the shared client

Return to Project overview and choose the **Web (`</>`)** app icon, or **Project settings > General > Your apps > Add app > Web**. Name it `Weekdeck shared client`. Hosting is optional; skip it during registration.

Copy the displayed `firebaseConfig` object. The app uses the Firebase JavaScript SDK inside the browser, phone Home Screen web app, and desktop renderer, so a web registration is intentional. Native Firebase registrations are not needed.

The four values needed now are `apiKey`, `authDomain`, `projectId`, and `appId`. You can send those values to Codex or put them into the local file described below. Firebase's browser configuration is a client identifier, not a privileged server credential. **Do not send Google passwords, service-account JSON, Admin SDK private keys, or signing keys.** Access protection comes from Authentication and Firestore rules.

## 6. Connect this checkout

Create `.env.local` in the project root using `.env.example` as the template:

```dotenv
VITE_FIREBASE_API_KEY=your-web-api-key
VITE_FIREBASE_AUTH_DOMAIN=your-project-id.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_APP_ID=your-web-app-id
```

Codex can create this file once you provide the configuration. It is ignored by Git. Values prefixed with `VITE_` are included in the shipped client: never put backend secrets there. Restart the dev server after changing these values. Rebuild the website and desktop apps after configuration changes.

## 7. Log in locally and deploy the rules

In the project terminal:

```sh
npm run firebase:login
npm run firebase:select
```

The first command opens Google's authorization flow; complete it yourself. The second selects your new Firebase project and stores a local alias. Choose `default` as the alias. The local `.firebaserc` file is ignored to avoid accidentally selecting someone's production project in another checkout.

Then run:

```sh
npm run deploy:rules
npm run dev
```

Codex can perform project selection and deployment after your CLI sign-in. No `firebase init` is needed: the configuration files already exist, and rerunning initialization could overwrite them.

## 8. Verify cloud syncing

Create an account inside Weekdeck. Open the app in a second browser/device and sign in with that same account. Add a block in one session: it should appear in the other while both are online. Edit it, mark it complete, and delete it to check each path. The app shows **Synced** only after it has a server snapshot without pending writes.

Use a different account as a final isolation check: its planner should be empty. In Firestore, documents appear under `users/{userId}/blocks/{blockId}`. There may be no parent user document; Firestore supports subcollections under such paths.

## Optional: a URL for testing on your phone

After Firebase is connected and rules are deployed:

```sh
npm run deploy:web
```

Firebase Hosting returns an HTTPS URL. Open that URL on your phone and computer to use the same planner; add it to the phone's Home Screen using [these steps](PHONE_SETUP.md). These commands deploy hosting only when you run them; CI never deploys automatically. Check that `firebase use` shows the intended project before deployment.

## Local development without a Firebase account

Install Java 21+ and run `npm run emulators`. In a second terminal run `npm run dev:emulators`. The checked-in `.env.emulator` uses the reserved `demo-timeblocker` project and localhost endpoints; it does not connect to a real cloud project. Emulator accounts/data are temporary. Its UI is at `http://127.0.0.1:4000`.

Use `npm run test:rules` and `npm run test:sync` when the manual emulators are stopped, since tests start and stop their own emulators on those ports. The included integration test signs the same account into two independent sessions and confirms that changes propagate; a third account sees none of that data.

## What to give Codex next

The Firebase web configuration from step 5, the project ID, and confirmation that you enabled Email/Password and created the default Firestore database. After you complete CLI sign-in, Codex can configure this checkout, deploy access rules, connect the app, and verify the live project. You do not need to write backend code yourself.
