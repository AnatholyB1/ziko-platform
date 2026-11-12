#!/usr/bin/env bash
# Ouvre le dev-client Ziko sur le Metro de la machine (port reserve 8281) et attend que le bundle soit charge.
# Usage: bash scripts/uat/dev-open.sh [port=8281] [wait_s=150]
set -euo pipefail
PORT="${1:-8281}"; WAIT="${2:-150}"
adb reverse tcp:$PORT tcp:$PORT >/dev/null
adb shell am force-stop com.ziko.mobile
adb shell "am start -W -a android.intent.action.VIEW -d \"ziko://expo-development-client/?url=http://localhost:$PORT\"" >/dev/null
sleep "$WAIT"
