# iPhone App Store Setup (No Personal Mac Required)

Weekdeck's iPhone code lives in `ios/`. GitHub's hosted Mac runs Xcode to build it. You can manage this from Windows. Builds require iOS/iPadOS 16.4 or later, matching the web runtime baseline. The simulator check needs no Apple credentials; installing through TestFlight and publishing require an active Apple Developer team and permission to manage certificates and App Store Connect. Being invited to someone else's account does not necessarily grant these permissions.

## 1. Register Weekdeck

1. Sign in at https://developer.apple.com/account and open Certificates, Identifiers & Profiles.
2. Under Identifiers, add an App ID with explicit Bundle ID `com.voyager162.timeblocker`, named Weekdeck. If that ID already belongs to this team, reuse it. If unavailable, stop and choose a new ID before the first App Store upload; update `capacitor.config.ts`, the generated iOS project via Capacitor, and the build scripts together.
3. No Push Notifications capability is required: this build uses local notifications, not a push server.
4. At https://appstoreconnect.apple.com, open My Apps, plus, New App. Choose iOS, Weekdeck, English, the Bundle ID above, and SKU `weekdeck-ios`. Set access for the appropriate team members. The legal seller name comes from the Apple account, not the Voyager label in the app.

## 2. Prepare Signing From Windows

This is a one-time certificate setup. A team administrator can instead give you an existing Apple Distribution `.p12` and its password, plus a matching App Store provisioning profile. Never put these in the source repository or a chat.

To create a certificate yourself, use the OpenSSL included with Git for Windows. Open **Git Bash** in this repository and run:

```bash
mkdir -p .ios-signing
openssl genrsa -aes256 -out .ios-signing/distribution.key 2048
MSYS_NO_PATHCONV=1 openssl req -new -key .ios-signing/distribution.key -out .ios-signing/distribution.csr -subj '/CN=Weekdeck Distribution/emailAddress=weekdeckdev@gmail.com'
```

Choose and retain a strong private-key password. Upload only `distribution.csr` when creating an **Apple Distribution** certificate in the Apple developer portal. Put the downloaded `.cer` into `.ios-signing/distribution.cer`, then run:

```bash
openssl x509 -inform DER -in .ios-signing/distribution.cer -out .ios-signing/distribution.pem
openssl pkcs12 -export -inkey .ios-signing/distribution.key -in .ios-signing/distribution.pem -out .ios-signing/distribution.p12
```

Choose and retain the export password. In Profiles on Apple's portal, create an **App Store Connect** distribution profile for Weekdeck and that certificate. Download it into `.ios-signing/Weekdeck.mobileprovision`. Keep an encrypted private backup. Do not revoke the certificate after uploading; future builds need it. Renew certificates/profiles before expiry.

## 3. Add GitHub Signing Secrets

In https://github.com/Voyager162/WeekDeck/settings/secrets/actions add repository secrets:

| Name                       | Value                                                   |
| -------------------------- | ------------------------------------------------------- |
| `IOS_CERTIFICATE_BASE64`   | Base64 contents of `distribution.p12`                   |
| `IOS_CERTIFICATE_PASSWORD` | The P12 export password                                 |
| `IOS_PROFILE_BASE64`       | Base64 contents of `Weekdeck.mobileprovision`           |
| `ASC_KEY_BASE64`           | Base64 contents of your App Store Connect API `.p8` key |
| `ASC_KEY_ID`               | Key ID from App Store Connect                           |
| `ASC_ISSUER_ID`            | Issuer ID from App Store Connect                        |

Add repository **variable** `IOS_TEAM_ID` with the Team ID from Apple Developer Membership Details. Existing Firebase public configuration variables are reused.

Create an App Store Connect team API key under Users and Access, Integrations, App Store Connect API. An administrator may need to enable API access. Use an App Manager key (or an appropriately authorized team key). Download it once and store it privately.

To place a file's base64 contents on your clipboard in PowerShell, use this pattern and paste directly into the matching GitHub secret:

```powershell
[Convert]::ToBase64String([IO.File]::ReadAllBytes((Resolve-Path '.ios-signing/distribution.p12'))) | Set-Clipboard
```

