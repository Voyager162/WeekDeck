# Weekdeck on your phone

Open https://weekdeck-67e4b.web.app and sign into your Weekdeck account. Your planner uses the same Firebase account and data as your computer.

## iPhone or iPad

1. Open the link in Safari.
2. Tap Share, then Add to Home Screen. Confirm Add (or Open as Web App if offered).
3. Open Weekdeck using that new Home Screen icon.
4. After the reminder service is connected, open Settings > Notifications > Enable and allow notifications.
5. Choose your weekly planning time and block alerts, then Save settings. Use Test notification to check the device.

Web Push requires iOS/iPadOS 16.4 or newer and a Home Screen web app. No Apple Developer membership is required. [Apple/WebKit documentation](https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/).

## Android

1. Open the link in Chrome.
2. Use the browser menu's Add to Home screen or Install app action.
3. Open Weekdeck, sign in, then use Settings > Notifications > Enable after the server is connected.
4. Save your reminder choices and use Test notification.

Use a current browser that supports Web Push. Device permission is separate from the preferences saved to your account.

## Owner: finish the free service setup

The Cloudflare account is created, but CLI authorization has not completed. The notification code is prepared; background delivery is not live yet.

The simplest next step is to retry at home:

1. Open this project in Codex.
2. Ask Codex to retry the Cloudflare connection.
3. Approve the fresh Cloudflare authorization page within two minutes.

Codex can deploy the service and connect the website after approval. You do not need to paste code into the Cloudflare dashboard, buy a domain, add a card, or share keys. The previous timeout does not establish whether a VPN, Wi-Fi network, browser callback, or expired login caused it. Do not bypass school or workplace security policies.

Maintainer commands and the verification checklist are in [NOTIFICATIONS.md](NOTIFICATIONS.md).

## What to expect

Reminders can arrive while the installed web app is closed, once the service is connected and permissions are enabled. They need internet access and may be delayed by Focus/Do Not Disturb, power settings, or push-provider availability. They are reminders, not guaranteed exact alarms.

Block reminders cover the next 14 days and refresh when a connected, current-version Weekdeck session opens or changes the schedule. Weekly reminders recur in the receiving device's saved timezone. Reopen on each phone at least every 90 days to keep its subscription active, and after changing timezone. Old native preview downloads do not update this new server queue.
