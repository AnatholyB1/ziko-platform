#!/usr/bin/env bash
# Demarre fake-upstash (8210), fake-anthropic (8211) puis le backend Hono UAT (8200).
# Prerequis: backend/api/.env.uat (node scripts/uat/make-backend-env.mjs). JAMAIS .env.local.
set -euo pipefail
REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
API="$REPO/backend/api"
ENVF="$API/.env.uat"
LOGS="${UAT_BACKEND_LOGS:-$REPO/uat-evidence/backend}"
mkdir -p "$LOGS"
[ -f "$ENVF" ] || { echo "manque $ENVF: lance node scripts/uat/make-backend-env.mjs"; exit 1; }

# Garde: l'URL Supabase DOIT etre la branche jetable; la prod est interdite.
URL="$(grep '^SUPABASE_URL=' "$ENVF" | cut -d= -f2-)"
case "$URL" in *oloobswzsziidjwycthm*) ;; *) echo "REFUS: SUPABASE_URL ne cible pas la branche uat-v1-20"; exit 2;; esac
if grep -q 'ubxllsvanurkwkohzxau' "$ENVF"; then echo "REFUS: reference prod dans .env.uat"; exit 2; fi
# Les faux doivent etre locaux
grep -q '^UPSTASH_REDIS_REST_URL=http://127.0.0.1:8210$' "$ENVF" || { echo "REFUS: UPSTASH pas sur le faux local"; exit 2; }
grep -q '^ANTHROPIC_BASE_URL=http://127.0.0.1:8211' "$ENVF" || { echo "REFUS: ANTHROPIC_BASE_URL pas sur le faux local"; exit 2; }

port_up() { powershell.exe -NoProfile -Command "if (Get-NetTCPConnection -LocalPort $1 -State Listen -ErrorAction SilentlyContinue) { exit 0 } else { exit 1 }"; }
for p in 8200 8210 8211; do
  if port_up $p; then echo "port $p deja occupe: lance backend-stop.ps1 d'abord"; exit 3; fi
done

cd "$REPO"
nohup node scripts/uat/fake-upstash.mjs > "$LOGS/fake-upstash.log" 2>&1 &
nohup node scripts/uat/fake-anthropic.mjs > "$LOGS/fake-anthropic.log" 2>&1 &
sleep 1
cd "$API"
# PORT=8200 vient de .env.uat; pas de tsx watch (RAM partagee avec l'emulateur)
nohup "$REPO/node_modules/.bin/tsx" --env-file=.env.uat src/index.ts > "$LOGS/backend.log" 2>&1 &

for i in $(seq 1 60); do
  if curl -fs http://127.0.0.1:8200/health > /dev/null 2>&1; then echo "backend UAT OK: http://127.0.0.1:8200 (adb reverse tcp:8200 tcp:8200 ou 10.0.2.2:8200)"; exit 0; fi
  sleep 1
done
echo "backend pas pret apres 60 s, voir $LOGS/backend.log"; tail -20 "$LOGS/backend.log"; exit 4
