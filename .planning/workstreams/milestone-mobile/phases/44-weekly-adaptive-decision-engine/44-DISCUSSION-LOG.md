# Phase 44: Weekly Adaptive Decision Engine - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-09-02
**Phase:** 44-weekly-adaptive-decision-engine
**Areas discussed:** Review trigger timing, Escalation/de-escalation aggressiveness, "Met focus" definition & data sources, create_goal/create_program scope

---

## Review trigger timing

| Option | Description | Selected |
|--------|-------------|----------|
| Lazy on-open + cron safety net | Fire review via `waitUntil()` on a cheap app-open read when due; small Sunday cron only catches stragglers. | ✓ |
| Synced cron for everyone | Every athlete's review computes at the same wall-clock time regardless of app usage. | |

**User's choice:** Lazy on-open + cron safety net

| Option | Description | Selected |
|--------|-------------|----------|
| Personalized, rolling from onboarding date | Each athlete's week anchors to their own onboarding-completion day. | ✓ |
| Fixed calendar week for all athletes | Everyone's week resets the same day (e.g. every Monday). | |

**User's choice:** Personalized, rolling from onboarding date

| Option | Description | Selected |
|--------|-------------|----------|
| Silent — next fetch just shows the new focus | No special in-app moment. | |
| Brief "Ziko reviewed your week" moment | Reuses Phase 43's celebration/`FadeInUp` pattern. | ✓ |

**User's choice:** Brief "Ziko reviewed your week" moment
**Notes:** This in-app reveal is distinct from Phase 47's push notification, which is out of scope here.

---

## Escalation/de-escalation aggressiveness

| Option | Description | Selected |
|--------|-------------|----------|
| One strong week is enough | A single met/exceeded week can trigger escalation. | ✓ |
| Requires 2 consecutive strong weeks | Escalation needs a short pattern first. | |

**User's choice:** One strong week is enough

| Option | Description | Selected |
|--------|-------------|----------|
| One missed week can trigger de-escalation | Reacts immediately to a shortfall. | |
| Requires a pattern of misses before backing off | A single off week doesn't change trajectory. | ✓ |

**User's choice:** Requires a pattern of misses before backing off
**Notes:** Deliberate asymmetry — fast escalate, slow de-escalate — chosen to match the milestone's non-punitive framing (REWARD-01) one phase early.

| Option | Description | Selected |
|--------|-------------|----------|
| Yes — AI can override based on rationale | Rule is a floor/ceiling; AI judgment operates within it, rationale always logged. | ✓ |
| No — deterministic rule, AI only picks specifics | Trajectory is a fixed code-evaluated rule; AI fills in details only. | |

**User's choice:** Yes — AI can override based on rationale

---

## "Met focus" definition & data sources

| Option | Description | Selected |
|--------|-------------|----------|
| Tolerance band — close counts as met | e.g. 2/3 of a target still counts as met. | |
| Exact or better only counts as met | Anything short of the target is "missed." | ✓ |

**User's choice:** Exact or better only counts as met

| Option | Description | Selected |
|--------|-------------|----------|
| Workout sessions | Always-relevant training data. | |
| Habits & journal | Relevant for habit/consistency-type focuses. | |
| Nutrition & hydration | Relevant for nutrition/hydration-type focuses. | |
| Only the specific table(s) the assigned focus targets | Scoped narrowly per focus, not a fixed source. | ✓ |

**User's choice:** Only the specific table(s) the assigned focus targets
**Notes:** Confirms the comparison reads whichever table(s) that week's specific focus targets (could be any of the above categories), never all sources indiscriminately.

---

## create_goal / create_program scope

| Option | Description | Selected |
|--------|-------------|----------|
| Reuses full /ai/programs/generate flow | create_program generates a real multi-week ai_generated_programs row. | |
| Lighter goal/focus object, no full program | create_program updates current_focus_detail, not a full program. | ✓ |

**User's choice:** Lighter goal/focus object, no full program

| Option | Description | Selected |
|--------|-------------|----------|
| Only on escalation/de-escalation | A "hold" review doesn't touch the program. | ✓ |
| Every review that produces a new focus, including holds | Program refreshes every review regardless. | |

**User's choice:** Only on escalation/de-escalation

| Option | Description | Selected |
|--------|-------------|----------|
| New lightweight athlete_goals table | Dedicated table, referenced by current_focus_detail.goal_id. | ✓ |
| No new table — goal lives entirely in current_focus_detail JSONB | No new table/migration. | |

**User's choice:** New lightweight athlete_goals table

**Follow-up:** With create_goal writing to a new table and create_program not doing full generation, what distinguishes the two?

| Option | Description | Selected |
|--------|-------------|----------|
| create_program sets structured weekly training targets; create_goal sets the broader outcome | Goal = multi-week outcome (athlete_goals row); program = this week's concrete targets in current_focus_detail, referencing the active goal. | ✓ |
| create_program is effectively unused/rare for now | create_goal covers weekly review's needs; create_program stays for chat-initiated requests only. | |

**User's choice:** create_program sets structured weekly training targets; create_goal sets the broader outcome
**Notes:** Full multi-week AI program generation via the existing `/ai/programs/generate` flow stays a separate, rarer, explicit chat-initiated action — the weekly engine never calls it automatically.

---

## Claude's Discretion

- Exact per-focus-type data source mapping (which table(s) map to which focus category)
- Exact numeric definition of "a pattern of misses" for de-escalation (e.g. 2-of-last-3 weeks)
- `athlete_goals` table exact column shape beyond goal text/target/target_date/status
- Exact mechanism for detecting "review is due" on the lazy-trigger read path — which existing endpoint carries the check
- Vercel Fluid Compute / `maxDuration` verification and bounded-concurrency batch sizing (technical research gap, not a product decision)

## Deferred Ideas

None — every gray area discussed was an implementation-detail or product-behavior refinement within ENGINE-01–06's existing phase boundary.
