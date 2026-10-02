# Phase 5: Storage Migration - Research

**Researched:** 2026-10-02
**Domain:** Supabase Storage cross-project copy, storage.objects RLS rewrite, signed-URL auth testing, bucket-literal codemod
**Confidence:** HIGH on repo/live-state facts (read or queried today), MEDIUM on Storage-server behaviours not probed (cache-control round-trip, role privilege on storage.objects)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Buckets are recreated as `ziko-<id>` with settings **read live from ziko `storage.buckets` at run time** (public flag, `file_size_limit`, `allowed_mime_types`) — exact copy, nothing hardcoded. Known live values on 2026-10-02: `exercise-media` public, 2 MB, png/gif; `ai-imports` private, 25 MB, pdf/xlsx/xls/docx; `coach-videos` private, mp4/quicktime/x-m4v; `avatars`, `coach-logos` public; rest private/no limits.
- **D-02:** The `profile-photos` quirk (private bucket, but mobile calls `getPublicUrl`) is **copied as-is** and logged as a known pre-existing issue — not fixed in this phase (rename-and-relocate scope).
- **D-03:** The 25 `storage.objects` policies are **generated from live `pg_policies`**, rewritten: bucket ids → `ziko-<id>`, `is_coach_of` → `ziko_is_coach_of`, and **policy names prefixed `ziko_`** to avoid collision with portfolio's 17 policies on the shared `storage.objects`. Shipped as a migration file in the portfolio series and checked by a stale-reference grep (same approach as Phase 2 SCHEMA-04). Policies are created before any object is copied.
- **D-04:** **Phase 5 builds the bucket-name codemod, Phase 6 merges/flips it.** Scripted, rename-map-driven, covering the ~57 literals across ~26 files (mobile, web, backend `storage.ts` ALLOWED_BUCKETS, coach services, plugins), preferably introducing a central bucket-name constant. Committed separately, behaviour-inert until the Phase 6 flip. Mobile binaries cannot be patched after release, so this must be exact.
- **D-05:** DB rows holding full storage URLs (host + bucket segment; 3 known rows in `user_profiles`/`body_measurements`, live scan may find more) are fixed **in-flight in the Phase 4 loader** (`scripts/portfolio-migration/lib-data.mjs` / `05-load-data.mjs` transform): rewrite ziko host → portfolio host and `/<bucket>/` → `/ziko-<bucket>/`. Phase 5 adds a live scan of all text/jsonb columns for old host/bucket patterns and a verify check asserting zero leftovers on portfolio. No after-the-fact UPDATE (a Phase 6 truncate-reload must stay consistent).
- **D-06:** Transport is a **Node `.mjs` script in `scripts/portfolio-migration/`** (next number in the series) using supabase-js Storage API with service-role keys from a gitignored file: list each ziko bucket → download → upload to `ziko-<bucket>` preserving content-type/cache-control, bounded concurrency, idempotent skip when size+hash already match. Collision-user objects under `<source uuid>/` are re-keyed to `<target uuid>/` (target read from `scripts/auth-merge/uuid-remap.json`, never hardcoded; spec §8). Service-role key use stays out of `backend/api/src/**`.
- **D-07:** Final delta (Phase 6, inside write-freeze) re-runs the same script **add-only**: copy new/changed objects, **never auto-delete** on portfolio; destination-only objects are reported for human review. Objects created after the rehearsal are covered by this.
- **D-08:** Rehearse on the Phase 2 scratch project first (full copy + verification + auth tests), then a human typed-phrase checkpoint (Phase 3/4 pattern), then the real portfolio copy. Retire any PAT/keys on every path.
- **D-09:** STORAGE-02 verification is **full, no sampling**: per-object SHA-256 (hash streamed source bytes, re-download from destination and compare), exact per-bucket object count and total bytes, re-keyed objects mapped through the remap. Re-runnable, `--check <name>`/`--check all` style, JSON + PII-safe masked summary (no raw user ids/emails in git-tracked files), modeled on `06-verify-data.mjs`.
- **D-10:** STORAGE-04: **scratch full rehearsal + portfolio smoke.** Scratch: scripted suite with throwaway athlete/coach/outsider users covering every bucket's upload, download and cross-user denial through real policies and the real code paths (backend `/storage/upload-url`, coach exercises/videos/clients signed URLs, web `api/storage/upload-url` and `api/photo`). Portfolio: after the real copy, a smaller read-only check with temporary test users cleaned up afterwards (Phase 3 D-07 pattern). Mobile/web UI-level flows deferred to the Phase 6 smoke test.

### Claude's Discretion
Script numbering/module layout, concurrency tuning, retry policy, exact name of the central bucket constant, how throwaway users are created/cleaned, handling of the empty buckets (`coach-videos`, `exports`) in hash checks, `storage.objects` owner/metadata columns handling beyond what the Storage API sets.

### Deferred Ideas (OUT OF SCOPE)
- Fixing the `profile-photos` private-bucket/`getPublicUrl` mismatch — functional fix, outside rename-and-relocate; candidate backlog item after the migration.
- Mirror/delete-extras sync for storage — rejected for user-data safety; revisit only if parity drift becomes an issue.
- Env-driven bucket prefix config — rejected for now (new mechanism, needs EXPO_PUBLIC var).
- Portfolio's own four ownership-less storage policies (album-*, portfolio-photos) — pre-existing, not a ziko item.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| STORAGE-01 | Buckets recreated in portfolio with `ziko-` prefix (10, not 9) | Live bucket config table below; create via Storage API `createBucket` + `updateBucket` for idempotency; verify check compares `storage.buckets` rows exactly |
| STORAGE-02 | Objects copied with count/checksum verification | SQL-based enumeration of `storage.objects`, API download/upload, re-key rule, SHA-256 round trip, cache-control caveat |
| STORAGE-03 | storage RLS policies rebuilt on renamed buckets | Live `pg_policies` incl. roles; generator rules; ACL parity of `ziko_is_coach_of` verified; migration file path `supabase/portfolio-migrations/` |
| STORAGE-04 | Signed-URL flows retested with real authenticated sessions | Per-bucket test matrix; which code paths use service key (bypass RLS) vs user session; in-process test harness |
</phase_requirements>

