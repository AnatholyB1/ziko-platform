#!/usr/bin/env bash
# v1.21 per-run reset (known good sequence): fresh athlete, empty fake script queue, assess hydration_log queued (SKIP=1),
# app data cleared, dev-client reopened on Metro 8281. Usage: bash scripts/uat/v121-reset-run.sh [wait_s]
set -euo pipefail
cd "$(dirname "$0")/../.."
. scripts/uat/env.sh
set -a; . ./.uat/env; set +a
node scripts/uat/create-fresh-athlete.mjs | cut -c1-110
bash scripts/uat/fake-script.sh clear
SKIP=1 bash scripts/uat/fake-script.sh assess hydration_log
adb reverse tcp:8200 tcp:8200 >/dev/null; adb reverse tcp:8281 tcp:8281 >/dev/null
adb shell pm clear com.ziko.mobile
bash scripts/uat/dev-open.sh 8281 "${1:-40}"
