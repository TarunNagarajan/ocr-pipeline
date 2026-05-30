#!/usr/bin/env bash
#
# Build Android APK locally
# ==========================
# 1. Exports Next.js app as static HTML (using capacitor-specific config)
# 2. Syncs the output with Capacitor's Android project
# 3. Builds the release APK via Gradle
#
# Prerequisites:
#   - Node.js 22+
#   - Java JDK 17+
#   - Android SDK (set ANDROID_HOME or ANDROID_SDK_ROOT)
#   - Android SDK platform "android-34" and build-tools installed
#
# Usage:
#   bash scripts/build-android.sh [--release|--debug]
#

set -euo pipefail

BUILD_MODE="${1:-release}"
cd "$(dirname "$0")/.."

echo "── Building Next.js for Capacitor (static export) ──"
# BUILD_TARGET=capacitor triggers static export in next.config.ts
NEXT_PUBLIC_API_URL="${NEXT_PUBLIC_API_URL:-https://credential-lens-api-54011184572.asia-south1.run.app}" \
  BUILD_TARGET=capacitor npx next build

echo ""
echo "── Syncing web assets to Capacitor Android project ──"
npx cap sync android

echo ""
echo "── Building Android APK (${BUILD_MODE}) ──"
if [ "$BUILD_MODE" = "release" ]; then
  cd android
  ./gradlew assembleRelease
  cd ..
  echo ""
  echo "✓ APK generated at: android/app/build/outputs/apk/release/app-release.apk"
else
  cd android
  ./gradlew assembleDebug
  cd ..
  echo ""
  echo "✓ APK generated at: android/app/build/outputs/apk/debug/app-debug.apk"
fi

echo ""
echo "── Done ──"
