# Architecture Research

**Domain:** Bulk third-party dataset import pipeline (exercise data + licensed media) merged into an existing FK-referenced production table, self-hosted on Supabase Storage
**Researched:** 2026-08-14
**Confidence:** HIGH — every integration point below is grounded in files read directly from this codebase (migration numbering, existing bucket/RLS patterns, the `scripts/` precedent that already generated the current seed, the signed-URL storage route). No speculative framework claims; this is a wiring problem, not a technology-choice problem.

## Standard Architecture

### System Overview

```
┌──────────────────────────────────────────────────────────────────────┐
│  LOCAL / CI — one-off ETL, never a Vercel/Hono request handler        │
│  scripts/import-exercises/  (new — sibling to existing scripts/*.js)  │
│                                                                        │
│  ┌────────────┐   ┌────────────────┐   ┌───────────────────────────┐ │
│  │ 1. fetch.ts │──▶│ 2. match.ts    │──▶│ 3. merge.ts               │ │
│  │ tarball dl  │   │ dry-run report │   │ upload media + UPDATE/    │ │
│  │ raw.github  │   │ (no writes)    │   │ INSERT, logs to           │ │
│  │ usercontent │   │                │   │ exercise_import_log       │ │
│  └────────────┘   └────────────────┘   └───────────────┬───────────┘ │
└──────────────────────────────────────────────────────────┼───────────┘
                                                             │ direct Postgres
                                                             │ connection string
                                                             │ (not PgBouncer pool)
┌────────────────────────────────────────────────────────────▼─────────┐
│  SUPABASE                                                             │
│  ┌───────────────────────────┐   ┌────────────────────────────────┐  │
│  │ public.exercises           │   │ Storage: exercise-media (new)  │  │
│  │  + image, gif_url (v2)     │◀──│  PUBLIC read bucket            │  │
│  │  + attribution (existing   │   │  no client INSERT policy       │  │
│  │    gif_url column reused)  │   │  (server/script-only writes,   │  │
│  │ public.exercise_import_log │   │   same pattern as `exports`)   │  │
│  │  (new — resumability)      │   │                                │  │
│  └─────────────┬───────────────┘   └────────────────────────────────┘ │
└────────────────┼──────────────────────────────────────────────────────┘
                  │ Supabase JS client (anon/publishable key, RLS read)
┌─────────────────▼──────────────────────────────────────────────────┐
│  MOBILE (Expo)                                                      │
│  ExercisePicker.tsx, [exerciseId].tsx  — TanStack Query             │
│  queryKey ['exercises', 'v2'] (bumped) → renders image/gif_url      │
│  Expo Image with contentFit, capped at 180×180 intrinsic size       │
└───────────────────────────────────────────────────────────────────┘
```

The Hono backend (`backend/api/`) is **not** in this diagram on purpose — it plays no role in the import pipeline. It is only a downstream consumer boundary in the same sense mobile is (any future `GET /exercises` route reads the same table, no changes required for this milestone unless one already exists).

### Component Responsibilities

| Component | Responsibility | Typical Implementation |
|-----------|----------------|-------------------------|
| `scripts/import-exercises/fetch.ts` | Download the dataset tarball once, extract JSON + media to a local staging dir, verify file count against manifest | Node/tsx script, `codeload.github.com/hasaneyldrm/exercises-dataset/tar.gz/<pinned-sha>`, `tar` extraction, no Supabase calls |
| `scripts/import-exercises/match.ts` | Normalize names on both sides, run the 3-tier match pipeline (exact → field-agreement fuzzy → unmatched), write a JSON/CSV dry-run report | Pure function over two in-memory arrays (≤2600 rows total — no DB round-trips needed for matching itself), reads `public.exercises` once via direct connection |
| `scripts/import-exercises/merge.ts` | Consume the **reviewed** dry-run report, upload media to Storage, UPDATE matched rows in place, INSERT unmatched-new rows, skip anything already recorded in `exercise_import_log` | Batches of small transactions (one row or small chunk per transaction), bounded-concurrency Storage uploads, idempotent via the log table |
| `public.exercise_import_log` (new table) | Durable resume/audit point: which dataset row mapped to which `exercises.id`, upload status, timestamp | Plain Postgres table, no RLS needed (never queried by app users), read/written only by the script's service-role/direct connection |
| `exercise-media` Storage bucket (new) | Serve GIF + thumbnail publicly to the mobile app without per-request signed URLs | `public: true` bucket, INSERT/UPDATE restricted to service role only (no `authenticated` policy) |
| Mobile `ExercisePicker.tsx` / `[exerciseId].tsx` | Render `image`/`gif_url` with attribution badge, capped at 180×180 | Expo `<Image>` (already used elsewhere in the app per fixture-elimination work), versioned TanStack Query key |

