#!/usr/bin/env bash
set -euo pipefail
for name in IOS_TEAM_ID IOS_CERTIFICATE_BASE64 IOS_CERTIFICATE_PASSWORD IOS_PROFILE_BASE64 ASC_KEY_BASE64 ASC_KEY_ID ASC_ISSUER_ID; do
  if [[ -z "${!name:-}" ]]; then echo "Missing signing configuration: $name"; exit 1; fi
done
umask 077
KEYCHAIN="$RUNNER_TEMP/weekdeck-signing.keychain-db"
PASSWORD=$(openssl rand -hex 24)
echo "::add-mask::$PASSWORD"
printf '%s' "$IOS_CERTIFICATE_BASE64" | base64 --decode > "$RUNNER_TEMP/weekdeck-signing.p12"
printf '%s' "$IOS_PROFILE_BASE64" | base64 --decode > "$RUNNER_TEMP/weekdeck.mobileprovision"
security create-keychain -p "$PASSWORD" "$KEYCHAIN"
security set-keychain-settings -lut 21600 "$KEYCHAIN"
security unlock-keychain -p "$PASSWORD" "$KEYCHAIN"
security import "$RUNNER_TEMP/weekdeck-signing.p12" -P "$IOS_CERTIFICATE_PASSWORD" -A -t cert -f pkcs12 -k "$KEYCHAIN"
security set-key-partition-list -S apple-tool:,apple: -k "$PASSWORD" "$KEYCHAIN" >/dev/null
security list-keychains -d user -s "$KEYCHAIN" login.keychain-db
security cms -D -i "$RUNNER_TEMP/weekdeck.mobileprovision" > "$RUNNER_TEMP/weekdeck-profile.plist"
UUID=$(/usr/libexec/PlistBuddy -c 'Print UUID' "$RUNNER_TEMP/weekdeck-profile.plist")
TEAM=$(/usr/libexec/PlistBuddy -c 'Print TeamIdentifier:0' "$RUNNER_TEMP/weekdeck-profile.plist")
APP=$(/usr/libexec/PlistBuddy -c 'Print Entitlements:application-identifier' "$RUNNER_TEMP/weekdeck-profile.plist")
[[ "$TEAM" == "$IOS_TEAM_ID" && "$APP" == "$TEAM.com.voyager162.timeblocker" ]] || { echo 'Provisioning profile is for a different team or app.'; exit 1; }
mkdir -p "$HOME/Library/MobileDevice/Provisioning Profiles" "$HOME/.appstoreconnect/private_keys"
cp "$RUNNER_TEMP/weekdeck.mobileprovision" "$HOME/Library/MobileDevice/Provisioning Profiles/$UUID.mobileprovision"
printf '%s' "$ASC_KEY_BASE64" | base64 --decode > "$HOME/.appstoreconnect/private_keys/AuthKey_$ASC_KEY_ID.p8"
xcodebuild -project ios/App/App.xcodeproj -scheme App -configuration Release -destination 'generic/platform=iOS' -archivePath "$RUNNER_TEMP/Weekdeck.xcarchive" DEVELOPMENT_TEAM="$IOS_TEAM_ID" CODE_SIGN_STYLE=Manual CODE_SIGN_IDENTITY='Apple Distribution' PROVISIONING_PROFILE_SPECIFIER="$UUID" IPHONEOS_DEPLOYMENT_TARGET=16.4 MARKETING_VERSION=0.3.0 CURRENT_PROJECT_VERSION="$GITHUB_RUN_NUMBER" archive
EXPORT="$RUNNER_TEMP/weekdeck-export.plist"
/usr/libexec/PlistBuddy -c 'Clear dict' "$EXPORT"
/usr/libexec/PlistBuddy -c 'Add method string app-store-connect' "$EXPORT"
/usr/libexec/PlistBuddy -c "Add teamID string $IOS_TEAM_ID" "$EXPORT"
/usr/libexec/PlistBuddy -c 'Add signingStyle string manual' "$EXPORT"
/usr/libexec/PlistBuddy -c 'Add provisioningProfiles dict' "$EXPORT"
/usr/libexec/PlistBuddy -c "Add provisioningProfiles:com.voyager162.timeblocker string $UUID" "$EXPORT"
xcodebuild -exportArchive -archivePath "$RUNNER_TEMP/Weekdeck.xcarchive" -exportOptionsPlist "$EXPORT" -exportPath "$RUNNER_TEMP/weekdeck-export"
IPA=$(find "$RUNNER_TEMP/weekdeck-export" -name '*.ipa' -print -quit)
[[ -n "$IPA" ]] || { echo 'No IPA was exported.'; exit 1; }
xcrun altool --upload-app --type ios --file "$IPA" --apiKey "$ASC_KEY_ID" --apiIssuer "$ASC_ISSUER_ID"