## Summary

The transport problem is small (2,699 objects, ~205 MB, largest object 4.5 MB, no special-character names, no `.emptyFolderPlaceholder` rows), so correctness and fidelity, not throughput, drive the design. Enumerate source objects with SQL on `storage.objects` (via the existing `runSql`, read-only), not the Storage `list()` API: `list()` is non-recursive, defaults to 100 rows, and returns folders as null-id entries, and every one of the 2,699 objects is nested under a folder prefix. SQL also yields `metadata.size/mimetype/cacheControl` in one pass. Use the Storage API (service-role key) only for download and upload.

The biggest risks are not in the copy. They are: (1) the codemod cannot be "inert" if merged to `main`, because Vercel deploys API and web from `main` and the mobile EAS build reads the repo, so it has to live unmerged until Phase 6; (2) portfolio already holds the Phase 4 data load (done 2026-10-02) with 3 rows still carrying ziko storage URLs, so D-05 only takes effect after a loader re-run, which needs a typed-phrase checkpoint; (3) the collision user owns 36 objects across 7 buckets that must be re-keyed, and the loader has already rewritten the matching DB paths to the target UUID; (4) cache-control fidelity cannot be guaranteed by `storage-js` `upload()` (it only emits `max-age=<n>`), and 31 live objects carry `no-cache`; (5) codemod false positives (`['coach-videos', userId]` query key, `join(__dirname,'exports')` in purge-test-accounts) and non-`.from()` literals (`?bucket=scan-photos`, `.split('/profile-photos/')`).

