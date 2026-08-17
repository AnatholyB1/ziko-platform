# Feature Research

**Domain:** Exercise library data + media import (licensed third-party dataset replacing/enriching an existing exercise catalogue)
**Researched:** 2026-08-14
**Confidence:** MEDIUM-HIGH (attribution requirement verified directly from source NOTICE.md; UX conventions verified against comparable licensed-media integrations and comparable fitness exercise libraries; some claims are inference from analogous domains, flagged where so)

## Feature Landscape

### Table Stakes (Users Expect These)

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Render actual exercise media (GIF demo + static thumbnail) in exercise detail and pickers | Current `ExercisePicker.tsx` renders **no image at all** (text rows only), and `[exerciseId].tsx` shows a fake black "video placeholder" with a play icon and `Démo · 0:42` / `HD` badges that don't correspond to any real asset. Once real media exists, not showing it is a regression, not neutral. | MEDIUM | Dataset provides GIF (animated) + 180×180 JPG thumbnail, **not video** — the existing placeholder's video framing (duration badge, "HD" badge, play button) is now factually wrong and must be replaced with GIF-appropriate UI (e.g. static thumbnail with tap-to-animate or autoplay-on-view), not just re-skinned. |
| Visible, license-compliant attribution wherever Gym visual media is displayed | Hard legal requirement, not optional — NOTICE.md states the attribution `"© Gym visual — https://gymvisual.com/"` **"must accompany every use of the media,"** and cannot be removed or altered. Comparable precedent: Unsplash's API terms require attribution to appear directly in the UI surface where the photo appears, not just in a legal/credits page — apps that only linked from a global page were flagged as non-compliant by Unsplash itself. | MEDIUM | Must appear on **every rendering surface**: exercise detail screen media block, exercise list/picker rows (once thumbnails are added there), and any workout/session screens or coach program editors that surface exercise thumbnails. A single "Mentions légales" line is necessary but **not sufficient** on its own — see Attribution UX section below. |
| Data-driven filter taxonomy (body_part, equipment, target muscle, muscle_group) | `ExercisePicker.tsx` currently uses a **hardcoded** `FILTER_CHIPS` array (`['Favoris', 'Pectoraux', 'Dos', 'Jambes', 'Épaules', 'Bras', 'Abdos']`) with string-matching logic against `target_muscle`/`muscle_groups`. This breaks/under-represents once the richer, more granular dataset taxonomy (body_part + equipment + target + muscle_group + secondary_muscles) lands — users expect filters to reflect what's actually in the catalogue, matching the pattern in comparable exercise libraries (Hevy, ExerciseDB-style APIs) where filtering by muscle group and equipment is table stakes. | MEDIUM | Filter chips should be generated from distinct DB values, not hardcoded — requires an FR label mapping for chip display text (mirrors the existing `name_fr` convention already used for exercise names, migration 011) since raw dataset category values will be in English. |
| Bilingual (FR/EN) exercise name + instructions | Ziko's entire i18n convention is FR/EN (`useTranslation()`, ~500 keys/locale) and the app already has a `name_fr` precedent (migration 011). Dataset ships 10 languages but only FR+EN are relevant. | LOW | Straightforward column mapping (`name`, `name_fr`, `instructions`, `instructions_fr` or equivalent) — no new UI pattern needed, matches existing convention exactly. |
| Numbered step-by-step instructions using clean structured data (not string-parsing) | The exercise detail screen (`[exerciseId].tsx`) **already renders** a numbered "Points clés d'exécution" list — but derives it via a fragile fallback chain: check `Array.isArray`, else `JSON.parse`, else `.split('\n')`. This is a workaround for the current single-string `instructions` field, not a design choice. | LOW | Dataset's `instruction_steps` array is a direct, cleaner replacement — this is a data-quality fix that eliminates an existing parsing hack, not a new feature. Low complexity: swap the `cues` derivation, same rendering component. |
| Preserve FK integrity on existing `program_exercises`/`session_sets` rows during import | Users' assigned programs and logged session history reference `exercise_id`. Overwriting/reassigning IDs, or deleting-and-reinserting exercises with matched names, would silently break historical workout data and coach-assigned programs — already-decided in project scope via "UPDATE by name matched" approach. Comparable precedent: wger's official `sync_exercises` management command explicitly **does not touch** locally/manually-added exercises and only updates matched entries, confirming "preserve existing FK-referenced + custom rows, update-in-place for matched dataset rows" is the standard pattern for this exact operation in the fitness-exercise-database domain. | MEDIUM | Match-by-name UPDATE (not delete+reinsert) is the correct approach and is already the decided plan — flagging here only to confirm it against real-world precedent (wger). Must also explicitly exclude `is_custom=true` coach-created exercises from any match/overwrite logic (separate flow, already shipped in `custom-coach` workstream). |

