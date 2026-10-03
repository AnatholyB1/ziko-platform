# Phase 42: Decision-System Foundation - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-08-31
**Phase:** 42-decision-system-foundation
**Areas discussed:** Readiness field shape, Track column — keep or cut, Rolling-summary budget & scope, Write-path lockdown strictness

---

## Readiness field shape

| Option | Description | Selected |
|--------|-------------|----------|
| Top-level enum column (Recommended) | `readiness TEXT CHECK IN ('fragile','building','ready')` — mirrors status/track pattern | ✓ |
| Numeric score column | `readiness_score INT (0-100)` — finer-grained, but nothing consumes that resolution today | |
| Fold into onboarding_profile JSONB | No dedicated column — minimal but needs extraction logic everywhere it's read | |

**User's choice:** Top-level enum column.

**Follow-up — enum values & default:**

| Option | Description | Selected |
|--------|-------------|----------|
| fragile / building / ready, default 'fragile' (Recommended) | Matches milestone framing; fail-safe default | ✓ |
| beginner / intermediate / advanced, default 'beginner' | Overlaps semantically with `level` | |
| You decide | Claude picks during planning | |

**User's choice:** fragile / building / ready, default 'fragile'.

---

## Track column — keep or cut

| Option | Description | Selected |
|--------|-------------|----------|
| Cut it (Recommended) | Not required by FOUND-01–05; avoids pre-building the deferred RPG/track layer | ✓ |
| Keep it as a harmless placeholder | Avoids a future migration if tracks matter sooner, but risks scope creep | |

**User's choice:** Cut it entirely from Phase 42's schema.
**Notes:** Flagged as a direct conflict with PROJECT.md/REQUIREMENTS.md's explicit SEED-001 deferral of tracks/factions.

---

## Rolling-summary budget & scope

| Option | Description | Selected |
|--------|-------------|----------|
| Schema + documented convention only (Recommended) | No real decisions exist yet to summarize; Phase 44 builds the actual helper | ✓ |
| Ship the helper function now, unused | Front-loads code that can't be exercised until Phase 43/44 exist | |

**User's choice:** Schema + documented convention only.

**Follow-up — concrete caps:**

| Option | Description | Selected |
|--------|-------------|----------|
| ~400 tokens summary, last 4 raw decisions (Recommended) | Midpoint of research/STACK.md's suggested range | |
| Larger: ~800 tokens summary, last 8 raw decisions | More fidelity, higher per-call cost | |
| You decide | Claude picks during planning/research, validated against synthetic 12-month athlete | ✓ |

**User's choice:** You decide.

---

## Write-path lockdown strictness

| Option | Description | Selected |
|--------|-------------|----------|
| DB-level grant lockdown (Recommended) | REVOKE UPDATE from authenticated + service_role; only the SECURITY DEFINER function can write | ✓ |
| Convention-only | RLS + code-review discipline only; no DB-level guarantee against service-role bypass | |

**User's choice:** DB-level grant lockdown.

**Follow-up — same lockdown for athlete_decisions INSERT:**

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, same lockdown (Recommended) | Consistent tamper-evidence for the journal | ✓ |
| No, INSERT stays open to service_role | Leaves a flexibility escape hatch for a future admin tool | |

**User's choice:** Yes, same lockdown — `record_athlete_decision()` is the only writer for both tables, no exceptions.

---

## Claude's Discretion

- Exact `rolling_summary` token/char cap and exact N for the raw-decision recent window.
- Migration file naming/splitting (one file vs. table + table + RPC split), following existing `YYYYMMDDHHMMSS_` convention.
- `decision_type`/`source` CHECK-constraint enum membership (starting point drafted in research/ARCHITECTURE.md; extensible via a later migration).
- Whether `backend/api/test/rls/` gets Phase 42-specific RLS integration tests now or is deferred until Phase 43 provides a real caller.

## Deferred Ideas

- `track` column / multi-domain state axis — re-enters discussion only if a real need emerges before the SEED-001 RPG/factions milestone.
- Exact rolling-summary numeric caps — deferred to Phase 42/44 research + synthetic-athlete load test.
