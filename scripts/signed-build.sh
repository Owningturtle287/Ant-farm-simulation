#!/bin/bash
set -euo pipefail
python3 - <<'PY'
import base64, os, pathlib
required = ['BUILD_CERTIFICATE_BASE64','P12_PASSWORD','BUILD_PROVISION_PROFILE_BASE64']
missing = [key for key in required if not os.environ.get(key)]
if missing: raise SystemExit('Missing signing secrets: '+', '.join(missing))
root = pathlib.Path(os.environ['RUNNER_TEMP'])
for key, name in [('BUILD_CERTIFICATE_BASE64','signing.p12'),('BUILD_PROVISION_PROFILE_BASE64','profile.mobileprovision')]:
    (root/name).write_bytes(base64.b64decode(os.environ[key], validate=True))
PY
KEYCHAIN_PATH="$RUNNER_TEMP/antfarm-signing.keychain-db"
KEYCHAIN_PASSWORD="$(openssl rand -hex 24)"
cleanup() {
  security delete-keychain "$KEYCHAIN_PATH" 2>/dev/null || true
  rm -f "$RUNNER_TEMP/signing.p12" "$RUNNER_TEMP/profile.mobileprovision" "$RUNNER_TEMP/profile.plist"
  if [ -n "${PROFILE_PATH:-}" ]; then rm -f "$PROFILE_PATH"; fi
}
trap cleanup EXIT
security create-keychain -p "$KEYCHAIN_PASSWORD" "$KEYCHAIN_PATH"
security set-keychain-settings -lut 21600 "$KEYCHAIN_PATH"
security unlock-keychain -p "$KEYCHAIN_PASSWORD" "$KEYCHAIN_PATH"
security import "$RUNNER_TEMP/signing.p12" -P "$P12_PASSWORD" -A -t cert -f pkcs12 -k "$KEYCHAIN_PATH"
security set-key-partition-list -S apple-tool:,apple: -k "$KEYCHAIN_PASSWORD" "$KEYCHAIN_PATH" >/dev/null
security list-keychains -d user -s "$KEYCHAIN_PATH"
security cms -D -i "$RUNNER_TEMP/profile.mobileprovision" > "$RUNNER_TEMP/profile.plist"
TEAM_ID=$(/usr/libexec/PlistBuddy -c 'Print :TeamIdentifier:0' "$RUNNER_TEMP/profile.plist")
PROFILE_UUID=$(/usr/libexec/PlistBuddy -c 'Print :UUID' "$RUNNER_TEMP/profile.plist")
export TEAM_ID PROFILE_UUID
PROFILE_PATH="$HOME/Library/MobileDevice/Provisioning Profiles/$PROFILE_UUID.mobileprovision"
mkdir -p "$(dirname "$PROFILE_PATH")"
cp "$RUNNER_TEMP/profile.mobileprovision" "$PROFILE_PATH"
python3 - <<'PY'
import os, plistlib, pathlib
profile = plistlib.loads((pathlib.Path(os.environ['RUNNER_TEMP'])/'profile.plist').read_bytes())
app_id = profile['Entitlements']['application-identifier']
expected = os.environ['TEAM_ID']+'.com.owningturtle.antfarm'
if app_id != expected and app_id != os.environ['TEAM_ID']+'.*':
    raise SystemExit('Provisioning profile does not cover com.owningturtle.antfarm')
if not profile.get('ProvisionedDevices'):
    raise SystemExit('Provide an ad hoc profile with the target iPhone registered.')
options = {'method':'release-testing','teamID':os.environ['TEAM_ID'],'signingStyle':'manual','signingCertificate':'Apple Distribution','provisioningProfiles':{'com.owningturtle.antfarm':os.environ['PROFILE_UUID']}}
pathlib.Path('build').mkdir(exist_ok=True)
with open('build/ExportOptions.plist','wb') as stream: plistlib.dump(options,stream)
PY
xcodebuild -project AntFarm.xcodeproj -scheme AntFarm -configuration Release \
  -destination 'generic/platform=iOS' -archivePath build/AntFarm.xcarchive \
  CODE_SIGN_STYLE=Manual DEVELOPMENT_TEAM="$TEAM_ID" PROVISIONING_PROFILE_SPECIFIER="$PROFILE_UUID" \
  CODE_SIGN_IDENTITY='Apple Distribution' archive
xcodebuild -exportArchive -archivePath build/AntFarm.xcarchive \
  -exportOptionsPlist build/ExportOptions.plist -exportPath build/signed