### Differentiators (Competitive Advantage)

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Idempotent, re-runnable import script for future dataset version bumps | The upstream dataset (`hasaneyldrm/exercises-dataset`) is actively maintained (per its GitHub description, it backs another live app) — future updates (corrected instructions, added exercises, fixed muscle mappings) are plausible. An import script that can be safely re-run (upsert-by-name, no duplicate rows, no FK breakage) means dataset improvements can be pulled in later without a full re-engineering effort. | LOW-MEDIUM | This is a natural byproduct of building the match-by-name UPDATE logic correctly the first time (see Table Stakes above) — it does not require extra scope if the initial script is written idempotently. Do **not** build an admin UI/scheduled trigger for this in v1 (see Anti-Features) — a manually re-run script is sufficient. |
| Primary vs. secondary muscle visual distinction in the "Muscles" tab | Already partially built: `[exerciseId].tsx` renders `target_muscle` as a solid orange "primaire" pill and `secondary_muscles` as lighter outline pills. The richer dataset (explicit `target` + `secondary_muscles` + broader `muscle_group` category) lets this distinction become more accurate/granular than the current best-effort Kaggle-derived data. | LOW | Enrichment of an already-shipped pattern, not new UI — low risk, direct value from better source data. |
| Tap-to-animate GIF (static thumbnail by default, animate on tap/focus) instead of always-autoplay | Reduces list/scroll jank and data usage in `ExercisePicker`'s list of up to 200 exercises if all GIFs were to autoplay simultaneously; matches common UX in exercise-demo apps (thumbnail-first, animate on focus/tap) and keeps the 180×180 asset feeling deliberate rather than distracting at small list-row scale. | LOW-MEDIUM | Applies mainly to the picker's list rows; the exercise detail screen (single exercise, larger view) can reasonably autoplay the GIF on screen focus since there's no scroll-performance concern with a single asset. |

### Anti-Features (Commonly Requested, Often Problematic)

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|------------------|-------------|
| Upscaling/resizing the GIF or thumbnail above 180×180 for a "nicer" detail-screen hero image | The current detail screen has a large 16:9 hero media block — 180×180 media stretched to fill it will look pixelated, so there's a natural temptation to upscale for visual quality | **Directly violates the license.** NOTICE.md states media distribution is capped at 180×180px — this is a hard legal constraint, not a style preference | Design the detail screen media block to gracefully contain a 180×180 asset (centered, fixed max-size, not stretched full-bleed) rather than resizing the asset to fit a larger container |
| Real embedded video with duration/quality badges (as the current placeholder implies with "Démo · 0:42" / "HD") | The current UI already has this pattern built (unused, fixture-only) and it's tempting to just "wire it up" since the visual slot already exists | The dataset provides **no video asset**, only GIF + thumbnail — keeping duration/"HD" framing would misrepresent what's actually shown and there's no video file to point it at | Replace the video-framed placeholder with GIF-appropriate framing (e.g., "Animation" label, no false duration/quality badges) |
| Building a full admin UI / scheduled cron for dataset re-sync in v1 | Feels like the "complete" version of the re-run capability, and the codebase already has cron precedent (lifecycle cleanup cron, supplements price-scraper cron) | Adds meaningful scope (admin auth surface, diffing/preview UI, scheduling) for a need that occurs rarely (dataset updates are not frequent) and has no user-facing urgency | A manually-triggered, idempotent import script (run locally/via CI when needed) covers the real need without new product surface |
| Supporting all 10 dataset languages in the UI/DB | The data is already there "for free" in the source dataset, so it can feel wasteful not to use it | Ziko's i18n convention and actual user base are FR/EN only (~500 keys/locale, `next-intl`-style routing on web, `useTranslation()` on mobile) — adding 8 unused language columns/UI toggles is scope creep with no current user demand | Import and store only `name`/`name_fr` + `instructions`/`instructions_fr` (or `instruction_steps` FR/EN), matching the existing bilingual convention exactly; ignore other languages in the source data |
| Letting the AI coach rewrite/paraphrase the licensed instruction text in chat responses | Feels natural since the AI orchestrator already injects exercise/user context into coaching responses | Risks factual drift from the licensed, structured instruction steps, and the attribution/accuracy obligation attaches to the *displayed* media+text, not to AI-generated derivatives — blending them muddies what's "the dataset's content" vs. "AI opinion" | Keep the dataset's `instruction_steps` as the authoritative, verbatim displayed content; the AI coach can add supplementary tips *alongside* it (as the existing "Coach IA" callout in `[exerciseId].tsx` already does) without altering the underlying instructions |

