#!/bin/bash
# Build the Android app locally with `eas build --local`. Run from apps/mobile:
#   ./scripts/build-android-local.sh [profile] [extra eas build args...]
# profile defaults to production (development / preview / production).
#
# JDK: Android Studio's bundled JDK (JBR) is used even when JAVA_HOME is set, because a newer
# JDK breaks the RN Gradle build (JDK 27: "Unsupported class file major version 71"). Set
# ANDROID_JAVA_HOME to use another JDK. Without Android Studio, JAVA_HOME is used as is.
#
# Gradle memory: the prebuilt gradle.properties gives the daemon too little Metaspace for
# :app:packageReleaseBundle (OutOfMemoryError: Metaspace, then the build hangs). The project's
# gradle.properties is regenerated during the build, so org.gradle.jvmargs is set in
# ~/.gradle/gradle.properties (which takes precedence) for the build and restored on exit.
# Override with GRADLE_JVMARGS. Other Gradle builds started meanwhile also get these args.
#
# Extra args are passed to eas build. A production build bumps the EAS-side versionCode even
# if it fails. Without --output, the artifact goes to
# <repo>/out_mobile/feedown-<version>-<profile>-<date>.(aab|apk) (production = AAB, others = APK).
set -euo pipefail

cd "$(dirname "$0")/.."

PROFILE=production
if [ $# -gt 0 ] && [ "${1#-}" = "$1" ]; then
  PROFILE="$1"
  shift
fi

# ---- JDK ----------------------------------------------------------------------
STUDIO_JBR="/Applications/Android Studio.app/Contents/jbr/Contents/Home"
if [ -n "${ANDROID_JAVA_HOME:-}" ]; then
  export JAVA_HOME="$ANDROID_JAVA_HOME"
elif [ -d "$STUDIO_JBR" ]; then
  export JAVA_HOME="$STUDIO_JBR"
fi
echo "[build-android-local] JAVA_HOME=${JAVA_HOME:-<unset>}"
if [ -n "${JAVA_HOME:-}" ] && [ -x "$JAVA_HOME/bin/java" ]; then
  "$JAVA_HOME/bin/java" -version 2>&1 | head -1 | sed 's/^/[build-android-local] /'
fi

# ---- Gradle memory ----------------------------------------------------------------
GRADLE_JVMARGS="${GRADLE_JVMARGS:--Xmx4g -XX:MaxMetaspaceSize=1g -Dfile.encoding=UTF-8}"
GRADLE_HOME_DIR="${GRADLE_USER_HOME:-$HOME/.gradle}"
GRADLE_PROPS="$GRADLE_HOME_DIR/gradle.properties"
GRADLE_PROPS_BACKUP=""
mkdir -p "$GRADLE_HOME_DIR"
if [ -f "$GRADLE_PROPS" ]; then
  GRADLE_PROPS_BACKUP="$(mktemp "${TMPDIR:-/tmp}/feedown-gradle-props.XXXXXX")"
  cp "$GRADLE_PROPS" "$GRADLE_PROPS_BACKUP"
fi

restore_gradle_props() {
  if [ -n "$GRADLE_PROPS_BACKUP" ]; then
    mv -f "$GRADLE_PROPS_BACKUP" "$GRADLE_PROPS"
  else
    rm -f "$GRADLE_PROPS"
  fi
  echo "[build-android-local] Restored $GRADLE_PROPS"
}
trap restore_gradle_props EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

{
  if [ -n "$GRADLE_PROPS_BACKUP" ]; then
    grep -v '^[[:space:]]*org\.gradle\.jvmargs' "$GRADLE_PROPS_BACKUP" || true
  fi
  echo "# Set by build-android-local.sh for the build; restored on exit"
  echo "org.gradle.jvmargs=$GRADLE_JVMARGS"
} > "$GRADLE_PROPS"
echo "[build-android-local] org.gradle.jvmargs=$GRADLE_JVMARGS (in $GRADLE_PROPS)"

# ---- Output path, unless --output (or --output=...) was passed -------------------------
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
