# Connected Firebase project

Weekdeck is connected to Firebase project `weekdeck-67e4b` (display name: WeekDeck).

| Resource          | Setting                                                             |
| ----------------- | ------------------------------------------------------------------- |
| Web application   | Weekdeck shared client                                              |
| Firebase app ID   | `1:779291278017:web:cff7d35f354c9e35947240`                         |
| Database          | `(default)`, Standard edition, native mode                          |
| Database location | Los Angeles, `us-west2`                                             |
| Sign-in           | Email/password                                                      |
| Hosted app        | https://weekdeck-67e4b.web.app                                      |
| Console           | https://console.firebase.google.com/project/weekdeck-67e4b/overview |

`.env.local` contains the public Firebase client configuration, and `.firebaserc` selects this project locally. Both are ignored by Git. No service-account keys are used. Another checkout can retrieve the web configuration with:

```sh
npx -y firebase-tools@latest apps:sdkconfig WEB 1:779291278017:web:cff7d35f354c9e35947240 --project weekdeck-67e4b
```

Map its `apiKey`, `authDomain`, `projectId`, and `appId` to the matching variables in `.env.example`. The app's supported platforms all use this shared configuration.

## Deploy changes

```sh
npx -y firebase-tools@latest deploy --only firestore,auth --project weekdeck-67e4b
npm run build
npx -y firebase-tools@latest deploy --only hosting --project weekdeck-67e4b
```

The hosting URL is publicly reachable; schedules require sign-in and are restricted to the account that owns them. Registration is currently open. The GitHub repository's privacy is independent of the hosted app's availability.

Local preview tests explicitly omit live configuration, and emulator tests use `demo-timeblocker`. To deliberately verify the deployed app against the real project:

```sh
node scripts/verify-cloud.mjs weekdeck-67e4b
```

This check creates two temporary test accounts, verifies browser syncing and access isolation, then removes its data and accounts. It requires `.env.local` and the Playwright Chromium runtime. It is not run in CI.

To also verify the packaged Windows app syncing with the hosted web app, pass its executable as the final argument: `node scripts/verify-cloud.mjs weekdeck-67e4b release/win-unpacked/Weekdeck.exe`.

After shared code or configuration changes, rebuild/deploy web hosting for phones or run `npm run desktop:pack` for a desktop build. Phone installation uses a Home Screen web app, not an app store. The optional Cloudflare reminder service deploys separately and does not upgrade Firebase billing.

## Setup verification

The deployed weekly planner and its packaged Windows app passed live sign-in, block creation/editing/completion/deletion across sessions, shared-hours application and single-day overrides, keyboard day copy/paste, direct block deletion, reload persistence, theme synchronization, and sign-out. Direct reads from another account and an anonymous session were denied. Temporary test accounts, documents, and the isolated desktop test profile were removed after verification. Local preview and emulator sync tests also passed with the live configuration present.

Desktop release builds run in the [Release Beta workflow](https://github.com/Voyager162/WeekDeck/actions/workflows/release.yml), including desktop startup checks. Android/iOS store build jobs have been removed. Previously published downloads are historical builds, not automatically updated by web deployments. Check the successful run associated with each release before distributing artifacts. Live Web Push and physical iPhone/Android delivery checks remain pending until Cloudflare authorization and deployment are completed. See [reminders](NOTIFICATIONS.md) and [phone setup](PHONE_SETUP.md).
