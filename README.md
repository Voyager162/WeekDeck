# Weekdeck

A shared React + TypeScript planner, packaged with Capacitor for iPhone/Android and Electron for macOS/Windows/Linux. Firebase Authentication supplies accounts; Cloud Firestore stores each account's schedule and streams changes to signed-in devices.

## Start here

The current project is connected: [Open Weekdeck](https://weekdeck-67e4b.web.app). See [project settings and deployment](docs/FIREBASE_PROJECT.md).

1. Install Node.js 24 LTS.
2. Run `npm ci`, then `npm run dev`.
3. Follow [Firebase setup from scratch](docs/FIREBASE_SETUP.md) to connect a real account and database.

Without Firebase environment values the app runs a **local preview**, with an empty week and six reusable presets. Its edits persist only in that browser's local storage. Preview data is not uploaded when Firebase is configured. Partial Firebase configuration is treated as an error, not silently replaced by a preview.

## What's included

- Weekly timeline with adjustable day hours, day removal/restoration, and a focused day layout on phones.
- Mouse and long-press touch dragging, cursor-following blocks, destination ghosts, gap fitting, and top/bottom resizing. Tap-to-place and form editing provide alternatives to dragging.
- Editable preset library, block notes/completion, multi-day copying with conflict detection, atomic replacement, and 20-step undo/redo.
- Light, dark, sage, rose, and system themes; adjustable timeline spacing, snap interval, time format, and week start. Fonts are bundled locally.
- Native mobile notification settings for weekly planning (including interval ranges) and block transitions. Permission is requested only by an explicit device action.
- Email/password registration, sign-in, password reset, persistent sign-in, and sign-out.
- Realtime subscriptions scoped to the authenticated user's UID.
- Firestore schema validation and deny-by-default access rules, with emulator tests.
- Local Auth/Firestore emulators and a test that edits from two separate browser sessions.
- Android/iOS native project shells, desktop packaging, and GitHub Actions checks.

This is a working development release, not a store-ready release. Calendar integrations, repeating blocks, account deletion/export, final app icons, store signing, durable offline edits, server push, and production abuse controls are future work. Native SDK toolchains and physical-device testing are required before distribution. See [notification behavior and limits](docs/NOTIFICATIONS.md).

## Commands

| Command                           | Purpose                                                          |
| --------------------------------- | ---------------------------------------------------------------- |
| `npm run dev`                     | Browser app; prints the local URL                                |
| `npm run check`                   | Type check, domain tests, production build                       |
| `npm run test:e2e`                | Chromium/WebKit layout, drag, resize, copy, touch and CRUD tests |
| `npm run test:rules`              | Firestore rule tests, including cross-account denial             |
| `npm run test:sync`               | Two-device sync and account-isolation integration test           |
| `npm run emulators`               | Local Firebase Auth/Firestore and emulator UI                    |
| `npm run dev:emulators`           | App connected to local emulators                                 |
| `npm run mobile:sync`             | Build shared app and sync native projects                        |
| `npm run android` / `npm run ios` | Open Android Studio / Xcode                                      |
| `npm run desktop`                 | Build and launch the desktop app                                 |
| `npm run desktop:pack`            | Build an unpacked desktop application                            |
| `npm run desktop:dist`            | Build an installer for the current OS                            |

Install the test browsers once with `npx playwright install chromium webkit`. Firebase emulator tests need Java 21 or newer. `npm ci` may prompt to approve dependency installation scripts under newer npm security settings; Electron needs its runtime install script.

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
