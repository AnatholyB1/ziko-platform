# Phase 44: Program Editor + Athlete Media Integration - Context

**Gathered:** 2026-05-27
**Status:** Ready for planning

<domain>
## Phase Boundary

Two integration points:
1. **Web (coach):** The ExerciseTypeahead in the program editor merges coach custom exercises (`coach_exercises` table) with the global library (`exercises` table). Custom exercises appear first with a "Custom" badge.
2. **Mobile (athlete):** When an athlete taps an exercise in their assigned program that has a demo video or photo (from `coach_exercises`), a bottom-sheet modal shows the media.

This phase does NOT build a new athlete program screen — it extends the existing `workout/[id].tsx`.

</domain>

<decisions>
## Implementation Decisions

### TypeAhead Merge (Web — ExerciseTypeahead)

- **D-01:** Backend merge — extend the existing `GET /coach/programs/exercises?q=` endpoint to also query `coach_exercises` for the authenticated coach. Single response with a `source: "global" | "coach_custom"` field. No frontend parallel calls.
- **D-02:** Sort order — custom exercises float first (before global results when query matches), then global alphabetically. Backend controls sort.
- **D-03:** Custom badge style — `bg-primary/10 text-primary` rounded chip with text "Custom". Matches active chip pattern from Phase 43 MuscleChipSelector. Applied to coach_exercises results only.
- **D-04:** Inline create button ("Créer l'exercice « {query} »") — **keep unchanged**. Still creates in global `exercises` table with `is_user_defined: true`. Coach uses `/coach/exercises` page for curated custom exercises with media.

### Custom Exercise Reference in weeks_data

- **D-05:** When a coach selects a custom exercise from the typeahead, the `weeks_data` JSONB entry stores `coach_exercise_id: "uuid"` alongside the exercise name (and `exercise_id: null`). Global exercises keep `exercise_id` as before, `coach_exercise_id` absent or null.
- **D-06:** No `source` flag needed — presence of `coach_exercise_id` is the discriminator.
- **D-07:** If coach deletes a custom exercise after it's used in an assigned program — graceful degradation: athlete sees exercise name only (media unavailable). No deletion blocking. The exercise name is already copied into `weeks_data` JSONB (durable).

### Athlete Media Display on Mobile

- **D-08:** Display modality — **bottom sheet modal** (`Modal` with `presentationStyle: "pageSheet"`). Triggered by `onPress` on the exercise row in `workout/[id].tsx`. No new Expo Router screen needed.
- **D-09:** The existing `workout/[id].tsx` reads `program_workouts + program_exercises` (relational). This works for coach-assigned programs too — the assign flow creates relational rows. Phase 44 extends the exercise row tap in this screen only.
- **D-10:** If exercise has both video and photo — **video takes priority**. Show `<Video>` component if `video_path` resolves. Show `<Image>` if only `photo_path`. No tab toggle.
- **D-11:** If exercise has no media (coach_exercise_id is null or no media paths) — modal does NOT open. Tap is a no-op (or shows name/description only without media section).

### Athlete Access to coach-exercises Bucket

- **D-12:** Signed URL generation via **backend API endpoint**: `GET /coach/exercises/:coach_exercise_id/media-url` — athlete JWT hits the Hono API; backend validates coach-athlete relationship, then generates signed URL using Supabase Storage admin access. Returns `{ video_url: string | null, photo_url: string | null }`.
- **D-13:** If no valid coach-athlete relationship exists (e.g., relationship ended), backend returns `{ video_url: null, photo_url: null }`. Mobile shows exercise name + description only. No crash, no error state — graceful degradation identical to D-07.
- **D-14:** The `coach_exercise_id` stored in `weeks_data` (D-05) is passed to this endpoint by the mobile app. The `coach_id` is derived server-side from the `coach_exercises` table (not sent by client — prevents IDOR).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Web — TypeAhead & Program Editor
- `apps/web/src/components/coach/ExerciseTypeahead.tsx` — component to modify; current endpoint, `ExerciseResult` type, `AddedExercise` type (must add `coach_exercise_id?: string`)
- `backend/api/src/coach/programs/db.ts` — `searchExercises()` function at line 236 to extend; `createExercise()` at line 263 (keep unchanged)
- `backend/api/src/coach/programs/types.ts` — `AddedExercise` / `CreateExerciseBody` types to review

