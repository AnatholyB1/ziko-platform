# Technology Stack — v1.16 Exercise Library Import (`image-exo`)

**Project:** Ziko Platform — Exercise Library Import from `hasaneyldrm/exercises-dataset`
**Researched:** 2026-08-14
**Confidence:** HIGH
**Scope:** Additive only, one-off/rerunnable Node script + one Supabase migration. No mobile,
backend route, or plugin changes required — the `exercises` table is already read by the
mobile app and coach CRM as-is; this milestone only repopulates its data and adds one column.

---

## Overview

This is not a new backend capability — it's a **one-off, rerunnable data-migration script**.
The repo already has an almost-identical precedent: `scripts/food-data/import-foods.mjs`
(plain Node ESM script, `@supabase/supabase-js` admin client, env-var config, chunked
inserts with progress logging). The exercise import should follow the same shape, with two
additions the food script didn't need: (1) fetching binary media files from a public GitHub
repo, and (2) matching-by-name UPDATE instead of blind INSERT (to preserve `exercises.id`
UUIDs referenced by `program_exercises.exercise_id` / `session_sets.exercise_id`, neither of
which has `ON DELETE CASCADE`).

Recommendation: **zero new production dependencies**. Use `git clone --depth 1` (git is
already present in this environment and every dev/CI machine that can run `supabase db push`)
to fetch the dataset instead of a JS HTTP/tar library, and `@supabase/supabase-js` (already a
root dependency) for both the Postgres upsert and the Storage bulk upload. No ORM, no queue,
no ETL framework — this is a single script run once (or a handful of times during dev
iteration) by a human from their machine or CI, not a recurring job.

---

## Recommended Stack

### Fetching the dataset (17MB JSON + ~2600 media files)

