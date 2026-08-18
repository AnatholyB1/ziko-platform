# Phase 6: Founder Offer Go-Live - Research

**Researched:** 2026-08-18
**Domain:** Production deploy verification + go-live runbook — CI/CD migration-apply mechanism
(GitHub Actions + Supabase CLI), Vercel GitHub-integration deploy, and direct SQL verification
against a live Supabase project (Ziko Platform, `slkobhavpwsubnsmuhya`). No new application code,
no new schema, no new UI.
**Confidence:** HIGH — every claim below is grounded in files read directly in this worktree this
session, or in `git` state inspected directly this session. No web research was needed or performed;
this is a pure in-repo/in-infrastructure verification task.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Go-live execution model**
- **D-01:** Phase 6 follows the same rehearse-then-human-fires pattern as Phase 2 (D-03) and every
  other credentialed step in this milestone. Claude builds a go-live RUNBOOK with exact ordered
  steps/commands and rehearses what it can (dry-run checks, read-only queries), but the destructive
  or irreversible steps — the real migration deploy, the real purge dry-run against production, the
  `TRUNCATE`, the feature-flag flip — end on a blocking human checkpoint where a person with real
  production access runs them (or the results are pasted back for verification). No Claude session
  in this milestone has held real production credentials; planning around that reality rather than
  assuming it changes.
  — **Reversibility:** reversible — a process/ceremony choice, not a technical commitment.

**Deploy scope**
- **D-02:** Merging to `main` and confirming the migration deploy is **in scope** for Phase 6, not
  assumed to happen separately. Verified during discuss-phase: production (`slkobhavpwsubnsmuhya`)
  has only Phase 1's `waitlist_founder_offer` migration applied — Phase 3's
  `20260815_waitlist_retention_config` and Phase 4's `20260816_premium_credit_flag` /
  `20260816_premium_credit_grant` have never been applied. `app_config` currently holds only
  `waitlist_reveal_threshold`; no `premium_credit_cap_enabled`, no `waitlist_retention_years`, no
  `is_lifetime_premium` column, no `grant_premium_credits()` RPC. The live Vercel-deployed backend
  still runs the old unconditional premium bypass. Phase 6's RUNBOOK must include explicit, checkable
  steps for: merge → CI migration apply → Vercel deploy → post-deploy confirmation (query
  `app_config`, confirm the new columns/RPCs exist) — before any activation checklist item is
  meaningful.
  — **Reversibility:** costly — a botched or partial migration apply against a live database is
  expensive to unwind; the RUNBOOK should confirm each migration applied cleanly before proceeding to
  the next step.

**Account-purge precondition (PURGE-01–05)**
- **D-03:** `SELECT count(*) FROM auth.users WHERE email LIKE '%@ziko-app.com'` returns **0** on
  production right now — Phase 2's real deletion may have nothing to do. The RUNBOOK re-runs Phase
  2's dry-run export (`scripts/purge-test-accounts/`) live against production immediately before
  launch, one more time, and records the result. If it still finds 0, that's a real, freshly-verified
  confirmation of PURGE-05. If it finds test accounts that appeared since Phase 2's rehearsal, the
  full reviewed delete procedure (`scripts/purge-test-accounts/RUNBOOK.md`, two-person rule) runs
  before launch.
  — **Reversibility:** reversible — a verification-timing choice, not a technical commitment.

**Waitlist QA-row cleanup mechanism**
- **D-04:** `waitlist_signups` is at 0 rows on production right now. The RUNBOOK still needs to prove
  `claim_waitlist_signup()` actually works end-to-end against the live (post-migration-deploy)
  production RPC before opening the page — this smoke test creates at least one real row. Cleanup is
  a plain SQL pair added to the RUNBOOK, run by the same human immediately after the smoke test and
  before the page goes public: `TRUNCATE waitlist_signups; SELECT
  reset_waitlist_founder_sequence(1);` — no new RPC or script. This matches
  `reset_waitlist_founder_sequence(p_next_value)`'s own migration comment
  (`20260812_waitlist_founder_offer.sql:244-250`), which names Phase 6 as its consumer but only
  resets the sequence; row deletion needed a separate answer, resolved here.
  — **Reversibility:** one-way for the `TRUNCATE` step itself — it must run before any real visitor
  signup, never after; the RUNBOOK must state this ordering explicitly as a warning, not just a step.

**Reveal-threshold value at launch (FOND-06)**
- **D-05:** `waitlist_reveal_threshold` stays at **30** (counter appears once 170/200 spots are
  claimed) — confirmed correct as already seeded by Phase 1's migration. No config change needed.

**Activation ordering (already established by Phases 3/4, reconfirmed here)**
- **D-06:** The feature flag (`premium_credit_cap_enabled`) flips to `true` only after confirming
  (not assuming) the CGU/CGV pages are live in production — LEGAL-05/CRED-05's ordering constraint,
  verified as an explicit RUNBOOK step (e.g., an HTTP check against the live `/cgv` and `/cgu`
  routes) rather than inferred from Phase 3 being marked complete in ROADMAP.md.

