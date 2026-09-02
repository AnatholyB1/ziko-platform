# Roadmap: v1.18 AI Coach Core

**Workstream:** milestone-mobile
**Milestone:** v1.18 AI Coach Core
**Phase numbering:** continues from v1.7 (41 → 42)

## Overview

6 phases turn the AI orchestrator from a reactive (user-initiated chat) system into one that also makes autonomous, scheduled, per-athlete decisions. The build order is strictly dependency-driven: a compact current-state table plus an append-only decision journal must exist before anything can read or write against it (Phase 42); a new athlete's first `athlete_state` row is written by conversational onboarding (Phase 43); the weekly engine then reads real activity against that state and acts as the safety net that corrects onboarding profiling errors (Phase 44); rewards are selected from the engine's point/level output (Phase 45); feature-gating consumes the same `athlete_state.level` (Phase 46, architecturally decoupled enough to run in parallel with 44/45 if needed); and context wiring, notifications, and cost accounting are wired last, once there is real data to surface (Phase 47).

Phase 42 (Decision-System Foundation) is the prerequisite for every other phase. Phases 44 and 46 both depend on state populated by 42/43 but are independent of each other. Phase 45 depends on Phase 44's point/level output. Phase 47 depends on all of 43–46 having real data to wire up.

## Phases

- [x] **Phase 42: Decision-System Foundation** — `athlete_state` + `athlete_decisions` schema, `record_athlete_decision()` SECURITY DEFINER RPC, RLS (SELECT-only for clients), bounded-context summarization discipline (completed 2026-08-31)
- [x] **Phase 43: Conversational Onboarding** — ≤4-question free-text onboarding with the mascotte, `assess_profile` tool, profile inference with self-reported confidence, micro-action + celebration, starting-state write (including retrospective recompute for pre-v1.18 athletes) (completed 2026-09-02)
- [ ] **Phase 44: Weekly Adaptive Decision Engine** — `coaching-engine/` module, real-activity-vs-focus comparison, idempotent bounded-concurrency weekly cron, `create_goal`/`create_program` tools shared between cron and chat, independent AI cost accounting
- [ ] **Phase 45: Non-Punitive Tiered Rewards** — new points/tiers/reward-pool data model (distinct from the `gamification` plugin), deterministic AI reward selection (`create_reward`, pinned low/zero temperature), monotonic unlock guarantee
- [ ] **Phase 46: Progressive Feature Unlock** — `PluginManifest.minLevel`, `PluginLoader` third gating filter (`mandatory` → `minLevel` → `is_enabled`), fail-safe minimum-access floor, locked-plugin UI in the drawer
- [ ] **Phase 47: Context Wiring, Notifications & Cost Accounting** — `athlete_state` as 7th parallel context query + system-prompt section, weekly-review-complete push notification, `ai_cost_log` coverage for all autonomous (non-credit-gated) AI calls

---

## Phase Details

### Phase 42: Decision-System Foundation
**Goal:** Every athlete has a secure, bounded, server-validated coaching state and decision journal that all downstream AI-Coach-Core work can read and write against.
**Depends on:** Nothing (workstream foundation for v1.18)
**Requirements:** FOUND-01, FOUND-02, FOUND-03, FOUND-04, FOUND-05
**Success Criteria:**
1. Querying `athlete_state` for any athlete returns a single current-state row (niveau, palier, focus actuel, readiness) that reflects the most recent decision — never a growing blob.
2. Every AI-driven decision (focus assigned, reward granted, level changed) is recorded as an immutable entry in `athlete_decisions`, including its rationale and the real activity data it was based on.
3. Attempting to write `athlete_state` from anywhere except the single server-side decision path fails; that path re-validates against real activity data before applying any change.
4. An athlete querying their own state/journal succeeds; querying another athlete's state/journal is denied by RLS; no direct client write to either table is possible.
5. Building the AI context for an athlete with 12+ months of decision history stays within a bounded token budget — a compact rolling summary plus a small recent window, never a full replay of the journal.
**Plans:** 4/4 plans complete

