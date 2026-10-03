# Phase 42: Decision-System Foundation - Context

**Gathered:** 2026-08-31
**Status:** Ready for planning

<domain>
## Phase Boundary

Every athlete gets a secure, bounded, server-validated coaching state and decision journal that all downstream v1.18 work (Phases 43-47) reads and writes against. This phase is pure backend/data-model foundation — no UI, no athlete-facing behavior, no tool registration, no consuming caller yet.

**In scope:**
- `athlete_state` table — compact, one row per athlete, current-state only (never a growing blob)
- `athlete_decisions` table — append-only journal, one row per AI-driven decision
- `record_athlete_decision()` SECURITY DEFINER RPC — the single write path for both tables
- RLS — SELECT-only for the owning athlete on both tables; no client write policy at all
- DB-level write lockdown (not just RLS) so even backend service-role code cannot bypass the RPC
- The bounded-context read *convention* (rolling summary + small recent window) — documented, not necessarily implemented as a callable function yet (see D-05)

**Out of scope (belongs to later phases):**
- Any tool registration (`assess_profile`, `create_goal`, `create_reward`, `create_program`) — Phases 43-45
- The actual weekly-review compaction logic that writes `rolling_summary` — Phase 44 (it happens as the last step of the weekly review job, per research/STACK.md)
- `athlete_state` as a 7th parallel context query / system-prompt injection — Phase 47 (OPS-01)
- `PluginManifest.minLevel` / `PluginLoader` gating — Phase 46
- Populating any real row — the first writer is Phase 43's onboarding tool; Phase 42 ships schema/RPC/RLS only, deliberately with zero rows

</domain>

<decisions>
## Implementation Decisions

### Readiness field (FOUND-01)

- **D-01:** `readiness` is a top-level `TEXT` column on `athlete_state`, not folded into `onboarding_profile` JSONB and not a numeric score. Mirrors the existing `status`/`track`-style column pattern in the drafted schema, and gives Phase 44's escalate/de-escalate logic (ENGINE-03) a first-class field to read and update.
- **D-02:** Enum values: `'fragile' | 'building' | 'ready'`, `CHECK` constraint, default `'fragile'`. Default is the most cautious state — fail-safe, consistent with the milestone's "eau seule pour un débutant fragile → escalade progressive" framing and GATE-03's fail-safe posture.

### Track column — cut (scope guardrail)

- **D-03:** The `track TEXT DEFAULT 'general'` column proposed in `research/ARCHITECTURE.md`'s draft schema is **cut entirely** from Phase 42's `athlete_state` table. It is not named in FOUND-01, and including it would quietly pre-build part of the RPG/factions/tracks layer that PROJECT.md and REQUIREMENTS.md explicitly defer to a future milestone (SEED-001). If a real need for a track/multi-domain axis emerges later, add it as a new migration then — same cost as adding it now, without the premature-scope risk.

### Rolling-summary budget & scope (FOUND-05, bounded-context discipline)

- **D-04:** Phase 42 ships the `rolling_summary TEXT` column on `athlete_state` plus a **documented read convention** in this phase's output (for downstream agents to follow): always read `rolling_summary` (compact prose) + the last N raw `athlete_decisions` rows verbatim; never replay the full journal. Phase 42 does **not** ship a callable `fetchAthleteContext()`/`fetchWeeklyReviewContext()` helper — there is no real decision data yet to exercise it against (first writer is Phase 43). That helper is built in Phase 44 (`coaching-engine/context.ts`), per `research/ARCHITECTURE.md`'s own build order.
- **D-05:** Exact numeric caps (rolling-summary token/char budget, N raw decisions kept verbatim) are **Claude's discretion** during Phase 42/44 research and planning — informed by `research/STACK.md`'s suggested starting point (~300-500 tokens, last 3-4 weekly reviews) and validated against a synthetic 12-month-tenure athlete before Phase 44 ships the compaction logic (this load-test is already flagged as a to-do in `research/SUMMARY.md`, Pitfall 5).