**Primary recommendation:** Build `lib-storage.mjs` (pure) plus four scripts (policy generator, copy, verify, auth-test suite) and a rename-map-driven codemod on an unmerged branch. Run order: policies migration, then buckets, then objects, then loader re-run with URL-rewrite hook, then verify, then auth tests on scratch, then the typed-phrase checkpoint, then the same sequence on portfolio.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Bucket config + object bytes | Storage (Supabase) | Operator script (Node) | Buckets/objects live in Storage; copy runs from operator machine |
| Access control (who reads/writes which path) | Database (`storage.objects` RLS) | API (service-key bypass) | Policies on `storage.objects` decide user-JWT access; backend uses service key and bypasses them |
| Signed upload/read URL issuance | API / Backend (Hono, Next route) | Storage | Backend + Next routes call `createSigned*Url`; web `api/photo` and `api/storage/upload-url` use the user session client, so they go through RLS |
| Stored URL / path columns | Database (`ziko_*` text/jsonb) | Operator script (loader transform) | Rewritten during COPY, not post-hoc |
| Bucket-name literals | Client + Backend source | Codemod script | Mobile/web/backend/plugins hardcode names |
| Collision-user folder re-key | Operator script | Database (loader UUID remap) | Object keys re-keyed in transport; DB paths already remapped by Phase 4 |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@supabase/supabase-js` (+ `storage-js`) | 2.99.2 installed at repo root (apps range 2.47-2.100) [VERIFIED: node_modules/@supabase/*/package.json] | Storage download/upload/createBucket, user-JWT auth tests | Already the repo client; D-06 mandates it |
| `pg` + `pg-copy-streams` | already used by `05-load-data.mjs` [VERIFIED: codebase] | Loader transform extension only | Existing Phase 4 transport |
| Node built-ins (`node:crypto`, `node:test`, `node:fs`) | Node 26.4.0 local [VERIFIED: `node --version`] | SHA-256, tests | Same convention as Phase 3/4 (`node --test` glob form on Node 26 per STATE) |
| `scripts/auth-merge/lib.mjs` | repo | `PROJECTS`, `parseCliArgs`, `assertWriteAllowed`, `runSql`, `getProjectApiKeys`, `redactPii`, `isMain` | Reuse, do not re-implement |
| `scripts/portfolio-migration/lib-verify.mjs` | repo | `assertReportSafe`, `maskUuid` | PII-safe report gate |

No new npm or PyPI packages are needed. The codemod is a plain Node script (regex over a fixed file list); `ts-morph`/`jscodeshift` are not warranted for ~28 files and add install risk.

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| API `createBucket` | SQL `INSERT INTO storage.buckets` | SQL works (repo migrations do it) but API keeps config reads/writes symmetric and respects server-side defaults. Use API, verify via SQL. |
| `list()` enumeration | SQL on `storage.objects` | `list()` needs recursion/pagination; SQL is exact. Use SQL. |
| Central constant in `@ziko/coach-sdk` | Per-surface constants | coach-sdk is a published package (`private:false`, `publish-coach-sdk.yml`; web pins `^0.1.0`) so adding a constant forces a republish and may be resolved from the registry, not the workspace [ASSUMED]. Use per-surface modules (see Codemod). |

**Installation:** none.

## Package Legitimacy Audit

| Package | Registry | Age | Downloads | Source Repo | slopcheck | Disposition |
|---------|----------|-----|-----------|-------------|-----------|-------------|
| (none new) | - | - | - | - | n/a | No external packages are installed in this phase; all dependencies already exist in the lockfile |

**Packages removed due to slopcheck [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

## Live State Facts (queried read-only on 2026-10-02 via `runSql`)

### Ziko buckets (source) [VERIFIED: live query]
| Bucket | Public | file_size_limit | allowed_mime_types | Objects | Bytes | Cache-Control on objects |
|--------|--------|-----------------|--------------------|---------|-------|--------------------------|
| ai-imports | no | 26214400 | pdf, xlsx, xls, docx | 9 | 27,234,830 | all `no-cache` |
| avatars | yes | - | - | 2 | 163,805 | 1 `max-age=3600`, 1 `no-cache` |
| coach-exercises | no | - | - | 5 | 2,948,150 | `no-cache` |
| coach-kyc | no | - | - | 6 | 13,936,337 | `max-age=3600` |
| coach-logos | yes | - | - | 1 | 760,224 | `max-age=3600` |
| coach-videos | no | - | mp4, quicktime, x-m4v | 0 | 0 | - |
| exercise-media | yes | 2097152 | png, gif | 2660 | 150,974,615 (max single 232,244) | `max-age=3600` |
| exports | no | - | - | 0 | 0 | - |
| profile-photos | no | - | - | 3 | 1,633,983 | `no-cache` |
| scan-photos | no | - | - | 13 | 16,553,057 | `no-cache` |

Totals: 2,699 objects. All names contain `/` (every object is in a folder). Zero names with characters outside `[A-Za-z0-9._/ -]`. Max name length 105. Largest object 4,579,734 bytes. No `.emptyFolderPlaceholder` rows. 17 of the objects have `owner`/`owner_id` set; the rest are null (service-role/signed uploads). No policy references owner (all use `bucket_id` + `storage.foldername`), so owner need not be preserved.

### Collision user [VERIFIED: live query]
36 objects under `ea0f0b65-6681-4780-8ee0-dbf20b95d4d9/`: coach-exercises 5, coach-kyc 4, coach-logos 1, avatars 2, profile-photos 2, scan-photos 13, ai-imports 9. Target UUID `2b6a60fa-f37a-45a8-bf3f-e6b6681917e5` from `scripts/auth-merge/uuid-remap.json` (never hardcode; use `parseRemapFile` from `lib-data.mjs`). The loader (`createRemapTransform`) already replaced the source UUID everywhere in loaded rows, so DB path columns point at `<target uuid>/...`; objects must follow.

### Storage policies [VERIFIED: live query]
25 policies on ziko `storage.objects`; each has `roles` that must be preserved: `{public}` for ai_imports_* (3), avatar_public_read, coach_logos_public_read, coach_videos_* (3), profile_photos_public_read; `{authenticated}` for the other 16. All PERMISSIVE. Portfolio has 17 policies, zero `ziko-` buckets, zero name collisions. `is_coach_of` on ziko and `ziko_is_coach_of` on portfolio are both SECURITY DEFINER with identical ACL (`postgres, anon, authenticated, service_role` EXECUTE), so the `coach_videos_coach_read` policy will not hit "permission denied for function" [VERIFIED: live pg_proc.proacl both sides].

### Scratch project [VERIFIED: `supabase projects list` + live query]
`rkirvurggtgjlkeuhded` (`ziko-migration-scratch`, eu-west-3, PG 17.6.1.166, ACTIVE_HEALTHY). It has `ziko_is_coach_of`, 39 `auth.users` (loaded in Phase 3 rehearsal), zero buckets. Portfolio `ubxllsvanurkwkohzxau` is ACTIVE_HEALTHY with 17 storage policies and no `ziko-*` buckets. Ziko is `slkobhavpwsubnsmuhya` (linked).

### URL-bearing rows [VERIFIED: live scan of every text/varchar/json/jsonb column in public, pattern `storage/v1/object|<ziko ref>`]
Only `user_profiles` (2 rows) and `body_measurements` (1 row). No other table matches. Phase 5 must re-run this scan at plan/run time rather than trust the count.

### Portfolio already holds loaded data
`scripts/portfolio-migration/reports/portfolio-load.json` (apply, 2026-10-02T13:14Z). Those 3 URL rows are currently copied verbatim (stale host/bucket). See Pitfall 2.

## Architecture Patterns

### System Architecture Diagram

```
 ziko (read-only)                      operator machine (Node scripts)                       target (scratch -> portfolio)
 ----------------                      -------------------------------                       -----------------------------
 pg_policies  ---> 07-gen-policies ---> supabase/portfolio-migrations/<ts>_portfolio_ziko_storage.sql --(runSql, guarded)--> storage.objects policies (ziko_*)
 storage.buckets --> 08-copy: createBucket/updateBucket(ziko-<id>, live cfg) -----------------------------------------------> storage.buckets
 storage.objects (SQL list: name,size,mime,cc)
        |                               for each object (concurrency N, retry)
        +--> Storage API download ----> sha256(src) --> rekey(name) if first segment == source uuid
                                              |--> skip if dest size+sha match
                                              +--> upload(contentType, cacheControl, upsert) --> ziko-<bucket>/<name>
 DB rows (ziko public.*) --> 05-load-data (COPY) --> UUID remap transform --> URL-rewrite transform (NEW, D-05) --> ziko_* tables
 09-verify --check buckets|policies|objects|hashes|urls|tenants|all  <-- reads both sides, re-downloads dest, masks PII, JSON report
 10-auth-tests (throwaway athlete/coach/outsider, real JWTs) --> Storage API + backend app.request + web handlers --> pass/fail matrix
 11-codemod-buckets (unmerged branch) --> rewrites ~28 files; --check asserts zero residual old literals
```

### Recommended file layout
```
scripts/portfolio-migration/
  lib-storage.mjs / .test.mjs         # pure: bucket map, rekey, policy rewrite, url rewrite regex, diff evaluators
  07-generate-storage-policies.mjs    # reads live pg_policies -> migration file (+ --check stale-reference grep)
  08-copy-storage.mjs                 # --plan | --apply [--add-only]; creates buckets then copies
  09-verify-storage.mjs               # --check buckets|policies|objects|hashes|urls|tenants|all
  10-storage-auth-tests.mjs           # scratch full / portfolio smoke
  11-codemod-buckets.mjs / .test.mjs  # --apply | --check