Plans:
- [x] 42-01-PLAN.md — athlete_state + athlete_decisions tables, SELECT-only RLS, FOUND-05 read convention (wave 1)
- [x] 42-02-PLAN.md — record_athlete_decision() SECURITY DEFINER RPC + full GRANT/REVOKE write lockdown (wave 2)
- [x] 42-03-PLAN.md — RLS/RPC integration specs proving the read scoping and the write lockdown (wave 3)
- [x] 42-04-PLAN.md — [BLOCKING] supabase db push, live-project spec run, FOUND-05 sign-off (wave 4, checkpoint)

### Phase 43: Conversational Onboarding
**Goal:** A new athlete is profiled through a short free-text conversation with the mascotte and immediately given one achievable action, complementing (not replacing) the existing 7-step structured onboarding.
**Depends on:** Phase 42
**Requirements:** ONBOARD-01, ONBOARD-02, ONBOARD-03, ONBOARD-04, ONBOARD-05, ONBOARD-06
**Success Criteria:**
1. A new athlete can complete a ≤4-question free-text onboarding chat screen with the mascotte, in addition to (not instead of) the existing 7-step structured onboarding.
2. After the conversation, the athlete's inferred experience/confidence/adherence-risk profile is stored with a self-reported confidence score per inferred attribute, derived from the free-text answers.
3. Within 5 minutes of starting the conversational onboarding, the athlete receives a micro-action immediately achievable at their inferred profile level.
4. Completing that first micro-action triggers a mascotte celebration animation.
5. Onboarding writes the athlete's starting level/palier/focus into `athlete_state`; athletes who already completed the pre-v1.18 structured onboarding get a starting level retrospectively computed by the AI from their real activity history, never a flat default.
**Plans:** 6/6 plans complete
**UI hint:** yes

Plans:
- [x] 43-01-PLAN.md — assess_profile tool schema, curated micro-action pool, RPC write path, ONBOARDING_MAX_STEPS (wave 1)
- [x] 43-02-PLAN.md — coach.onboarding.* i18n, athleteOnboardingComplete store field, mandatory-gate fix, retroactive trigger (wave 1)
- [x] 43-03-PLAN.md — uncredited POST /ai/onboarding/stream with scoped tool surface and locale-tagged conversations (wave 2)
- [x] 43-04-PLAN.md — retroactive recompute from real activity aggregates + live RPC/RLS spec (wave 3)
- [x] 43-05-PLAN.md — Ziko chat screen, mandatory stack registration, step-7 redirect, SSE + resume (wave 3)
- [x] 43-06-PLAN.md — mission card, real-data completion check, celebration overlay, human verification (wave 4, checkpoint)

