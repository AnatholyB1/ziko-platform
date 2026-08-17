---
phase: 05-waitlist-page-entry-points
plan: 03
subsystem: ui
tags: [nextjs, route-handler, framer-motion, next-intl, vitest, testing-library, admin-client]

# Dependency graph
requires:
  - phase: 01-data-foundation
    provides: "get_waitlist_founder_status() RPC — should_display/remaining/is_full, service-role-only"
  - phase: 05-01
    provides: "WaitlistFounderBanner/WaitlistFounderBannerClient component chain, the commented counter mount slot, and the fondateurs.counter.* message keys"
provides:
  - "GET /api/waitlist/count — the only public door onto the founder-status RPC, relaying its three verdicts verbatim with an explicit Cache-Control header (not a revalidate export)"
  - "WaitlistCounterClient — a self-contained, prop-driven, one-fetch-per-mount client widget with loading/pre-threshold/counter-visible/complete states, mountable on any page (Plan 05-04's homepage section reuses it)"
affects: [05-04-entry-points]

# Actuals (#2632)
actuals:
  tokens: 5100
  tasks: 2
  commits: 2

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Route Handler caching via an explicit Cache-Control header on the response, not a `revalidate` export — a `revalidate` export would evaluate the handler (and construct the service-role client) at `next build` time"
    - "Client widget receives verdicts as already-decided booleans/numbers and performs zero arithmetic on them — the reveal rule and the 200-cap live only inside the SQL function"

key-files:
  created:
    - apps/web/src/app/api/waitlist/count/route.ts
    - apps/web/src/components/marketing/WaitlistCounterClient.tsx
    - apps/web/test/app/api/waitlist-count.test.ts
    - apps/web/test/components/WaitlistCounterClient.test.tsx
  modified:
    - apps/web/src/components/marketing/WaitlistFounderBanner.tsx
    - apps/web/src/components/marketing/WaitlistFounderBannerClient.tsx

key-decisions:
  - "Followed the plan's resolved-at-plan-time caching decision exactly: no `revalidate`/`dynamic`/`fetchCache`/`runtime` export on the route; caching is the response's own `Cache-Control` header (`public, s-maxage=30, stale-while-revalidate=60` on success, `no-store` on the RPC-error/empty-row fallback), and the client calls it with a plain `fetch` and no init options."
  - "The widget's fetch failure path (rejection, non-ok status, malformed body) collapses into the exact same rendered output as the route's own honest safe default (display-false) — a broken counter and a not-yet-revealed counter are indistinguishable to a visitor, by design."

requirements-completed: [FOND-01, FOND-02, FOND-03, FOND-04, FOND-05, FOND-06]

coverage:
  - id: D1
    description: "The route relays should_display/remaining/is_full verbatim for every RPC outcome, including error and empty-row, always with a 200 status"
    requirement: "FOND-03, FOND-06"
    verification:
      - kind: unit
        ref: "test/app/api/waitlist-count.test.ts — 9 cases: pre-threshold, counter-visible, complete, RPC-error fallback, empty-row fallback, success/fallback Cache-Control, from() never touched, RPC called exactly once with no arguments"
        status: pass
    human_judgment: false
  - id: D2
    description: "The route never touches waitlist_signups directly and never adds cap arithmetic or a configuration read outside the RPC"
    requirement: "FOND-03, FOND-06"
    verification:
      - kind: other
        ref: "grep -c get_waitlist_founder_status → 1; grep for from('waitlist_signups')/count(/app_config/200-arithmetic all absent; grep for revalidate/dynamic/fetchCache/runtime export absent"
        status: pass
    human_judgment: false
  - id: D3
    description: "Below the reveal point the widget shows the static offer sentence and never renders the remaining value it was given, even though the value is present in the payload"
    requirement: "FOND-01"
    verification:
      - kind: unit
        ref: "test/components/WaitlistCounterClient.test.tsx#renders the static offer sentence and no remaining value when the display verdict is false (FOND-01)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Above the reveal point the widget shows the live remaining count with the message template's placeholder substituted"
    requirement: "FOND-02"
    verification:
      - kind: unit
        ref: "test/components/WaitlistCounterClient.test.tsx#renders the live count and no placeholder token when the display verdict is true (FOND-02)"
        status: pass
    human_judgment: false
  - id: D5
    description: "Exactly one fetch happens per mount, even across a lifetime advanced well past the 30s caching window — no interval, no refetch"
    requirement: "FOND-04"
    verification:
      - kind: unit
        ref: "test/components/WaitlistCounterClient.test.tsx#calls fetch exactly once across a mounted lifetime advanced well past thirty seconds (FOND-04)"
        status: pass
      - kind: other
        ref: "grep -qiE setInterval|setTimeout|visibilitychange|refetch → absent; grep -c 'fetch(' → 1"
        status: pass
    human_judgment: false
  - id: D6
    description: "Once the offer is full, a distinct completion panel (own heading, own body, no accent color) replaces the badge — never the digit zero as a count — and the full verdict wins even when the display verdict is also true"
    requirement: "FOND-05"
    verification:
      - kind: unit
        ref: "test/components/WaitlistCounterClient.test.tsx#renders the completion heading and body ... (FOND-05, D-10); #the full verdict wins over the count even when the display verdict is also true"
        status: pass
    human_judgment: false
  - id: D7
    description: "The founders route still prerenders statically for both locales despite the new fetching client component"
    requirement: "WAIT-08"
    verification:
      - kind: e2e
        ref: "npx next build — /fr/fondateurs and /en/fondateurs both marked ● (SSG); /api/waitlist/count marked ƒ (dynamic Route Handler, not build-evaluated)"
        status: pass
    human_judgment: false
  - id: D8
    description: "Below the reveal point and on a counter fetch failure the page renders exactly the same honest static-offer output — no error surface, no broken badge"
    verification:
      - kind: unit
        ref: "test/components/WaitlistCounterClient.test.tsx — rejected fetch, non-ok response, and malformed-body cases all render the static offer sentence"
        status: pass
    human_judgment: false

