#!/usr/bin/env bash
# Runs backend/api test:rls against the DISPOSABLE stack (gateway 3143 => PostgREST + GoTrue).
# Run AFTER 03-run-uat.mjs: some specs reset the founder sequence / waitlist table.
set -uo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
REPO="$(cd "$HERE/../../.." && pwd)"
source "$HERE/00-env.sh"
source "$UAT_ROOT/keys.env"
cd "$REPO/backend/api"
export SUPABASE_URL="$UAT_API_URL" SUPABASE_TEST_URL="$UAT_API_URL"
export SUPABASE_PUBLISHABLE_KEY="$UAT_ANON_KEY" SUPABASE_SERVICE_ROLE_KEY="$UAT_SERVICE_KEY"
# .env.test must not exist (would override these); vitest.config.ts loads it with dotenv if present.
npx vitest run ${RLS_SPECS:-test/rls} --reporter=default 2>&1 | tee "$UAT_ROOT/rls.out"
