#!/bin/bash
set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
export JAVA_HOME="$HOME/.local/jdks/jdk17"
export ANDROID_HOME="$HOME/Android/Sdk"
export ANDROID_SDK_ROOT="$ANDROID_HOME"
export PATH="$JAVA_HOME/bin:$PATH:$ANDROID_HOME/platform-tools:$ANDROID_HOME/emulator:$ANDROID_HOME/cmdline-tools/latest/bin"

cd "$PROJECT_DIR"

if ! command -v adb >/dev/null 2>&1; then
  echo "[ERROR] adb not found. Run npm run doctor:android first."
  exit 1
fi

adb devices
npm run android