# Metrics
duration: ~30min
completed: 2026-08-17
status: complete
---

# Phase 5 Plan 3: Public Counter Route + Three-State Widget Summary

**A public `/api/waitlist/count` route that relays `get_waitlist_founder_status()` verbatim through the service-role client under an explicit Cache-Control header, and a self-contained `WaitlistCounterClient` widget rendering the resulting three-state contract (pre-threshold fact / live descending count / distinct completion panel) with zero arithmetic on either end — 19 new tests, both new suites plus the whole workspace suite green.**

## Performance

- **Duration:** ~30 min
- **Tasks:** 2
- **Files modified:** 6 (4 created, 2 modified)
- **Commits:** 2

## Accomplishments

- `GET /api/waitlist/count` calls `get_waitlist_founder_status()` through
  `createAdminClient()` (both waitlist RPCs are service-role-only) and maps its three
  snake_case fields onto `shouldDisplay`/`remaining`/`isFull` with no other query, no
  arithmetic, and no configuration read
- The route exports no caching symbols — caching is an explicit `Cache-Control` header
  (`public, s-maxage=30, stale-while-revalidate=60` on success, `no-store` on the
  RPC-error/empty-row fallback), exactly per the plan's resolved-at-plan-time decision,
  so the handler never runs at `next build` time
- On any RPC error or empty result the route still returns 200 with the safe default
  (`shouldDisplay: false, remaining: null, isFull: false`) — the widget's ordinary
  rendering path handles it rather than a broken badge on a marketing page
- `WaitlistCounterClient` fetches exactly once per mount, holds one piece of state, and
  renders — in strict order — a loading placeholder, the D-10 completion panel (full
  verdict checked before the count, never a same-shape badge with a zero), the live
  badge with the message template's `{remaining}` placeholder substituted, or the
  static offer sentence as the universal fallback for every remaining case (including
  fetch rejection, non-ok status, and a malformed body)
- Mounted into `WaitlistFounderBannerClient.tsx`'s previously-commented slot, with
  `WaitlistFounderBanner.tsx` resolving the four `fondateurs.counter.*` strings and
  threading them down as plain props — the widget itself imports no message file and
  knows no locale
- `next build` still marks both `/fr/fondateurs` and `/en/fondateurs` as `●` (SSG,
  prerendered), and `/api/waitlist/count` as `ƒ` (dynamic Route Handler) — the counter's
  data arrives through a separate client-side request after hydration, exactly as
  WAIT-08 requires

## Task Commits

Each task was committed atomically:

1. **T-05-06: The public counter route — one RPC call, three verdicts, an honest failure (FOND-03, FOND-06)** - `a27a94e` (feat)
2. **T-05-07: The three-state counter widget, mounted on the founders hero (FOND-01, FOND-02, FOND-04, FOND-05)** - `216e7d4` (feat)

## Files Created/Modified

- `apps/web/src/app/api/waitlist/count/route.ts` - GET Route Handler; service-role RPC relay with explicit Cache-Control caching
- `apps/web/test/app/api/waitlist-count.test.ts` - 9 Node-environment tests pinning the route contract
- `apps/web/src/components/marketing/WaitlistCounterClient.tsx` - the three-state client widget, prop-driven copy, one fetch per mount
- `apps/web/test/components/WaitlistCounterClient.test.tsx` - 10 happy-dom/RTL tests pinning the widget contract
- `apps/web/src/components/marketing/WaitlistFounderBanner.tsx` - resolves and threads the four `fondateurs.counter.*` strings
- `apps/web/src/components/marketing/WaitlistFounderBannerClient.tsx` - mounts `WaitlistCounterClient` in Plan 05-01's reserved slot

