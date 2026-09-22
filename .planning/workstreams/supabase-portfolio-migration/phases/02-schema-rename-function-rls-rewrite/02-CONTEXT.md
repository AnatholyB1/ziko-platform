# Phase 2: Schema Rename & Function/RLS Rewrite - Context

**Gathered:** 2026-09-22
**Status:** Ready for planning

<domain>
## Phase Boundary

This phase builds a new migration series (never editing `ziko`'s historical migration files) that recreates every `ziko` schema object in `portfolio` under a `ziko_` prefix — schema-only, no data, no auth writes. In scope: ~99 tables, all `SECURITY DEFINER` functions/RPCs with table references rewritten, all 176 RLS policies re-created and verified enabled, and a scripted post-apply grep confirming zero stale unprefixed references in `pg_policies`/`pg_proc`. A full dry run on a scratch Supabase project must succeed before anything touches `portfolio`. Out of scope: attaching triggers to `portfolio`'s shared `auth.users` (Phase 3), any data copy (Phase 4), and storage bucket creation (Phase 5 — architecturally independent, runs in parallel).

</domain>

<decisions>
## Implementation Decisions

### Function/RPC Naming Scope
- **D-01:** All 37 ziko functions get the `ziko_` prefix defensively (e.g. `deduct_ai_credits` → `ziko_deduct_ai_credits`), not just tables — even though Phase 1's live inventory found zero name collisions with `portfolio`'s 5 existing functions today. This matches ARCHITECTURE.md's explicit anti-pattern warning (function/trigger names left unprefixed "because they're not tables") and protects against a future 4th tenant introducing a colliding generic name (`award_xp`, `is_coach_of`, `search_users_fuzzy`, etc. are all plausible collisions). This extends the ~758-call-site scripted rename (already covering table names) to also cover every `.rpc()` call site across `backend/api`, `apps/mobile`, `apps/web`, and the 19 plugin packages — same scripted mechanism, not manual editing.

### Auth-Users Trigger Sequencing
- **D-02:** Phase 2 creates the renamed `SECURITY DEFINER` functions for `handle_new_user`/`handle_new_user_credits` (as `ziko_handle_new_user`/`ziko_handle_new_user_credits` per D-01) but does **NOT** attach them as triggers on `portfolio`'s shared `auth.users` table. Trigger attachment is deferred to Phase 3, after Ziko-only signup scoping logic exists. Rationale: attaching now would fire spurious side effects for every `rh_*`/`gecko_*` signup between Phase 2 and Phase 3 (PITFALLS.md Pitfall 3 — silent cross-tenant corruption, not a visible error).

### Dry-Run Environment (SCHEMA-05)
- **D-03:** Satisfy the "full dry run on a scratch Supabase project" requirement with a **new throwaway Supabase project** under the same org (not local `supabase start`/Docker). Chosen for fidelity to the real target — same managed Postgres 17.6 build, same RLS/auth stack, same Supabase CLI dump/push path — over the zero-cost but lower-fidelity local option. Accept the setup time and small cost/quota footprint this adds.

### Extension Install Authorization (pg_net / unaccent)
- **D-04:** Phase 2 must grep `pg_proc.prosrc` across all 37 ziko function bodies for `net\.`/`unaccent(` calls (per Phase 1's D-02 escalation) to confirm whether `pg_net` and/or `unaccent` are actually required on `portfolio` before creating the renamed functions. **Pre-authorized:** if the grep confirms a real dependency, the plan may proceed directly to `CREATE EXTENSION IF NOT EXISTS pg_net;` / `CREATE EXTENSION IF NOT EXISTS unaccent;` on `portfolio` without a separate checkpoint — these are additive, non-destructive to `rh_*`/`gecko_*`'s existing extensions. No pre-authorization to install either extension if the grep does NOT confirm a dependency (do not install speculatively).

### Claude's Discretion
- Exact migration file naming/timestamp scheme for the new series (must follow the existing `YYYYMMDDHHMMSS_description.sql` convention seen in `supabase/migrations/`, appended after `portfolio`'s existing history — not `ziko`'s).
- Whether custom types/enums (if any exist in ziko's schema) get the same defensive `ziko_` prefix as functions — apply the same D-01 rationale consistently.
- Structure/format of the post-apply grep verification script and the per-table authenticated-query test suite (SCHEMA-04's exit gate) — left to planner/executor as long as it proves zero stale unprefixed references AND actual RLS behavior (not just "no error").

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase 1 inventory (authoritative live state — supersedes all research-phase estimates)
- `.planning/workstreams/supabase-portfolio-migration/phases/01-inventory-pre-flight-audit/01-INVENTORY.md` — full live table list (99), function list (37, with SECURITY DEFINER flags + args), RLS policy counts (176 ziko / 50 portfolio), trigger definitions (including the 2 unscoped `auth.users` triggers and the `X-Webhook-Secret`-embedded push triggers), extension diff (pg_net + unaccent ziko-only), zero function-name collisions with portfolio's 5 functions
- `.planning/workstreams/supabase-portfolio-migration/phases/01-inventory-pre-flight-audit/01-CONTEXT.md` — Phase 1's D-01/D-02/D-03 decisions this phase inherits (collision handling, version/extension mismatch handling, quota handling)

### Migration research (this workstream)
- `.planning/workstreams/supabase-portfolio-migration/research/SUMMARY.md` — 7-phase structure, dominant risks, recommended dump/rewrite/migrate approach
- `.planning/workstreams/supabase-portfolio-migration/research/STACK.md` — `supabase db dump`/`db push` tooling, session-mode connection requirement (never the 6543 transaction pooler)
- `.planning/workstreams/supabase-portfolio-migration/research/ARCHITECTURE.md` — text-level DDL prefix rewrite pattern (not `ALTER TABLE RENAME`), 758+ call-site rename surface, function/bucket defensive-prefixing anti-pattern (§111-113), 11-step build order
- `.planning/workstreams/supabase-portfolio-migration/research/PITFALLS.md` — Pitfall 2 (stale unprefixed references, silent RLS-deny failure mode) and Pitfall 3 (unscoped auth.users triggers firing cross-tenant) are this phase's primary risks
- `.planning/workstreams/supabase-portfolio-migration/research/FEATURES.md` — table-stakes vs. differentiator framing for the rename/RLS/dry-run steps

### Milestone-level docs
- `.planning/workstreams/supabase-portfolio-migration/REQUIREMENTS.md` — SCHEMA-01..05 map to this phase
- `.planning/workstreams/supabase-portfolio-migration/ROADMAP.md` — Phase 2 goal and 5 success criteria
- `C:\Users\Anatholy\.claude\projects\C--ziko-platform\memory\project_supabase_portfolio_migration.md` — cross-session decision record (ziko_ prefix, merged auth, milestone structure)

### Project docs
- `CLAUDE.md` — RLS pattern (`auth.uid() = user_id`), Supabase env var names, backend `.js` import rule (applies to any script tooling written for this phase), migration numbering convention

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- Supabase MCP tools (`mcp__claude_ai_Supabase__*`) — already used in Phase 1 for live inspection; same tools apply for Phase 2's post-apply verification (`execute_sql`, `list_tables`, `get_advisors`) and for creating the scratch project (`create_project`).
- Existing migration file naming convention in `supabase/migrations/` (`YYYYMMDDHHMMSS_description.sql`) — the new series should follow this pattern, timestamped after `portfolio`'s existing history.

### Established Patterns
- ziko's RLS pattern is `auth.uid() = user_id` on nearly every table (CLAUDE.md, confirmed project-wide by Phase 1's 100%-RLS-enabled finding) — the rewritten policies should preserve this pattern exactly, just against renamed tables.
- `supabase db dump` excludes `auth`/`storage` schemas by default — naturally scopes this phase's dump to just the ~99 application tables.

### Integration Points
- ~758 call sites (`.from()`/`.rpc()`) across `backend/api`, `apps/mobile`, `apps/web`, and 19 plugin packages reference these table/function names today — this phase's rename map is the input to that rewrite, but the actual call-site rewrite itself may be scoped to this phase or deferred to Phase 6 cutover (planner to confirm against ROADMAP's phase boundary — Phase 2's success criteria are about the `portfolio`-side objects, not the app-side call sites).
- `packages/coach-sdk` needs zero changes (schemas/types only, no queries) — confirmed by research, no action needed here.

</code_context>

<specifics>
## Specific Ideas

No specific implementation ideas beyond the decisions above — user deferred implementation-mechanics choices ("You decide" was never selected; all 4 areas got explicit decisions) to the locked D-01 through D-04 above.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope. (Storage bucket prefixing was raised only as research context, not proposed as in-scope for this phase — it correctly belongs to Phase 5 per ROADMAP.md.)

</deferred>

---

*Phase: 2-Schema Rename & Function/RLS Rewrite*
*Context gathered: 2026-09-22*
