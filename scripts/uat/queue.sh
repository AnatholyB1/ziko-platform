#!/usr/bin/env bash
# HARN-06 serialized UAT queue on top of the machine lock (mkdir atomic, stale after 25 min).
#   queue.sh acquire <phase> <flow>   waits (poll 60s, max 60 min) then takes the lock and logs start
#   queue.sh release <phase> <flow>   logs end and removes the lock
#   queue.sh status
# Lock lives in the integration worktree (shared by all agents); override with UAT_LOCK_DIR.
set -euo pipefail
LOCK="${UAT_LOCK_DIR:-C:/ziko-platform/.claude/worktrees/integration-v1.20/.planning/.machine-lock}"
REPO="$(cd "$(dirname "$0")/../.." && pwd)"
LOG="${UAT_QUEUE_LOG:-$REPO/.planning/workstreams/uat-mobile/uat-queue.log}"
now() { date -Iseconds; }
mtime() { stat -c %Y "$LOCK" 2>/dev/null || echo 0; }
case "${1:?cmd}" in
  acquire)
    P="${2:?phase}"; F="${3:?flow}"; deadline=$((SECONDS+3600))
    while ! mkdir "$LOCK" 2>/dev/null; do
      age=$(( $(date +%s) - $(mtime) ))
      if [ "$age" -gt 1500 ]; then echo "stale lock ($age s), taking over"; rmdir "$LOCK" 2>/dev/null || true; continue; fi
      [ $SECONDS -ge $deadline ] && { echo "queue timeout" >&2; exit 1; }
      echo "locked ($age s old), waiting 60s"; sleep 60
    done
    echo "$(now) START phase=$P flow=$F" >> "$LOG";;
  release)
    echo "$(now) END   phase=${2:-?} flow=${3:-?}" >> "$LOG"; rmdir "$LOCK" 2>/dev/null || true;;
  status)
    if [ -d "$LOCK" ]; then echo "LOCKED ($(( $(date +%s) - $(mtime) )) s)"; else echo "free"; fi;;
esac
