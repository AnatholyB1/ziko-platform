# Phase 3: Merge (Human-Approved Write) - Context

**Gathered:** 2026-08-15
**Status:** Ready for planning

<domain>
## Phase Boundary

The exercise library must be safely and reversibly updated in production without breaking any FK-referenced program or session history. This phase:

1. Reads the human-approved `match-report.json` (from Phase 2) as its sole input — no code path exists from fetch/match straight into merge
2. UPDATEs the 1,318 matched rows in place, preserving their original UUID
3. INSERTs the 6 unmatched-new rows as fresh exercises
4. Uploads/caps GIF + thumbnail media to the `exercise-media` bucket (never exceeding 180×180, per MEDIA-03)
5. Snapshots every row about to be UPDATEd into a new `exercises_merge_backup` table before the write
6. Logs every row's outcome to `exercise_import_log` so the run is resumable and never reprocesses or corrupts already-migrated rows
7. Leaves unmatched-legacy/ambiguous rows (currently 0 in the approved report, but the code path must still exist) untouched and flagged for manual review — never auto-merged, never deleted

No dataset fetching or matching happens in this phase — that's Phase 2 (done). No mobile rendering — that's Phase 4.

</domain>

<decisions>
## Implementation Decisions

### UPDATE scope (what gets overwritten on matched rows)
- **D-01:** Full refresh — the merge overwrites media (image/gif paths) **and** attributes (body_part, equipment, target_muscle, secondary_muscles, category) **and** instructions text for all 1,318 matched rows. This is a deliberate full library replacement, not a conservative media-only patch — matches the milestone's "richer, self-hosted library" core value.
- **D-02:** Where the match report flags `field_conflicts` (dataset value disagrees with production's existing body_part/equipment/target on an otherwise-confident name match), the **dataset wins** — the conflicting field is overwritten anyway. Production's `name`/`name_fr` are NOT touched by this (the dataset has no French name field — see D-03), only body_part/equipment/target/etc.
- **D-03 (Claude's discretion):** Production `exercises.instructions` is a single TEXT column with no structured steps and no FR/EN split, but the dataset provides `instructions`/`instruction_steps` keyed by language (en/fr) that Phase 4 (MOBILE-04/05) needs to render numbered bilingual steps. Whether Phase 3 closes this schema gap now (adding e.g. `instructions_fr`/`instruction_steps JSONB` columns and populating them during merge, mirroring Phase 1's "add columns ahead of need" pattern) or leaves it for Phase 4 to add its own migration + backfill is left to research/planning to decide. Given D-01's "full refresh" already commits to overwriting `instructions`, whichever column shape is chosen must be populated as part of this phase's UPDATE — deferring the column *addition* to Phase 4 would mean Phase 3 either writes into a not-yet-existing shape or writes English-only text now and requires a second backfill later. Flag this tension explicitly to the researcher/planner.

### Approval enforcement
- **D-04:** No persistent "approved" field is added to the report JSON schema. Approval is an **interactive confirmation at merge run time** — `merge.ts` prints a summary (counts per category, sample rows) and requires the operator to explicitly confirm before any write happens. There is still no code path from fetch/match output straight into merge (satisfies success criterion #1) because merge always requires this live human gate, regardless of file contents.
- **D-05:** Approval is **single, whole-report** — one confirmation covers matched UPDATEs and unmatched-new INSERTs together. No per-category (e.g. approve-matched-now, hold-inserts-later) split.

### Failure handling mid-run
- **D-06:** On a row failure (DB write or either media upload) mid-run: **log the error to `exercise_import_log.error_message` and continue** to the next row. The run completes end-to-end; failed rows are visible afterward for inspection rather than halting the entire 1,324-row batch on one bad row.
- **D-07 (Claude's discretion):** Whether to add a bounded retry (e.g. 2-3x with backoff) for transient failures before logging-and-continuing was raised but not explicitly locked to a number — plan a reasonable conservative retry for transient network/upload errors specifically, distinct from the log-and-continue behavior for terminal failures.
- **D-08:** Re-running merge after a partial run **auto-retries errored rows** — `exercise_import_log` rows in an error state are treated like unprocessed rows and picked back up automatically on the next run, alongside anything still pending. No manual-clear step required before a row is retried.

### Backup/rollback readiness
- **D-09:** Scope is **backup table only** for this phase — `exercises_merge_backup` captures the pre-UPDATE snapshot per MEDIA-04. No restore/rollback script is built or tested in this phase; if a restore is ever needed, it's a manual SQL job written at that time. This matches the phase's literal success criteria (snapshot required, restore path not required).
- **D-10:** Snapshots are **full-row** — every column of the row as it existed immediately before the UPDATE, not just the columns this merge is about to overwrite. Simplest and safest to restore from later; row count (1,318) makes the extra storage irrelevant.

### Claude's Discretion (summary)
- D-03: Whether the `instructions_fr`/`instruction_steps` schema gap is closed in this phase's migration or deferred to Phase 4's — research the cleanest fit given D-01 already commits to overwriting instructions text now.
- D-07: Concrete retry count/backoff for transient upload/write failures before falling back to log-and-continue.
- Media resize/cap mechanics (library choice, source-resolution handling, format) to satisfy MEDIA-03's "never upscale, never exceed 180×180" — not discussed as a product decision, left to planning/research.
- Generic handling of a hypothetical `unmatched_legacy`/`ambiguous` row (currently 0 in the approved report, but the code path per IMPORT-05 must still exist and route to `needs_review`, never auto-merged) — mechanics not discussed since there's nothing to exercise against in this specific run; keep the code path correct per the locked `exercise_import_log` status enum.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements & Roadmap
- `.planning/workstreams/image-exo/REQUIREMENTS.md` — IMPORT-03, IMPORT-04, IMPORT-05, MEDIA-03, MEDIA-04 (this phase's mapped requirements); also read MOBILE-04/05 for why D-03's schema-gap question matters to what Phase 4 will need
- `.planning/workstreams/image-exo/ROADMAP.md` §"Phase 3: Merge (Human-Approved Write)" — success criteria this phase must satisfy

### Prior phase context
- `.planning/workstreams/image-exo/phases/02-download-match-dry-run/02-CONTEXT.md` — Phase 2 decisions this phase directly consumes: D-05 (JSON report format), D-07 (report location `.planning/workstreams/image-exo/reports/`), D-08 (fixed filename `match-report.json`), D-09/D-10 (ambiguous-row `human_decision` field support already exists in the report schema, even though 0 ambiguous rows exist in the current approved report)
- `.planning/workstreams/image-exo/phases/01-schema-storage-foundation/01-CONTEXT.md` — Phase 1 decisions this phase depends on: D-01/D-02 (`image`/`gif` columns store relative storage paths, not URLs), D-03/D-04 (folder-per-`exercise_id`, fixed filenames `thumb.png`/`animation.gif`), D-06 (the `exercise_import_log` status enum `matched`/`inserted`/`skipped`/`needs_review` this phase reads/writes for resumability)

### The approved report (this phase's actual input)
- `.planning/workstreams/image-exo/reports/match-report.json` — the human-approved report: 1,318 matched, 6 unmatched-new, 0 unmatched-legacy, 0 ambiguous (dataset commit `7455efae41b330c265e7cd4b78dfa848e7ce5ebd`)
- `.planning/workstreams/image-exo/reports/match-report.md` — human-readable companion summary of the same report
- `scripts/exercise-import/lib/types.ts` — `MatchReportSchema` and row schemas (`ReportMatchedRow`, `ReportUnmatchedNewRow`, `ReportUnmatchedLegacyRow`, `ReportAmbiguousRow`) this phase's merge script must parse; note there is currently **no approval field** in this schema (see D-04) and `HumanDecisionSchema` already exists for ambiguous-row overrides
- `scripts/exercise-import/README.md` — pipeline invocation conventions (run from repo root, `--env-file=backend/api/.env.local`, CommonJS/ESM dual-runtime constraints) that a new `merge.ts` entrypoint should follow

### Schema — what merge writes into
- `supabase/migrations/001_initial_schema.sql` — base `exercises` table, including the single `instructions TEXT` column relevant to D-03
- `supabase/migrations/004_exercises_extended.sql` — `body_part`, `equipment`, `target_muscle`, `secondary_muscles[]`, `gif_url` (legacy) — the attribute columns D-01/D-02 write into
- `supabase/migrations/031_exercises_name_fr.sql` — `name_fr` column (confirmed NOT touched by this phase's merge, per D-02)
- `supabase/migrations/20260814_exercise_media_schema.sql` — Phase 1's `image`/`gif` columns, the `exercise-media` bucket (service-role-write-only, 2MB limit, png/gif mime types), and the `exercise_import_log` table this phase reads/writes
- `supabase/migrations/055_coach_exercises_schema.sql` — `coach_exercises` (separate system, excluded from this phase entirely — already excluded from matching in Phase 2)
- No `exercises_merge_backup` table exists yet — this phase's migration must create it (full-row snapshot per D-10, no restore tooling per D-09)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `scripts/exercise-import/lib/supabase-client.ts` — existing read-only paginated Supabase client from Phase 2; this phase needs a **write-capable** counterpart (service-role key) — Phase 2's README explicitly forbids service-role usage in `fetch.ts`/`match.ts`, but that constraint does NOT apply to this phase's `merge.ts`, which is the one script in this pipeline that's supposed to write
- `scripts/exercise-import/lib/paths.ts`, `lib/types.ts` — repo-root-relative path constants and the zod contracts merge.ts will parse the report against; extend rather than duplicate
- `scripts/exercise-import/lib/normalize.ts` — likely irrelevant to merge (matching is done; this phase trusts the report's decisions), but available if any re-validation is needed

### Established Patterns
- CommonJS/ESM dual-runtime constraint from Phase 2 (`README.md` "Module System" section) carries over: no `import.meta.url`, no `__dirname`, all paths from `lib/paths.ts`, extensionless relative imports. A new `merge.ts` entrypoint must follow the same constraints as `fetch.ts`/`match.ts`.
- `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` + dated migration filename (`YYYYMMDD_*.sql`) is the established idiom — applies to both the new `exercises_merge_backup` table and any schema-gap columns from D-03.
- Backend uses `SUPABASE_SERVICE_KEY` (admin client bypassing RLS) for server-side writes (`backend/api/src/middleware/auth.ts` and elsewhere) — this is the pattern `merge.ts`'s write client should follow, in contrast to Phase 2's publishable-key-only read client.

### Integration Points
- `public.exercise_import_log` (source_id, exercise_id, status, error_message, processed_at) — this phase's primary resumability/idempotency mechanism (D-06, D-08); status values `matched`/`inserted`/`skipped`/`needs_review` map directly onto the report's `phase3_status` hint already stamped on every row by Phase 2's `lib/report.ts`
- `public.exercises.id` (UUID) — FK preserved on every matched UPDATE; never regenerated
- `exercise-media` storage bucket, folder-per-`exercise_id`, fixed filenames `thumb.png`/`animation.gif` (Phase 1 D-03/D-04) — this phase's media upload step writes here

</code_context>

<specifics>
## Specific Ideas

- The "full refresh" decision (D-01) reflects the milestone's explicit core value — "données riches, GIFs et thumbnails réels" — this isn't just a media swap, it's meant to genuinely upgrade the whole exercise record, not just attach new pictures to old text.
- The approval mechanism intentionally stays lightweight (D-04: live interactive confirm, no persistent JSON field) because a single whole-report approval (D-05) was judged sufficient — no need for a more elaborate sign-off ceremony given this is a one-person-reviewed batch job, not a multi-stakeholder process.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope. Every discussed area was a "how to implement this phase's merge/backup/approval mechanics" question, not a new capability. No scope-creep items came up.

</deferred>

---

*Phase: 3-Merge (Human-Approved Write)*
*Context gathered: 2026-08-15*
