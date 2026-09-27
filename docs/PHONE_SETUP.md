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

## Native iPhone app

Cloudflare setup was cancelled. Web background reminders are not active. The new iPhone app uses local notifications instead; follow [iPhone App Store setup](IPHONE_APP_STORE.md) to install through TestFlight and publish. That workflow runs on GitHub's Mac, so the owner can manage it from Windows.

After installing the native iPhone app, sign in, open Settings > Notifications, enable this device, and save your reminder preferences. Hold a timing handle until the haptic tick before resizing; swipe normally to scroll. Open the app after edits on other devices to refresh pending block alerts.

Maintainer commands and the verification checklist are in [NOTIFICATIONS.md](NOTIFICATIONS.md).

## What to expect

Reminders can arrive while the installed web app is closed, once the service is connected and permissions are enabled. They need internet access and may be delayed by Focus/Do Not Disturb, power settings, or push-provider availability. They are reminders, not guaranteed exact alarms.

Block reminders cover the next 14 days and refresh when a connected, current-version Weekdeck session opens or changes the schedule. Weekly reminders recur in the receiving device's saved timezone. Reopen on each phone at least every 90 days to keep its subscription active, and after changing timezone. Old native preview downloads do not update this new server queue.