## Recommended Project Structure

```
scripts/
├── csv-to-seed.js              # existing — precedent for this pattern
├── json-to-seed.js             # existing — precedent for this pattern
├── gen_fr_migration.py         # existing
└── import-exercises/           # NEW — this milestone
    ├── fetch.ts                 # download tarball → .staging/exercises-dataset/ (gitignored)
    ├── normalize.ts              # shared name-normalization + field-agreement helpers (used by match.ts AND merge.ts's re-verification)
    ├── match.ts                  # dry-run only, writes .staging/match-report.json — NEVER touches Supabase writes
    ├── merge.ts                  # reads reviewed match-report.json, writes to Supabase (data + Storage), resumable via exercise_import_log
    ├── review-report.ts          # small CLI to pretty-print match-report.json counts (matched/unmatched-legacy/unmatched-new/ambiguous) for the human review gate
    └── README.md                 # run order + required env vars (SUPABASE_DB_URL direct connection, not pooled)

supabase/migrations/
├── 064_unaccent_user_search.sql          # existing, last numeric
├── 20260529_fix_trigger_n_sessions.sql   # existing, last dated
├── 20260814_exercises_image_column.sql   # NEW — schema first (see Build Order)
└── 20260814_exercise_import_log.sql      # NEW — companion migration, same date, run after the column migration

apps/mobile/
├── src/components/ExercisePicker.tsx     # MODIFIED — add thumbnail + attribution badge, data-driven filters deferred (P2, out of this milestone per FEATURES.md)
└── app/(app)/workout/exercise/[exerciseId].tsx  # MODIFIED — replace fake video placeholder with real GIF + attribution
```

### Structure Rationale

- **`scripts/import-exercises/` as a subfolder, not new top-level scripts:** the repo already has an established `scripts/` convention for one-off data-generation jobs (`csv-to-seed.js`, `json-to-seed.js` — these are literally what produced the *current* `seed_exercises.sql` from `kaggle_data/`). This import is the direct successor to that same workflow; putting it anywhere else (e.g. `backend/api/src/scripts/`) would incorrectly imply it's part of the deployed API surface.
- **`fetch` / `match` / `merge` as three separate scripts, not one:** directly implements PITFALLS.md Pitfall 3 (non-idempotent script) and Pitfall 4 (17MB payload) — download must fully complete and be verified before any DB write begins, and the human-review gate (PITFALLS.md Pitfall 1 & 2) only works if `match.ts` is a distinct, side-effect-free step whose output is inspected before `merge.ts` ever runs.
- **`normalize.ts` shared between match and merge:** `merge.ts` re-derives normalized names when writing (not just trusting the report blindly) as a cheap safety check that the underlying table hasn't drifted between the dry run and the actual write.
- **Dated migration filenames (`20260814_*`), not next numeric (`065_*`):** the migration history shows the project switched from strict numeric (`001`–`064`) to `YYYYMMDD_description.sql` for everything after `064_unaccent_user_search.sql` (`20260526_*`, `20260527_*` ×2, `20260529_*`). Follow the convention actually in use at the tip of the migration history, not the older one.

## Architectural Patterns

### Pattern 1: Separate download/merge phases with a durable resume log