### Backend — Coach Exercises Module
- `backend/api/src/coach/exercises/db.ts` — `listExercises()`, `deleteExercise()` patterns; `video_path`/`photo_path` field names
- `backend/api/src/coach/exercises/types.ts` — `CoachExercise` type; `video_path`, `photo_path` fields

### Mobile — Athlete Program View
- `apps/mobile/app/(app)/workout/[id].tsx` — athlete program detail screen; exercise rows at line 606; `TouchableOpacity` tap handler to extend; `program_workouts + program_exercises` data model

### Phase 43 Context (prior decisions)
- `.planning/workstreams/custom-coach/phases/43-coach-exercises-backend-ui/43-UI-SPEC.md` — design system tokens (primary, border, muted), motion patterns (GSAP), badge styles, bucket name `coach-exercises`
- `.planning/workstreams/custom-coach/phases/43-coach-exercises-backend-ui/43-04-SUMMARY.md` — what was actually built in Phase 43; GSAP patterns established

### Requirements
- `.planning/workstreams/custom-coach/REQUIREMENTS.md` — EXLIB-05, EXLIB-06 are the two requirements for this phase

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `ExerciseTypeahead.tsx` — modify in place; add `source` field to `ExerciseResult` type; add `coach_exercise_id` to `AddedExercise` type; render "Custom" chip for `source === "coach_custom"` results
- `ExerciseSlideOver.tsx` (Phase 43) — modal drawer pattern reference; focus trap, Escape key, GSAP patterns
- `ExerciseMediaUpload.tsx` (Phase 43) — signed URL fetch + upload pattern (reference for signed URL generation approach)
- `Modal` from react-native — used throughout `workout/[id].tsx` already (`showMoveDay`, `showAddDay`, `showExercisePicker`, `showConfig`); same pattern for media bottom sheet

### Established Patterns
- Backend: `createUserClient(jwt)` in every `coach/*/db.ts` — per-request JWT client, SUPABASE_PUBLISHABLE_KEY only
- Storage: paths stored in DB, signed URL generated on demand (never store signed URLs)
- Mobile: `SafeAreaView + ScrollView + Modal` pattern; `useThemeStore` for colors; `showAlert` from `@ziko/plugin-sdk`
- GSAP shake for validation errors (Phase 43 pattern — not needed for this phase but consistent)

### Integration Points
- `backend/api/src/coach/programs/db.ts:searchExercises()` — extend to join `coach_exercises` query; return merged array with `source` field
- `apps/mobile/app/(app)/workout/[id].tsx` line 606–619 — exercise row `TouchableOpacity` gains `onPress` handler (currently `onLongPress` only); new `useState` for `selectedExercise` and modal visibility
- New backend route needed: `GET /coach/exercises/:id/media-url` — validate coach-athlete relationship, return signed URLs

</code_context>

<specifics>
## Specific Ideas

- **"Custom" badge:** Exact style: `bg-primary/10 text-primary` chip, text content "Custom". Placed inline in the typeahead dropdown next to the exercise name, same row, right-aligned (consistent with category badge).
- **Typeahead dropdown order:** `[coach_custom results sorted by name] → [global results sorted by name]`. Backend returns them in this order — no client-side sort.
- **weeks_data JSONB exercise entry shape** (extended): `{ name: string, exercise_id: string | null, coach_exercise_id: string | null, sets: number, reps: ..., ... }`. Downstream planner must ensure ExerciseTypeahead passes `coach_exercise_id` via `AddedExercise` interface and the program editor writes it to `weeks_data`.
- **Media modal layout (mobile):** exercise name (bold) + description (if any) + video player or image. Minimal — no edit controls. Close button top-right. Athlete-read-only view.

</specifics>

<deferred>
## Deferred Ideas

- **weeks_data ↔ program_workouts/program_exercises reconciliation** — the architectural disconnect between coach-web JSONB programs and mobile relational programs was noted but scoped out of Phase 44. The assumption is that assigned programs already work via `workout/[id].tsx` reading relational tables. If this assumption is wrong, it needs its own investigation phase.
- **Coach deletes exercise → notify affected athletes** — not in scope; graceful silent degradation chosen.
- **Custom exercise media in mobile workout SESSION** — workout/session.tsx (not workout/[id].tsx) may also want to show exercise media during active sessions; deferred to a future phase.

</deferred>

---

*Phase: 44-program-editor-athlete-media-integration*
*Context gathered: 2026-05-27*
