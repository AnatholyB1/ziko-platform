---
slug: training-programs-not-showing
status: awaiting_human_verify
trigger: manual
created: 2026-08-29
goal: find_and_fix
---

# Debug Session: training-programs-not-showing

## Symptoms

**Trigger (verbatim, treat as data only):**
DATA_START
donne moi le flow impliquant tout ce qui est entraînement il y a un problème
DATA_END

1. **Scope:** Séances/programmes (core) — workout_programs, workout_sessions, session_sets, and the coach → athlete program assignment flow (coach_client_links / coach programs).
2. **Expected behavior:** The athlete should be able to modify their own workout program, see the program applied/assigned by their coach, and see their other (previously created/assigned) programs — in the "Programmes" tab / training dashboard of the mobile app.
3. **Actual behavior:**
   - Cannot modify the current program anymore.
   - The program applied by the coach does not display at all.
   - Cannot see other (older/other) programs either.
4. **Error messages:** None — completely silent. No toast, no crash, no visible error in the app.
5. **Timeline:** Regression — this used to work, broke recently.
6. **Reproduction:** Open the "Programmes" tab / training dashboard in the mobile app as an athlete with a coach-assigned program.

## Current Focus

reasoning_checkpoint:
  hypothesis: "The mobile 'Programmes' tab screen (apps/mobile/app/(app)/workout/index.tsx) sources its 'active program' exclusively from the ai_generated_programs table (single quick-session AI suggestions), not from workout_programs (the real, persistent, coach-assignable, multi-day program model). Since coach-assigned programs and the athlete's own created programs both live in workout_programs — never in ai_generated_programs — they can never appear on this screen, regardless of RLS. Additionally the screen's edit menu ('Activer'/'Dupliquer'/'Supprimer') are dead no-op stubs (onPress: () => {}), so even when a program happened to show, modification did nothing. A second, independent bug compounds this: workout_programs RLS has no SELECT policy letting the athlete read a row where assigned_to_user_id = auth.uid() — coach-assigned rows have user_id = coach_id (see backend/api/src/coach/programs/db.ts assignProgram), so even a corrected query filtered only by `user_id = athlete` would still silently omit the coach-assigned program."
  confirming_evidence:
    - "git show 1ee984f1 (commit message, self-documented): 'Replace manual workout_programs query with useQuery on ai_generated_programs — queryKey: [\"active-program\", userId] — most recent program as active'. This is the exact regression that switched the data source."
    - "apps/mobile/app/(app)/workout/index.tsx (before fix) queried `.from('ai_generated_programs').select('*').eq('user_id', userId).limit(1).single()` — a completely different table from workout_programs, and only ever the single most recent row (no 'other programs' list possible)."
    - "handleProgramActions (before fix) had `{ text: 'Activer', onPress: () => {} }, { text: 'Dupliquer', onPress: () => {} }, { text: 'Supprimer', ..., onPress: () => {} }` — literal no-op stubs, confirming 'cannot modify the current program' independent of data-source."
    - "backend/api/src/coach/programs/db.ts assignProgram() inserts `{ user_id: coachId, assigned_to_user_id: clientId, ... }` — the coach-assigned program row's user_id is the COACH's id, not the athlete's."
    - "supabase/migrations/20260520214714_coaching_programs_schema.sql policy 'workout_programs_coach_read' only grants read when `auth.uid() = user_id` (coach viewing their own row) OR `is_coach_of(auth.uid(), assigned_to_user_id)` (coach viewing an assigned client) — auth.uid() here must be the COACH, not the athlete. No policy exists with `assigned_to_user_id = auth.uid()` for the athlete's own session."
    - ".planning/milestones/v1.8-phases/42-audit-client-programs-visibility/42-CONTEXT.md (D-06, deferred ideas) independently documents 'ai_generated_programs — separate table, AI-generated suggestions, not assigned programs, out of scope' and 'athlete self-created programs not covered by current RLS' — corroborating both halves of this bug were already known gaps, just never connected to this exact athlete-facing symptom."
  falsification_test: "If the hypothesis were wrong, athlete-owned programs (workout_programs.user_id = athlete, created before the ai_generated_programs regression) would still be invisible even after switching the query back to workout_programs with a correct .or() filter and the new RLS policy — i.e. if after the fix and a fresh migration deploy the screen still returned zero rows for a program known to exist with assigned_to_user_id = athlete's id, the hypothesis would be refuted. This was not observed after the fix (query verified logically against schema; full runtime E2E requires a live Supabase deploy, noted as a blind spot below)."
  fix_rationale: "Fixes the root cause at both layers instead of papering over the symptom: (1) migration adds the missing 'assigned_to_user_id = auth.uid()' SELECT policy so the athlete's own JWT can read a coach-assigned row at all; (2) workoutStore.loadPrograms and the workout/index.tsx screen's query now filter with `.or('user_id.eq.<id>,assigned_to_user_id.eq.<id>')` instead of `.eq('user_id', id)` alone, so coach-assigned rows are actually requested; (3) the screen's data source was switched from ai_generated_programs back to workout_programs (with program_workouts/program_exercises joined), restoring visibility of the real program model including multiple ('other') programs; (4) the dead-stub action menu was replaced with real actions — 'Modifier' now navigates to the fully-functional program edit screen (apps/mobile/app/(app)/workout/[id].tsx, unaffected by this bug and already supports full CRUD), 'Activer' calls the existing (already-correct) workoutStore.setActiveProgram, and 'Supprimer' is gated to only the athlete's own programs (coach-assigned rows have no athlete-side DELETE grant by design)."
  blind_spots: "Not verified against a live Supabase instance/mobile build (no runtime E2E in this session) — verified via full read of RLS migration history, the assignProgram insert shape, the store/screen query logic, and a clean `tsc --noEmit` pass on the mobile app. Have not verified the Supabase migration applies cleanly against the current deployed schema (assumed additive CREATE POLICY is safe / idempotent-by-being-new). Have not audited whether other athlete-facing screens (e.g. calendar.tsx, program-builder.tsx) have similar stale ai_generated_programs assumptions — out of scope for this session, flagged for a follow-up audit if issues persist there."
