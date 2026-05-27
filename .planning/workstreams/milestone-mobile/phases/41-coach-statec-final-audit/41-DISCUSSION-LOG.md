# Phase 41: Coach StateC Enhancement + Final Data Audit — Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-27
**Phase:** 41-coach-statec-final-audit
**Areas discussed:** Progression % metric, Plan 41-01 actual scope, Fixture audit definition, Phase 35 gaps coordination

---

## Progression % Metric

| Option | Description | Selected |
|--------|-------------|----------|
| Keep habitsPct — today's habit adherence | Already implemented, immediately meaningful, doesn't require an assigned ai_generated_programs row | ✓ |
| Switch to program weeks % | Matches COACH-01 spec exactly. Requires linked ai_generated_programs. | |
| Show both | Two stat tiles: sessions count + habit % + program % | |

**User's choice:** Keep `habitsPct` (today's habit adherence %)
**Notes:** No query rewrite needed. Label update only.

---

## Stat Label (follow-up)

| Option | Description | Selected |
|--------|-------------|----------|
| Habitudes aujourd'hui | Clear, accurate — shows today's habit completion rate | ✓ |
| Adhérence | Shorter, professional | |
| Keep 'Progression %' as-is | No change to i18n key | |

**User's choice:** "Habitudes aujourd'hui" (fr) / "Today's habits" (en)

---

## Plan 41-01 Actual Scope

| Option | Description | Selected |
|--------|-------------|----------|
| Just update the i18n label | Plan 41-01 = 1-commit label fix only | ✓ |
| Full StateC audit + label fix | Read CoachScreen against COACH-01–03, verify each criterion | |
| Collapse into 41-02 | No separate plan, do label fix inside fixture audit plan | |

**User's choice:** Plan 41-01 = i18n label update only (tiny 1-commit plan)
**Notes:** CoachScreen.tsx already has stats row, linked-since date, and real data queries. COACH-01/02/03 are already complete.

---

## Fixture Audit Definition

| Option | Description | Selected |
|--------|-------------|----------|
| Zero real data fixtures; INITIAL_MESSAGES counts | Fix INITIAL_MESSAGES in chat.tsx. Style constants excluded. | ✓ |
| INITIAL_MESSAGES is acceptable UI state | Exclude it — it's local message state, not server data | |
| Stricter: any uppercase const object fails | Flag SHADOW, CARD_STYLE too | |

**User's choice:** `INITIAL_MESSAGES` is a data fixture and must be fixed. Style constants (`SHADOW`, `CARD_STYLE`, etc.) are explicitly excluded.

---

## Skeleton / Empty / Error Sweep Depth

| Option | Description | Selected |
|--------|-------------|----------|
| Targeted: only screens with confirmed loading gaps | Grep for useQuery screens missing isLoading/EmptyState/ErrorScreen | ✓ |
| Full systematic sweep | Go screen by screen across phases 32–40 | |
| Grep-driven: fix whatever grep finds | Let verification gates define scope | |

**User's choice:** Targeted grep-driven sweep — fix only confirmed gaps, not a full re-visit.

---

## Phase 35 Gaps Coordination

| Option | Description | Selected |
|--------|-------------|----------|
| Phase 41 is independent — ignore 35 gaps | 35-G01–G07 close in a separate gap pass after Phase 41 | ✓ |
| Block Phase 41 on 35 gaps first | Close gaps before starting Phase 41 | |
| Fold 35-G05+G06 into Phase 41 | Apparences + Parrainage overlap with mobile audit scope | |

**User's choice:** Phase 41 runs independently. 35 gaps tracked in STATE.md, deferred.

---

## Claude's Discretion

None — all areas were explicitly decided.

## Deferred Ideas

- **Program weeks progression %** — COACH-01's original spec. Deferred: habits % is more broadly applicable.
- **Phase 35 gaps (35-G01–G07)** — Cache invalidation, password spinner, credits IA, apparences migration 052, parrainage. Deferred to dedicated gap-closure pass post Phase 41.