## Feature Dependencies

```
[Render real exercise media (GIF+thumbnail)]
    └──requires──> [Media stored in Supabase Storage with 180×180 constraint respected]

[Visible attribution on every media surface]
    └──requires──> [Render real exercise media]   (nothing to attribute until media renders)
    └──enhances──> [Exercise detail screen], [ExercisePicker list rows], [any coach/program screens showing exercise thumbnails]

[Data-driven filter chips]
    └──requires──> [Richer body_part/equipment/target/muscle_group columns populated]
    └──requires──> [FR label mapping for chip display] (mirrors name_fr convention)

[Idempotent match-by-name import script]
    └──requires──> [Exclude is_custom=true coach exercises from match/overwrite]  ──conflicts-with──> [custom-coach workstream's own exercise data]

[Re-runnable resync for future dataset versions] ──enhances──> [Idempotent match-by-name import script]

[Structured instruction_steps array] ──enhances──> [Existing numbered "Points clés d'exécution" UI] (replaces fragile string-parse fallback, same component)
```

### Dependency Notes

- **Attribution requires media rendering:** there is currently nothing to attribute on the `ExercisePicker` list (no images shown at all today) — adding attribution UI is only meaningful once thumbnails/GIFs actually render there, so these two land together, not attribution-alone.
- **Data-driven filters require populated taxonomy + FR mapping:** the richer dataset columns alone aren't sufficient — without an FR label dictionary for `body_part`/`equipment`/`target`, chips would show raw English category strings, breaking the FR-first UX convention already established via `name_fr`.
- **Import script conflicts with `custom-coach` workstream:** the match-by-name UPDATE logic must have an explicit `is_custom = true` (or equivalent) exclusion — coach-created exercises live in a separate `coach_exercises` table per the already-shipped Phase 43 work (migration `055_coach_exercises_schema.sql`), so the two systems shouldn't collide on IDs/names, but this should be verified explicitly during import-script design rather than assumed safe.
- **Instruction steps enhancement has zero new UI surface:** the numbered-steps rendering already exists and works; only the data derivation changes (removing the `JSON.parse`/`.split('\n')` fallback chain), so this should not be scoped as a UI task.

## MVP Definition

### Launch With (v1)

- [ ] Idempotent match-by-name upsert import (data + media to Supabase Storage) preserving `program_exercises`/`session_sets` FKs and excluding `is_custom` coach exercises — core of the milestone, everything else depends on data existing
- [ ] Real GIF + thumbnail rendering in exercise detail screen (replacing the fake video placeholder) — the dataset's core value (visual demos) is otherwise unrealized
- [ ] Mandatory attribution rendered on every media surface (detail screen at minimum; picker list rows if thumbnails ship there in v1) — non-negotiable legal requirement
- [ ] `instruction_steps` array wired into the existing numbered-steps UI (removing the string-parse fallback) — low cost, direct data-quality win
- [ ] FR/EN name + instructions populated — matches existing i18n convention, required for French-first UX

### Add After Validation (v1.x)

- [ ] Data-driven filter chips (replace hardcoded `FILTER_CHIPS`) with FR label mapping — trigger: once richer taxonomy is confirmed populated and chip UX is validated with real data volume
- [ ] Thumbnails rendered in `ExercisePicker` list rows (if not already in v1) with tap-to-animate GIF — trigger: once list-scroll performance with 200+ rows is validated
- [ ] Broader `muscle_group` category surfaced distinctly from `target_muscle`/`body_part` if the current schema's granularity proves confusing in practice

### Future Consideration (v2+)

- [ ] Automated/admin-triggered resync workflow for future dataset version bumps — defer until the upstream dataset actually publishes a meaningful update; manual re-run script suffices until then
- [ ] Additional dataset languages beyond FR/EN — defer indefinitely unless Ziko itself expands beyond FR/EN markets

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Idempotent match-by-name import (data+media, FK-safe) | HIGH | MEDIUM | P1 |
| Real GIF/thumbnail rendering (detail screen) | HIGH | MEDIUM | P1 |
| Mandatory attribution UI | HIGH (blocking — legal) | MEDIUM | P1 |
| `instruction_steps` structured data wiring | MEDIUM | LOW | P1 |
| FR/EN bilingual name+instructions | MEDIUM | LOW | P1 |
| Data-driven filter chips + FR label mapping | MEDIUM | MEDIUM | P2 |
| Thumbnails in `ExercisePicker` list rows | MEDIUM | MEDIUM | P2 |
| Tap-to-animate GIF behavior in list | LOW-MEDIUM | LOW-MEDIUM | P2 |
| Admin/cron resync workflow | LOW | MEDIUM-HIGH | P3 |
| 10-language support | LOW | MEDIUM | P3 (do not build) |