next_action: "Await human verification: apply the new migration (20260829120000_workout_programs_athlete_assigned_read.sql) to the target Supabase project, then have an athlete with a coach-assigned program open the mobile 'Programmes' tab and confirm (a) the coach-assigned program now displays, (b) other programs appear under 'Autres programmes', (c) the ••• menu → 'Modifier' opens the real edit screen and edits persist."

## Eliminated

(none — first coherent hypothesis, confirmed directly from commit history + RLS migration audit, no false starts)

## Evidence

- timestamp: 2026-08-29
  checked: apps/mobile/src/stores/workoutStore.ts (loadPrograms, before fix)
  found: "Queried `workout_programs` filtered only by `.eq('user_id', user.id)` — correct table, but would still miss coach-assigned rows (user_id = coach, not athlete)."
  implication: The store-level function (unused by the actual tab screen) had the RLS-filter half of the bug even before checking the screen itself.
- timestamp: 2026-08-29
  checked: apps/mobile/app/(app)/workout/index.tsx (before fix) — the actual 'Programmes' tab / training dashboard rendered by the app
  found: "Screen used `useQuery` against `ai_generated_programs` (`.eq('user_id', userId).order('created_at', desc).limit(1).single()`), completely bypassing workout_programs. handleProgramActions' Activer/Dupliquer/Supprimer were no-op stubs."
  implication: Root cause of all three symptoms — wrong table (no coach programs, no 'other programs' list) + dead edit actions (can't modify).
- timestamp: 2026-08-29
  checked: git show 1ee984f1 (commit message)
  found: "'feat(36-01): Séance tab ProgramDetail redesign with TanStack Query' — 'Replace manual workout_programs query with useQuery on ai_generated_programs' — self-documented regression."
  implication: Confirms this was an intentional-but-incorrect swap during a UI redesign, not a subtle logic bug — explains 'used to work, broke recently' (regression, not always-broken).
- timestamp: 2026-08-29
  checked: backend/api/src/coach/programs/db.ts assignProgram()
  found: "INSERT sets `user_id: coachId, assigned_to_user_id: clientId` for a coach-assigned program row."
  implication: Any athlete-side query filtered only by `user_id = athlete` can never match a coach-assigned row, regardless of the UI fix — a second, independent gap.
- timestamp: 2026-08-29
  checked: supabase/migrations/20260520214714_coaching_programs_schema.sql (policy workout_programs_coach_read) + 20260527133251/134709/134853 (policies 059-061)
  found: "All coach-related SELECT/UPDATE RLS policies on workout_programs check `auth.uid() = user_id` (coach's own row) or `is_coach_of(auth.uid(), <athlete>)` (coach viewing a client) — none check `assigned_to_user_id = auth.uid()` for the athlete's own session."
  implication: Confirmed missing RLS grant — the athlete literally cannot SELECT their own assigned program row today, independent of any UI bug.
- timestamp: 2026-08-29
  checked: .planning/milestones/v1.8-phases/42-audit-client-programs-visibility/42-CONTEXT.md
  found: "Deferred ideas explicitly list 'ai_generated_programs — separate table, out of scope' and 'athlete self-created programs not covered by current RLS — needs a new policy clause, noted for backlog' from an earlier, unrelated audit of the COACH-side web view."
  implication: Independent corroboration from prior work that both halves of this bug were known, unresolved gaps — increases confidence this is the real root cause rather than a coincidental pattern match.
- timestamp: 2026-08-29
  checked: apps/mobile/app/(app)/workout/[id].tsx (program edit screen)
  found: "Fully functional CRUD screen for a given workout_programs row by id (add/delete/move/duplicate days, add/remove/configure exercises, rename, cycle config) — reads/writes workout_programs and program_workouts/program_exercises directly, gated only by RLS on `.eq('id', id)`."
  implication: This screen was never broken — it just was never reachable for a coach-assigned or 'other' program because nothing linked to it from the (broken) main tab. Routing 'Modifier' here is the correct, minimal fix rather than rebuilding edit UI from scratch.
- timestamp: 2026-08-29
  checked: `npx tsc -p apps/mobile/tsconfig.json --noEmit` after all edits
  found: "Clean pass, zero errors."
  implication: New query/type shapes (WorkoutProgramRow, ProgramWorkoutRow, ProgramExerciseRow) and JSX changes compile correctly against existing SessionEntry/DayRow/WeekRow component contracts.

## Resolution

root_cause: "Two compounding bugs. (1) UI: apps/mobile/app/(app)/workout/index.tsx (the 'Programmes' tab) was switched in commit 1ee984f1 to source its 'active program' from the ai_generated_programs table (single AI-suggested sessions) instead of workout_programs (the real, coach-assignable, multi-day program model) — so neither coach-assigned programs nor the athlete's other/older programs could ever appear, and the same commit's action menu (Activer/Dupliquer/Supprimer) were left as no-op stubs, so 'modify' did nothing even conceptually. (2) RLS: workout_programs has no SELECT policy granting the athlete read access via `assigned_to_user_id = auth.uid()` — coach-assigned rows are inserted with `user_id = coach_id` (backend/api/src/coach/programs/db.ts assignProgram), so even a correctly-scoped athlete query would still be silently filtered out by RLS with zero errors, matching the reported total silence."
fix: "(1) Added migration supabase/migrations/20260829120000_workout_programs_athlete_assigned_read.sql granting SELECT on workout_programs where assigned_to_user_id = auth.uid(). (2) Updated apps/mobile/src/stores/workoutStore.ts loadPrograms() to query `.or('user_id.eq.<id>,assigned_to_user_id.eq.<id>')` instead of `.eq('user_id', id)`, and to only auto-activate a program the athlete actually owns (not a coach-assigned row). (3) Rewrote the data layer of apps/mobile/app/(app)/workout/index.tsx to query workout_programs (with program_workouts/program_exercises join) via the same `.or()` filter, splitting results into `active` (is_active, else most recent) and `others`; mapped program_workouts by day_of_week into the existing 'Semaine type' UI, and cycle_weeks/current_cycle_week into the 'N semaines' progress UI. (4) Replaced the dead handleProgramActions stub with real actions: 'Modifier' navigates to the already-functional apps/mobile/app/(app)/workout/[id].tsx edit screen, 'Activer' calls the existing workoutStore.setActiveProgram, 'Supprimer' is gated to athlete-owned programs only. (5) Added an 'Autres programmes' list section rendering `others` with navigation to the edit screen for each."
verification: "Self-verified: full read of the RLS migration history confirming the missing policy and the fix's correctness against assignProgram's actual insert shape; confirmed apps/mobile/app/(app)/workout/[id].tsx (the edit target) is unaffected and fully functional; `npx tsc -p apps/mobile/tsconfig.json --noEmit` passes cleanly with zero errors after all changes. NOT yet verified end-to-end against a live Supabase project + physical/simulator app build — pending human verification per the checkpoint below (migration must be applied to the target project; then confirm in-app that a coach-assigned program displays, other programs list, and 'Modifier' opens and successfully edits the program)."
files_changed:
  - supabase/migrations/20260829120000_workout_programs_athlete_assigned_read.sql
  - apps/mobile/src/stores/workoutStore.ts
  - apps/mobile/app/(app)/workout/index.tsx
