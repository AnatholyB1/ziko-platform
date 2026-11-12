#!/usr/bin/env bash
# HARN-05 simulations on the UAT emulator. Usage: sim.sh <cmd> [args]
#   background [secs]      app to background (HOME) then foreground again after secs (default 5)
#   gps <lat> <lon>        set GPS fix            (e.g. 48.8566 2.3522)
#   route <file.gpx-like>  not supported; use repeated `gps`
#   camera-barcode <png>   copy image to virtual-scene poster (back camera shows it)
#   session-expiry [secs]  server-side ban/refresh failure (see sim-session-expiry.mjs)
#   network off|on         toggle wifi+data
set -euo pipefail
. "$(dirname "$0")/env.sh"
A="adb -s $UAT_SERIAL"
cmd="${1:?cmd}"; shift || true
case "$cmd" in
  background)
    $A shell input keyevent KEYCODE_HOME; sleep "${1:-5}"
    $A shell monkey -p "$UAT_PKG" -c android.intent.category.LAUNCHER 1 >/dev/null 2>&1 || true; echo "backgrounded ${1:-5}s then resumed";;
  gps)
    # emu geo fix takes lon lat
    $A emu geo fix "$2" "$1"; echo "gps set lat=$1 lon=$2";;
  camera-barcode)
    IMG="${1:?png}"
    AVD_DIR="$HOME/.android/avd/$UAT_AVD.avd"
    # Virtual scene poster is configured in the emulator's Toren1BD.posters file.
    POSTERS="$ANDROID_HOME/emulator/resources/Toren1BD.posters"
    cp "$IMG" "$AVD_DIR/barcode.png"
    printf 'poster all\nsize 0.4 0.4\nposition 0 -0.15 -1.2\nrotation 0 0 0\ndefault %s\n' "$(cygpath -m "$AVD_DIR/barcode.png")" > "$AVD_DIR/uat.posters"
    cp "$AVD_DIR/uat.posters" "$POSTERS" 2>/dev/null || echo "WARN: could not write $POSTERS (virtual scene poster); fall back to emulator extended controls > Camera"
    echo "barcode poster set; restart emulator for effect";;
  session-expiry) node "$UAT_REPO/scripts/uat/sim-session-expiry.mjs" ${1:+--seconds=$1};;
  network)
    if [ "${1:-}" = off ]; then $A shell svc wifi disable; $A shell svc data disable; else $A shell svc wifi enable; $A shell svc data enable; fi;;
  *) echo "unknown: $cmd" >&2; exit 1;;
esac
