# Phase 1: Inventory & Pre-Flight Audit - Context

**Gathered:** 2026-09-22
**Status:** Ready for planning

<domain>
## Phase Boundary

This phase produces a live, authoritative inventory of both Supabase projects (`ziko` and `portfolio`) — tables, functions, RLS, triggers, storage buckets, extensions, Postgres version, and realtime publications — plus a pre-flight collision report (email/ID overlap between ziko's 39 users and portfolio's existing users) and a capacity/quota check on `portfolio`. Nothing else can be scoped (the `ziko_` rename map, collision handling, trigger scoping, extension reconciliation) until this phase's findings exist. This is read-only inspection — no schema, data, or auth changes happen in this phase.

</domain>

<decisions>
## Implementation Decisions

### Collision Handling Policy
- **D-01:** If an email collision is found between a ziko user and an existing portfolio user (rh_* or gecko_*), it is flagged in the collision report for manual resolution — never auto-merged or auto-suffixed. Resolution (contact user, verify same person, etc.) happens as a human decision before Phase 3 (Auth Merge) proceeds for that user.

### Version/Extension Mismatch Handling
- **D-02:** If Postgres version or extensions differ between `ziko` and `portfolio`, the audit documents the diff precisely (exact versions, exact extension list) without automatically upgrading/aligning `portfolio` (it's a shared project hosting other live apps — no speculative changes). Only escalate for a decision if the gap actually blocks something ziko's migrations need (e.g., a missing extension a ziko migration depends on).

### Quota Insufficiency Handling
- **D-03:** If the audit finds `portfolio` lacks capacity (DB size, connection limits, or storage quota) for ziko's data volume, report the exact deficit (e.g., "needs N more GB") and stop — do not upgrade `portfolio`'s Supabase plan automatically. The upgrade decision belongs to the user (billing implication).

### Audit Deliverable
- **D-04:** Produce a committed `INVENTORY.md` report in this phase's directory — not an ephemeral finding consumed only by Phase 2 planning. Given the migration ends in an irreversible deletion of `ziko`, a durable audit trail (live schema/auth/storage inventory of both projects, collision report, version/extension diff, quota check) is required for later verification and for the Phase 7 decommission checklist to reference back to.

### Claude's Discretion
- Exact format/structure of `INVENTORY.md` (tables vs. prose, level of detail per section) — left to the phase planner/executor, as long as it covers all 5 success criteria from ROADMAP.md Phase 1 (live ziko inventory, live portfolio inventory, collision report, version/extension diff, quota check).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Migration research (this workstream)
- `.planning/workstreams/supabase-portfolio-migration/research/SUMMARY.md` — synthesized migration approach, 7-phase structure, critical risks
- `.planning/workstreams/supabase-portfolio-migration/research/STACK.md` — dump/restore tooling, Admin API auth-merge mechanism, session-mode connection requirement
- `.planning/workstreams/supabase-portfolio-migration/research/ARCHITECTURE.md` — integration points, ~758 call-site rename surface, unscoped `auth.users` trigger risk, 11-step build order
- `.planning/workstreams/supabase-portfolio-migration/research/PITFALLS.md` — 8 critical pitfalls (auth collisions, RLS stale-name breakage, storage RLS, sequence collisions, extension mismatch, orphaned FKs, mobile split-brain, premature deletion)
- `.planning/workstreams/supabase-portfolio-migration/research/FEATURES.md` — table-stakes vs. safety-net steps, full dependency chain

### Milestone-level docs
- `.planning/workstreams/supabase-portfolio-migration/REQUIREMENTS.md` — 34 REQ-IDs, INV-01..05 map to this phase
- `.planning/workstreams/supabase-portfolio-migration/ROADMAP.md` — Phase 1 goal and success criteria
- `C:\Users\Anatholy\.claude\projects\C--ziko-platform\memory\project_supabase_portfolio_migration.md` — cross-session decision record (ziko_ prefix, merged auth, milestone structure)

### Project docs
- `CLAUDE.md` — Supabase env var names (`SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY`), RLS pattern, Storage bucket conventions
- `.planning/codebase/INTEGRATIONS.md` — existing Supabase integration points (if it references connection/client setup)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- Supabase MCP tools (`mcp__claude_ai_Supabase__*`) already proven in this session for live project inspection (`list_projects`, `list_tables`, `get_advisors`) — the natural tool for this phase's live inventory rather than dashboard-manual or CLI-only inspection.

### Established Patterns
- `ziko`'s RLS pattern is `auth.uid() = user_id` on nearly every table (per CLAUDE.md); the inventory should confirm this holds project-wide before Phase 2 assumes it.
- 90 migration files were found (ARCHITECTURE.md research) vs. the ~73 originally assumed — the live `information_schema` inventory in this phase is the authoritative source, not migration file counts.

### Integration Points
- `backend/api/src/middleware/auth.ts` — flagged by research as accepting any valid `portfolio` JWT with no tenant check; the inventory should confirm whether `portfolio`'s other apps (rh_*, gecko_*) have an equivalent gap, since Phase 6 will need to close this for Ziko.

</code_context>

<specifics>
## Specific Ideas

No specific implementation ideas beyond the decisions above — this phase is inspection/reporting, not building.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 1-Inventory & Pre-Flight Audit*
*Context gathered: 2026-09-22*
