# Phase 27: Coaching Programs & Mobile "Mon coach" Full — Context

**Gathered:** 2026-05-20
**Status:** Ready for planning
**Milestone:** v1.5 — Coach Platform & CRM
**Depends on:** Phase 26 (complete 2026-05-18)

<domain>
## Phase Boundary

Phase 27 delivers **two parallel tracks**:

**Track A — Web: Program Builder**
- `/coach/programs` — create, edit, organize coach-authored workout templates
- Week accordion editor: weeks → sessions (by day_of_week) → exercises
- Exercise search typeahead against Ziko 1000+ library + ability to create new exercises (saved to shared `exercises` table)
- Single-level folder management (new migration: `coach_program_folders`)
- Duplicate template / week / session via context menu
- 5–10 expert seed templates (PPL, 5/3/1, Hyrox prep, body-recomp, beginner full-body) seeded at signup
- Assign template to one or more linked clients — fork-on-assign (immediate start, `start_date = today`)
- Programs tab on `/coach/clients/[id]` (Phase 26 deferred, folded here)

**Track B — Mobile: Mon coach State C enrichment**
- Today's prescribed session preview (based on `day_of_week` + program `start_date`)
- "Commencer" deep-links into existing workout session screen with exercises pre-loaded
- Weekly compliance widget ("75% cette semaine" — prescribed sessions done vs total this week)
- Coach's latest shared note (from `coach_client_links.shared_note`)
- "Contact coach" CTA → `mailto:` with coach's signup email
- "Programme prescrit par [coach]" badge on prescribed sessions (read-only, in Mon coach State C)

**Out of scope:**
- Phase 28: AI File Imports (PDF/image/Excel parsing)
- Phase 29: AI Coach Orchestrator
- Multiple coaches per athlete (deferred v1.6)
- Athlete-facing program library (athlete can only see their assigned program)
- Real-time session tracking from the coach CRM
- Scheduled assignment (future start date) — immediate only in Phase 27

</domain>

<decisions>
## Implementation Decisions

### weeks_data JSONB Schema (D-01 through D-05)

- **D-01 — Full Zod schema locked in `coach-sdk` now.** The complete `ProgramWeekSchema` → `ProgramSessionSchema` → `ProgramExerciseSchema` hierarchy is defined in `packages/coach-sdk/src/schemas/` before any implementation begins. No DB CHECK — Zod-only per migration 036 D-11.

- **D-02 — Session positioning: `day_of_week` (1=Mon … 7=Sun).** Each session in `weeks_data` has a required `day_of_week: 1|2|3|4|5|6|7` field. Mobile "today's session" query: find the current week number (based on `start_date`), then match `day_of_week` to today's ISO day.

- **D-03 — Exercise intensity: `target_rpe` (nullable, 1–10) OR `target_rir` (nullable, 0–5), both on each exercise object.** Coach fills one or neither. Mobile renders whichever is set. Matches ROADMAP SC1 exactly.

- **D-04 — Full exercise object shape:**
  ```ts
  ProgramExerciseSchema = z.object({
    exercise_id:       z.string().uuid().nullable(),   // null = free-text / coach-created
    exercise_name:     z.string().min(1).max(100),
    sets:              z.number().int().min(1).max(20),
    reps:              z.number().int().min(1).max(100).nullable(),
    duration_seconds:  z.number().int().min(1).nullable(),
    target_rpe:        z.number().min(1).max(10).nullable(),
    target_rir:        z.number().int().min(0).max(5).nullable(),
    rest_seconds:      z.number().int().min(0).max(600).nullable(),
    notes:             z.string().max(300).nullable(),
  })
  ```

- **D-05 — Full program object shape:**
  ```ts
  ProgramSessionSchema = z.object({
    session_id:    z.string().uuid(),   // client-generated nanoid
    session_name:  z.string().min(1).max(100),
    day_of_week:   z.number().int().min(1).max(7),
    exercises:     z.array(ProgramExerciseSchema),
  })
  ProgramWeekSchema = z.object({
    week_number: z.number().int().min(1),
    sessions:    z.array(ProgramSessionSchema),
  })
  // weeks_data = ProgramWeekSchema[]
  ```