**What:** Split the pipeline into a pure-download step (no DB writes) and a pure-merge step (no network fetches, reads only from local staging + Supabase), with a `exercise_import_log` table as the source of truth for "what's already been done."
**When to use:** Any bulk external-data import where the write target is a live, FK-referenced production table and the input source involves ~2600 individual network fetches that can fail partway.
**Trade-offs:** Slightly more code/ceremony than a single script; in exchange, a killed process, a GitHub rate-limit hit, or a Supabase network blip mid-run costs zero re-work — re-running `merge.ts` skips every row already marked `done` in the log.

**Example:**
```typescript
// merge.ts (excerpt)
const { data: alreadyDone } = await supabase
  .from('exercise_import_log')
  .select('dataset_exercise_id')
  .eq('status', 'done');
const doneSet = new Set(alreadyDone.map(r => r.dataset_exercise_id));

for (const match of matchReport.matched) {
  if (doneSet.has(match.datasetId)) continue; // resumable
  await withTransaction(async (tx) => {
    await tx.query('INSERT INTO exercises_merge_backup SELECT * FROM exercises WHERE id = $1', [match.existingId]);
    await tx.query('UPDATE exercises SET image=$1, gif_url=$2, ... WHERE id=$3', [...]);
    await tx.query(
      `INSERT INTO exercise_import_log (dataset_exercise_id, matched_row_id, status, processed_at)
       VALUES ($1,$2,'done',now())`,
      [match.datasetId, match.existingId],
    );
  });
}
```

### Pattern 2: Public read-only reference-data bucket (no per-user prefix)

**What:** Unlike the 3 existing private buckets (`profile-photos`, `scan-photos`, `exports`, plus `coach-kyc`/`ai-imports`/`coach-exercises`), all of which are keyed by `(storage.foldername(name))[1] = auth.uid()::text` because they hold *user-owned* content, this bucket holds *global reference data* — every user needs to read the same objects, and no user (nor even the mobile client generally) ever writes to it.
**When to use:** Shared/global media that all authenticated (and here, even unauthenticated marketing-page) clients must read, written only by a trusted server-side process.
**Trade-offs:** Public buckets skip the signed-URL round-trip (`GET /storage/upload-url`) entirely on the read side — the mobile app just uses the public URL directly, which is simpler and faster than the existing per-user pattern. The cost is that write access must be locked down explicitly (no `authenticated` INSERT policy at all — only the service-role key used by the import script can write), otherwise any logged-in user could overwrite exercise media.

**Example:**
```sql
-- 20260814_exercises_image_column.sql (excerpt) or a third migration alongside it
INSERT INTO storage.buckets (id, name, public)
VALUES ('exercise-media', 'exercise-media', true)
ON CONFLICT (id) DO NOTHING;

-- Public read (matches profile-photos' public-read policy pattern)
CREATE POLICY "exercise_media_public_read" ON storage.objects
  FOR SELECT TO public
  USING (bucket_id = 'exercise-media');

-- No INSERT/UPDATE/DELETE policy for `authenticated` or `public` — mirrors
-- the `exports` bucket precedent ("No INSERT policy — server-side only").
-- The import script uses the service-role key, which bypasses RLS entirely.
```

### Pattern 3: Precision-first 3-tier match pipeline with a mandatory human gate

**What:** (1) exact normalized-name match, (2) normalized-name + at least one independent field (`body_part` or `equipment`) agreement for near-matches, (3) everything else → `unmatched` bucket requiring manual review before any write. This is spelled out in full in PITFALLS.md Pitfalls 1 & 2; restated here as the architectural shape it implies: **the match step's output is a file/report artifact, not a live DB mutation.**
**When to use:** Any merge where false positives (silently corrupting a row referenced by real user history) are more expensive than false negatives (an extra row awaiting manual triage).
**Trade-offs:** Requires a human in the loop once (reviewing the dry-run report) before `merge.ts` can run — this is the correct trade-off given `program_exercises`/`session_sets` have no `ON DELETE CASCADE` and real user data already exists.

## Data Flow

### Import Pipeline Flow (one-time / occasionally re-run)

