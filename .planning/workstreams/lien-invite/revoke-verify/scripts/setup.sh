#!/usr/bin/env bash
# Derived from scripts/founder-offer-go-live/uat/01-setup.sh. Own ports; applies all portfolio migrations EXCEPT 20261107170000 (applied later by apply-revoke.sh).
set -euo pipefail
REPO=/c/ziko-platform/.claude/worktrees/revoke-verify
UATD="$REPO/scripts/founder-offer-go-live/uat"
export UAT_ROOT="$TEMP/ziko-uat-rv" UAT_PG_PORT=54520 UAT_REST_PORT=3222 UAT_GW_PORT=3220 UAT_AUTH_PORT=3221 UAT_WEB_PORT=3223
source "$UATD/00-env.sh"
POSTGREST="$TEMP/uat-pgrst/postgrest.exe"; GOTRUE="$TEMP/uat-gotrue/gotrue.exe"
LOCK=C:/ziko-platform/.planning/.machine-lock
mkdir -p "$UAT_ROOT"
for i in $(seq 1 25); do
  if mkdir "$LOCK" 2>/dev/null; then break; fi
  echo "machine lock held, waiting 60s ($i)"; sleep 60
done
[ -d "$LOCK" ] || { echo "no lock"; exit 2; }
trap 'rmdir "$LOCK" 2>/dev/null || true' EXIT
rm -rf "$UAT_PGDATA"
"$PGBIN/initdb" -D "$UAT_PGDATA" -U postgres --auth=trust -E UTF8 >/dev/null
"$PGBIN/pg_ctl" -D "$UAT_PGDATA" -o "-p $UAT_PG_PORT -c listen_addresses=127.0.0.1 -c fsync=off" -l "$UAT_ROOT/pg.log" -w start >/dev/null
PSQL=("$PGBIN/psql" -h 127.0.0.1 -p "$UAT_PG_PORT" -U postgres -v ON_ERROR_STOP=1 -q)
"${PSQL[@]}" -f "$UATD/roles.sql"
rmdir "$LOCK" 2>/dev/null || true
export GOTRUE_DB_DRIVER=postgres DATABASE_URL="postgres://supabase_auth_admin@127.0.0.1:$UAT_PG_PORT/postgres?search_path=auth" DB_NAMESPACE=auth GOTRUE_DB_NAMESPACE=auth
export GOTRUE_JWT_SECRET="$UAT_JWT_SECRET" GOTRUE_JWT_EXP=3600 GOTRUE_JWT_AUD=authenticated GOTRUE_JWT_DEFAULT_GROUP_NAME=authenticated
export GOTRUE_SITE_URL="http://127.0.0.1:$UAT_WEB_PORT" API_EXTERNAL_URL="$UAT_AUTH_URL"
export GOTRUE_API_HOST=127.0.0.1 GOTRUE_API_PORT=$UAT_AUTH_PORT PORT=$UAT_AUTH_PORT
export GOTRUE_MAILER_AUTOCONFIRM=true GOTRUE_DISABLE_SIGNUP=false GOTRUE_EXTERNAL_EMAIL_ENABLED=true
export GOTRUE_SMTP_HOST=127.0.0.1 GOTRUE_SMTP_PORT=1 GOTRUE_SMTP_USER=x GOTRUE_SMTP_PASS=x GOTRUE_SMTP_ADMIN_EMAIL=uat@example.invalid GOTRUE_LOG_LEVEL=warn
"$GOTRUE" migrate >"$UAT_ROOT/gotrue-migrate.log" 2>&1 || { tail -20 "$UAT_ROOT/gotrue-migrate.log"; exit 1; }
nohup "$GOTRUE" >"$UAT_ROOT/gotrue.log" 2>&1 &
echo $! >"$UAT_ROOT/gotrue.pid"
"${PSQL[@]}" -c "GRANT ALL ON ALL TABLES IN SCHEMA auth TO service_role; GRANT SELECT ON auth.users TO authenticated, anon;" >/dev/null
sed -e '/CREATE EXTENSION IF NOT EXISTS pg_net;/d' "$REPO/scripts/portfolio-migration/00-bootstrap-supabase-functions.sql" >"$UAT_ROOT/00-bootstrap.sql"
"${PSQL[@]}" -f "$UAT_ROOT/00-bootstrap.sql"
for f in $(ls "$REPO"/supabase/portfolio-migrations/*.sql | sort); do
  case "$f" in *storage_policies*|*20261107170000*) echo "skip $f"; continue;; esac
  echo "applying $f"
  sed -e '/CREATE EXTENSION IF NOT EXISTS pg_net;/d' "$f" >"$UAT_ROOT/mig.sql"
  "${PSQL[@]}" -f "$UAT_ROOT/mig.sql"
done
"${PSQL[@]}" -c "GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;" >/dev/null
"${PSQL[@]}" -c "ALTER ROLE authenticator PASSWORD 'uat'" >/dev/null
export PGRST_DB_URI="postgres://authenticator:uat@127.0.0.1:$UAT_PG_PORT/postgres" PGRST_DB_SCHEMAS=public PGRST_DB_ANON_ROLE=anon PGRST_JWT_SECRET="$UAT_JWT_SECRET"
export PGRST_SERVER_HOST=127.0.0.1 PGRST_SERVER_PORT=$UAT_REST_PORT PGRST_DB_POOL=10
nohup "$POSTGREST" >"$UAT_ROOT/postgrest.log" 2>&1 &
echo $! >"$UAT_ROOT/postgrest.pid"
for i in $(seq 1 30); do curl -fs "http://127.0.0.1:$UAT_REST_PORT/" >/dev/null 2>&1 && break; sleep 1; done
nohup node "$UATD/gateway.mjs" $UAT_GW_PORT $UAT_REST_PORT $UAT_AUTH_PORT >"$UAT_ROOT/gateway.log" 2>&1 &
echo $! >"$UAT_ROOT/gateway.pid"
node "$UATD/mint-keys.mjs" >"$UAT_ROOT/keys.env"
echo "stack up (pre-revoke): PG $UAT_PG_PORT GW $UAT_GW_PORT"