Repeat with the profile and `.p8` file for their corresponding secrets. These values are private, even when encoded. Clear the clipboard when finished. Never paste keys into Actions inputs, issues, release notes, or messages.

## 4. Build and Install on Your iPhone

1. Open GitHub, Actions, **iPhone App Store**. The normal run builds and launches a simulator app and attaches a screenshot, without signing or submitting anything.
2. Choose Run workflow, select main, and enable **Sign and upload to TestFlight**. This signs the build on GitHub's Mac and uploads it to Apple. It does not submit the app for public review.
3. Wait for the workflow and Apple's processing. In App Store Connect, open Weekdeck, TestFlight. Answer export-compliance questions accurately. Weekdeck uses platform HTTPS encryption; confirm the appropriate exemption for your distribution. The workflow does not make a legal declaration for you.
4. Add yourself as an internal tester, install Apple's TestFlight app on your iPhone, accept the invitation, and install Weekdeck.
5. Test account creation/login/deletion, shared schedules, portrait/landscape settings, time-zone travel, short blocks, hold-to-resize with haptics, and lock-screen reminders. Haptics cannot be validated in a simulator.

## 5. Complete the Store Listing

- Version: `0.3.0`. The workflow sets a unique increasing build number on each run. Select the processed build only after testing.
- Category: Productivity. Suggested subtitle: `Plan your week, block by block`.
- Support URL: https://weekdeck-67e4b.web.app/support
- Privacy URL: https://weekdeck-67e4b.web.app/privacy
- Contact: weekdeckdev@gmail.com. Confirm Voyager branding and copyright are appropriate for the legal developer account.
- Supply actual iPhone screenshots from the final build in the sizes App Store Connect requests. Do not submit browser screenshots as device verification. This project supports iPad too; provide iPad screenshots if Apple requests them.
- Complete Apple's current age-rating questionnaire, content-rights questions, availability, pricing, and applicable business/trader information.
- App Privacy: review email/contact info, user ID, and user content (schedule titles, notes, preferences, sharing details), linked to the account for app functionality. No advertising/tracking/analytics SDK is included. Review Firebase's actual processing and your own practices before certifying answers; the source alone is not a legal privacy determination.
- Create a dedicated working review account with harmless sample blocks and provide its credentials privately in App Review Information. Reviewers must be able to access the app. Keep it available during review.
- Account deletion is in Account and at the public account-deletion route. Email/password is the only sign-in provider; no third-party social login is added.
- Submit for review, choose manual release, and respond to any Apple questions. App Review approval cannot be guaranteed.

## Reminder and Upgrade Limits

Local alerts can fire with the iPhone app closed, without Cloudflare. The app queues up to 60 notifications, reserving room for a test. Repeating weekly reminders continue; block notifications refresh from up to 32 days of data when the iPhone app syncs. Dense schedules exhaust the queue sooner. Open Weekdeck regularly and after editing on a computer. Changes made remotely while the iPhone app stays closed do not update local alerts until it opens. Focus and system settings can silence alerts.

This is not background server push. Web-phone reminders remain unavailable with Cloudflare cancelled. Sign-out clears this device's pending notifications. Account deletion on another offline device cannot remotely erase already scheduled local alerts; reconnect or sign out on each device.

Update all desktop/web clients before editing a traveling schedule: older releases still interpret timestamps as absolute times. Existing records adopt their saved account/shared calendar zone on the first updated sign-in. If an older app overwrote that zone after travel, use Settings > Planner > Repair an older schedule and select the original planning zone. For San Diego to Austin travel, select `America/Los_Angeles`, then save. This reinterprets all stored blocks without rewriting their timestamps. Undo reverses the correction. Blocks created in different zones by older clients may need individual correction; do not apply a blanket correction if that is not their common original zone.

References: [Apple upload guidance](https://developer.apple.com/help/app-store-connect/manage-builds/upload-builds), [GitHub signing guidance](https://docs.github.com/en/actions/how-tos/deploy/deploy-to-third-party-platforms/sign-xcode-applications), [App Review](https://developer.apple.com/app-store/review/).
