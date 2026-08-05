#!/bin/bash
set -euo pipefail

export JAVA_HOME="$HOME/.local/jdks/jdk17"
export ANDROID_HOME="$HOME/Android/Sdk"
export ANDROID_SDK_ROOT="$ANDROID_HOME"
export PATH="$JAVA_HOME/bin:$PATH:$ANDROID_HOME/platform-tools:$ANDROID_HOME/emulator:$ANDROID_HOME/cmdline-tools/latest/bin"

echo "== Node / npm =="
bash -ic 'node --version && npm --version && npx --version'

echo "\n== Java =="
java -version

echo "\n== Android SDK =="
echo "ANDROID_HOME=$ANDROID_HOME"
echo "ANDROID_SDK_ROOT=$ANDROID_SDK_ROOT"

if command -v adb >/dev/null 2>&1; then
  echo "adb: $(command -v adb)"
  adb devices
else
  echo "adb: NOT FOUND"
fi

if command -v emulator >/dev/null 2>&1; then
  echo "emulator: $(command -v emulator)"
  emulator -list-avds || true
else
  echo "emulator: NOT FOUND"
fi

if command -v sdkmanager >/dev/null 2>&1; then
  echo "sdkmanager: $(command -v sdkmanager)"
else
  echo "sdkmanager: NOT FOUND"
fi

if [ -d "$ANDROID_HOME" ]; then
  echo "\nInstalled SDK packages:"
  sdkmanager --sdk_root="$ANDROID_HOME" --list_installed | sed -n '1,40p'
fi