| Approach | Verdict | Why |
|---|---|---|
| **`git clone --depth 1`** (child_process) | **Recommended** | Zero new deps — git is already a hard requirement of this repo (it's a git repo, PowerShell/Bash tooling assumes git). A shallow clone fetches the JSON file and both `images/` and `videos/` directories in one operation, over one connection, with git's own resumable/retry transport. Not subject to GitHub's REST API rate limit (60 req/hr unauthenticated) since it's the git smart-HTTP protocol, not `api.github.com`. |
| Tarball download (`github.com/{owner}/{repo}/archive/refs/heads/main.tar.gz` via `fetch`) + `tar` npm package to extract | Fallback only | Works, but adds a new dependency (`tar`, currently v7.5.22, requires Node ≥18) purely to reimplement what `git clone` already does natively. Use only if the execution environment cannot shell out to `git` (e.g. a locked-down serverless function — not the case here, this runs as a local/CI script). |
| `raw.githubusercontent.com` fetch per file (~2601 individual requests: 1 JSON + 1300 JPG + 1300 GIF) | **Avoid** | GitHub tightened unauthenticated rate limits for raw file access in 2025; 2600 sequential/parallel raw fetches will get throttled or blocked mid-run. Confirmed via GitHub's own changelog on updated unauthenticated rate limits. |
| GitHub REST API (`octokit`, contents API) | **Avoid** | New dependency for no benefit — the contents API is for browsing/metadata, not bulk binary transfer, and is rate-limited at 60 req/hr unauthenticated (or 5000/hr with a token you'd now have to manage as a secret for a one-off script). |

```bash
# Fetch (run once, from anywhere with git + network — not part of the app runtime)
git clone --depth 1 https://github.com/hasaneyldrm/exercises-dataset.git .tmp/exercises-dataset
```

The script then reads `.tmp/exercises-dataset/data/exercises.json` with `fs.readFileSync` +
`JSON.parse`, and walks `images/` / `videos/` with `fs.readdirSync` — no extra parsing library
needed for a flat directory of files.

**Confidence: HIGH** — verified GitHub's documented unauthenticated rate-limit behavior via
[GitHub Docs: Rate limits for the REST API](https://docs.github.com/en/rest/using-the-rest-api/rate-limits-for-the-rest-api)
and the [2025 changelog on updated unauthenticated limits](https://github.blog/changelog/2025-05-08-updated-rate-limits-for-unauthenticated-requests/);
`git clone` uses git's smart-HTTP transport, a separate code path from the REST/raw-content
rate limiters.

### Postgres upsert (~1300 rows into `public.exercises`, name-matched)

| Tool | Version | Purpose |
|---|---|---|
| `@supabase/supabase-js` | `^2.99.2` (already in root `package.json`; latest published `2.112.3`) | Admin client (`SUPABASE_SERVICE_KEY`), same client shape as `scripts/food-data/import-foods.mjs` and `backend/api/src/routes/storage.ts` |

**No unique constraint exists on `exercises.name`**, so a native Postgres `INSERT ... ON
CONFLICT (name) DO UPDATE` is not available without first adding one — and adding one is risky
given the table already has ~1324 Kaggle-seeded rows of unknown uniqueness. Instead:

1. One `SELECT id, name FROM exercises` to pull all existing rows into memory (1324 rows —
   trivial size), build a `Map<lowercased name, id>`.
2. For each of the ~1300 JSON records: look up by lowercased/trimmed name.
   - **Match found** → `supabase.from('exercises').update({...}).eq('id', id)` (preserves the
     UUID, so `program_exercises`/`session_sets` foreign keys never break).
   - **No match** → `supabase.from('exercises').insert({...})` (new UUID, safe — nothing
     references it yet).
3. Run these in **chunks of ~15–20 concurrent calls** via `Promise.allSettled` (not
   `Promise.all` — a handful of failed rows shouldn't abort the whole run), matching the
   fault-tolerant parallel pattern already used in this repo's
   `backend/api/src/routes/storage.ts` (`cleanupBucket`'s `Promise.allSettled(folders.map(...))`).
   Log failures with the exercise name so a partial re-run is trivially diagnosable.
4. **Idempotency is free**: re-running the script re-does the same name lookup and
   `update`/`insert` decision every time — no separate "already imported" flag needed.

This intentionally avoids one-`.update()`-call-per-row-in-a-single-DB-round-trip alternatives
(a temporary PL/pgSQL function taking a JSONB array + `MERGE`/loop) — writing and shipping a
throwaway SQL function for a script that runs a handful of times during this milestone is
premature machinery. ~1300 sequential/chunked HTTPS calls to Supabase's PostgREST completes in
low single-digit minutes; that's acceptable for a one-off import.

**Confidence: HIGH** for the supabase-js `.update()`/`.insert()`/`.select()` API surface
(unchanged, matches existing repo usage in `backend/api/src/coach/exercises/db.ts`); **MEDIUM**
on the exact "no unique constraint on name" conclusion — verified directly by reading
`supabase/migrations/001_initial_schema.sql` and `004_exercises_extended.sql` (no `UNIQUE`
on `name`, no matching index), but the live production table's actual current constraints
should be double-checked with `\d exercises` before writing the script, in case a later
migration (65+) added one.

### Storage bulk upload (~2600 files: ~1300 JPG thumbnails + ~1300 GIFs)

| Tool | Version | Purpose |
|---|---|---|
| `@supabase/supabase-js` Storage client | same as above | `supabase.storage.from(bucket).upload(path, buffer, { upsert: true, contentType })` |

- **New private-by-default bucket**, e.g. `exercise-media`, created via the Supabase
  dashboard/CLI (not the migration file — bucket creation is a Storage API/dashboard action,
  separate from SQL migrations, consistent with how the existing 6 buckets
  (`profile-photos`, `scan-photos`, `exports`, `coach-kyc`, `ai-imports`, `coach-exercises`)
  were provisioned).
- Files are small (JPG thumbnails, short GIFs) — well under the 6MB standard-upload threshold,
  so the **standard upload method is sufficient**; no need for Storage v3 resumable/TUS
  uploads (that API exists for 50GB-class files, not this use case).
- Upload with **`{ upsert: true }`** so re-running the script overwrites in place — same
  idempotency guarantee as the DB upsert step, no "does this file already exist" branching
  needed.
- Concurrency: chunk the ~2600 uploads into batches of ~15–20 concurrent
  `Promise.allSettled` calls — same rationale and same pattern as the DB step and the existing
  `cleanupBucket` precedent in `storage.ts`. Uncapped `Promise.all` over 2600 items risks
  Supabase Storage connection/socket exhaustion from a single Node process; a hand-rolled
  chunk loop needs no new dependency (`p-limit` was considered — current version `7.3.1`
  requires Node ≥20, which is a stricter floor than this repo's stated `"engines": { "node":
  ">=18.0.0" }` — and it exists to enforce a global concurrency ceiling across arbitrarily
  interleaved async work, which a script with one sequential loop of fixed-size batches
  doesn't need).
- After each successful upload, store the path (not a signed URL — signed URLs expire) on the
  exercise row, or use `getPublicUrl()` if the bucket is created **public** (recommended here:
  exercise media is non-sensitive stock content used to illustrate movements, unlike the
  private user-uploaded buckets in `ALLOWED_BUCKETS`, so a public bucket + `getPublicUrl()` is
  simpler than signing URLs on every read and avoids adding exercise media to the existing
  signed-URL machinery in `storage.ts`).

**Confidence: HIGH** — verified `.storage.from(bucket).upload(path, fileBody, options)` and
`.getPublicUrl(path)` signatures against Context7 (`/supabase/supabase-js`, current docs), and
cross-checked the concurrency/fault-tolerance pattern against this repo's own
`backend/api/src/routes/storage.ts:65-128`.

### Migration: new `image` column

| Tool | Convention | Why |
|---|---|---|
| Raw SQL file in `supabase/migrations/` | **`YYYYMMDD_description.sql`** (date-based), not `NNN_description.sql` | The last three migrations actually committed to this repo (`20260526_add_user_profiles_settings.sql`, `20260527_coach_exercise_id_program_exercises.sql`, `20260529_fix_trigger_n_sessions.sql`, committed 2026-05-26 to 2026-05-31) have **already moved off** the sequential-number convention the milestone brief describes (`NNN_description.sql`, last used at `064_unaccent_user_search.sql`). Follow the convention the codebase is actually using today, not the older documented one. |

```sql
-- supabase/migrations/20260814_exercises_add_image_column.sql
ALTER TABLE public.exercises
  ADD COLUMN IF NOT EXISTS image TEXT;
```

`IF NOT EXISTS` matches the idempotent style already used in `004_exercises_extended.sql` and
`011_name_fr.sql`. No RLS change needed — `exercises` already has
`read_exercises` (`is_custom = FALSE OR user_id = auth.uid()`), which already covers a new
nullable column with no policy changes.

**Confidence: HIGH** — directly observed from `git log` commit dates on both migration
families (numbered migrations' most recent commit 2026-05-31 vs. date-based migrations'
commits 2026-05-26 to 2026-05-31 — overlapping/interleaved, but date-based is the pattern used
for every migration added in the final week of activity).

---

## Alternatives Considered

| Category | Recommended | Alternative | Why Not |
|---|---|---|---|
| Dataset fetch | `git clone --depth 1` | GitHub tarball/zipball via `fetch` + `tar` npm pkg | Adds a dependency to reimplement what git already does; only justified if `git` were unavailable in the execution environment (it isn't). |
| Dataset fetch | `git clone --depth 1` | Per-file `raw.githubusercontent.com` fetch | 2600+ individual unauthenticated requests hit GitHub's 2025-tightened anonymous rate limits mid-run. |
| DB write | Fetch-once + name-matched `update`/`insert` via supabase-js | Native `INSERT ... ON CONFLICT (name)` | No unique constraint on `exercises.name` today; adding one is a schema risk against an unaudited 1324-row Kaggle-seeded table, and unnecessary for a script that runs a handful of times. |
| DB write | Fetch-once + name-matched `update`/`insert` via supabase-js | PL/pgSQL bulk-merge function taking JSONB array | Extra migration + function to maintain for a throwaway one-off script; ~1300 chunked round-trips is fast enough. |
| Storage upload | Chunked `Promise.allSettled` (hand-rolled, no new dep) | `p-limit` | `p-limit@7` requires Node ≥20, stricter than this repo's stated `engines.node >=18.0.0`; a fixed-size batch loop achieves the same concurrency cap with zero new dependency, and the repo already has this exact pattern in `storage.ts`. |
| Storage upload | Standard `upload()` with `upsert: true` | Resumable/TUS uploads | Files are small (JPG/GIF, well under 6MB); resumable uploads exist for the 50GB-class use case this isn't. |
| Media URLs | Public bucket + `getPublicUrl()` | Private bucket + signed URLs (as used for `coach-exercises`) | Exercise media is non-sensitive stock/library content (unlike user-uploaded photos/videos in the existing private buckets) — public URLs avoid re-signing on every read and don't need `ALLOWED_BUCKETS`/ownership-path RLS wiring. |
| Migration numbering | `YYYYMMDD_description.sql` | `NNN_description.sql` (per milestone brief) | Codebase has already drifted to date-based naming for its most recent migrations; matching current practice over the (now-stale) documented convention. |

## Installation

No new dependencies required.

```bash
# Nothing to npm install — @supabase/supabase-js is already a root dependency (^2.99.2).
# The only new tool used is `git`, already present in this environment.
```

If the tarball fallback is ever needed instead of `git clone` (e.g. a sandboxed CI runner with
no `git` binary):
```bash
npm install --save-dev tar   # v7.5.22 current; requires Node >=18
```

## What NOT to Add

- **No ORM** (Prisma/Drizzle) — the rest of the backend talks to Supabase via `supabase-js`
  or raw SQL migrations; introducing an ORM for one script breaks that consistency for no gain.
- **No queue/job system** (BullMQ, Inngest, etc.) — this is a script invoked directly by a
  human (`node scripts/exercise-media-import/import.mjs`), not a recurring or user-triggered
  job; the existing Vercel cron pattern (`storage.ts` cleanup, `supplements` scraper) is for
  recurring jobs and doesn't apply here.
- **No new npm packages for GitHub access** (`octokit`, `simple-git`) — plain
  `child_process.execFileSync('git', [...])` is sufficient for a single shallow clone.
- **No `p-limit`/`p-queue`** — hand-rolled fixed-size batching (already precedented in this
  repo) covers the concurrency-capping need without a new dependency or Node-version bump.
- **No new unique constraint/index on `exercises.name`** — the in-memory `Map` lookup achieves
  idempotent matching without touching existing table constraints or risking a migration
  failure against unknown duplicate names in the current seed data.

## Sources

- [GitHub Docs — Rate limits for the REST API](https://docs.github.com/en/rest/using-the-rest-api/rate-limits-for-the-rest-api) (HIGH — official docs)
- [GitHub Changelog — Updated rate limits for unauthenticated requests (2025-05-08)](https://github.blog/changelog/2025-05-08-updated-rate-limits-for-unauthenticated-requests/) (HIGH — official)
- Context7 `/supabase/supabase-js` — Storage `upload`/`update`/`getPublicUrl`/`createSignedUrl` API surface (HIGH)
- `npm view @supabase/supabase-js version` → `2.112.3` current published (root repo pins `^2.99.2`, backend pins `^2.50.0`) (HIGH — verified locally)
- `npm view tar version` → `7.5.22`; `npm view p-limit version` → `7.3.1` (`engines.node >=20`) (HIGH — verified locally)
- Repo evidence: `scripts/food-data/import-foods.mjs` (bulk-import script precedent), `backend/api/src/routes/storage.ts` (bucket allowlist + `Promise.allSettled` chunking precedent), `backend/api/src/coach/exercises/db.ts` (admin-client Storage upload/sign precedent), `supabase/migrations/001_initial_schema.sql` + `004_exercises_extended.sql` (no unique constraint on `exercises.name`), `git log` commit dates on `supabase/migrations/` (date-based naming is the current convention)
