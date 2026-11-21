#!/bin/bash
# Build the iOS app locally with `eas build --local`. Run from apps/mobile:
#   ./scripts/build-ios-local.sh [profile] [extra eas build args...]
# profile defaults to production (development / preview / production).
#
# If the login keychain holds a distribution certificate other than the one stored on EAS,
# Xcode picks it and fails with "Provisioning profile ... doesn't include signing certificate".
# So for the duration of the build, the user keychain search list is swapped for a throwaway
# keychain that only holds the Apple WWDR intermediate certificates, and the original list is
# restored on exit (including failures and Ctrl+C). Without the intermediates, EAS fails with
# "Distribution certificate ... hasn't been imported successfully".
#
# Extra args are passed to eas build. A production build bumps the EAS-side buildNumber even if
# it fails. Without --output, the .ipa goes to <repo>/out_mobile/feedown-<version>-<profile>-<date>.ipa.
# Simulator builds (development-simulator) are unsigned and do not need this script.
set -euo pipefail

cd "$(dirname "$0")/.."

PROFILE=production
if [ $# -gt 0 ] && [ "${1#-}" = "$1" ]; then
  PROFILE="$1"
  shift
fi

LOGIN_KEYCHAIN="$HOME/Library/Keychains/login.keychain-db"
WORK_DIR="$(mktemp -d -t feedown-ios-build)"
PLACEHOLDER="$WORK_DIR/placeholder.keychain-db"

# Remember the original search list (fall back to the login keychain if it is empty)
ORIGINAL_KEYCHAINS=()
while IFS= read -r line; do
  line="${line#"${line%%[![:space:]]*}"}"
  line="${line#\"}"
  line="${line%\"}"
  [ -n "$line" ] && ORIGINAL_KEYCHAINS+=("$line")
done < <(security list-keychains -d user)
[ ${#ORIGINAL_KEYCHAINS[@]} -eq 0 ] && ORIGINAL_KEYCHAINS=("$LOGIN_KEYCHAIN")

restore() {
  security list-keychains -d user -s "${ORIGINAL_KEYCHAINS[@]}"
  security delete-keychain "$PLACEHOLDER" 2>/dev/null || true
  rm -rf "$WORK_DIR"
  echo "[build-ios-local] Restored the keychain search list:"
  security list-keychains -d user
}
trap restore EXIT

# Create the throwaway keychain and copy the WWDR intermediates from the login keychain
security create-keychain -p "" "$PLACEHOLDER"
security unlock-keychain -p "" "$PLACEHOLDER"
security set-keychain-settings "$PLACEHOLDER" # no auto-lock

security find-certificate -a -p -c "Apple Worldwide Developer Relations" "$LOGIN_KEYCHAIN" \
  | awk -v dir="$WORK_DIR" '/BEGIN CERTIFICATE/ { n++ } { print > (dir "/wwdr-" n ".pem") }'
wwdr_files=("$WORK_DIR"/wwdr-*.pem)
if [ ! -e "${wwdr_files[0]}" ]; then
  echo "[build-ios-local] No Apple WWDR intermediate certificate in the login keychain" >&2
  exit 1
fi
for pem in "${wwdr_files[@]}"; do
  security add-certificates -k "$PLACEHOLDER" "$pem"
done
echo "[build-ios-local] Copied ${#wwdr_files[@]} WWDR intermediate certificate(s) to the throwaway keychain"

security list-keychains -d user -s "$PLACEHOLDER"

# Output path, unless --output (or --output=...) was passed
OUTPUT_ARGS=()
has_output=false
for arg in "$@"; do
  case "$arg" in --output | --output=*) has_output=true ;; esac
done
if [ "$has_output" = false ]; then
  OUT_DIR="$(cd ../.. && pwd)/out_mobile"
  mkdir -p "$OUT_DIR"
  VERSION="$(node -p "require('./app.json').expo.version")"
  OUTPUT_ARGS=(--output "$OUT_DIR/feedown-$VERSION-$PROFILE-$(date +%Y%m%d-%H%M%S).ipa")
  echo "[build-ios-local] Output: ${OUTPUT_ARGS[1]}"
fi

# xcodebuild -showBuildSettings can exceed fastlane's default timeout
FASTLANE_XCODEBUILD_SETTINGS_TIMEOUT=120 \
  eas build --profile "$PROFILE" --platform ios --local --non-interactive \
  ${OUTPUT_ARGS[@]+"${OUTPUT_ARGS[@]}"} "$@"
