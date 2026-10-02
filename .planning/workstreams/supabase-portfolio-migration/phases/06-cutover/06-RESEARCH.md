# Phase 6: Cutover - Research

**Researched:** 2026-10-03
**Domain:** Production cutover of a Supabase-backed monorepo (Hono API on Vercel, Next.js on Vercel, Expo mobile) from project `ziko` to shared project `portfolio`
**Confidence:** HIGH on repo facts (all grepped/read this session), MEDIUM on Vercel/EAS platform behavior (docs), LOW on remote state that could not be read (Vercel env scopes, EAS env, GitHub secret values)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Installed apps are moved by an EAS Update (OTA) published on cutover day (EXPO_PUBLIC_* re-inlined at publish time), plus a native store build built/submitted in this phase so new installs carry the portfolio default. Store review timing is tracked, not blocking. Planner must verify `runtimeVersion` compatibility so the OTA reaches installed v1.4.1 binaries.
- **D-02:** Hard cut for old binaries that never update: they error against ziko/old names. No min-version gate, no ziko-writable window. (Ziko stays untouched and authoritative until Phase 7 per D-10.)
- **D-03:** No re-login notice email (Phase 3 D-12 send is dropped: no active users). The already-shipped in-app notice/banner stays inert or is left as-is; no cutover-date logic or send needed.
- **D-04:** Phase 6 prepares and publishes the OTA as the mobile flip, last in the order, after backend and web pass their smoke tests.
- **D-05:** Lightweight freeze - no maintenance banner and no API 503. Run the delta back-to-back and re-run collision/count checks immediately before writing (Phase 3 D-04) to catch any stray ziko writes.
- **D-06:** Final delta is a single scripted runbook with one typed-phrase checkpoint before the first write: auth re-import (Phase 3 scripts, incl. live `ziko_waitlist_founder_seq` setval) -> truncate-and-reload of every `ziko_*` table (Phase 4 D-03/D-04 guards) -> storage add-only copy (Phase 5 D-07, never auto-delete) -> `--check all` for data and storage. PAT/keys retired on every path.
- **D-07:** Order: delta -> full verification -> only then flip backend env. No production env var changes before portfolio is verified current.
- **D-08:** Vercel preview first. Rebase/re-run the codemod (`11-codemod-buckets.mjs --apply` on fresh main, or rebase `gsd/phase-5-bucket-codemod`; table-name codemod included), run `--check` with its repo-wide residual pass, deploy backend + web as Vercel previews pointed at portfolio, smoke test, then merge to main and flip production env vars together (never merge earlier - prod code would query `ziko_*`/`ziko-*` on the ziko project).
- **D-09:** Production order backend -> web -> mobile OTA, each smoke-tested before the next flips (CUTOVER-03), never simultaneous.
- **D-10:** Rollback = revert env vars + redeploy (Vercel instant rollback to previous deployment); mobile = republish the previous OTA. Ziko is untouched and still the rollback target until Phase 7.
- **D-11:** CI repoint (CUTOVER-05) after backend+web flip, before mobile OTA: repoint `SUPABASE_PROJECT_ID` / `SUPABASE_ACCESS_TOKEN` GitHub secrets to portfolio and prove with a subsequent CI run. Planner must reconcile `supabase/migrations/` with the portfolio migration series first so `migrate-supabase` does not re-apply or conflict with the already-applied `ziko_` series or touch `rh_*`/`gecko_*`.
- **D-12:** Scripted backend/web, manual mobile. Reuse the Phase 5 auth harness (`10-storage-auth-tests.mjs`, in-process backend + web live spec) for the carried backend routes and web items; mobile UI flows checked manually on a device against the OTA via a committed checklist file. Plus core flows: real login, read, write, AI chat, coach CRM read.
- **D-13:** CUTOVER-04 proof = tenant baseline diff + test signups: re-run the Phase 4/5 `--check tenants` baseline diff (counts, policies, triggers, buckets) before/after each flip, plus an `rh_*`/`gecko_*` test signup producing zero Ziko-side rows and a flagged Ziko signup producing profile + credits (Phase 3 D-07). Test users cleaned up.
- **D-14:** Signup flag at every call-site: mobile `apps/mobile/app/(auth)/register.tsx` and every web/backend signup path pass `options.data { app: 'ziko' }` as part of the flip code (Phase 3 D-05). Google OAuth stays disabled on both projects; no lazy-provisioning fallback (Phase 3 D-13). Planner must grep for all `signUp(` / admin `createUser` call-sites, not only `register.tsx`.
- **D-15:** The 17 carried items are in scope as the acceptance checklist; known `profile-photos` quirk (Phase 5 D-02) is expected, not a failure.

### Claude's Discretion
Runbook script naming/numbering (continue `scripts/portfolio-migration/NN-*`), how local env files are switched and secrets kept out of git, structure of the smoke checklist file, exact Vercel preview mechanics, whether the OTA channel/branch needs a dedicated name, handling of Vercel Production vs Preview env scopes.

### Deferred Ideas (OUT OF SCOPE)
- Min-version gate for old binaries (rejected; hard cut).
- OAuth lazy-provisioning fallback (Google OAuth stays off).
- Fixing the `profile-photos` private-bucket quirk.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| CUTOVER-01 | Local env files point to portfolio | Env var matrix (section "Env Var Matrix"); key retrieval via `getProjectApiKeys` in `scripts/auth-merge/lib.mjs` (needs PAT); runs only after table codemod (otherwise local app breaks) |
| CUTOVER-02 | Vercel env vars on web + API projects | Env matrix; Preview branch-scoped vars; env changes only affect new deployments [CITED: vercel.com/docs/environment-variables] |
| CUTOVER-03 | Ordered backend -> web -> mobile, smoke-gated | Flip sequence + smoke harness reuse; mobile OTA finding (BLOCKER A1) |
| CUTOVER-04 | Zero regression on rh_*/gecko_* | `06-verify-data --check tenants`, `09-verify-storage --check tenants`, baselines in `scripts/portfolio-migration/baseline/`; new signup-isolation script needed |
| CUTOVER-05 | CI `migrate-supabase` + secrets repointed | CI hazard analysis (section "CI Repoint"): the job as written is unsafe against portfolio |
</phase_requirements>

