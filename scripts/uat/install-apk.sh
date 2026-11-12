#!/usr/bin/env bash
# Install the dev-client APK on the UAT emulator. Usage: install-apk.sh <path-to.apk>
# The APK comes from `eas build --profile uat-dev` (run by the user/orchestrator, see README).
set -euo pipefail
. "$(dirname "$0")/env.sh"
APK="${1:?usage: install-apk.sh <apk>}"
[ -f "$APK" ] || { echo "apk not found: $APK" >&2; exit 1; }
adb -s "$UAT_SERIAL" install -r -g "$APK"
adb -s "$UAT_SERIAL" shell pm list packages | grep -q "$UAT_PKG" && echo "installed $UAT_PKG"
# Metro (dev-client) is reached through the emulator host alias 10.0.2.2:<port>; map port with reverse as well.
adb -s "$UAT_SERIAL" reverse tcp:8281 tcp:8281 || true
