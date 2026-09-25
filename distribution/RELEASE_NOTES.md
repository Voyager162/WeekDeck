## Weekdeck 0.2.1 by Voyager

- Windows installer upgrades existing Weekdeck installations in place and stops with a message when the same version is already installed. Existing user data is preserved. This check is included in installers starting with 0.2.1; older installer files remain unchanged.

- Weekly time blocking with account sync, reusable presets, themes, responsive layouts, shared day hours, and keyboard day copying.
- Read-only schedule sharing by verified email, for one week or all weeks, with invitation acceptance and access revocation.
- Joint resizing of touching blocks, visible block durations including 15-minute blocks, and Ctrl/Command+Z undo and Ctrl/Command+Shift+Z redo.
- Updated rounded app icons and simplified planner controls.
- Installable Home Screen web app for iPhone/iPad and Android, replacing native store builds.
- Optional Cloudflare Free Web Push service for weekly planning and block transitions. **Background phone reminders are not live yet:** Cloudflare setup and physical-device verification are still pending. The app displays the actual setup status.
- Password-confirmed account deletion with cross-device write protection and reminder cleanup.

Desktop downloads: Windows x64, macOS Apple silicon/Intel, and Linux x64. Read INSTALL.md and verify SHA256SUMS.txt. Windows is unsigned; macOS is ad-hoc signed and unnotarized. No automatic updates are configured.

Phones use https://weekdeck-67e4b.web.app, added to the Home Screen. No App Store or Google Play membership is required. Existing historical releases are not retroactively changed by this source update.

Known limits: no durable offline editing; block reminders refresh a 14-day queue from connected current-version sessions; receiving subscriptions expire after 90 days of inactivity; physical-device push verification is required. See docs/PHONE_SETUP.md and docs/NOTIFICATIONS.md.

Support: weekdeckdev@gmail.com. Privacy: https://weekdeck-67e4b.web.app/privacy.
