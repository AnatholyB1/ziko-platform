# Phase 41: Coach StateC Enhancement + Final Data Audit — Context

**Gathered:** 2026-05-27
**Status:** Ready for planning

<domain>
## Phase Boundary

Close out v1.7 Mobile UX v2 with two workstreams:
1. **Coach StateC label fix** — update one i18n key (`coach.state_c.progress_label`) to accurately reflect the metric already implemented (habits adherence %, not program progression %).
2. **Final data audit** — eliminate the last remaining data fixture (`INITIAL_MESSAGES` in `ai/chat.tsx`) and do a targeted sweep of screens missing loading/empty/error states.

**In scope:**
- i18n label update: `coach.state_c.progress_label` → "Habitudes aujourd'hui" (fr) / "Today's habits" (en)
- Fix `INITIAL_MESSAGES` data fixture in `apps/mobile/app/(app)/ai/chat.tsx`
- Targeted grep-driven skeleton/empty/error fixes for screens that have `useQuery` but are missing `isLoading`/`EmptyState`/`ErrorScreen`
- Phase verification (TypeScript clean compile + audit grep gates)

**Out of scope:**
- Phase 35 gaps (35-G01–G07) — tracked separately, do not block Phase 41
- Active workout session (`session.tsx`) — excluded from entire v1.7 redesign
- Style constants (`SHADOW`, `CARD_STYLE`, `CREDIT_COSTS`, etc.) — NOT data fixtures, excluded from audit
- Switching "Progression %" to program weeks completed — decided against (keep habits %)

</domain>

<decisions>
## Implementation Decisions

### Coach StateC — Stat Label (COACH-01 clarification)

- **D-01:** The "Progression %" stat in StateC uses `habitsPct` — today's habit completion rate (habits done today / total active habits × 100). This is already implemented in `CoachScreen.tsx`. **Do not switch to program weeks completed.**
- **D-02:** The i18n key `coach.state_c.progress_label` must be updated to "Habitudes aujourd'hui" (fr) and "Today's habits" (en) to accurately describe the metric. Both locale files must be updated. This is the only code change in plan 41-01.
- **D-03:** COACH-01, COACH-02, COACH-03 are **already implemented** in `CoachScreen.tsx`. Stats row (`sessionsCount` + `habitsPct`), "Lié depuis DD/MM/YYYY" row, and real data queries (no `COACH_DATA` fixture) all exist. Plan 41-01 is a 1-commit label fix only.

### Fixture Audit Definition (DATA-01)

- **D-04:** Audit PASS condition: zero `const [A-Z_]{4,} = {` patterns that hold **data** (arrays/objects with domain data) in production screens. Style/layout constants (`SHADOW`, `CARD_STYLE`, `MOTI_FROM`, `CREDIT_COSTS`, `XP_REWARDS`, etc.) are explicitly **excluded** from the audit.
- **D-05:** `INITIAL_MESSAGES` in `apps/mobile/app/(app)/ai/chat.tsx` is a data fixture (hardcoded message content). It must be replaced with an empty array `[]` for the initial `useState`. The chat screen already loads real messages from `ai_conversations`/`ai_messages` via the streaming API — `INITIAL_MESSAGES` is dead code.
- **D-06:** After fixing `INITIAL_MESSAGES`, the audit grep gate is: `grep -rn "const [A-Z_]\{4,\} = \[" apps/mobile/app plugins` should return zero results for arrays-of-objects (data fixtures). The remaining hits will all be style constants.

### Skeleton / Empty / Error Sweep (DATA-02/03/04)

- **D-07:** Sweep is **targeted**, not full systematic. Run: `grep -rL "isLoading\|isFetching" $(grep -rl "useQuery" apps/mobile/app plugins --include="*.tsx")` to find screens with queries but no loading state. Fix only the screens that surface in this grep.
- **D-08:** `EmptyState` and `ErrorScreen` (from `packages/ui/src/components/`) are already integrated in 17 places. The sweep adds them only to screens confirmed missing by the grep gate — not a wholesale re-visit of all screens.
- **D-09:** Loading skeleton pattern: use the `ActivityIndicator` already present in most screens OR a `View` shimmer matching the existing light-gray pattern. Do not introduce a new skeleton library.

### Phase 35 Gaps

- **D-10:** Phase 35 gaps (35-G01–G07: cache invalidation, password spinner, progress photo, crédits IA, apparences migration, parrainage) do NOT block Phase 41. They will be addressed in a dedicated gap-closure pass after Phase 41 ships the v1.7 milestone.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements

- `.planning/workstreams/milestone-mobile/REQUIREMENTS-v1.7.md` §COACH, §DATA — Acceptance criteria for COACH-01–03 and DATA-01–04

### Existing Implementation (read before writing any code)

- `plugins/coach/src/screens/CoachScreen.tsx` — Full StateC implementation: stats row (lines 583–599), linked-since date row (lines 602–613), `sessionsCount` query (lines 111–125), `habitsPct` query (lines 127–152). **Already complete for COACH-01/02/03 except the label.**
- `apps/mobile/app/(app)/ai/chat.tsx` — Contains `INITIAL_MESSAGES` fixture (line 40) that must be replaced with `[]`

### i18n Files (label update target)

- `packages/plugin-sdk/src/i18n/` (or equivalent locale path) — Contains `coach.state_c.progress_label` key in both `fr` and `en` locale files. Downstream agent must locate the exact paths.

### Design System

- `packages/ui/src/components/EmptyState.tsx` — Phase 40 EmptyState component (4 variants: no-data, error, offline, no-results)
- `packages/ui/src/components/ErrorScreen.tsx` — Phase 40 ErrorScreen component (4 variants: generic, network, auth, not-found)
- `packages/ui/src/index.ts` — Exports EmptyState + ErrorScreen

### Phase Context

- `.planning/workstreams/milestone-mobile/ROADMAP.md` §Phase 41 — Phase goals + success criteria
- `.planning/workstreams/milestone-mobile/STATE.md` — Current milestone state; Phase 35 gap status
- `.planning/workstreams/milestone-mobile/phases/40-extra-screens/40-CONTEXT.md` — D-15 notes "Full EmptyState/ErrorScreen sweep deferred to Phase 41"

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets

- `CoachScreen.tsx` — `habitsPct` query already implemented (lines 127–152). Only label change needed, no query rewrite.
- `EmptyState` / `ErrorScreen` — exported from `packages/ui/src/index.ts`, already imported in 17 screens. Import pattern: `import { EmptyState, ErrorScreen } from '@ziko/ui'`.
- `useQuery` pattern — All screens follow TanStack Query v5 pattern with `queryKey`, `queryFn`, `staleTime`. No new patterns needed.

### Established Patterns

- **Fixture elimination pattern:** Replace `const FIXTURE = [...]` with `useState([])`, then use `useQuery` for real data. Already done in Phases 33–40.
- **Loading state pattern:** `if (isLoading) return <ActivityIndicator>` at top of component, before render.
- **Empty state pattern:** `if (!data || data.length === 0) return <EmptyState variant="no-data" ... />` inside the query-dependent render path.
- **Error state pattern:** `if (isError) return <ErrorScreen variant="network" onRetry={refetch} />`.

### Integration Points

- i18n key `coach.state_c.progress_label` — update in both `fr.json` and `en.json` locale files
- `ai/chat.tsx` line 40 → replace `INITIAL_MESSAGES: ChatMessage[]` with `[]`
- Targeted screens from grep sweep → add `isLoading`/`EmptyState`/`ErrorScreen` per established patterns

</code_context>

<specifics>
## Specific Ideas

- Label "Habitudes aujourd'hui" (fr) chosen over "Adhérence" or "Progression %" for accuracy and user clarity.
- `INITIAL_MESSAGES` in chat.tsx is dead code (the screen loads real messages from the API). Replace with empty array, not a query — the streaming/conversation loading logic is already correct.
- Grep command for fixture audit gate: `grep -rn "const [A-Z_]\{4,\} = \[" apps/mobile/app plugins --include="*.tsx" | grep -v SHADOW | grep -v CARD | grep -v MOTI | grep -v CREDIT | grep -v XP | grep -v COIN`

</specifics>

<deferred>
## Deferred Ideas

- **Program weeks progression % stat** — COACH-01 originally specified "% of program weeks completed" as the StateC stat. Deferred: the habits adherence % is more broadly applicable (works without an assigned program) and is already implemented. If a future coach engagement phase adds program assignment to all athletes, this metric can be revisited.
- **Phase 35 gaps (35-G01–G07)** — Cache invalidation, password spinner, progress photo FormData, crédits IA real balance, apparences migration 052, parrainage migration 053+Hono routes. All tracked in STATE.md, deferred to a dedicated gap-closure pass after Phase 41.

</deferred>

---

*Phase: 41-coach-statec-final-audit*
*Context gathered: 2026-05-27*