### Phase 44: Weekly Adaptive Decision Engine
**Goal:** Each week, every active athlete's next focus is decided from what they actually did, not a fixed calendar — and the decision self-corrects onboarding profiling errors over time.
**Depends on:** Phase 42, Phase 43
**Requirements:** ENGINE-01, ENGINE-02, ENGINE-03, ENGINE-04, ENGINE-05, ENGINE-06
**Success Criteria:**
1. Each week, the system compares each active athlete's actually-logged activity (not self-declared) against their assigned focus for that week.
2. The AI decides next week's focus from that comparison plus the athlete's decision history, and can escalate or de-escalate the athlete's trajectory independently of their original onboarding profile.
3. Running the weekly review twice for the same athlete/week (simulating Vercel's at-least-once cron redelivery) produces exactly one recorded decision, never a duplicate.
4. The weekly engine's AI cost is logged to `ai_cost_log` under a source that is never deducted from the athlete's own AI credit balance.
5. `create_goal` and `create_program` tools are registered in the existing orchestrator tool registry and are callable identically from both the weekly cron and interactive chat, producing the same applied effect through one shared write path.
**Plans:** TBD

### Phase 45: Non-Punitive Tiered Rewards
**Goal:** Athletes are rewarded for meeting or exceeding their weekly focus and never penalized for falling short.
**Depends on:** Phase 44
**Requirements:** REWARD-01, REWARD-02, REWARD-03, REWARD-04, REWARD-05
**Success Criteria:**
1. After a weekly review, an athlete who met their focus earns a standard-reward point outcome, one who exceeded it earns a better one, and one who fell short earns zero points — never a negative or punitive outcome.
2. Accumulated points unlock tiers, and each tier has its own pool of eligible rewards.
3. When a tier unlocks, the AI selects exactly one reward from that tier's eligible pool deterministically (temperature pinned low/zero) — never a random draw.
4. Once a tier or reward is unlocked for an athlete, it is never revoked or downgraded, including after a subsequent low-performance week.
5. Points/tiers/rewards live in a new, dedicated data model, entirely separate from the existing `gamification` plugin's coins/shop mechanic.
**Plans:** TBD

### Phase 46: Progressive Feature Unlock
**Goal:** The plugin drawer reveals capability as an athlete's real level grows, and never traps or over-grants access.
**Depends on:** Phase 42 (soft dependency — can run in parallel with Phase 44/45 once `athlete_state.level` exists)
**Requirements:** GATE-01, GATE-02, GATE-03, GATE-04
**Success Criteria:**
1. A plugin manifest can declare a `minLevel`; `PluginLoader` hides plugins above the athlete's current level as a third gating check alongside the existing `mandatory`/`is_enabled` checks.
2. An athlete with no `athlete_state` row yet (not through the new flow) still sees the minimum guaranteed set of plugins — never blocked to zero access.
3. The PluginsDrawer component visually marks locked plugins and shows what level is required to unlock them.
**Plans:** TBD
**UI hint:** yes

### Phase 47: Context Wiring, Notifications & Cost Accounting
**Goal:** The AI orchestrator is aware of each athlete's coaching state, athletes are notified when their weekly outcome is ready, and every autonomous AI call is cost-visible.
**Depends on:** Phase 43, Phase 44, Phase 45, Phase 46
**Requirements:** OPS-01, OPS-02, OPS-03
**Success Criteria:**
1. `athlete_state` is fetched as a 7th parallel query in `context/user.ts` alongside the existing 6, and appears in the AI orchestrator's system prompt for every chat/tool call.
2. When a weekly review completes with a new focus or a new reward, the athlete receives a push notification describing it.
3. Every autonomous AI call (`assess_profile`, `create_goal`, `create_reward`, `create_program` run in system/cron mode) is logged to `ai_cost_log`, independent of `creditCheck`/`creditDeduct` gating.
**Plans:** TBD

---

## Progress

| Phase | Plans | Status | Completed |
|-------|-------|--------|-----------|
| 42. Decision-System Foundation | 4/4 | Complete   | 2026-08-31 |
| 43. Conversational Onboarding | 6/6 | Complete   | 2026-09-02 |
| 44. Weekly Adaptive Decision Engine | TBD | Not started | — |
| 45. Non-Punitive Tiered Rewards | TBD | Not started | — |
| 46. Progressive Feature Unlock | TBD | Not started | — |
| 47. Context Wiring, Notifications & Cost Accounting | TBD | Not started | — |

---

## Coverage Map

| Req Category | Phase |
|---------------|-------|
| FOUND-01–05 | Phase 42 |
| ONBOARD-01–06 | Phase 43 |
| ENGINE-01–06 | Phase 44 |
| REWARD-01–05 | Phase 45 |
| GATE-01–04 | Phase 46 |
| OPS-01–03 | Phase 47 |

**Coverage:** 29/29 v1 requirements mapped. No orphans.

## Research Flags (carried from `.planning/research/SUMMARY.md`)

- **Phase 44** needs deeper research before planning: Vercel Fluid Compute/`maxDuration` enablement is unverified for this project; cron batching/concurrency numbers need validating; no confirmed consumer-fitness-app precedent for "stepped-care" structural weekly-focus decisions.
- **Phase 45** needs a legal-rationale checkpoint before shipping broadly: French ANJ/JONUM loot-box-adjacency law is explicitly flagged LOW confidence and actively evolving.
- **Phases 42, 43, 46** have standard, well-precedented patterns in this codebase (credits schema/RPC shape, `generateObject` structured extraction, `PluginLoader` gating) — research-phase can be light.
