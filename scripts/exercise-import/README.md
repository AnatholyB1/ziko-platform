# Exercise Import Pipeline

Replaces the exercise library (1324 exercises: GIFs, 180x180 thumbnails,
FR/EN instructions) from the `hasaneyldrm/exercises-dataset` dataset,
matched against the live `public.exercises` table by name.

This is a three-stage pipeline. Stages 1-2 (`fetch.ts`, `match.ts`) are
read-only dry runs — they clone the dataset, match it against production
by name, and write a markdown report for human review, performing zero
writes of any kind. Stage 3 (`merge.ts`) is the human-approved write: it
requires an operator to explicitly review the report and type a live
confirmation before touching `public.exercises`, its backup table, the
audit log, or Storage — there is no code path from fetch/match output
straight into a write.

## Pipeline Order

1. `fetch.ts` — clones the dataset git repository into
   `scripts/exercise-import/.dataset-cache/` and verifies the manifest
   (`exercises.schema.json`) against the expected shape.
2. `match.ts` — reads the live `public.exercises` table (read-only), runs
   the 3-tier name matcher against the cloned dataset, categorizes the
   results (exact / fuzzy / unmatched), and writes the dry-run report.
3. `merge.ts` — reads the human-approved `match-report.json`, re-joins
   each row against the cloned dataset for the fields the report
   deliberately omits (media paths, bilingual instructions), caps media to
   180×180, uploads to the `exercise-media` bucket, snapshots each
   overwritten row into `exercises_merge_backup`, writes
   `public.exercises`, and records every row's outcome in
   `exercise_import_log`. `fetch.ts` must have been run on the same
   machine at the report's `dataset_commit` before `merge.ts` can run.

Run `fetch.ts` before `match.ts` — `match.ts` reads from the cache
directory that `fetch.ts` populates. Run `match.ts` (and get the report
human-approved) before `merge.ts`.

## Required Environment Variables

All three scripts load environment variables from `backend/api/.env.local`
(see Invocation below), but the required variables differ per script.

`fetch.ts` and `match.ts` require:

- `SUPABASE_URL`
- `SUPABASE_PUBLISHABLE_KEY`

`fetch.ts` and `match.ts` must **never** load or reference
`SUPABASE_SERVICE_KEY`. These two scripts perform zero writes, and the
existing `read_exercises` RLS policy on `public.exercises` already grants
read access to every `is_custom = FALSE` row for an unauthenticated
publishable-key client — there is no scenario in these two scripts where
the service key is required, and using it would be an unnecessary
privilege escalation for a read-only workload.

`merge.ts` requires:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_KEY`

`merge.ts` is the sole exception to the publishable-key-only rule:
`exercise_import_log` and `exercises_merge_backup` are RLS-enabled with
zero policies (deny-by-default for anon/authenticated), so only a
service-role client can write them. `SUPABASE_SERVICE_KEY` must be
populated in the gitignored `backend/api/.env.local` before a merge run,
and the key must never be printed, logged, or committed.

## Invocation

Run all commands **from the repo root** — every path in `lib/**` is
repo-root-relative and scripts will fail (or silently misresolve paths)
if run from any other working directory.

```bash
npx tsx --env-file=backend/api/.env.local scripts/exercise-import/fetch.ts
npx tsx --env-file=backend/api/.env.local scripts/exercise-import/match.ts
npx tsx --env-file=backend/api/.env.local scripts/exercise-import/merge.ts
```

The `--env-file` flag mirrors backend/api's existing `dev` script
convention (`cross-env PORT=8080 tsx watch --env-file=.env.local ...`).

`merge.ts` requires an interactive terminal — it hard-exits when stdin is
not a TTY, has no `--yes`/`--force` bypass flag, and cannot be run in CI.
This is the mechanism enforcing roadmap success criterion #1 (no code path
from fetch/match output straight into merge): approval is a live,
interactive confirmation typed by the operator at run time, not a flag or
a persisted field in the report.

### Flags

- `--refetch` on `fetch.ts` — forces a fresh git clone instead of reusing
  the existing `.dataset-cache/` directory. Use this if the dataset cache
  looks stale or corrupted.

## Resuming a merge run

A killed or partially-failed `merge.ts` run is resumed by simply
re-running the same command. For every row, the script checks the latest
`exercise_import_log` entry for that row's `source_id`:

- A null `error_message` means the row is already done — it is skipped
  (logged as `status: 'skipped'`), never reprocessed.
- A non-null `error_message` means the prior attempt failed — the row is
  retried automatically.

No manual clear step is needed before a row is retried.

## Tests

```bash
npm run test:import
```

Runs the root-level vitest config (`vitest.config.ts`), scoped to
`scripts/exercise-import/**/*.test.ts`. All testable logic lives in
`lib/**`; `fetch.ts`, `match.ts`, and `merge.ts` are thin entrypoints that
call `main()` unconditionally at module load, so tests never import them
directly — only the `lib/**` modules they call into.

## Module System

Root `package.json` has **no** `"type"` field, so `tsx` compiles these
files as CommonJS while vitest transforms them as ESM. To keep both
runtimes happy:

- **No `import.meta.url`** anywhere in `lib/**`.
- **No `__dirname`** anywhere in `lib/**`.
- All paths are repo-root-relative string constants defined in
  `lib/paths.ts`, and every script must be run from the repo root (see
  Invocation above) — never from `scripts/exercise-import/` itself.
- Relative imports are extensionless (e.g. `./lib/normalize`, not
  `./lib/normalize.js`).

Do not reintroduce `import.meta.url` or `__dirname` in future changes to
this pipeline — either one will break under one of the two runtimes.

## Folder Layout

```
scripts/exercise-import/
  fetch.ts                    # entrypoint — run via tsx only, never imported by tests
  match.ts                    # entrypoint — run via tsx only, never imported by tests
  merge.ts                    # entrypoint — the human-approved write; run via tsx only, never imported by tests
  lib/paths.ts                 # repo-root-relative path constants
  lib/types.ts                 # zod schemas + TS types
  lib/normalize.ts             # name normalization + similarity
  lib/supabase-client.ts       # read-only client + paginated read
  lib/supabase-write-client.ts # service-role write client (merge.ts only)
  lib/verify.ts                 # dataset manifest verification
  lib/matcher.ts                 # 3-tier matcher
  lib/report.ts                   # report builder + markdown renderer
  lib/media.ts                     # image/GIF resize + 180x180 cap (sharp)
  lib/retry.ts                      # bounded retry with backoff for transient write failures
  lib/import-log.ts                  # resume-state reduction over exercise_import_log
  lib/category.ts                     # dataset category value -> CHECK-constraint mapping
  lib/merge-row.ts                     # per-row merge unit of work (upload, backup, UPDATE/INSERT)
  lib/*.test.ts                         # all tests live beside their lib module
  .dataset-cache/                       # gitignored — the git clone lands here
  README.md                             # this file
```
