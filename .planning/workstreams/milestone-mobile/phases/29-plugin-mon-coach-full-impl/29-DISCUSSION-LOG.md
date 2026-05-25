# Phase 29: Plugin "Mon coach" — Full Implementation — Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-19
**Phase:** 29-plugin-mon-coach-full-impl
**Areas discussed:** Auto-install write, State fetch strategy, Settings row action, Stats row in State C

---

## Auto-Install Write (COACH-03)

| Option | Description | Selected |
|--------|-------------|----------|
| PluginLoader — on mount | After mandatory pre-load loop, check user_plugins; if no 'coach' row, upsert. Idempotent on every login. | ✓ |
| authStore — post sign-in hook | Trigger upsert after onAuthStateChange fires. Explicit sign-in coupling. | |
| Supabase trigger / edge function | DB-level trigger on user_profiles role change. Zero client code, harder to test. | |

**User's choice:** PluginLoader — on mount
**Notes:** Idempotent, keeps all plugin logic in one file, consistent with existing PluginLoader structure.

---

## State Fetch Strategy (COACH-06/07/08)

| Option | Description | Selected |
|--------|-------------|----------|
| TanStack Query + backend | useQuery calling existing Phase 25 route. Stale-while-revalidate, loading state, auto-refetch on focus. | ✓ |
| Direct Supabase query | Query user_coach_links table from mobile client. Simpler but couples to DB schema. | |
| Zustand store, no fetch on mount | State set on link/revoke actions only. Fastest but stale if backend changed externally. | |

**User's choice:** TanStack Query + backend
**Notes:** Consistent with app patterns. Researcher to confirm exact GET endpoint from Phase 25.

---

## Settings Row Action (COACH-11)

| Option | Description | Selected |
|--------|-------------|----------|
| Navigate to coach screen | Chevron-forward row → /(plugins)/coach/dashboard. Revocation from State C only. No duplicate modal logic. | ✓ |
| Inline revocation from settings | Settings has its own Retirer ce coach button + typed modal. Duplicates State C logic. | |

**User's choice:** Navigate to coach screen
**Notes:** Simpler — no duplicate code. Settings section hidden when no coach linked (State A).

---

## Stats Row in State C (coach.jsx mockup)

| Option | Description | Selected |
|--------|-------------|----------|
| Placeholder / static | Show '--' or 0 values. Phase 31 wires real data. | |
| Real data from existing routes | Séances from workout_sessions, progression from habits logs. | ✓ |
| Omit stats row entirely | UI-SPEC doesn't include stats — simpler, no scope risk. | |

**User's choice:** Real data from existing routes
**Notes:** Follow-up question on "progression %" definition:

| Option | Description | Selected |
|--------|-------------|----------|
| Skip progression %, séances only | Real séances count, progression % shows '--'. | |
| Progression = active habits % | Use habits completion rate for today (habit_logs). | ✓ |
| You decide | Claude picks simplest real-data interpretation. | |

**Progression defined as:** habits completion rate (% of active habits completed today from habit_logs). If query fails, show '--'.

---

## Claude's Discretion

- Plugin package scaffold structure (follows habits/ pattern exactly — researcher to confirm)
- Whether Phase 25 has GET /coach/clients/links (list) vs only preview/single routes
- date-fns availability in monorepo (researcher to verify before adding dependency)
- Stats date filter: if linked_at available, filter workout_sessions to post-link date only

## Deferred Ideas

- AI tools (coach_get_link / coach_revoke_link) — Phase 31
- Real-time coach link status updates — future milestone
- Coach-initiated messaging — MOBILE-06, already deferred