### Write-path lockdown strictness (FOUND-03, FOUND-04)

- **D-06:** Both `athlete_state` and `athlete_decisions` get **DB-level grant lockdown**, not just RLS + code convention: `REVOKE UPDATE` (on `athlete_state`) and `REVOKE INSERT` (on `athlete_decisions`) from both `authenticated` and `service_role`, so that `record_athlete_decision()` — a `SECURITY DEFINER` function owned by a privileged role — is the *only* code path capable of writing either table, even from backend code holding the service-role key. This makes Success Criterion 3 ("attempting to write from anywhere except the single server-side decision path fails") literally true at the database layer, not merely a convention enforced by code review. Matches this codebase's existing precedent of DB-level guarantees over trusting application code (`deduct_ai_credits`'s `SELECT FOR UPDATE`).
- **D-07:** This lockdown applies uniformly to both tables — there is no exception carved out for a future manual/admin correction tool. If an admin-correction path is needed later, it should call `record_athlete_decision()` too (e.g. with `source = 'manual_admin'`, already in the drafted `decision_type`/`source` enum), not bypass it.

### Claude's Discretion

- Exact `rolling_summary` token/char cap and exact N for the raw-decision window (D-05) — pick during Phase 42/44 research, validate against synthetic 12-month athlete data.
- Exact migration file names/timestamps, and whether `athlete_state`/`athlete_decisions` land in one migration file or split across two-plus-RPC files — follow existing repo convention (never edit an existing migration, always add new ones; `YYYYMMDDHHMMSS_description.sql` timestamp format matches the most recent 83 migrations in `supabase/migrations/`).
- `decision_type` / `source` CHECK-constraint enum membership — the drafted lists in `research/ARCHITECTURE.md` (`decision_type`: `onboarding_profile`, `weekly_focus`, `level_change`, `reward_grant`, `program_created`, `goal_created`; `source`: `weekly_review_cron`, `onboarding_tool`, `app_open_fallback`, `manual_admin`) are a reasonable starting point; adjust during planning if a Phase 43-47 need surfaces one not yet listed (a new migration can `ALTER` the `CHECK` later — not a blocking decision now).
- Whether `athlete_state`/`athlete_decisions` migrations are exercised by `backend/api/test/rls/` integration tests now (mirroring `coach-rls.spec.ts`) or deferred until a real caller exists in Phase 43 — this is a test-strategy call within Phase 42's existing `npm run test:rls` convention, not a product decision.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements & Roadmap

- `.planning/REQUIREMENTS.md` §Fondation — FOUND-01 through FOUND-05 acceptance criteria (the actual v1.18 requirements; note this file lives at the project root, not in the workstream directory)
- `.planning/workstreams/milestone-mobile/ROADMAP.md` §Phase 42 — phase goal, 5 success criteria, dependency notes for Phases 43-47
- `.planning/workstreams/milestone-mobile/STATE.md` — Key Decisions already locked project-wide (e.g., "model on the credits pair, not gamification"; "never deduct autonomous AI cost from athlete credits")

### Research (already answers most technical shape questions — read before re-deriving anything)

- `.planning/research/SUMMARY.md` — cross-stream synthesis, Pitfall 5/6 (unbounded journal growth), Phase 1 (=42) rationale
- `.planning/research/ARCHITECTURE.md` §(b) `athlete_state`/`athlete_decisions` shape, RLS, and system-prompt injection — full drafted `CREATE TABLE` statements and `record_athlete_decision()` RPC body (use as the starting point; apply D-01–D-07 changes: add `readiness`, remove `track`, add the REVOKE grants)
- `.planning/research/ARCHITECTURE.md` §(c) — feature-gating integration (Phase 46 concern, but explains why `level` is security-relevant and why `athlete_state` needed tighter RLS than the gamification precedent)
- `.planning/research/STACK.md` §(b) — decision-journal read/compaction pattern, rolling-summary token budget rationale, "write-before-compaction" convention, Anthropic prompt-caching note (relevant to Phase 44, not 42, but explains why the `rolling_summary` column exists)
- `.planning/research/PITFALLS.md` line ~133 — bounded recent-window guidance

