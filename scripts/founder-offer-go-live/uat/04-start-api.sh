#!/usr/bin/env bash
# (Re)starts PostgREST (3144) and the Supabase-style gateway (3143) against the running disposable PG.
# 01-setup.sh does the same inline on a fresh stack; this is for restarts.
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
source "$HERE/00-env.sh"
POSTGREST="${POSTGREST:-${TEMP:-/tmp}/uat-pgrst/postgrest.exe}"
export PGRST_DB_URI="postgres://authenticator:uat@127.0.0.1:$UAT_PG_PORT/postgres"
export PGRST_DB_SCHEMAS=public PGRST_DB_ANON_ROLE=anon PGRST_JWT_SECRET="$UAT_JWT_SECRET"
export PGRST_SERVER_HOST=127.0.0.1 PGRST_SERVER_PORT=$UAT_REST_PORT PGRST_DB_POOL=10
nohup "$POSTGREST" >"$UAT_ROOT/postgrest.log" 2>&1 &
echo $! >"$UAT_ROOT/postgrest.pid"
nohup node "$HERE/gateway.mjs" $UAT_GW_PORT $UAT_REST_PORT $UAT_AUTH_PORT >"$UAT_ROOT/gateway.log" 2>&1 &
echo $! >"$UAT_ROOT/gateway.pid"
for i in $(seq 1 30); do curl -fs "$UAT_API_URL/rest/v1/" >/dev/null 2>&1 && break; sleep 1; done
echo "api up: PostgREST $UAT_REST_PORT, gateway $UAT_GW_PORT"