### Program Builder — Web Editor (D-06 through D-09)

- **D-06 — Week accordion + slide-over session panel.** UI pattern:
  - Left column: list of weeks (collapsible, `[+ Add week]` button at bottom)
  - Inside each week: session rows showing day-of-week chip + session name + `[••• ►]` actions + exercise count
  - Clicking a session row opens a **slide-over panel** (right side) with the full exercise table for that session
  - Duplicate/delete via `•••` context menu on each week, session, and exercise row

- **D-07 — Exercise typeahead with library + create.** Inside the slide-over panel:
  - Text input triggers debounced `GET /exercises?q=` search against the Ziko 1000+ library
  - If no match found OR coach types a new name, a "Créer l'exercice « [name] »" option appears
  - Creating saves a new row to the shared `exercises` table with `is_user_defined = TRUE` (new column, migration needed)
  - Exercises are reusable across programs for this coach (searchable in future sessions)

- **D-08 — Single-level folders (new migration).** New table:
  ```sql
  CREATE TABLE public.coach_program_folders (
    id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    coach_id  UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name      TEXT NOT NULL CHECK (char_length(name) <= 100),
    UNIQUE (coach_id, name)
  );
  ALTER TABLE public.workout_programs ADD COLUMN folder_id UUID
    REFERENCES public.coach_program_folders(id) ON DELETE SET NULL;
  ```
  Migration number: researcher confirms (likely 045 — after 044).

- **D-09 — Seed templates deployment.** 5–10 expert templates seeded in `supabase/seed.sql` (or a dedicated migration) under a system coach account (`created_by_coach_id = NULL`). Coaches see them in a "Bibliothèque Ziko" section of `/coach/programs`. Assigning any seed template creates a personal fork for the coach to customize.

### Assignment (D-10 through D-11)

- **D-10 — Immediate start, `start_date = CURRENT_DATE`.** No scheduling UI. The fork row gets `start_date = today` (new column on `workout_programs`). Week number is computed as `FLOOR((today - start_date) / 7) + 1`. Coach assigns from the template's action menu or from the client detail page.

- **D-11 — Multi-client assignment in one action.** Coach selects clients via checkboxes (reusing the ComparisonChart selection pattern from Phase 26) and assigns in batch. Each client gets their own forked `workout_programs` row. Backend: `POST /coach/programs/:templateId/assign` accepts `{ client_ids: string[] }`, loops and inserts forks.

### Session Execution — Mobile (D-12 through D-14)

- **D-12 — "Commencer" deep-links to existing workout session screen.** When athlete taps the session preview on the Mon coach screen, navigate to `/(app)/workout/session` with params `{ programId, sessionId, weekNumber }`. The session screen pre-loads exercises from `weeks_data` but the athlete can edit before logging. Sessions log into `workout_sessions` + `session_sets` as normal — no new tables.

- **D-13 — "Programme prescrit" badge.** Prescribed sessions in the workout session screen show a read-only orange pill badge "Prescrit par [coach_display_name]". Implementation: check `workout_programs.created_by_coach_id IS NOT NULL` when the session is launched from the coach plugin.

- **D-14 — Weekly compliance widget.** Defined as: count of `workout_sessions` this ISO week WHERE the session was launched from an assigned program (detected via a `program_session_id` param stored in `workout_sessions` metadata JSONB or a new column). Denominator = count of sessions in `weeks_data` for the current week. Display: "3/5 séances cette semaine" + progress bar.

  > Researcher note: determine whether to add `source_program_id UUID` + `source_session_id TEXT` columns to `workout_sessions` or use the existing `notes JSONB` field for Phase 27 metadata.

### Shared Note (D-15 through D-16)

- **D-15 — `shared_note TEXT NULL` on `coach_client_links`.** New migration adds this column. Coach writes from `/coach/clients/[id]` — below the existing private `NotesPanel`, a new "Message partagé" textarea (max 500 chars) with a save button. Backend: `PUT /coach/clients/:clientId/shared-note` updates the `coach_client_links` row for that coach↔client pair.

