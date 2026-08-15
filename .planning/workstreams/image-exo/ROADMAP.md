# Roadmap: image-exo workstream (Exercise Library Import)

## Milestones

- 🚧 **v1.16 Exercise Library Import** — Phases 1–4 (in progress)

---

## Phases

**Phase Numbering:** Fresh parallel workstream — numbering starts at Phase 1 (not continuing the shared main-track sequence).

- [x] **Phase 1: Schema & Storage Foundation** - Add the `image` column, `exercise_import_log` table, and public `exercise-media` bucket the rest of the pipeline depends on (completed 2026-08-14)
- [ ] **Phase 2: Download & Match (Dry-Run)** - Fetch the dataset and produce a human-reviewable match report with zero database writes
- [ ] **Phase 3: Merge (Human-Approved Write)** - Apply the approved report to production — resumable, backed up, FK-safe
- [ ] **Phase 4: Mobile Consumption & Attribution** - Real media, structured instructions, and mandatory attribution render in the app

---

## Phase Details

### Phase 1: Schema & Storage Foundation
**Goal**: The database and storage infrastructure the import pipeline writes to exists and is locked down before any data moves.
**Depends on**: Nothing (first phase)
**Requirements**: MEDIA-01, MEDIA-02
**Success Criteria** (what must be TRUE):
  1. `public.exercises` has a nullable `image` (thumbnail path) column, added via a dated migration
  2. A public `exercise-media` Supabase Storage bucket exists — readable by anyone, writable only via the service-role key (no client-facing write policy)
  3. An `exercise_import_log` table exists, ready to record per-row import status — the foundation Phase 3's resumable merge depends on (supports IMPORT-04)
**Plans:** 1/1 plans complete

Plans:
- [x] 01-01-PLAN.md — Add exercises.image/gif columns, create exercise-media Storage bucket, create exercise_import_log table, push migration live

### Phase 2: Download & Match (Dry-Run)
**Goal**: A human reviewer can see exactly which exercises will be updated, added, or need manual attention — before any database write happens.
**Depends on**: Phase 1
**Requirements**: IMPORT-01, IMPORT-02
**Success Criteria** (what must be TRUE):
  1. Running the fetch step clones `hasaneyldrm/exercises-dataset` (`git clone --depth 1`) and verifies file count against the dataset's manifest, failing loudly on mismatch
  2. Running the match step against production data produces a written report categorizing every dataset exercise as matched / unmatched-legacy / unmatched-new / ambiguous, via a 3-tier precision-first matcher
  3. The match report explicitly excludes `is_custom=true` exercises and all `coach_exercises` rows from matching consideration
  4. Zero rows are written to Supabase (Postgres or Storage) at any point during fetch or match — dry-run only
**Plans:** 1/6 plans executed

Plans:
- [x] 02-01-PLAN.md — Package legitimacy gate + root vitest test-runner home + gitignored dataset cache + pipeline README
- [ ] 02-02-PLAN.md — Shared lib: zod contracts (dataset/production/report), name normalization + similarity, read-only paginated Supabase client
- [ ] 02-03-PLAN.md — fetch.ts: git clone --depth 1 with cache reuse, manifest-equivalent verification, hard exit on mismatch
- [ ] 02-04-PLAN.md — 3-tier precision-first matcher core (pure functions) + fixture test suite
- [ ] 02-05-PLAN.md — Report assembly (JSON + Markdown), reviewer-decision preservation, match.ts entrypoint
- [ ] 02-06-PLAN.md — Real dry run, Tier 2 threshold tuning, human review & approval of the match report

### Phase 3: Merge (Human-Approved Write)
**Goal**: The exercise library is safely and reversibly updated in production without breaking any FK-referenced program or session history.
**Depends on**: Phase 2 (requires an approved match report as input)
**Requirements**: IMPORT-03, IMPORT-04, IMPORT-05, MEDIA-03, MEDIA-04
**Success Criteria** (what must be TRUE):
  1. Merge only runs against a report a human has explicitly approved — there is no code path from fetch/match output straight into merge
  2. Matched exercises are UPDATEd in place preserving their original UUID; unmatched-new exercises are INSERTed; no existing row is ever DELETEd
  3. Killing and re-running merge resumes from `exercise_import_log` without reprocessing or corrupting already-migrated rows
  4. Legacy exercises with no confident match but referenced by real `program_exercises`/`session_sets` history are left untouched and flagged for manual review — never auto-merged, never deleted
  5. Every row about to be UPDATEd is snapshotted to `exercises_merge_backup` before the write, and no uploaded media exceeds 180×180 at any point in the upload path
**Plans**: TBD

### Phase 4: Mobile Consumption & Attribution
**Goal**: Athletes and coaches see real exercise media with correct bilingual instructions and mandatory attribution in the app.
**Depends on**: Phase 3 (real URLs must exist in production first)
**Requirements**: MOBILE-01, MOBILE-02, MOBILE-03, MOBILE-04, MOBILE-05, MOBILE-06
**Success Criteria** (what must be TRUE):
  1. The exercise detail screen (`[exerciseId].tsx`) shows the real GIF + thumbnail; the fake "Démo · 0:42" / `HD` placeholder is gone
  2. `ExercisePicker` list rows show a thumbnail image per exercise instead of text-only
  3. Every screen displaying exercise media shows "© Gym visual — https://gymvisual.com/" via a shared `<AttributedMedia>` component (`packages/ui/`) that structurally enforces both the badge and the 180×180 cap
  4. Exercise instructions render as numbered steps sourced from `instruction_steps`, with the fragile `JSON.parse`/`.split('\n')` fallback chain removed
  5. Exercise name and instructions display in French or English per the user's locale, consistent with the existing `name_fr` convention
  6. After the app update ships, a previously-installed client's exercise cache is invalidated (TanStack Query key bumped to `['exercises', 'v2']`) — no screen shows a mix of old exercisedb.io and new Storage media
**Plans**: TBD
**UI hint**: yes

---

## Progress

**Execution Order:** Phases execute in numeric order: 1 → 2 → 3 → 4 (strict dependency chain — each phase's inputs are the prior phase's committed outputs).

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Schema & Storage Foundation | 1/1 | Complete    | 2026-08-14 |
| 2. Download & Match (Dry-Run) | 1/6 | In Progress|  |
| 3. Merge (Human-Approved Write) | 0/TBD | Not started | - |
| 4. Mobile Consumption & Attribution | 0/TBD | Not started | - |

---

*Created: 2026-08-14 — Milestone v1.16 Exercise Library Import*
