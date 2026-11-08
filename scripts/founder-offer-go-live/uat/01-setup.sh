#!/usr/bin/env bash
# Disposable Supabase-compatible stack: PG 54440, GoTrue 3142, gateway 3143 (/rest/v1 + /auth/v1), PostgREST 3144.
# Prereqs (no docker on this machine): local PostgreSQL (scoop), postgrest.exe v16.5 and a GoTrue
# build (supabase/auth v2.170.0, Windows patch: drop the SO_REUSEPORT Control hook in cmd/serve_cmd.go).
# Their locations default to $TEMP/uat-pgrst/postgrest.exe and $TEMP/uat-gotrue/gotrue.exe.
# Takes the machine lock only around the DB start, as required.
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
REPO="$(cd "$HERE/../../.." && pwd)"
source "$HERE/00-env.sh"
POSTGREST="${POSTGREST:-${TEMP:-/tmp}/uat-pgrst/postgrest.exe}"
GOTRUE="${GOTRUE:-${TEMP:-/tmp}/uat-gotrue/gotrue.exe}"
LOCK="${MACHINE_LOCK:-C:/ziko-platform/.planning/.machine-lock}"
mkdir -p "$UAT_ROOT"

# --- machine lock (younger than 25 min => wait) -----------------------------------------------
for i in $(seq 1 40); do
  if mkdir "$LOCK" 2>/dev/null; then break; fi
  echo "machine lock held, waiting 60s ($i)"; sleep 60
done
trap 'rmdir "$LOCK" 2>/dev/null || true' EXIT

rm -rf "$UAT_PGDATA"
"$PGBIN/initdb" -D "$UAT_PGDATA" -U postgres --auth=trust -E UTF8 >/dev/null
"$PGBIN/pg_ctl" -D "$UAT_PGDATA" -o "-p $UAT_PG_PORT -c listen_addresses=127.0.0.1 -c fsync=off" -l "$UAT_ROOT/pg.log" -w start >/dev/null
PSQL=("$PGBIN/psql" -h 127.0.0.1 -p "$UAT_PG_PORT" -U postgres -v ON_ERROR_STOP=1 -q)
"${PSQL[@]}" -f "$HERE/roles.sql"
rmdir "$LOCK" 2>/dev/null || true   # DB is up; release the lock for other agents

# --- GoTrue: real auth schema + admin API -----------------------------------------------------
export GOTRUE_DB_DRIVER=postgres
export DATABASE_URL="postgres://supabase_auth_admin@127.0.0.1:$UAT_PG_PORT/postgres?search_path=auth"
export DB_NAMESPACE=auth GOTRUE_DB_NAMESPACE=auth
export GOTRUE_JWT_SECRET="$UAT_JWT_SECRET" GOTRUE_JWT_EXP=3600 GOTRUE_JWT_AUD=authenticated GOTRUE_JWT_DEFAULT_GROUP_NAME=authenticated
export GOTRUE_SITE_URL="http://127.0.0.1:$UAT_WEB_PORT" API_EXTERNAL_URL="$UAT_AUTH_URL"
export GOTRUE_API_HOST=127.0.0.1 GOTRUE_API_PORT=$UAT_AUTH_PORT PORT=$UAT_AUTH_PORT
export GOTRUE_MAILER_AUTOCONFIRM=true GOTRUE_DISABLE_SIGNUP=false GOTRUE_EXTERNAL_EMAIL_ENABLED=true
export GOTRUE_SMTP_HOST=127.0.0.1 GOTRUE_SMTP_PORT=1 GOTRUE_SMTP_USER=x GOTRUE_SMTP_PASS=x GOTRUE_SMTP_ADMIN_EMAIL=uat@example.invalid
export GOTRUE_LOG_LEVEL=warn
"$GOTRUE" migrate >"$UAT_ROOT/gotrue-migrate.log" 2>&1 || { tail -20 "$UAT_ROOT/gotrue-migrate.log"; exit 1; }
nohup "$GOTRUE" >"$UAT_ROOT/gotrue.log" 2>&1 &
echo $! >"$UAT_ROOT/gotrue.pid"

# --- portfolio schema (apply order from .github/workflows/test-rls.yml) -----------------------
# pg_net is unavailable locally (stubbed in roles.sql) and storage policies need the storage
# service: the storage migration is skipped, it is out of scope for the waitlist UAT.
"${PSQL[@]}" -c "GRANT ALL ON ALL TABLES IN SCHEMA auth TO service_role; GRANT SELECT ON auth.users TO authenticated, anon;" >/dev/null
sed -e '/CREATE EXTENSION IF NOT EXISTS pg_net;/d' "$REPO/scripts/portfolio-migration/00-bootstrap-supabase-functions.sql" >"$UAT_ROOT/00-bootstrap.sql"
"${PSQL[@]}" -f "$UAT_ROOT/00-bootstrap.sql"
for f in $(ls "$REPO"/supabase/portfolio-migrations/*.sql | sort); do
  case "$f" in *storage_policies*) echo "skip $f (needs storage service)"; continue;; esac
  echo "applying $f"
  sed -e '/CREATE EXTENSION IF NOT EXISTS pg_net;/d' "$f" >"$UAT_ROOT/mig.sql"
  "${PSQL[@]}" -f "$UAT_ROOT/mig.sql"
done
"${PSQL[@]}" -c "GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;" >/dev/null

# --- PostgREST --------------------------------------------------------------------------------
"${PSQL[@]}" -c "ALTER ROLE authenticator PASSWORD 'uat'" >/dev/null
export PGRST_DB_URI="postgres://authenticator:uat@127.0.0.1:$UAT_PG_PORT/postgres"
export PGRST_DB_SCHEMAS=public PGRST_DB_ANON_ROLE=anon PGRST_JWT_SECRET="$UAT_JWT_SECRET"
export PGRST_SERVER_HOST=127.0.0.1 PGRST_SERVER_PORT=$UAT_REST_PORT PGRST_DB_POOL=10
nohup "$POSTGREST" >"$UAT_ROOT/postgrest.log" 2>&1 &
echo $! >"$UAT_ROOT/postgrest.pid"
for i in $(seq 1 30); do curl -fs "http://127.0.0.1:$UAT_REST_PORT/" >/dev/null 2>&1 && break; sleep 1; done
nohup node "$HERE/gateway.mjs" $UAT_GW_PORT $UAT_REST_PORT $UAT_AUTH_PORT >"$UAT_ROOT/gateway.log" 2>&1 &
echo $! >"$UAT_ROOT/gateway.pid"
eval "$(node "$HERE/mint-keys.mjs" | sed 's/^/export /')"
node "$HERE/mint-keys.mjs" >"$UAT_ROOT/keys.env"
echo "stack up: PG $UAT_PG_PORT, GoTrue $UAT_AUTH_PORT, PostgREST $UAT_REST_PORT (keys in $UAT_ROOT/keys.env)"
