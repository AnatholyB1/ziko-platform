---
gsd_state_version: 1.0
milestone: v1.18
milestone_name: milestone
status: ready_to_plan
stopped_at: Phase 43 complete (6/6) — ready to discuss Phase 44
last_updated: 2026-09-02T05:59:05.469Z
last_activity: 2026-09-01 -- Phase 43 execution started
progress:
  total_phases: 6
  completed_phases: 1
  total_plans: 10
  completed_plans: 52
  percent: 17
---

# Project State — v1.18 AI Coach Core

## Project Reference

See: .planning/PROJECT.md (updated 2026-08-30)
See: .planning/workstreams/milestone-mobile/ROADMAP.md
See: .planning/workstreams/milestone-mobile/REQUIREMENTS.md

**Core value:** L'IA devient le pilote central de l'expérience athlète — onboarding conversationnel, moteur de décision adaptatif hebdo, tools IA (objectif/récompense/programme), review/récompenses par palier, déblocage progressif de fonctionnalités par niveau.

**Previous milestone (v1.7 Mobile UX v2):** SHIPPED 2026-05-28. See `.planning/workstreams/milestone-mobile/ROADMAP-v1.7.md` / `REQUIREMENTS-v1.7.md`.

## Current Position

Phase: 44
Plan: Not started
Status: Ready to plan
Last activity: 2026-09-02

Progress: [░░░░░░░░░░] 0%

## Performance Metrics

**Velocity:**

- Total plans completed: 6
- Average duration: — (no data yet for v1.18)
- Total execution time: 0 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 43 | 6 | - | - |

**Recent Trend:**

- Last 5 plans: — (none yet)
- Trend: — (no data yet)

## Accumulated Context

### Key Decisions

- Phase numbering continues from v1.7: phases 42–47 (v1.7 ended at Phase 41)
- Foundation-first build order: `athlete_state`/`athlete_decisions` schema (Phase 42) blocks every other phase — no tool, cron, or gating check can be built without it
- `athlete_state` modeled on the tighter `user_ai_credits`/`ai_credit_transactions` precedent (SECURITY DEFINER RPC write path), not the looser `gamification` schema — `level` is security-relevant (drives plugin gating)
- Weekly decision engine (Phase 44) uses single-shot `generateObject` fed pre-aggregated real activity, NOT the interactive multi-step agent loop; must not copy `coach/ai/monitor-cron`'s sequential per-user loop pattern — that pattern has no LLM call in the loop and would blow duration/cost budgets here
- Reward selection (Phase 45) pinned to temperature 0, deterministic pool selection only — never randomized (French ANJ/JONUM regulatory constraint, not just UX preference)
- New reward data model (Phase 45) is explicitly separate from the existing `gamification` plugin's coins/shop (fixed-price purchase model is incompatible with AI pool selection)
- Feature-gating (Phase 46) is a third `PluginLoader` filter (`mandatory` → `minLevel` → `is_enabled`), fail-safe to level 1 when no `athlete_state` row exists yet
- Weekly engine AI cost (`ai_cost_log`) is funded as platform opex, never deducted from the athlete's own AI credit balance — these are autonomous/system-initiated calls, not user-initiated
- Explicitly out of scope for v1.18 (seeded to SEED-001 for a future milestone): factions/leagues/leaderboards/battle-pass, cosmetic loot/skins, extended multi-state mascotte, coach-curated reward pools, logprob-based confidence scoring

### Pending Todos

None yet for v1.18 — roadmap just created, no plans generated.

### Blockers/Concerns

- **Phase 44 research gap:** Vercel Fluid Compute / `maxDuration` enablement is unverified on this project; cron batching/concurrency numbers need validating against real or projected athlete volume before committing to a batch size.
- **Phase 44 research gap:** No confirmed consumer-fitness-app precedent for "stepped-care" structural weekly-focus decisions (LOW confidence, inferred from behavioral-health literature) — flagged for a dedicated research pass before finalizing decision logic shape.
- **Phase 45 legal checkpoint:** French ANJ/JONUM loot-box-adjacency law is explicitly LOW confidence and actively evolving — recommend legal/counsel review before shipping broadly, not just an engineering read of current research.
- **Product decision still open:** funding model for autonomous AI calls (platform opex vs. athlete credit allocation) — flagged in research as needing a conscious decision before Phase 44/47 implementation.
- Carried from v1.7 close: Phase 35 gaps (35-G01–G07) — cache invalidation, password spinner, progress photo, crédits IA, apparences, parrainage — status unknown, not re-verified during v1.18 roadmap creation. See Deferred Items below.

## Deferred Items

Items acknowledged and carried forward from previous milestone close:

| Category | Item | Status | Deferred At |
|----------|------|--------|-------------|
| UX gaps | Phase 35 gaps (35-G01–G07): cache invalidation, password change spinner, progress photo, crédits IA balance, apparences (theme removal/lang/region), parrainage rewards | Unresolved (not re-audited for v1.18) | v1.7 close (2026-05-28) |
| Scope | Factions/ligues/leaderboards/battle-pass/loot cosmétique/mascotte étendue (SEED-001) | Deferred to future milestone | v1.18 scoping discussion (2026-08-30) |

## Session Continuity

Last session: 2026-09-01T13:09:04.509Z
Stopped at: Phase 43 UI-SPEC approved
Resume file: .planning/workstreams/milestone-mobile/phases/43-conversational-onboarding/43-UI-SPEC.md

---

## Archive — v1.7 Mobile UX v2 (SHIPPED 2026-05-28)

Phases 32–41 complete (48 plans across 10 phases). Full visual redesign matching 24 canonical mockups; design + real data per screen; GPS Cardio live tracker; Coach StateC real stats. See `.planning/workstreams/milestone-mobile/ROADMAP-v1.7.md` and `REQUIREMENTS-v1.7.md` for full detail.

**Known gaps at close (unresolved as of v1.18 roadmap creation):** Phase 35 gaps 35-G01–G07 — see Deferred Items above.

## Archive — v1.6 Mobile v2 (SHIPPED 2026-05-21)

Phases 27–31 complete. See `.planning/workstreams/milestone-mobile/v1.6-MILESTONE-AUDIT.md`.
