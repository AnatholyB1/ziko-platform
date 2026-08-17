---
phase: 27-coaching-programs-mobile-mon-coach-full
verified: 2026-05-21T00:00:00Z
status: gaps_found
score: 10/13 must-haves verified
overrides_applied: 0
fixed_post_initial_verification:
  - truth: "Programs list page delete and duplicate actions are wired to backend API (PROG-05 list actions)"
    fixed: "2026-05-21"
    fix: "handleDelete calls DELETE /coach/programs/:id?confirmed=true; handleDuplicate calls POST /coach/programs/:id/duplicate. accessToken + apiUrl props added to ProgramsClient and passed from page.tsx."
gaps:
  - truth: "Athlete sees today's prescribed session preview in Mon coach State C and can tap to start it"
    status: failed
    reason: "CoachScreen.tsx State C block (lines 478-561) contains no today's session preview, no program query, no 'Commencer' deep-link navigation. Feature entirely absent from mobile codebase."
    artifacts:
      - path: "plugins/coach/src/screens/CoachScreen.tsx"
        issue: "State C renders only coach card, stats row, linked-since date, and revoke button. No today's session block exists."
    missing:
      - "Query assigned program via GET /coach/clients/links/me or a dedicated endpoint returning today's session"
      - "Render session name, day_of_week, exercise count in State C"
      - "Commencer button that deep-links to /(app)/workout/session with programId/sessionId params"

  - truth: "Athlete sees a weekly compliance widget ('75% cette semaine') in Mon coach State C"
    status: failed
    reason: "No compliance widget exists anywhere in CoachScreen.tsx. The backend computes compliance_pct on GET /coach/clients/:id/programs (for the coach view), but there is no mobile endpoint that exposes compliance to the athlete."
    artifacts:
      - path: "plugins/coach/src/screens/CoachScreen.tsx"
        issue: "No compliance widget rendered. No useQuery for compliance data."
    missing:
      - "Athlete-facing compliance data in /coach/clients/links/me response or a dedicated athlete-program endpoint"
      - "Compliance widget component in CoachScreen State C"

  - truth: "Athlete sees coach's latest shared note in Mon coach State C (hidden when null)"
    status: failed
    reason: "CoachScreen.tsx makes no request for shared_note. Additionally, getActiveLink in backend/api/src/coach/clients/db.ts selects only 'id, coach_id, client_id, created_at' from coach_client_links — shared_note column is NOT included in the query, so even if mobile requested it the response would not contain it."
    artifacts:
      - path: "plugins/coach/src/screens/CoachScreen.tsx"
        issue: "No shared_note query, no LinkStatusResponse.link.shared_note field, no quoted block rendering."
      - path: "backend/api/src/coach/clients/db.ts"
        issue: "getActiveLink selects only 'id, coach_id, client_id, created_at' — shared_note excluded from query (line 63-64)."
    missing:
      - "Add shared_note to getActiveLink SELECT clause"
      - "Add shared_note to LinkRow interface"
      - "Render quoted shared_note block in CoachScreen State C (hidden when null)"

  - truth: "Athlete can tap a Contact coach CTA that opens mailto: with coach's signup email"
    status: failed
    reason: "No contact CTA exists in CoachScreen.tsx State C. No mailto: handler. Coach email is not included in the /coach/clients/links/me response."
    artifacts:
      - path: "plugins/coach/src/screens/CoachScreen.tsx"
        issue: "State C has no contact button, no Linking.openURL('mailto:...') call."
    missing:
      - "Expose coach's email in /coach/clients/links/me response (from auth.users or coach_profiles)"
      - "Add contact CTA TouchableOpacity in State C with Linking.openURL('mailto:'+coachEmail)"

  - truth: "Prescribed session badge shown on workout sessions that originate from assigned coaching program (MOBILE-03)"
    status: failed
    reason: "apps/mobile/app/(app)/workout/session.tsx has no source_program_id param handling and no 'Prescrit par [coach]' badge rendering. The word 'prescribed' in this file refers to pre-existing AI program fields (prescribed_reps, prescribed_weight_kg), not coach-assigned program badges."
    artifacts:
      - path: "apps/mobile/app/(app)/workout/session.tsx"
        issue: "No coach-prescribed badge. No source_program_id or programId param intake."
    missing:
      - "Accept programId/sessionId params when navigating from CoachScreen"
      - "Render orange 'Prescrit par [coach_name]' badge when session originated from an assigned program"

  - truth: "Programs list page delete and duplicate actions are wired to backend API (PROG-05 list actions)"
    status: fixed
    fix: "handleDelete calls DELETE /coach/programs/:id?confirmed=true with window.confirm guard + router.refresh(). handleDuplicate calls POST /coach/programs/:id/duplicate + router.refresh(). accessToken + apiUrl props added to ProgramsClient."

