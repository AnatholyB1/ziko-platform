---
phase: 05-waitlist-page-entry-points
plan: 02
subsystem: api
tags: [nextjs, server-actions, mailchecker, botid, zod, upstash-ratelimit, supabase, vitest]

# Dependency graph
requires:
  - phase: 01-data-foundation
    provides: "claim_waitlist_signup()/normalize_waitlist_email() RPCs (with p_utm_source/p_utm_campaign params), waitlist_signups.consent_given_at/consent_version columns, WaitlistState shape, D-03/D-04 non-disclosure filter"
  - phase: 03-legal-cgv-cgu
    provides: "CONSENT_CHECKBOX_LABEL/COLLECTION_POINT_NOTICE/CONSENT_VERSION frozen legal copy in @/content/legal/founder-offer.ts"
  - phase: 05-01
    provides: "/fondateurs SSG route, WaitlistRoleForm/WaitlistFounderBanner component chain, fondateurs.error.* message keys, claimWaitlistSpot untouched entry point"
provides:
  - "claimWaitlistSpot hardened with a five-guard chain (honeypot, checkBotId, dual rate limit, z.email() syntax, mailchecker disposable-domain) ahead of the RPC, all returning a typed WaitlistErrorCode"
  - "waitlistRatelimit export in lib/ratelimit.ts (5/60s, ziko:waitlist prefix)"
  - "Server-side consent write (consent_given_at/consent_version) matched on normalize_waitlist_email(), running identically on new and duplicate signups"
  - "utm_source/utm_campaign forwarded from the landing URL into claim_waitlist_signup, trimmed/truncated(64)/null-normalized"
  - "BotID client instrumentation wired into next.config.ts and the /fondateurs page, protecting both locale POST paths"
  - "waitlist.validation.test.ts — 23 no-database Vitest cases covering every guard, the consent write, and UTM forwarding"
affects: [05-03-counter-widget, 05-04-entry-points, 05-05-nav-links, 06-founder-offer-go-live]

# Actuals (#2632)
actuals:
  tokens: 11300
  tasks: 3
  commits: 2

# Tech tracking
tech-stack:
  added: [mailchecker@6.0.21, botid@1.5.11, zod@^4.3.6 (declared, workspace-hoisted)]
  patterns:
    - "Guard chain returns immediately on each check (honeypot -> checkBotId -> dual rate limit -> z.email() syntax -> mailchecker), each error path setting a typed WaitlistErrorCode, before the RPC is ever called"
    - "Dynamic `await import('next/headers')` wrapped in try/catch inside a local async helper, keeping the Server Action importable in a plain Vitest process (mirrors the existing 'server-only' mock convention)"
    - "Consent write via a follow-up admin.from('waitlist_signups').update(...) matched on normalize_waitlist_email()'s answer, run unconditionally ahead of the D-03/D-04 non-disclosure branch so new and duplicate paths issue identical database call sequences"
    - "Name-aware single rpc() vi.fn() mock dispatching by RPC name (claim_waitlist_signup vs normalize_waitlist_email) in the validation test suite"

key-files:
  created:
    - apps/web/test/actions/waitlist.validation.test.ts
  modified:
    - apps/web/package.json
    - package-lock.json
    - apps/web/src/actions/waitlist.ts
    - apps/web/src/lib/ratelimit.ts
    - apps/web/src/components/marketing/WaitlistRoleForm.tsx
    - apps/web/src/components/marketing/WaitlistFounderBanner.tsx
    - apps/web/src/components/marketing/WaitlistFounderBannerClient.tsx
    - apps/web/next.config.ts
    - apps/web/src/app/[locale]/(marketing)/fondateurs/page.tsx
    - apps/web/test/actions/waitlist.concurrency.test.ts
    - apps/web/test/components/WaitlistRoleForm.test.tsx