```
[GitHub tarball, pinned SHA]
    ↓ fetch.ts (raw.githubusercontent / codeload, NOT Contents API)
[.staging/exercises-dataset/ — JSON + ~2600 media files, verified against manifest]
    ↓ match.ts (reads public.exercises via direct connection, pure computation, zero writes)
[.staging/match-report.json — matched / unmatched-legacy / unmatched-new / ambiguous]
    ↓ ★ HUMAN REVIEW GATE ★ (review-report.ts prints counts; someone approves before proceeding)
    ↓ merge.ts
    ├─▶ [Supabase Storage: exercise-media/ — upload GIF+thumb, skip if already uploaded per log]
    └─▶ [Postgres: exercises_merge_backup ← UPDATE exercises SET image, gif_url, ... ← exercise_import_log]
```

### Mobile Consumption Flow (steady state, post-migration)

```
[ExercisePicker.tsx / [exerciseId].tsx mount]
    ↓ TanStack Query, queryKey ['exercises', 'v2']  (bumped from whatever the current key is — forces cache miss)
    ↓ supabase.from('exercises').select('id,name,name_fr,image,gif_url,attribution,...')
[Public exercise-media bucket URL, e.g. https://<project>.supabase.co/storage/v1/object/public/exercise-media/<id>.gif]
    ↓ Expo <Image> with contentFit + explicit 180×180 max style
[Rendered demo + co-located "© Gym visual" badge]
```

### Key Data Flows

1. **Schema → Data → Storage → Mobile, strictly in that order (see Build Order below):** the `image`/`attribution` columns must exist before `merge.ts` can write to them; media must be uploaded and URLs written to the row before mobile code that reads `image`/`gif_url` is deployed, otherwise mobile ships against columns that are still null for most rows.
2. **Backup-before-overwrite on every UPDATE:** `exercises_merge_backup` (a plain table, `INSERT INTO ... SELECT * FROM exercises WHERE id = $1` immediately before each UPDATE) is the recovery path for Pitfall 2 (false-positive match) — this is a data-flow step inside `merge.ts`'s per-row transaction, not a separate migration/table with its own lifecycle.

## Scaling Considerations

This import operates once (plus occasional manual re-runs for dataset updates), against a fixed, small dataset (~1324 rows, ~2600 files). "Scaling" here means "will this survive one run without falling over," not multi-tenant growth — the FEATURES.md MVP definition explicitly defers an automated/scheduled resync to v2+.

| Scale | Architecture Adjustments |
|-------|---------------------------|
| Single run, ~1324 rows / ~2600 files | Bounded concurrency (10-20 parallel) for Storage uploads; batched small transactions, not one giant transaction; local/CI execution as planned |
| Occasional re-run (future dataset version bump) | Already covered by the resumable `exercise_import_log` design — a re-run against an updated dataset just processes the delta, no architecture change needed |
| Hypothetical future admin-triggered resync (explicitly out of scope this milestone per FEATURES.md anti-features) | Would require promoting `merge.ts` into a properly queued/cron job with its own auth surface — not needed now, don't build it now |

### Scaling Priorities

1. **First and only real risk: partial failure mid-run**, not load — mitigated entirely by Pattern 1 (separate phases + resume log), already the core design.
2. **Second-order risk: GitHub rate limiting during `fetch.ts`** — mitigated by using the tarball endpoint (one request) instead of per-file Contents API calls (per PITFALLS.md Integration Gotchas).

## Anti-Patterns

### Anti-Pattern 1: Implementing the import as a Hono route (`POST /admin/import-exercises` or similar)

**What people do:** Default to "everything is an API route" for consistency with the rest of `backend/api/`.
**Why it's wrong:** The 17MB source JSON alone exceeds this project's own documented Vercel 4.5MB payload constraint (`.planning/PROJECT.md` Key Decisions, v1.3); a Hono/Vercel function is also subject to execution-duration limits that don't fit a ~9-minute-minimum sequential media download, and GitHub's Contents API (which a serverless function would be tempted to use instead of a tarball, to avoid writing to a filesystem) inflates payload ~33% via base64 — compounding the problem. Confirmed independently by both sibling PITFALLS.md (Pitfall 4) and this research.
**Do this instead:** Local/CI Node+tsx script (Pattern 1), run manually or as a scheduled CI job with a direct (non-pooled) Postgres connection string — never a synchronous request handler.

