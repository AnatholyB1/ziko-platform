#!/usr/bin/env bash
# Start the UAT emulator on 5554/5555 (single instance). Usage: emu-start.sh [--window] [--wait 300]
# Headless by default. Caller should hold the machine lock (queue.sh acquire) for UAT runs.
set -euo pipefail
. "$(dirname "$0")/env.sh"
MODE="-no-window"; WAIT=300
while [ $# -gt 0 ]; do case "$1" in --window) MODE="";; --wait) WAIT="$2"; shift;; esac; shift; done
if adb devices | grep -q "^$UAT_SERIAL"; then echo "already running"; exit 0; fi
mkdir -p "$UAT_EVIDENCE/_emulator"
LOG="$UAT_EVIDENCE/_emulator/emulator.log"
nohup emulator -avd "$UAT_AVD" -port "$UAT_CONSOLE_PORT" $MODE -no-snapshot-save -no-snapshot-load \
  -no-boot-anim -no-audio -memory 2048 -gpu swiftshader_indirect -camera-back virtualscene \
  > "$LOG" 2>&1 &
echo "emulator pid $! (log $LOG)"
end=$((SECONDS+WAIT))
until [ "$(adb -s "$UAT_SERIAL" shell getprop sys.boot_completed 2>/dev/null | tr -d '\r')" = "1" ]; do
  [ $SECONDS -ge $end ] && { echo "boot timeout" >&2; exit 1; }
  sleep 5
done
adb -s "$UAT_SERIAL" shell settings put global window_animation_scale 0
adb -s "$UAT_SERIAL" shell settings put global transition_animation_scale 0
adb -s "$UAT_SERIAL" shell settings put global animator_duration_scale 0
echo "booted: $(adb -s "$UAT_SERIAL" shell getprop ro.build.version.release | tr -d '\r') (serial $UAT_SERIAL)"
