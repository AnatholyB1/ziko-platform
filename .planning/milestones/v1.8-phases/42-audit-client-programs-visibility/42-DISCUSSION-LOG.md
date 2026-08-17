# Phase 42: Audit Client Programs Visibility - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-25
**Phase:** 42-audit-client-programs-visibility
**Areas discussed:** API shape fix, Athlete programs scope, Active vs History split

---

## API Shape Fix

| Option | Description | Selected |
|--------|-------------|----------|
| Fix the API | `getProgramsForClient` returns `{ active, history }` directly | ✓ |
| Fix the page/UI layer | API keeps `{ programs: [] }`, page splits it | |
| You decide | Claude picks the cleaner approach | |

**User's choice:** Fix the API (Recommended)

---

**Follow-up — Active definition:**

| Option | Description | Selected |
|--------|-------------|----------|
| First in list = active | Already sorted by start_date DESC — most recent is active | |
| Separate active flag on program | New status or is_active column on workout_programs | ✓ |
| Most recent with start_date ≤ today = active | Same as first-in-list, semantically clearer | |

**User's choice:** Separate active flag on program
**Notes:** Subsequently clarified as computed at API layer (not a new DB column) — the flag is derived from `start_date ≤ today` logic, no migration needed.

---

**Follow-up — Flag location:**

| Option | Description | Selected |
|--------|-------------|----------|
| Computed at API layer | No schema change — start_date ≤ today determines active | ✓ |
| New DB column | Adds is_active BOOLEAN on workout_programs, requires migration | |

**User's choice:** Computed at API layer (Recommended)

---

## Athlete Programs Scope

| Option | Description | Selected |
|--------|-------------|----------|
| All programs assigned to athlete | Remove created_by_coach_id filter; RLS covers this | ✓ |
| Only this coach's programs | Keep current filter, just fix data shape | |
| Athlete self-created + assigned | Also show user_id = athlete programs; needs RLS update | |

**User's choice:** All programs assigned to athlete (Recommended)

---

## Active vs History Split

| Option | Description | Selected |
|--------|-------------|----------|
| Most recent start_date ≤ today | Global across coaches — whichever started most recently is active | ✓ |
| Only this coach's program is active | Keep created_by_coach_id check for active slot | |

**User's choice:** Most recent start_date ≤ today (Recommended)

---

## Claude's Discretion

None — all decisions were made by the user.

## Deferred Ideas

- **Athlete self-created programs**: Programs where `user_id = athlete, assigned_to_user_id = NULL` not covered by current RLS. Would need a new policy clause. Noted for backlog.
- **ai_generated_programs table**: Separate table from `workout_programs`, different concept. Out of scope for this milestone.
