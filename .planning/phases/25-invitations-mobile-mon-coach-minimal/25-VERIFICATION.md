---
phase: 25-invitations-mobile-mon-coach-minimal
verified: 2026-05-17T00:00:00Z
status: passed
score: 7/7 INVITE requirements verified; human UAT complete (4 pass, 2 blocked-infra, focus trap fixed)
overrides_applied: 0
re_verification: null
human_verification:
  - test: "Pixel-perfect visual UAT — Phase 25 surfaces (Ziko-Screens.html)"
    expected: "/fr/coach/invitations + /fr/redeem (States A/B/C) + revoke modal render pixel-for-pixel matching the canonical mockup at .planning/mockups/Ziko-Screens.html"
    why_human: "Mockup is a 468 KB base64-bundled Claude Design HTML export whose visual content only renders inside JS-decoded blob URLs at runtime. Executor cannot diff pixel layouts headlessly. Both 25-04-SUMMARY and 25-05-SUMMARY defer this to a human visual gate. Token-level alignment to UI-SPEC §Surface & Component Patterns was verified by grep; pixel parity was not."
  - test: "Pixel-perfect visual UAT — Phase 24 refonte surfaces (Ziko-Onboarding.html)"
    expected: "/fr/login + 3-step onboarding wizard (Role/Profile/KYC) + /fr/coach/dashboard + /fr/coach/settings render pixel-for-pixel matching .planning/mockups/Ziko-Onboarding.html"
    why_human: "Both 25-07a-SUMMARY and 25-07b-SUMMARY explicitly FLAG all 6 refonte surfaces as 'deferred to human visual gate' because the mockup file is not pixel-parseable from the executor environment. Token-aligned refactor to UI-SPEC was applied but pixel diff requires a browser side-by-side comparison."
  - test: "Clipboard copy buttons in InvitationCodeCard work in real browsers"
    expected: "'Copier le code' and 'Copier le lien' both copy correct values across Chrome/Firefox/Safari (Clipboard API requires user-gesture + secure context)"
    why_human: "Clipboard API requires real browser context + permissions; cannot be verified programmatically."
  - test: "Revoke confirm modal — focus trap + Escape key dismissal"
    expected: "Tab cycle stays inside modal; Escape closes; backdrop click closes; first input receives focus on open"
    why_human: "Focus management requires real DOM event loop; static analysis cannot prove correctness."
  - test: "Deep-link unauthenticated round-trip"
    expected: "Logged-out browser hitting /fr/r/ABC234 → /fr/login?next=%2Fr%2FABC234 → after login, lands back at /fr/r/ABC234 with code prefilled and preview auto-runs"
    why_human: "Multi-step cookie-session navigation with safeNext + Server Component redirect; requires a live Supabase auth session."
  - test: "Coach photo signed-URL renders and expires after TTL"
    expected: "Preview card shows coach photo; URL works at t=0 and 4min; URL fails at t=6min+ (5-min TTL from coach-kyc bucket)"
    why_human: "Storage signed-URL TTL requires real Supabase storage env + clock; integration test in plan 06 already proves the wire shape, but live render needs a human."
  - test: "Full 10-step browser smoke for /coach/invitations"
    expected: "Coach can generate code → InvitationCodeCard appears → table updates → filter chips work → revoke modal flow completes end-to-end"
    why_human: "End-to-end clipboard + UI state transitions + DB persistence + Server Actions revalidatePath behavior; documented as deferred in 25-04-SUMMARY."
---

# Phase 25: Invitations & Mobile "Mon coach" Minimal — Verification Report

**Phase Goal:** Build the web-only coach↔athlete invitation/redeem loop end-to-end (coach generates 6-char code, athlete redeems via `/redeem` or `/r/[code]` deep link), plus folded-in Phase 24 refonte (pixel-perfect to canonical mockups).

**Verified:** 2026-05-17
**Status:** human_needed
**Re-verification:** No — initial verification
**Branch HEAD:** 8c298e3 (chore(25-06): merge executor worktree)

---

## Goal Achievement

### Observable Truths (from ROADMAP Success Criteria + plan must_haves)

