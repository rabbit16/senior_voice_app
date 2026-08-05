#!/bin/bash
set -euo pipefail

echo "== Node / npm =="
bash -ic 'node --version && npm --version && npx --version'

echo "\n== Java =="
java -version

echo "\n== Android SDK environment =="
echo "ANDROID_HOME=${ANDROID_HOME:-}"
echo "ANDROID_SDK_ROOT=${ANDROID_SDK_ROOT:-}"

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

echo "\n== Expected paths =="
for p in "$HOME/Android/Sdk" "${ANDROID_HOME:-}" "${ANDROID_SDK_ROOT:-}"; do
  if [ -n "${p:-}" ] && [ -d "$p" ]; then
    echo "FOUND SDK DIR: $p"
    ls -la "$p" | head
  fi
done

echo "\n== Advice =="
if ! command -v adb >/dev/null 2>&1; then
  cat <<'TXT'
Android adb is missing. Install Android Studio, then install Android SDK Platform-Tools.
After installation, add these lines to ~/.bashrc or ~/.zshrc:

export ANDROID_HOME="$HOME/Android/Sdk"
export ANDROID_SDK_ROOT="$ANDROID_HOME"
export PATH="$PATH:$ANDROID_HOME/platform-tools:$ANDROID_HOME/emulator:$ANDROID_HOME/cmdline-tools/latest/bin"

Then reopen terminal and run: adb devices
TXT
fi