## Summary

The phase is much bigger than CONTEXT.md assumes in two places, and one locked decision is not achievable as written.

**(1) There is no table-name codemod and it is the largest work item.** `scripts/portfolio-migration/11-codemod-buckets.mjs` only renames storage buckets. App code everywhere still queries unprefixed table names: about 788 `.from('<name>')` call sites in 169 files (bucket `.storage.from()` included), 19 distinct `.rpc('<fn>')` names (all 33 functions were renamed to `ziko_*` in `rename-map.generated.json`), ~33 PostgREST embedded selects (`user_profiles!inner(...)`, `exercises(...)`) and 18 `!inner`/`_fkey` hints, one dynamic table map (`apps/mobile/app/(auth)/onboarding/ziko-chat.tsx` `mapping.table`), one realtime subscription (`notification_log`), plus RLS test suites, `scripts/exercise-import`, and `scripts/purge-test-accounts`. `rename-map.generated.json` already gives the authoritative 99 table / 33 function map (all prefix-only, zero irregular names). The codemod must be written (recommend `12-codemod-tables.mjs`, same `--scan/--apply/--check` contract as script 11, fail-closed, map-driven, with a repo-wide residual `--check`). Embeds must be rewritten with an alias to preserve the JSON key shape, for example `user_profiles:ziko_user_profiles!inner(name)`, otherwise every consumer reading `row.user_profiles` silently breaks.

**(2) EAS Update cannot reach installed v1.4.1 binaries (D-01 BLOCKER).** `apps/mobile/app.json` has no `updates` block, no `runtimeVersion`, no `updates.url`. The committed `apps/mobile/android/app/src/main/AndroidManifest.xml` contains `expo.modules.updates.ENABLED = false` and no runtime-version meta-data. `eas.json` has no `channel` on any profile. Per Expo docs a build needs `runtimeVersion` + `updates.url` + channel to receive updates [CITED: docs.expo.dev/eas-update/getting-started]. The `expo-updates` package is installed (`~29.0.17`) but disabled at the native layer, so any binary built from this config ignores OTAs. The only way to move mobile is a new native build (store/internal) with portfolio env baked in. Because nobody uses prod (D-02), the practical plan is: the native build is the mobile flip; enabling expo-updates (runtimeVersion policy + url + channel) in that same build is optional future-proofing. The user must confirm this reframing (see Open Questions Q1).

**Other load-bearing findings:** the `migrate-supabase` CI job would push unprefixed ziko migrations into the shared portfolio project if pointed at it as written, and would also fire (against ziko) when the huge cutover merge lands; `backend/api/test/rls/fixtures.ts` `createTestUser` omits the `app:'ziko'` flag so trigger-created profile/credit rows will no longer exist; the only product `signUp(` call-site is `register.tsx` (web has none; Google OAuth button in `welcome.tsx` is `signInWithOAuth` and stays disabled).

**Primary recommendation:** Plan in this order: (a) build + test `12-codemod-tables.mjs` and a merged codemod PR branch (bucket patch + table codemod + signup flag + CI neutralization), (b) delta runbook script wrapping existing scripts, (c) preview deploy + scripted smoke, (d) production flip backend -> web, (e) CI repoint, (f) native build/store submission as the mobile flip with a manual checklist.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Table/RPC/embed name usage | Mobile client + Web (SSR + client) + API | DB | Mobile queries Supabase directly via supabase-js; web server components and API too; all must carry `ziko_` names |
| Signup flag `options.data.app` | Mobile client (`register.tsx`) | DB trigger (gate) | Only the client call-site can set `raw_user_meta_data`; the gated trigger functions enforce it |
| Auth token validation | API (`authMiddleware` `adminClient.auth.getUser`) | DB (portfolio GoTrue) | Validated server-side against the target project; tokens from ziko are invalid on portfolio (re-login) |
| Env switch (URL/keys) | Vercel (web+API), EAS/native build (mobile), local .env files | GitHub secrets (CI) | EXPO_PUBLIC_* are inlined at build time; Vercel changes apply to new deployments only |
| Storage buckets/policies | Storage (portfolio) | API/web signing routes | Already migrated (Phase 5); code names via STORAGE_BUCKETS constants |
| Tenant isolation proof | DB (script) | CI | Baseline snapshot diff scripts |
| Migration pipeline | CI (GitHub Actions) | Supabase CLI | Must not push unprefixed DDL to portfolio |

## Standard Stack

No new packages are required. Reuse existing tools. [VERIFIED: repo grep/read]

