# Exercise Import Pipeline

Replaces the exercise library (1324 exercises: GIFs, 180x180 thumbnails,
FR/EN instructions) from the `hasaneyldrm/exercises-dataset` dataset,
matched against the live `public.exercises` table by name.

This phase (Phase 2 — download & match dry-run) performs **zero writes**.
It clones the dataset, matches it against production by name, and writes
a markdown report for human review. The actual `UPDATE` happens in a
later, human-approved phase.

## Pipeline Order

1. `fetch.ts` — clones the dataset git repository into
   `scripts/exercise-import/.dataset-cache/` and verifies the manifest
   (`exercises.schema.json`) against the expected shape.
2. `match.ts` — reads the live `public.exercises` table (read-only), runs
   the 3-tier name matcher against the cloned dataset, categorizes the
   results (exact / fuzzy / unmatched), and writes the dry-run report.

Run `fetch.ts` before `match.ts` — `match.ts` reads from the cache
directory that `fetch.ts` populates.

## Required Environment Variables

Both scripts load environment variables from `backend/api/.env.local`
(see Invocation below). Only these two variables are required:

- `SUPABASE_URL`
- `SUPABASE_PUBLISHABLE_KEY`

**Never set or use `SUPABASE_SERVICE_KEY` for this pipeline.** This phase
performs zero writes, and the existing `read_exercises` RLS policy on
`public.exercises` already grants read access to every `is_custom = FALSE`
row for an unauthenticated publishable-key client. There is no scenario
in this pipeline where the service key is required, and it must never be
loaded, printed, or referenced by any script here — using it would be an
unnecessary privilege escalation for a read-only workload.

## Invocation

Run both commands **from the repo root** — every path in `lib/**` is
repo-root-relative and scripts will fail (or silently misresolve paths)
if run from any other working directory.

```bash
npx tsx --env-file=backend/api/.env.local scripts/exercise-import/fetch.ts
npx tsx --env-file=backend/api/.env.local scripts/exercise-import/match.ts
```

The `--env-file` flag mirrors backend/api's existing `dev` script
convention (`cross-env PORT=8080 tsx watch --env-file=.env.local ...`).

### Flags

- `--refetch` on `fetch.ts` — forces a fresh git clone instead of reusing
  the existing `.dataset-cache/` directory. Use this if the dataset cache
  looks stale or corrupted.

## Tests

```bash
npm run test:import
```

Runs the root-level vitest config (`vitest.config.ts`), scoped to
`scripts/exercise-import/**/*.test.ts`. All testable logic lives in
`lib/**`; `fetch.ts` and `match.ts` are thin entrypoints that call
`main()` unconditionally at module load, so tests never import them
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
  fetch.ts                  # entrypoint — run via tsx only, never imported by tests
  match.ts                  # entrypoint — run via tsx only, never imported by tests
  lib/paths.ts               # repo-root-relative path constants
  lib/types.ts               # zod schemas + TS types
  lib/normalize.ts           # name normalization + similarity
  lib/supabase-client.ts     # read-only client + paginated read
  lib/verify.ts               # dataset manifest verification
  lib/matcher.ts               # 3-tier matcher
  lib/report.ts                 # report builder + markdown renderer
  lib/*.test.ts                 # all tests live beside their lib module
  .dataset-cache/               # gitignored — the git clone lands here
  README.md                     # this file
```
