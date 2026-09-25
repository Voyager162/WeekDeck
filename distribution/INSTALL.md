# Install the Weekdeck beta

Publisher: Voyager. This is a testing prerelease, not a signed production release.

| Device                     | Download                  | Install                                                                                                                                             |
| -------------------------- | ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| Windows (64-bit Intel/AMD) | `*-win-x64.exe`           | Run the installer. The publisher is not Microsoft-verified yet; Windows may warn or block it.                                                       |
| Mac with Apple silicon     | `*-mac-arm64.dmg`         | Open the image and drag Weekdeck into Applications. This beta is ad-hoc signed, not Apple-notarized.                                                |
| Mac with Intel             | `*-mac-x64.dmg`           | Same steps; choose the Intel download.                                                                                                              |
| Linux (64-bit Intel/AMD)   | `*-linux-x86_64.AppImage` | Make the file executable in Properties, then open it. Some distributions require FUSE 2.                                                            |
| Android                    | `*-android-preview.apk`   | Download on your phone, open it, and allow installation for that trusted browser/files app when prompted. Revoke that install permission afterward. |
| iPhone/iPad                | No installable file yet   | Apple enrollment and signing are required for TestFlight/App Store distribution. Use https://weekdeck-67e4b.web.app meanwhile.                      |

Only trust downloads from https://github.com/Voyager162/WeekDeck/releases. Compare SHA-256 hashes with `SHA256SUMS.txt` before overriding any warning. Do not disable operating-system security globally. On macOS an unnotarized app may require the per-app Open Anyway option in System Settings > Privacy & Security; managed devices may disallow this beta.

The Android APK uses a debug signing key and a separate `.beta` application ID. It is not a Play Store upload and future previews may require uninstall/reinstall. Sign into your account again afterward to restore cloud data. The production app will have a different install identity and a securely backed-up release signing key.

There is no automatic updater yet: install subsequent releases manually. Notifications are implemented in the native mobile apps, not the web/desktop versions. Remote edits refresh a phone's pending reminders when that app returns to the foreground, not while it is suspended.

CI builds native packages and smoke-tests desktop startup. A completed build is not a substitute for physical-device tests; test reminders, touch input, accessibility, and account deletion before depending on this beta. Do not store sensitive information in a testing release.