## Decisions Made

- **Cache-Control over `revalidate`, exactly as the plan pre-resolved:** the route
  exports no caching symbols; the response's own `Cache-Control` header is what
  genuinely caches it at the edge, and the fallback is explicitly `no-store` so a
  transient upstream blip cannot pin the whole CDN to the no-counter state for the
  caching window.
- **Widget failure states collapse to the route's own default:** rejection, a non-ok
  response, and a structurally-invalid body all resolve to
  `{ shouldDisplay: false, remaining: null, isFull: false }` inside the widget — the
  same shape the route itself returns on its own failure path — so "broken" and
  "not yet revealed" are visually identical to a visitor.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `act(...)` warning in the no-polling fake-timers test**
- **Found during:** Task 2, first run of `WaitlistCounterClient.test.tsx`
- **Issue:** Enabling fake timers before the initial fetch's microtask-driven state
  update had resolved caused React to log an `act(...)` warning — the state update was
  landing outside of Testing Library's automatic `act` wrapping.
- **Fix:** Reordered the test to `await screen.findByText(...)` (which RTL wraps in
  `act` internally) for the initial resolved state before switching to fake timers and
  advancing 60s. Same assertion, no warning.
- **Files modified:** `apps/web/test/components/WaitlistCounterClient.test.tsx`
- **Verification:** `npx vitest run test/components/WaitlistCounterClient.test.tsx` — 10/10 passing, no console warnings
- **Committed in:** `216e7d4` (Task 2 commit)

### Deviations from a literal acceptance-criteria grep count

- The plan's acceptance criteria for T-05-06 state `grep -c "createAdminClient" ...`
  should output `1`. The route imports `createAdminClient` (one line) and calls it once
  (a second line) — the literal, idiomatic minimum is 2 matching lines, identical to the
  established house pattern in `apps/web/src/app/api/credits/balance/route.ts`
  (`grep -c "createServerSupabase"` on that file is also 2). `grep -c` counts matching
  *lines*, not total occurrences, so an import + a single call will always yield 2 for
  any two-word-apart usage; forcing it to literally read 1 would require joining the
  import and the call onto one physical line, which contradicts every other Route
  Handler in this codebase. Treated as a plan-authoring imprecision, not a functional
  gap — the substantive intent (exactly one admin-client construction, no duplicate
  clients) is what the code and the RPC-call-count test (`toHaveBeenCalledTimes(1)`)
  actually enforce. All other route greps (RPC-name count, no `from('waitlist_signups')`,
  no cap arithmetic, no caching-symbol export, `s-maxage=30`) pass literally as written.

---

**Total deviations:** 1 auto-fixed (test-only), 1 documented grep-count imprecision (non-functional)
**Impact on plan:** No production behavior changed by either item. All functional
acceptance criteria — 9 route tests, 10 widget tests, the whole workspace suite (285
passed, 4 skipped), `tsc --noEmit` clean on both new files, `next build` still SSG for
both locales — pass exactly as specified.

## Issues Encountered

- Pre-existing, unrelated `tsc --noEmit` errors in `apps/web/test/purge/*.test.ts` (loose
  `object`-typed mocks predating this plan) remain present after this plan's changes.
  Confirmed via `git diff --stat` that this plan touched none of those files; out of
  scope per the executor's scope-boundary rule, not fixed.

## User Setup Required

None — no external service configuration required. The route relies on
`SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY`, already required by every other admin-client
consumer in this codebase (`waitlist.ts`, `erase.mjs`, etc.).

## Next Phase Readiness

- Plan 05-04 (entry points) can mount `WaitlistCounterClient` on the homepage founders
  section directly — it is already a self-contained, prop-driven component with no
  dependency on `/fondateurs`-specific context, per the plan's own key-link.
- `git diff --stat` on `apps/web/src/actions/waitlist.ts`,
  `apps/web/src/components/marketing/WaitlistRoleForm.tsx`, and both message files is
  empty — Plan 05-02's territory is untouched.
- No blockers identified for downstream Phase 5 plans.

---
*Phase: 05-waitlist-page-entry-points*
*Completed: 2026-08-17*

## Self-Check: PASSED

All 6 files listed under "Files Created/Modified" confirmed present on disk. Both task
commits (`a27a94e`, `216e7d4`) confirmed present in `git log --oneline --all`.