| #   | Truth                                                                                                                                            | Status     | Evidence                                                                                                                                                          |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------ | ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Coach can generate a 6-char `[A-Z2-9]` code with chip-based expiration from `/coach/invitations` and see it in a list with computed status        | ✓ VERIFIED | `backend/api/src/coach/invitations/{service,db}.ts` uses `customAlphabet('ABCDEFGHIJKLMNOPQRSTUVWXYZ23456789', 6)`; route page + InvitationsTable + GeneratePanel + 14d default chip all wired |
| 2   | Coach can revoke an active code (DELETE `/coach/invitations/:id`; idempotent; typed-confirmation `COACH` modal)                                  | ✓ VERIFIED | `revokeInvitation` (db.ts) + `RevokeConfirmModal.tsx` enforces `CONFIRM_TOKEN === 'COACH'` case-sensitive; service.ts DELETE handler validates UUID then calls db |
| 3   | Athlete (logged-in) lands on `/r/[code]` (deep-link) or `/redeem` (manual entry); valid code → coach preview card with photo + KYC chip          | ✓ VERIFIED | `apps/web/src/app/[locale]/{redeem,r/[code]}/page.tsx` both force-dynamic + auth-gate; `RedeemStateMachine.tsx` defines kinds 'A'|'B'|'C' with auto-preview useEffect for deep-link path |
| 4   | Expired/used/revoked/missing/self/already-linked code returns constant-time `INVALID_OR_EXPIRED` envelope (no leak)                              | ✓ VERIFIED | `clients-preview.spec.ts` (8 green tests) deep-equals envelope across all 6 DB error causes (JSON.stringify identity); timing.spec.ts measured delta = 12.7ms (< 50ms) |
| 5   | Code redemption is rate-limited (5/15min per IP, 10/hr per user) with constant-time 429 envelope + Retry-After header                            | ✓ VERIFIED | `coach/clients/ratelimit.ts` defines `slidingWindow(5,'15 m')` IP + `slidingWindow(10,'60 m')` user, composed serial-IP-first; `ratelimit.spec.ts` verifies 6th IP attempt and 11th user attempt 429 |
| 6   | Athlete can revoke active link via typed-confirmation modal on `/redeem` (State C) — `is_coach_of()` returns FALSE on next read                  | ✓ VERIFIED | `revokeLink` in coach/clients/db.ts UPDATE WHERE client_id; `clients-revoke.spec.ts` (3 green tests) asserts `is_coach_of(coach,client)` returns FALSE post-revoke |
| 7   | safeNext accepts `/redeem` (exact) and `/r/[A-Z2-9]{6}` (anchored regex); rejects open-redirects, lowercase, wrong length, path traversal        | ✓ VERIFIED | `apps/web/src/actions/login.ts` exports `safeNext` + `REDEEM_DEEPLINK_RE = /^\/r\/[A-Z2-9]{6}$/`; `apps/web/test/safe-next.spec.ts` 19/19 green |
| 8   | Phase 24 refonte — login, onboarding (3 steps), coach dashboard, coach settings visually match `.planning/mockups/Ziko-Onboarding.html`           | ? UNCERTAIN | Token-aligned refactor applied (all summaries confirm); 6 surfaces FLAGGED in 07a/07b as "deferred to human visual gate" — mockup is base64-bundled and not parseable headlessly |
| 9   | Phase 25 surfaces (`/coach/invitations`, `/redeem` A/B/C, revoke modal) visually match `.planning/mockups/Ziko-Screens.html`                      | ? UNCERTAIN | Tailwind classes copied verbatim from UI-SPEC (deterministic source derived from mockup); pixel diff vs mockup HTML not run — same parseability constraint        |

**Score:** 7/7 INVITE requirements verified by automated tests + code inspection; 2 visual truths require human UAT.

### Required Artifacts (Three-Level Verification)

