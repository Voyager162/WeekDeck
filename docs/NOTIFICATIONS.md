# Web Push reminders

## Architecture

Firebase Spark still handles accounts and planner data. An optional Cloudflare Worker verifies Firebase ID tokens and routes requests to a separate SQLite-backed Durable Object per account. Alarms on those objects send standards-based encrypted Web Push to Apple, Google, or Mozilla endpoints.

No Firebase Cloud Functions, scheduled Functions, billing upgrade, service-account key, store membership, or APNs certificate is used. Worker secrets hold the VAPID signing key. Tokens are checked per request, used temporarily to read the caller's own Firestore data under the existing security rules, and are never stored.

Only subscription endpoints/keys, the account's internal identity, device timezones, reminder preferences, and necessary reminder titles/times are persisted in Cloudflare. Notes and passwords are not copied. Canonical data is fetched from Firebase: clients cannot upload arbitrary reminder text. One account cannot manage another account's subscriptions.

## Behavior and limits

- Weekly planning supports the existing weekday, time, and advanced inclusive interval range (up to four hours, at least 15 minutes apart). Server recurrence uses cron-parser with the receiving device's IANA timezone and handles daylight-saving changes.
- Upcoming non-completed blocks generate starts and finishes. Adjacent blocks avoid double transition alerts. Five/ten-minute advance notices apply to starts.
- Block queues cover 14 days. A current signed-in web/desktop session refreshes the canonical queue after committed schedule or preference changes, reconnection, and foregrounding. Updates do not require the receiving phone to be open. Nothing polls Firestore continuously while every app is closed.
- Opening the phone renews its subscription for 90 days and updates its timezone. Weekly recurrence continues during that period without needing a foreground timer.
- Up to five receiving devices per account. Disable this device before enabling a replacement if the limit is reached.
- Alarms process at most five deliveries per invocation, keep stable notification tags, retry transient failures, and discard alerts more than five minutes late. Provider acceptance is not proof a notification appeared on a phone. Crash retries may replace an already shown notification with the same tag; exactly-once display is not guaranteed.
- Push needs connectivity. Focus, battery settings, provider availability, account quotas, or OS behavior can delay or suppress delivery. It is not an alarm-clock guarantee.
- Sign-out unsubscribes the current browser. Disable removes it remotely when reachable and unsubscribes locally. Expired provider endpoints are pruned. Account deletion clears server reminders before deleting Firebase Auth; an interrupted deletion must be retried.
- Navigating to Account/Privacy does not cancel server reminders. Previously published native applications do not implement this service.

## Cost boundary

Use **Workers Free**, with SQLite-backed Durable Objects (configured by `new_sqlite_classes`). Cloudflare documents Free support and hard daily limits: exceeding those limits causes failures rather than automatic paid-plan upgrades. The feature is intended for a small beta, not unlimited users or guaranteed uptime. Monitor Cloudflare and Firebase quotas before broad distribution.

References: [Durable Objects pricing](https://developers.cloudflare.com/durable-objects/platform/pricing/), [Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/), [Firebase plans](https://firebase.google.com/docs/projects/billing/firebase-pricing-plans). Do not add a payment method, accept a paid-plan upgrade, or provision unrelated services for this setup.

## Deploy after the owner authorizes Cloudflare

From `notifications/`:

```sh
npm ci
npx wrangler login
npm run check
npm run keys
npx wrangler deploy
npx wrangler secret bulk .dev.vars
```

The key generator exclusively creates the ignored `.dev.vars`; it refuses to overwrite an existing key. Do not print, commit, or send that file in chat. Keep its backup private. Key rotation invalidates existing subscriptions and needs an explicit migration.

The first deploy provisions the free SQLite Durable Object namespace; the service reports not-ready until both secrets are uploaded. If Workers onboarding asks for a free workers.dev subdomain, choose a suitable Weekdeck name. Stop on any payment/upgrade prompt.

Copy the returned HTTPS Worker origin into the root `.env.local` as `VITE_REMINDER_URL=https://weekdeck-reminders.YOUR-SUBDOMAIN.workers.dev`. Only this public URL belongs in a `VITE_` variable. Vite adds exactly this origin to the browser's connection policy. The Worker accepts the configured Firebase Hosting origin and the desktop application's origin; add other intentional production origins explicitly before using them.

Then rebuild, run tests, and deploy Firebase Hosting. Store the same public URL in the GitHub repository variable `VITE_REMINDER_URL` for subsequent desktop packages. Do not modify or overwrite an already published release.

The CLI OAuth flow requires the browser to return to localhost:8976. Authorization links expire after two minutes. If it fails on a managed network, retry later on your own connection rather than bypassing network restrictions.

## Validation

`npm run check` inside `notifications/` includes unit tests and a local Cloudflare runtime with generated test-only credentials and mocked provider/Firebase endpoints. It makes no real push deliveries. The test harness is not a deployed entrypoint.

Before enabling general access:

1. Validate the live Worker reports ready and rejects anonymous, wrong-project, and foreign-origin calls.
2. On a real iPhone Home Screen app and Android install, enable permission and send a test.
3. Schedule a block a few minutes ahead; close the app and lock the phone. Verify start/finish and advanced weekly reminders.
4. Change a block from another connected device while the phone is closed; verify the updated alert.
5. Test denial/revocation, sign-out, re-enable, account switch, deletion, a timezone change, and a missed/offline alert.
6. Check the actual Free plan, CPU/request/storage usage, and quota errors in Cloudflare. No live delivery or physical-device success is implied by local tests.