deferred: []
human_verification:
  - test: "Open Mon coach in mobile app with an active coach link and an assigned program — verify today's session preview appears with a Commencer button"
    expected: "Session name, day-of-week, exercise count visible; tapping Commencer navigates to workout session pre-loaded with program exercises"
    why_human: "Mobile UI runtime behavior; cannot verify without running Expo app"
  - test: "Open a workout session started from an assigned coaching program — verify 'Prescrit par [coach name]' orange badge appears"
    expected: "Orange pill badge 'Prescrit par [display_name]' is visible at the top of the session screen"
    why_human: "Requires running Expo app with real coach-linked data"
---

# Phase 27: Coaching Programs & Mobile "Mon coach" Full — Verification Report

**Phase Goal:** A coach can author program templates, assign forked copies to linked clients, and the assigned athlete sees and executes the program in the mobile app.
**Verified:** 2026-05-21
**Status:** gaps_found
**Re-verification:** No — initial verification

## Goal Achievement

The coach-side web program builder (Track A) is substantially complete. The mobile "Mon coach" State C enrichment (Track B) was not implemented — all five mobile requirements (MOBILE-02, MOBILE-03, MOBILE-04, MOBILE-06, and the mobile half of PROG-09) are absent from the codebase.

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Coach can create multi-week template with metadata at /coach/programs/new | VERIFIED | `programs/new/page.tsx` exists; POST / in service.ts with Zod validation of weeks_data |
| 2 | weeks_data JSONB validated against ProgramWeekSchema hierarchy (sets/reps/RPE/RIR/rest) | VERIFIED | `z.array(ProgramWeekSchema).safeParse()` in service.ts POST / and PUT /:id; schemas match D-04/D-05 exactly |
| 3 | Exercises from 1000+ Ziko library searchable; free-text exercises creatable with is_user_defined=TRUE | VERIFIED | `searchExercises` + `createExercise` in db.ts; ExerciseTypeahead.tsx with 300ms debounce + POST /exercises |
| 4 | Templates organizable into folders (coach_program_folders table, folder_id on workout_programs) | VERIFIED | Migration 045 creates `coach_program_folders`; folder CRUD in service.ts + db.ts; folder rail in ProgramsClient.tsx |
| 5 | Coach can duplicate template, week, or session via context menu | VERIFIED | `POST /:id/duplicate` route wired; `handleDuplicateWeek` + `handleDuplicateSession` callbacks in ProgramEditorClient.tsx using structuredClone |
| 6 | Coach assigns template to multiple clients (fork-on-assign, is_template=FALSE, start_date=today) | VERIFIED | `POST /:id/assign` accepts `{client_ids}`; inserts forked rows with template_source_id, start_date=CURRENT_DATE; AssignmentModal.tsx wired in ProgramEditorClient |
| 7 | Edits to assigned program do not touch source template | VERIFIED | updateProgram WHERE eq('created_by_coach_id', coachId) + eq('is_template', false) would only match the fork; editor prevents loading templates for edit |
| 8 | 5 expert seed templates (PPL, 5/3/1, Hyrox, Body-recomp, Beginner) visible to coaches in Bibliothèque Ziko | VERIFIED | Migration 046 inserts 5 seed rows (is_template=TRUE, created_by_coach_id=NULL); ProgramsClient.tsx renders BIBLIOTHÈQUE ZIKO section |
| 9 | Programs tab added to client detail with compliance display and shared note editor | VERIFIED | `clients/[id]/programs/page.tsx` + `ClientProgramsContent.tsx` exist; compliance bar with color thresholds; SharedNoteEditor with PUT to /coach/clients/:clientId/shared-note |
| 10 | Today's session preview in Mon coach State C (MOBILE-02) | FAILED | CoachScreen.tsx State C has no session preview block, no program query |
| 11 | Weekly compliance widget in Mon coach State C (MOBILE-04 partial) | FAILED | No compliance widget in CoachScreen.tsx; no mobile-facing compliance endpoint |
| 12 | Coach's shared_note rendered in Mon coach State C (MOBILE-04 partial) | FAILED | getActiveLink does not return shared_note; CoachScreen has no shared_note render |
| 13 | Contact coach CTA opening mailto: (MOBILE-06) | FAILED | No CTA in CoachScreen.tsx; coach email not exposed in /coach/clients/links/me |
| — | Prescribed badge on coach-assigned workout sessions (MOBILE-03) | FAILED | workout/session.tsx has no source_program_id param intake or coach badge rendering |

