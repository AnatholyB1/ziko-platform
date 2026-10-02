# Phase 6: Cutover - Context

**Gathered:** 2026-10-03
**Status:** Ready for planning

<domain>
## Phase Boundary

Backend, web, and mobile all run against `portfolio` in production, flipped one surface at a time (backend → web → mobile) with a smoke test gating each, and zero regression on `rh_*`/`gecko_*`. Includes: final delta sync, bucket/table-name codemod merge, signup-flag call-sites, local + Vercel env flip, CI repoint, mobile OTA. Decommissioning ziko is Phase 7 (out of scope here).

**Key fact (user, 2026-10-03):** nobody is using prod right now. This removes the need for user notice emails, a maintenance banner, or a long freeze, and makes a hard cut of un-updated binaries acceptable.

</domain>

<decisions>
## Implementation Decisions

### Mobile tail
- **D-01:** Installed apps are moved by an **EAS Update (OTA) published on cutover day** (EXPO_PUBLIC_* are re-inlined at publish time), **plus a native store build** built/submitted in this phase so new installs carry the portfolio default. Store review timing is tracked, not blocking. Planner must verify `runtimeVersion` compatibility so the OTA reaches installed v1.4.1 binaries.
- **D-02:** **Hard cut for old binaries** that never update: they error against ziko/old names. No min-version gate, no ziko-writable window. (Ziko stays untouched and authoritative until Phase 7 per D-10.)
- **D-03:** **No re-login notice email** (Phase 3 D-12 send is dropped: no active users). The already-shipped in-app notice/banner stays inert or is left as-is; no cutover-date logic or send needed.
- **D-04:** Phase 6 **prepares and publishes the OTA** as the mobile flip, last in the order, after backend and web pass their smoke tests.

### Write-freeze & final delta
- **D-05:** **Lightweight freeze** — no maintenance banner and no API 503. Run the delta back-to-back and re-run collision/count checks immediately before writing (Phase 3 D-04) to catch any stray ziko writes.
- **D-06:** Final delta is a **single scripted runbook with one typed-phrase checkpoint** before the first write: auth re-import (Phase 3 scripts, incl. live `ziko_waitlist_founder_seq` setval) → truncate-and-reload of every `ziko_*` table (Phase 4 D-03/D-04 guards) → storage add-only copy (Phase 5 D-07, never auto-delete) → `--check all` for data and storage. PAT/keys retired on every path.
- **D-07:** Order: **delta → full verification → only then flip backend env**. No production env var changes before portfolio is verified current.

### Flip sequence & rollback
- **D-08:** **Vercel preview first.** Rebase/re-run the codemod (`scripts/portfolio-migration/11-codemod-buckets.mjs --apply` on fresh main, or rebase `gsd/phase-5-bucket-codemod`; table-name codemod included), run `--check` with its repo-wide residual pass, deploy backend + web as Vercel previews pointed at portfolio, smoke test, then **merge to main and flip production env vars together** (never merge earlier — prod code would query `ziko_*`/`ziko-*` on the ziko project).
- **D-09:** Production order **backend → web → mobile OTA**, each smoke-tested before the next flips (CUTOVER-03), never simultaneous.
- **D-10:** **Rollback = revert env vars + redeploy** (Vercel instant rollback to previous deployment); mobile = republish the previous OTA. Ziko is untouched and still the rollback target until Phase 7.
- **D-11:** **CI repoint (CUTOVER-05) after backend+web flip, before mobile OTA:** repoint `SUPABASE_PROJECT_ID` / `SUPABASE_ACCESS_TOKEN` GitHub secrets to portfolio and prove with a subsequent CI run. Planner must reconcile `supabase/migrations/` with the portfolio migration series first so `migrate-supabase` does not re-apply or conflict with the already-applied `ziko_` series or touch `rh_*`/`gecko_*`.

### Smoke test & tenant regression
- **D-12:** **Scripted backend/web, manual mobile.** Reuse the Phase 5 auth harness (`10-storage-auth-tests.mjs`, in-process backend + web live spec) for the carried backend routes and web items; mobile UI flows (avatar, profile photo, exercise media, scan photo, coach logo, video upload/view) are checked manually on a device against the OTA via a committed checklist file. Plus core flows: real login, read, write, AI chat, coach CRM read.
- **D-13:** **CUTOVER-04 proof = tenant baseline diff + test signups:** re-run the Phase 4/5 `--check tenants` baseline diff (counts, policies, triggers, buckets) before/after each flip, plus an `rh_*`/`gecko_*` test signup producing zero Ziko-side rows and a flagged Ziko signup producing profile + credits (Phase 3 D-07). Test users cleaned up.
- **D-14:** **Signup flag at every call-site:** mobile `apps/mobile/app/(auth)/register.tsx` and every web/backend signup path pass `options.data { app: 'ziko' }` as part of the flip code (Phase 3 D-05). **Google OAuth stays disabled** on both projects; no lazy-provisioning fallback (Phase 3 D-13). Planner must grep for all `signUp(` / admin `createUser` call-sites, not only `register.tsx`.

### Carried from Phase 5 (all 17 smoke items — see ROADMAP Phase 6)
- **D-15:** The 17 carried items (backend routes, mobile/plugin/web storage flows, codemod re-run) are in scope as the acceptance checklist; known `profile-photos` quirk (Phase 5 D-02: private bucket, public SELECT, no DELETE policy) is expected, not a failure.

