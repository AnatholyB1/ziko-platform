# Phase 4: Mobile Consumption & Attribution - Context

**Gathered:** 2026-08-17
**Status:** Ready for planning

<domain>
## Phase Boundary

Athletes and coaches see real exercise media (GIF + thumbnail, now live in production from Phase 3) with correct bilingual instructions and mandatory attribution in the mobile app. This phase:

1. Replaces the fake "Démo · 0:42" / "HD" video placeholder on the exercise detail screen (`[exerciseId].tsx`) with the real 180×180 GIF
2. Adds thumbnail images to `ExercisePicker`'s list rows (currently text-only)
3. Creates a shared `<AttributedMedia>` component (`packages/ui/`) that structurally enforces the "© Gym visual — https://gymvisual.com/" credit and the 180×180 cap
4. Wires `instruction_steps` (JSONB, `{en: string[], fr: string[]}`, populated by Phase 3) into the existing numbered-steps UI, removing the fragile `JSON.parse`/`.split('\n')` fallback chain
5. Renders exercise name + instructions bilingually (FR/EN), following the existing `tExercise(name, nameFr)` pattern already established in `plugin-sdk/i18n.ts`
6. Bumps the TanStack Query key for exercise data (e.g. `['exercises', 'v2']`) so an already-installed client doesn't show a mix of old exercisedb.io media and new Storage media

No dataset fetching, matching, or merging happens in this phase — that's Phases 1–3 (done, live in production). No new import/backfill logic.

**Workflow note:** This phase is visual-heavy (attribution badge, hero media redesign, thumbnails). Per the user's established rule (UI-design-first), `/gsd:ui-phase` runs after this discussion, before `/gsd:plan-phase` — the chain for this run is discuss → ui-phase → plan → execute, not the default discuss → plan → execute.

</domain>

<decisions>
## Implementation Decisions

