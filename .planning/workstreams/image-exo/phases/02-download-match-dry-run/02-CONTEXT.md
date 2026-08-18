# Phase 2: Download & Match (Dry-Run) - Context

**Gathered:** 2026-08-15
**Status:** Ready for planning

<domain>
## Phase Boundary

A human reviewer must be able to see exactly which exercises will be updated, added, or need manual attention — before any database write happens. This phase:
1. Fetches `hasaneyldrm/exercises-dataset` (`git clone --depth 1`) and verifies file count against the dataset's manifest, failing loudly on mismatch
2. Runs a 3-tier precision-first matcher against production `exercises` data, categorizing every dataset exercise as matched / unmatched-legacy / unmatched-new / ambiguous
3. Explicitly excludes `is_custom=true` exercises and all `coach_exercises` rows (separate system, delivered in the `custom-coach` workstream) from matching consideration
4. Writes zero rows to Supabase (Postgres or Storage) at any point — dry-run only

No merge/write logic happens in this phase — that's Phase 3. No mobile rendering — that's Phase 4.

</domain>

<decisions>
## Implementation Decisions

### Match tiers & fields
- **D-01:** Matching tries both `name` (English) and `name_fr` (French) against the dataset's translations, not English-only — catch cases where one language aligns even if the other diverges.
- **D-02 (Claude's discretion):** Whether an exact-normalized-name match with conflicting/unverifiable other fields (category, body_part) counts as a confident Tier 1 "matched" or gets downgraded to "ambiguous" — resolve after the researcher verifies the actual `hasaneyldrm/exercises-dataset` field names/schema (this is explicitly unverified per STATE.md blockers). Lean on the fact that production `exercises.name` is effectively unique (per prior team note) as a strong signal, but confirm before trusting it as the sole Tier 1 criterion.
- **D-03 (Claude's discretion):** Fuzzy-matching algorithm/threshold for Tier 2 (renamed/typo'd/reworded exercises) — pick a concrete library/threshold after seeing real near-duplicate examples between the two datasets. Bias conservative (fewer false positives) given the precision-first requirement (IMPORT-02).
- **D-04 (Claude's discretion):** Whether Tier 3 does a last-resort attribute-based guess (body_part/equipment/target_muscle overlap) for exercises with zero name match, always marked "ambiguous" if so — or whether "no name match" simply falls straight to unmatched-new/unmatched-legacy with no Tier 3 step. Decide based on actual unmatched volume once real data is seen.
- **Key existing signal:** production `exercises` already has `body_part`, `equipment`, `target_muscle`, `secondary_muscles` (added in `004_exercises_extended.sql` from a prior Kaggle dataset import) and `gif_url` (legacy, distinct from the new `gif`/`image` columns added in Phase 1). These columns are available as matching signal beyond name alone, once the new dataset's taxonomy is confirmed to be compatible.

### Report format & location
- **D-05:** Report format is **JSON** — the machine-readable source of truth, structured so Phase 3's merge script can consume it directly as its approved-report input.
- **D-06 (Claude's discretion):** Whether to also generate a companion human-readable Markdown summary (counts per category, sample rows, ambiguous cases highlighted) alongside the JSON — decide based on expected report row count. The roadmap's "human-reviewable" success criterion (Phase 2 SC #2) still must be satisfied even if the primary artifact is JSON — plan for at minimum a readable JSON structure (grouped by category, not a flat array) if no Markdown summary is added.
- **D-07:** Reports are written to **`.planning/workstreams/image-exo/reports/`** — versioned in git, next to this phase's other docs. The human-approved copy becomes Phase 3's input artifact.
- **D-08:** Re-running the dry-run match step **overwrites a fixed filename** (e.g. `match-report.json`), not a new timestamped file each run — expect to re-run this repeatedly while tuning the matcher; git history shows the diff between tuning iterations.

### Ambiguous-match presentation
- **D-09 (Claude's discretion):** Whether ambiguous rows show top-N candidates with scores, or a single best-guess flagged uncertain — decide based on how common ambiguous cases actually turn out to be once the matcher runs on real data.
- **D-10 (Claude's discretion):** Whether the reviewer edits the approved JSON report inline to resolve an ambiguous case (picking the winning candidate), or ambiguous rows are always routed to manual review as a separate path in Phase 3 (never auto-resolved via report editing) — decide based on how Phase 3's approval flow ends up being designed. Note the tension with D-05's "report = Phase 3's direct input" — if reviewer-editing is chosen, the report schema must support an explicit human-decision field per ambiguous row.
- **User signal:** No strong preference on review-effort tolerance (dozens vs hundreds of ambiguous cases) — plan a reasonable conservative default and expect the actual numbers to only be known once the matcher runs against real production + dataset data.

### Fetch & manifest failure behavior
- **D-11 (Claude's discretion):** Whether manifest mismatch triggers a hard exit with no report generated, or a partial report stamped with prominent warnings — decide based on whether fetch and match end up structured as one script or two separate steps.
- **D-12 (Claude's discretion):** Whether re-running fetch always does a fresh `git clone --depth 1`, or reuses/`git pull`s an existing local clone — decide based on dataset size (images/videos) and expected number of matcher-tuning iterations. Given the matcher will very likely be re-run multiple times while tuning (per Ambiguous-match discussion above), lean toward avoiding unnecessary re-downloads unless there's a correctness reason not to.
- **D-13 (Claude's discretion):** Where the cloned dataset lives on disk (inside repo gitignored vs OS temp dir) — decide based on where the fetch/match scripts themselves end up living (D-14).
- **D-14 (Claude's discretion):** Whether the fetch/match scripts live in a new `scripts/exercise-import/` subfolder or as flat files alongside the existing ad-hoc `scripts/*.js` utilities — decide based on how many files the pipeline actually needs (fetch + match today; Phase 3 adds a merge script later — a dedicated subfolder likely holds up better across all three phases even though this phase alone could be 2-3 flat files).

### Claude's Discretion (summary)
Most mechanical/threshold-level decisions in this phase were explicitly deferred to research + planning, per the user's consistent "Let Claude decide" pattern: exact Tier 1/2/3 field logic and thresholds, ambiguous-match presentation format, reviewer-edit-vs-read-only report semantics, manifest-failure hard-exit-vs-partial-report behavior, clone-reuse strategy, dataset-on-disk location, and script folder layout. The **locked** decisions are: match both `name` + `name_fr` (D-01), JSON report format as Phase 3's input (D-05), report location `.planning/workstreams/image-exo/reports/` (D-07), and fixed-filename-overwrite on re-run (D-08). The researcher should prioritize verifying the actual `hasaneyldrm/exercises-dataset` field names/schema (flagged as unverified in STATE.md) before the planner locks in the deferred matcher/report-format details above — this verification directly unblocks D-02, D-03, D-04, and D-06.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements & Roadmap
- `.planning/workstreams/image-exo/REQUIREMENTS.md` — IMPORT-01, IMPORT-02 (this phase's mapped requirements); also read IMPORT-03/04/05 for how the match report is consumed by Phase 3
- `.planning/workstreams/image-exo/ROADMAP.md` §"Phase 2: Download & Match (Dry-Run)" — success criteria this phase must satisfy

### Prior phase context
- `.planning/workstreams/image-exo/phases/01-schema-storage-foundation/01-CONTEXT.md` — Phase 1 decisions on `image`/`gif` columns (relative storage paths, not URLs), folder-per-exercise_id storage convention, and the `exercise_import_log` status enum (`matched`/`inserted`/`skipped`/`needs_review`) that Phase 3 will read/write — Phase 2's match categories must map cleanly onto this enum

### Schema — what already exists on `public.exercises`
- `supabase/migrations/001_initial_schema.sql` — base `exercises` table: `id`, `name`, `category` (CHECK-constrained enum), `muscle_groups[]`, `instructions`, `video_url`, `is_custom`, `user_id`
- `supabase/migrations/004_exercises_extended.sql` — adds `body_part`, `equipment`, `target_muscle`, `secondary_muscles[]`, `gif_url` from a **prior Kaggle fitness dataset import** — these are the "legacy" columns/data this phase's matcher reconciles against; also widens the `category` CHECK enum (now: strength/cardio/flexibility/balance/sports/stretching)
- `supabase/migrations/031_exercises_name_fr.sql` — adds `name_fr` column (French name), relevant to D-01's name+name_fr matching decision
- `supabase/migrations/20260814_exercise_media_schema.sql` — Phase 1's output: adds `image`/`gif` relative-path columns and the `exercise_import_log` table this phase's report categories must align with
- `supabase/migrations/055_coach_exercises_schema.sql` — defines `coach_exercises` (separate system, explicitly excluded from this phase's matching per REQUIREMENTS.md "Out of Scope")

### State / blockers to resolve during research
- `.planning/workstreams/image-exo/STATE.md` §"Blockers/Concerns" — flags exact `hasaneyldrm/exercises-dataset` field names (`exercises.schema.json`) as **not yet independently verified**, and production `exercises.name` uniqueness as needing double-checking (`\d exercises`) — both must be resolved before the matcher's Tier 1 logic can be finalized (see D-02)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- None directly reusable — this is a standalone data pipeline script, not app-facing code. No prior TypeScript import-pipeline precedent exists in `scripts/` (current contents: ad-hoc `.js` utilities like `csv-to-seed.js`, `json-to-seed.js`, `gen_fr_migration.py` — one-off, not a multi-step pipeline pattern).

### Established Patterns
- `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` is the established idiom for additive schema changes (not relevant to writes in this dry-run phase, but relevant context for Phase 3).
- Backend uses `SUPABASE_SERVICE_KEY` (admin client bypassing RLS) for server-side/script writes — this dry-run phase makes zero writes, but the eventual fetch/match script will likely need the same service-role read access pattern to query `exercises` and `coach_exercises` for matching, following the precedent in `backend/api/src/middleware/auth.ts` / admin client usage elsewhere.

### Integration Points
- `public.exercises.id` (UUID), `name`, `name_fr`, `category`, `body_part`, `equipment`, `target_muscle`, `secondary_muscles`, `is_custom` — the full set of fields available for the matcher to read and compare against the incoming dataset.
- `public.coach_exercises` — must be excluded entirely; no matching consideration.
- `public.exercise_import_log` — not written to in this phase (dry-run = zero DB writes), but its status enum shape should inform how Phase 2's report categories (matched/unmatched-legacy/unmatched-new/ambiguous) map onto what Phase 3 will eventually log.

</code_context>

<specifics>
## Specific Ideas

- The match report should function as the direct hand-off artifact into Phase 3 — not just a human-readable document, but potentially the literal input file Phase 3's merge script reads once approved. This shaped the JSON-format decision (D-05) and the fixed-location/fixed-filename decisions (D-07, D-08).
- Precision-first bias should extend beyond the matcher's field logic into report presentation: ambiguous cases should be visible and reviewable rather than silently resolved, even though the exact presentation mechanics (D-09, D-10) were left to planning.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope. Every discussed area was a "how to implement this phase's fetch/match/report pipeline" question, not a new capability. No scope-creep items came up.

</deferred>

---

*Phase: 2-Download & Match (Dry-Run)*
*Context gathered: 2026-08-15*
