# Weekdeck

A shared React + TypeScript planner, packaged with Capacitor for iPhone/Android and Electron for macOS/Windows/Linux. Firebase Authentication supplies accounts; Cloud Firestore stores each account's schedule and streams changes to signed-in devices.

## Start here

1. Install Node.js 24 LTS.
2. Run `npm ci`, then `npm run dev`.
3. Follow [Firebase setup from scratch](docs/FIREBASE_SETUP.md) to connect a real account and database.

Without Firebase environment values the app runs a **local preview**, with three sample blocks. Its edits persist only in that browser's local storage. Preview data is not uploaded when Firebase is configured. Partial Firebase configuration is treated as an error, not silently replaced by a preview.

## What's included

- Responsive daily planner with date navigation, categories, notes, create/edit/delete, and completion tracking.
- Email/password registration, sign-in, password reset, persistent sign-in, and sign-out.
- Realtime subscriptions scoped to the authenticated user's UID.
- Firestore schema validation and deny-by-default access rules, with emulator tests.
- Local Auth/Firestore emulators and a test that edits from two separate browser sessions.
- Android/iOS native project shells, desktop packaging, and GitHub Actions checks.

This is a working foundation, not a store-ready release. Recurrence, calendar integrations, notifications, account deletion/export, app icons, store signing, and production abuse controls are future work. Native SDK toolchains and device testing are required before distribution.

## Commands

| Command                           | Purpose                                                   |
| --------------------------------- | --------------------------------------------------------- |
| `npm run dev`                     | Browser app; prints the local URL                         |
| `npm run check`                   | Type check, domain tests, production build                |
| `npm run test:e2e`                | Browser CRUD/persistence tests at desktop and phone sizes |
| `npm run test:rules`              | Firestore rule tests, including cross-account denial      |
| `npm run test:sync`               | Two-device sync and account-isolation integration test    |
| `npm run emulators`               | Local Firebase Auth/Firestore and emulator UI             |
| `npm run dev:emulators`           | App connected to local emulators                          |
| `npm run mobile:sync`             | Build shared app and sync native projects                 |
| `npm run android` / `npm run ios` | Open Android Studio / Xcode                               |
| `npm run desktop`                 | Build and launch the desktop app                          |
| `npm run desktop:pack`            | Build an unpacked desktop application                     |
| `npm run desktop:dist`            | Build an installer for the current OS                     |

Install the test browser once with `npx playwright install chromium`. Firebase emulator tests need Java 21 or newer. `npm ci` may prompt to approve dependency installation scripts under newer npm security settings; Electron needs its runtime install script.

## Repository map

| Path               | Owns                                                                      |
| ------------------ | ------------------------------------------------------------------------- |
| `src/`             | Shared user interface, account flow, schedule validation, Firebase client |
| `firestore.rules`  | Server-enforced authorization and data schema                             |
| `firebase.json`    | Emulator, rules, index, and optional web hosting deployment               |
| `android/`, `ios/` | Capacitor native application projects                                     |
| `desktop/`         | Sandboxed Electron host                                                   |
| `tests/`           | Domain, security, browser, and live-sync tests                            |
| `docs/`            | Firebase onboarding, architecture, platform build instructions            |

See [architecture](docs/ARCHITECTURE.md) for storage, synchronization, and offline behavior; see [platforms](docs/PLATFORMS.md) for native build requirements.
