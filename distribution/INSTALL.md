# Install Weekdeck

Publisher: Voyager. Weekdeck 0.2.0.

## iPhone, iPad, and Android

Open https://weekdeck-67e4b.web.app. Add Weekdeck to the Home Screen using Safari's Share menu on iPhone/iPad or Chrome's Install/Add to Home screen action on Android. Sign into the same account as your computer.

No store account or purchase is needed. Web Push requires the separately configured reminder service and explicit device permission. If Settings says the server is awaiting setup, background reminders are not live yet. See https://github.com/Voyager162/WeekDeck/blob/main/docs/PHONE_SETUP.md.

## Desktop downloads

| Device                   | File                      |
| ------------------------ | ------------------------- |
| Windows 64-bit Intel/AMD | `*-win-x64.exe`           |
| Mac Apple silicon        | `*-mac-arm64.dmg`         |
| Mac Intel                | `*-mac-x64.dmg`           |
| Linux 64-bit Intel/AMD   | `*-linux-x86_64.AppImage` |

Run the Windows installer, drag the Mac app into Applications, or make the Linux AppImage executable and open it. Only trust https://github.com/Voyager162/WeekDeck/releases and check SHA256SUMS.txt.

Windows is unsigned; Mac builds are ad-hoc signed, not notarized. Per-app operating-system warnings may appear. Do not disable OS security globally. Some Linux distributions require FUSE 2. There is no automatic updater.

Historical Android preview files may remain on older releases but are no longer the supported phone installation route. The old native app's reminders are separate: disable them or uninstall it to avoid duplicate alerts.

Support: weekdeckdev@gmail.com.