**Score:** 9/13 truths verified (mobile Track B entirely unimplemented)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `supabase/migrations/045_coaching_programs_schema.sql` | Schema: folders, columns, RLS | VERIFIED | All 10 items confirmed |
| `supabase/migrations/046_coaching_programs_seeds.sql` | 5 seed templates | VERIFIED | 5 rows + user_id nullable |
| `packages/coach-sdk/src/schemas/program-exercise.ts` | ProgramExerciseSchema .strict() D-04 | VERIFIED | 9 fields match spec exactly |
| `packages/coach-sdk/src/schemas/program-session.ts` | ProgramSessionSchema .strict() D-05 | VERIFIED | 4 fields match spec |
| `packages/coach-sdk/src/schemas/program-week.ts` | ProgramWeekSchema .strict() D-05 | VERIFIED | Matches spec |
| `backend/api/src/coach/programs/db.ts` | 11 DB functions | VERIFIED | All 11 present |
| `backend/api/src/coach/programs/service.ts` | 11 routes under /coach/programs | VERIFIED | All 11 registered; static before param |
| `apps/web/src/components/coach/WeekAccordion.tsx` | Collapsible accordion with context menus | VERIFIED | onDuplicateWeek, onDuplicateSession, onDeleteWeek wired |
| `apps/web/src/components/coach/SessionSlideOver.tsx` | 480px right panel with exercise table | VERIFIED | Exists with exercise CRUD |
| `apps/web/src/components/coach/ExerciseTypeahead.tsx` | Debounced search + create | VERIFIED | 300ms debounce, create option, aria roles |
| `apps/web/src/components/coach/AssignmentModal.tsx` | Batch client assignment | VERIFIED | IndeterminateCheckbox, batch POST |
| `apps/web/src/components/coach/ProgramCard.tsx` | Card with context menu + delete confirmation | VERIFIED | Typed-confirmation delete; context menu |
| `apps/web/src/app/[locale]/(coach)/coach/programs/page.tsx` | Programs list Server Component | VERIFIED | force-dynamic, parallel fetch |
| `apps/web/src/app/[locale]/(coach)/coach/programs/new/page.tsx` | New program form | VERIFIED | 5 fields, POST on submit |
| `apps/web/src/app/[locale]/(coach)/coach/programs/[id]/page.tsx` | Program editor page | VERIFIED | Server Component + ProgramEditorClient |
| `apps/web/src/components/coach/ClientTabStrip.tsx` | 8 tabs including Programs | VERIFIED | 8th tab `{key: 'programs'}` confirmed |
| `apps/web/src/app/[locale]/(coach)/coach/clients/[id]/programs/page.tsx` | Client programs tab | VERIFIED | compliance bar, shared note, program history |
| `apps/web/src/app/[locale]/(coach)/coach/programs/ProgramsClient.tsx` | Programs list client with wired actions | VERIFIED | handleDelete + handleDuplicate wired to backend API (fixed 2026-05-21) |
| `plugins/coach/src/screens/CoachScreen.tsx` State C | Today's session, compliance, shared_note, contact CTA | MISSING | State C block (lines 478-561) has none of these features |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `programsRouter` | `backend/api/src/app.ts` | `app.route('/coach/programs', programsRouter)` | WIRED | Line 60 of app.ts |
| `ProgramEditorClient.tsx` | `AssignmentModal.tsx` | import + `assignModalOpen` state | WIRED | Line 5 + 307 |
| `WeekAccordion.tsx` | `ProgramEditorClient.tsx` | `onDuplicateWeek/Session` callbacks | WIRED | Callbacks defined + passed at line 289-291 |
| `getActiveLink` | `coach_client_links.shared_note` | SELECT clause | NOT WIRED | Selects only `id, coach_id, client_id, created_at`; shared_note excluded |
| `CoachScreen.tsx` State C | assigned program today's session | useQuery to assigned-program endpoint | NOT WIRED | No such query exists in CoachScreen |
| `ProgramsClient.tsx` | `DELETE /coach/programs/:id` | handleDelete fetch call | WIRED | window.confirm + DELETE ?confirmed=true + router.refresh() |
| `ProgramsClient.tsx` | `POST /coach/programs/:id/duplicate` | handleDuplicate fetch call | WIRED | POST /:id/duplicate + router.refresh() |