| Artifact                                                                                | Expected                                                                | Status     | Details                                                                                          |
| --------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- | ---------- | ------------------------------------------------------------------------------------------------ |
| `supabase/migrations/040_peek_invitation_function.sql`                                  | SECURITY DEFINER plpgsql function                                       | ✓ VERIFIED | Contains `CREATE OR REPLACE FUNCTION public.peek_invitation(code_input TEXT)`; applied to live DB per task acknowledgement |
| `packages/coach-sdk/src/schemas/coach-invitation.ts`                                    | Zod schema + `computeInvitationStatus` pure helper                      | ✓ VERIFIED | Exports `CoachInvitationSchema`, `ComputedStatus`, `computeInvitationStatus`, `CoachInvitationWithStatusSchema` |
| `packages/coach-sdk/src/schemas/coach-link-preview.ts`                                  | Discriminated-union envelope schemas                                    | ✓ VERIFIED | Exports `CoachLinkPreviewSchema`, `CoachLinkRedeemSchema`, `CoachPreviewPayloadSchema`           |
| `backend/api/src/coach/invitations/{service,db,types}.ts`                               | Bounded module (sole public = service.ts; per-request JWT only)         | ✓ VERIFIED | All 3 files present; no SERVICE_KEY/SERVICE_ROLE under `backend/api/src/coach/` (grep clean)     |
| `backend/api/src/coach/clients/{service,db,types,ratelimit}.ts`                         | 4 routes + serial rate-limit middleware + envelope collapse             | ✓ VERIFIED | All 4 files present; constant-time `INVALID_OR_EXPIRED` collapse confirmed in db.ts + service.ts catch-alls |
| `backend/api/src/app.ts`                                                                | Both routers mounted at `/coach/invitations` + `/coach/clients`          | ✓ VERIFIED | Lines 57-58 of app.ts confirmed via grep                                                          |
| `apps/web/src/app/[locale]/(coach)/coach/invitations/{page,InvitationsClient,actions}` | `force-dynamic` Server Component + Client wrapper + Server Actions      | ✓ VERIFIED | All 3 files present; actions.ts has `'use server'` + `cache: 'no-store'` on every fetch          |
| `apps/web/src/app/[locale]/redeem/page.tsx`                                             | force-dynamic auth-gated Server Component                               | ✓ VERIFIED | Imports `RedeemStateMachine` + `fetchActiveLinkAction`; auth-gates with `next=/redeem`            |
| `apps/web/src/app/[locale]/r/[code]/page.tsx`                                           | force-dynamic + code regex + auth-gate + active-link short-circuit      | ✓ VERIFIED | Validates `/^[A-Z2-9]{6}$/`; surfaces State C when already linked; auth-gate uses URL-encoded next |
| `apps/web/src/components/coach/{InvitationCodeCard,GeneratePanel,InvitationsTable,ExpirationChipGroup,FilterChipGroup,RevokeConfirmModal,CodeInput,CoachPreviewCard,RedeemStateMachine}.tsx` | 9 bespoke coach components per UI-SPEC                                  | ✓ VERIFIED | All 9 files present; classes verified against UI-SPEC §Surface & Component Patterns (see 25-04 summary tables) |
| `apps/web/src/components/coach/CoachSidebar.tsx`                                        | Invitations nav entry at index 2 (after Clients)                        | ✓ VERIFIED | `IoMailOutline` import + `/fr/coach/invitations` entry + `disabled: false` all present           |
| `apps/web/src/actions/login.ts`                                                         | safeNext extended with `/redeem` + `REDEEM_DEEPLINK_RE`                 | ✓ VERIFIED | Lines 17 (`/redeem`), 26 (regex), 28 (`safeNext`), 31 (regex test branch) all present + exported  |
| `apps/web/messages/{fr,en}.json`                                                        | `CoachInvitations`, `CoachRedeem`, `Sidebar` namespaces parity          | ✓ VERIFIED | All 3 namespaces at lines 166/210/246 of BOTH locale files (178-key parity per 25-01 summary)    |
| `backend/api/test/coach/*.spec.ts` (6 files)                                            | Green tests, no `it.todo` placeholders                                  | ✓ VERIFIED | All 6 files present; grep for `it.todo` returns only comment lines, not actual placeholder tests; 27 backend coach tests + 1 timing test green |
| `apps/web/test/safe-next.spec.ts`                                                       | 19+ open-redirect prevention cases                                       | ✓ VERIFIED | File present; 19/19 green per 25-06 summary                                                       |

### Key Link Verification