### Core
| Tool | Version | Purpose | Why |
|------|---------|---------|-----|
| Node ESM scripts in `scripts/portfolio-migration/` | node v26.4.0 local, Node 20 CI | Delta runbook, codemod, verification | Established Phase 3-5 pattern (`parseCliArgs`, `assertWriteAllowed`, `--confirm-ref`, PII-safe reports) |
| `scripts/auth-merge/lib.mjs` | n/a | `PROJECTS` refs, `assertWriteAllowed`, `getProjectApiKeys`, `runSql`, `redactPii` | Reuse for every new script; ziko is hard-refused as a write target |
| Supabase CLI | 2.116.0 (installed) | `db query --linked`, `projects api-keys`, link | Used by all verify scripts |
| Vercel CLI | 59.24.0 (installed) | `vercel env ls/add --git-branch`, `vercel rollback`, previews | Preview-scoped, branch-scoped env vars |
| gh CLI | 2.89.0 (installed) | `gh secret set/list` for CI repoint | Secret names exist: `SUPABASE_PROJECT_ID`, `SUPABASE_ACCESS_TOKEN`, `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `EXPO_TOKEN`, `VERCEL_*` |
| Vitest 3 | existing | Codemod unit tests (`*.test.mjs` run by `node --test`, per prior phases) | Phase 3-5 convention: `node --test` glob form on Node 26 |
| EAS CLI | NOT installed locally (`eas --version` returned nothing) | Native build, env vars, optional update | Use `npx eas-cli` or run builds through `release.yml` (`expo/expo-github-action@v8`, `EXPO_TOKEN` secret exists) |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Custom `12-codemod-tables.mjs` | `ts-morph`/jscodeshift AST | AST is safer for embeds but adds a dependency; the regex+fail-closed pattern in script 11 already works and the table name set is closed (99 names, all `ziko_`-prefixable). Recommend extending script 11's approach, with `--check` residual pass as the safety net |
| Aliased embeds `user_profiles:ziko_user_profiles(...)` | Rename key and update every consumer | Aliasing preserves response shape and keeps the diff mechanical |

**Package Legitimacy Audit:** No new external packages are recommended. slopcheck not run (no installs). Disposition: none to audit.

## Architecture Patterns

### System Architecture Diagram

```
 ziko (slkobhav..., authoritative until Ph7)            portfolio (ubxllsv...; rh_*/gecko_* tenants)
        |  read-only                                           ^
        v                                                      | writes (typed-phrase + --confirm-ref)
 [1 collision check] -> [2 auth delta] -> [3 loader truncate+reload] -> [4 storage add-only copy]
        \_______________ single runbook script, ONE checkpoint _________________/
                                   |
                       [5 --check all (data) + --check all (storage) + --check tenants vs baseline]
                                   |  PASS only
                                   v
   cutover branch = main + bucket codemod + TABLE codemod + signup flag + CI neutralization
                                   |
              [6 Vercel PREVIEW (branch-scoped env -> portfolio): API + web]
                                   |  scripted smoke (10-storage-auth harness, core flows, signup isolation)
                                   v
   [7 merge to main] + [8 prod env flip: API first] -> smoke -> [9 web env flip] -> smoke
                                   |
   [10 gh secret set SUPABASE_PROJECT_ID/ACCESS_TOKEN] -> CI run proves link (no schema push)
                                   |
   [11 native mobile build with portfolio EXPO_PUBLIC_* (EAS env), submit] -> manual device checklist
                                   |
   [12 tenants diff again; token/PAT retirement]    Rollback at 8/9: env revert + `vercel rollback`
```

### Recommended Project Structure
```
scripts/portfolio-migration/
  12-codemod-tables.mjs (+ .test.mjs)   # map-driven table/rpc/embed/realtime rename, --scan/--apply/--check
  13-cutover-delta.mjs (+ .test.mjs)    # orchestrates existing scripts, ONE typed-phrase gate
  14-signup-isolation.mjs               # rh/gecko-style signup => zero ziko_ rows; app:'ziko' => profile+credits
  15-smoke-core-flows.mjs               # login/read/write/AI chat/coach CRM read against a base URL
  06-CUTOVER-SMOKE-CHECKLIST.md (phase dir)  # manual mobile checklist (17 carried items)
