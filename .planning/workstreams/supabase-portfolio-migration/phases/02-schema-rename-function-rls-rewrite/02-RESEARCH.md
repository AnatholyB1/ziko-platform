# Phase 2: Schema Rename & Function/RLS Rewrite - Research

**Researched:** 2026-09-22
**Domain:** Supabase/Postgres DDL text-rewrite tooling, `SECURITY DEFINER` function/trigger reconstruction, RLS re-verification, Vercel-Marketplace-managed Supabase project provisioning
**Confidence:** MEDIUM-HIGH — mechanics for dump/rewrite/verify are HIGH confidence (official docs + direct repo inspection of ziko's actual function/trigger bodies); the scratch-project provisioning mechanics are HIGH confidence but surface a **blocking correction** to D-03's assumed CLI/MCP workflow (see Pitfall 1 below); the DDL-rewrite tooling choice is MEDIUM confidence (no first-party Supabase tool exists for this).

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**D-01 — Function/RPC Naming Scope:** All 37 ziko functions get the `ziko_` prefix defensively (e.g. `deduct_ai_credits` → `ziko_deduct_ai_credits`), not just tables — even though Phase 1's live inventory found zero name collisions with `portfolio`'s 5 existing functions today. This matches ARCHITECTURE.md's explicit anti-pattern warning (function/trigger names left unprefixed "because they're not tables") and protects against a future 4th tenant introducing a colliding generic name (`award_xp`, `is_coach_of`, `search_users_fuzzy`, etc. are all plausible collisions). This extends the ~758-call-site scripted rename (already covering table names) to also cover every `.rpc()` call site across `backend/api`, `apps/mobile`, `apps/web`, and the 19 plugin packages — same scripted mechanism, not manual editing.

**D-02 — Auth-Users Trigger Sequencing:** Phase 2 creates the renamed `SECURITY DEFINER` functions for `handle_new_user`/`handle_new_user_credits` (as `ziko_handle_new_user`/`ziko_handle_new_user_credits` per D-01) but does **NOT** attach them as triggers on `portfolio`'s shared `auth.users` table. Trigger attachment is deferred to Phase 3, after Ziko-only signup scoping logic exists. Rationale: attaching now would fire spurious side effects for every `rh_*`/`gecko_*` signup between Phase 2 and Phase 3 (PITFALLS.md Pitfall 3 — silent cross-tenant corruption, not a visible error).

**D-03 — Dry-Run Environment (SCHEMA-05):** Satisfy the "full dry run on a scratch Supabase project" requirement with a **new throwaway Supabase project** under the same org (not local `supabase start`/Docker). Chosen for fidelity to the real target — same managed Postgres 17.6 build, same RLS/auth stack, same Supabase CLI dump/push path — over the zero-cost but lower-fidelity local option. Accept the setup time and small cost/quota footprint this adds.

**D-04 — Extension Install Authorization (pg_net / unaccent):** Phase 2 must grep `pg_proc.prosrc` across all 37 ziko function bodies for `net\.`/`unaccent(` calls (per Phase 1's D-02 escalation) to confirm whether `pg_net` and/or `unaccent` are actually required on `portfolio` before creating the renamed functions. **Pre-authorized:** if the grep confirms a real dependency, the plan may proceed directly to `CREATE EXTENSION IF NOT EXISTS pg_net;` / `CREATE EXTENSION IF NOT EXISTS unaccent;` on `portfolio` without a separate checkpoint — these are additive, non-destructive to `rh_*`/`gecko_*`'s existing extensions. No pre-authorization to install either extension if the grep does NOT confirm a dependency (do not install speculatively).

### Claude's Discretion
- Exact migration file naming/timestamp scheme for the new series (must follow the existing `YYYYMMDDHHMMSS_description.sql` convention seen in `supabase/migrations/`, appended after `portfolio`'s existing history — not `ziko`'s).
- Whether custom types/enums (if any exist in ziko's schema) get the same defensive `ziko_` prefix as functions — apply the same D-01 rationale consistently.
- Structure/format of the post-apply grep verification script and the per-table authenticated-query test suite (SCHEMA-04's exit gate) — left to planner/executor as long as it proves zero stale unprefixed references AND actual RLS behavior (not just "no error").

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope. (Storage bucket prefixing was raised only as research context, not proposed as in-scope for this phase — it correctly belongs to Phase 5 per ROADMAP.md.)
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| SCHEMA-01 | New migration series (never editing ziko's history) with all tables prefixed `ziko_` | See "DDL Prefix-Rewrite Mechanics" and "Migration File Naming/Ordering" — `supabase db dump --linked --schema public` scoped to `ziko`, text/AST rewrite, applied as a fresh, monotonically-later-timestamped migration to `portfolio` |
| SCHEMA-02 | All `SECURITY DEFINER` functions/RPCs re-created with table references rewritten | See "Real Function Bodies (verified from repo)" and "DDL Prefix-Rewrite Mechanics" — concrete before/after for `handle_new_user`, `handle_new_user_credits`, `is_coach_of`; GRANT/REVOKE statement rewrite gap flagged in Pitfall 4 |
| SCHEMA-03 | All RLS policies re-created and verified enabled on ~93 `ziko_*` tables | See "RLS Verification Approach" — `pg_policies`/`pg_class.relrowsecurity` queries + per-table authenticated-query smoke test pattern |
| SCHEMA-04 | Automated grep confirming zero unprefixed table-name references in `pg_policies`/`pg_proc` | See "RLS Verification Approach" — concrete SQL, extended per Pitfall 3 to also cover `pg_trigger`/`pg_get_triggerdef()` (not just `pg_proc.prosrc`) |
| SCHEMA-05 | Full dry run on scratch Supabase project before applying to `portfolio` | See "Scratch Project Creation and Dry-Run Mechanics" — **Pitfall 1 is a blocking correction to D-03's assumed CLI/MCP mechanics**: `portfolio`'s org is Vercel-Marketplace-managed, and Supabase's own docs state project creation for such orgs is Vercel-dashboard-only |

## Summary

This phase is a mechanical-but-high-surface-area DDL rewrite: dump `ziko`'s live `public` schema (99 tables, 37 functions, 176 RLS policies, 18 non-`auth.users` triggers, 1 custom enum type), prefix every object name with `ziko_`, and apply the result as a **new** migration series to `portfolio` — schema only, no data, no `auth.users` trigger attachment. The single biggest correction this research makes to the phase's stated mechanics (D-03) is that `portfolio` lives in a **Vercel Marketplace-managed** Supabase organization (`vercel_icfg_y5brWcl0o23xn4A50p4NAUFG`, confirmed in Phase 1's INV-05), and Supabase's own documentation states plainly that for such organizations **"Projects can only be created via the Vercel dashboard"** — `supabase projects create` (CLI) and the equivalent MCP `create_project` tool will not work for the scratch project. This must become a `checkpoint:human-verify`/manual task in the plan, not a scripted step.

The DDL rewrite itself has no first-party Supabase tool. The three research files already on disk (STACK.md, ARCHITECTURE.md, PITFALLS.md) converge on the same guidance: rewrite the dump text **before** executing it, not via post-hoc `ALTER TABLE RENAME` (which does not touch table names embedded as literal identifiers inside `SECURITY DEFINER` function bodies, RLS `USING`/`WITH CHECK` clauses, or `GRANT`/`REVOKE ON FUNCTION` statements). This research verified that guidance directly against three real ziko function bodies (`handle_new_user`, `handle_new_user_credits`, `is_coach_of`) and found the pattern holds — and found one additional rewrite-target class not previously flagged: `REVOKE`/`GRANT EXECUTE ON FUNCTION public.<name>(...)` statements, which reference full function signatures as literal text and must be rewritten in the same pass as `CREATE FUNCTION`.

D-04's two-extension question is now resolved by direct evidence, not just methodology: a grep of the migration files (not just live `pg_proc`, but the same text) confirms `unaccent(` is called directly inside `search_users_fuzzy`'s body — `unaccent` **is** a real, confirmed dependency, pre-authorized for `CREATE EXTENSION IF NOT EXISTS unaccent;` per D-04. `pg_net` is a different story: no ziko function body calls `net.*` directly (grep returns zero), **but** two triggers (`push_user_xp_level_up`, `push_workout_session_end`) call `supabase_functions.http_request(...)`, and Supabase's own docs confirm this convenience function depends on `pg_net` being enabled on the project. Since D-04's grep methodology is scoped to `pg_proc.prosrc` only, it will not catch this — the grep must be extended to also cover `pg_trigger`/`pg_get_triggerdef()` output, or the `pg_net` requirement will be silently missed.

**Primary recommendation:** Dump `ziko`'s live schema with `supabase db dump --linked --schema public -f ziko-schema.sql`, run it through a small Node rewrite script that (a) uses an AST-based Postgres parser for the outer DDL structure (`CREATE TABLE`/`ALTER TABLE`/`CREATE POLICY`/`CREATE TRIGGER`/`REFERENCES`/`GRANT`/`REVOKE`) to rename `RangeVar`/`relname` nodes reliably, and (b) applies the same generated rename map as a word-boundary-anchored regex pass over each function body's `$$...$$` text (which the outer parser treats as an opaque string and cannot rewrite). Verify with a live `pg_policies`/`pg_proc`/`pg_trigger` grep for stale unprefixed names, then a per-table authenticated-query smoke test, all run first against a **manually-provisioned** (Vercel-dashboard) scratch project before `portfolio`.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Table/index/constraint/sequence renaming | Database/Storage | — | Pure DDL, no application-layer involvement in this phase |
| `SECURITY DEFINER` function/RPC rewrite | Database/Storage | — | Function bodies execute entirely inside Postgres; `.rpc()` call-site rewrite is explicitly out of this phase's success criteria per CONTEXT.md (deferred to cutover/Phase 6 per the phase boundary note) |
| RLS policy re-creation | Database/Storage | — | `USING`/`WITH CHECK` clauses are pure SQL predicates evaluated by Postgres |
| Trigger re-creation (18 `public`-schema, non-`auth.users`) | Database/Storage | — | Same as functions; two of these (`push_user_xp_level_up`, `push_workout_session_end`) also touch the `pg_net`-dependent `supabase_functions` schema, still DB-tier |
| Extension installation (`pg_net`, `unaccent`) | Database/Storage | — | `CREATE EXTENSION` is DB-tier; the *decision* of whether to install is informed by DB-tier introspection (function/trigger body grep) |
| DDL rewrite tooling (rename-map generation, AST rewrite script) | Ops/Migration Tooling | — | Not a browser/frontend-server/API-tier concern; a one-off Node script under `scripts/`, analogous to existing precedent (`scripts/csv-to-seed.js`, `scripts/founder-offer-go-live/`) |
| Scratch project provisioning | Ops/Migration Tooling | — | Vercel dashboard / Supabase CLI project-management surface, outside the four application tiers entirely |
| Post-apply verification (grep + smoke test script) | Ops/Migration Tooling | Database/Storage | Script lives outside the app tiers but issues queries directly against the DB tier |

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Supabase CLI | 2.116.0 installed locally; 2.117.0 latest available `[VERIFIED: npm registry / npx supabase --version]` | `db dump --linked --schema public` for schema-only extraction from `ziko`; `db push`/`psql` to apply the rewritten SQL to `portfolio` and the scratch project | Official tool, version-matched `pg_dump`/`psql` wrapper; confirmed excludes `auth`/`storage`/extension schemas by default (`[CITED: supabase.com/docs/reference/cli/supabase-db-dump]`), which conveniently scopes the dump to just the ~99 app tables with zero flag tuning |
| Node.js | 20 (matches repo CI/Vercel) `[CITED: CLAUDE.md]` | Runs the rewrite/grep/verification scripts | Matches the repo's existing ops-script convention (`scripts/*.js`) |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `pgsql-parser` | 18.2.8 `[ASSUMED — discovered via WebSearch, npm registry existence confirmed, slopcheck OK]` | AST-based parse/deparse of the top-level DDL dump (`CREATE TABLE`, `ALTER TABLE`, `CREATE POLICY`, `CREATE TRIGGER`, `REFERENCES`) built on the real `libpg_query` (Postgres's own parser, wrapped) — modify `RangeVar.relname`/`.schemaname` nodes then deparse back to SQL, avoiding regex partial-match risk (e.g. `user_profiles` incorrectly matching inside `coach_user_profiles_view`) | Primary rewrite pass for everything **outside** a function's `$$...$$` body — table/policy/trigger DDL where identifiers are proper AST nodes, not opaque text |
| `libpg-query` | 18.1.5 `[ASSUMED — same provenance as above]` | Underlying native binding `pgsql-parser` depends on | Transitive dependency only — do not call directly unless `pgsql-parser`'s higher-level API is insufficient |
| Plain word-boundary regex (no library) | n/a | Rewrite table/function names **inside** each `$$...$$` plpgsql/SQL function body, since the outer AST parser treats the dollar-quoted body as an opaque string literal, not as nested SQL | Apply the *same* rename map generated from the AST pass, anchored with `\b` and schema-qualification awareness (`public\.<name>\b` and bare `\b<name>\b` only where a known SQL keyword — `FROM`, `JOIN`, `INTO`, `UPDATE`, `TABLE`, `REFERENCES`, `EXISTS \( SELECT .* FROM` — immediately precedes it) to avoid renaming an unrelated identifier that happens to share a substring |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `pgsql-parser` (AST-based rewrite for outer DDL) | Pure regex/text find-replace across the entire dump (STACK.md's originally-recommended baseline) | Regex-only is simpler (zero new dependency) and is what STACK.md/ARCHITECTURE.md already validated as the minimum viable approach — acceptable if the executor writes careful word-boundary + context-aware regex and treats the post-apply `pg_policies`/`pg_proc`/`pg_trigger` grep as the real safety net (which this phase already requires per SCHEMA-04 regardless of rewrite method). AST parsing reduces risk but is not strictly required if the grep-based verification gate is trusted to catch misses. |
| `pgsql-parser` | `pgsql-ast-parser` (pure-JS, not `libpg_query`-backed) | `pgsql-ast-parser`'s own docs describe it as "yet another simple Postgres SQL parser" — lower fidelity to actual Postgres grammar than `libpg_query`-backed tools; more likely to choke on Supabase-specific/plpgsql-heavy DDL. Prefer `pgsql-parser` if an AST tool is used at all. |
| New Vercel-dashboard-provisioned scratch project (D-03, same org) | Local `supabase start` (Docker) | Already rejected by D-03 for fidelity reasons — noted here only because the scratch-project mechanics finding below (Pitfall 1) makes the local option meaningfully cheaper to fall back to if Vercel-dashboard provisioning proves too slow/blocked for the team; re-confirm D-03 still holds once the CLI-creation limitation is understood, rather than assuming it away |

**Installation:**
```bash
npx supabase@latest --version   # confirm CLI version before starting (2.117.0+ available)
npm install --no-save --prefix scripts/portfolio-migration pgsql-parser
```

**Version verification:** `npm view pgsql-parser version` → `18.2.8` (published 2018, actively maintained fork lineage under `constructive-io/pgsql-parser`); `npm view libpg-query version` → `18.1.5`. Both confirmed present on the npm registry via direct `npm view` this session — `[ASSUMED]` provenance tag applies per the package-name-provenance rule (discovered via WebSearch, not official docs/Context7), despite registry existence and a clean `slopcheck` verdict.

## Package Legitimacy Audit

| Package | Registry | Age | Downloads | Source Repo | slopcheck | Disposition |
|---------|----------|-----|-----------|-------------|-----------|-------------|
| `pgsql-parser` | npm | first published 2018-08-07 | not independently checked (`npm view` did not query weekly downloads this session) | `github.com/launchql/pgsql-parser` / `github.com/pyramation/pgsql-parser` (constructive-io org) | OK | Approved — flagged `[ASSUMED]`, planner must gate behind `checkpoint:human-verify` before first install per provenance rule |
| `libpg-query` | npm | first published 2021-03-19 | not independently checked | `github.com/launchql/libpg-query-node` (transitive dep of `pgsql-parser`) | OK | Approved — same gating as above |
| `pgsql-ast-parser` | npm | first published 2020-11-10 | not independently checked | `github.com/oguimbal/pgsql-ast-parser` | OK | Not recommended as primary (pure-JS parser, lower grammar fidelity) — listed only as a documented alternative, not installed |

**Packages removed due to slopcheck `[SLOP]` verdict:** none.
**Packages flagged as suspicious `[SUS]`:** none — all three returned `[OK]` when checked via `slopcheck install <pkgs>` this session (installation itself did not complete due to a local Windows subprocess/`npm.cmd` resolution issue in this sandbox, unrelated to package legitimacy — the registry-existence and safety check step completed and returned clean verdicts for all three before that unrelated failure).

**Provenance note:** Per the package-name-provenance rule, `pgsql-parser`/`libpg-query`/`pgsql-ast-parser` are tagged `[ASSUMED]`, not `[VERIFIED]`, because they were discovered via WebSearch rather than Context7/official docs, even though `npm view` and `slopcheck` both confirm they are real, established, non-malicious packages. **The planner should gate the first install behind a `checkpoint:human-verify` task**, or — simpler — treat the AST-parser approach as optional (per "Alternatives Considered" above) and default to the zero-dependency regex approach that STACK.md/ARCHITECTURE.md already validated, reserving `pgsql-parser` for if/when the executor finds the regex approach insufficiently robust for a specific edge case.

## Architecture Patterns

### System Architecture Diagram

```
 ziko (live, 99 tables / 37 fns / 176 policies / 18 triggers / 1 enum)
        │
        │ 1. supabase db dump --linked --schema public -f ziko-schema.sql
        │    (excludes auth/storage/extension schemas by default)
        ▼
 ┌─────────────────────────────────────────────────────────────┐
 │  Rename-map generation (from live information_schema, not    │
 │  migration files — confirms current reality, e.g. drops any  │
 │  table/type present in migration history but already deleted │
 │  live, per the shopping_list_items finding below)             │
 └───────────────────────┬───────────────────────────────────────┘
                          ▼
 ┌─────────────────────────────────────────────────────────────┐
 │  DDL rewrite pass (scripts/portfolio-migration/rewrite.js)   │
 │   (a) AST pass: CREATE TABLE / ALTER TABLE / CREATE POLICY /  │
 │       CREATE TRIGGER / REFERENCES / GRANT / REVOKE            │
 │   (b) regex pass, same map, scoped to each $$...$$ fn body    │
 └───────────────────────┬───────────────────────────────────────┘
                          ▼
              new migration file(s), timestamped
              after portfolio's existing history
                          │
        ┌─────────────────┴──────────────────┐
        ▼                                     ▼
 scratch project (dry run)              portfolio (real target)
 — MUST be provisioned via              — applied only after scratch
   Vercel dashboard, NOT CLI/MCP          dry run passes verification
   (Pitfall 1)                            in full
        │                                     │
        ▼                                     ▼
 Verification gate (SCHEMA-04/03):     Same verification gate re-run
 pg_policies/pg_proc/pg_trigger grep   against portfolio before phase
 for stale unprefixed names, then      is declared complete
 per-table authenticated smoke test
```

### Recommended Project Structure
```
scripts/portfolio-migration/
├── 01-generate-rename-map.sql     # live information_schema query → JSON map (tables, functions, types)
├── 02-dump-and-rewrite.js         # invokes `supabase db dump`, applies AST + regex rewrite
├── 03-verify-post-apply.sql       # pg_policies / pg_proc / pg_trigger stale-reference grep
├── 04-rls-smoke-test.js           # per-table authenticated-query test (owner vs non-owner)
└── rename-map.generated.json      # committed output of step 1, input to steps 2-4
```
This mirrors the existing `scripts/<task-name>/` convention already used in this repo (`scripts/founder-offer-go-live/`, `scripts/purge-test-accounts/`, `scripts/waitlist-erasure/`) — plain `.js`, no `backend/api/src/**` ESM `.js`-import-extension rule applies here since this directory is outside that path.

### Pattern 1: Generate the rename map from live `information_schema`, not migration files
**What:** A single JSON map `{ tables: {...}, functions: {...}, types: {...} }` built from a live query against `ziko`, not by parsing the 90 migration files.
**When:** Before any DDL rewrite.
**Why:** Migration files can reference objects that no longer exist live. Confirmed concretely in this repo: `supabase/migrations/023_shopping_list.sql` creates table `public.shopping_list_items` and enum type `public.shopping_item_source` — **neither appears in Phase 1's live 99-table inventory**, meaning it was dropped at some point outside a git-tracked migration (or a later migration not caught by a `shopping_list_items`/`shopping_item_source` name grep across all 90 files — confirmed only one file references either name). Building the rename map from `supabase db dump --linked` output (which reflects live reality) or a live `information_schema`/`pg_type` query naturally avoids resurrecting this dead object; building it from migration-file parsing would not.

### Pattern 2: Two-pass rewrite — AST for DDL structure, regex for function-body text
**What:** Use `pgsql-parser` (or careful regex, per Alternatives Considered) to rewrite `CREATE TABLE`/`ALTER TABLE`/`CREATE POLICY`/`CREATE TRIGGER`/`REFERENCES`/`GRANT`/`REVOKE` statements structurally, then apply the same rename map as word-boundary regex to the text *inside* each function's `$$...$$` body.
**When:** Every function/trigger in this schema — confirmed pattern via 3 real bodies read directly from this repo (see Code Examples below).
**Why:** `libpg_query`-based AST parsers parse the *outer* SQL statement correctly (so `CREATE OR REPLACE FUNCTION public.is_coach_of(...)` and its `LANGUAGE sql`/`SECURITY DEFINER` clauses are proper AST nodes), but the dollar-quoted body (`AS $$ ... $$`) is a single opaque string literal to that parser — it does not parse nested plpgsql/SQL inside the body. That inner text still needs the regex pass. Both passes must use the **same** generated map (Pattern 1) so a table renamed one way in `CREATE TABLE` is renamed identically inside every function body and policy clause that references it.

### Pattern 3: Extend the D-04 dependency grep beyond `pg_proc.prosrc` to also cover trigger definitions
**What:** `SELECT proname, prosrc FROM pg_proc WHERE prosrc ~* '\bnet\.'` (D-04's literal instruction) plus a second query: `SELECT tgname, pg_get_triggerdef(oid) FROM pg_trigger WHERE pg_get_triggerdef(oid) ~* 'supabase_functions\.http_request|net\.'`.
**When:** Before deciding whether to install `pg_net` on `portfolio`.
**Why:** Confirmed by direct repo grep this session: zero ziko function bodies call `net.*` directly (the `prosrc`-only grep would return 0 hits, appearing to say "no pg_net dependency"). But two triggers — `push_user_xp_level_up`, `push_workout_session_end` — call `supabase_functions.http_request(...)`, and Supabase's own docs (`[CITED: supabase.com/docs/guides/database/webhooks]`) confirm this convenience function requires `pg_net` to be enabled on the project. A `pg_proc`-only grep silently misses this. **Concrete finding for this phase: `pg_net` IS required**, but via trigger definitions, not function bodies — the grep in D-04 must be widened or it will produce a false "not needed" verdict.

### Anti-Patterns to Avoid
- **Post-hoc `ALTER TABLE ... RENAME`:** Confirmed against 3 real ziko function bodies this session — none of them would have their internal table references rewritten by this approach, since Postgres resolves identifiers by name inside plpgsql bodies at each execution, not by OID. Already correctly flagged by ARCHITECTURE.md/STACK.md; this research adds concrete proof via the actual `handle_new_user`/`handle_new_user_credits`/`is_coach_of` bodies (see Code Examples).
- **Regex rewrite that only targets `CREATE FUNCTION`/`CREATE TABLE`, skipping `GRANT`/`REVOKE`:** Confirmed via repo grep — migration `20260813182644_waitlist_founder_offer.sql` contains `REVOKE EXECUTE ON FUNCTION public.normalize_waitlist_email(TEXT) FROM PUBLIC, anon, authenticated;` and a matching `GRANT ... TO service_role;` — these embed the full function name+signature as literal text and are trivially missed by a rewrite pass that only looks for `CREATE FUNCTION`/`CREATE TABLE` keywords.
- **Assuming `supabase projects create`/MCP `create_project` works for the scratch project because it "worked in general Supabase docs":** See Pitfall 1 — this specific org is Vercel-Marketplace-managed, which is a documented, blocking exception.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Parsing/rewriting Postgres DDL identifiers | A hand-rolled regex-only engine trying to distinguish `CREATE TABLE user_profiles` from `CREATE TABLE coach_user_profiles_view` by ad hoc lookahead | `pgsql-parser` (libpg_query-backed) for the outer-statement pass, regex only for function-body text (Pattern 2) | libpg_query is Postgres's own parser compiled to a library — it cannot misparse valid Postgres DDL the way a regex heuristic can; reserves hand-written regex for the one place (dollar-quoted bodies) where it's unavoidable |
| Verifying RLS actually restricts access (not just "policy exists") | A custom row-count diffing framework | The existing pattern from `backend/api/test/rls/*.spec.ts` (17 files already encode "authenticated non-owner sees 0 rows, owner sees >0 rows" assertions) — reuse the *pattern*, not necessarily the *files themselves*, since those files reference unprefixed table names and `ziko`'s env vars (see Open Questions) | The repo already has 17 working examples of exactly the assertion style SCHEMA-03's exit gate needs; re-deriving this from scratch risks missing edge cases (e.g. `is_coach_of()`-gated policies) those files already cover |

**Key insight:** Every piece of "custom tooling" this phase needs (rename-map generator, DDL rewriter, verification grep) has no first-party Supabase equivalent — but each has either an npm library that solves the hard 80% (AST parsing) or an existing in-repo pattern to imitate (RLS test assertions), so "hand-rolled" here should mean "small glue script following an established pattern," not "novel parser from scratch."

## Common Pitfalls

### Pitfall 1: D-03's scratch-project mechanics are blocked by Vercel Marketplace org restrictions — CLI/MCP project creation will not work
**What goes wrong:** The plan (or a well-intentioned executor) runs `supabase projects create --org-id vercel_icfg_y5brWcl0o23xn4A50p4NAUFG ...` or the MCP `create_project` tool expecting it to provision the scratch project inside the same org as `portfolio`, and it fails or is silently rejected.
**Why it happens:** Phase 1's INV-05 confirmed `portfolio`'s org (`vercel_icfg_y5brWcl0o23xn4A50p4NAUFG`) carries the `vercel_icfg_` prefix, meaning it is a **Vercel Marketplace-managed** organization, not a native Supabase org. Supabase's own documentation states directly, under Vercel Marketplace Limitations: **"Projects can only be created via the Vercel dashboard."** `[CITED: supabase.com/docs/guides/integrations/vercel-marketplace]` This is a hard, documented constraint — not a bug to work around.
**How to avoid:** Plan this as a manual/`checkpoint:human-verify` task: provision the scratch project via the Vercel dashboard (Storage/Integrations tab → the same Supabase-for-Vercel integration installation → "Create Database" or equivalent new-resource flow), then use the CLI (`supabase link --project-ref <scratch-ref>`) for every subsequent scripted step (dump/push/query) against it. Project **deletion** (teardown) is not documented as similarly restricted — `supabase projects delete <ref>` `[CITED: supabase.com/docs/reference/cli/supabase-projects-delete]` should work for teardown, but this was not independently confirmed for a Vercel-managed project this session; verify at execution time and fall back to the Vercel dashboard's remove-resource flow if the CLI command fails.
**Warning signs:** `supabase projects create` returns an org-not-found/permission error, or the MCP `create_project` tool errors when targeting this org id.

### Pitfall 2: `net.*` grep on `pg_proc.prosrc` alone (D-04's literal wording) misses the real `pg_net` dependency
**What goes wrong:** Running only `SELECT prosrc FROM pg_proc WHERE prosrc ~* 'net\.'` returns zero rows (confirmed this session via a migration-file-text equivalent grep), leading to a false conclusion that `pg_net` is not needed — then the two HTTP-calling triggers (`push_user_xp_level_up`, `push_workout_session_end`) are recreated on `portfolio` and silently fail at runtime (or fail loudly, but only in production traffic, not during schema apply) because `pg_net` isn't installed.
**Why it happens:** `supabase_functions.http_request(...)` is a Supabase-managed convenience wrapper invoked directly as a `CREATE TRIGGER ... EXECUTE FUNCTION supabase_functions.http_request(...)` argument list — it lives in trigger definitions (`pg_trigger`/`pg_get_triggerdef()`), not inside any `SECURITY DEFINER` function's `prosrc`. A grep scoped only to `pg_proc` structurally cannot see it.
**How to avoid:** Run both queries from Pattern 3 above. Treat `pg_net` as **confirmed required** based on the trigger-definition evidence already gathered in this research (not just Phase 2's own re-run of the grep) — `CREATE EXTENSION IF NOT EXISTS pg_net;` is pre-authorized per D-04 once a dependency is confirmed by any means, and this research already constitutes that confirmation.
**Warning signs:** The two push triggers apply cleanly (DDL succeeds) but fire silently with no observable HTTP call and no error in a runtime smoke test — this is a "looks done but isn't" failure mode, not a hard error, and is easy to miss until QA specifically checks a real push notification flow.

### Pitfall 3: `unaccent` — a confirmed, not merely hypothesized, dependency
**What goes wrong:** Treating D-04's `unaccent(` grep as a pending unknown when it is, in fact, already resolvable with high confidence from this repo alone.
**Why it happens / how to avoid:** Direct grep this session: `supabase/migrations/20260530200608_unaccent_user_search.sql` calls `unaccent(lower(p.name))` three times inside `search_users_fuzzy`'s body. This is the same text that will appear in live `pg_proc.prosrc` (barring the function having been redefined since). Phase 2 should treat this as a **near-certain positive** going into its own live verification, not a 50/50 unknown — `CREATE EXTENSION IF NOT EXISTS unaccent;` should be planned as an expected, not conditional, step (still gated on the live re-check per D-04's actual instruction, but the plan should not be surprised by a positive result).

### Pitfall 4: `GRANT`/`REVOKE ON FUNCTION` statements are a distinct rewrite target from `CREATE FUNCTION`
**What goes wrong:** A rewrite script that special-cases `CREATE (OR REPLACE) FUNCTION public.<name>` correctly but doesn't also scan for `GRANT`/`REVOKE ... ON FUNCTION public.<name>(<args>)` leaves stale unprefixed function references in these statements — which don't error (the unprefixed function may not exist post-rename, causing the `GRANT`/`REVOKE` itself to fail loudly at apply time, which is actually a *good* failure mode here) but is still a rewrite gap worth explicitly covering rather than discovering via trial-and-error apply failures.
**Why it happens:** `GRANT`/`REVOKE` statements are easy to overlook because they're typically clustered separately from the `CREATE FUNCTION` block they relate to (confirmed pattern in `20260813182644_waitlist_founder_offer.sql`, where the `REVOKE`/`GRANT` pair appears with an explanatory comment *before* the function definition it protects, not after).
**How to avoid:** Include `GRANT`/`REVOKE ON FUNCTION` in the AST-pass statement types (Pattern 2) or explicitly test the regex map against every `GRANT`/`REVOKE` line in the dump.
**Warning signs:** `psql`/`db push` errors with "function public.\<old-name\> does not exist" specifically inside a `GRANT`/`REVOKE` statement, not a `CREATE FUNCTION` statement — this is actually the *safe* failure mode (loud, at apply time) rather than the silent-RLS-deny failure mode PITFALLS.md warns about elsewhere.

### Pitfall 5: One orphaned migration-file object (`shopping_list_items` / `shopping_item_source`) must not be resurrected
**What goes wrong:** A rename-map generator that parses the 90 migration files (instead of live state) picks up `CREATE TYPE public.shopping_item_source AS ENUM (...)` and `CREATE TABLE public.shopping_list_items (...)` from `023_shopping_list.sql`, renames them to `ziko_shopping_item_source`/`ziko_shopping_list_items`, and creates them fresh on `portfolio` — objects that don't exist in live `ziko` today and shouldn't exist in `portfolio` either.
**Why it happens:** Migration files are a historical record, not current state — this specific table/type appears to have been dropped from `ziko` at some point without a corresponding tracked migration (confirmed: neither name appears anywhere outside `023_shopping_list.sql` across all 90 files, and neither appears in Phase 1's live 99-table inventory).
**How to avoid:** Generate the rename map from `supabase db dump --linked` output or a live `information_schema`/`pg_type` query (Pattern 1), never from migration-file parsing.

## Code Examples

### Real Function Bodies (verified from repo — `supabase/migrations/001_initial_schema.sql`, `026_ai_credits.sql`, `035_coach_invitations_links_rls.sql`)

```sql
-- Source: supabase/migrations/001_initial_schema.sql (lines 252-266)
-- BEFORE rewrite:
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_profiles (id, name)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email)
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
-- NOTE: this phase creates the renamed function below but does NOT emit the
-- following CREATE TRIGGER statement — that is Phase 3's responsibility per D-02.
-- CREATE TRIGGER on_auth_user_created
--   AFTER INSERT ON auth.users
--   FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- AFTER rewrite (this phase's output):
CREATE OR REPLACE FUNCTION public.ziko_handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.ziko_user_profiles (id, name)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email)
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
-- (no CREATE TRIGGER emitted here — Phase 3 attaches it)
```

```sql
-- Source: supabase/migrations/035_coach_invitations_links_rls.sql (lines 84-98)
-- BEFORE rewrite:
CREATE OR REPLACE FUNCTION public.is_coach_of(coach UUID, client UUID)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.coach_client_links
    WHERE coach_id = coach
      AND client_id = client
      AND revoked_at IS NULL
      AND (expires_at IS NULL OR expires_at > now())
  );
$$;

-- AFTER rewrite:
CREATE OR REPLACE FUNCTION public.ziko_is_coach_of(coach UUID, client UUID)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.ziko_coach_client_links
    WHERE coach_id = coach
      AND client_id = client
      AND revoked_at IS NULL
      AND (expires_at IS NULL OR expires_at > now())
  );
$$;
```

### D-04 Dependency Grep (extended per Pitfall 2/3)

```sql
-- Function-body grep (D-04's literal instruction — run against live ziko)
SELECT p.proname, p.prosrc
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND (p.prosrc ~* '\bnet\.' OR p.prosrc ~* '\bunaccent\s*\(');

-- Trigger-definition grep (REQUIRED EXTENSION — not in D-04's literal wording,
-- but necessary per Pitfall 2/Pattern 3 to catch supabase_functions.http_request)
SELECT t.tgname, pg_get_triggerdef(t.oid) AS def
FROM pg_trigger t
JOIN pg_class c ON c.oid = t.tgrelid
WHERE NOT t.tgisinternal
  AND pg_get_triggerdef(t.oid) ~* 'supabase_functions\.http_request|\bnet\.';
```

### SCHEMA-04 Post-Apply Stale-Reference Grep (run against the scratch project, then `portfolio`)

```sql
-- 1. RLS policies referencing an unprefixed table name in USING/WITH CHECK
SELECT schemaname, tablename, policyname, qual, with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename LIKE 'ziko_%'
  AND (
    qual ~* '\y(user_profiles|coach_client_links|workout_programs|session_sets|ai_credit_transactions)\y' -- extend with full 99-table list from the generated rename map, excluding any ziko_-prefixed match
    OR with_check ~* '\y(user_profiles|coach_client_links|workout_programs|session_sets|ai_credit_transactions)\y'
  );

-- 2. Function bodies referencing an unprefixed table/function name
SELECT p.proname, p.prosrc
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname LIKE 'ziko_%'
  AND p.prosrc ~* '\y(user_profiles|deduct_ai_credits|is_coach_of|record_athlete_decision)\y'; -- full generated map, same exclusion logic

-- 3. RLS actually enabled on every ziko_* table
SELECT relname, relrowsecurity, relforcerowsecurity
FROM pg_class
WHERE relnamespace = 'public'::regnamespace
  AND relname LIKE 'ziko_%'
  AND relrowsecurity IS NOT TRUE;   -- expect 0 rows
```

Note: the generated rename map (Pattern 1) should drive the actual regex/pattern lists above programmatically — the inline examples here use a small illustrative subset, not the full 99-table/37-function list, which the executor's script must build from `rename-map.generated.json`.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|---------------|--------|
| Supabase CLI 2.116.0 (installed) | 2.117.0 (latest) `[VERIFIED: npx supabase --version, this session]` | Ongoing (weekly-ish CLI releases) | Minor — no functional impact expected on `db dump`/`db push` mechanics used here, but run `npx supabase@latest --version` before starting execution to pick up any interim fix |

**Deprecated/outdated:** None specific to this phase's mechanics found.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `pgsql-parser`/`libpg-query`/`pgsql-ast-parser` are legitimate, safe-to-install npm packages | Standard Stack, Package Legitimacy Audit | LOW — `npm view` + `slopcheck` both confirm registry existence and clean verdict; worst case is the AST-rewrite approach is simply not used and the plan falls back to the already-validated regex-only approach from STACK.md |
| A2 | `supabase projects delete <ref>` works for a Vercel-Marketplace-managed project without additional restriction | Pitfall 1 | MEDIUM — if wrong, scratch-project teardown also requires the Vercel dashboard; low-cost to verify at execution time (attempt CLI delete, fall back to dashboard on failure), no data-loss risk either way |
| A3 | `supabase_functions.http_request()` genuinely requires `pg_net` to be enabled (not just documented as "usually paired with") | Pitfall 2, Pattern 3 | LOW-MEDIUM — if the two push triggers work without `pg_net` for some Supabase-platform-internal reason, installing `pg_net` anyway is harmless (additive extension, pre-authorized by D-04 once any dependency is confirmed) — the risk is asymmetric in the safe direction |
| A4 | `shopping_list_items`/`shopping_item_source` were genuinely dropped from live `ziko` (not a Phase 1 inventory omission) | Pitfall 5 | LOW — either way, driving the rename map from live `information_schema`/`db dump` output (not migration files) avoids the resurrection risk regardless of *why* the object is absent from the live inventory |

**If this table is empty:** N/A — see entries above.

## Open Questions (RESOLVED)

1. **Does the phase's exit gate reuse `backend/api/test/rls`/`test/coach` as-is, or is a wholly separate verification script required?**
   - What we know: Those 17+ RLS spec files already encode the exact "owner sees >0 rows, non-owner sees 0 rows" assertion pattern SCHEMA-03's exit gate needs (Don't Hand-Roll section). CONTEXT.md's Integration Points section explicitly notes call-site rewrite (`.from()`/`.rpc()`) may be scoped to this phase or deferred to Phase 6 — "planner to confirm."
   - What's unclear: If call-site rewrite is deferred, `test/rls`/`test/coach` cannot run against the renamed scratch schema at all (they reference unprefixed table names and point at `ziko`'s env vars, not the scratch project's). This phase would then need a **new**, purpose-built verification script (per CONTEXT.md's "Claude's Discretion" note) rather than reusing the existing suite.
   - Recommendation: The planner should explicitly decide and record whether call-site rewrite is in-scope for Phase 2 (which would let `test:rls`/`test:coach` run for real against the scratch project with only env-var repointing) or out-of-scope (which means Phase 2 needs its own lightweight SQL-only verification script, per Code Examples above, and `test:rls`/`test:coach` only becomes a valid gate once Phase 6/cutover rewrites call sites). Given the phase's stated success criteria are DB-object-only, the latter (own SQL-only verification script) appears to be the better fit, but this is a scope call for the planner, not something this research can resolve unilaterally.
   - **RESOLVED:** Call-site (`.from()`/`.rpc()`) rewrite is out of scope for Phase 2 — Phase 2's success criteria are DB-object-only (schema, functions, RLS, extensions). Phase 2 uses its own purpose-built SQL-only verification scripts (`scripts/portfolio-migration/03-run-verify.mjs`, `04-rls-smoke-test.js`), not the existing `backend/api/test/rls`/`test/coach` suites. The existing suites remain valid future gates once the application call-site rewrite happens (see "Carried Forward for Roadmap" below — that rewrite currently has no owning phase).

2. **What is `portfolio`'s current maximum applied migration timestamp?**
   - What we know: `ziko`'s local migration history tops out at `20260902100200_record_athlete_decision_v2.sql`. The new series must sort after **`portfolio`'s** history, not ziko's (per Claude's Discretion note in CONTEXT.md), and this repo has zero visibility into `portfolio`'s migration file history (it was never developed from this repo).
   - What's unclear: The actual max version currently in `portfolio`'s `supabase_migrations.schema_migrations` table.
   - Recommendation: Query `SELECT version FROM supabase_migrations.schema_migrations ORDER BY version DESC LIMIT 1;` against `portfolio` as a first pre-flight step, but in practice, generating the new migration filename from the **current wall-clock timestamp at execution time** (`date -u +%Y%m%d%H%M%S`) trivially satisfies "sorts after any real historical migration" as long as no migration in either project's history is timestamped in the future relative to execution — a near-certain assumption for any real migration history. This is the simplest correct approach and avoids needing to query `portfolio` at all for this specific purpose.
   - **RESOLVED:** Use the execution-time wall-clock timestamp (`date -u +%Y%m%d%H%M%S`) for the new migration series filename, per the recommendation above. No pre-flight query against `portfolio`'s `supabase_migrations.schema_migrations` table is required.

## Carried Forward for Roadmap (Unowned Scope — Flag for Human)

**D-01's stated consequence has no owning phase yet.** D-01 (02-CONTEXT.md) extends the defensive `ziko_` function-prefixing decision to also cover "every `.rpc()` call site across `backend/api`, `apps/mobile`, `apps/web`, and the 19 plugin packages — same scripted mechanism [as the ~758-call-site table-name rename], not manual editing." Phase 2 correctly does **not** perform this rewrite — Phase 2's ROADMAP success criteria are 100% DB-object-scoped (schema/functions/RLS/extensions only), and the application-layer `.from()`/`.rpc()` call-site rewrite is an app-tier concern, not a DB-tier one (see Architectural Responsibility Map above).

However, a check of `ROADMAP.md` (Phase 6: Cutover, requirements `CUTOVER-01..05`) and `REQUIREMENTS.md` confirms **no phase in the roadmap currently claims ownership of this rewrite**. `CUTOVER-01..05` cover env-file/Vercel-var repointing, ordered backend→web→mobile bascule, regression verification, and CI/secrets repointing — none of them mention rewriting `.from()`/`.rpc()` call sites to use the new `ziko_`-prefixed table/function names.

**This is a flag for the human/roadmap owner, not a Phase 2 task.** The ~758-call-site rewrite (table names per the base migration rename map + function names per D-01) must be explicitly assigned to Phase 6 (Cutover) — where it logically belongs, since call sites can only be safely repointed once `portfolio` is the live target — or to a new dedicated phase before Phase 6's cutover work begins. Until an owning phase is assigned, D-01's full scope (defensive prefixing protecting against a future 4th-tenant collision) remains only half-realized: the DB objects will be `ziko_`-prefixed, but the application code will still reference the old unprefixed names until this rewrite happens.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Supabase CLI | `db dump`, `db push`, `link`, `projects delete` | ✓ | 2.116.0 (2.117.0 available) | Run `npx supabase@latest` for any single invocation if an update is warranted mid-execution |
| Node.js | Rewrite/verification scripts | ✓ | 20 (repo-pinned) | — |
| `pgsql-parser` / `libpg-query` | Optional AST-based DDL rewrite pass | ✗ (not yet installed; `npm install` attempt in this sandbox failed on an unrelated Windows subprocess issue, not package availability) | 18.2.8 / 18.1.5 on registry | Regex-only rewrite (already validated approach, zero new dependency) |
| Vercel dashboard access | Scratch project provisioning (Pitfall 1) | Not verifiable from this agent — requires human with Vercel account access to the org | — | None — this is a hard blocker if unavailable; must be a `checkpoint:human-verify` task, not scripted |

**Missing dependencies with no fallback:**
- Vercel dashboard access for scratch-project creation (Pitfall 1) — no CLI/MCP/API workaround exists per official docs.

**Missing dependencies with fallback:**
- `pgsql-parser`/`libpg-query` — fall back to the already-validated regex-only rewrite approach from STACK.md/ARCHITECTURE.md if the AST tooling is not installed or the executor prefers zero new dependencies.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | No existing framework directly applicable — this phase is DB-DDL-only; verification is SQL-query-based (see Code Examples), optionally wrapped in a Node/vitest runner for consistency with the repo's existing `backend/api` test conventions |
| Config file | none — see Wave 0 |
| Quick run command | `psql "<scratch-project-connection-string>" -f scripts/portfolio-migration/03-verify-post-apply.sql` |
| Full suite command | same file, run once against the scratch project (dry run) and again against `portfolio` (real apply) — this phase has no "unit vs integration" split, only "dry-run vs real" |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SCHEMA-01 | New migration applies cleanly, table count matches | integration (SQL) | `psql ... -f 03-verify-post-apply.sql` (table-count section) | ❌ Wave 0 |
| SCHEMA-02 | `SECURITY DEFINER` functions execute successfully against renamed tables | integration (SQL/manual RPC call) | `SELECT ziko_is_coach_of('<test-uuid>','<test-uuid>');` (and equivalents per function) | ❌ Wave 0 |
| SCHEMA-03 | RLS enabled + correct policies on all `ziko_*` tables | integration (SQL) | `03-verify-post-apply.sql` query 3 (relrowsecurity check) | ❌ Wave 0 |
| SCHEMA-04 | Zero unprefixed references in `pg_policies`/`pg_proc` | integration (SQL) | `03-verify-post-apply.sql` queries 1-2, extended per Pitfall 2/3 to `pg_trigger` | ❌ Wave 0 |
| SCHEMA-05 | Full dry run succeeds on scratch project before `portfolio` | manual-only (gate) | N/A — this is the phase's own top-level gate, not a single automated check; justified because it's a sequencing/process requirement ("did we do the scratch project first"), not a code behavior | — |

### Sampling Rate
- **Per task commit:** run the relevant individual query from `03-verify-post-apply.sql` after each object class is rewritten (tables → functions → policies → triggers)
- **Per wave merge:** full `03-verify-post-apply.sql` + `04-rls-smoke-test.js` against the scratch project
- **Phase gate:** Full verification suite green against the scratch project first, then re-run green against `portfolio`, before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `scripts/portfolio-migration/01-generate-rename-map.sql` — live `information_schema`/`pg_proc`/`pg_type` query, no existing equivalent
- [ ] `scripts/portfolio-migration/02-dump-and-rewrite.js` — DDL rewrite tooling, no existing equivalent
- [ ] `scripts/portfolio-migration/03-verify-post-apply.sql` — stale-reference + RLS-enabled grep, no existing equivalent (though modeled on PITFALLS.md's already-specified query shapes)
- [ ] `scripts/portfolio-migration/04-rls-smoke-test.js` — per-table authenticated-query smoke test; existing `backend/api/test/rls/*.spec.ts` demonstrates the assertion *pattern* but cannot be reused verbatim against unprefixed-table-name/`ziko`-pointed fixtures without the Open Question 1 scope decision being made first

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No | Phase does not touch `auth.users`/credentials (schema-only, no auth writes per phase boundary) |
| V3 Session Management | No | Same as above |
| V4 Access Control | Yes | RLS policies are the access-control mechanism being rewritten — the `USING`/`WITH CHECK` clause preservation exactness (Pattern 2) is the actual control; verified via the per-table authenticated-query smoke test, not just "policy exists" |
| V5 Input Validation | Yes (for the tooling itself, not app data) | The rewrite script's rename map is generated from live DB introspection, not free-text user input — no injection surface in normal operation, but the script must not interpolate identifiers unsafely if it ever accepts a CLI argument for e.g. a project ref (use `supabase link --project-ref <ref>`, never string-concatenate into a raw SQL/shell command) |
| V6 Cryptography | No | No password/secret handling in this phase — the redacted `X-Webhook-Secret` embedded in the two push triggers (flagged in Phase 1's INVENTORY.md) must be re-entered from a secure source (env var/secret store) when recreating those triggers, never copied from the git-committed, redacted inventory doc |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Silent RLS-deny masquerading as "empty data" (PITFALLS.md Pitfall 2) | Tampering / Information Disclosure (inverse — over-restriction, not leakage, but still a correctness/security-relevant failure) | Per-table authenticated-query smoke test (owner sees >0 rows, non-owner sees 0) as the actual verification gate, not "the migration applied without error" |
| Cross-tenant privilege via a same-named function/policy silently matching an `rh_*`/`gecko_*` object post-rename (ARCHITECTURE.md Anti-Pattern 2) | Elevation of Privilege | Defensive `ziko_` prefixing on all functions (D-01) and RLS verification against the full portfolio-shared namespace, not just ziko's own tables |
| Secret value re-exposure when recreating the two push triggers | Information Disclosure | Pull the `X-Webhook-Secret` value from a secret store/env var at migration-authoring time, never from the redacted `01-INVENTORY.md` file (which intentionally only shows `[REDACTED]`) |

## Sources

### Primary (HIGH confidence)
- `https://supabase.com/docs/guides/integrations/vercel-marketplace` — official, confirms "Projects can only be created via the Vercel dashboard" for Vercel Marketplace-managed orgs (Pitfall 1)
- `https://supabase.com/docs/reference/cli/supabase-projects-create` — official CLI reference, flag list
- `https://supabase.com/docs/reference/cli/supabase-projects-delete` — official CLI reference
- `https://supabase.com/docs/reference/cli/supabase-db-dump` — official CLI reference, schema exclusion behavior confirmed
- `https://supabase.com/docs/guides/database/webhooks` — official, confirms `supabase_functions.http_request`/Database Webhooks depend on `pg_net`
- Direct repository inspection this session: `supabase/migrations/001_initial_schema.sql`, `026_ai_credits.sql`, `035_coach_invitations_links_rls.sql`, `023_shopping_list.sql`, `20260530200608_unaccent_user_search.sql`, `20260813182644_waitlist_founder_offer.sql`; `backend/api/package.json` (`test:rls` script); `backend/api/test/rls/`, `backend/api/test/coach/` directory listings; `scripts/` directory listing (existing ops-tooling precedent)
- `.planning/workstreams/supabase-portfolio-migration/phases/01-inventory-pre-flight-audit/01-INVENTORY.md` — live table/function/trigger/RLS/extension counts, org-type confirmation
- `npx supabase --version` (this session) — confirms 2.116.0 installed, 2.117.0 latest
- `npm view pgsql-parser/libpg-query/pgsql-ast-parser` + `slopcheck install` (this session) — package legitimacy verification

### Secondary (MEDIUM confidence)
- WebSearch results on `pgsql-parser`/`libpg-query`/`pgsql-ast-parser`/`node-sql-parser` — corroborated by direct `npm view` this session, but package selection itself is `[ASSUMED]` per provenance rule
- Prior-phase research already on disk: `research/STACK.md`, `research/ARCHITECTURE.md`, `research/PITFALLS.md`, `research/SUMMARY.md`, `research/FEATURES.md` — reused per instructions, not re-derived; this document extends rather than repeats them

### Tertiary (LOW confidence)
- None — every finding in this document was either cross-checked against official docs, verified via direct repo inspection, or explicitly flagged `[ASSUMED]` in the Assumptions Log.

## Metadata

**Confidence breakdown:**
- Standard stack (CLI mechanics): HIGH — official docs + direct version check
- Standard stack (AST rewrite tooling choice): MEDIUM — no first-party tool exists, npm packages are `[ASSUMED]` provenance despite clean slopcheck
- Architecture (DDL rewrite patterns): HIGH — verified against 3 real ziko function bodies read directly from this repo, not hypothesized
- Pitfalls (Vercel Marketplace scratch-project restriction): HIGH — directly quoted from official Supabase docs, a genuine correction to D-03's assumed mechanics
- Pitfalls (pg_net trigger dependency): HIGH — confirmed via direct repo grep + official webhooks doc, resolves an ambiguity Phase 1 explicitly deferred to this phase

**Research date:** 2026-09-22
**Valid until:** 30 days (Supabase CLI/docs are stable; the org-type/Vercel-Marketplace restriction is a platform policy unlikely to change on this timeframe, but re-verify if execution slips significantly past this window)
