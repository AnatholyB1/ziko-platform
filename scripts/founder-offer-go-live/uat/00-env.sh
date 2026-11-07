# Shared env for the disposable UAT stack. Ports: PG 54440, GoTrue 3142, gateway 3143, PostgREST 3144, web 3141.
# NEVER points at a real Supabase project. Source this file, do not execute it.
export UAT_ROOT="${UAT_ROOT:-${TEMP:-/tmp}/ziko-uat}"
export UAT_PG_PORT=54440
export UAT_REST_PORT=3144
export UAT_GW_PORT=3143
export UAT_AUTH_PORT=3142
export UAT_WEB_PORT=3141
export PGBIN="${PGBIN:-/c/Users/Anatholy/scoop/apps/postgresql/current/bin}"
export UAT_PGDATA="$UAT_ROOT/pgdata"
export UAT_JWT_SECRET="uat-only-jwt-secret-0123456789abcdef0123456789abcdef"
export UAT_DB_URL="postgres://postgres@127.0.0.1:$UAT_PG_PORT/postgres"
export UAT_API_URL="http://127.0.0.1:$UAT_GW_PORT"
export UAT_AUTH_URL="http://127.0.0.1:$UAT_AUTH_PORT"