### Existing Precedent (read before writing any migration/RPC)

- `supabase/migrations/026_ai_credits.sql` — the credits pair this schema is explicitly modeled on (current-balance table + ledger + `SECURITY DEFINER` RPC + partial unique index for idempotency)
- `supabase/migrations/007_gamification_schema.sql` — the looser precedent explicitly **not** to copy for RLS strictness (single `USING/WITH CHECK` policy with no command restriction)
- `backend/api/test/rls/coach-rls.spec.ts` — existing RLS integration test pattern to mirror if Phase 42 adds `athlete_state`/`athlete_decisions` RLS tests
- `backend/api/src/coach/ai/context.ts` — precedent for "each orchestrator surface gets its own context builder" (informs why Phase 42 does NOT build a shared context function yet — see D-04)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Patterns
- **Current-state + append-only-log pair:** already exists twice in this codebase (`user_gamification`/`xp_transactions` and `user_ai_credits`/`ai_credit_transactions`). `athlete_state`/`athlete_decisions` is a third instance of the same pattern — follow the credits pair's stricter RLS/RPC discipline, not the gamification pair's looser one (per D-06/D-07 and research/ARCHITECTURE.md §(b)).
- **SECURITY DEFINER RPC with atomic read-lock-write-log:** `deduct_ai_credits` in `026_ai_credits.sql` is the direct template for `record_athlete_decision()` — same atomicity requirement (insert log row + update state row in one transaction), same reason (avoid races under Vercel Fluid Compute).
- **Migration numbering:** most recent migrations use `YYYYMMDDHHMMSS_description.sql` (83 total migrations currently; e.g. `20260822140000_session_sets_unique.sql`). Never edit an existing migration — always add new ones (CLAUDE.md convention).

### Established Patterns
- **ESM import rule (backend only):** any new `backend/api/src/coaching-engine/` files (not built in this phase, but referenced by canonical_refs above) must use `.js`-suffixed relative imports even for `.ts` sources.
- **RLS pattern:** every table enables RLS; this phase's tables deliberately deviate from the standard `USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id)` template — SELECT-only, no WITH CHECK, no INSERT/UPDATE policy at all (per D-06).

### Integration Points
- None yet — this phase has no consuming caller. The tables/RPC exist for Phase 43 (first writer via `assess_profile`), Phase 44 (weekly reviews), Phase 46 (gating reader), and Phase 47 (context injection) to build against.

</code_context>

<specifics>
## Specific Ideas

- "readiness" enum should read naturally against the milestone's own framing: a "fragile" beginner starts cautious (water-only focus) and escalates; a "ready"/experienced athlete can start with a fuller program from day one.
- The write-lockdown should be strict enough that a future manual/admin correction tool is still forced through `record_athlete_decision()` (with `source = 'manual_admin'`) rather than getting a bypass — no exceptions carved out now.

</specifics>

<deferred>
## Deferred Ideas

- **`track` column / multi-domain state axis** — explicitly cut from Phase 42 (D-03). If a real product need for tracks emerges before the SEED-001 RPG/factions milestone, it re-enters as its own migration + discussion at that time, not smuggled in here.
- **Exact rolling-summary/recent-window numeric caps** — deferred to Phase 42/44 research + a synthetic 12-month-athlete load test, not decided in this discussion (D-05).

None of the areas discussed introduced genuinely new capabilities outside the phase boundary — all four gray areas were implementation-detail refinements within FOUND-01–05's existing scope.

</deferred>

---

*Phase: 42-decision-system-foundation*
*Context gathered: 2026-08-31*
