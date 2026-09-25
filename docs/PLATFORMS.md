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

`desktop:pack` produces an unpacked app under `release/`. `npm run desktop:dist` produces the current platform's configured installer: Windows NSIS, macOS DMG, or Linux AppImage. Build and test on the target OS; macOS signing/notarization requires macOS and Apple credentials. The initial installers are unsigned development artifacts. Code signing, updater infrastructure, final app icons, and store distribution are not configured.

## Validation boundary

The shared app has browser tests at desktop and phone sizes, and Firebase emulator tests. These are not substitutes for building and testing each native target. Creating the native project directories does not mean iOS/Android binaries have been built. CI currently validates the shared app and backend rules on Linux; native release jobs should be added when SDKs and signing are available.

## Rebuild after changes

Use `npm run mobile:sync` after changing the shared UI or Firebase environment. It updates generated assets inside the native shells. Those generated assets are ignored; another checkout rebuilds them from source. Native plugin changes may require another Android Studio/Xcode dependency sync.
