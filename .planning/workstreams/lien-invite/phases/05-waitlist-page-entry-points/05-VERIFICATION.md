---
phase: 05-waitlist-page-entry-points
verified: 2026-08-18T08:30:29Z
status: human_needed
score: 10/10 must-haves verified
behavior_unverified: 0
overrides_applied: 0
human_verification:
  - test: "Submit a genuinely new email, then resubmit the same email, against a real (non-production) Supabase project with SUPABASE_TEST_URL/SUPABASE_SERVICE_ROLE_KEY set. Observe the rendered success panel for both submissions."
    expected: "Both submissions render byte-identically (WAIT-06); a genuinely-new founder-eligible signup shows its rank (WAIT-05); waitlist.concurrency.test.ts's 4 DB-gated cases (200-cap race, non-disclosure) actually execute and pass, not just collect-and-skip."
    why_human: "Requires live database credentials this verification session does not have (SUPABASE_TEST_URL/SUPABASE_SERVICE_ROLE_KEY unset). The code-level state transition is already proven by a passing mocked-RPC unit test (waitlist.validation.test.ts:290-307, DUPLICATE_ROW case) and 18 component tests, but the actual claim_waitlist_signup RPC's real dedupe/rank behavior under the new guard chain + consent write has never been observed end-to-end against a live database. Disclosed in 05-06-SUMMARY.md and 05-VALIDATION.md's Manual-Only Verifications table; accepted by the developer at phase close but never resolved."
  - test: "Raise app_config.waitlist_reveal_threshold on a real (non-production) Supabase project, reload /fondateurs (or the homepage), observe the counter transition from static-offer sentence to live descending count, then restore the original value — with no redeploy in between."
    expected: "The counter widget changes state purely from the config write, proving FOND-06's 'configurable without redeploy' claim in a live environment, not just by grep (no app_config/threshold logic exists in apps/web — confirmed)."
    why_human: "The only Supabase project this workstream held credentials for during Phase 5 was production, not a test project safe to mutate. Never attempted, in this session or the original phase session. Disclosed in 05-06-SUMMARY.md and 05-VALIDATION.md's Manual-Only Verifications table as a named, unresolved gap."
---

# Phase 5: Waitlist Page & Entry Points Verification Report

