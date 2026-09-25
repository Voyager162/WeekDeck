## Weekdeck beta by Voyager

- Weekly time blocking with account sync, reusable presets, themes, mobile layouts, and native mobile reminders.
- Fixed day copying: both start and end hours now copy exactly. Merging refuses to discard existing blocks outside those hours.
- Shared day hours, direct block deletion, and keyboard day copying.
- Password-confirmed account deletion across all weeks, with a deletion lock that prevents stale devices from restoring removed data.

### Choose a download

- Windows: `win-x64.exe`
- Apple silicon Mac: `mac-arm64.dmg`
- Intel Mac: `mac-x64.dmg`
- Linux: `linux-x86_64.AppImage`
- Android preview: `android-preview.apk`
- iPhone/iPad: not available as an installable download yet. Apple developer enrollment and signing are still required. The web app is available at https://weekdeck-67e4b.web.app.

Read `INSTALL.md` and verify `SHA256SUMS.txt`. Windows is unsigned; macOS is ad-hoc signed but not notarized; Android uses a debug-signed preview identity. These are testing builds, not store-approved production releases. No automatic updates are configured.

Unsigned iOS archive and Android AAB preparation artifacts are available from the corresponding GitHub Actions run for developers, not as end-user downloads. They cannot be submitted as-is without signing and completing the store checklist.

Support: weekdeckdev@gmail.com. Public support and privacy pages are available at https://weekdeck-67e4b.web.app/support and https://weekdeck-67e4b.web.app/privacy.

Known limits: mobile reminders refresh after foregrounding the app, no durable offline editing, physical-device notification checks remain required, and store enrollment/signing are not complete. See the repository's `docs/STORE_SUBMISSION.md` for next steps.