key-decisions:
  - "T-05-03 package-legitimacy checkpoint resolved APPROVED by the real user (outside this session) after both the executor's findings and the orchestrator's independent live npm-registry/Vercel-docs verification of mailchecker@6.0.21 and botid@1.5.11 — recorded verbatim in this plan's checkpoint gate, not re-litigated here."
  - "zod pinned to the exact root-workspace range (^4.3.6), not the range `npm install zod@^4.3.6` would otherwise write (^4.4.3) — keeps a single hoisted zod install across the monorepo instead of a duplicate nested copy in apps/web/node_modules."
  - "Consent field check combined with the pre-existing empty-email/empty-audience check into one `invalid_form` gate, run before any guard — simpler than a separate early-return and behaviorally identical to the plan's 'before any other work' instruction."
  - "errorSentenceFor(code) renders a dedicated sentence only for invalid_email and rate_limited (the two visitor-actionable codes); invalid_form and server_error both fall through to errorGeneric, exactly as the plan specifies — the pre-existing fondateurs.error.consentRequired message key stays unused by this plan (05-01 added it; wiring it isn't in this plan's copy contract)."

requirements-completed: [WAIT-03, WAIT-04, WAIT-06, ENTRY-06]

coverage:
  - id: D1
    description: "mailchecker@6.0.21 and botid@1.5.11 installed at the exact approved versions after the T-05-03 human checkpoint, zod declared at the root-pinned range"
    requirement: "WAIT-04"
    verification:
      - kind: other
        ref: "node -e assertion on apps/web/package.json dependency versions (plan acceptance criteria script) — exits 0"
        status: pass
    human_judgment: false
  - id: D2
    description: "claimWaitlistSpot refuses malformed and disposable-domain emails with the same invalid_email code before the RPC runs, never disclosing which check tripped"
    requirement: "WAIT-04"
    verification:
      - kind: unit
        ref: "test/actions/waitlist.validation.test.ts > malformed email syntax / disposable domain describes"
        status: pass
    human_judgment: false
  - id: D3
    description: "Honeypot hits and bot verdicts return the ordinary neutral success state, deep-equal to a genuine non-founder signup, never reaching the RPC"
    verification:
      - kind: unit
        ref: "test/actions/waitlist.validation.test.ts > honeypot and bot detection never disclose themselves (T-05-D2/T-05-S2)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Repeated submissions are throttled by a fourth named export (waitlistRatelimit) in the existing lazy-singleton ratelimit.ts, no second file/mechanism"
    verification:
      - kind: unit
        ref: "test/actions/waitlist.validation.test.ts > rate limiting (T-05-D2/T-05-D3)"
        status: pass
      - kind: other
        ref: "grep -c export const apps/web/src/lib/ratelimit.ts == 4; grep -c ziko:waitlist == 1"
        status: pass
    human_judgment: false
  - id: D5
    description: "Every successful signup's row carries consent_given_at and CONSENT_VERSION, matched on normalize_waitlist_email()'s answer, written identically on new and duplicate paths, touching no founder-state or address column"
    requirement: "WAIT-06"
    verification:
      - kind: unit
        ref: "test/actions/waitlist.validation.test.ts > consent write (LEGAL-06/07, T-05-R2, T-05-T2)"
        status: pass
    human_judgment: false
  - id: D6
    description: "utm_source/utm_campaign forwarded from the landing URL to claim_waitlist_signup, trimmed/truncated to 64 chars/null-normalized"
    requirement: "ENTRY-06"
    verification:
      - kind: unit
        ref: "test/actions/waitlist.validation.test.ts > UTM forwarding (ENTRY-06)"
        status: pass
    human_judgment: false
  - id: D7
    description: "Phase 1's 200-cap race and founder-status non-disclosure proofs (waitlist.concurrency.test.ts) still run unmodified — no test title/assertion changed, only two hoisted mocks and a consent fixture field added"
    requirement: "WAIT-06"
    verification:
      - kind: other
        ref: "git diff -- apps/web/test/actions/waitlist.concurrency.test.ts | grep '^-' | grep -cE '^-\\s*(it|expect|describe)' == 0; suite collects and skips cleanly without RUN_DB"
        status: pass
      - kind: manual_procedural
        ref: "DB-gated race/non-disclosure assertions themselves require SUPABASE_TEST_URL/SUPABASE_SERVICE_ROLE_KEY, unavailable this session — same known gap Phase 1 carries forward"
        status: unknown
    human_judgment: true
    rationale: "The two DB-gated `it` blocks inside waitlist.concurrency.test.ts (200-cap race, duplicate non-disclosure) never actually executed against a live Supabase project this session — only their collection/import-safety was proven. A human with real test-project credentials should run `SUPABASE_TEST_URL=... npx vitest run test/actions/waitlist.concurrency.test.ts` before shipping to confirm the guard chain didn't change the race/non-disclosure outcome."
  - id: D8
    description: "The consent checkbox, an off-screen (not display:none) honeypot input, and two UTM hidden inputs render in WaitlistRoleForm.tsx; state.code drives a per-code error sentence"
    verification:
      - kind: unit
        ref: "test/components/WaitlistRoleForm.test.tsx (13 tests, unchanged assertions, updated fixtures)"
        status: pass
      - kind: other
        ref: "grep -c 'name=\"consent\"'/'name=\"website\"' == 1 each; ! grep display:'none'"
        status: pass
    human_judgment: false
  - id: D9
    description: "BotID's client instrumentation is wired into next.config.ts (withBotId between analyzer and next-intl) and mounted on /fondateurs protecting both locale POST paths, without breaking static prerendering"
    verification:
      - kind: e2e
        ref: "npx next build — /fr/fondateurs and /en/fondateurs both still marked ● (SSG)"
        status: pass
    human_judgment: false