.planning/.../phases/06-cutover/        # plans, checklist, evidence reports (PII-free)
```

### Pattern 1: Aliased embed rewrite
**What:** PostgREST embeds resolve by table name. Rewrite `select('*, exercises(name)')` to `select('*, exercises:ziko_exercises(name)')` and `workout_sessions!inner(started_at)` to `workout_sessions:ziko_workout_sessions!inner(started_at)`; the alias keeps `row.exercises` working. Filters that reference an embed (`.eq('workout_sessions.user_id', ...)`, `.order('x', { foreignTable })`, `.or('...')`) use the alias or table name per PostgREST rules and must be covered by smoke tests, not just regex.
**When:** every embed in the 33 flagged selects (grep `\.select\(` containing `name(`), plus `!inner`/`_fkey` hints (18 hits). `_fkey` constraint names are NOT renamed by `ALTER TABLE ... RENAME` automatically and Phase 2 created them fresh, so verify hint names against live `pg_constraint` on portfolio before rewriting.
[ASSUMED: PostgREST alias behavior `alias:table(...)`; standard documented PostgREST/supabase-js feature, verify in a preview smoke.]

### Pattern 2: Fail-closed codemod with residual check
Mirror `11-codemod-buckets.mjs`: scan roots `apps/mobile/app`, `apps/mobile/src`, `apps/web/src`, `backend/api/src`, `backend/api/test`, `plugins/*/src`, `packages/*/src`, `scripts/exercise-import`; skip `.storage.from(` contexts (bucket calls); any quoted token equal to a map key in an unrecognized context fails closed; `--check` is repo-wide residual with an explicit false-positive allowlist (e.g. query keys such as `['habits', userId]` are NOT table refs and must not be rewritten; this is the main false-positive class, since TanStack query keys reuse table names). RPC rename: `.rpc('deduct_ai_credits'` -> `.rpc('ziko_deduct_ai_credits'` driven by `functions` map (map keys include the signature; strip to name).

### Pattern 3: Single-checkpoint delta runbook
Compose in order (all exist): `01-collision-check` (new collision = stop), `02-import-auth --delta-report` then `--apply [--apply-password-updates]`, `04-sync-waitlist-seq`, `05-load-data --plan/--probe/--apply --remap-file scripts/auth-merge/uuid-remap.json` (remap must include delta users: pass the delta remap, see Pitfall 6), `08-copy-storage --plan/--apply` (add-only), `06-verify-data --check all --baseline`, `09-verify-storage --check all --baseline`. Typed phrase: `approve ubxllsvanurkwkohzxau option-cutover-delta` (follow the Phase 4/5 convention of grepping the recorded phrase mechanically). Needs PAT (`ziko-cutover-phase6`) in gitignored `scripts/auth-merge/.access-token` (absent now) and CA at `scripts/portfolio-migration/.ca/supabase-ca.crt` (present). Retire both on every path.

### Anti-Patterns to Avoid
- **Merging the cutover branch before the prod env flip** (D-08): prod code would query `ziko_*` on ziko.
- **Renaming query keys / local variables** that equal table names in the table codemod.
- **Using `supabase db push` against portfolio** from `supabase/migrations/`.
- **Running `eas update` expecting installed apps to move** (see A1).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Auth delta | New import SQL | `scripts/auth-merge/02-import-auth.mjs` + `04-sync-waitlist-seq` + `06-verify` | Collision remap, GoTrue token columns, password-hash refresh already solved |
| Data reload | Custom COPY | `05-load-data.mjs` (guarded truncate, replica COPY, setval, URL rewrite) | Phase 4 D-03/D-04 guards |
| Storage delta | Custom sync | `08-copy-storage.mjs` (add-only, SHA-256) | Never auto-delete |
| Tenant regression | Ad-hoc counts | `06-verify-data --check tenants --baseline`, `09-verify-storage --check tenants --baseline`, `scripts/portfolio-migration/baseline/*.json` | Existing PII-safe snapshots |
| Backend/web route smoke | New harness | `10-storage-auth-tests.mjs --mode smoke --confirm-ref` + `10-storage-auth-backend.ts` (in-process Hono, 6 `deferred-table-codemod` items become real after the table codemod) + `apps/web/src/app/api/__live__/storage-routes.live.test.ts` | Real user JWTs, guaranteed cleanup. NOTE: remove the `--with-codemod-patch` dependency and the DEFERRED list once the codemods are merged |
| Signup users | Raw SQL inserts | Admin `createUser` with `user_metadata: { app: 'ziko', full_name }` (pattern at `10-storage-auth-tests.mjs:389`) | Exercises the real trigger gate |
| Rollback of web/API | Manual redeploy | Vercel "instant rollback" / `vercel rollback` to previous deployment [CITED: vercel.com docs] | D-10; but see Pitfall 9 (env snapshot) |

## Runtime State Inventory

(Rename-adjacent phase: table/function renames in client code, env flip.)

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | Portfolio `ziko_*` tables already loaded (Phase 4); 3 rows with ziko storage URLs rewritten in flight (Phase 5). Nothing else keyed by old table names | Delta reload only. Code edit (codemod), no new data migration |
| Live service config | Vercel projects (web `ziko-web`, API) env vars live only in Vercel UI; EAS project env vars (if used for cloud builds) live in EAS; GitHub Actions secrets. Supabase portfolio auth redirect allow-list already merged (Phase 3). DB webhook triggers `push_user_xp_level_up`/`push_workout_session_end` call `https://api.ziko-app.com/push-events/supabase`; real X-Webhook-Secret substituted live on portfolio (02-VERIFICATION.md) [VERIFIED] | Change env in Vercel/EAS/GitHub (not in git); smoke the push webhook once (secret must equal API `WEBHOOK_SECRET`) |
| OS-registered state | Vercel crons in `backend/api/vercel.json` (10 jobs) are code-defined and follow the deployment; they run on the production deployment only | After API prod flip, spot-check one cron route (authorized) against portfolio |
| Secrets/env vars | Names differ per surface (see matrix). Backend uses `SUPABASE_SERVICE_KEY` (fallback silently to publishable key if unset); web uses `SUPABASE_SERVICE_ROLE_KEY`; CI uses `SUPABASE_SERVICE_ROLE_KEY` | Set all of them; add a startup/self-check that `SUPABASE_SERVICE_KEY` is present |
| Build artifacts | `packages/coach-sdk/dist` and `packages/email/dist` are modified/tracked (git status); mobile bundle inlines EXPO_PUBLIC_*; Next.js inlines NEXT_PUBLIC_* at build | Rebuild/redeploy after env change; never rely on runtime env for client-inlined vars |

## Env Var Matrix (what changes)

| Surface | Var | Changes? | Notes |
|---------|-----|----------|-------|
| Mobile | `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_KEY` (publishable) | YES -> portfolio URL/publishable key | `apps/mobile/.env` is gitignored (last modified Aug 22); EAS cloud builds do NOT read it, so values must be in EAS environment variables for the production profile (`eas.json` production has no `env` for them) [CITED: docs.expo.dev/eas/environment-variables]; verify with `eas env:list` |
| Mobile | `EXPO_PUBLIC_API_URL` | No (API URL unchanged) | `ziko-api-lilac.vercel.app` / `api.ziko-app.com` |
| Mobile | `EXPO_PUBLIC_ZIKO_RELOGIN_CUTOVER_DATE` | Leave unset | Banner inert (D-03). Note `apps/web` has `NEXT_PUBLIC_ZIKO_RELOGIN_CUTOVER_DATE` too; leave unset |
| Web | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` (publishable value) | YES | Inlined at build -> redeploy required |
| Web | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | YES | server-only, GDPR delete + waitlist RPC |
| API | `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_KEY` | YES | `middleware/auth.ts` uses service key to call `auth.getUser(token)` |
| API | `WEBHOOK_SECRET` | No, but must match the secret substituted into portfolio triggers | smoke it |
| API/web | Anthropic/OpenAI/Resend/Upstash | No | |
| CI | GitHub secrets `SUPABASE_PROJECT_ID`, `SUPABASE_ACCESS_TOKEN` | YES (D-11) | `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY` are used by the `verify` job's `turbo run test`; `test-rls.yml` uses separate `SUPABASE_TEST_*` secrets (not present in `gh secret list`, so that suite is skipped with a warning) |

Retrieval: `getProjectApiKeys('ubxllsvanurkwkohzxau')` in `scripts/auth-merge/lib.mjs` shells `supabase projects api-keys -o json` (needs login/PAT). Never print or commit keys. Portfolio is shared: its service key reaches rh_*/gecko_* data; the API/web service-key blast radius grows (accepted risk, document it).

## CI Repoint (CUTOVER-05) - the job is unsafe as written

Facts [VERIFIED: ci.yml, git]:
- `migrate-supabase` triggers on every push to `main` where `git diff HEAD~1 HEAD` touches `supabase/migrations/`; it then `supabase link`s to `SUPABASE_PROJECT_ID`, runs `migration repair --status applied` for every local file except those in the last commit's diff, then `supabase db push --include-all`.
- `supabase/migrations/` holds the unprefixed ziko history (90 files). The applied-to-portfolio `ziko_` series is in `supabase/portfolio-migrations/` (5 files) and was applied manually with `db query`, never `db push`; portfolio's `schema_migrations` therefore has no ziko history and does hold rh_/gecko_ history.
- `main` is 363 commits behind the working line and `supabase/migrations` differs by 46 files (mostly renames to timestamp versions plus 12 new post-0819 migrations). A merge commit's `HEAD~1..HEAD` diff covers the whole branch, so the cutover merge itself will make `changed=true` and push all those files at whatever project the secrets point to.

Consequences:
1. If secrets still point to ziko when the cutover PR merges (D-08 precedes D-11), the job tries to apply/repair ~46 renamed/new files against ziko: expect a red job or duplicate-object errors; a failed job also blocks nothing else but is noisy and could partially apply.
2. If secrets point to portfolio, any `supabase/migrations/` change pushes **unprefixed** DDL (`CREATE TABLE habits ...`) into the shared tenant project, and `repair` would write ~90 foreign versions into portfolio's migration history. `db push` also refuses when remote has versions not present locally (rh_/gecko_ history).

Recommendation (prescriptive): the cutover PR itself edits `ci.yml` so `migrate-supabase` can no longer `db push` from `supabase/migrations/` (guard with `if: false`/or restrict to a path filter on `supabase/portfolio-migrations/` and apply via `supabase db query --linked -f` for idempotent `ziko_` files, matching how Phases 2-5 applied them). Add a CI grep guard failing PRs that add unprefixed `CREATE TABLE` to `supabase/migrations/`. Repoint `SUPABASE_PROJECT_ID`/`SUPABASE_ACCESS_TOKEN` (a PAT with portfolio access; `gh secret set`), and prove the link with a read-only step (`supabase link` + `supabase migration list` or `db push --dry-run`) because with `changed=false` the job never links, so a plain "CI run succeeded" proves nothing. Also repoint or consciously leave `SUPABASE_URL/PUBLISHABLE_KEY/SERVICE_ROLE_KEY` secrets (their current target is not readable; see Q4). `test-rls.yml` (`backend/api` `test:rls`) needs `ziko_` names via the table codemod; without `SUPABASE_TEST_*` secrets it silently skips.

## Signup Call-Sites (D-14) [VERIFIED: grep]

| Path | Kind | Action |
|------|------|--------|
| `apps/mobile/app/(auth)/register.tsx:37` | `supabase.auth.signUp({ email, password, options: { data: { full_name: name } } })` | Add `app: 'ziko'` -> `data: { app: 'ziko', full_name: name }`. The ONLY product signUp |
| `apps/mobile/app/(auth)/welcome.tsx:13` | `signInWithOAuth({ provider: 'google' })` | Cannot carry metadata; Google OAuth stays disabled (D-13). Button remains and will error; Apple button is a "bientot" alert. Consider leaving as is |
| Web (`apps/web/src`) | none (`signUp`/`createUser` absent; only `admin.listUsers`/`deleteUser` in `actions/account.ts`, `admin.rpc('claim_waitlist_signup')` in `actions/waitlist.ts`, which is a waitlist RPC not an auth signup) | No change; the RPC is renamed to `ziko_claim_waitlist_signup` by the table/rpc codemod |
| Backend `src/**` | none | No change |
| `backend/api/test/rls/fixtures.ts` `createTestUser` | admin `createUser` without `user_metadata` | Must add `user_metadata: { app: 'ziko' }`; otherwise trigger gate no-ops and tests expecting `ziko_user_profiles`/credits rows fail |
| `scripts/portfolio-migration/04-rls-smoke-test.js` | admin createUser | review; 10-storage-auth-tests already sends the flag |

## EAS / OTA Feasibility (D-01) [VERIFIED in repo; platform behavior CITED]

- `apps/mobile/app.json`: version 1.4.1, `extra.eas.projectId` present, **no** `runtimeVersion`, **no** `updates`; `owner: anatholyb`. Root `app.json` is `{"expo":{}}` (stub, ignore).
- `apps/mobile/android/` is tracked in git (bare native project); its manifest sets `expo.modules.updates.ENABLED=false`; no `EXPO_RUNTIME_VERSION`/`EXPO_UPDATES_URL`. There is no tracked `ios/` (iOS generated by prebuild from app.json, hence also no updates URL).
- `apps/mobile/eas.json`: profiles development/preview/internal/production; no `channel`; `appVersionSource: remote`; `autoIncrement` on production/internal. Builds run in CI via `.github/workflows/release.yml` on tags `v*` (production, all platforms + Android submit) and `beta*`.
- `expo-updates ~29.0.17` is a dependency and `notifications.tsx` uses `Updates.useUpdates()/reloadAsync()` but the native layer is disabled.
- Expo docs: receiving updates requires `runtimeVersion`, `updates.url`, channel [CITED: docs.expo.dev/eas-update/getting-started]. EXPO_PUBLIC_* are inlined at build/publish time [CITED: research/FEATURES.md citing docs.expo.dev environment-variables].

Conclusion: no already-installed v1.4.1 binary can receive an OTA. D-01's "OTA reaches installed v1.4.1" fails; D-04 ("publish the OTA as the mobile flip") is unachievable. Practical path given D-02/no active users: ship a new native build (version bump, production profile, EAS env vars set to portfolio) via tag `vX` -> store; installs on the old binary hard-fail (accepted). In that same build, add `runtimeVersion: { policy: 'appVersion' }`, `updates.url`, `updates.enabled`, and an EAS channel so future cutover-style env changes can ship OTA (this requires also changing the committed `android/` manifest or regenerating it, because the bare android dir overrides app.json for native config; `npx expo prebuild` or manual meta-data edit; risky, call out as optional). Confirming what the Play-installed binary actually contains: `eas build:list`/Play Console (not available here).

Store timing risk: Play review + Apple review are tracked, not blocking. The manual device checklist runs against an internal-track/preview build (profile `preview` APK or `internal` AAB) pointed at portfolio, which does NOT need store review.

## Vercel Setup [CITED: vercel.com/docs/environment-variables; repo]

- Web project `ziko-web` (README/`.env.example`: "set in Vercel Project ziko-web Production + Preview scopes"); `apps/web/vercel.json` builds via turbo, `ignoreCommand` skips deploys when nothing in `apps/web` changed. API project in `backend/api` (`vercel.json` rewrites to `/api/app`, 10 crons). GitHub secrets `VERCEL_PROJECT_ID`, `VERCEL_WEB_PROJECT_ID`, `VERCEL_ORG_ID`, `VERCEL_TOKEN` exist. No local `.vercel/` link in repo (could not read remote env; read-only here).
- Env changes apply only to NEW deployments; Preview vars apply to any non-production branch and can be **branch-specific** (override same-name vars) [CITED]. Use branch-scoped Preview vars on the cutover branch pointing to portfolio, so no other preview or production is affected.
- Portfolio is a Vercel-Marketplace-managed Supabase integration (RUNBOOK section 1). Integration-managed vars can re-inject values into connected projects; check the web/API projects are not linked to the portfolio integration with auto-sync that would overwrite or conflict (LOW confidence; verify in dashboard).
- Redeploy needed after each env change; `NEXT_PUBLIC_*` rebuild required for web.
- Preview auth redirects: password login does not need allow-list; any magic-link/redirect flow on the preview domain would need the preview URL in portfolio's `uri_allow_list` (merged in Phase 3 additively).

## Common Pitfalls

### Pitfall 1: Query keys mistaken for table names
**What goes wrong:** codemod rewrites `queryKey: ['habits', userId]` or UI strings. **Avoid:** only rewrite inside recognized Supabase contexts (`.from(`, `.rpc(`, select embeds, realtime `table:`, the `mapping.table` literal union); anything else matching a table name fails closed to a reviewed allowlist.

### Pitfall 2: Embed key shape changes
Unaliased `exercises(...)` -> `ziko_exercises(...)` changes the returned property to `ziko_exercises`. Use alias form. Same for typed generics/interfaces.

### Pitfall 3: Dynamic table name
`apps/mobile/app/(auth)/onboarding/ziko-chat.tsx:126-141,250` builds `.from(mapping.table)` from a literal union (`hydration_logs|journal_entries|body_measurements`); needs a manual map edit; regex misses it by design. `--check` must flag any string literal equal to a table name regardless of context.

### Pitfall 4: Storage `.from()` vs table `.from()`
Bucket calls are `.storage.from('bucket')`; the table codemod must skip them (bucket codemod runs first and rewrites them to `STORAGE_BUCKETS.*`). Run order: bucket patch/codemod, then table codemod, then `--check` for both.

### Pitfall 5: Stale bucket patch / branch divergence
`gsd/phase-5-bucket-codemod` is 1 commit ahead of its base and 19 behind HEAD; `git apply --check` of `patches/05-bucket-codemod.patch` currently passes on HEAD and the bucket `11-codemod --check` currently reports residuals (expected, unapplied). Per RUNBOOK 5.6a re-run `git apply --check` right before use; if it fails, regenerate with the script, never hand-merge. Also note `main` lacks all workstream work (Phases 1-5 scripts + 363 commits): "merge to main" means merging the whole `fix/mobile-audit-2026-08-22` lineage (plus `dev`/PR conventions in git log); decide the integration route (Q2).

### Pitfall 6: Delta users and the UUID remap
`05-load-data` needs `--remap-file`; the committed `scripts/auth-merge/uuid-remap.json` covers the first import. The auth delta writes a separate `uuid-remap.delta.json` (OS temp dir per RUNBOOK 4). Only the collision user is remapped, so new signups map to themselves; confirm the loader accepts an unchanged remap when new users exist and that FK orphan checks pass. If a new collision appears, STOP (Phase 3 D-04).

### Pitfall 7: CI job on merge (see CI section)
Cutover merge triggers `migrate-supabase` against whichever project secrets point to.

### Pitfall 8: Env var name drift / silent fallback
Backend falls back to the publishable key if `SUPABASE_SERVICE_KEY` is unset (`auth.ts`); a missed var degrades admin operations silently. Web `SUPABASE_SERVICE_ROLE_KEY` vs backend `SUPABASE_SERVICE_KEY` vs CI naming differ. Checklist per variable and a post-deploy `/health` + admin-path smoke.

### Pitfall 9: Rollback is not just "redeploy"
Vercel instant rollback restores the old *deployment* but env changes are only picked up by new builds; a rolled-back deployment built with portfolio-inlined `NEXT_PUBLIC_*` would still hit portfolio. Rollback = revert env vars AND redeploy (or roll back to a deployment built before the flip). Also after rollback, ziko has no portfolio-era writes (data written to portfolio after flip is lost for rollback purposes): rollback window must be short and any new data accepted as lost.

### Pitfall 10: JWT/session invalidation
Tokens from ziko are invalid on portfolio; all users must log in again (AUTHMIG-05; notice dropped by D-03). Mobile persisted sessions in MMKV/SecureStore will fail until re-login; the new binary must handle `getUser` 401 gracefully (verify manually).

### Pitfall 11: Realtime and webhooks
Ziko had 0 realtime publication members; mobile subscribes to `notification_log` so it was already inert; do not add publication unless wanted. Portfolio has 3 realtime tables from other tenants; leave alone. The two `ziko_` push triggers call `https://api.ziko-app.com/push-events/supabase` with a secret.

### Pitfall 12: Tests and scripts still on old names
`backend/api/test/**`, `apps/web/test/**`, `scripts/exercise-import/**` (supabase-client.ts, merge-row.ts), `scripts/purge-test-accounts/**` reference unprefixed tables/buckets. Decide in scope: tests/exercise-import yes (map-driven); purge/waitlist-erasure/founder-offer scripts: they operate on ziko by project ref and RUNBOOKs; flag as follow-up unless they are meant to run against portfolio after Phase 6.

## Code Examples

### Signup flag (D-14)
```tsx
// apps/mobile/app/(auth)/register.tsx
const { error } = await supabase.auth.signUp({
  email,
  password,
  options: { data: { app: 'ziko', full_name: name } },
});
```
Gate: `20261002090000_portfolio_ziko_auth_gate_functions.sql` returns early unless `raw_user_meta_data->>'app' = 'ziko'` [VERIFIED].

### Embed alias
```ts
// before
.select('*, workout_sessions!inner(started_at, user_id)')
// after (response key stays workout_sessions)
.select('*, workout_sessions:ziko_workout_sessions!inner(started_at, user_id)')
```

### RPC/table rename source of truth
`scripts/portfolio-migration/rename-map.generated.json`: `tables` (99, all `ziko_<name>`), `functions` (33, keys include signature, e.g. `deduct_ai_credits(p_user_id uuid, ...)` -> `ziko_deduct_ai_credits(...)`). Non-ziko-prefixed exceptions: none. Extension functions (unaccent) excluded.

## State of the Art

| Old | Current | Impact |
|-----|---------|--------|
| Research FEATURES.md: "EAS Update re-inlines env, OTA flips installed apps" | True only if the binary has expo-updates enabled with runtimeVersion/url/channel | This repo's binaries do not; native rebuild is the flip |
| REQUIREMENTS.md out-of-scope: "EAS Update OTA to force mobile cutover" | Contradicts CONTEXT D-01/D-04 | CONTEXT governs; moot given A1. Update REQUIREMENTS/DECOM-01 wording in Phase 6 docs |

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Production binaries were built from the tracked bare `android/` + app.json shown here (updates disabled) | EAS | If an earlier build had updates enabled, OTA could work; check `eas build:list`/store binary |
| A2 | PostgREST `alias:table(...)` preserves response key and works with `!inner` on renamed tables | Patterns | Embeds break; mitigated by preview smoke |
| A3 | FK constraint names used in `_fkey` hints exist unchanged on portfolio | Pitfall 2 | Verify via `pg_constraint` on portfolio |
| A4 | Vercel API project is separate from `ziko-web`, both Production+Preview env scopes exist | Vercel | Plan step must `vercel env ls` first |
| A5 | EAS cloud builds take EXPO_PUBLIC_* from EAS env, not local `.env` | Env matrix | Wrong key baked into native build |
| A6 | `SUPABASE_URL` etc. GitHub secrets point to ziko or a test project | CI | `verify` job live tests may hit wrong project |
| A7 | Integration auto-sync on Vercel will not overwrite manual env changes | Vercel | Env reverts silently |

## Open Questions

1. **D-01 OTA is not feasible for installed binaries. Re-decide?**
   - Known: updates disabled natively, no runtimeVersion/url/channel. Unknown: what the store binary actually is.
   - Recommendation: treat the native build as the mobile flip (D-02 already accepts hard cut); optionally enable expo-updates in that build. Ask user to confirm before planning mobile tasks.
2. **Integration route to main.** `main` is 363 commits behind the working branch; cutover PR carries Phases 1-5 artifacts and prior app work. Recommend: single PR from the cutover branch, squash vs merge decided with CI hazard in mind (neutralize migrate job in the same PR). Need user preference.
3. **Is the table codemod in scope as planned work?** It is implied by D-08 ("table-name codemod included") but nothing exists. Recommend Plan 1.
4. **Which project do `SUPABASE_URL`/`SUPABASE_PUBLISHABLE_KEY`/`SUPABASE_SERVICE_ROLE_KEY` GitHub secrets target?** Unreadable; decide repoint vs remove live tests from `verify`.
5. **Do `scripts/purge-test-accounts`, `waitlist-erasure`, `founder-offer-go-live` need to run against portfolio after cutover?** Out of scope unless user says otherwise.
6. **Late-night preview**: Does the preview API need the mobile app? No, API+web preview only; mobile preview build is for the manual checklist.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node | scripts | yes | v26.4.0 (CI Node 20) | - |
| npm | install | yes | 11.17.0 (repo pins 10.9) | - |
| Supabase CLI | verify scripts, key retrieval | yes | 2.116.0 | - |
| Vercel CLI | env/preview/rollback | yes | 59.24.0 | dashboard |
| gh CLI | secrets | yes (authenticated: `gh secret list` works) | 2.89.0 | dashboard |
| EAS CLI | native build/env | NO | - | `npx eas-cli`, or tag-triggered `release.yml` with `EXPO_TOKEN` |
| Supabase PAT (`scripts/auth-merge/.access-token`) | loader probe/apply, api-keys | NO (retired) | - | user mints `ziko-cutover-phase6` (checkpoint) |
| Supabase CA `scripts/portfolio-migration/.ca/supabase-ca.crt` | loader TLS | yes | - | - |
| Physical device / simulator | manual mobile checklist | unknown | - | human checkpoint |

Blocking without fallback: PAT (needs user action at a checkpoint).

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | `node --test` for `scripts/portfolio-migration/*.test.mjs`; Vitest v3 for backend (`backend/api`) and web (`apps/web`) |
| Config | `backend/api/vitest.config.ts`, `backend/api/vitest.unit.config.ts`, `apps/web/vitest.config.ts` |
| Quick run | `node --test scripts/portfolio-migration/12-codemod-tables.test.mjs` ; `npx turbo run type-check` |
| Full suite | `npx turbo run type-check lint test` + `node scripts/portfolio-migration/12-codemod-tables.mjs --check` + `node scripts/portfolio-migration/11-codemod-buckets.mjs --check` |

### Phase Requirements -> Test Map
| Req | Behavior | Type | Command | Exists? |
|-----|----------|------|---------|---------|
| CUTOVER-01 | local apps run vs portfolio; no residual old names | integration/static | `12-codemod-tables.mjs --check`, `11-codemod-buckets.mjs --check`, `npm run type-check`, local `npm run backend` + `/health` + authenticated read | Wave 0: script 12 missing |
| CUTOVER-02 | prod/preview env correct | smoke | `vercel env ls` (names only, no values), post-deploy smoke script | Wave 0: script 15 |
| CUTOVER-03 | ordered flip + per-surface smoke | scripted + manual | `10-storage-auth-tests.mjs --mode smoke --confirm-ref ubxllsvanurkwkohzxau`, `15-smoke-core-flows`, device checklist | partial |
| CUTOVER-04 | rh_/gecko_ unchanged; signup isolation | scripted | `06-verify-data --check tenants --baseline baseline/portfolio-tenants-preload.json`; `09-verify-storage --check tenants --baseline baseline/portfolio-storage-tenants-preload.json`; `14-signup-isolation.mjs` | baseline files exist; 14 missing |
| CUTOVER-05 | CI linked to portfolio, no unprefixed push | CI | workflow run with read-only link step (`supabase migration list`); grep guard job | Wave 0 |
| Carried 17 | storage/route flows | harness + manual | harness DEFERRED list becomes live after table codemod; mobile items via committed checklist | harness exists |

### Sampling Rate
- Per task commit: codemod unit tests + `npm run type-check` for touched workspaces.
- Per wave merge: full turbo suite + both `--check` residual passes.
- Phase gate: delta `--check all` green, tenants diff zero, all smoke green before each flip step; verify-work after mobile checklist signed.

### Wave 0 Gaps
- [ ] `12-codemod-tables.mjs` + test (fixtures: plain `.from`, embed alias, `!inner`, `.rpc`, query-key false positive, `mapping.table`, `.storage.from` skip)
- [ ] `13-cutover-delta.mjs` orchestrator test (phrase gate, ziko refusal)
- [ ] `14-signup-isolation.mjs` (rh/gecko-style flagless signup => 0 ziko rows; flagged => profile + credits (welcome 5 credits); cleanup)
- [ ] `15-smoke-core-flows.mjs` (login, read, write, AI chat route, coach CRM read) against preview/prod base URL
- [ ] Update `10-storage-auth-backend.ts` to drop the `deferred-table-codemod` list
- [ ] Update `backend/api/test/rls/fixtures.ts` `createTestUser` with `user_metadata.app='ziko'`
- [ ] Manual checklist file for the 17 items

## Security Domain

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | Supabase GoTrue on portfolio; gated triggers; Google OAuth off |
| V3 Session Management | yes | Re-login after JWT domain change; tokens validated by `auth.getUser` |
| V4 Access Control | yes | RLS on all `ziko_*` (Phase 2/4 verified); tenant diff; service keys server-only |
| V5 Input Validation | yes (unchanged) | Zod in coach-sdk |
| V6 Cryptography | yes | No custom crypto; secrets in Vercel/EAS/GitHub only |

| Threat | STRIDE | Mitigation |
|--------|--------|------------|
| Service key of shared project in API/web (cross-tenant blast radius) | Elevation | Keep server-only; CI guard `no-service-role-in-coach` stays; document risk |
| Secrets leak in logs/git/reports | Info disclosure | `redactPii`, `assertReportSafe`, gitignored PAT/.env, rotate PAT after phase |
| Unprefixed DDL pushed to shared DB | Tampering | Neutralize `migrate-supabase`, CI grep guard |
| Webhook secret mismatch on portfolio triggers | Spoofing/availability | Smoke push-events with real secret |
| Test users left behind | Info/Integrity | Guaranteed cleanup (existing harness pattern) |

## Sources

### Primary (HIGH) - repo reads this session
`06-CONTEXT.md`, REQUIREMENTS/STATE/ROADMAP, `scripts/portfolio-migration/RUNBOOK.md`, `scripts/auth-merge/RUNBOOK.md` and `lib.mjs`, `rename-map.generated.json`, `11-codemod-buckets.mjs`, patch/manifest, `10-storage-auth-*`, `.github/workflows/ci.yml`/`release.yml`/`test-rls.yml`, `apps/mobile/app.json`/`eas.json`/AndroidManifest, `backend/api/src/middleware/auth.ts`, `vercel.json` files, `.env.example` files, git topology (`main` vs branches).

### Secondary (MEDIUM)
- https://docs.expo.dev/eas-update/getting-started/ (runtimeVersion/url/channel requirement)
- https://vercel.com/docs/environment-variables (new-deployments-only; branch-scoped Preview vars)

### Tertiary (LOW)
- Vercel integration auto-sync behavior; EAS env var sourcing for cloud builds (A5, A7): not verified live.

## Metadata

**Confidence:** Standard stack HIGH (all existing), Architecture HIGH, Pitfalls MEDIUM-HIGH (codemod embed behavior and remote platform state unverified), mobile OTA finding HIGH for repo config / MEDIUM for deployed binary.
**Research date:** 2026-10-03 **Valid until:** 2026-10-17 (repo moves fast; re-run `git apply --check` and greps before planning execution)