**Phase Goal:** A visitor from either audience can discover the founder offer, submit only an email
after choosing their profile, and see a truthful, on-brand bilingual page — reachable from every
intended entry point on the site.
**Verified:** 2026-08-18T08:30:29Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Bilingual `/fondateurs` route, statically rendered except the counter (WAIT-01, WAIT-08) | ✓ VERIFIED | `apps/web/src/app/[locale]/(marketing)/fondateurs/page.tsx` — `generateStaticParams` returns `fr`/`en`, calls `setRequestLocale`; `npx next build` route table (re-run this session) shows `/fr/fondateurs` and `/en/fondateurs` both `●` SSG, `/api/waitlist/count` `ƒ` dynamic |
| 2 | Page matches the light sport theme / Tailwind v4 semantic tokens (WAIT-07) | ✓ VERIFIED | Code reads only semantic classes (`text-primary`, `bg-background`, `border-border`, `text-muted`) across `WaitlistRoleForm.tsx`/`WaitlistFounderBanner*.tsx`/`WaitlistCounterClient.tsx`, no new `@theme` entries; additionally human-reviewed live in a real browser during T-05-14's UI safety checkpoint and explicitly approved by the developer (05-06-SUMMARY.md) |
| 3 | Role picked before email field appears; only email is visitor-typed (WAIT-02, WAIT-03) | ✓ VERIFIED | `WaitlistRoleForm.tsx:121-153` — email `<input>` only rendered inside `{role !== null && (...)}`; `audience`/`locale`/UTM fields are `type="hidden"`; 18 passing tests in `WaitlistRoleForm.test.tsx` pin this contract |
| 4 | Malformed/disposable-domain email rejected with a clear message before the RPC runs (WAIT-04) | ✓ VERIFIED | `apps/web/src/actions/waitlist.ts:120-142` — `z.email()` syntax check then `MailChecker.isValid()`, both returning `code: 'invalid_email'` before any RPC call; 23 passing tests in `waitlist.validation.test.ts` |
| 5 | Identical success state for new / duplicate / founder-assigned submissions, no disclosure of prior registration (WAIT-05, WAIT-06) | ✓ VERIFIED (code-level) | `waitlist.ts:190-203` — the `if (!row.is_new)` branch is the *only* place `is_founder`/`founder_rank` are ever read, and returns `isFounder: false, founderRank: null` unconditionally for any non-new row, discarding whatever the RPC reports. Directly proven by `waitlist.validation.test.ts:290-307`: a mocked RPC returns `DUPLICATE_ROW = { is_new: false, is_founder: true, founder_rank: 12 }` and the test asserts `result.isFounder === false` / `founderRank === null` — the code-level non-disclosure transition is exercised and passes, not just present. Client-side rendering byte-identity additionally pinned by 3 `WaitlistRoleForm.test.tsx` cases. **Not yet observed against a real database** — see Human Verification #1. |
| 6 | Counter: fact-only below threshold, live descending count above it, distinct complete state, real never-inflated query (FOND-01→05) | ✓ VERIFIED | `GET /api/waitlist/count` (`route.ts`) relays `get_waitlist_founder_status()` verbatim through `createAdminClient()`, no arithmetic, no other query (confirmed by direct read + `grep` for `app_config`/`from('waitlist_signups')`/cap-arithmetic — all absent). `WaitlistCounterClient.tsx` renders the static sentence when `shouldDisplay=false`, the live `remaining` count when `true`, and a distinct completion panel when `isFull=true` (checked before the count, D-10) — one `fetch` per mount only (`useEffect([])`, no interval/poll, confirmed by `grep`). 19 passing tests across `waitlist-count.test.ts` (9) and `WaitlistCounterClient.test.tsx` (10) |
| 7 | Reveal threshold configurable without redeploy (FOND-06) | ✓ VERIFIED (structural) | `supabase/migrations/20260812_waitlist_founder_offer.sql:180-202` — `get_waitlist_founder_status()` reads `app_config.waitlist_reveal_threshold` at query time inside `SECURITY DEFINER SQL`; `apps/web` contains zero threshold/cap logic (confirmed by direct code read of `route.ts`/`WaitlistCounterClient.tsx` — both only relay booleans/numbers already decided by the RPC). **The actual "change the config, see the page change, no redeploy" behavior has never been observed live** — see Human Verification #2. |
| 8 | All four entry points reachable with correct routing/locale (homepage, `/coachs`, header, footer) (ENTRY-01, ENTRY-02, ENTRY-03) | ✓ VERIFIED | Homepage: `page.tsx:72-74` renders `<Hero /> <FoundersOfferSection locale={locale} /> <HowItWorks />` in that source order. `/coachs`: `CoachsHeroClient.tsx:85` and `CoachsCtaFooterClient.tsx:33` both link to `` /${locale}/fondateurs?${WAITLIST_ROLE_PARAM}=${WAITLIST_ROLE_COACH} `` (constants imported from `WaitlistRoleForm.tsx`, not retyped). Header/Footer: `HeaderClient.tsx:38` and `FooterClient.tsx:40` both link to `/fondateurs`. 38 passing tests across `entry-points.test.tsx` (15) and `site-chrome.test.tsx` (8) pin these hrefs. **Locale-propagation fix independently re-verified** — see Key Link Verification below |
| 9 | Correct social preview on share; page indexable and in sitemap (ENTRY-04, ENTRY-05) | ✓ VERIFIED | `fondateurs/opengraph-image.tsx` + `twitter-image.tsx` (`next/og`, both locales, confirmed `●` SSG in build); `page.tsx` `generateMetadata` sets canonical/alternates/OpenGraph/Twitter card. `sitemap.ts:8` adds `{ path: '/fondateurs', changeFrequency: 'daily', priority: 0.9 }`; `robots.ts` confirmed unmodified (no disallow). 12 + 6 passing tests (`fondateurs.metadata.test.ts`, `sitemap.test.ts`) |
| 10 | Signups measurable as conversions (ENTRY-06) | ✓ VERIFIED | Server half: `waitlist.ts` forwards trimmed/truncated/null-normalized `utm_source`/`utm_campaign` to `claim_waitlist_signup`. Client half: `WaitlistRoleForm.tsx:96-102` fires `track('waitlist_signup', { audience: role })` exactly once per success transition, ref-guarded against Strict Mode double-invoke, payload confirmed to carry no email/rank via `grep`. 23 + 5 passing tests |