### Claude's Discretion
- Runbook script naming/numbering (continue `scripts/portfolio-migration/NN-*`), how local env files are switched and secrets kept out of git, structure of the smoke checklist file, exact Vercel preview mechanics, whether the OTA channel/branch needs a dedicated name, handling of Vercel Production vs Preview env scopes.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Workstream
- `.planning/workstreams/supabase-portfolio-migration/ROADMAP.md` — Phase 6 goal, success criteria, 17 carried smoke items
- `.planning/workstreams/supabase-portfolio-migration/REQUIREMENTS.md` — CUTOVER-01..05
- `.planning/workstreams/supabase-portfolio-migration/STATE.md` — current position, blockers
- `.planning/workstreams/supabase-portfolio-migration/research/ARCHITECTURE.md` — env cutover ordering, rename call-site risk
- `.planning/workstreams/supabase-portfolio-migration/research/FEATURES.md` — OTA/EAS re-inlining of EXPO_PUBLIC_*, smoke-test gate, rollback window

### Prior phase decisions
- `.planning/workstreams/supabase-portfolio-migration/phases/03-auth-merge/03-CONTEXT.md` — D-04 re-check collisions, D-05 signup flag, D-09 delta re-run, D-13 OAuth off
- `.planning/workstreams/supabase-portfolio-migration/phases/03-auth-merge/03-UUID-REMAP-SPEC.md` — collision user remap
- `.planning/workstreams/supabase-portfolio-migration/phases/04-data-copy-integrity-verification/04-CONTEXT.md` — D-03 truncate-reload delta, D-04 guards
- `.planning/workstreams/supabase-portfolio-migration/phases/05-storage-migration/05-CONTEXT.md` — D-04 codemod flip, D-07 add-only delta, D-10 harness
- `.planning/workstreams/supabase-portfolio-migration/phases/05-storage-migration/05-VERIFICATION.md` — carried smoke items

### Scripts & runbook
- `scripts/portfolio-migration/RUNBOOK.md` — operational conventions, token retirement
- `scripts/portfolio-migration/05-load-data.mjs`, `06-verify-data.mjs` — data delta + verification
- `scripts/portfolio-migration/08-copy-storage.mjs`, `09-verify-storage.mjs` — storage delta + verification
- `scripts/portfolio-migration/10-storage-auth-tests.mjs` — auth smoke harness
- `scripts/portfolio-migration/11-codemod-buckets.mjs` — bucket codemod (branch `gsd/phase-5-bucket-codemod`, patches in `scripts/portfolio-migration/patches/`)
- `scripts/auth-merge/` — auth import, `uuid-remap.json`, 06-verify, config merge

### CI / config
- `.github/workflows/ci.yml` — `migrate-supabase` job (lines ~38+)
- `apps/mobile/app.json`, `apps/mobile/eas.json` — version 1.4.1, EAS config for OTA/build

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- Phase 3/4/5 scripts (auth import, `05-load-data`, `08-copy-storage`, verify suites) — compose into the delta runbook
- `10-storage-auth-tests.mjs` + backend in-process harness — backend/web smoke
- `11-codemod-buckets.mjs` — scripted bucket-name rename with `--check` residual pass

### Established Patterns
- Typed-phrase human checkpoint before first production write; PAT/keys retired on every path
- `--check <name>` / `--check all`, PII-safe JSON + masked summaries (no raw emails/IDs in git)
- Service-role key never imported from `backend/api/src/**`

### Integration Points
- Env files: `apps/mobile/.env`, `apps/web/.env.local`, `backend/api/.env.local` (+ Vercel Production/Preview for web and API projects)
- Signup call-sites: `apps/mobile/app/(auth)/register.tsx` and any web/backend signup path
- `.github/workflows/ci.yml` `migrate-supabase` + GitHub secrets
- Mobile EXPO_PUBLIC_* inlined at build/publish time

</code_context>

<specifics>
## Specific Ideas

- User: "nobody is using prod right now" — optimize for a short, safe, scripted cutover; no user-facing communications.

</specifics>

<deferred>
## Deferred Ideas

- Min-version gate for old binaries — rejected (hard cut chosen); revisit only if real users appear before Phase 7.
- OAuth lazy-provisioning fallback — out of scope while Google OAuth stays off.
- Fixing the `profile-photos` private-bucket quirk — separate follow-up, not cutover.

</deferred>

---

*Phase: 6-Cutover*
*Context gathered: 2026-10-03*

## Amendments after research (2026-10-03, user-confirmed)

- **D-01/D-04 SUPERSEDED:** OTA cannot reach installed binaries (no `runtimeVersion`/`updates.url` in app.json, no EAS channel, `expo.modules.updates.ENABLED=false` in the native manifest). **The native build is the mobile flip**: build/distribute a new binary pointing at portfolio, last in the order. Old binaries hard-cut per D-02. No expo-updates enablement in this phase.
- **D-16:** Route to main: **merge the working branch into main first** (lands Phases 1-5 scripts, bucket codemod, mobile-audit work), then a small cutover PR on top. The merge itself must not push migrations to any project: neutralize/guard the `migrate-supabase` CI job before or within that merge (it pushes unprefixed ziko DDL and repairs ~90 foreign versions into portfolio history). Portfolio's `ziko_` series lives in `supabase/portfolio-migrations/`.
- **D-17:** **Table-name codemod is in scope, built in Wave 0**: script-driven from `scripts/portfolio-migration/rename-map.generated.json` (99 tables, 33 functions), covering ~788 `.from()` sites/169 files, 19 `.rpc` names, ~33 embedded selects (rewrite with alias, e.g. `user_profiles:ziko_user_profiles!inner(...)`, to keep response keys stable), the dynamic table map in `ziko-chat.tsx`, RLS tests and `scripts/exercise-import`; avoid TanStack query-key false positives; `--check` residual pass; gated by tests + RLS suite.
- **D-18:** Test fixture `backend/api/test/rls/fixtures.ts` `createTestUser` must set `user_metadata.app='ziko'` (gated triggers).
