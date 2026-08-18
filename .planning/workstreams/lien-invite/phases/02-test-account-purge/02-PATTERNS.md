# Phase 2: Test-Account Purge - Pattern Map

**Mapped:** 2026-08-13
**Files analyzed:** 4 (dry-run export script, backup/export step, delete script, optional shared lib)
**Analogs found:** 4 / 4

No RESEARCH.md exists for this phase; file list and requirements were derived from
`02-CONTEXT.md` and its `canonical_refs` (`research/ARCHITECTURE.md` §6, `research/PITFALLS.md`
Pitfall 13).

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|--------------------|------|-----------|-----------------|----------------|
| `scripts/purge-test-accounts-dry-run.mjs` | utility (one-off Node script) | batch / read-only query | `scripts/food-data/import-foods.mjs` | role-match (script shape) + `apps/web/src/actions/account.ts` (Supabase Auth Admin API calls) |
| `scripts/purge-test-accounts-export.mjs` (or a shared function inside the dry-run script — Claude's discretion per D-04/discretion notes) | utility (file I/O / backup) | batch / file-I/O | `scripts/csv-to-seed.js` (CSV/file writing conventions) + `scripts/food-data/import-foods.mjs` (Supabase read pattern) | role-match |
| `scripts/purge-test-accounts-delete.mjs` | utility (destructive batch op) | batch / event-driven (Admin API calls) | `apps/web/src/actions/account.ts` (the `admin.auth.admin.deleteUser()` call itself) + `scripts/food-data/import-foods.mjs` (script scaffolding: env-var config, `createClient`, `node <file>.mjs` invocation) | exact (deletion call) / role-match (script shape) |
| (optional) `scripts/lib/purge-supabase-admin.mjs` — shared admin-client helper reused by all three scripts, mirroring `createAdminClient()` | utility (config/factory) | — | `apps/web/src/lib/supabase/admin.ts` | role-match (same factory pattern, but must be reimplemented as a plain `.mjs` — the Next.js file uses `'server-only'` and TS, which don't apply outside `apps/web`) |

**Naming/location note:** Existing one-off root scripts use kebab-case verb-first-ish names
(`csv-to-seed.js`, `json-to-seed.js`) and the `food-data/` subfolder groups a related import script
(`import-foods.mjs`). Given three related purge scripts, `scripts/purge-test-accounts/` (mirroring
the `scripts/food-data/` subfolder convention) is a reasonable location — Claude's discretion per
CONTEXT.md `<decisions>` "Exact shape/location... is Claude's discretion."

## Pattern Assignments

### `scripts/purge-test-accounts-dry-run.mjs` (utility, batch/read-only)

**Primary analog:** `scripts/food-data/import-foods.mjs` (script scaffolding, env config, Supabase client)
**Secondary analog:** `apps/web/src/actions/account.ts` (Admin API idiom, though this file only *reads* via `listUsers`)

**Header + usage comment convention** (`scripts/food-data/import-foods.mjs:1-7`):
```js
/**
 * Import food database from USDA SR Legacy + curated French foods
 * into Supabase food_database table.
 *
 * Usage: node import-foods.mjs
 * Requires: SUPABASE_URL and SUPABASE_SERVICE_KEY env vars
 */
```
Adapt to: `Usage: node scripts/purge-test-accounts-dry-run.mjs` / `Requires: SUPABASE_URL and
SUPABASE_SERVICE_ROLE_KEY env vars` (note: this repo's actual server env var name is
`SUPABASE_SERVICE_ROLE_KEY` per `apps/web/.env.local` — `import-foods.mjs` uses the differently-named
`SUPABASE_SERVICE_KEY`, which is this file's own local convention, not the house standard; the new
purge scripts should follow `apps/web/src/lib/supabase/admin.ts`'s var names, not `import-foods.mjs`'s).

**Config + client-init pattern** (`scripts/food-data/import-foods.mjs:14-27`):
```js
import { createClient } from '@supabase/supabase-js';

const __dirname = dirname(fileURLToPath(import.meta.url));

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Set SUPABASE_URL and SUPABASE_SERVICE_KEY env vars');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});
```
This is the closest concrete precedent for hitting Supabase directly from a plain `.mjs` root script
(no build step, no `server-only` import, no framework). Reuse this shape for all three purge scripts;
require both `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`, fail fast with `process.exit(1)` if
either is missing — this doubles as the safety gate noted in D-03 ("no production
`SUPABASE_SERVICE_ROLE_KEY` has been available"): the script will simply refuse to run without it.

**Query pattern (dry-run read, not delete):** No existing script queries `auth.users` directly (Admin
API only, since `auth.users` is Supabase-managed — see `research/ARCHITECTURE.md` §6). Use the same
`supabase` client's `auth.admin.listUsers({ page, perPage })` (already used as the fallback path in
`apps/web/src/actions/account.ts:40-42`) paginated to enumerate all users, then filter client-side by
`email.toLowerCase().endsWith('@ziko-app.com')` — this matches D-02's literal criterion applied over
the full row set. Do not use a `LIKE` SQL query against `auth.users` (it's not directly queryable via
the JS client the way `public.*` tables are).

```js
// apps/web/src/actions/account.ts:40-42 — fallback listUsers pattern, reusable for dry-run enumeration
const admin = createAdminClient();
const { data } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
return data?.users.find((u) => u.email?.toLowerCase() === email)?.id ?? null;
```
Adapt to a loop over pages, filter (not `.find`), and additionally cross-check each candidate's
`user.id` against `coach_client_links` / `coach_vocal_feedbacks` / any `assigned_to_user_id` column
(via the same `supabase` client's regular `.from('coach_client_links').select(...)` — a standard
Supabase-js query, not Admin-API-specific) to implement D-05's cross-link exclusion.

**Output:** print/export the candidate row set (id, email, created_at) — see the export pattern
below — never delete in this file.

---

### `scripts/purge-test-accounts-export.mjs` (utility, file-I/O / backup)

**Analog:** `scripts/csv-to-seed.js` (file-writing conventions) + `scripts/food-data/import-foods.mjs` (Supabase read)

**File writing pattern** (`scripts/csv-to-seed.js:1-11`, `apps/web/scripts` scripts use the same
`fs`/`path` idiom):
```js
/**
 * Convert Kaggle fitness exercises CSV → SQL INSERT statements
 * Run: node scripts/csv-to-seed.js
 * Output: supabase/seed_exercises.sql
 */
const fs = require('fs');
const path = require('path');

const csvPath = path.join(__dirname, '..', 'kaggle_data', 'exercises.csv');
const outPath = path.join(__dirname, '..', 'supabase', 'seed_exercises.sql');
```
Note: `csv-to-seed.js` and `json-to-seed.js` are CommonJS (`.js`, `require`), while
`import-foods.mjs` and `gen-og-coachs.mjs` are ESM (`.mjs`, `import`). Since the purge scripts need
`import { createClient } from '@supabase/supabase-js'` (an ESM-friendly package) and need
`import.meta.url` for `__dirname` resolution (as `import-foods.mjs` does at line 14), prefer the
`.mjs`/ESM convention (`import-foods.mjs`, `gen-og-coachs.mjs`) over the older `.js`/CommonJS
scripts for these new files.

**Export format:** produce a timestamped CSV (or JSON) under a git-ignored path (e.g.
`scripts/purge-test-accounts/exports/`, or `/tmp` — confirm not committed) containing exactly the
columns D-04 specifies: id, email, created_at, tier, any waitlist rows. This is the "backup
checkpoint" step from `research/PITFALLS.md` Pitfall 13 step 3 — it must run and succeed before the
delete script is invoked. Simplest approach per CONTEXT.md's Claude's Discretion note: fold this
into the dry-run script as a `--export` flag / second output file, rather than a fully separate
script, if that keeps the two read-only steps (list + export) together and the destructive step
(delete) isolated in its own file.

---

### `scripts/purge-test-accounts-delete.mjs` (utility, destructive batch — Admin API)

**Primary analog:** `apps/web/src/actions/account.ts` — the exact `admin.auth.admin.deleteUser()` call this phase must reuse.

**Core deletion pattern** (`apps/web/src/actions/account.ts:84-92`):
```typescript
// Delete user
const admin = createAdminClient();
const { error } = await admin.auth.admin.deleteUser(userId);

if (error) {
  return {
    status: 'error',
    message: 'Erreur lors de la suppression. Contactez le support.',
  };
}
```
Adapt directly: loop over the reviewed candidate ID list (loaded from the dry-run export file, not
re-queried — this is the "human reviewed this exact row set" contract from D-02), call
`admin.auth.admin.deleteUser(id)` per row, log success/failure per row (do not silently swallow
errors the way the web action does for anti-enumeration reasons — this is an operational script, not
a public-facing form, so verbose logging is correct here), and stop or collect a failure list rather
than continuing blindly.

**Admin client factory to mirror** (`apps/web/src/lib/supabase/admin.ts:1-16`):
```typescript
import 'server-only';
import { createClient } from '@supabase/supabase-js';

export function createAdminClient() {
  return createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    }
  );
}
```
Reimplement this factory inline in the `.mjs` script (drop `'server-only'` and TS types — those are
Next.js/TS-specific and don't apply to a plain Node script) using the same `SUPABASE_URL` +
`SUPABASE_SERVICE_ROLE_KEY` env var names and the same `auth: { persistSession: false,
autoRefreshToken: false }` options, so the purge scripts' client config matches the house Admin
client exactly rather than inventing a third variant (`import-foods.mjs`'s own
`SUPABASE_SERVICE_KEY` name should not be propagated further).

**No raw SQL DELETE:** per `research/ARCHITECTURE.md` §6 and Pitfall 13 step 4, never issue
`DELETE FROM auth.users` directly — always go through `admin.auth.admin.deleteUser(id)` so Supabase's
internal auth bookkeeping (sessions, refresh tokens, identities) is torn down consistently and the
documented `ON DELETE CASCADE` chains (31 migration files, confirmed) fire as designed.

**Safety gate:** since this script is destructive and D-03 mandates it must not auto-run against
production, require an explicit confirmation flag (e.g. `--confirm` or an interactive prompt reading
`stdin`) plus a check that the export/backup step has already run (e.g. refuse to proceed unless a
recent export file path is passed in) before calling `deleteUser` in a loop — this operationalizes
the "one person runs it, a second reviews the dry-run output first" two-person rule from Pitfall 13
step 6 and D-02.

---

## Shared Patterns

### Supabase Admin client construction
**Source:** `apps/web/src/lib/supabase/admin.ts` (canonical factory) + `scripts/food-data/import-foods.mjs:14-27` (plain-script equivalent)
**Apply to:** all three purge scripts — every script should build its Supabase client the same way,
requiring `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` and failing fast if either is missing.
```js
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY env vars');
  process.exit(1);
}
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});
```

### Admin API deletion (never raw SQL)
**Source:** `apps/web/src/actions/account.ts:84-92`
**Apply to:** `purge-test-accounts-delete.mjs` only.
```typescript
const { error } = await admin.auth.admin.deleteUser(userId);
```

### One-off script scaffolding (ESM, `.mjs`, no build step)
**Source:** `scripts/food-data/import-foods.mjs`, `apps/web/scripts/gen-og-coachs.mjs`
**Apply to:** all three purge scripts.
- Header docblock with `Usage:` / `Requires:` env vars
- `import { fileURLToPath } from 'url'` + `dirname(fileURLToPath(import.meta.url))` for `__dirname`
- Invoked as `node scripts/<name>.mjs`, no TypeScript, no build step, no dependency beyond
  `@supabase/supabase-js` (already a root + `apps/web` dependency)

### CSV/file export conventions
**Source:** `scripts/csv-to-seed.js:1-11` (path construction), adapted from `.js`/CommonJS to `.mjs`/ESM per the ESM decision above.
**Apply to:** the export/backup step.

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| Cross-link detection query (`coach_client_links` / `coach_vocal_feedbacks` / `assigned_to_user_id` join against candidate list) | utility (query logic) | transform | No existing script or route performs this specific "join candidate list against cross-user tables" check; it is new logic per D-05. Use standard `supabase.from('coach_client_links').select(...)` calls (well-precedented elsewhere in `backend/api/src/coach/*/db.ts` for the query shape, though those are TS/Hono `db.ts` files, not directly reusable as file analogs for this plain-Node script context) and write the join/filter logic fresh. |

## Metadata

**Analog search scope:** `scripts/`, `apps/web/scripts/`, `apps/web/src/actions/account.ts`, `apps/web/src/lib/supabase/admin.ts`
**Files scanned:** `scripts/csv-to-seed.js`, `scripts/json-to-seed.js`, `scripts/food-data/import-foods.mjs`, `apps/web/scripts/gen-og-coachs.mjs`, `apps/web/scripts/generate-og-image.js`, `apps/web/src/actions/account.ts`, `apps/web/src/lib/supabase/admin.ts`
**Pattern extraction date:** 2026-08-13