**Score:** 10/10 truths verified (code + test evidence for every roadmap success criterion). Two items
within truths #5 and #7 have a disclosed, unresolved live-database observation gap — see Human
Verification below. These do not reduce the score (the code-level behavior each depends on is proven
by a passing test, not merely present) but block an unconditional `passed` status.

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `apps/web/src/app/[locale]/(marketing)/fondateurs/page.tsx` | Bilingual SSG route | ✓ VERIFIED | Exists, substantive, wired, SSG confirmed in build |
| `apps/web/src/components/marketing/WaitlistRoleForm.tsx` | Role picker + email form + Server Action wiring | ✓ VERIFIED | Exists, substantive (247 lines, full guard/consent/tracking logic), wired to `claimWaitlistSpot` |
| `apps/web/src/actions/waitlist.ts` | Hardened Server Action | ✓ VERIFIED | Exists, substantive (204 lines, 5-guard chain, consent write, D-03/D-04 filter), wired to `claim_waitlist_signup`/`normalize_waitlist_email` RPCs |
| `apps/web/src/app/api/waitlist/count/route.ts` | Public counter relay | ✓ VERIFIED | Exists, substantive, wired to `get_waitlist_founder_status()` via admin client, zero arithmetic confirmed |
| `apps/web/src/components/marketing/WaitlistCounterClient.tsx` | Three-state counter widget | ✓ VERIFIED | Exists, substantive, wired to `/api/waitlist/count`, one-fetch-per-mount confirmed |
| `apps/web/src/components/marketing/FoundersOfferSection(Client).tsx` | Homepage founders section | ✓ VERIFIED | Exists, mounted between `<Hero />` and `<HowItWorks />`, reuses `WaitlistCounterClient` |
| `apps/web/src/app/[locale]/(marketing)/layout.tsx` | Locale-propagation fix (commit `137a562`) | ✓ VERIFIED | `setRequestLocale(locale)` called before `<Header />`/`<Footer />` render — see Key Link Verification |
| `apps/web/src/app/sitemap.ts` | `/fondateurs` entry | ✓ VERIFIED | `{ path: '/fondateurs', changeFrequency: 'daily', priority: 0.9 }` present |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|----|--------|---------|
| `WaitlistRoleForm.tsx` | `claimWaitlistSpot` Server Action | `useActionState(claimWaitlistSpot, initialState)` + manual `onSubmit`/`startTransition` dispatch | ✓ WIRED | Confirmed by direct read; 18 passing tests exercise the full dispatch |
| `claimWaitlistSpot` | `claim_waitlist_signup` RPC | `admin.rpc('claim_waitlist_signup', {...})` via `createAdminClient()` | ✓ WIRED | Confirmed; result consumed and gated through D-03/D-04 filter |
| `WaitlistCounterClient.tsx` | `GET /api/waitlist/count` | plain `fetch('/api/waitlist/count')` in `useEffect([])` | ✓ WIRED | Confirmed; response shape validated (`isValidResponse`) before use |
| `/api/waitlist/count` route | `get_waitlist_founder_status()` RPC | `admin.rpc('get_waitlist_founder_status')` | ✓ WIRED | Confirmed; verdict relayed verbatim, no recomputation |
| `CoachsHeroClient.tsx` / `CoachsCtaFooterClient.tsx` | `/fondateurs?role=coach` | `href` built from `WAITLIST_ROLE_PARAM`/`WAITLIST_ROLE_COACH` imported from `WaitlistRoleForm.tsx` | ✓ WIRED | Confirmed via `grep`; both files import the same constants the form's own reader accepts |
| `page.tsx` (homepage) | `FoundersOfferSection` | `<FoundersOfferSection locale={locale} />` between `<Hero />` and `<HowItWorks />` | ✓ WIRED | Confirmed source order via direct read |
| `MarketingLayout` (`(marketing)/layout.tsx`) | `Header`/`Footer` locale resolution | `await params` → `setRequestLocale(locale)` called before `<Header />`/`<Footer />` render | ✓ WIRED | **Independently re-read the diff logic (not trusted from commit message):** commit `137a562` adds `params: Promise<{locale:string}>` to the layout's props, awaits it, and calls `setRequestLocale(locale)` immediately before rendering `<Header />`/`<Footer />`. This mirrors every other `page.tsx` in the tree (`cgv`, `cgu`, `fondateurs`) that already self-declares its locale. The current file on disk (read directly, not via `git show`) contains exactly this code — the fix is present, not merely claimed. Structurally sound: it closes the exact propagation gap next-intl's docs describe for shared layouts that don't re-declare `setRequestLocale`. |
| `HeaderClient.tsx` / `FooterClient.tsx` | `/fondateurs` | `<Link href="/fondateurs">` / `<AnimatedLink href="/fondateurs">` | ✓ WIRED | Confirmed via `grep`, one occurrence each |
| `sitemap.ts` | `/fondateurs` | static `pages` array entry, `flatMap`'d over `routing.locales` | ✓ WIRED | Confirmed; 6 passing tests including alternates and total-count checks |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|---------------------|--------|
| `WaitlistCounterClient` | `remaining` / `shouldDisplay` / `isFull` | `GET /api/waitlist/count` → `admin.rpc('get_waitlist_founder_status')` → live Postgres function counting `waitlist_signups WHERE is_founder` and reading `app_config.waitlist_reveal_threshold` | Yes | ✓ FLOWING |
| `claimWaitlistSpot` success state | `isFounder` / `founderRank` | `admin.rpc('claim_waitlist_signup', {...})` → live `SEQUENCE`-backed RPC (Phase 1) | Yes | ✓ FLOWING |
| Sitemap `/fondateurs` entry | `lastModified` | `new Date()` at build time, same pattern as the 4 pre-existing entries | Yes (build-time real value, not a hardcoded literal) | ✓ FLOWING |