- **D-16 — Athlete reads shared_note via existing `/coach/clients/links/me` endpoint.** The endpoint response already returns the `link` object — add `shared_note` to the response payload. Mobile `CoachScreen.tsx` (State C) renders it below the stats row: a quoted text block with a pencil icon (indicating it came from the coach). If null, the section is hidden.

### Programs Tab on Client Detail (D-17)

- **D-17 — Programs tab added to `/coach/clients/[id]` in Phase 27.** 8th tab alongside the existing 7. Shows: active assigned program (name, weeks completed, compliance %), a "Changer de programme" action, and program history (previous assignments). Backend: `GET /coach/clients/:id/programs` — queries `workout_programs` WHERE `assigned_to_user_id = clientId AND created_by_coach_id = coachId`.

### Claude's Discretion

- Exact Tailwind class layout of the week accordion (header height, chevron, indent level)
- Slide-over panel width and animation (right-side drawer vs bottom sheet on narrower viewports)
- Seed template list visual treatment (card vs list row, thumbnail icon)
- Compliance widget color thresholds on mobile (green ≥ 80%, orange 50–79%, red < 50%)
- Whether `/coach/programs` uses the same `CoachSidebar.tsx` "Programs" nav item (currently disabled) or a new entry

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project-level
- `.planning/PROJECT.md` — vision, bounded-contexts, v1.5 key decisions log
- `.planning/REQUIREMENTS.md` — §PROG-01..09, §MOBILE-02..04, §MOBILE-06
- `.planning/ROADMAP.md` — §Phase 27 success criteria (5 SCs), §Open Decisions table
- `.planning/STATE.md` — v1.5 completion through Phase 26

### Phase 22 (DB keystone)
- `.planning/phases/22-schema-foundation-rls-keystone/22-CONTEXT.md` — `is_coach_of()` shape, 11 cross-user SELECT policies
- `supabase/migrations/036_workout_programs_ai_imports.sql` — `workout_programs` extension columns + `ai_imports` table; Phase 27 extends this schema further

### Phase 23 (web foundation)
- `.planning/phases/23-web-turborepo-onboarding-auth-bootstrap/23-CONTEXT.md` — D-15 (`force-dynamic` + `cache:'no-store'` mandatory), D-11 (ESLint ban)

### Phase 24 (bounded module pattern)
- `.planning/phases/24-coach-identity-onboarding/24-CONTEXT.md` — D-08 bounded module shape: `service.ts` public entry, `db.ts` internal, `types.ts` internal
- `backend/api/src/coach/identity/{service.ts,db.ts,types.ts}` — reference shape

### Phase 25 (existing coach/clients routes)
- `.planning/phases/25-invitations-mobile-mon-coach-minimal/25-CONTEXT.md` — existing routes in `coach/clients/` and `coach/invitations/`
- `backend/api/src/coach/clients/service.ts` — extend with program-related routes
- `GET /coach/clients/links/me` — mobile CoachScreen endpoint; add `shared_note` to response

### Phase 26 (CRM patterns)
- `.planning/phases/26-crm-client-management/26-CONTEXT.md` — TanStack Table, Recharts, D-22 (all existing coach/clients routes), D-23 (web route group), ComparisonChart client-selection pattern (reuse for batch assignment)
- `apps/web/src/components/coach/RevokeConfirmModal.tsx` — typed-confirmation pattern (reuse for dangerous program actions)
- `apps/web/src/components/coach/CoachSidebar.tsx` — flip `disabled: false` on Programs nav entry

### Mobile workstream (Mon coach plugin — already delivered)
- `.planning/workstreams/milestone-mobile/phases/28-ui-design-mon-coach/28-CONTEXT.md` — design contract for CoachScreen States A/B/C
- `.planning/workstreams/milestone-mobile/phases/28-ui-design-mon-coach/028-UI-SPEC.md` — exact shadow values, colors, typography for mobile coach screens
- `plugins/coach/src/screens/CoachScreen.tsx` — existing 3-state implementation; Phase 27 EXTENDS State C (do not replace the existing 3-state logic)
- `plugins/coach/src/manifest.ts` — `mandatory: true` already set