### Requirements Coverage

| Requirement | Description | Status | Evidence |
|-------------|-------------|--------|---------|
| PROG-01 | Create template with metadata, is_template=TRUE | SATISFIED | POST / in service.ts; programs/new/page.tsx |
| PROG-02 | Multi-week structure with exercises, RPE/RIR, rest | SATISFIED | ProgramWeekSchema hierarchy; weeks_data JSONB; SessionSlideOver exercise table |
| PROG-03 | Exercise library search + free-text creation | SATISFIED | searchExercises + createExercise; ExerciseTypeahead.tsx |
| PROG-04 | Organize templates into folders | SATISFIED | coach_program_folders table; folder CRUD routes; folder rail in ProgramsClient |
| PROG-05 | Duplicate template/week/session via context menu | SATISFIED | Week/session duplicate wired in ProgramEditorClient+WeekAccordion; template duplicate + delete from programs list now wired in ProgramsClient.tsx (fixed 2026-05-21) |
| PROG-06 | Assign to multiple clients, fork-on-assign | SATISFIED | POST /:id/assign; AssignmentModal; RLS INSERT policy |
| PROG-07 | Edit assigned program without touching template | SATISFIED | updateProgram scoped to created_by_coach_id + is_template=false |
| PROG-08 | 5-10 expert seed templates visible on signup | SATISFIED | Migration 046 inserts 5 seeds; BIBLIOTHÈQUE ZIKO section in ProgramsClient |
| PROG-09 | Athlete sees assigned program in Mon coach, can execute sessions | BLOCKED | Mobile State C has no program display. CoachScreen does not fetch assigned program. Workout session has no coach-program param handling or prescribed badge. |
| MOBILE-02 | Today's session preview from assigned program | BLOCKED | Not implemented in CoachScreen.tsx |
| MOBILE-03 | "Programme prescrit par [coach]" badge on workout sessions | BLOCKED | Not implemented in workout/session.tsx |
| MOBILE-04 | Weekly compliance widget + coach's latest shared note | BLOCKED | Neither exists in CoachScreen.tsx; shared_note not in getActiveLink response |
| MOBILE-06 | Contact coach CTA → mailto: | BLOCKED | Not implemented in CoachScreen.tsx |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
*(no anti-patterns remaining in Track A)*

### TypeScript Status

| Project | Result |
|---------|--------|
| `apps/web/tsconfig.json` | 1 error — pre-existing in `apps/web/test/safe-next.spec.ts` (TS2339 `safeNext` missing); unrelated to Phase 27 |
| `backend/api/tsconfig.json` | 0 errors — clean |

### Human Verification Required

#### 1. Mobile Coach Screen State C — Feature Availability
**Test:** Once gaps are closed, open Mon coach in mobile app with an active coach link and an assigned program. Verify today's prescribed session preview appears with name, exercises count, and a "Commencer" button.
**Expected:** Session card visible below coach card; tapping Commencer navigates to workout/session with exercises pre-loaded from weeks_data
**Why human:** Mobile UI runtime behavior requires running Expo app with real Supabase data

#### 2. Prescribed Badge on Workout Sessions
**Test:** Once gaps are closed, start a workout session from the CoachScreen "Commencer" button with a coach-assigned program. Verify the prescribed badge appears.
**Expected:** Orange pill "Prescrit par [coach_display_name]" visible in session header
**Why human:** Requires Expo runtime with linked coach data

### Gaps Summary

**Track A (Web Program Builder)** is 95% complete. The only gap is that `ProgramsClient.tsx` has stub `handleDelete` and `handleDuplicate` functions (console.log only) that were supposed to be wired in Plan 27-07 but were not. Delete and duplicate from the programs list page are non-functional.

**Track B (Mobile State C enrichment)** was not implemented at all across all 8 plans (27-00 through 27-07). None of the following features exist in the mobile codebase:

- Today's prescribed session preview (MOBILE-02, PROG-09)
- Weekly compliance widget — "75% cette semaine" (MOBILE-04)
- Coach's shared_note rendered in State C (MOBILE-04) — additionally the backend `getActiveLink` does not return `shared_note` in its query
- "Contact coach" CTA opening `mailto:` (MOBILE-06)
- "Prescrit par [coach]" badge on workout sessions launched from assigned programs (MOBILE-03)

The phase goal states "the assigned athlete sees and executes the program in the mobile app" — this half of the goal is entirely undelivered.

---

_Verified: 2026-05-21_
_Verifier: Claude (gsd-verifier)_
