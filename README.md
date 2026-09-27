# Weekdeck

A React + TypeScript time-blocking planner with Firebase account sync. Browsers and Android use an installable web app; Windows, macOS, and Linux have Electron downloads. An iPhone app is prepared for TestFlight and App Store distribution through GitHub's Mac runners.

[Open Weekdeck](https://weekdeck-67e4b.web.app) | [Phone setup](docs/PHONE_SETUP.md) | [Desktop downloads](https://github.com/Voyager162/WeekDeck/releases)

## Development

Install Node.js 24 LTS, run `npm ci`, then `npm run dev`. The existing project configuration is described in [Firebase project](docs/FIREBASE_PROJECT.md). Without Firebase variables, the app uses a separate browser-local preview. Partial configuration is an error, not a silent fallback.

The planner supports draggable/resizable blocks, presets, exact day copy/paste, shared day hours, themes, responsive phone layouts, account deletion, realtime Firestore syncing, and read-only schedule sharing by verified email. See [schedule sharing](docs/SHARING.md) for invitations, week-only/all-weeks access, and revocation.

## Phone reminders

The web app includes a manifest, Home Screen icons, a service worker, device-specific permission controls, and a test notification. Background delivery uses the optional Cloudflare service in `notifications/`. **It is not active until that service is deployed and connected.** Settings display the setup status rather than claiming reminders are enabled.

Firebase can stay on Spark; the reminder service uses Workers Free and SQLite-backed Durable Objects. No payment method or paid store enrollment is part of this design. Free quotas apply, and delivery is not an exact alarm guarantee. See [notification behavior and deployment](docs/NOTIFICATIONS.md).

Cloudflare deployment is currently cancelled. The iPhone app instead uses native local notifications, with no reminder server. Remote edits refresh its reminder queue when the iPhone app opens. See [iPhone App Store setup](docs/IPHONE_APP_STORE.md) for Windows-based signing, TestFlight, and the limits of local alerts. No Google Play build is included.

## Commands

| Command                         | Purpose                                           |
| ------------------------------- | ------------------------------------------------- |
| `npm run dev`                   | Local browser app                                 |
| `npm run check`                 | Type checking, unit tests, production build       |
| `npm run test:e2e`              | Chromium/WebKit planner and PWA tests             |
| `npm run test:rules`            | Firestore authorization tests                     |
| `npm run test:sync`             | Auth/Firestore multi-device integration           |
| `npm ci --prefix notifications` | Install reminder service dependencies             |
| `npm run notifications:check`   | Reminder unit and local Worker integration tests  |
| `npm run assets`                | Desktop/Home Screen icons and third-party notices |
| `npm run desktop`               | Build and launch Electron                         |
| `npm run desktop:dist`          | Build an installer for the current OS             |
| `npm run deploy:web`            | Build and deploy Firebase Hosting                 |
| `npm run ios:sync`              | Build and synchronize the native iPhone project   |

Install browsers using `npx playwright install chromium webkit`. Firebase emulators require Java 21+. Tests never target production Firebase. The release workflow builds desktop packages only; it does not deploy Cloudflare or upgrade billing.

## Scope

Desktop installers are unsigned on Windows and ad-hoc signed/unnotarized on macOS. No automatic desktop updater, durable offline editing, calendar integration, or data export is included. The offline page caches no planner data. Physical phone notification checks remain required.

See [architecture](docs/ARCHITECTURE.md), [platforms](docs/PLATFORMS.md), and [Firebase onboarding](docs/FIREBASE_SETUP.md).
