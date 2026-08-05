#!/bin/bash
set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
export JAVA_HOME="$HOME/.local/jdks/jdk17"
export ANDROID_HOME="$HOME/Android/Sdk"
export ANDROID_SDK_ROOT="$ANDROID_HOME"
export PATH="$JAVA_HOME/bin:$PATH:$ANDROID_HOME/platform-tools:$ANDROID_HOME/emulator:$ANDROID_HOME/cmdline-tools/latest/bin"
cd "$PROJECT_DIR"

if ! command -v node >/dev/null 2>&1; then
  echo "[ERROR] node not found. Load nvm or install Node.js."
  exit 1
fi

if [ ! -d node_modules ]; then
  echo "[INFO] Installing npm dependencies..."
  npm install
fi

if [ ! -f android/gradle/wrapper/gradle-wrapper.properties ]; then
  echo "[ERROR] Gradle wrapper config not found."
  exit 1
fi

# Increase Gradle wrapper network timeout for slow networks and use a reachable mirror.
python3 - <<'PY'
from pathlib import Path
p = Path('android/gradle/wrapper/gradle-wrapper.properties')
s = p.read_text()
s = s.replace('networkTimeout=10000', 'networkTimeout=120000')
s = s.replace('https\\://services.gradle.org/distributions/gradle-9.3.1-bin.zip', 'https\\://mirrors.cloud.tencent.com/gradle/gradle-9.3.1-bin.zip')
p.write_text(s)
PY

echo "[INFO] Building debug APK. This may download Gradle and dependencies on first run."
cd android
./gradlew assembleDebug

echo "[DONE] APK generated at:"
echo "$PROJECT_DIR/android/app/build/outputs/apk/debug/app-debug.apk"
