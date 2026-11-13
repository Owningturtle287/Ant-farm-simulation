#!/bin/bash
set -euo pipefail

# Only invoked by a manually dispatched job. Secret contents are never printed.
for name in BUILD_CERTIFICATE_BASE64 P12_PASSWORD BUILD_PROVISION_PROFILE_BASE64; do
  if [[ -z "${!name:-}" ]]; then
    echo "::error::Missing repository secret: $name. See docs/DELIVERY.md."
    exit 1
  fi
done

SIGNING_KEYCHAIN="$RUNNER_TEMP/antfarm-signing.keychain-db"
SIGNING_PROFILE="$RUNNER_TEMP/antfarm.mobileprovision"
SIGNING_CERTIFICATE="$RUNNER_TEMP/antfarm.p12"
PROFILE_INSTALL_PATH=""
SIGNING_PASSWORD="$(openssl rand -hex 24)"
echo "::add-mask::$SIGNING_PASSWORD"

cleanup() {
  security delete-keychain "$SIGNING_KEYCHAIN" >/dev/null 2>&1 || true
  if [[ -n "$PROFILE_INSTALL_PATH" ]]; then rm -f "$PROFILE_INSTALL_PATH"; fi
  rm -f "$SIGNING_PROFILE" "$SIGNING_CERTIFICATE" "$RUNNER_TEMP/profile.plist"
}
trap cleanup EXIT

printf '%s' "$BUILD_CERTIFICATE_BASE64" | base64 --decode > "$SIGNING_CERTIFICATE"
printf '%s' "$BUILD_PROVISION_PROFILE_BASE64" | base64 --decode > "$SIGNING_PROFILE"
security create-keychain -p "$SIGNING_PASSWORD" "$SIGNING_KEYCHAIN"
security set-keychain-settings -lut 21600 "$SIGNING_KEYCHAIN"
security unlock-keychain -p "$SIGNING_PASSWORD" "$SIGNING_KEYCHAIN"
security import "$SIGNING_CERTIFICATE" -P "$P12_PASSWORD" -A -t cert -f pkcs12 -k "$SIGNING_KEYCHAIN" >/dev/null
security set-key-partition-list -S apple-tool:,apple: -k "$SIGNING_PASSWORD" "$SIGNING_KEYCHAIN" >/dev/null
security list-keychains -d user -s "$SIGNING_KEYCHAIN" login.keychain-db
security cms -D -i "$SIGNING_PROFILE" > "$RUNNER_TEMP/profile.plist"

python3 - <<'PY'
import datetime, os, pathlib, plistlib
root = pathlib.Path(os.environ['RUNNER_TEMP'])
profile = plistlib.loads((root / 'profile.plist').read_bytes())
assert profile.get('ProvisionedDevices'), 'An ad hoc profile with registered devices is required.'
assert not profile.get('ProvisionsAllDevices', False), 'Enterprise profiles are not supported by this workflow.'
assert not profile['Entitlements'].get('get-task-allow', False), 'Use an ad hoc distribution profile, not a development profile.'
assert profile['ExpirationDate'] > datetime.datetime.now(datetime.timezone.utc).replace(tzinfo=None), 'Provisioning profile has expired.'
team = profile['TeamIdentifier'][0]
app_id = profile['Entitlements']['application-identifier']
bundle_id = app_id.split('.', 1)[1]
assert '*' not in bundle_id, 'Use an explicit application identifier.'
assert bundle_id == 'com.owningturtle.antfarm', 'Profile must match com.owningturtle.antfarm; update the project and workflow together if changing this ID.'
uuid = profile['UUID']
with open(os.environ['GITHUB_ENV'], 'a') as output:
    output.write(f'APPLE_TEAM_ID={team}\nPROFILE_UUID={uuid}\n')
options = {'method':'release-testing', 'teamID':team, 'signingStyle':'manual',
           'signingCertificate':'Apple Distribution',
           'provisioningProfiles':{bundle_id:uuid}, 'stripSwiftSymbols':True}
(root / 'ExportOptions.plist').write_bytes(plistlib.dumps(options))
PY

APPLE_TEAM_ID="$(/usr/libexec/PlistBuddy -c 'Print :TeamIdentifier:0' "$RUNNER_TEMP/profile.plist")"
PROFILE_UUID="$(/usr/libexec/PlistBuddy -c 'Print :UUID' "$RUNNER_TEMP/profile.plist")"
PROFILE_INSTALL_PATH="$HOME/Library/MobileDevice/Provisioning Profiles/$PROFILE_UUID.mobileprovision"
mkdir -p "$(dirname "$PROFILE_INSTALL_PATH")"
cp "$SIGNING_PROFILE" "$PROFILE_INSTALL_PATH"

xcodebuild -project AntFarm.xcodeproj -scheme AntFarm -configuration Release \
  -destination 'generic/platform=iOS' -archivePath build/AntFarm.xcarchive archive \
  DEVELOPMENT_TEAM="$APPLE_TEAM_ID" CODE_SIGN_STYLE=Manual \
  CODE_SIGN_IDENTITY='Apple Distribution' PROVISIONING_PROFILE_SPECIFIER="$PROFILE_UUID"
xcodebuild -exportArchive -archivePath build/AntFarm.xcarchive \
  -exportPath build/signed -exportOptionsPlist "$RUNNER_TEMP/ExportOptions.plist"
find build/signed -name '*.ipa' -print -quit | grep -q .