### Anti-Pattern 2: Reusing the per-user-prefix bucket RLS pattern for reference data

**What people do:** Copy-paste the `(storage.foldername(name))[1] = auth.uid()::text` policy from `profile-photos`/`scan-photos`/`coach-exercises` because it's the only Storage pattern in the codebase.
**Why it's wrong:** That pattern assumes every object belongs to exactly one user and is private-by-default with a signed-URL escape hatch. Exercise media is the opposite: one canonical asset per exercise, read by every user, written by nobody at request time. Forcing it through the signed-URL flow (`GET /storage/upload-url`) would require every mobile client to mint a signed URL per exercise media just to *read* it — unnecessary latency and complexity for content that has no confidentiality requirement.
**Do this instead:** `public: true` bucket with a single public-SELECT policy and no client-facing INSERT/UPDATE/DELETE policy at all (Pattern 2) — writes happen exclusively through the import script's service-role key, which bypasses RLS.

### Anti-Pattern 3: One giant transaction for the whole 1324-row merge

**What people do:** Wrap the entire merge loop in a single `BEGIN...COMMIT` "to keep it atomic and simple."
**Why it's wrong:** Already flagged in PITFALLS.md's Technical Debt Patterns table — a single transaction either fully succeeds (fine, but a timeout mid-way loses 100% of progress, defeating the resumability design) or fully fails and rolls back with zero partial audit trail of what was even validated.
**Do this instead:** Small per-row (or small-batch) transactions, each immediately followed by an `exercise_import_log` write recording success — this is what makes Pattern 1's resumability actually work in practice, not just in theory.

## Integration Points

### External Services

| Service | Integration Pattern | Notes |
|---------|----------------------|-------|
| GitHub (`hasaneyldrm/exercises-dataset`) | `fetch.ts` downloads `https://codeload.github.com/hasaneyldrm/exercises-dataset/tar.gz/<pinned-commit-sha>` once, extracts locally | Pin to a commit SHA, not `main` (integrity + reproducibility, per PITFALLS.md Security Mistakes); never loop the Contents API per-file |
| Supabase Postgres (direct connection) | `match.ts`/`merge.ts` connect via `SUPABASE_DB_URL` (direct, non-pooled) from `backend/api/.env`-style local env, **not** the app's PgBouncer/transaction-mode pooled connection | Matches PITFALLS.md Integration Gotchas — pooled connections aren't suited to many sequential statements in a batch job |
| Supabase Storage | `merge.ts` uploads via `@supabase/supabase-js` service-role client, bounded concurrency (10-20) | Same SDK already used throughout `backend/api/src/routes/storage.ts` — no new dependency |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|----------------|-------|
| `scripts/import-exercises/` ↔ `public.exercises` | Direct SQL via `pg`/`@supabase/supabase-js` service-role client, run manually/CI, never through the Hono API | Script is entirely outside `backend/api/`'s runtime request path — zero changes to `backend/api/src/routes/` are required for the import itself |
| `scripts/import-exercises/` ↔ `coach_exercises` | **Explicit exclusion** — the merge query must filter `WHERE is_custom = FALSE AND user_id IS NULL` (mirrors the exact predicate `seed_exercises.sql` already uses for its DELETE), and must never touch the separate `coach_exercises` table (migration 055) at all | Confirmed by both sibling PITFALLS.md and FEATURES.md as a required exclusion — different table, different bucket, different RLS owner (`coach_id` vs. global) |
| `public.exercises` ↔ mobile (`ExercisePicker.tsx`, `[exerciseId].tsx`) | Existing Supabase JS client read (`supabase.from('exercises').select(...)`), RLS policy `read_exercises` already permits `is_custom = FALSE` for all authenticated users, unchanged by this migration | Only the *columns selected* and the *query key version* change; no RLS policy change needed on `exercises` itself |
| `exercise-media` bucket ↔ mobile | Public bucket URL consumed directly (no signed-URL fetch), stored as the full `gif_url`/`image` value on the row itself | Simpler than every other Storage integration in this codebase — no `/storage/upload-url` round-trip needed for reads |

## Build Order (dependency-driven, answers the "what migration order" question directly)