### Claude's Discretion
- Exact RUNBOOK file location/naming (likely `scripts/founder-offer-go-live/RUNBOOK.md`, mirroring
  `scripts/purge-test-accounts/RUNBOOK.md`'s structure).
- Exact wording/format of the post-deploy confirmation queries (D-02) and the entry-point/conversion
  verification steps (ROADMAP criterion 4).
- Whether the migration-apply confirmation is a manual SQL query the human runs, or a small script —
  no strong preference expressed; follow the lightest-weight option consistent with D-01's "human
  fires the real thing" model.

### Deferred Ideas (OUT OF SCOPE)
- Rollback/kill-switch procedure — not raised as a blocking gray area; a short rollback note in the
  RUNBOOK is at the planner's discretion but should not expand phase scope.
- The pre-existing `anon`-executable RPC security hole (`is_coach_of()`, `redeem_invitation_code()`,
  `peek_invitation()`) — explicitly out of scope, a future security-response phase.
- The founder-to-`tier='premium'` redemption flow — deferred per `04-CONTEXT.md` D-04, unaffected by
  this phase.
</user_constraints>

<phase_requirements>
## Phase Requirements

Phase 6 owns no requirement directly; it verifies the production-activation state of requirements
already marked "Complete" by their owning phases (REQUIREMENTS.md Traceability table). "Complete"
there means rehearsed/built, not yet live in production — this research supports proving each one
true in production for real.

| ID | Description | Research Support |
|----|-------------|------------------|
| CRED-01 | Production audit confirms no real `tier='premium'` user affected | Already resolved 0 as of 2026-08-15 (04-CONTEXT.md D-01); this research adds a cheap re-verify query to the RUNBOOK per that file's own staleness note, since ~3 days have elapsed |
| CRED-05 | Credit-gate behavior change gated behind a feature flag | Verified below: `premium_credit_cap_enabled` migration (`20260816_premium_credit_flag.sql`) not yet on production; exact `UPDATE` statement and JSONB-boolean pitfall documented |
| LEGAL-05 | Legal text live before/with the code change it describes, never after | Verified below: exact `/cgv`/`/cgu` route paths and an HTTP-check pattern the RUNBOOK uses to confirm liveness before flipping CRED-05's flag |
| PURGE-01–05 | Test-account purge complete before the public counter can be trusted | Verified below: `scripts/purge-test-accounts/` toolkit re-read in full, RUNBOOK re-use path confirmed unchanged |
| FOND-06 | Reveal threshold configurable without redeploy | Verified below: `waitlist_reveal_threshold` seeded at 30 by Phase 1's migration (already on production); confirmation query provided |

</phase_requirements>

## Summary

Phase 6 is not an application-code phase — it is a **deploy-and-verify runbook** phase, and the single
most important finding of this research is that the phase's actual first blocking problem is not
"apply migrations correctly," it is **"the milestone's entire branch has never been merged into
`main` at all."** This session confirmed directly via `git`: the working branch
(`claude/gsd-knowledge-j7q4l7`) is **155 commits ahead of `origin/main`** and **0 commits behind** —
`main`'s tip (`23034e8`, "Merge pull request #24 from AnatholyB1/dev") is unrelated pre-existing work,
and none of the four waitlist/credit-gate migrations exist on `main` yet (`git diff main --
supabase/migrations/` shows all four as new files, not modifications). This is the direct, root cause
of D-02's finding that production only has Phase 1's migration — Phase 1's migration reached
production through several manual "reapply_check" runs during its own testing (per CONTEXT.md),
**not** through this repo's normal CI pipeline, because that pipeline has literally never run against
this branch's changes. Phase 6's RUNBOOK must therefore start at "open and merge a PR into `main`,"
not "confirm a merge that already happened."

Once merged, `.github/workflows/ci.yml`'s `migrate-supabase` job (triggered only on `push: branches:
[main]`) is the mechanism that applies pending migrations to production, via `supabase link` +
`supabase migration repair --status applied` (for already-applied files) + `supabase db push
--include-all`. This job is unchanged relative to `main` (confirmed via `git diff main --
.github/workflows/ci.yml`, zero output) — it will run as soon as the PR lands. It reads two secrets,
`SUPABASE_PROJECT_ID` and `SUPABASE_ACCESS_TOKEN`, whose presence in the repo's GitHub Actions
secrets could not be confirmed from this session (no `gh` access to repo settings) — the RUNBOOK must
treat this as an explicit human-confirmed precondition, not an assumption. A second, independent risk
in this same job is verified this session: it detects "did migrations change" via `git diff
--name-only HEAD~1 HEAD`, which only diffs the **top commit against its immediate parent** — correct
for a single merge/squash commit landing on `main` (the common case for this repo's PR-based
workflow, evidenced by "Merge pull request #24"), but silently wrong if the branch is ever
fast-forward-pushed as many raw commits in one push event, in which case only the last commit's
migration changes would be detected. The RUNBOOK should call this out as a merge-strategy constraint
(squash or merge-commit, never a raw multi-commit fast-forward) and, regardless of merge strategy,
never trust the CI badge alone — every migration's actual effect (new column, new `app_config` row,
new RPC signature) must be confirmed with a direct `SELECT`/`information_schema` query against
production before proceeding, exactly as D-02 already specifies.

No new libraries, no new scripts beyond the RUNBOOK document itself are needed — every mechanism
this phase orchestrates already exists and was re-verified by direct file read this session:
`scripts/purge-test-accounts/*.mjs` + its `RUNBOOK.md` (D-03), `reset_waitlist_founder_sequence()`
(D-04, verified at the exact quoted line range), `claim_waitlist_signup()` (the smoke-test target),
`get_waitlist_founder_status()` (the threshold-arbitration read for FOND-06), and
`apps/web/src/lib/supabase/admin.ts`'s `createAdminClient()` (the service-role client any ad-hoc
verification script would use). This session's sandbox itself has no `supabase` CLI installed and no
production credentials — confirming D-01's premise directly: this Claude session structurally cannot
fire any of Phase 6's real steps, only write the RUNBOOK and rehearse what a read-only tool call can
verify.

**Primary recommendation:** write `scripts/founder-offer-go-live/RUNBOOK.md` (mirroring
`scripts/purge-test-accounts/RUNBOOK.md`'s audience/tone/structure) with the exact ordered sequence
in the Architecture Patterns section below — merge-to-main *first* (since it has not happened yet),
then CI migration confirmation, then Vercel deploy confirmation, then the re-run purge dry-run
(D-03), then the `claim_waitlist_signup()` smoke test + `TRUNCATE` + sequence reset (D-04), then the
CGU/CGV liveness HTTP check gating the flag flip (D-06), then the flag flip itself, then the
entry-point/conversion spot-check (criterion 4) — every destructive or credentialed step ending on a
`checkpoint:human-verify`.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Merge-to-main + CI migration apply | CI/CD (GitHub Actions) | Database / Storage | `.github/workflows/ci.yml`'s `migrate-supabase` job is the sole mechanism; it writes to Supabase, but the trigger and orchestration live in GitHub Actions, not the database itself |
| Vercel deploy confirmation | CDN / Static + API / Backend | — | Vercel's GitHub integration redeploys both `apps/web` and `backend/api` on push to `main`; confirmation is an HTTP/API-level check, not a database check |
| Purge re-verification (PURGE-01–05) | Database / Storage | API / Backend (Admin API script) | `scripts/purge-test-accounts/*.mjs` calls Supabase's Auth Admin API; the actual deletion target and cascade live entirely in the database |
| Waitlist smoke test + cleanup (D-04) | Database / Storage | API / Backend (admin client) | `claim_waitlist_signup()`/`TRUNCATE`/`reset_waitlist_founder_sequence()` are all direct RPC/SQL against Postgres; the admin client (`apps/web/src/lib/supabase/admin.ts`) is only a thin transport |
| CGU/CGV liveness check (D-06) | Frontend Server (SSR) | — | An HTTP GET against the deployed `/cgv`/`/cgu` Next.js routes; purely a "is this page actually serving 200" check, no database involved |
| Feature-flag flip (`premium_credit_cap_enabled`) | Database / Storage | API / Backend (read-only consumer) | The flag lives in `app_config` (Postgres); `creditGate.ts` only *reads* it per-request, it does not own the flip |
| Entry-point/conversion verification (criterion 4) | Browser / Client (analytics) | Frontend Server (SSR, sitemap/OG) | Vercel Analytics' `track('waitlist_signup', ...)` events are recorded client-side and viewed in an external Vercel dashboard — no repo-queryable data source exists for this criterion |

## Standard Stack

### Core
No new libraries or packages. This phase writes one Markdown runbook and reuses existing tooling.

| Tool | Version | Purpose | Why Standard |
|------|---------|---------|--------------|
| `supabase` CLI | latest (per `supabase/setup-cli@v1` in CI) [CITED: `.github/workflows/ci.yml:59-61`, read this session] | Migration apply during CI's `migrate-supabase` job | Already the only migration-apply mechanism in this repo; not installed in this sandbox (`command -v supabase` → not found, verified this session) — the human operator's environment must have it, or fall back to the Supabase SQL Editor for manual apply |
| `node --env-file` | Node 22 (per `scripts/purge-test-accounts/RUNBOOK.md:77`, read this session) | Runs the purge toolkit scripts | Already the documented invocation for every `.mjs` script in `scripts/purge-test-accounts/` |
| Supabase MCP tools (`get_advisors`, direct SQL) | n/a | Read-only production verification during this research session and potentially during RUNBOOK execution | Already used by the prior discuss-phase session to gather the `waitlist_signups`/`auth.users`/`app_config` counts cited in `06-CONTEXT.md` `<specifics>` |

### Package Legitimacy Audit

Not applicable — this phase installs zero new external packages. No `npm install`/`pip install`
step exists anywhere in this phase's scope.

## Architecture Patterns

### System Architecture Diagram

```
 Human operator (PR author/merger)
        │
        │ 1. Merge lien-invite branch → main
        │    (git state confirmed this session: branch is 155 commits
        │     ahead of main, 0 behind — NOT YET MERGED)
        ▼
 GitHub Actions — .github/workflows/ci.yml
 ┌──────────────────────────────────────────────────────────────┐
 │ push: branches: [main]                                        │
 │  job "verify" (type-check/lint/test) ──▶ job "migrate-supabase"│
 │    if push && ref==refs/heads/main:                            │
 │      git diff --name-only HEAD~1 HEAD | grep supabase/migrations│
 │      supabase link --project-ref $SUPABASE_PROJECT_ID          │
 │      for f in supabase/migrations/*.sql:                       │
 │        if not new: supabase migration repair --status applied  │
 │      supabase db push --include-all                            │
 └───────────────────────────┬──────────────────────────────────┘
                              │ applies 3 pending migrations:
                              │  20260815_waitlist_retention_config.sql
                              │  20260816_premium_credit_flag.sql
                              │  20260816_premium_credit_grant.sql
                              ▼
                  Supabase Postgres (slkobhavpwsubnsmuhya)
                  app_config gains: premium_credit_cap_enabled='false',
                                    waitlist_retention_years='3'
                  user_profiles gains: is_lifetime_premium column
                  new RPC: grant_premium_credits()

 Vercel (GitHub integration, separate from the above)
 ┌──────────────────────────────────────────────────────────────┐
 │ push to main → redeploy apps/web AND backend/api               │
 │  backend/api's creditGate.ts now reads premium_credit_cap_enabled│
 │  apps/web now serves the merged CGU/CGV/founders page code     │
 └───────────────────────────┬──────────────────────────────────┘
                              ▼
 Human operator, RUNBOOK Section "Post-deploy confirmation" (D-02)
   SELECT ... FROM app_config; \d user_profiles; \df grant_premium_credits
        │
        ▼
 Human operator, RUNBOOK Section "Purge re-verification" (D-03)
   node --env-file=... scripts/purge-test-accounts/dry-run.mjs   (against prod)
        │
        ▼
 Human operator, RUNBOOK Section "Waitlist smoke test + cleanup" (D-04)
   claim_waitlist_signup('smoketest@...', 'athlete')  → 1 real row created
   TRUNCATE waitlist_signups;
   SELECT reset_waitlist_founder_sequence(1);          ⚠ before any public visit
        │
        ▼
 Human operator, RUNBOOK Section "Legal-text liveness gate" (D-06)
   curl -sI https://ziko-app.com/fr/cgv   → expect 200
   curl -sI https://ziko-app.com/fr/cgu   → expect 200
        │  (only if both 200)
        ▼
 Human operator, RUNBOOK Section "Flip the flag" (CRED-05/D-06)
   UPDATE app_config SET value='true' WHERE key='premium_credit_cap_enabled';
        │
        ▼
 Human operator, RUNBOOK Section "Entry-point / conversion spot-check" (criterion 4)
   Visit homepage / /coachs / header / footer links → land on /fondateurs
   Submit one real (or the smoke-test) signup → confirm a 'waitlist_signup' event
   appears in the Vercel Analytics dashboard for the production project
```

A reader can trace the primary use case start to finish: merge → CI applies migrations → Vercel
redeploys → a human confirms each step with a direct read against production, in the order the four
ROADMAP success criteria require (purge before counter is trusted, legal text before flag flip,
threshold correctness, entry points routing real traffic) — never inferred from a green checkmark.

### Recommended Project Structure

```
scripts/founder-offer-go-live/
└── RUNBOOK.md     # NEW — mirrors scripts/purge-test-accounts/RUNBOOK.md's structure/tone exactly;
                    # no new .mjs scripts — every command in it is either a re-invocation of
                    # scripts/purge-test-accounts/*.mjs, a plain SQL statement, or a curl/HTTP check
```

No source code changes. No new migration. No new RPC. No new route.

### Pattern 1: Merge-first, not merge-assumed

**What:** RUNBOOK Step 0 is explicitly "merge the milestone branch into `main` via a PR" — not
"confirm the merge already happened."
**When to use:** Always for this phase, given the verified branch state.
**Verified this session:**
```
$ git status
On branch claude/gsd-knowledge-j7q4l7
$ git log --oneline main..HEAD | wc -l
155
$ git log --oneline HEAD..main | wc -l
0
$ git diff main -- supabase/migrations/ --name-status
A  supabase/migrations/20260812_waitlist_founder_offer.sql
A  supabase/migrations/20260815_waitlist_retention_config.sql
A  supabase/migrations/20260816_premium_credit_flag.sql
A  supabase/migrations/20260816_premium_credit_grant.sql
```
Even `20260812_waitlist_founder_offer.sql` — the one migration D-02 says is already applied to
production — shows as a brand-new file (`A`) relative to `main`, not a modification. This confirms
CONTEXT.md's own account: that migration reached production out-of-band ("several manual
'reapply_check' variants from Phase 1's own testing"), not via this CI pipeline. The RUNBOOK must not
assume `main` already contains any of this milestone's code.

### Pattern 2: CI's migration-apply mechanism, verbatim

**What:** the exact job that will run once merged.
**Verified** (`.github/workflows/ci.yml:38-79`, read this session, quoted):
```yaml
migrate-supabase:
  name: Apply Supabase migrations
  needs: [verify]
  if: github.event_name == 'push' && github.ref == 'refs/heads/main'
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v4
      with:
        fetch-depth: 2
    - name: Check for migration changes
      id: migrations
      run: |
        if git diff --name-only HEAD~1 HEAD | grep -q '^supabase/migrations/'; then
          echo "changed=true" >> $GITHUB_OUTPUT
        else
          echo "changed=false" >> $GITHUB_OUTPUT
        fi
    - name: Setup Supabase CLI
      if: steps.migrations.outputs.changed == 'true'
      uses: supabase/setup-cli@v1
    - name: Push migrations
      if: steps.migrations.outputs.changed == 'true'
      run: |
        supabase link --project-ref ${{ secrets.SUPABASE_PROJECT_ID }}
        NEW=$(git diff --name-only HEAD~1 HEAD | grep '^supabase/migrations/' | xargs -I{} basename {} .sql)
        for f in supabase/migrations/*.sql; do
          version=$(basename "$f" .sql)
          if ! echo "$NEW" | grep -qx "$version"; then
            supabase migration repair --status applied "$version" 2>/dev/null || true
          fi
        done
        supabase db push --include-all
      env:
        SUPABASE_ACCESS_TOKEN: ${{ secrets.SUPABASE_ACCESS_TOKEN }}
```
This only fires on `push` to `main` (not on PR open) and only after the `verify` job (type-check +
lint + test) passes. `fetch-depth: 2` means the checkout only has enough history for `HEAD~1` to
resolve against the single immediately-preceding commit. **This job never appears in the `test-rls.yml`
workflow** — that workflow is PR-triggered against a separate *test* Supabase project
(`SUPABASE_TEST_PROJECT_ID`) and does not touch production; do not confuse the two when writing the
RUNBOOK's verification steps (see Pitfall 1 below for the consequence of conflating them).

### Pattern 3: Post-deploy confirmation query set (D-02)

**What:** the exact `SELECT`s the RUNBOOK should run immediately after CI reports the
`migrate-supabase` job green, to independently confirm the effect (not just the badge).
```sql
-- Confirm app_config gained the two new rows (Phase 3 + Phase 4)
SELECT key, value FROM public.app_config ORDER BY key;
-- Expect 3 rows: premium_credit_cap_enabled=false, waitlist_reveal_threshold=30, waitlist_retention_years=3

-- Confirm the lifetime-premium provenance column exists (Phase 4)
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'user_profiles' AND column_name = 'is_lifetime_premium';

-- Confirm the monthly grant RPC exists (Phase 4)
SELECT proname FROM pg_proc WHERE proname = 'grant_premium_credits';
```
All three field/row names verified directly against the migration files this session (quoted in full
above): `app_config` rows from `20260815_waitlist_retention_config.sql:14` and
`20260816_premium_credit_flag.sql:44`; `is_lifetime_premium` from
`20260816_premium_credit_flag.sql:29`; `grant_premium_credits` from
`20260816_premium_credit_grant.sql:25`.

### Pattern 4: Purge re-verification re-uses Phase 2's toolkit unmodified (D-03)

**What:** `scripts/purge-test-accounts/dry-run.mjs`, run live against production one more time.
**Verified command** (`scripts/purge-test-accounts/RUNBOOK.md:96-104`, read this session, quoted):
```
node --env-file=apps/web/.env.local scripts/purge-test-accounts/dry-run.mjs [--out <dir>]
```
Reads four printed totals (`users_scanned`, `candidates`, `flagged_cross_linked`, `to_delete`),
removes nothing. If `to_delete` is still 0 (matching the `auth.users` count of 0 already confirmed
live this discussion), record that in the go-live RUNBOOK as a fresh, dated confirmation of PURGE-05.
If non-zero, the RUNBOOK branches into the full two-person-reviewed delete procedure already
documented in `scripts/purge-test-accounts/RUNBOOK.md` sections 3-7 — do not re-derive that procedure
in the new file, reference it.

### Pattern 5: Smoke test + cleanup pair (D-04)

**What:** prove `claim_waitlist_signup()` works against the live, post-migration-deploy production
RPC, then remove the row it creates before any real visitor can see the page.
**Verified RPC signature** (`20260812_waitlist_founder_offer.sql:102-108`, read this session):
```sql
claim_waitlist_signup(
  p_email TEXT, p_audience TEXT, p_locale TEXT DEFAULT NULL,
  p_utm_source TEXT DEFAULT NULL, p_utm_campaign TEXT DEFAULT NULL
) RETURNS TABLE(is_new BOOLEAN, is_founder BOOLEAN, founder_rank INTEGER)
```
Call via the service-role admin client (`apps/web/src/lib/supabase/admin.ts`, read this session,
quoted in full):
```typescript
// Source: apps/web/src/lib/supabase/admin.ts (read this session, verbatim)
import 'server-only';
import { createClient } from '@supabase/supabase-js';

export function createAdminClient() {
  return createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } }
  );
}
```
or equivalently, directly via the Supabase SQL Editor / MCP as `service_role` (the RPC is
`service_role`-only per its own `REVOKE`/`GRANT` lines, `20260812_waitlist_founder_offer.sql:151-152`
— an anon-key call will be rejected). Cleanup pair, exact commands per D-04:
```sql
TRUNCATE public.waitlist_signups;
SELECT public.reset_waitlist_founder_sequence(1);
```
`reset_waitlist_founder_sequence`'s signature and behavior verified verbatim
(`20260812_waitlist_founder_offer.sql:251-265`, read this session): takes one `BIGINT`, calls
`setval('public.waitlist_founder_seq', p_next_value, false)` — the `false` third argument means the
**next** `nextval()` call returns exactly `p_next_value` (i.e. `1`), not `p_next_value + 1`. Passing
`1` is correct so the first real founder gets rank 1, not rank 2.

### Pattern 6: CGU/CGV liveness gate before the flag flip (D-06)

**What:** an HTTP check, not an inference from ROADMAP/REQUIREMENTS.md marking Phase 3 "Complete."
**Verified route files exist** (`ls` this session):
```
apps/web/src/app/[locale]/(marketing)/cgv/page.tsx
apps/web/src/app/[locale]/(marketing)/cgu/page.tsx
```
Recommended check (exact URLs depend on the production domain — `apps/web/.env.local`'s
`NEXT_PUBLIC_SITE_URL`, not independently re-verified this session since it is an env var, not a
committed file):
```bash
curl -sI https://ziko-app.com/fr/cgv | head -1   # expect: HTTP/2 200
curl -sI https://ziko-app.com/fr/cgu | head -1   # expect: HTTP/2 200
curl -sI https://ziko-app.com/en/cgv | head -1   # expect: HTTP/2 200 (bilingual, LEGAL-01)
curl -sI https://ziko-app.com/en/cgu | head -1   # expect: HTTP/2 200
```
Only after all four return 200 does the RUNBOOK proceed to the flag-flip step.

### Pattern 7: The flag flip itself (CRED-05/D-06)

**What:** a plain `UPDATE`, matching `04-RESEARCH.md`'s already-verified JSONB-boolean convention.
```sql
UPDATE public.app_config
SET value = 'true', updated_at = NOW()
WHERE key = 'premium_credit_cap_enabled';
```
Must be a bare `true` literal (parses as a JSONB boolean), never `'"true"'` (a JSON string the gate's
`config?.value === true` check would never match) — this exact trap is already documented in
`04-RESEARCH.md` Pitfall 4 and reproduced below for this RUNBOOK's context since the failure mode
(flag appears to never take effect) is identical whether set at migration time or by this UPDATE.

### Pattern 8: Entry-point/conversion spot-check (criterion 4)

**What:** confirm real traffic actually reaches `/fondateurs` and that a real submission produces a
trackable event — not a repo-internal check, since Vercel Analytics has no git-queryable data source.
**Verified event name** (`apps/web/src/components/marketing/WaitlistRoleForm.tsx:17,100`, read this
session, quoted): `const WAITLIST_SIGNUP_EVENT = 'waitlist_signup'; ... track(WAITLIST_SIGNUP_EVENT, {
audience: role })`. **Verified sitemap entry** (`apps/web/src/app/sitemap.ts:8`, read this session,
quoted): `{ path: '/fondateurs', changeFrequency: 'daily' as const, priority: 0.9 }`. The RUNBOOK
step: click through from the homepage, `/coachs`, header, and footer links to confirm each lands on
`/fondateurs`; submit one signup and confirm a `waitlist_signup` event appears in the Vercel Analytics
dashboard for the production project (external UI, no automatable repo check — see Validation
Architecture below).

### Anti-Patterns to Avoid

- **Trusting a green CI badge as proof migrations applied**, instead of running Pattern 3's direct
  `SELECT`s — the `HEAD~1 HEAD` diff heuristic (Pattern 2) has a known edge case (Pitfall 1 below) that
  a green run can mask.
- **Flipping `premium_credit_cap_enabled` before checking CGU/CGV liveness by URL** — inferring
  "Phase 3 is marked Complete in ROADMAP.md, so the text must be live" is exactly the shortcut D-06
  rejects; ROADMAP/REQUIREMENTS.md track *build* completion, not *production* liveness.
- **Running the `TRUNCATE` after any real visitor could have signed up** — D-04 requires this
  ordering explicitly; a `TRUNCATE` run even minutes after the page opens to real traffic destroys
  genuine signups, not just the smoke-test row.
- **Re-deriving the purge criterion or writing a new delete script for D-03** — the existing
  `scripts/purge-test-accounts/` toolkit and its `RUNBOOK.md` already encode the two-person rule,
  the exact-domain-equality criterion, and the cross-link safety check; Phase 6 re-invokes, never
  reimplements.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Test-account deletion | A new bulk-delete script for the go-live purge re-check | `scripts/purge-test-accounts/dry-run.mjs` (and, if needed, the full `export.mjs`→`delete.mjs`→`verify-purge.mjs` chain) | Already built, tested, and rehearsed in Phase 2; re-inventing it for Phase 6 reopens every hazard (cross-linked real accounts, no PITR check) that toolkit already closed |
| Sequence reset | A new RPC or ad-hoc `ALTER SEQUENCE` statement | `reset_waitlist_founder_sequence(1)`, already shipped in Phase 1's migration for exactly this purpose | The migration's own comment names Phase 6 as its consumer; writing a parallel mechanism creates two ways to reset the sequence with different edge-case behavior (`setval(..., false)` vs `RESTART WITH`) |
| Migration-apply verification | A new script polling the Supabase API for schema state | Direct `SELECT`/`information_schema` queries run once by the human operator (Pattern 3) | This is a one-time, human-witnessed check per D-01's rehearse-then-human-fires model — building automation for a single credentialed step adds engineering surface with no reuse value |
| Feature-flag storage | A new config mechanism for the go-live flip | The existing `app_config` table, read/write via plain SQL | Already the established Phase 1/4 mechanism; Phase 6 only needs one `UPDATE` statement against it |

**Key insight:** every mechanism Phase 6 needs to orchestrate was deliberately built in an earlier
phase specifically for Phase 6 to consume — the sequence-reset RPC's own comment says so explicitly.
The work here is sequencing and human-witnessed verification, not construction.

## Common Pitfalls

### Pitfall 1: Assuming "merged" means "on `main`" without checking
**What goes wrong:** the RUNBOOK's post-deploy confirmation queries (Pattern 3) run against
production and find nothing changed, because the branch was never actually merged into `main` — or
was merged into an intermediate branch (this repo's history shows PRs merging via `AnatholyB1/dev`
as a contributor fork branch, not a persistent `dev` integration branch — confirmed no local `dev`
branch exists in this repo's remote refs this session).
**Why it happens:** "Phase 5 is complete" and "the branch is ready to merge" get conflated with "the
branch has been merged" — a state that requires an explicit, separate human action this session
confirmed has not happened (155 commits ahead of `main`, 0 behind).
**How to avoid:** RUNBOOK Step 0 is an explicit `git log --oneline origin/main..<branch> | wc -l`
check (or the PR's own "This branch has no conflicts / X commits ahead" GitHub UI banner) before any
downstream step is attempted.
**Warning signs:** Pattern 3's queries return the pre-Phase-6 state (only `waitlist_reveal_threshold`
in `app_config`) even after CI is reported green — check whether CI actually ran on a *merge* push to
`main`, not on a feature-branch push or a PR-open event (this workflow does not run
`migrate-supabase` on `pull_request`, only on `push` to `main`, verified in Pattern 2's quoted YAML).

### Pitfall 2: The `HEAD~1 HEAD` migration-change detector missing earlier commits in a multi-commit push
**What goes wrong:** if the 155-commit branch is fast-forward-pushed directly onto `main` in one
`git push` (rather than merged via a PR that produces a single merge/squash commit), GitHub's `push`
event still fires the workflow once, but `git diff --name-only HEAD~1 HEAD` inside that run only
diffs the very last of those 155 commits against its immediate parent — silently missing any
migration file added in an earlier commit of the same push. The `changed` output could resolve
`false` even though migration files did change, in which case the entire `Setup Supabase CLI` /
`Push migrations` step block is skipped (its `if: steps.migrations.outputs.changed == 'true'` guard
never fires) and CI reports success having done nothing.
**Why it happens:** `HEAD~1` is relative to the checked-out `HEAD` at workflow-run time, not to
`github.event.before` (the true pre-push SHA) — a known GitHub Actions footgun for pushes containing
more than one commit. `fetch-depth: 2` (verified in Pattern 2's YAML) only fetches enough history for
`HEAD~1` to resolve, reinforcing the single-commit assumption baked into this script.
**How to avoid:** merge via a PR that lands as a single merge commit or a single squash commit (the
common case for this repo, evidenced by "Merge pull request #24" in `main`'s recent history) — never
a raw multi-commit fast-forward push. Regardless of merge strategy, always run Pattern 3's direct
`SELECT`s after CI reports green; never treat the green badge alone as proof.
**Warning signs:** CI's `migrate-supabase` job runs and reports success, but Pattern 3's `SELECT
key, value FROM app_config` still shows only 1 row instead of 3.

### Pitfall 3: `app_config.value` JSONB-vs-string comparison trap on the flag flip
**What goes wrong:** the flag appears to never take effect even after the `UPDATE` in Pattern 7 runs
successfully.
**Why it happens:** already documented and verified in `04-RESEARCH.md` Pitfall 4 for the migration's
own `INSERT`; the identical trap applies to this phase's `UPDATE` — `SET value = '"true"'` stores a
JSON *string*, which `creditGate.ts`'s `config?.value === true` (a JS boolean comparison) never
matches, while `SET value = 'true'` (no inner quotes) stores a JSON boolean scalar, which does match.
**How to avoid:** use the exact `UPDATE ... SET value = 'true'` form quoted in Pattern 7 — a bare,
unquoted-inside `true` literal.
**Warning signs:** `SELECT value, pg_typeof(value) FROM app_config WHERE key =
'premium_credit_cap_enabled';` should show `true` with type `jsonb` and `jsonb_typeof(value) =
'boolean'` — if `jsonb_typeof(value) = 'string'`, the UPDATE used the wrong literal form.

### Pitfall 4: No `supabase` CLI or production credentials in this (or any Claude) session
**What goes wrong:** a Claude session attempts to "just run" any of the RUNBOOK's real steps and
fails, or worse, is asked to and a well-meaning but incorrect workaround (e.g., trying to reach
production through an unrelated MCP tool without confirming which project it targets) is attempted.
**Why it happens:** verified directly this session — `command -v supabase` returns not-found in this
sandbox, and per STATE.md and every prior phase's own account, no Claude session in this milestone
has held real `SUPABASE_SERVICE_ROLE_KEY`/`SUPABASE_ACCESS_TOKEN` for production.
**How to avoid:** this is exactly D-01's premise — the RUNBOOK is written for a human with real
credentials to execute, or for a human to paste results back to a session for verification. No task
in Phase 6's plan should assume a Claude session can execute the destructive/credentialed steps
directly.
**Warning signs:** a plan task with no `checkpoint:human-verify`/`gate=blocking` on any of the six
destructive steps identified in this research (merge, migration apply, purge delete-if-needed,
`TRUNCATE`, flag flip, — smoke-test row creation is technically destructive too since it writes to
production).

### Pitfall 5: Confusing `test-rls.yml`'s test-project migration apply with `ci.yml`'s production one
**What goes wrong:** a green `test-rls.yml` run (which applies migrations to
`SUPABASE_TEST_PROJECT_ID`, a *separate* Supabase project used only for CI's own RLS test suite) is
mistaken for evidence that production migrations landed.
**Why it happens:** both workflows contain near-identical `supabase link` / `migration repair` /
`db push --include-all` blocks (verified this session — `test-rls.yml:67-84` vs
`ci.yml:57-76`), differing only in which project ref and secrets they use.
**How to avoid:** Pattern 3's `SELECT`s must be run against the actual production project
(`slkobhavpwsubnsmuhya`), confirmed by connection string/project ref, never assumed correct because
"a migration workflow ran green somewhere."
**Warning signs:** none directly observable from CI's UI alone — this is precisely why Pattern 3
exists as an independent, direct verification step.

## Code Examples

### Post-deploy confirmation (Pattern 3, consolidated)
```sql
-- Run once, immediately after CI's migrate-supabase job reports success, against production.
SELECT key, value, updated_at FROM public.app_config ORDER BY key;
SELECT column_name FROM information_schema.columns
  WHERE table_name = 'user_profiles' AND column_name = 'is_lifetime_premium';
SELECT proname FROM pg_proc WHERE proname IN ('grant_premium_credits', 'reset_waitlist_founder_sequence');
```

### Smoke test + cleanup (Pattern 5, consolidated)
```sql
-- 1. Smoke test — creates one real row
SELECT * FROM public.claim_waitlist_signup('go-live-smoketest@ziko-app.com', 'athlete');
-- Expect: is_new=true, is_founder=true, founder_rank=1 (waitlist_signups is 0 rows pre-smoke-test)

-- 2. Cleanup — MUST run before the page is opened to real visitors (D-04's one-way ordering warning)
TRUNCATE public.waitlist_signups;
SELECT public.reset_waitlist_founder_sequence(1);
```

### Threshold confirmation (D-05, no change expected but verify, not assume)
```sql
SELECT value FROM public.app_config WHERE key = 'waitlist_reveal_threshold';
-- Expect: 30
```

## State of the Art

Not applicable in the ecosystem sense — this is a single-project, single-session activation
procedure, not a domain with external tooling churn. The one relevant "state of the art" fact is
in-repo: the milestone's own build order evolved between the 2026-08-12 milestone-level
`research/ARCHITECTURE.md` (which described a generic "Phase F — Go-Live" with just a `TRUNCATE` +
`RESTART SEQUENCE` + "flip page live") and this phase's actual discuss-phase findings — the real
go-live now additionally requires a from-scratch merge-to-main, because the ARCHITECTURE.md-era
assumption that phases would land on `main` incrementally as they completed did not hold in practice.

**Deprecated/outdated:** `research/ARCHITECTURE.md` Section 1's go-live sketch
(`TRUNCATE public.waitlist_signups; ALTER SEQUENCE public.waitlist_founder_seq RESTART WITH 1;`) is
superseded by the actual shipped `reset_waitlist_founder_sequence(1)` RPC (Pattern 5) — use the RPC,
not a raw `ALTER SEQUENCE`, since the RPC is what Phase 1 actually built and named Phase 6 as its
consumer.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The production site's public URL is `https://ziko-app.com` (used in Pattern 6's `curl` examples) | Pattern 6 | Low — CLAUDE.md's own header states `ziko-app.com` as the marketing site, but the exact `NEXT_PUBLIC_SITE_URL` env value was not read this session (env files are gitignored); the RUNBOOK should have the operator confirm the real domain before running the curl checks, not hardcode it blindly |
| A2 | Merging via a GitHub PR (single merge/squash commit) is how this repo's contributors actually land branches on `main` | Pitfall 2 | Medium — if the actual merge is done via a raw multi-commit fast-forward push, Pitfall 2's CI blind spot is live; the RUNBOOK's explicit recommendation to always independently verify via Pattern 3 (regardless of merge strategy) is the mitigation, not reliance on merge-strategy discipline alone |
| A3 | `SUPABASE_PROJECT_ID` and `SUPABASE_ACCESS_TOKEN` GitHub Actions secrets are actually configured for `ci.yml`'s production job | Summary, Pattern 2 | High if wrong — the entire CI migration-apply step silently no-ops (each `supabase` CLI command fails, but note `supabase migration repair ... || true` swallows errors on the repair step) if these secrets are absent or stale; STATE.md already flags an analogous unconfirmed-secrets concern for `test-rls.yml`'s `SUPABASE_TEST_PROJECT_ID`, so this is a real, precedented risk class in this repo, not a hypothetical — the RUNBOOK must have the human operator confirm these secrets exist in repo settings before relying on CI, with a manual `supabase db push` (or SQL Editor) fallback if not |

**All other claims in this research were verified this session** by reading the actual migration
files, workflow YAML, scripts, and by running `git` commands directly against the repository state —
not carried forward from training data or the milestone's earlier (2026-08-12) research without
re-verification.

## Open Questions

1. **Are `SUPABASE_PROJECT_ID` / `SUPABASE_ACCESS_TOKEN` actually configured as GitHub Actions
   secrets for this repository?**
   - What we know: `ci.yml`'s `migrate-supabase` job references both by name; `STATE.md` records an
     analogous unresolved question for `test-rls.yml`'s `SUPABASE_TEST_PROJECT_ID`.
   - What's unclear: no `gh` API access from this session to check repo secrets (secrets are, by
     GitHub's design, never readable even with access — only their *presence* could be confirmed via
     `gh secret list`, not attempted this session since it requires a token bound to this session,
     which does not exist per D-01's premise).
   - Recommendation: RUNBOOK Step 0.5, immediately after the PR is opened but before merging: the
     human operator runs `gh secret list --repo <org>/<repo>` (or checks the GitHub UI) and confirms
     both names are present, or falls back to a manual `supabase db push` / SQL Editor apply if not.

2. **What merge mechanism will actually be used to land this 155-commit branch on `main`?**
   - What we know: this repo uses PRs (evidenced by "Merge pull request #24" in `main`'s history).
   - What's unclear: whether the specific PR landing this milestone's work will be a merge commit,
     squash commit, or (less likely given repo convention) a rebase/fast-forward — this affects
     whether Pitfall 2's CI blind spot is live for this specific merge.
   - Recommendation: the RUNBOOK should recommend squash-or-merge-commit explicitly and, regardless,
     never skip Pattern 3's independent verification step.

## Environment Availability

| Dependency | Required By | Available (this session) | Version | Fallback |
|------------|-------------|---------------------------|---------|----------|
| `supabase` CLI | RUNBOOK's manual-apply fallback, and CI's `migrate-supabase` job (runs in GitHub's own runner, not this sandbox) | ✗ (this sandbox) | — | Supabase SQL Editor (paste each pending migration's SQL body manually) if CI cannot run migrations for any reason |
| Production Supabase credentials (`SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_URL` for `slkobhavpwsubnsmuhya`) | Every destructive/verification step in this RUNBOOK | ✗ (this sandbox, and every prior Claude session per STATE.md) | — | None — this is precisely why D-01 makes every real step a human-fired, blocking checkpoint |
| `gh` CLI / GitHub API access to check repo secrets | Open Question 1 | ✗ (this session) | — | Human operator checks the GitHub repo Settings → Secrets UI directly |
| Vercel Analytics dashboard access | Criterion 4 verification (Pattern 8) | ✗ (this session — external SaaS UI, no repo-local check possible) | — | None — inherently a human-viewed dashboard check, not automatable |

**Missing dependencies with no fallback:**
- Production Supabase credentials — by design, per D-01; every RUNBOOK step needing them is a
  blocking human checkpoint.
- Vercel Analytics dashboard access for the conversion-tracking half of criterion 4 — no repo-local
  or scriptable alternative exists for viewing recorded `track()` events.

**Missing dependencies with fallback:**
- `supabase` CLI — the SQL Editor fallback is viable for the small number of one-time statements this
  phase needs (four migration files' worth of DDL), even without CLI access, since the RUNBOOK's own
  Pattern 3 already gives the human the exact SQL to paste.

## Validation Architecture

> Included per `workflow.nyquist_validation: true` (`.planning/config.json`). This phase has no
> conventional test suite — validation is a human-verification runbook, not `vitest`/CI-automatable
> assertions, because every check requires live production access this session (and every prior
> session in this milestone) does not have. The table below maps automatable-in-principle vs.
> genuinely-manual for each of the 4 ROADMAP success criteria.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | None applicable — this phase ships zero application code and zero test files. Verification is entirely direct-SQL / HTTP-check / human-observed, executed against live production per D-01. |
| Config file | n/a |
| Quick run command | n/a — see Phase Requirements → Verification Map below for the literal command per criterion |
| Full suite command | n/a |

### Phase Requirements → Verification Map

| Success Criterion | Behavior | Verification Type | Command / Check | Automatable? |
|---|---|---|---|---|
| 1. Founder counter reflects only genuine post-launch signups | `waitlist_signups` is empty and the sequence is reset to 1 immediately before public launch | scripted SQL, human-fired | `SELECT count(*) FROM waitlist_signups;` (expect 0) run by the human operator after the `TRUNCATE`/reset pair (Pattern 5) | Query is scriptable; firing it against production requires human credentials (not automatable by a Claude session) |
| 2. Flag flips only after CGU/CGV are live | An HTTP 200 from `/cgv` and `/cgu` (both locales) precedes the `UPDATE app_config ... premium_credit_cap_enabled` | scripted HTTP check + scripted SQL, human-fired, in strict order | `curl -sI <site>/fr/cgv` etc. (Pattern 6) then `UPDATE app_config ...` (Pattern 7) | Both individual checks are scriptable; the *ordering guarantee* is a human-process control (the RUNBOOK's step order), not something a script alone can enforce against a human skipping ahead |
| 3. Reveal-threshold state matches what was intended | `app_config.waitlist_reveal_threshold = 30` on production | scripted SQL | `SELECT value FROM app_config WHERE key='waitlist_reveal_threshold';` (expect 30) — already true per D-05, this is a confirm-not-assume check | Fully scriptable; only needs production read access |
| 4. Entry points route real traffic and conversions record | Homepage/`/coachs`/header/footer all reach `/fondateurs`; a real submission produces a `waitlist_signup` event visible in Vercel Analytics | manual browser click-through + manual dashboard check | Visit each entry point in a browser; submit one signup; check the Vercel Analytics dashboard for the `waitlist_signup` event (Pattern 8) | Not automatable — no repo-local or CLI-scriptable path to either a live-site click-through or the Vercel Analytics UI exists in this environment |

### Sampling Rate
- **Per RUNBOOK step:** the human operator confirms each step's expected output (SQL row count, HTTP
  status, or event visibility) before proceeding to the next — this replaces "per task commit," since
  no code is being committed in the destructive steps.
- **Phase gate:** all four criteria above confirmed true, in order, with results recorded (pasted back
  into the RUNBOOK or a completion log) before the phase is marked complete — mirroring Phase 2's
  `02-04-SUMMARY.md` pattern of a written, dated confirmation.

### Wave 0 Gaps
None — there is no test framework to bootstrap. The "Wave 0" equivalent for this phase is writing the
RUNBOOK itself (`scripts/founder-offer-go-live/RUNBOOK.md`), which must exist before any execution
task can reference it.

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---|---|---|
| V2 Authentication | No | This phase touches no authentication code path |
| V3 Session Management | No | Unaffected |
| V4 Access Control | Yes | The flag flip and migration-apply steps must run only via `service_role`/CLI-authenticated access, matching every RPC in this milestone's `REVOKE EXECUTE ... FROM PUBLIC, anon, authenticated; GRANT ... TO service_role;` idiom (already shipped in the migrations this phase deploys, not new to this phase) |
| V5 Input Validation | Marginal | The smoke-test signup (Pattern 5) uses a fixed, operator-chosen literal email — no client-controlled input is involved in this phase's own steps |
| V6 Cryptography | No | No new crypto primitive; `SUPABASE_ACCESS_TOKEN`/`SUPABASE_SERVICE_ROLE_KEY` handling follows the existing secret-management convention (GitHub Actions secrets, `.env.local`, never committed) |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---|---|---|
| A partial/failed migration apply leaves production in a mixed schema state (e.g. `is_lifetime_premium` column added but `grant_premium_credits()` RPC creation fails mid-`db push`) | Tampering (data integrity) | Pattern 3's post-deploy confirmation checks each artifact independently rather than trusting one aggregate "success" signal; the RUNBOOK should halt and escalate if any one of the three checks fails, rather than proceeding |
| The flag flips before CGU/CGV are actually live (LEGAL-05/CRED-05 ordering violation) | Tampering (contractual/legal integrity, not a technical CIA property but a compliance-relevant ordering guarantee) | Pattern 6's explicit HTTP check gate, never inferred from ROADMAP/REQUIREMENTS.md status |
| The pre-existing `ALTER DEFAULT PRIVILEGES`-driven `anon`-executable gap on `is_coach_of()`/`redeem_invitation_code()`/`peek_invitation()` (STATE.md, confirmed live in production, out of scope for this phase) coexisting with this phase's own newly-deployed RPCs | Elevation of Privilege | Out of scope per STATE.md's explicit note and `06-CONTEXT.md`'s deferred-ideas section; not remediated by this phase; the migrations this phase deploys already use the correct three-role `REVOKE ... FROM PUBLIC, anon, authenticated` form (verified in each file read this session), so this phase does not *reproduce* the gap, it just does not fix the pre-existing one |
| A human operator running the `TRUNCATE` step (Pattern 5) after real visitor traffic has already begun, destroying genuine signups | Repudiation / Data loss | The RUNBOOK's explicit, prominent ordering warning (D-04) — this is a process control, not a technical one, since no application-level lock prevents a human from running the statement at the wrong time |

## Sources

### Primary (HIGH confidence — files/state read or inspected directly this session)
- `git status`, `git log --oneline main..HEAD`, `git log --oneline HEAD..main`, `git diff main --
  supabase/migrations/`, `git diff main -- .github/workflows/ci.yml`, `git merge-base` — all run
  directly against this worktree this session, establishing the 155-commits-ahead/0-behind branch
  state and confirming `ci.yml` is unchanged relative to `main`
- `.github/workflows/ci.yml` — full file, `migrate-supabase` job quoted verbatim
- `.github/workflows/test-rls.yml` — full file, confirms it targets a separate test project
- `supabase/migrations/20260812_waitlist_founder_offer.sql` — full file, every RPC signature and
  line range quoted verbatim
- `supabase/migrations/20260815_waitlist_retention_config.sql` — full file
- `supabase/migrations/20260816_premium_credit_flag.sql` — full file
- `supabase/migrations/20260816_premium_credit_grant.sql` — full file
- `scripts/purge-test-accounts/RUNBOOK.md` — full file, exact commands and structure this phase's
  RUNBOOK mirrors
- `apps/web/src/lib/supabase/admin.ts` — full file
- `apps/web/src/components/marketing/WaitlistRoleForm.tsx` (grep) — `track()` call and event-name
  constant
- `apps/web/src/app/sitemap.ts` (grep) — `/fondateurs` sitemap entry
- `apps/web/src/app/[locale]/(marketing)/{cgv,cgu,fondateurs}/` — route file existence confirmed via
  directory listing
- `backend/api/vercel.json` — full file, confirms the 8th cron entry (`premium-grant`) already
  present, unrelated to this phase but ruling out a stale assumption
- `command -v supabase` — confirmed CLI absent in this sandbox
- `.planning/workstreams/lien-invite/phases/06-founder-offer-go-live/06-CONTEXT.md` — full file, all
  locked decisions D-01 through D-06
- `.planning/workstreams/lien-invite/REQUIREMENTS.md` — full file, Traceability table
- `.planning/workstreams/lien-invite/STATE.md` — full file, unresolved-secrets precedent and the
  out-of-scope security gap
- `.planning/workstreams/lien-invite/ROADMAP.md` — full file, Phase 6 goal/success criteria and
  prior phases' completion dates
- `.planning/workstreams/lien-invite/research/ARCHITECTURE.md` — full file, Section 1 (superseded
  `TRUNCATE`/`ALTER SEQUENCE` sketch) and Section 7 (original "Phase F" build-order assumption)
- `.planning/workstreams/lien-invite/phases/04-credit-gate-alignment/04-RESEARCH.md` and
  `04-VALIDATION.md` — read in full as the style/structure precedent this file follows, and as the
  source of the already-verified JSONB-boolean pitfall reused in Pattern 7/Pitfall 3
- `.planning/config.json` — confirms `nyquist_validation: true`, no `security_enforcement: false`
  override

### Secondary (MEDIUM confidence)
- None — no web-sourced claims were needed; this is a pure in-repo/in-infrastructure verification
  task with no external ecosystem research surface.

### Tertiary (LOW confidence)
- None.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new libraries; every tool (Supabase CLI, existing purge scripts) already
  in production use, versions/absence confirmed directly this session
- Architecture: HIGH — the entire deploy/verify sequence is grounded in files and `git` state read
  this session, including the load-bearing "branch never merged" finding, which was independently
  derived from `git log`/`git diff`, not carried from CONTEXT.md's prose alone
- Pitfalls: HIGH for Pitfalls 1, 3, 4, 5 (directly grounded in verified file content/session state);
  MEDIUM for Pitfall 2 (the `HEAD~1 HEAD` multi-commit blind spot is a well-known GitHub Actions
  pattern and the YAML confirms the mechanism exists, but this session could not test it against a
  real multi-commit push to confirm the failure mode fires exactly as described — treat as a
  documented risk to design the merge/verification process around, not an observed production
  failure)

**Research date:** 2026-08-18
**Valid until:** 2026-08-25 (7 days — this research is tied to a specific, fast-moving git branch
state; the "155 commits ahead, 0 behind" finding will go stale the moment anyone pushes to either
branch, and the CI/migration state must be re-verified at RUNBOOK execution time regardless of how
much time has passed, per D-02's own "confirm, don't assume" framing)
