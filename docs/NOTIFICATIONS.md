# Mobile reminders

The shared settings UI stores reminder preferences in the user's private Firestore settings document. Notification permission and Android exact-alarm permission are device-local. Preferences syncing never automatically prompts another device for permission.

## Behavior

- Weekly planning: select a weekday and time. Advanced mode schedules each interval from the start through the inclusive end, capped at a four-hour range with at least 15 minutes between reminders. Each slot is a recurring native calendar notification, so weekly reminders continue without reopening the app.
- Block transitions: upcoming non-completed blocks generate start and finish reminders. Adjacent blocks generate one transition instead of duplicate start/end alerts. Optional five/ten-minute advance notices apply to starts.
- Native pending notifications are capped at 60, below iOS's 64-slot limit. Weekly reminders reserve slots first; the remaining slots hold chronologically upcoming block reminders within the next 14 days.
- The queue refreshes on schedule/preference changes while open, and when the app returns to the foreground. Sign-out cancels Weekdeck-owned notifications. Permission is checked before scheduling, and requested only through the Enable action.

These are **local notifications, not server push**. Changes made on another device while the phone app is suspended cannot update its pending notifications until it opens again. A busy schedule may fill the 60-slot queue before 14 days; reopen periodically to replenish it. Web and desktop settings sync but background notifications are only implemented in the native iOS/Android apps. Mobile browsers are not native installs.

## Native build and device checks

Dependencies: `@capacitor/local-notifications` and `@capacitor/app`. Run `npm run mobile:sync` on the build host. Android sync has been run from this workspace; iOS plugin resolution must be performed on a Mac with Xcode/Swift. The Android manifest includes POST_NOTIFICATIONS and SCHEDULE_EXACT_ALARM. The UI links to Android's exact-timing setting. OS power-saving, Focus/Do Not Disturb, denied permissions, and vendor policies can affect delivery. This implementation does not promise exact delivery under those conditions.

Before release, test on real iPhone and Android devices:

1. Fresh-install permission denial, later enablement, OS revocation, and re-entry.
2. Foreground/background delivery, locked-screen delivery, and app process termination.
3. Weekly calendar repetition and advanced intervals, including a phone restart and a timezone/DST change.
4. Start/finish reminders, adjacent blocks, completed blocks, and advance notices.
5. Remote schedule edits followed by foreground refresh; sign-out and account switch cancellation.
6. More than 60 pending events, Android exact-alarm settings, idle mode, and battery optimization.

Pure scheduling logic has automated tests. These do not replace physical-device notification verification. Reference: [Capacitor Local Notifications](https://capacitorjs.com/docs/apis/local-notifications).