### packages/coach-sdk
- `packages/coach-sdk/src/schemas/` — Phase 27 adds `ProgramWeekSchema`, `ProgramSessionSchema`, `ProgramExerciseSchema` here

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `plugins/coach/src/screens/CoachScreen.tsx` — working 3-state UX; extend State C (render block for today's session + shared_note + compliance widget) without touching State A/B logic
- `backend/api/src/coach/clients/{service.ts,db.ts,types.ts}` — extend with program-facing routes (don't create a new module; programs are in the `clients` module scope)
- `apps/web/src/components/coach/RevokeConfirmModal.tsx` — reuse for dangerous actions (remove assignment, delete template)
- `apps/web/src/components/coach/InvitationsTable.tsx` + `FilterChipGroup.tsx` — reference for table + filter-chip pattern on the programs list
- `apps/web/src/components/coach/SpecialtyTagInput.tsx` — clone for exercise typeahead (same debounce + chip pattern)
- `apps/web/src/app/[locale]/(coach)/coach/dashboard/page.tsx` — Server Component pattern with `force-dynamic` + `createServerSupabase()` — clone for all Phase 27 web pages
- `apps/web/src/components/coach/ClientsTable.tsx` — checkbox selection pattern; reuse for multi-client assignment batch select

### Established Patterns
- **Bounded module:** `backend/api/src/coach/<module>/{service.ts,db.ts,types.ts}` — service.ts only public entry
- **Per-request JWT:** `createUserClient(jwt)` in `db.ts`; `is_coach_of` RLS auto-applied for client reads
- **Server Component pages:** `force-dynamic` + `revalidate=0` + `cache:'no-store'` — mandatory on all coach routes
- **Mobile data fetching:** TanStack Query `useQuery` with supabase token in Authorization header
- **Mobile navigation:** `/(app)/workout/session` receives exercise pre-load params (check existing param shape in `apps/mobile/app/(app)/workout/session.tsx`)

### Integration Points
- **`CoachSidebar.tsx`** — flip Programs nav entry from `disabled: true` to `disabled: false`
- **Hono router `backend/api/src/index.ts`** — new `programsRouter` mounted at `/coach/programs`
- **`packages/coach-sdk`** — add Zod schemas for `ProgramWeek`, `ProgramSession`, `ProgramExercise`
- **`supabase/migrations/`** — next migration number after 044 (likely 045 for folders + `is_user_defined` on exercises + `start_date` + `shared_note` + `source_program_id` on workout_sessions)
- **`apps/mobile/app/(app)/workout/session.tsx`** — check existing param interface before adding `programId`/`sessionId` params

</code_context>

<specifics>
## Specific Ideas

- Week accordion layout (from discussion): `Week N [▼]` header → inside: `Mon  Upper Body A  [••• ►]` rows → `[+ Add session]` → `[+ Add week]` at list bottom
- Coach-created exercises are saved to the shared `exercises` table with `is_user_defined = TRUE` — visible to all users (same as Ziko library)
- Assignment is immediate: `start_date = CURRENT_DATE`. Week number = `FLOOR((today - start_date) / 7) + 1`
- Shared note written from client detail page — "Message partagé" textarea below the existing private NotesPanel, max 500 chars
- Shared note read on mobile CoachScreen State C — rendered as a quoted block below the stats row, hidden if null
- "Contact coach" CTA opens `mailto:` with the coach's auth email (already in preview payload via `coach_profiles`)
- Seed templates in `supabase/seed.sql` under a system coach (`created_by_coach_id = NULL`), visible in a "Bibliothèque Ziko" section

</specifics>

<deferred>
## Deferred Ideas

- **Scheduled program start (future date)** — coach picks `start_date` on assignment; Phase 27 uses immediate start only
- **Athlete-side program library** — athlete browsing all Ziko seed templates independently; deferred post-v1.5
- **1RM comparison metric on ComparisonChart** — explicitly deferred from Phase 26; can be added in Phase 28+ when session_sets data is richer
- **Append-only shared notes log** — Phase 27 uses single overwrite on `coach_client_links.shared_note`; full history table deferred to v1.6
- **Bulk tag operations from programs** — Phase 26 deferred; still deferred

</deferred>

---

*Phase: 27-coaching-programs-mobile-mon-coach-full*
*Context gathered: 2026-05-20*
