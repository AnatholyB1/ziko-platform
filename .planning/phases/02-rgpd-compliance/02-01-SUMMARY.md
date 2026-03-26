---
phase: 02-rgpd-compliance
plan: 01
subsystem: auth
tags: [upstash, ratelimit, server-actions, supabase-admin, rgpd, account-deletion]

# Dependency graph
requires:
  - phase: 01-foundation
    provides: "Supabase admin client scaffold with server-only guard"
provides:
  - "Fixed admin client using SUPABASE_SERVICE_ROLE_KEY"
  - "Upstash sliding-window rate limiter singleton (5 req/60s)"
  - "deleteAccount Server Action with anti-enumeration, IP rate limiting, form validation"
affects: [02-rgpd-compliance-02, 02-rgpd-compliance-03]

# Tech tracking
tech-stack:
  added: ["@upstash/ratelimit@2.0.8", "@upstash/redis@1.37.0"]
  patterns:
    - "Server Action with (prevState, formData) signature for useActionState compatibility"
    - "Anti-enumeration: email-not-found returns identical success message as real deletion"
    - "Rate limit before any DB call: extract IP from x-forwarded-for, limit by IP"
    - "findUserIdByEmail: REST /auth/v1/admin/users?filter= with listUsers fallback"

key-files:
  created:
    - src/lib/ratelimit.ts
    - src/actions/account.ts
  modified:
    - src/lib/supabase/admin.ts
    - package.json

key-decisions:
  - "Use SUPABASE_SERVICE_ROLE_KEY in admin client (not publishable key) — required for auth.admin.deleteUser"
  - "Do NOT use analytics: true on Ratelimit (free tier limitation per research D-16)"
  - "Do NOT use auth.admin.getUserByEmail() — method does not exist in supabase-js v2.100.1"
  - "Anti-enumeration: return success-looking message when email not found (RGPD + security best practice)"
  - "Rate limit window: 5 requests per 60 seconds sliding window per IP"

patterns-established:
  - "Server Actions: 'use server' directive at top of file, (prevState, formData) signature"
  - "Rate limiting: always check before Supabase calls, extract IP from x-forwarded-for header"
  - "Admin Supabase calls: always use createAdminClient() factory (not singleton)"

requirements-completed: [RGPD-01, RGPD-02, RGPD-03]

# Metrics
duration: 1min
completed: 2026-03-26
---

# Phase 02 Plan 01: Server-side deletion pipeline Summary

**Upstash sliding-window rate limiter + deleteAccount Server Action with anti-enumeration, IP rate limiting, and Supabase admin deletion via service role key**

## Performance

- **Duration:** 1 min
- **Started:** 2026-03-26T18:06:06Z
- **Completed:** 2026-03-26T18:07:20Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments

- Installed @upstash/ratelimit@2.0.8 and @upstash/redis@1.37.0 in ziko-web
- Fixed critical admin client bug: SUPABASE_PUBLISHABLE_KEY replaced with SUPABASE_SERVICE_ROLE_KEY
- Created ratelimit.ts singleton with sliding window 5 req/60s, prefix ziko:delete
- Created deleteAccount Server Action with full pipeline: IP extraction, rate limit, form validation, anti-enumeration, user deletion
- TypeScript compiles with zero errors

## Task Commits

Each task was committed atomically:

1. **Task 1: Install Upstash packages and fix admin client** - `13d8ac2` (feat)
2. **Task 2: Create rate limiter and Server Action** - `742ffb1` (feat)

## Files Created/Modified

- `src/lib/supabase/admin.ts` - Fixed: now uses SUPABASE_SERVICE_ROLE_KEY (bug fix)
- `src/lib/ratelimit.ts` - New: Upstash Ratelimit singleton, sliding window 5/60s
- `src/actions/account.ts` - New: deleteAccount Server Action + DeleteAccountState type
- `package.json` - Added @upstash/ratelimit and @upstash/redis dependencies

## Decisions Made

- Used REST `/auth/v1/admin/users?filter=` endpoint instead of `auth.admin.getUserByEmail()` (method does not exist in supabase-js v2.100.1 — confirmed via research D-15)
- listUsers fallback added in case filter endpoint returns non-200
- Anti-enumeration pattern: email-not-found returns `{ status: 'success', message: 'Si ce compte existe, il a été supprimé.' }` — indistinguishable from a real deletion
- IP extracted from `x-forwarded-for` header, split on comma, trimmed; fallback to `127.0.0.1` for local dev

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

**External services require manual configuration before this plan's code will function at runtime:**

- **Upstash Redis**: Create a free Redis database at https://console.upstash.com, obtain REST URL and REST Token
  - `UPSTASH_REDIS_REST_URL` — add to ziko-web `.env.local` and Vercel environment
  - `UPSTASH_REDIS_REST_TOKEN` — add to ziko-web `.env.local` and Vercel environment
- **Supabase service role key**: Supabase Dashboard -> Settings -> API -> service_role (secret)
  - `SUPABASE_SERVICE_ROLE_KEY` — add to ziko-web `.env.local` and Vercel environment

These environment variables are needed for deleteAccount to rate-limit and perform admin deletion.

## Next Phase Readiness

- Server-side deletion pipeline complete: rate limiter + Server Action ready for Plan 02 UI wiring
- Plan 02 can import `{ deleteAccount, DeleteAccountState }` from `@/actions/account` and wire to a form
- No blockers for Plan 02 execution

---
*Phase: 02-rgpd-compliance*
*Completed: 2026-03-26*