1. **Schema migration(s) first** — `20260814_exercises_image_column.sql` (adds `image TEXT`, `attribution TEXT NOT NULL DEFAULT '© Gym visual — https://gymvisual.com/'` or structured equivalent per FEATURES.md's "structured field, not free text" requirement) + `20260814_exercise_import_log.sql` (new table) + a third migration (or combine with the column one) creating the `exercise-media` public bucket and its single read policy. Nothing downstream can run until these exist.
2. **Download + merge script** (`scripts/import-exercises/fetch.ts` → `match.ts` → human review → `merge.ts`) — depends on step 1's columns/table existing. This step both uploads media to Storage *and* writes the resulting public URLs into `exercises.image`/`exercises.gif_url` in the same per-row transaction, so "storage upload" and "data write" are not separable phases at the architecture level (they were separable as a *pitfall concern* — resumability — but the actual write happens together, upload-then-UPDATE, per row, inside `merge.ts`).
3. **Mobile consumption changes** (`ExercisePicker.tsx`, `[exerciseId].tsx`, query key version bump, attribution badge component in `packages/ui/`) — depends on step 2 having actually populated real URLs in production; shipping mobile UI against the new columns before the merge has run would show blank/placeholder states for every exercise, which is safe but pointless to ship early. Sequence step 2 to completion (including verification per PITFALLS.md's checklist) before starting step 3's implementation, even though the code for step 3 could technically be written in parallel against a staging copy.

This order directly satisfies the FK-safety dependency requested: schema exists before data is written, data (with real URLs) exists before mobile code that assumes it renders, and the resumability/backup mechanisms (import log, merge backup table) are schema-level artifacts that must predate the first write, not bolted on after.

## Sources

- `C:\ziko-platform\supabase\migrations\001_initial_schema.sql` — `exercises`, `program_exercises`, `session_sets` FK shape — HIGH, read directly
- `C:\ziko-platform\supabase\migrations\004_exercises_extended.sql` — existing `gif_url`/`body_part`/`equipment`/`target_muscle` columns, current category CHECK — HIGH, read directly
- `C:\ziko-platform\supabase\migrations\025_storage_buckets.sql` — established bucket + RLS pattern (`profile-photos` public-read precedent, `exports` server-only-write precedent) — HIGH, read directly
- `C:\ziko-platform\supabase\migrations\055_coach_exercises_schema.sql` — confirms `coach_exercises` is a fully separate table/bucket, must not be conflated with this import — HIGH, read directly
- `C:\ziko-platform\backend\api\src\routes\storage.ts` — existing signed-URL upload flow (`ALLOWED_BUCKETS`, per-user path prefix enforcement) — confirms why this new bucket needs a *different* pattern (public, no signed URL) — HIGH, read directly
- `C:\ziko-platform\scripts\` directory listing (`csv-to-seed.js`, `json-to-seed.js`, `gen_fr_migration.py`) — direct precedent for where and how one-off data-generation scripts live in this repo — HIGH, read directly
- `C:\ziko-platform\package.json` — confirms `@supabase/supabase-js` and `zod` already available as root-level dependencies, no new package needed for the script to talk to Supabase — HIGH, read directly
- `ls supabase/migrations` sorted — confirms migration numbering convention shifted from numeric (`001`–`064`) to dated (`YYYYMMDD_*`) at the tip of history — HIGH, read directly
- `.planning/research/PITFALLS.md` (sibling researcher output) — Pitfalls 1–6, Technical Debt Patterns, Integration Gotchas, Security Mistakes — factored in directly per task instructions, not re-derived
- `.planning/research/FEATURES.md` (sibling researcher output) — MVP scope, attribution UX recommendation, explicit `is_custom` exclusion requirement — factored in directly per task instructions, not re-derived
- `C:\ziko-platform\.planning\PROJECT.md` — Vercel 4.5MB constraint (v1.3 Key Decision), v1.16 `image-exo` workstream description — HIGH, read directly

---
*Architecture research for: Exercise library data + media import pipeline (Ziko Platform, v1.16 `image-exo` workstream)*
*Researched: 2026-08-14*
