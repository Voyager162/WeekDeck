# Building the platform apps

All targets use the same Firebase web configuration at build time. Configure `.env.local` before creating a cloud-connected build. The provisional application identifier is `com.voyager162.timeblocker`; settle its long-term value before registering store apps.

## Android

Install Android Studio and the SDK/JDK versions required by the installed Capacitor version. See [Capacitor environment setup](https://capacitorjs.com/docs/getting-started/environment-setup).

```sh
npm ci
npm run mobile:sync
npm run android
```

In Android Studio, allow Gradle sync, select an emulator or connected device, and run the `app` configuration. Store release requires a signing key and a Play Console account. Never commit signing credentials. This repository uses the Firebase JS client; it does not require `google-services.json` for the current features.

## iPhone / iPad

Use a Mac with the required Xcode and iOS SDK. Windows cannot build an iPhone app. Run:

```sh
npm ci
npm run mobile:sync
npm run ios
```

In Xcode choose the app's signing team and a simulator/device. Native dependency resolution may run when opening/syncing the project. App Store distribution requires Apple signing and enrollment. See [Capacitor iOS](https://capacitorjs.com/docs/ios).

## Windows, macOS, Linux

```sh
npm ci
npm run desktop
npm run desktop:pack
```

Run `npm run assets` before packaging to generate the app icons and third-party notices. `desktop:pack` produces an unpacked app under `release/`. `npm run desktop:dist` produces the current platform's configured installer: Windows NSIS, macOS DMG, or Linux AppImage. Build and test on the target OS; production macOS signing/notarization requires macOS and Apple credentials. Beta installers are unsigned on Windows and ad-hoc signed (not notarized) on macOS. There is no automatic updater. See [installation](../distribution/INSTALL.md) and [store submission](STORE_SUBMISSION.md).

## Validation boundary

The shared app has browser tests at desktop and phone sizes, and Firebase emulator tests. The manually dispatched **Release Beta** workflow builds Windows, macOS (Apple silicon and Intel), Linux, Android, and an unsigned iOS archive on native runners. It smoke-tests packaged desktop startup/navigation and runs the shared app/security/sync suite before creating a draft release. Check the actual workflow outcome for a given release; the existence of a workflow is not evidence it passed. The unsigned iOS archive and Android AAB are developer preparation artifacts, not installable iPhone or store-upload-ready packages. These checks do not replace physical-device validation.

The weekly board is exercised in Chromium and WebKit at 320, 390, 768 and 1440px widths. A Chromium mobile-emulation test dispatches actual touch gestures to verify long-press drawer dragging and ghost placement. WebKit runs the mouse/form/layout suite; this is not an iPhone-device test. Native local-notification delivery still requires the device checklist in [NOTIFICATIONS.md](NOTIFICATIONS.md).

## Rebuild after changes

Use `npm run mobile:sync` after changing the shared UI or Firebase environment. It updates generated assets inside the native shells. Those generated assets are ignored; another checkout rebuilds them from source. Native plugin changes may require another Android Studio/Xcode dependency sync.