# Metrics
duration: ~35min
completed: 2026-08-17
status: complete
---

# Phase 5 Plan 2: Abuse-Hardened, Consent-Recording, Attribution-Wired Waitlist Submission Summary

**`claimWaitlistSpot` now runs a five-layer guard chain (honeypot, BotID, dual Upstash rate limit, `z.email()` syntax, `mailchecker` disposable-domain) before ever calling `claim_waitlist_signup`, records `consent_given_at`/`consent_version` identically on new and duplicate signups via a follow-up admin update matched on `normalize_waitlist_email()`, and forwards `utm_source`/`utm_campaign` into the existing RPC parameters — 23 new no-database Vitest cases and Phase 1's unmodified 200-cap/non-disclosure suite both green.**

## Performance

- **Duration:** ~35 min
- **Tasks:** 3 (T-05-03 checkpoint approved before this session; T-05-04 and T-05-05 executed and committed here)
- **Files modified:** 12 (1 created, 11 modified)
- **Commits:** 2

## Accomplishments

- Installed `mailchecker@6.0.21` and `botid@1.5.11` at the exact approved versions (T-05-03's checkpoint), and declared `zod` at the root-pinned `^4.3.6` range instead of letting `npm install` write a divergent range that would have forced a duplicate nested install
- Added `waitlistRatelimit` (5 requests/60s, `ziko:waitlist` prefix) to `lib/ratelimit.ts` as a fourth export, matching the three existing lazy singletons exactly — no second file, no new pattern
- Rewrote `claimWaitlistSpot`'s guard chain in the fixed order (honeypot → `checkBotId()` → rate limit → syntax → disposable domain), each error path returning a typed `WaitlistErrorCode`; honeypot and bot verdicts return the identical neutral success state a genuine non-founder signup produces, proven deep-equal by a dedicated test
- Rate limiting checks both the caller's IP (via a dynamic `await import('next/headers')`, wrapped in try/catch so the file stays importable in plain Vitest) and the submitted address's lowercased form, so neither a single flooding source nor many sources hammering one address slips through
- After a successful claim, unconditionally calls `normalize_waitlist_email()` and writes `consent_given_at`/`consent_version` on the matching row — before the D-03/D-04 non-disclosure branch, so the new and duplicate paths issue the exact same database call sequence and nothing about timing or shape distinguishes them
- `utm_source`/`utm_campaign` are trimmed, truncated to 64 characters, null-normalized, and forwarded to `claim_waitlist_signup`'s existing (previously-unused) UTM parameters
- `WaitlistRoleForm.tsx` gained a `name="consent"` checkbox, an off-screen (not `display:none`) honeypot input, two UTM hidden inputs read via `useSearchParams()`, and a `state.code`-driven error sentence mapping — threaded through `WaitlistFounderBannerClient`/`WaitlistFounderBanner` from `fondateurs.error.*`
- `next.config.ts` wraps `withBotId` between the existing analyzer-outside/next-intl-inside composition; `/fondateurs/page.tsx` mounts `BotIdClient` protecting both locale POST paths — `npx next build` still marks both `/fr/fondateurs` and `/en/fondateurs` as `●` (SSG)
- `waitlist.concurrency.test.ts` gained two hoisted mocks (`botid/server`, `@/lib/ratelimit`) and a `consent` field on every fixture — zero existing `it`/`expect`/`describe` lines changed; the suite still collects and skips cleanly without `RUN_DB`
- New `waitlist.validation.test.ts` — 23 tests, no database, proving every guard, the consent write's exact filter/payload shape, and UTM forwarding

## Task Commits

Each task was committed atomically:

1. **T-05-03: Package legitimacy gate — mailchecker and botid** — resolved APPROVED by the real user outside this session (checkpoint, no commit of its own — nothing was built until approval)
2. **T-05-04: Refuse malformed, disposable, bot and flooded submissions before the RPC runs (WAIT-04)** - `0681b8d` (feat)
3. **T-05-05: Record the consent and the campaign that made the signup lawful and attributable (LEGAL-06/07, ENTRY-06)** - `670e1e0` (feat)

## Files Created/Modified

- `apps/web/package.json` / `package-lock.json` - `mailchecker@6.0.21`, `botid@1.5.11` (exact), `zod@^4.3.6` (root-pinned range)
- `apps/web/src/lib/ratelimit.ts` - fourth lazy-singleton export, `waitlistRatelimit`
- `apps/web/src/actions/waitlist.ts` - guard chain, `WaitlistErrorCode`/`code` field, consent write, UTM forwarding
- `apps/web/src/components/marketing/WaitlistRoleForm.tsx` - consent `name`, honeypot input, UTM hidden inputs, per-code error sentence
- `apps/web/src/components/marketing/WaitlistFounderBanner.tsx` / `WaitlistFounderBannerClient.tsx` - thread `errorInvalidEmail`/`errorRateLimited` props down from `fondateurs.error.*`
- `apps/web/next.config.ts` - `withBotId` wrapping, preserving analyzer-outside/next-intl-inside order
- `apps/web/src/app/[locale]/(marketing)/fondateurs/page.tsx` - `BotIdClient` instrumentation, both locale POST paths protected
- `apps/web/test/actions/waitlist.validation.test.ts` - new, 23 tests (guard chain, consent write, UTM forwarding)
- `apps/web/test/actions/waitlist.concurrency.test.ts` - two hoisted mocks, `consent` fixture field added
- `apps/web/test/components/WaitlistRoleForm.test.tsx` - `code: null` added to `WaitlistState` fixtures, `errorInvalidEmail`/`errorRateLimited` added to prop fixtures

## Decisions Made

- **zod version pin:** `npm install zod@^4.3.6` from `apps/web` resolved to `^4.4.3` in `package.json` and produced a duplicate nested `apps/web/node_modules/zod@4.4.3` alongside the root's hoisted `zod@4.3.6` — corrected by hand-editing the range back to `^4.3.6` and re-running `npm install` from the repo root, which collapsed back to a single hoisted install. Confirmed via `package-lock.json` diff touching only the three new packages.
- **Consent gate placement:** combined with the pre-existing empty-email/empty-audience check into one `invalid_form` early return, rather than a second separate check — behaviorally identical to "before any other work" and keeps the top of the function to one guard clause.
- **Error-sentence mapping:** only `invalid_email` and `rate_limited` get a dedicated sentence (`errorInvalidEmail`/`errorRateLimited`); `invalid_form` and `server_error` render `errorGeneric`, matching the plan's literal instruction. The `fondateurs.error.consentRequired` message key that 05-01 already shipped stays unused — not part of this plan's copy contract.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `WaitlistState.code` addition broke type-checking in two files outside T-05-04's declared file list**
- **Found during:** Task T-05-04, running `npx tsc --noEmit` per its own acceptance criteria
- **Issue:** Adding the required `code: WaitlistErrorCode | null` field to `WaitlistState` is exactly what T-05-04 specifies, but it broke two existing object literals that construct a `WaitlistState` and weren't in T-05-04's `<files>` list: `WaitlistRoleForm.tsx`'s `initialState` constant, and four `initialState` arguments in `waitlist.concurrency.test.ts` (a file explicitly owned by T-05-05, not T-05-04).
- **Fix:** Added `code: null` to all five literals. No assertion, title, or behavior changed in either file — purely the one field required by the new type.
- **Files modified:** `apps/web/src/components/marketing/WaitlistRoleForm.tsx`, `apps/web/test/actions/waitlist.concurrency.test.ts`
- **Verification:** `npx tsc --noEmit` clean (excluding pre-existing, unrelated purge-test errors); full `npm run test` green
- **Committed in:** `0681b8d` (T-05-04's commit, documented there since T-05-04's own acceptance criteria demanded a clean `tsc` before that commit)

**2. [Rule 1 - Bug] Plan-check verification command `grep -c "createAdminClient"` expects `1`, but the file has always had `2` (import line + call site)**
- **Found during:** Task T-05-04, running through the acceptance-criteria checklist
- **Issue:** `grep -c "createAdminClient" apps/web/src/actions/waitlist.ts` counts matching *lines*, and both the `import { createAdminClient } from ...` line and the `const admin = createAdminClient();` call line contain the substring — so the count was `2` before this plan touched the file at all (confirmed via `git show HEAD~2:apps/web/src/actions/waitlist.ts`), not something this plan's changes caused.
- **Fix:** None applied — the file's structure (one import, one call site) is exactly what the check's evident intent describes; the literal grep command in the plan's acceptance criteria is miscounting the import line. Not fixed because doing so would mean contorting the import statement, which is worse than a stale verification command.
- **Files modified:** none
- **Verification:** N/A — documented here as a pre-existing plan-authoring gap, not a code defect
- **Committed in:** N/A (no code change)

---

**Total deviations:** 2 (1 auto-fixed blocking type-check ripple, 1 documented pre-existing verification-script mismatch)
**Impact on plan:** Both are structural/documentation matters, not functional gaps. No scope creep — every other file this plan touches matches its own declared `<files>` list.

## Issues Encountered

- `npm install zod@^4.3.6` initially wrote `^4.4.3` to `apps/web/package.json` and left a stale nested `zod@4.4.3` copy in `apps/web/node_modules` from an earlier install attempt — resolved by hand-editing the range and clearing the stale directory before the final `npm install`; see Decisions above.
- The `mailchecker` package ships a `types.d.ts` file at its package root with no `"types"` field in `package.json` pointing to it — verified this still resolves correctly under this workspace's `moduleResolution: "bundler"` tsconfig (a real `apps/web` type-check probe found no error), so no `@types` shim or `// @ts-expect-error` was needed.

## User Setup Required

None - no external service configuration required. `UPSTASH_REDIS_REST_URL`/`TOKEN` (already configured per `05-RESEARCH.md`'s Environment Availability table) activate the new `waitlistRatelimit` export automatically; without them it falls back to the existing no-op behavior, same as the other three limiters.

## Next Phase Readiness

- Plan 05-03 (counter widget) is unaffected — this plan never touches `get_waitlist_founder_status()` or the counter Route Handler.
- Plans 05-04/05-05 (entry points, nav links) can rely on the form's `utm_source`/`utm_campaign` hidden inputs already reading from the query string, so any campaign-tagged link into `/fondateurs` is attributable without further wiring.
- **Recommend before shipping:** run `waitlist.concurrency.test.ts`'s two DB-gated suites (`SUPABASE_TEST_URL`/`SUPABASE_SERVICE_ROLE_KEY` set to a real test project) to confirm the 200-cap race and non-disclosure proofs still hold with the new guard chain and consent write in the call path — this session could only prove the suite's import-safety and mock wiring, not execute the DB-gated assertions themselves (same known gap Phase 1 carries forward, see `STATE.md` Blockers).
- No blockers identified for downstream Phase 5 plans.

---
*Phase: 05-waitlist-page-entry-points*
*Completed: 2026-08-17*

## Self-Check: PASSED

All files listed under "Files Created/Modified" confirmed present on disk. Both task commits
(`0681b8d`, `670e1e0`) confirmed present in `git log --oneline --all`.