No hardcoded/static fallback was found standing in for a real query. The one design-intentional
"static" value is `WaitlistCounterClient`'s pre-mount loading skeleton and its fetch-failure fallback
(`{shouldDisplay:false, remaining:null, isFull:false}`), which is documented, tested, and identical to
the route's own honest failure default — not a disguised stub.

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Full workspace test suite (run once, not per-truth) | `cd apps/web && npm run test` | 319 passed, 4 skipped (DB-gated, `RUN_DB` unset — matches the disclosed gap) | ✓ PASS |
| TypeScript check | `cd apps/web && npx tsc --noEmit` | 47 errors, all confined to `test/purge/*.test.ts` (pre-existing, Phase 2, out of Phase 5 scope) — zero errors in any Phase 5 file | ✓ PASS |
| Lint | `cd apps/web && npm run lint` | exit 0, 48 pre-existing warnings, 0 errors | ✓ PASS |
| Production build + route table | `cd apps/web && npx next build` | exit 0; `/fr/fondateurs`, `/en/fondateurs`, both OG/Twitter image routes, `/coachs`, homepage all `●` SSG; `/api/waitlist/count` `ƒ` dynamic | ✓ PASS |
| Message key parity FR/EN | `node` key-tree diff over `messages/fr.json` / `en.json` | 0 keys only in fr, 0 keys only in en | ✓ PASS |

All four commands were re-run independently in this verification session (not taken from SUMMARY.md
claims) and reproduce the same green result the plans report.

### Probe Execution

N/A — Phase 5 declares no `scripts/*/tests/probe-*.sh` probes; verification relies on the vitest suite,
`tsc`, lint, and `next build` instead, all re-run above.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|--------------|--------|----------|
| WAIT-01 | 05-01 | Bilingual dedicated page | ✓ SATISFIED | Truth #1 |
| WAIT-02 | 05-01 | Progressive disclosure role picker | ✓ SATISFIED | Truth #3 |
| WAIT-03 | 05-01 | Single email input | ✓ SATISFIED | Truth #3 |
| WAIT-04 | 05-02 | Malformed/disposable rejection | ✓ SATISFIED | Truth #4 |
| WAIT-05 | 05-01 | Founder-rank success state | ✓ SATISFIED (code-level) | Truth #5 |
| WAIT-06 | 05-01/05-02 | Non-disclosure of duplicate | ✓ SATISFIED (code-level) | Truth #5 |
| WAIT-07 | 05-01/05-06 | Theme conformance | ✓ SATISFIED | Truth #2, human-approved at T-05-14 |
| WAIT-08 | 05-01/05-03 | SSG except counter | ✓ SATISFIED | Truth #1 |
| FOND-01 | 05-03 | Fact-only pre-threshold | ✓ SATISFIED | Truth #6 |
| FOND-02 | 05-03 | Live descending count | ✓ SATISFIED | Truth #6 |
| FOND-03 | 05-03 | Real query, never fabricated | ✓ SATISFIED | Truth #6, Data-Flow Trace |
| FOND-04 | 05-03 | Never increases (one fetch/mount) | ✓ SATISFIED | Truth #6 |
| FOND-05 | 05-03 | Distinct complete state | ✓ SATISFIED | Truth #6 |
| FOND-06 | 05-03 | Configurable without redeploy | ✓ SATISFIED (structural) | Truth #7 |
| ENTRY-01 | 05-04 | Homepage entry point | ✓ SATISFIED | Truth #8 |
| ENTRY-02 | 05-04 | `/coachs` entry point | ✓ SATISFIED | Truth #8 |
| ENTRY-03 | 05-05 | Header/footer entry point | ✓ SATISFIED | Truth #8 |
| ENTRY-04 | 05-01 | Social preview | ✓ SATISFIED | Truth #9 |
| ENTRY-05 | 05-05 | Sitemap/indexable | ✓ SATISFIED | Truth #9 |
| ENTRY-06 | 05-02/05-05 | Conversions measurable | ✓ SATISFIED | Truth #10 |

