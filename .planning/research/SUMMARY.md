# Project Research Summary

**Project:** Ziko Platform — v1.16 Exercise Library Import (`image-exo`)
**Domain:** One-off bulk third-party dataset (data + licensed media) import/merge into an existing FK-referenced production table
**Researched:** 2026-08-14
**Confidence:** HIGH

## Executive Summary

This is not a new product capability — it's a data-migration problem with an unusually sharp blast radius: replacing/enriching `public.exercises` (currently ~1318 rows seeded from a Kaggle dataset with broken `v2.exercisedb.io` media links) with the richer `hasaneyldrm/exercises-dataset` (1,324 exercises, real GIF + 180×180 thumbnail media, structured muscle/equipment taxonomy, step-by-step instructions). The table is already FK-referenced by real `program_exercises` and `session_sets` rows with no `ON DELETE` clause, `exercises.name` has no uniqueness constraint (confirmed duplicates already exist), and the media carries a hard legal constraint: Gym visual's license caps distributed resolution at 180×180px and requires attribution on every display surface, non-negotiable for an App-Store-shipped product.

The recommended approach across all four research streams converges on one shape: a local/CI Node script (never a Hono API route — the 17MB dataset JSON alone triples this project's own documented 4.5MB Vercel payload limit), structured as three separable phases — fetch (git clone/tarball, zero new dependencies), match (pure, side-effect-free, produces a dry-run report), and merge (human-reviewed report only, upsert-by-name via `@supabase/supabase-js`, resumable via a new `exercise_import_log` table). Media goes into a new public, service-role-write-only Storage bucket (`exercise-media`), consumed directly via public URL — no signed-URL machinery needed since this is global reference data, not per-user content.

The two risks that dominate every research file are (1) match-quality — false negatives create duplicate exercises with orphaned history, false positives silently overwrite a real user's logged workout data with a different exercise's semantics — and (2) license compliance — missing attribution or upscaled media is a permanent, non-hotfixable App Store violation once shipped. Both are mitigated architecturally, not just procedurally: a 3-tier precision-first matcher with a mandatory human review gate before any write, a pre-UPDATE backup table for revertibility, and a shared `<AttributedMedia>` component in `packages/ui/` that structurally prevents a screen from rendering the media without the attribution badge and the 180×180 cap.

## Key Findings

### Recommended Stack

Zero new production dependencies. `git clone --depth 1` (not GitHub's REST/raw-content APIs, which are rate-limited and were tightened in 2025) fetches the 17MB JSON + ~2600 media files in one shallow clone. `@supabase/supabase-js` (already a root dependency, `^2.99.2`) handles both the Postgres upsert and Storage bulk upload — same client already used in `backend/api/src/routes/storage.ts` and `scripts/food-data/import-foods.mjs`. No ORM, no queue, no `p-limit` (its current major requires Node ≥20, stricter than this repo's `>=18.0.0` floor) — hand-rolled `Promise.allSettled` batching of ~15-20 concurrent calls, precedented in the existing `cleanupBucket` code.

**Core technologies:**
- `git clone --depth 1` (child_process): dataset fetch — avoids GitHub rate limits entirely via git's smart-HTTP transport, no new dependency
- `@supabase/supabase-js` (existing): Postgres upsert (match-by-name UPDATE/INSERT) + Storage bulk upload — matches existing repo patterns exactly
- New public Storage bucket (`exercise-media`): serves media via `getPublicUrl()`, avoiding the signed-URL machinery built for private per-user buckets
- Dated migration filename convention (`YYYYMMDD_description.sql`): matches what the repo's most recent migrations actually use, not the older `NNN_` convention

### Expected Features

**Must have (table stakes / v1):**
- Idempotent match-by-name upsert import (data + media) preserving `program_exercises`/`session_sets` FKs, excluding `is_custom` coach exercises
- Real GIF + thumbnail rendering in the exercise detail screen, replacing the current fake video placeholder (which shows a false `Démo · 0:42` / `HD` badge with no real video asset behind it)
- Mandatory, co-located attribution (`© Gym visual`) on every media display surface — a global legal page alone is explicitly non-compliant per the license's "must accompany every use" wording
- `instruction_steps` array wired into the existing numbered-steps UI, replacing a fragile `JSON.parse`/`.split('\n')` fallback chain
- FR/EN bilingual name + instructions, matching the existing `name_fr` i18n convention

**Should have (competitive, v1.x):**
- Data-driven filter chips (replace hardcoded `FILTER_CHIPS` array) with FR label mapping, once taxonomy is populated
- Thumbnails in `ExercisePicker` list rows with tap-to-animate GIF (not autoplay, to avoid scroll jank at 200+ rows)

**Defer (v2+):**
- Automated/admin-triggered resync workflow — a manually re-run idempotent script is sufficient; no product surface needed yet
- Additional dataset languages beyond FR/EN — no current user demand
- Upscaling media above 180×180 — explicitly forbidden by license, not just deferred

### Architecture Approach

Three-phase local/CI script (`scripts/import-exercises/{fetch,match,merge}.ts`), never a Hono route — sibling to the repo's existing `scripts/csv-to-seed.js`/`json-to-seed.js` precedent, not part of the deployed API surface. Schema changes land first (new `image` column, `exercise_import_log` table, `exercise-media` bucket + public-read policy), then the download+merge script runs against a direct (non-pooled) Postgres connection, then mobile consumption code (`ExercisePicker.tsx`, `[exerciseId].tsx`) is updated last, only once real URLs exist in production.

**Major components:**
1. `fetch.ts` — pure download/extract, no Supabase calls, verifies file count against manifest
2. `match.ts` — pure computation, dry-run report only (matched/unmatched-legacy/unmatched-new/ambiguous), never writes to Supabase
3. `merge.ts` — consumes the *human-reviewed* report only; uploads media, UPDATEs matched rows in place, INSERTs unmatched-new rows, logs every row to `exercise_import_log` for resumability
4. `exercise-media` bucket — public, service-role-write-only, no per-user prefix (unlike the app's other 6 private buckets)
5. Mobile consumption layer — versioned TanStack Query key (`['exercises', 'v2']`) to force cache invalidation, plus a shared `<AttributedMedia>` component enforcing the 180×180 cap and attribution badge structurally

### Critical Pitfalls

1. **False-negative name matching creates duplicate rows with orphaned history** — avoid via a 3-tier match pipeline (exact normalized → fuzzy + independent-field agreement → human-reviewed unmatched bucket), never auto-inserting unmatched rows.
2. **False-positive name matching silently overwrites real user history** — the inverse, more damaging failure; avoid by requiring agreement across ≥2 independent fields before an automatic match, and snapshotting every row to a backup table immediately before UPDATE.
3. **Non-idempotent script corrupts state on partial run/re-run** — a killed process (rate limit, network drop, timeout) leaves the table half-migrated with no resume record; avoid via separable fetch/merge phases, a durable `exercise_import_log`, and per-row (not one giant) transactions.
4. **17MB JSON collides with this project's own documented Vercel 4.5MB payload limit** — this must run as a local/CI script, never a Hono API route; GitHub's Contents API additionally inflates payloads ~33% via base64 and must be avoided in favor of tarball/raw fetch.
5. **Missing attribution or media upscaling breaches the Gym visual license in a shipped App Store binary** — non-hotfixable once live; avoid via a structural shared component (not a prop developers can forget) and explicit human/legal sign-off before phase completion.

(A sixth pitfall — stale mobile image/query cache showing broken or mixed old/new URLs post-migration — is addressed via content-versioned Storage paths and a bumped TanStack Query key; see PITFALLS.md Pitfall 6.)

## Implications for Roadmap

Based on research, suggested phase structure:

### Phase 1: Schema & Storage Foundation
**Rationale:** Nothing downstream can run until the `image` column, `exercise_import_log` table, and `exercise-media` bucket exist — all four research files agree schema must land first (Architecture "Build Order" is explicit on this).
**Delivers:** `20260814_exercises_image_column.sql`, `20260814_exercise_import_log.sql`, public `exercise-media` bucket + read-only RLS policy (no client write policy — service-role only).
**Uses:** Dated migration naming convention (matches current repo practice); public-bucket pattern (Architecture Pattern 2), distinct from the app's existing per-user private-bucket pattern.
**Avoids:** Anti-Pattern 2 (copy-pasting per-user-prefix RLS onto global reference data).

### Phase 2: Download & Match (dry-run only, no writes)
**Rationale:** Match quality is the highest-risk part of this milestone (Pitfalls 1 & 2) and must be inspectable before any production write happens — Architecture explicitly separates this into its own side-effect-free step.
**Delivers:** `fetch.ts` (git clone, verified against manifest) + `match.ts` (3-tier precision-first matcher) producing a `.staging/match-report.json` and a human-readable summary (`review-report.ts`) for manual review.
**Addresses:** FEATURES.md's "idempotent match-by-name import" requirement; the explicit `is_custom`/`coach_exercises` exclusion.
**Avoids:** Pitfall 1 (false-negative duplicates) and Pitfall 2 (false-positive history corruption) via the mandatory human review gate.

### Phase 3: Merge (resumable write, human-approved report only)
**Rationale:** Only runs after Phase 2's report is reviewed and approved; depends on Phase 1's schema and Phase 2's report artifact.
**Delivers:** `merge.ts` — per-row/small-batch transactions, pre-UPDATE backup snapshot (`exercises_merge_backup`), Storage upload with `upsert: true`, `exercise_import_log` write per row for resumability.
**Uses:** Direct (non-pooled) Postgres connection, bounded concurrency (10-20) for Storage uploads, same `Promise.allSettled` pattern as existing `storage.ts`.
**Avoids:** Pitfall 3 (non-idempotent script) and Anti-Pattern 3 (one giant transaction).

### Phase 4: Mobile Consumption & Attribution
**Rationale:** Only makes sense once Phase 3 has populated real URLs in production — shipping this earlier would show blank/placeholder states for every exercise, which is safe but pointless.
**Delivers:** Real GIF/thumbnail rendering in `[exerciseId].tsx` (replacing the fake video placeholder) and `ExercisePicker.tsx`, a shared `<AttributedMedia>` component in `packages/ui/` enforcing the 180×180 cap and co-located attribution badge, `instruction_steps` wiring into the existing numbered-steps UI, bumped TanStack Query key (`['exercises', 'v2']`).
**Addresses:** FEATURES.md P1 items (real media rendering, mandatory attribution, structured instructions).
**Avoids:** Pitfall 5 (license compliance) via a structural component rather than a per-screen convention; Pitfall 6 (stale cache) via query-key versioning and content-hashed Storage paths.

### Phase Ordering Rationale

- Strict dependency chain confirmed by Architecture's "Build Order": schema → data/media → mobile. Each phase's inputs are the prior phase's committed outputs, not parallelizable in a meaningful way despite mobile code being technically writable earlier.
- Splitting "download" from "match" from "merge" (rather than one script) directly operationalizes the two highest-severity pitfalls (1, 2, 3) as phase boundaries with an explicit human gate between Phase 2 and Phase 3 — this is a deliberate risk-reduction structure, not arbitrary task-splitting.
- Attribution/resolution-cap enforcement is deferred to Phase 4 only in terms of *rendering*; the underlying legal requirement (never store/serve media above 180×180) must be respected as early as Phase 3's Storage upload step (no upscaling during upload either).

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 2 (Match):** the exact field names in the dataset's `exercises.schema.json` were not independently verified (PITFALLS.md notes MEDIUM confidence here, page-rendering-derived not raw-file-diff-derived) — verify field names directly before writing the matcher.
- **Phase 4 (Mobile Consumption):** exact visual treatment of the attribution badge (font size, placement, color) was explicitly deferred to a UI-SPEC pass by FEATURES.md, not resolved in this research.

Phases with standard patterns (skip research-phase):
- **Phase 1 (Schema & Storage):** directly precedented by existing migrations (`025_storage_buckets.sql`) and the current dated-migration convention — no new pattern needed.
- **Phase 3 (Merge):** directly precedented by `backend/api/src/routes/storage.ts`'s existing `Promise.allSettled` chunking and `scripts/food-data/import-foods.mjs`'s bulk-import shape.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Verified GitHub rate-limit docs directly, `npm view` package versions confirmed locally, all recommended tools already present in the repo — no new-dependency risk |
| Features | MEDIUM-HIGH | Attribution requirement verified directly from source `NOTICE.md` (HIGH); UX conventions (per-surface vs. global attribution) inferred from a different license's precedent (Unsplash, MEDIUM) since no directly comparable Gym visual UI precedent exists |
| Architecture | HIGH | Every integration point grounded in files read directly from this codebase (migrations, existing bucket/RLS patterns, existing scripts/ precedent) — a wiring problem, not a technology-choice problem |
| Pitfalls | MEDIUM-HIGH | Production schema facts (FK constraints, no unique name constraint) verified directly from migrations (HIGH); dataset repo structure/field names derived from GitHub page rendering, not a raw schema-file diff (MEDIUM) — flagged explicitly for verification before implementation |

**Overall confidence:** HIGH

### Gaps to Address

- **Exact dataset field names** (`exercises.schema.json`): not verified against a raw file diff — verify during Phase 2 planning/implementation before the matcher is written, per PITFALLS.md's explicit recommendation.
- **Live production constraint check on `exercises.name`**: STACK.md notes the "no unique constraint" conclusion should be double-checked with `\d exercises` against the actual live table before writing the script, in case a later migration beyond what was read added one.
- **Legal sign-off on the 180×180 resolution-cap interpretation**: PITFALLS.md flags this as needing explicit confirmation from the project's legal/product owner — "distributed at 180×180 only" should be confirmed as meaning "never rendered above 180×180 in the shipped app" before Phase 4 is marked done, not assumed.
- **Attribution badge visual design**: FEATURES.md defers exact placement/styling to a UI-SPEC pass — needs a dedicated design step before or during Phase 4 planning.

## Sources

### Primary (HIGH confidence)
- [GitHub Docs — Rate limits for the REST API](https://docs.github.com/en/rest/using-the-rest-api/rate-limits-for-the-rest-api)
- [GitHub Changelog — Updated rate limits for unauthenticated requests (2025-05-08)](https://github.blog/changelog/2025-05-08-updated-rate-limits-for-unauthenticated-requests/)
- [hasaneyldrm/exercises-dataset — NOTICE.md](https://github.com/hasaneyldrm/exercises-dataset/blob/main/NOTICE.md) — direct source of attribution/resolution license terms
- Context7 `/supabase/supabase-js` — Storage `upload`/`update`/`getPublicUrl`/`createSignedUrl` API surface
- Direct repo reads: `supabase/migrations/001_initial_schema.sql`, `004_exercises_extended.sql`, `025_storage_buckets.sql`, `031_exercises_name_fr.sql`, `055_coach_exercises_schema.sql`, `20260527_coach_exercise_id_program_exercises.sql`, `supabase/seed_exercises.sql`, `backend/api/src/routes/storage.ts`, `scripts/food-data/import-foods.mjs`, `.planning/PROJECT.md`, `package.json`

### Secondary (MEDIUM confidence)
- [hasaneyldrm/exercises-dataset — repository](https://github.com/hasaneyldrm/exercises-dataset) — dataset shape, derived from rendered page, not raw schema diff
- [wger-project/wger — Administration Commands (`sync_exercises`)](https://wger.readthedocs.io/en/latest/administration/commands.html) — confirms "update matched, don't touch manual entries" as the domain-standard sync pattern
- [Unsplash API Attribution Examples](https://medium.com/@unsplash/unsplash-api-attribution-examples-a4f0a02b33d0) — validates per-surface attribution UX pattern, different license terms

### Tertiary (LOW confidence)
- [ExerciseDB.io FAQ](https://exercisedb.io/faq) — ecosystem context only, not authoritative for this project's actual license (different provider)
- [Gym visual Terms and Conditions](https://gymvisual.com/content/3-terms-and-conditions-of-use) — referenced by NOTICE.md but not independently fetched; verify directly before finalizing legal copy

---
*Research completed: 2026-08-14*
*Ready for roadmap: yes*