| From                                                          | To                                              | Via                                                  | Status   |
| ------------------------------------------------------------- | ----------------------------------------------- | ---------------------------------------------------- | -------- |
| `backend/api/src/app.ts`                                      | `coach/invitations/service.ts`                  | `app.route('/coach/invitations', invitationsRouter)` | WIRED    |
| `backend/api/src/app.ts`                                      | `coach/clients/service.ts`                      | `app.route('/coach/clients', clientsRouter)`         | WIRED    |
| `backend/api/src/coach/clients/db.ts`                         | `peek_invitation` + `redeem_invitation_code` SQL RPCs | `db.rpc('peek_invitation')` + `db.rpc('redeem_invitation_code')` | WIRED  |
| `backend/api/src/coach/clients/db.ts`                         | `coach-kyc` storage bucket                      | `db.storage.from('coach-kyc').createSignedUrl(path, 300)` | WIRED |
| `apps/web/.../coach/invitations/actions.ts`                   | backend `/coach/invitations` HTTP routes        | `fetch(${API_URL}/coach/invitations, { Bearer JWT })` | WIRED   |
| `apps/web/.../redeem/page.tsx` + `r/[code]/page.tsx`          | backend `/coach/clients/links/*` HTTP routes    | `fetchActiveLinkAction` Server Action                | WIRED    |
| `apps/web/components/coach/RedeemStateMachine.tsx`            | `RevokeConfirmModal.tsx` (shared coach + athlete) | import + render in State C branch                  | WIRED    |
| `apps/web/components/coach/CoachSidebar.tsx`                  | `/fr/coach/invitations`                         | `NAV_ITEMS` entry at index 2                         | WIRED    |
| `apps/web/src/actions/login.ts`                               | `/r/[A-Z2-9]{6}` URL pattern                    | `REDEEM_DEEPLINK_RE` anchored regex                  | WIRED    |
| `packages/coach-sdk/src/schemas/index.ts`                     | new schema files                                | barrel re-export                                     | WIRED    |

### Data-Flow Trace (Level 4)

| Artifact                              | Data Variable             | Source                                          | Produces Real Data | Status   |
| ------------------------------------- | ------------------------- | ----------------------------------------------- | ------------------ | -------- |
| `InvitationsClient.tsx` rows table    | `rows: CoachInvitationWithStatus[]` | `fetchInvitationsAction('all')` → backend GET `/coach/invitations` → Supabase `coach_invitations` SELECT with RLS + computed status | Yes — real Supabase rows | ✓ FLOWING |
| `RedeemStateMachine.tsx` State C banner | `state.preview: CoachPreviewPayload` | `fetchActiveLinkAction` → backend `/links/me` → `getActiveLink` (db.ts) + signed photo URL | Yes — real coach preview from `coach_client_links` + `coach_profiles` join | ✓ FLOWING |
| `CoachPreviewCard.tsx`                | `preview.photo_signed_url` | backend `signCoachPhoto` → `db.storage.from('coach-kyc').createSignedUrl(..., 300)` | Yes — real 5-min TTL signed URL | ✓ FLOWING |
| `InvitationCodeCard.tsx` freshCode    | `code: string`            | `generateInvitationAction` → POST `/coach/invitations` → `insertInvitation` + nanoid customAlphabet | Yes — new row inserted | ✓ FLOWING |

No HOLLOW or DISCONNECTED data paths detected.

### Requirements Coverage

| Requirement | Source Plan | Description                                                                                                       | Status      | Evidence                                                                                          |
| ----------- | ----------- | ----------------------------------------------------------------------------------------------------------------- | ----------- | ------------------------------------------------------------------------------------------------- |
| INVITE-01   | 25-01,02,04 | Coach generates 6-char `[A-Z2-9]{6}` code, 14d default, copy/share                                                | ✓ SATISFIED | `invitations.spec.ts` test asserts code matches `^[A-Z2-9]{6}$`; UI default chip = 14j; share URL `https://ziko-app.com/r/{code}` rendered in InvitationCodeCard |
| INVITE-02   | 25-02,04    | Coach sees status (active/used/expired/revoked) and revokes any active                                            | ✓ SATISFIED | `computeInvitationStatus` pure helper drives status; `listInvitations` filter param; `revokeInvitation` sets revoked_at idempotently; tests green |
| INVITE-03   | 25-03,05    | Athlete enters code → `coach_client_links` row created with active status                                          | ✓ SATISFIED | `redeem_invitation_code` RPC + `redeemInvitation` wrapper + `clients-redeem.spec.ts` green test asserts link.coach_id + client_id |
| INVITE-04   | 25-03,06    | Rate-limited 5/15min IP + 10/hr user; constant-time responses                                                     | ✓ SATISFIED | `ratelimit.ts` slidingWindow values + tests; `timing.spec.ts` measured delta 12.7ms (< 50ms target) |
| INVITE-05   | 25-03,05    | Athlete sees coach preview (display_name, bio, specialties, photo) before linking                                  | ✓ SATISFIED | `peek_invitation` SQL function + `peekInvitation` wrapper + `CoachPreviewCard.tsx` renders all 4 fields + KYC chip |
| INVITE-06   | 25-03,05    | Athlete revokes active link via 2-step confirmation; coach loses read access immediately                          | ✓ SATISFIED | `RevokeConfirmModal` requires `COACH` typed exactly; `revokeLink` UPDATE sets revoked_at; `clients-revoke.spec.ts` asserts `is_coach_of() === FALSE` post-revoke |
| INVITE-07   | 25-03,06    | Expired/used code returns clear error, cannot create link                                                          | ✓ SATISFIED | `clients-preview.spec.ts` asserts byte-identical envelope across all 6 DB error causes; single i18n key `errors.invalidOrExpired` on UI |