**Priority key:**
- P1: Must have for launch
- P2: Should have, add when possible
- P3: Nice to have, future consideration

## Attribution UX — Specific Recommendation

The user's question was: per-image caption vs. global legal page vs. both.

**Recommendation: both, but the per-surface caption is the hard requirement, the legal page is supplementary — not the reverse.**

- NOTICE.md's exact wording — attribution **"must accompany every use of the media"** — rules out relying solely on a single global "Mentions légales"/credits page. A user viewing an exercise GIF must see the notice in that same context, not have to navigate elsewhere to find it. This directly parallels Unsplash's API attribution requirement, where integrators that attributed only via a separate credits page were considered non-compliant; per-photo/per-surface attribution (small caption or badge co-located with the image) is the accepted pattern (e.g., Weebly credits in the search bar and links under each photo; Momentum attributes in-corner over each photo).
- Practically for Ziko's 180×180 assets: a small text badge/caption (e.g., `© Gym visual`) anchored to the corner or directly below each rendered GIF/thumbnail, wherever it appears (exercise detail screen, and picker/list rows once thumbnails ship there). Given the asset's small size, this should be a compact badge (small font, semi-transparent background strip) rather than a large banner — similar in spirit to the existing `HD`/`Démo` badge treatment already present in `[exerciseId].tsx` (which is being replaced, but its corner-badge *pattern* is directly reusable for the attribution notice).
- A supplementary global entry (e.g., a line in the app's existing legal/mentions pages, or a dedicated "Crédits" section) is good practice for completeness and to state the full license reference (link to `gymvisual.com`), but does **not** substitute for the per-surface caption — it's additive, not either/or.
- This is a UI/legal requirement decision confirmed here at the feature-research level; exact visual treatment (font size, exact placement, color) belongs in a UI-SPEC pass, not this document.

## Sources

- [hasaneyldrm/exercises-dataset — NOTICE.md](https://github.com/hasaneyldrm/exercises-dataset/blob/main/NOTICE.md) — HIGH confidence, direct source of the exact attribution requirement, resolution cap, and redistribution conditions for this specific dataset
- [hasaneyldrm/exercises-dataset — repository](https://github.com/hasaneyldrm/exercises-dataset) — HIGH confidence, confirms dataset shape (1,324 exercises, GIF+180×180 thumbnails, muscle-group/equipment data, step-by-step instructions, 6+ languages, actively used by another live app implying possible future updates)
- [Unsplash — Does integrating with the Unsplash API require attribution?](https://medium.com/@unsplash/does-integrating-with-the-unsplash-api-require-attribution-bf2f98ec546b) — MEDIUM confidence (different license, but closest well-documented precedent for "mandatory in-context attribution for licensed media in an app UI"), used only to validate the per-surface-vs-global-page UX pattern, not the legal terms themselves
- [Unsplash API Attribution Examples](https://medium.com/@unsplash/unsplash-api-attribution-examples-a4f0a02b33d0) — MEDIUM confidence, real UI examples (Weebly, Momentum, Craft) of in-context attribution placement
- [wger-project/wger — Administration Commands (`sync_exercises`)](https://wger.readthedocs.io/en/latest/administration/commands.html) — MEDIUM confidence, confirms "update matched entries, don't touch manually-added ones" is the established pattern for syncing an external exercise database against a local one with user-added data present
- [ExerciseDB.io FAQ](https://exercisedb.io/faq) — LOW-MEDIUM confidence, checked but did not surface GymVisual-specific or resolution-specific terms (different provider/dataset); used only as ecosystem context, not authoritative for this project's license
- Ziko codebase: `apps/mobile/app/(app)/workout/exercise/[exerciseId].tsx`, `apps/mobile/src/components/ExercisePicker.tsx`, `supabase/migrations/004_exercises_extended.sql`, `.planning/workstreams/custom-coach/phases/43-coach-exercises-backend-ui/43-01-SUMMARY.md` — HIGH confidence, direct inspection of current implementation and existing custom-coach exercise architecture

---
*Feature research for: Exercise library data + media import (Ziko Platform, v1.16 `image-exo` workstream)*
*Researched: 2026-08-14*
