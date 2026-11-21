#!/bin/bash
# Build the Android app locally with `eas build --local`. Run from apps/mobile:
#   ./scripts/build-android-local.sh [profile] [extra eas build args...]
# profile defaults to production (development / preview / production).
#
# Uses Android Studio's bundled JDK when JAVA_HOME is not set (Homebrew's JDK 20 is not
# supported by the RN Gradle toolchain). Extra args are passed to eas build. A production build
# bumps the EAS-side versionCode even if it fails. Without --output, the artifact goes to
# <repo>/out_mobile/feedown-<version>-<profile>-<date>.(aab|apk) (production = AAB, others = APK).
set -euo pipefail

cd "$(dirname "$0")/.."

PROFILE=production
if [ $# -gt 0 ] && [ "${1#-}" = "$1" ]; then
  PROFILE="$1"
  shift
fi

STUDIO_JBR="/Applications/Android Studio.app/Contents/jbr/Contents/Home"
if [ -z "${JAVA_HOME:-}" ] && [ -d "$STUDIO_JBR" ]; then
  export JAVA_HOME="$STUDIO_JBR"
fi
echo "[build-android-local] JAVA_HOME=${JAVA_HOME:-<unset>}"

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
  EXT=apk
  [ "$PROFILE" = production ] && EXT=aab
  OUTPUT_ARGS=(--output "$OUT_DIR/feedown-$VERSION-$PROFILE-$(date +%Y%m%d-%H%M%S).$EXT")
  echo "[build-android-local] Output: ${OUTPUT_ARGS[1]}"
fi

eas build --profile "$PROFILE" --platform android --local --non-interactive \
  ${OUTPUT_ARGS[@]+"${OUTPUT_ARGS[@]}"} "$@"