supabase/portfolio-migrations/<ts>_portfolio_ziko_storage_policies.sql
```
Script numbers are discretionary; the existing series ends at `06-verify-data.mjs`. Keep `.test.mjs` alongside (repo convention).

### Pattern 1: Policy generation from live pg_policies
Query `policyname, cmd, roles, permissive, qual, with_check` for `schemaname='storage' AND tablename='objects'` on ziko, then rewrite with pure functions in `lib-storage.mjs`:
- bucket literals: replace `'<id>'` (deparsed as `'<id>'::text`) with `'ziko-<id>'` using the live bucket id list as the alternation (never a hardcoded list);
- function: `is_coach_of(` becomes `public.ziko_is_coach_of(` (drive from `rename-map.generated.json` `functions` keys so the rename map stays the source of truth);
- name: `ziko_` + original name (all 25 are unique; resulting names such as `ziko_avatar_upload` do not collide with portfolio's 17);
- emit `DROP POLICY IF EXISTS "<n>" ON storage.objects; CREATE POLICY "<n>" ON storage.objects AS PERMISSIVE FOR <cmd> TO <roles> USING (...) WITH CHECK (...)`, preserving which of USING / WITH CHECK exists per command (INSERT has only WITH CHECK, SELECT/DELETE only USING, UPDATE/ALL both as present in live data).
Idempotent file, header comment states it is generated.
**Stale-reference check** (reuse the Phase 2 approach): on target, every policy named `ziko\_%` on `storage.objects` must have qual/with_check free of any `bucket_id = '<bare id>'` and free of `\mis_coach_of\(`; count must equal the live ziko count (25); portfolio's original 17 names must be unchanged.
Privilege: policies on `storage.objects` are created by the `postgres` role in Supabase and the repo's own migrations do this; whether the `cli_login_postgres` role used by `supabase db query` can do so on portfolio is not probed here [ASSUMED]. Probe on scratch first (apply policies there before anything else), exactly as Phase 2 did for schema.

### Pattern 2: Copy loop (idempotent, add-only capable)
1. Resolve keys in memory with `getProjectApiKeys(ref)` (Phase 3 already proved it: masked `sb_secret_*` are skipped and the legacy `service_role` JWT is used) [VERIFIED: lib.mjs]. This satisfies D-06's intent (no keys in git) without writing a key file; allow an env override. Never log keys; reuse `redactSecrets`.
2. Guard: source must equal `PROJECTS.ziko` and is read-only; target `!== ziko`, `assertWriteAllowed({projectRef, confirmRef})` for portfolio; destination bucket id must match `/^ziko-[a-z0-9-]+$/`. The script must contain no `remove(`/`DELETE` call (add a static unit test that greps the script source, like the guarded-write tests in Phase 4).
3. Buckets: read `storage.buckets` from ziko, `getBucket` on target; `createBucket(id, {public, fileSizeLimit, allowedMimeTypes})` or `updateBucket` to converge. Create with restrictions before copy so the 2 MB/25 MB/mime limits are enforced during the copy (all live objects satisfy them: exercise-media max 232 KB; ai-imports total 27.2 MB over 9 objects, each below 25 MB assumed, confirm at plan time).
4. Objects: enumerate via SQL ordered by `bucket_id, name`; compute dest key; if first path segment equals source UUID, replace with target UUID (first segment only; also assert no other segment contains the source UUID, else fail loudly).
5. `download(path)` -> `Buffer` -> `sha256`. Skip when dest `storage.objects` row exists with equal size and the re-downloaded dest hash equals (cheap at 205 MB). Do not rely on ETag equality across projects [ASSUMED different].
6. `upload(destKey, body, { contentType: metadata.mimetype, cacheControl, upsert: true })`; retry with backoff on 429/5xx; concurrency 4-6.
7. `--add-only` (D-07): same code path, never removes; after the pass, list destination-only keys in `ziko-*` buckets (key counts and masked names only) for human review.
8. Run report: per-bucket counts/bytes/skip/copy/rekeyed, no raw ids or filenames; per-object detail goes only to a gitignored `.tmp-*` file (`.gitignore` already ignores `scripts/portfolio-migration/.tmp-*`).

### Pattern 3: Loader URL-rewrite hook (D-05)
Add `createUrlRewriteTransform({ sourceRef, targetRef, buckets })` to `lib-data.mjs`, line-buffered and `StringDecoder`-safe exactly like `createRemapTransform` (the existing transform is the template), and compose it in `loadTable`: `src.copyTo -> remapTransform -> urlRewriteTransform -> dst.copyFrom`. Requirements:
- Rewrite only `https://<ziko ref>.supabase.co/storage/v1/(object/(public|sign|authenticated)|render/image/(public|sign))/<bucket>/` to `https://<targetRef>.supabase.co/.../ziko-<bucket>/` (host follows `--project-ref` so the scratch rehearsal rewrites to the scratch host, portfolio to the portfolio host). Bucket alternation comes from the live bucket list (or a map file), not a literal.
- Must preserve line count (rows stat is asserted `source = streamed = target`). Single-line regex replace per line does.
- COPY text format escapes backslashes but `/` and `.` pass through unchanged, so a plain regex is safe; jsonb text output does not escape `/`.
- Count replacements per table in `stats` and include in the PII-safe load report (table names and counts only).
- Pure unit tests with chunk-boundary splits (copy the style in `lib-data.test.mjs`).
Verify check `urls`: on target run, per `ziko_*` table, `count(*) WHERE t::text ~ '<ziko ref>|storage/v1/object/(public|sign|authenticated)/(?!ziko-)'` and require 0 everywhere (same `r::text` technique used by `buildUuidOccurrenceSql`). Also assert that source-side match count equals target-side `ziko-` match count per table.

### Pattern 4: Bucket codemod (D-04)
Rename-map-driven (`{old: 'ziko-'+old}` from live bucket ids), applied only in recognised contexts so false positives are avoided:
1. `.from('<bucket>')` including multi-line `.from(\n 'x'\n)` form;
2. arrays/consts: `ALLOWED_BUCKETS = [...]` (backend `routes/storage.ts`, web `api/storage/upload-url/route.ts`), `COACH_PHOTO_BUCKET`, `EXERCISE_MEDIA_BUCKET`, `cleanupBucket('<b>', ...)`;
3. query strings: `bucket=<b>&` in `ExerciseMediaUpload.tsx`, `FileUploadRow.tsx`, `PhotoUpload.tsx`, `plugins/nutrition/.../LogMealScreen.tsx`;
4. `photoUrl.split('/profile-photos/')` in `apps/mobile/app/(app)/profile/index.tsx:252` (plus the URL-format comment). Without this, remove-on-delete silently stops working because the stored URL now contains `/ziko-profile-photos/`. Note the pre-existing wrinkle: `split('/profile-photos/')` on a `ziko-profile-photos` URL would also not match, so this edit is mandatory.
5. test files with bucket literals (e.g. `backend/api/test/coach/imports.spec.ts` signed-URL strings, `scripts/exercise-import/lib/merge-row.test.ts` asserting `'exercise-media'`).
Known false positives to exclude (verified by grep): `plugins/coach/src/screens/VideoListScreen.tsx` react-query key `['coach-videos', ...]`; `scripts/purge-test-accounts/*` (`'exports'` is a local output directory, not a bucket; D-04's mention of this directory is a false positive); `supabase/migrations/*` (historical, never edited); package.json names.
Surface at research time (live grep, ~28 files): mobile (`profile/index.tsx`, `profile/edit.tsx`, `profile/avatar.tsx`, `workout/exercise/[exerciseId].tsx`, `ExercisePicker.tsx`), plugins (`coach/CoachScreen.tsx`, `nutrition/LogMealScreen.tsx`), backend (`routes/storage.ts`, `routes/ai.ts:379`, `coach/exercises/db.ts` x6, `coach/videos/service.ts` x4, `coach/clients/db.ts`, `coach/imports/service.ts` x2), web (`api/storage/upload-url/route.ts`, `api/photo/route.ts`, `BrandingPreviewCard`, `ExerciseRow`, `LogoUpload`, `PhotoUpload`, `FileUploadRow`, `ExerciseMediaUpload`), `scripts/exercise-import/{lib/merge-row.ts,merge.ts doc comment}`. The `--check` mode must be the source of truth for the final count, since the CONTEXT "57 literals/26 files" is an estimate.
Central constant: package boundaries differ (backend and web use `@ziko/coach-sdk`, mobile and plugins use `@ziko/plugin-sdk`). Recommend one tiny module per deployable (`backend/api/src/config/buckets.ts`, `apps/web/src/lib/buckets.ts`, `packages/plugin-sdk/src/buckets.ts` for mobile+plugins) generated by the codemod from the same rename map; do not touch the published coach-sdk. Backend relative imports need `.js` extensions (CLAUDE.md). Backend `ALLOWED_BUCKETS` is user-facing: decide whether to also accept legacy names (see Open Question 2).

### Anti-Patterns to Avoid
- Merging the codemod to `main` before Phase 6: `main` auto-deploys API + web (CLAUDE.md CI section) while env still points at ziko, which would break uploads/reads. Keep it on an unmerged branch/patch.
- Using `list()` for enumeration or `Blob`-in-memory for large future objects: fine at this size but pagination (limit 100 default, offset) and non-recursion are traps.
- Hashing only the source and trusting upload success. D-09 requires re-downloading the destination and comparing.
- Putting the service-role key in `backend/api/src/**` or in any report/log.
- Running portfolio-targeted tests with service-role then calling it "authenticated" (Pitfall 3 in PITFALLS.md).
- Fixing the `profile-photos` quirk (D-02).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Project API keys | key-file parsing | `getProjectApiKeys` in `scripts/auth-merge/lib.mjs` | Handles masked `sb_secret_*` vs legacy JWT already |
| SQL transport | direct pg for reads | `runSql(ref, sql)` | PAT-free, redacts PII; already used by every verify suite |
| CLI/arg guards, masks | new arg parser / UUID masker | `parseCliArgs`, `assertWriteAllowed`, `assertReportSafe`, `maskUuid` | Same behaviour as Phases 3-4, same tests |
| COPY line transform | ad-hoc string replace on chunks | pattern of `createRemapTransform` (line buffering + StringDecoder) | Chunk-boundary bugs already solved |
| Remap target | hardcoded UUID | `parseRemapFile` | Validates refs and the known collision id |
| Throwaway users | raw SQL insert into auth.users | Admin API `createUser` + `signInWithPassword` (see `backend/api/test/rls/fixtures.ts` `createTestUser`/`cleanupTestUsers` pattern) | GoTrue needs correct token columns/instance_id (Phase 3 lessons) |

## Runtime State Inventory

Phase 5 is a rename-and-relocate for storage.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | 2,699 objects in 10 buckets; 3 DB rows with full URLs (`user_profiles` x2, `body_measurements` x1); DB path columns (exercise gif/image, coach logo/photo/video/audio, avatar/profile photo) hold relative paths without bucket names | Object copy with re-key; URL rewrite in loader (data migration via reload, not code edit); relative paths need no change |
| Live service config | Portfolio `storage.objects` policies (17 existing, add 25 `ziko_*`); bucket settings live in `storage.buckets`; Vercel cron `/storage/cron/cleanup` references `scan-photos`/`exports` only in code | Policies migration; cron bucket names change via codemod (`cleanupBucket`) |
| OS-registered state | None found in repo for storage (no scheduled tasks reference buckets) | None. Not machine-verified beyond repo grep |
| Secrets / env vars | Backend `SUPABASE_SERVICE_KEY` (falls back to publishable key), web service role; names unchanged, values flip in Phase 6. Phase 5 needs ziko + target service keys in memory only | None in repo; retire PAT/keys at phase end (D-08). `scripts/auth-merge/.access-token` is absent now [VERIFIED: ls] so the loader re-run needs a human-supplied PAT |
| Build artifacts / installed packages | Mobile binaries in stores hardcode bucket literals and the ziko Supabase env; web `.next` build output; `packages/coach-sdk/dist` is tracked and currently modified in git status (not storage related) | Binary tail handled in Phase 6/7; codemod must not touch `dist/` or `.next/` |

## Common Pitfalls

### Pitfall 1: Codemod is not inert on main
**What goes wrong:** Merging literal renames deploys code that targets `ziko-*` buckets on the ziko project. **How to avoid:** keep the codemod as a script plus an unmerged branch/patch; Phase 6 applies and merges together with the env flip. Test it in a throwaway worktree with env pointed at scratch. **Warning sign:** a PR touching `storage.from(` literals targeting `main`.

### Pitfall 2: Portfolio's loaded rows are stale until the loader is re-run
**What goes wrong:** The hook only affects future loads; the 3 URL rows already on portfolio keep the ziko host. **How to avoid:** after the hook lands and is unit-tested, rehearse the loader on scratch, then re-run `05-load-data.mjs --apply` on portfolio (guarded TRUNCATE of 99 `ziko_*` tables + COPY, needs `--confirm-ref` and a typed-phrase checkpoint, plus a PAT). Do this before creating throwaway test users on portfolio (their trigger-created profile/credit rows would be truncated, or must be cleaned first). **Note:** the loader's truncate guard refuses non-`ziko_` referrers; test users in other tenants' tables are not a concern.

### Pitfall 3: Re-key must match DB rows
Collision user objects must land under `<target uuid>/`; DB rows already have the target UUID. If re-key is skipped, RLS (`foldername[1] = auth.uid()`) locks that user out of 36 files and rows point to missing objects. Verify check: for every row-path column referencing the target UUID, the object exists (spot-free: derive list from `ziko_*` path columns discovered at run time, or at minimum assert 36/36 re-keyed objects exist and hash-match).

### Pitfall 4: Cache-Control fidelity
`storage-js` writes `cache-control: max-age=<cacheControl>` (non-FormData path) or posts the value as a form field (Blob path) [VERIFIED: StorageFileApi.ts lines ~98-114]. There is no way to emit the literal `no-cache` via that option. 31 live objects have `no-cache`, 2,668 have `max-age=3600`. Likely the `no-cache` rows came from the signed-upload/default path [ASSUMED]. **How to avoid:** probe on scratch (upload one object with each strategy and read `storage.objects.metadata->>'cacheControl'`); if exact copy is only possible via raw HTTP `POST /storage/v1/object/<bucket>/<path>` with a `cache-control: no-cache` header, use that for the `no-cache` objects, otherwise accept and record the deviation. Make cache-control a warning-level verify item, never a gate; content-type, size, and SHA-256 are the gates. Also note `created_at` resets on copy, which restarts the 90-day `scan-photos` cleanup clock for 13 objects (harmless; note it in the report).

### Pitfall 5: Mime/size limits reject the copy
Creating buckets with `allowed_mime_types` first means an object stored with a mimetype outside the list fails to upload. Check `metadata.mimetype` of all objects against the bucket list in `--plan` mode before `--apply`, and fail with the bucket and counts only.

### Pitfall 6: Global storage file-size limit on portfolio
Bucket limits cannot exceed the project global limit (Free 50 MB, Pro 500 GB per docs) [CITED: supabase.com/docs/guides/storage/uploads/file-limits]. Portfolio's plan/global limit is not verified (STATE blocker note). Needed value is only >= 25 MB for `ai-imports`. Check in `--plan` (Management API storage config or a test upload) [live portfolio global limit UNVERIFIED].

### Pitfall 7: Private-bucket quirk misread as a regression
`profile-photos` has a `public`-role SELECT policy on a private bucket, so authenticated reads work; `getPublicUrl` links (`/object/public/`) return an error for private buckets. The test suite must assert and log this as the known baseline (identical on ziko), not fail on it (D-02). Also there is no DELETE policy on profile-photos, so mobile `remove()` returns no error but deletes nothing; assert as baseline.

### Pitfall 8: Backend signed-URL paths bypass RLS
`backend/api/src/routes/storage.ts`, `coach/videos`, `coach/exercises`, `coach/clients`, `coach/imports` use `SUPABASE_SERVICE_KEY ?? SUPABASE_PUBLISHABLE_KEY`; they never exercise policies. Only user-session clients exercise RLS: web `api/photo` (`createServerSupabase` then `createSignedUrl` on `coach-kyc`), web `api/storage/upload-url` (user client `createSignedUploadUrl`), and mobile direct `supabase.storage` calls (avatars, profile-photos, coach-logos reads). The matrix below tests both layers.

### Pitfall 9: Test-user side effects on portfolio
Creating an auth user with ziko metadata fires the gated `ziko_handle_new_user*` triggers (writes `ziko_user_profiles`/credits rows), and the portfolio tenant baseline (`scripts/portfolio-migration/baseline/portfolio-tenants-preload.json`) would drift if left behind. Clean up users (Admin `deleteUser`, cascade) and objects (service-role remove limited to the throwaway users' folders, in the test script only, never in the copy script) in `finally`, then re-run `06-verify-data.mjs --check tenants`.

## Code Examples

### Idempotent bucket convergence
```js
// Source: storage-js StorageBucketApi (createBucket/updateBucket accept public, fileSizeLimit, allowedMimeTypes)
const { error } = await dst.storage.createBucket(id, { public, fileSizeLimit, allowedMimeTypes });
if (error && /already exists/i.test(error.message)) {
  await dst.storage.updateBucket(id, { public, fileSizeLimit, allowedMimeTypes });
}
```

### Hash-verified copy of one object
```js
// Source: pattern per D-06/D-09; sizes <= 4.6 MB so Buffer is fine
const { data: blob } = await src.storage.from(b).download(key);
const buf = Buffer.from(await blob.arrayBuffer());
const sha = createHash('sha256').update(buf).digest('hex');
const destKey = rekey(key, remap);
await dst.storage.from(`ziko-${b}`).upload(destKey, buf, { contentType, cacheControl: '3600', upsert: true });
const { data: back } = await dst.storage.from(`ziko-${b}`).download(destKey);
assert.equal(createHash('sha256').update(Buffer.from(await back.arrayBuffer())).digest('hex'), sha);
```

### User-JWT test client (not service role)
```js
const user = createClient(targetUrl, publishableKey, { auth: { persistSession: false } });
await user.auth.signInWithPassword({ email, password });
const { data } = await user.storage.from('ziko-scan-photos').createSignedUploadUrl(`${userId}/t.png`);
await user.storage.from('ziko-scan-photos').uploadToSignedUrl(data.path, data.token, bytes);
```
Cross-user denial: expect an error / empty result when requesting `${otherUserId}/...`.

## STORAGE-04 Test Matrix (scratch full; portfolio read-only smoke)

Roles: athlete A, athlete B (outsider), coach C linked to A through `ziko_coach_client_links` (insert via service role), coach D unlinked, anon.

| Bucket | Policy facts (from live) | Must pass | Must deny |
|--------|--------------------------|-----------|-----------|
| ziko-avatars (public) | insert/update/delete own folder; public read | A upload/update/delete own; anon fetch of `/object/public/` 200 | B writes A's folder |
| ziko-coach-logos (public) | ALL own folder; public read | C write own; anon read | D writes C's folder |
| ziko-exercise-media (public, 2 MB, png/gif) | no write policies; public read | anon read of a copied exercise gif; service-role upload ok | authenticated user upload (no policy); service-role upload >2 MB or `text/plain` rejected |
| ziko-profile-photos (private) | insert/update own, public-role select, no delete | A upload own; authenticated download/signed read | B writes A's folder; baseline: `getPublicUrl` URL not servable, `remove` deletes nothing (known D-02 quirk) |
| ziko-scan-photos | own insert/select/delete | A signed upload + read + delete; backend `/storage/upload-url` returns token | B read/write A's folder |
| ziko-coach-kyc | own insert/select/delete (no update) | C signed upload + signed read (web `api/photo` and `api/storage/upload-url` handlers) | D read C's; upsert-overwrite denied |
| ziko-coach-exercises | own insert/select/delete | C upload; backend coach exercises signed URL | D read |
| ziko-exports | select own only | A reads a service-uploaded object in own folder | B reads; A upload denied |
| ziko-ai-imports (private, 25 MB, doc mimes) | own insert/select/delete via public role | A signed upload of pdf; backend `/coach/imports` upload-url | wrong mime; B access |
| ziko-coach-videos (private, video mimes) | athlete insert/select own folder; coach read via `ziko_is_coach_of` | A upload; C read A's file while link active | D read; C read after link revoked (`revoked_at`) or expired; wrong mime |

Real code paths: call the Hono app in-process (`app.request(...)`, default export of `backend/api/src/app.ts`) from a process started with `SUPABASE_URL`/keys of the target (modules read env at import time, so use a child process or vitest with env set). Web route handlers rely on cookies (`createServerSupabase`); either start `next dev` against the target env with a session cookie, or assert the equivalent user-session Storage calls directly (same RLS) and list web handler HTTP checks for the Phase 6 smoke if running Next locally is impractical (UI/web flows are already deferred by D-10). Backend `authMiddleware` calls `auth.getUser(token)` on the target project, so test tokens must come from the same project.

## State of the Art

| Old Approach | Current Approach | Impact |
|--------------|------------------|--------|
| Storage `list()` recursion | SQL on `storage.objects` for inventories; `list()` is folder-level, default limit 100 [CITED: supabase.com/docs/reference/javascript/storage-from-list] | Use SQL; `listV2`/`with_delimiter` exist in storage-js types but are unnecessary here |
| `service_role` legacy JWT | `sb_secret_*` keys (CLI returns masked) | Existing `pickApiKeys` falls back to legacy JWT; works today |

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The CLI login role used by `runSql`/`supabase db query` can `CREATE POLICY ON storage.objects` on portfolio | Pattern 1 | Policy apply fails; fall back to Management API database query with the owner role or the SQL editor (human step). Probe on scratch first |
| A2 | `no-cache` metadata came from the signed/default upload path; raw `cache-control` header upload may preserve it | Pitfall 4 | Cache headers differ on 31 objects; low impact, report as warning |
| A3 | ETag is not comparable across projects | Pattern 2 | None (design does not rely on it) |
| A4 | coach-sdk consumers resolve a registry copy (`^0.1.0`) so adding a constant forces republish | Alternatives | If workspace-linked, a shared constant would be feasible; per-surface modules remain safe either way |
| A5 | Portfolio global storage file-size limit >= 25 MB | Pitfall 6 | `ai-imports` bucket create/upload fails; check via Management API before apply |
| A6 | Each `ai-imports` object is < 25 MB (total 27.2 MB over 9 objects) | Pattern 2 | Upload rejection; confirm via SQL max(size) in `--plan` |

## Open Questions

1. **Loader re-run on portfolio in Phase 5?**
   - Known: D-05 requires zero leftover URLs on portfolio; current portfolio rows are stale; D-05 forbids post-hoc UPDATE.
   - Recommendation: include a plan task that re-runs the loader (scratch rehearsal first, then typed-phrase checkpoint on portfolio, PAT provided by the user) and then runs `06-verify-data.mjs --check all` plus the new `urls` check. The alternative is deferring the zero-leftover assertion to Phase 6, which contradicts the Phase 5 success criterion.
2. **Backend legacy bucket-name aliasing.** The user-facing `ALLOWED_BUCKETS` list rejects unknown names. Old mobile binaries cannot reach portfolio auth anyway (ziko env baked in), so aliasing is probably unnecessary; recommend the new allowlist only, confirm with the user at the Phase 6 mobile-tail discussion.
3. **Codemod hosting:** branch vs patch artifact. Recommend `gsd/phase-5-bucket-codemod` unmerged, plus the script so Phase 6 can re-run `--apply` on a fresh `main`.
4. **Where to execute the typed-phrase checkpoint on scratch vs portfolio:** follow `04-06` format (user types their own message). The planner should include two separate checkpoints (policies+buckets+copy; loader re-run) or one combined with explicit scope.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node | all scripts | yes | 26.4.0 | - |
| Supabase CLI | `runSql`, `getProjectApiKeys` | yes (logged in; ziko linked) | 2.116.0 (2.119.0 available) | - |
| Scratch project | rehearsal | yes | ACTIVE_HEALTHY, PG 17.6 | - |
| Portfolio project | real run | yes | ACTIVE_HEALTHY, PG 17.6 | - |
| Management API PAT (`scripts/auth-merge/.access-token`) | loader re-run, `connectClient` | no (absent, retired in Phase 4) | - | Human supplies a fresh PAT; retire again afterwards |
| Service-role keys | copy/tests | yes via `getProjectApiKeys` (CLI login) | legacy JWT | - |
| Portfolio global storage limit | ai-imports | unverified | - | Check before apply (A5) |

**Missing dependencies with no fallback:** none blocking research; PAT is a human-provided step at execution.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | `node:test` (Node 26.4) for `scripts/portfolio-migration/*.test.mjs`; Vitest v3 for backend/web code touched by the codemod |
| Config file | none for scripts; `backend/api/vitest.config.ts`, `apps/web` vitest config |
| Quick run command | `node --test "scripts/portfolio-migration/lib-storage.test.mjs" "scripts/portfolio-migration/11-codemod-buckets.test.mjs"` (use glob/quoted form on Node 26 per STATE) |
| Full suite command | `node --test "scripts/portfolio-migration/*.test.mjs"` then `npx turbo run test type-check lint` (on the codemod branch) |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| STORAGE-01 | Bucket plan from live config; `ziko-` guard; converge create/update | unit + live `--check buckets` | `node --test scripts/portfolio-migration/lib-storage.test.mjs` ; `node scripts/portfolio-migration/09-verify-storage.mjs --project-ref <ref> --source-ref <ziko> --check buckets` | Wave 0 |
| STORAGE-02 | rekey (first segment only), skip logic, no-delete static guard, hash equality, count/bytes parity | unit + live | `node --test ...lib-storage.test.mjs`; `--check objects` and `--check hashes` | Wave 0 |
| STORAGE-02 (D-05) | URL rewrite transform incl. chunk boundaries, line preservation; zero leftovers | unit + live | `node --test scripts/portfolio-migration/lib-data.test.mjs`; `--check urls` | extend existing test file |
| STORAGE-03 | Policy rewrite (names, buckets, `ziko_is_coach_of`, roles, USING/WITH CHECK shape); stale-reference grep; 25 policies, portfolio's 17 unchanged | unit + live | `node --test ...lib-storage.test.mjs`; `--check policies` | Wave 0 |
| STORAGE-04 | Per-bucket matrix with real JWTs; baseline quirks asserted | integration (scratch full, portfolio smoke) | `node scripts/portfolio-migration/10-storage-auth-tests.mjs --project-ref <scratch> --mode full` | Wave 0 |
| D-04 | Codemod exactness, no false positives, `--check` residual scan zero | unit + repo grep | `node scripts/portfolio-migration/11-codemod-buckets.mjs --check` on the branch; `npx turbo run type-check test` | Wave 0 |

### Sampling Rate
- **Per task commit:** quick run command (pure libs, < 30 s)
- **Per wave merge:** full `node --test` glob; codemod branch also runs turbo type-check + test
- **Phase gate:** scratch `--check all` + auth matrix green, then portfolio `--check all` + smoke green and `06-verify-data.mjs --check tenants` unchanged, before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `scripts/portfolio-migration/lib-storage.mjs` + `lib-storage.test.mjs`
- [ ] `07-generate-storage-policies.mjs`, `08-copy-storage.mjs`, `09-verify-storage.mjs` (+ tests for arg resolution/guards modeled on `06-verify-data.test.mjs`)
- [ ] `10-storage-auth-tests.mjs`
- [ ] `11-codemod-buckets.mjs` + test over fixture snippets (multi-line `.from(`, query-string, split, false-positive cases)
- [ ] Extend `lib-data.test.mjs` for `createUrlRewriteTransform`; extend `05-load-data.mjs` pipeline and its test
- [ ] Storage tenant baseline (portfolio: 7 buckets, 2,125 objects, 17 policies) snapshot before the first portfolio write, checked after (`--check tenants`)
- [ ] Framework install: none

## Security Domain

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes (tests use real sessions) | Supabase Auth `signInWithPassword`, never service-role for access tests |
| V3 Session Management | limited | throwaway sessions only; tokens in memory |
| V4 Access Control | yes (core) | `storage.objects` RLS with `foldername[1] = auth.uid()` and `ziko_is_coach_of`; cross-user denial tests |
| V5 Input Validation | yes | bucket allowlists, `ziko-` target guard, path-prefix ownership checks in routes, identifier regexes |
| V6 Cryptography | yes | SHA-256 via `node:crypto`; no custom crypto |
| V8 Data Protection | yes | coach-kyc and ai-imports contain KYC/personal docs: PII-safe reports (masked ids, no filenames), per-object detail only in gitignored `.tmp-*`, keys never logged, PAT retired |

### Known Threat Patterns
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Bucket open or locked after copy (policies missing) | Information disclosure / DoS | Policies migration applied and verified before any object copy |
| Re-key mismatch leaks or locks user files | Tampering / DoS | First-segment-only rekey, existence+hash check for the 36 objects |
| Service-role key leaks via logs or git | Information disclosure | In-memory keys, `redactSecrets`, guarded `.gitignore`, key never in `backend/api/src/**` |
| Writing to ziko or deleting portfolio data | Tampering | `assertWriteAllowed`, `ziko-` target regex, static no-delete test, add-only delta |
| PII in reports (object names, UUIDs) | Information disclosure | `assertReportSafe` on every JSON output |

## Sources

### Primary (HIGH confidence)
- Live read-only queries on ziko, portfolio, scratch (buckets, objects, policies, ACLs, URL scan), 2026-10-02
- Repo: `scripts/portfolio-migration/{lib-conn,lib-data,lib-verify,05-load-data,06-verify-data}.mjs`, `scripts/auth-merge/lib.mjs`, `uuid-remap.json`, `03-UUID-REMAP-SPEC.md` section 8, `01-INVENTORY.md`, `RUNBOOK.md` 4.7
- `node_modules/@supabase/storage-js` 2.99.2 source (upload headers, list options, bucket options)
- https://supabase.com/docs/guides/storage/uploads/file-limits (global vs bucket limits)
- https://supabase.com/docs/reference/javascript/storage-from-list (list defaults, non-recursion)

### Secondary (MEDIUM)
- `research/PITFALLS.md` Pitfall 3, `research/ARCHITECTURE.md` (project prior research)

### Tertiary (LOW)
- Storage-server behaviour for cache-control round trip and role privileges on `storage.objects` (assumptions A1, A2)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - no new dependencies; all reused repo modules read directly
- Architecture: HIGH - follows Phase 3/4 patterns; live data verified
- Pitfalls: MEDIUM-HIGH - cache-control and policy-apply privilege need a scratch probe

**Research date:** 2026-10-02
**Valid until:** 2026-10-16 (live inventory can change as ziko keeps taking writes; re-run counts at plan and run time)
