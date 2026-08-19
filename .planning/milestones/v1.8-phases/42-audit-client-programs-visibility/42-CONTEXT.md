# Phase 42: Audit Client Programs Visibility - Context

**Gathered:** 2026-05-25
**Status:** Ready for planning

<domain>
## Phase Boundary

Verify and fix the Programs tab in the coach client detail view. Two bugs identified: (1) data shape mismatch between API and UI causing always-empty display, (2) query filter too narrow (only shows programs created by this specific coach). No schema migration required.

</domain>

<decisions>
## Implementation Decisions

### API Shape Fix
- **D-01:** Fix `getProgramsForClient` (in `backend/api/src/coach/clients/db.ts:721`) to return `{ active: Program | null, history: Program[] }` instead of `{ programs: Program[] }`. The transformation lives in the API layer, not the UI.
- **D-02:** "Active" is computed at the API layer — no new DB column needed. The program with the most recent `start_date ≤ today` is the active one; all others go to `history`.
- **D-03:** Ordering: sort all programs by `start_date DESC NULLS LAST`. First program that has started (start_date ≤ today) = active, rest = history.

### Athlete Programs Scope
- **D-04:** Remove the `.eq('created_by_coach_id', coachId)` filter from the query. The Programs tab should show **all programs assigned to the athlete** (`assigned_to_user_id = clientId`), regardless of which coach created them.
- **D-05:** RLS policy `workout_programs_coach_read` (migration 045) already allows this — no RLS change needed. The existing policy covers `assigned_to_user_id IS NOT NULL AND is_coach_of(coach, athlete)`.
- **D-06:** Athlete self-created programs (where `user_id = athlete, assigned_to_user_id = NULL`) are **not** in scope — they are not covered by current RLS and would require a new policy. Defer to a future phase if needed.

### Active vs History Split
- **D-07:** Only one program is "active" at a time — the one with the latest `start_date ≤ today`. This is global across all coaches (not filtered per-coach for the active slot).
- **D-08:** If no program has a `start_date ≤ today`, `active` is `null` and all programs go to `history`. If a program has `start_date = null`, it is treated as history (not yet started).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Backend — Programs for client endpoint
- `backend/api/src/coach/clients/db.ts` — `getProgramsForClient` function (line 721). This is what needs to be changed.
- `backend/api/src/coach/clients/service.ts` — route handler at line 389: `GET /:id/programs`. Calls `getProgramsForClient`, returns `c.json(result)` unchanged.

### Frontend — Programs tab UI
- `apps/web/src/app/[locale]/(coach)/coach/clients/[id]/programs/page.tsx` — Server Component that fetches from API. Assigns `programsData = json` directly (no transformation). Needs to match `{ active, history }` once API is fixed.
- `apps/web/src/app/[locale]/(coach)/coach/clients/[id]/programs/ClientProgramsContent.tsx` — Client Component. Already expects `{ active: ActiveProgram | null, history: HistoryProgram[] }`. No change needed here unless interface fields change.

### Navigation — Tab strip
- `apps/web/src/components/coach/ClientTabStrip.tsx` — Tab "Programmes" already exists as tab #8. No nav change needed.

### RLS — Coach access policy
- `supabase/migrations/045_coaching_programs_schema.sql` — policy `workout_programs_coach_read` (line 82). Covers `assigned_to_user_id IS NOT NULL AND is_coach_of(coach, athlete)`. No changes needed.

### Workstream
- `.planning/workstreams/custom-coach/ROADMAP.md` — Phase 42 definition and success criteria
- `.planning/workstreams/custom-coach/REQUIREMENTS.md` — AUDIT-01 requirement

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `ClientProgramsContent.tsx` — already handles both the active-program card and history list. No UI changes needed unless interface fields differ from what API now returns.
- `ActiveProgram` and `HistoryProgram` interfaces in `ClientProgramsContent.tsx` — these define exactly what the API must return for `active` and each `history` entry. Use them as the contract.

### Established Patterns
- All coach DB functions use `createUserClient(jwt)` — the JWT-scoped client respects RLS automatically. Keep this pattern.
- Compliance % computation is already done for the active program in `getProgramsForClient`. After the fix, compliance should still be computed only for `active`, not for history entries.
- `start_date` is a `DATE` column (from migration 045) — compare with `new Date().toISOString().split('T')[0]` in the API to determine active vs history.

### Integration Points
- The `page.tsx` feeds into `ClientProgramsContent` via props. Once API returns `{ active, history }`, the page can pass them directly — minimal code change.
- `coach_display_name` is already enriched in the existing query via a profile join or separate fetch — preserve this field in the new structure.

</code_context>

<specifics>
## Specific Ideas

- The `coach_display_name` field on `ActiveProgram` (already in `ClientProgramsContent.tsx` interface line 11) must be populated — check if `getProgramsForClient` currently joins `user_profiles` for the coach name or leaves it null.
- Phase 42 is explicitly a **fast audit** (1-2 plans). No new UI components, no migration. Only fix the API function and the page assignment.

</specifics>

<deferred>
## Deferred Ideas

- Athlete self-created programs visible to coach — would need a new RLS clause (`user_id = athlete AND is_coach_of(coach, athlete)`). Not in scope for Phase 42; note for backlog.
- Programs from the `ai_generated_programs` table (separate from `workout_programs`) — these are AI-generated suggestions, not assigned programs. Out of scope for this phase.

</deferred>

---

*Phase: 42-audit-client-programs-visibility*
*Context gathered: 2026-05-25*