No orphaned requirements — all 19 Phase-5-owned IDs from `REQUIREMENTS.md`'s traceability table appear
in at least one plan's `requirements-completed` list.

### Anti-Patterns Found

None. Scanned every file this phase created/modified for `TBD`/`FIXME`/`XXX`/`TODO`/`HACK`/
`PLACEHOLDER`/"coming soon"/"not yet implemented" and empty-implementation patterns
(`return null`/`{}`/`[]`, no-op handlers) — zero matches in `waitlist.ts`, `route.ts`,
`WaitlistCounterClient.tsx`, `WaitlistRoleForm.tsx`, `FoundersOfferSection(Client).tsx`. The one
`placeholder` grep hit is a legitimate `<input placeholder={...}>` prop, not a stub marker.

### Human Verification Required

### 1. Real submission success/duplicate states, observed live

**Test:** Submit a genuinely new email, then resubmit the same email, against a real (non-production)
Supabase project with real test credentials.
**Expected:** Both submissions render byte-identically per WAIT-06; a genuinely-new founder-eligible
signup shows its rank per WAIT-05; the 4 DB-gated cases in `waitlist.concurrency.test.ts` actually
execute (not collect-and-skip) and pass.
**Why human:** No `SUPABASE_TEST_URL`/`SUPABASE_SERVICE_ROLE_KEY` available in this or the original
execution session. The code-level transition is already proven by a passing mocked-RPC test
(`waitlist.validation.test.ts:290-307`), so this is a real-infrastructure confirmation, not an
implementation gap — but it remains genuinely unobserved end-to-end. Disclosed honestly in
`05-06-SUMMARY.md` and `05-VALIDATION.md`.

### 2. FOND-06 live counter-reveal-threshold change

**Test:** On a real (non-production) Supabase project, change `app_config.waitlist_reveal_threshold`,
reload the page, observe the counter's state change, then restore the original value — no redeploy.
**Expected:** The counter widget transitions between its pre-threshold and count-visible states purely
from the config write.
**Why human:** Never attempted in any session — the only Supabase project this workstream held
credentials for is production, not a project safe to mutate for this test. The structural guarantee
(no threshold logic exists anywhere in `apps/web`) is code-verified; the live behavior is not.
Disclosed honestly in `05-06-SUMMARY.md` and `05-VALIDATION.md`.

### Gaps Summary

No blocking gaps. Every roadmap success criterion for Phase 5 is backed by code that exists,
is substantive, is wired end to end, and (where behavior-dependent) is exercised by a passing test —
independently re-verified in this session via a fresh `npm run test`, `npx tsc --noEmit`, `npm run
lint`, and `npx next build`, all reproducing the green results the plan summaries claim. The
locale-propagation fix (commit `137a562`) was independently re-read on disk, not trusted from the
commit message, and is structurally sound.

The phase's own two disclosed gaps — a live-database observation of the real submission/duplicate
flow, and a live observation of FOND-06's redeploy-free threshold change — were honestly recorded in
`05-06-SUMMARY.md` and `05-VALIDATION.md`'s Manual-Only Verifications table, not silently marked
passing, and were explicitly accepted by the developer at phase close. This verification confirms that
disclosure is accurate (both items remain genuinely unobserved) and surfaces them again here as formal
human-verification items rather than letting the phase close as an unconditional `passed`. Neither
blocks Phase 6 from starting per the phase's own `ROADMAP.md` dependency graph, but both should close
before the founder offer is genuinely activated in production, since that activation is exactly what
Phase 6 exists to gate.

---

*Verified: 2026-08-18T08:30:29Z*
*Verifier: Claude (gsd-verifier)*
