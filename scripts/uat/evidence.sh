#!/usr/bin/env bash
# HARN-04 evidence helper. Evidence dir: uat-evidence/<phase>/<flow>/ (gitignored).
#   evidence.sh shot <phase> <flow> <name>     PNG screenshot
#   evidence.sh logcat-start <phase> <flow>    background logcat capture (pid file)
#   evidence.sh logcat-stop  <phase> <flow>
#   evidence.sh run <phase> <flow> <maestro.yaml> [env KEY=VAL ...]   maestro run + shots + logcat + result
set -euo pipefail
. "$(dirname "$0")/env.sh"
sub="${1:?cmd}"; PH="${2:?phase}"; FL="${3:?flow}"; shift 3 || true
D="$UAT_EVIDENCE/$PH/$FL"; mkdir -p "$D"
case "$sub" in
  shot) adb -s "$UAT_SERIAL" exec-out screencap -p > "$D/${1:?name}.png"; echo "$D/$1.png";;
  logcat-start)
    adb -s "$UAT_SERIAL" logcat -c
    nohup adb -s "$UAT_SERIAL" logcat -v threadtime > "$D/logcat.txt" 2>&1 & echo $! > "$D/.logcat.pid";;
  logcat-stop) [ -f "$D/.logcat.pid" ] && kill "$(cat "$D/.logcat.pid")" 2>/dev/null; rm -f "$D/.logcat.pid";;
  run)
    FLOW="${1:?yaml}"; shift
    ENVARGS=(); for kv in "$@"; do ENVARGS+=(-e "$kv"); done
    "$0" logcat-start "$PH" "$FL"
    set +e
    maestro --device "$UAT_SERIAL" test "${ENVARGS[@]}" --format junit --output "$D/maestro-result.xml" \
      --debug-output "$D/maestro-debug" --test-output-dir "$D/maestro-shots" "$FLOW" 2>&1 | tee "$D/maestro.log"
    rc=${PIPESTATUS[0]}
    set -e
    "$0" logcat-stop "$PH" "$FL"
    echo "exit=$rc" > "$D/RESULT.txt"; date -Iseconds >> "$D/RESULT.txt"
    exit $rc;;
esac