### Hero media treatment (exercise detail screen)
- **D-01:** The hero reshapes to a **square (1:1) card, full width** — not the current 16:9 frame. The real asset is a 180×180 square GIF; a square hero avoids both letterboxing and upscale-cropping, and stays honest to MEDIA-03's "never upscale" constraint (cropping/scaling a 180×180 asset to fill a 16:9 frame would visually violate that spirit even though no actual upscale occurs).
- **D-02:** All fake video chrome is **stripped** — no play-button overlay, no "HD" badge, no "Démo · 0:42" duration text. None of it is true for a GIF (no duration, no resolution tier, no play/pause state needed).
- **D-03:** The GIF **autoplays and loops continuously** by default — no static-thumbnail-then-tap-to-animate state. `thumb.png` is not shown on the detail screen at all (it's reserved for list-row thumbnails, see D-08); the hero always shows `animation.gif` directly.

### Attribution badge design (MOBILE-03)
- **D-04:** Attribution renders as a **small, semi-transparent, corner-anchored overlay** on the hero media (roughly where the old "HD" badge sat) — not a caption below the image, not a full-width banner.
- **D-05:** Attribution is shown **once per screen, on the primary/largest media instance** — on the exercise detail screen, that's the hero GIF. It is not repeated elsewhere on that screen.
- **D-06 (requirement-interpretation decision — flag for planner/verifier):** MOBILE-03's literal text says "chaque surface d'affichage de média" / every media-display surface, with the badge "structurally enforced" by `<AttributedMedia>`. The user explicitly chose to interpret this as **"no screen ever shows Gym visual media unattributed"** rather than "every individual media instance carries its own badge." Consequence: `ExercisePicker` list-row thumbnails do **not** go through `<AttributedMedia>` and show no attribution — only the detail screen's hero does. **This is a deliberate, discussed interpretation, not an oversight** — surface it explicitly if `/gsd:code-review` or `/gsd:secure-phase` later flags list thumbnails as missing attribution.

### Missing-media fallback
- **D-07:** When an exercise has no `image`/`gif` (currently 6 unmatched-new exercises, and any future `needs_review` legacy rows per Phase 3's IMPORT-05 handling), the detail hero shows a **neutral icon placeholder** (e.g. dumbbell icon on `theme.surface` background) in the same square slot — the hero block is never hidden/collapsed. **No attribution badge renders** in this case, since there is no Gym visual asset to credit.
- **D-08:** `ExercisePicker` rows for exercises with no thumbnail show the **same neutral icon placeholder** at thumbnail size, in the same slot a real thumbnail would occupy — row layout/alignment stays uniform whether or not media exists.

### ExercisePicker thumbnail layout
- **D-09:** Thumbnails are **small rounded-square** (~40×40px, matching the app's existing card corner-radius convention), positioned to the **left of the checkbox** in each row. Uses `image` (the static `thumb.png`), not the animated GIF — list rows should not auto-animate.

### Claude's Discretion
- Exact corner placement of the attribution overlay (top-left vs bottom-right etc.) and its precise opacity/typography — directional intent (small, semi-transparent, corner-anchored) is locked; exact pixel values are a UI-phase/implementation detail.
- Exact icon choice for the missing-media placeholder (dumbbell vs generic image icon vs other) — "neutral fitness-related icon" is the intent.
- Instructions fallback when `instruction_steps` is null/missing for a given exercise (e.g. the 6 unmatched-new rows, before any future backfill) — whether to fall back to the plain `instructions`/`instructions_fr` TEXT columns as a single unstructured block, or show an empty/"no instructions yet" state. Research/planner should pick the safest option that satisfies MOBILE-04's "remove the fragile fallback chain" intent without regressing to zero content for those rows.
- Exact scope of which TanStack Query keys get version-bumped (MOBILE-06) — at minimum `['exercise', exerciseId]` (detail screen) and `['exercises-picker']` (ExercisePicker) need to move to a versioned key per the requirement's literal example (`['exercises', 'v2']`); confirm during planning whether `workoutStore.ts`'s inline Supabase queries (not currently TanStack-Query-cached) are in scope or out of scope for this requirement.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements & Roadmap
- `.planning/workstreams/image-exo/REQUIREMENTS.md` — MOBILE-01 through MOBILE-06 (this phase's mapped requirements, all locked, no SPEC.md exists for this phase)
- `.planning/workstreams/image-exo/ROADMAP.md` §"Phase 4: Mobile Consumption & Attribution" — success criteria this phase must satisfy; `UI hint: yes`

### Prior phase context (schema this phase consumes)
- `.planning/workstreams/image-exo/phases/03-merge-human-approved-write/03-CONTEXT.md` — D-01/D-02 (full-refresh merge semantics, so `image`/`gif`/`instructions_fr`/`instruction_steps` are all populated for the 1,318 matched rows)
- `.planning/workstreams/image-exo/phases/01-schema-storage-foundation/01-CONTEXT.md` — D-01/D-02 (`image`/`gif` columns store **relative storage paths**, not full URLs — mobile must build the public URL client-side via the Supabase Storage client), D-03/D-04 (folder-per-`exercise_id`, fixed filenames `thumb.png`/`animation.gif`)
- `supabase/migrations/20260815_exercises_merge_backup_and_i18n.sql` — live schema: `instructions_fr TEXT`, `instruction_steps JSONB` (stores the dataset's `{en: string[], fr: string[]}` shape verbatim)
- `.planning/workstreams/image-exo/reports/merge-run.md` — confirms live data state: 1,318/1,324 rows have `instructions_fr`/`instruction_steps` populated; 6 unmatched-new exercises are the gap this phase's fallback (D-07/D-08) must handle gracefully

### Project-level i18n & UX conventions
- `packages/plugin-sdk/src/i18n.ts` — `useI18nStore` (locale state, default `'fr'`) and `useTranslation()`'s `tExercise(name, nameFr)` helper (lines ~1706-1751). This is the established bilingual-name pattern this phase's instructions rendering (MOBILE-05) should mirror — likely a new `tExerciseInstructions` or inline `instruction_steps[locale] ?? instruction_steps.en` lookup following the same fallback shape.
- `supabase/migrations/011_name_fr.sql` / `031_exercises_name_fr.sql` — precedent for the `name`/`name_fr` split that `instructions`/`instructions_fr` mirrors.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `apps/mobile/app/(app)/workout/exercise/[exerciseId].tsx` — the file being modified; hero block is lines ~200-297 (fake video placeholder to be replaced), instructions parsing is lines ~125-136 (the fragile `JSON.parse`/`.split('\n')` fallback chain MOBILE-04 removes), tab rendering (`Consignes` tab, lines ~460-536) is where `instruction_steps` gets wired in.
- `apps/mobile/src/components/ExercisePicker.tsx` — row rendering is lines ~239-311; thumbnail slot needs to be added before the existing checkbox (line ~273).
- `packages/plugin-sdk/src/i18n.ts` — `tExercise(name, nameFr)` (line 1728) is the direct pattern to extend for bilingual instructions.
- No `<AttributedMedia>` component exists yet anywhere in `packages/ui/` — this phase creates it from scratch as a new shared component.

### Established Patterns
- Card styling convention used throughout the app (seen in both files above): `borderRadius: 14`, `theme.surface` background, `theme.border` 1px border, `shadowOpacity: 0.08`/`shadowRadius: 12`/`elevation: 3` (per project's design-prototype-mockup memory — cards in shadow, not flat).
- `theme.primary` (`#FF5C1A`) used for active/highlighted accents throughout both files (tab underline, checkbox fill, tag highlight).
- `useThemeStore((s) => s.theme)` — light-sport-theme-only convention (no dark mode), used in every screen touched by this phase.
- Supabase Storage public-bucket pattern: DB stores relative paths (Phase 1 D-02), client builds public URLs via `supabase.storage.from('exercise-media').getPublicUrl(path)`.

### Integration Points
- `public.exercises.image`/`.gif` (relative Storage paths, populated Phase 1+3) — this phase's data source for real media.
- `public.exercises.instructions_fr`/`.instruction_steps` (JSONB) — this phase's data source for bilingual structured instructions.
- `['exercise', exerciseId]` query key in `[exerciseId].tsx` (line 34) and `['exercises-picker']` in `ExercisePicker.tsx` (line 46) — both currently unversioned, both need the MOBILE-06 version bump.
- `workoutStore.ts` — has inline Supabase `.select('*, ...exercises(name, name_fr, muscle_groups...))` calls (not wrapped in `useQuery`) in 3 places — flagged above as a Claude's Discretion item for whether these are in scope for query-key versioning (they use direct fetch, not TanStack cache, so "versioning" may not apply the same way).

</code_context>

<specifics>
## Specific Ideas

- The square-hero decision (D-01) was driven directly by the mismatch between the existing 16:9 "video" card design (built for a placeholder that never had a real video) and the actual delivered asset shape (180×180 square GIF) — the user chose honesty-to-the-asset over preserving the old card's aspect ratio.
- D-06 is the most consequential decision in this phase: it's an explicit, discussed narrowing of MOBILE-03's literal wording. Any future audit (code review, security/legal review) that flags "list thumbnails have no attribution" should be checked against this decision before being treated as a bug.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope. Every discussed area was a "how to implement this phase's media/attribution/fallback mechanics" question, not a new capability. No scope-creep items came up.

</deferred>

---

*Phase: 4-Mobile Consumption & Attribution*
*Context gathered: 2026-08-17*
