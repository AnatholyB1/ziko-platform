---
phase: 23-web-turborepo-onboarding-auth-bootstrap
plan: "04"
subsystem: apps/web
tags: [phase-23, wave-3, supabase-ssr, middleware-composition, factories]
dependency_graph:
  requires: [23-02]
  provides: [ARCH-05-layer-1, supabase-ssr-factories]
  affects: [apps/web/middleware.ts, apps/web/src/lib/supabase/]
tech_stack:
  added: ["@supabase/ssr@0.10.3", "vitest@3.2.4"]
  patterns: ["dual-store cookie propagation", "Supabase-first middleware composition", "server-only guard", "ARCH-06 cache:no-store"]
key_files:
  created:
    - apps/web/src/lib/supabase/client.ts
    - apps/web/src/lib/supabase/server.ts
    - apps/web/src/lib/supabase/middleware.ts
    - apps/web/src/lib/supabase/__tests__/factories.spec.ts
  modified:
    - apps/web/middleware.ts
    - apps/web/package.json
    - package-lock.json
decisions:
  - "@supabase/ssr@0.10.3 installed in apps/web workspace"
  - "server.ts line 1 is import 'server-only'; — build-time client-bundle guard (T-23-04-03)"
  - "updateSession has NO try/catch around auth.getUser() — anti-pattern avoided (T-23-04-04)"
  - "Middleware composition order: Supabase first, next-intl second — prevents stale JWT on locale redirects (D-10, T-23-04-01)"
  - "Cookie dual-store pattern: request.cookies.set() AND response.cookies.set() — prevents downstream Server Component stale reads (T-23-04-02)"
metrics:
  duration: "4m 13s"
  completed: "2026-05-15T10:46:04Z"
  tasks_completed: 2
  files_changed: 7
---

# Phase 23 Plan 04: @supabase/ssr Factories & Composed Middleware Summary

**One-liner:** `@supabase/ssr@0.10.3` wired with 3 new factory files (client/server/middleware) and root `middleware.ts` replaced with Supabase-first + next-intl composition implementing ARCH-05 layer 1.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Install @supabase/ssr + 3 factories | f128c54 | apps/web/package.json, src/lib/supabase/client.ts, server.ts, middleware.ts, package-lock.json |
| 2 | Composed middleware + unit test | 90cfaad | apps/web/middleware.ts, __tests__/factories.spec.ts, package.json |

## What Was Built

### @supabase/ssr version installed
`@supabase/ssr@0.10.3` — added to `apps/web` dependencies.

### 3 new factory files

**`apps/web/src/lib/supabase/middleware.ts`** — `updateSession(request)`:
- Verbatim Context7 dual-store cookie pattern
- `request.cookies.set(name, value)` + `response.cookies.set(name, value, options)` (Pitfall 1 mitigation, T-23-04-02)
- No try/catch around `await supabase.auth.getUser()` (T-23-04-04 mitigation)

**`apps/web/src/lib/supabase/server.ts`** — `createServerSupabase()`:
- Line 1: `import 'server-only';` — build-fails if imported from client bundle (T-23-04-03)
- `global.fetch` override with `cache: 'no-store'` (ARCH-06, prevents cross-user RSC cache leak)
- try/catch on `setAll` — Server Components cannot set cookies; middleware handles refresh

**`apps/web/src/lib/supabase/client.ts`** — `createClientSupabase()`:
- Thin wrapper around `createBrowserClient` from `@supabase/ssr`

**`apps/web/src/lib/supabase/admin.ts`** — PRESERVED unchanged (uses `@supabase/supabase-js`, service-role key, Plan 23-05 ESLint-allowlists it).

### middleware.ts replacement (before → after)

**Before:** Single-line `createMiddleware(routing)` from next-intl only — no auth refresh, incomplete matcher.

**After:** Composed pattern:
1. `await updateSession(request)` — Supabase refresh on every request
2. `/^(fr|en)\/coach(\/|$)/` branch returns supabase response (auth-sensitive routes)
3. All other paths delegated to `intlMiddleware(request)` for locale routing
4. Matcher: `'/'`, `'/(fr|en)/:path*'`, `'/((?!_next|_vercel|api|.*\\..*).*)'`

### Test result
`3/3 tests passing` (vitest 3.2.4):
- `updateSession returns a NextResponse`
- `createServerClient called once with env URLs`
- `createClientSupabase uses createBrowserClient`

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None — no hardcoded data or placeholder values introduced.

## Threat Surface Scan

All 4 STRIDE threats from plan's threat model are mitigated:

| Threat | Mitigation | Status |
|--------|-----------|--------|
| T-23-04-01 (stale JWT on locale redirect) | Supabase-first composition order | Mitigated |
| T-23-04-02 (cookie not propagated to Server Component) | Dual-store setAll pattern | Mitigated |
| T-23-04-03 (server.ts imported in client bundle) | `import 'server-only';` line 1 | Mitigated |
| T-23-04-04 (getUser silently swallows refresh failure) | No try/catch around getUser | Mitigated |

No new threat surface introduced beyond what the plan's threat model covers.

## Self-Check: PASSED

- `apps/web/src/lib/supabase/client.ts` — FOUND
- `apps/web/src/lib/supabase/server.ts` — FOUND (line 1: `import 'server-only';`)
- `apps/web/src/lib/supabase/middleware.ts` — FOUND (contains `request.cookies.set`)
- `apps/web/src/lib/supabase/admin.ts` — FOUND (contains `@supabase/supabase-js`)
- `apps/web/middleware.ts` — FOUND (contains `updateSession`, `intlMiddleware`)
- `apps/web/src/lib/supabase/__tests__/factories.spec.ts` — FOUND (3 it() blocks)
- Commit f128c54 — FOUND
- Commit 90cfaad — FOUND
