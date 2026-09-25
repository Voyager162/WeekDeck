# Platforms

## Phones and browsers

iPhone, iPad, and Android use the shared HTTPS website as a Home Screen web app. No native SDK, Xcode, Android Studio, signing certificate, or store account is required. See [phone setup](PHONE_SETUP.md).

Run `npm ci`, `npm run assets`, and `npm run dev` for development. `npm run build` produces the Firebase Hosting bundle. The service worker caches only a public offline page and icon, not private planner data or an offline-editable application.

## Windows, macOS, and Linux

Run `npm run desktop` to build and launch Electron. `npm run assets` prepares icons and notices; `npm run desktop:pack` creates an unpacked build; `npm run desktop:dist` creates an installer for the current OS.

The desktop app retains its existing identifier, `com.voyager162.timeblocker`, to avoid changing installed application identity. Beta downloads use Windows NSIS, macOS DMG, and Linux AppImage. Windows is unsigned; macOS is ad-hoc signed and unnotarized. Operating-system warnings may appear. Do not disable security globally. There is no automatic updater.

Electron does not receive Web Push itself. Current builds can refresh the server's phone reminder queue while editing. Older beta desktop builds predate this integration; use the current website to update reminders until a new desktop release is installed.

## Builds and tests

The Release Beta workflow checks the app and reminder backend, then builds Windows x64, macOS arm64/x64, and Linux x64 packages. It no longer builds Android APK/AAB files or iOS archives.

Browser tests exercise layouts at 320, 390, 768, and 1440px, CRUD, day-copy boundaries, drag/resize behavior, Home Screen metadata, and offline fallback. Chromium also checks service-worker push rendering. Local Worker integration tests exercise authenticated subscription management, encrypted push, retries, isolation, and deletion.

These checks do not replace real-device locked-screen and background delivery tests. See [notification verification](NOTIFICATIONS.md).
