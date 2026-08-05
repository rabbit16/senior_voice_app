#!/bin/bash
set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
export JAVA_HOME="$HOME/.local/jdks/jdk17"
export ANDROID_HOME="$HOME/Android/Sdk"
export ANDROID_SDK_ROOT="$ANDROID_HOME"
export PATH="$JAVA_HOME/bin:$PATH:$ANDROID_HOME/platform-tools:$ANDROID_HOME/emulator:$ANDROID_HOME/cmdline-tools/latest/bin"

cd "$PROJECT_DIR"

# 支持打包时覆盖后端地址：
#   API_BASE_URL=http://10.0.0.8:8000 npm run build:android
# 或不传环境变量，直接改 config/api.json 后打包。
if [ -n "${API_BASE_URL:-}" ]; then
  API_BASE_URL="$API_BASE_URL" python3 - <<'PY'
import json
import os
from pathlib import Path

path = Path("config/api.json")
data = json.loads(path.read_text(encoding="utf-8"))
data["apiBaseUrl"] = os.environ["API_BASE_URL"].rstrip("/")
path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
print(f"[INFO] API_BASE_URL overridden to: {data['apiBaseUrl']}")
PY
else
  python3 - <<'PY'
import json
from pathlib import Path

data = json.loads(Path("config/api.json").read_text(encoding="utf-8"))
print(f"[INFO] Using API base URL: {data.get('apiBaseUrl')}")
PY
fi

if ! command -v node >/dev/null 2>&1; then
  echo "[ERROR] node not found. Reopen terminal or install Node.js."
  exit 1
fi

if ! command -v java >/dev/null 2>&1; then
  echo "[ERROR] Java not found. Expected JDK 17 at $JAVA_HOME."
  exit 1
fi

if [ ! -d "$ANDROID_HOME" ]; then
  echo "[ERROR] Android SDK not found at $ANDROID_HOME."
  echo "Run: npm run doctor:android"
  exit 1
fi

if [ ! -d node_modules ]; then
  echo "[INFO] Installing npm dependencies..."
  npm install
fi

python3 - <<'PY'
from pathlib import Path
p = Path('android/gradle/wrapper/gradle-wrapper.properties')
s = p.read_text()
s = s.replace('networkTimeout=10000', 'networkTimeout=120000')
s = s.replace('https\\://services.gradle.org/distributions/gradle-9.3.1-bin.zip', 'https\\://mirrors.cloud.tencent.com/gradle/gradle-9.3.1-bin.zip')
p.write_text(s)
PY

echo "[INFO] Building Android Release APK..."
cd android
./gradlew assembleRelease

echo "[DONE] APK generated:"
echo "$PROJECT_DIR/android/app/build/outputs/apk/release/app-release.apk"