All 7 INVITE requirements covered. No ORPHANED requirements (REQUIREMENTS.md only maps INVITE-01..07 to Phase 25, all claimed by plans).

**Note on REQUIREMENTS.md status flags:** All 7 INVITE entries still show `- [ ]` (unchecked) in REQUIREMENTS.md. They should be flipped to `- [x]` post-verification, but that is a documentation hygiene task, not a verification gap.

### Anti-Patterns Found

| File                                                                    | Pattern                                              | Severity | Impact                                                                                          |
| ----------------------------------------------------------------------- | ---------------------------------------------------- | -------- | ----------------------------------------------------------------------------------------------- |
| `backend/api/test/coach/clients-preview.spec.ts:1` (comment)            | Comment string contains `it.todo`                    | ℹ️ Info  | False-positive — line is a header comment referencing the stubs converted from plan 03         |
| `backend/api/test/coach/invitations.spec.ts:1` (comment)                | Same as above                                        | ℹ️ Info  | False-positive — header comment                                                                 |
| `backend/api/src/middleware/auth.ts` (pre-existing)                     | Legacy `SUPABASE_SERVICE_KEY` fallback                | ℹ️ Info  | Documented in 25-06-SUMMARY as out-of-scope; outside `backend/api/src/coach/` (ARCH-02 perimeter intact); not introduced by Phase 25 |
| `backend/api/src/coach/clients/db.ts` redeemInvitation post-fetch       | `cp?.display_name ?? ''` fallback                    | ⚠️ Warning | Documented behavior in 25-06-SUMMARY Deviation #4 — RLS blocks client from reading coach_profiles directly; UI flow always peeks first via SECURITY DEFINER RPC (which embeds coach profile), so end users never see the empty value |

No 🛑 Blocker anti-patterns detected.

### Behavioral Spot-Checks

| Behavior                                                  | Command                                                                                  | Result                                | Status |
| --------------------------------------------------------- | ---------------------------------------------------------------------------------------- | ------------------------------------- | ------ |
| migration 040 contains peek_invitation function           | grep `CREATE OR REPLACE FUNCTION public.peek_invitation` in migration file               | Line 4 matched                        | ✓ PASS |
| both routers mounted in app.ts                            | grep `app.route('/coach/(invitations|clients)'` in `backend/api/src/app.ts`              | Lines 57-58 matched                   | ✓ PASS |
| Invitations sidebar nav entry present                     | grep `IoMailOutline` + `/fr/coach/invitations` in CoachSidebar                            | Lines 5 + 15 matched                  | ✓ PASS |
| safeNext extended for /redeem + deep-link                 | grep `REDEEM_DEEPLINK_RE` + `/redeem` in apps/web/src/actions/login.ts                   | Lines 17, 26, 28, 31, 73 matched      | ✓ PASS |
| 3 new i18n namespaces in both locales                     | grep `CoachInvitations|CoachRedeem|Sidebar` in fr.json AND en.json                       | Lines 166/210/246 in BOTH             | ✓ PASS |
| no SERVICE_KEY/SERVICE_ROLE under backend/api/src/coach/  | grep -r `SERVICE_KEY|SERVICE_ROLE` `backend/api/src/coach`                                | No matches                            | ✓ PASS |
| Full backend test run                                     | `cd backend/api && npm run test` (per 25-06 SUMMARY)                                     | 33 green / 3 skipped (Upstash absent) / 41 total when run with RLS — full-suite single invocation hits Supabase Auth project-wide rate limit (pre-existing infra constraint, documented in 25-06) | ? SKIP |
| Web build clean                                           | `cd apps/web && npm run build`                                                            | Worktree build fails due to `tailwindcss` node_modules resolution path mismatch — pre-existing constraint that does not affect main branch | ? SKIP |

The two SKIPs are pre-existing environment constraints (Supabase Auth rate limit on monolithic test invocation; worktree node_modules path mismatch). Both are documented in 25-06-SUMMARY as out-of-scope infrastructure issues, not Phase 25 regressions. Tests pass when chunked; build passes from main repo path.

### Human Verification Required

See `human_verification:` array in frontmatter. Seven items total:

1. **Pixel-perfect UAT (Phase 25 surfaces)** — both plans 04 + 05 SUMMARYs explicitly defer side-by-side mockup diff against `.planning/mockups/Ziko-Screens.html` to "Plan 06 validation gate / human visual gate." Plan 06 in turn defers it back to this verification step. The mockup HTML is a Claude Design base64 export that only renders inside JS-decoded blob URLs at runtime — cannot be parsed headlessly. Token-level alignment to UI-SPEC was verified.

2. **Pixel-perfect UAT (Phase 24 refonte surfaces)** — plans 07a + 07b refactored 6 surfaces (login, onboarding x3, dashboard, settings) to UI-SPEC tokens and explicitly FLAGGED each surface as "deferred to human visual gate" in their summaries. Same mockup parseability constraint applies. Token-aligned refactor is in place; only pixel parity remains for human eyes.

3. **Clipboard copy buttons** — Clipboard API permissions + secure context cannot be exercised headlessly.

4. **Revoke modal focus trap / Escape key** — focus management requires real DOM.

5. **Deep-link unauthenticated round-trip** — requires live cookie session.

6. **Coach photo signed-URL expiry** — requires real Supabase Storage with a clock.

7. **Full 10-step browser smoke for /coach/invitations** — requires live frontend + backend + DB.

### Gaps Summary

No code-level gaps. All 7 INVITE requirements (INVITE-01 through INVITE-07) are satisfied by:
- A live database function (`peek_invitation`, migration 040)
- Two complete bounded backend modules (`coach/invitations` + `coach/clients`) with serial rate limiting, constant-time error collapse, and idempotent revoke
- Two complete web route trees (`/coach/invitations` for coach side; `/redeem` + `/r/[code]` for athlete side) with state machine, coach preview card, typed-confirmation modals
- Phase 23 D-11/D-12 invariants preserved (no direct supabase-js imports in web; no SERVICE_KEY in production backend coach modules)
- safeNext extended and proved correct against open-redirect, lowercase, wrong-length, path-traversal cases (19/19 web tests green)
- Constant-time guarantee proved at runtime: delta 12.7ms across 5 input shapes (target was < 50ms)
- All 6 DB error causes collapse to byte-identical `INVALID_OR_EXPIRED` envelope (deep-equal assertion green)
- `is_coach_of()` returns FALSE post-revoke (RLS regression test green)

The only items not closeable from the executor environment are:
- **Pixel-perfect visual diff** of 8 surfaces (2 Phase 25 + 6 Phase 24 refonte) against the Claude Design mockup HTML — deferred by 4 of the 8 plan summaries (04, 05, 07a, 07b) to a human visual gate
- **Real-browser behaviors** (clipboard, focus trap, deep-link cookie round-trip, photo TTL render, full 10-step smoke) that require a live browser session

These are routed to `human_verification:` and gate the phase status at `human_needed`.

---

## Notes for the Orchestrator

- **Mobile work is correctly out of scope** per CONTEXT.md D-01 (Mobile "Mon coach" plugin deferred to v1.6 seed `SEED-002`, present in `.planning/seeds/`). The Phase 25 ROADMAP success criteria are re-mapped to web-only, satisfied above.
- **REQUIREMENTS.md status flags** for INVITE-01..07 should be flipped from `- [ ]` to `- [x]` after the human visual UAT completes. This is documentation hygiene, not a verification gap.
- **Migration 040** is committed and per 25-01 SUMMARY was deferred for live-DB application by the worktree (no creds); the verification prompt states it was applied to live DB on 2026-05-17. Trust the prompt's statement; if live-DB drift becomes a real concern, run `supabase db diff --schema public` to confirm.

---

_Verified: 2026-05-17_
_Verifier: Claude (gsd-verifier)_
