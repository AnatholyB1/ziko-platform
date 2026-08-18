---
phase: 01-schema-storage-foundation
verified: 2026-08-15T00:00:00Z
status: passed
score: 12/12 must-haves verified
overrides_applied: 0
---

# Phase 1: Schema & Storage Foundation Verification Report

**Phase Goal:** The database and storage infrastructure the import pipeline writes to exists and is locked down before any data moves.
**Verified:** 2026-08-15
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | `public.exercises` has nullable `image` and `gif` TEXT columns, added via a dated migration | VERIFIED | Local file: `ALTER TABLE public.exercises ADD COLUMN IF NOT EXISTS image TEXT;` / `... gif TEXT;` present (grep count 1/1). Live: `GET $SUPABASE_URL/rest/v1/exercises?select=id,image,gif&limit=1` → HTTP 200 against production, columns queryable. Migration filename `20260814_exercise_media_schema.sql` uses the dated convention. |
| 2 | A public `exercise-media` Supabase Storage bucket exists, readable by anyone, with no client-facing write policy | VERIFIED | Live: `GET $SUPABASE_URL/storage/v1/bucket/exercise-media` → `{"public":true,"file_size_limit":2097152,"allowed_mime_types":["image/png","image/gif"]}`. Anon/publishable-key write attempt (`POST .../storage/v1/object/exercise-media/verify-test/thumb.png`) → HTTP 400/`403 Unauthorized "new row violates row-level security policy"` — confirms no client-facing write policy exists, only service-role bypass works. `grep -v '^--' | grep -c "bucket_id = 'exercise-media'"` = 0 (no policy statements in migration). |
| 3 | `exercise_import_log` table exists with a status enum (matched/inserted/skipped/needs_review) and fields to support Phase 3's resumable, human-reviewable merge | VERIFIED | Live: `GET .../exercise_import_log?select=id,source_id,exercise_id,status,error_message,processed_at&limit=1` → HTTP 200 (all fields queryable). CHECK constraint verified empirically: `POST` with `status:"bogus_status"` → HTTP 400, Postgres error `23514 "violates check constraint exercise_import_log_status_check"`. FK `exercise_id UUID REFERENCES public.exercises(id) ON DELETE SET NULL` present in migration. Anon-key SELECT returns `[]` (HTTP 200) — RLS enabled, zero policies, deny-by-default confirmed live, not just in the file. |
| 4 | The migration is actually applied to the linked production Supabase project, not just committed as a local file | VERIFIED (via alternate mechanism — see note) | All three live REST/Storage checks above independently confirm the schema/bucket exist in the actual production database (`$SUPABASE_URL` from `backend/api/.env.prod`), which is stronger evidence than CLI bookkeeping. **Note:** `npx supabase migration list --linked` shows `"local":"20260814","remote":""` — the CLI's migration-history bookkeeping does NOT show this migration as applied, because it was applied out-of-band via the Supabase dashboard SQL editor (Task 2's documented Rule-4 human-approved workaround, due to a pre-existing 30-version bookkeeping drift on the shared production project, unrelated to this migration's content). The *goal* (schema live in production) is achieved and directly verified; the *originally-planned mechanism* (`supabase db push --linked`) was not used. This is a known, documented, human-resolved deviation — not a gap. |
| 5 | D-01: Both `exercises.image` AND `exercises.gif` added as nullable TEXT in the same migration | VERIFIED | Both `ADD COLUMN IF NOT EXISTS` lines present in Section 1 of the single migration file. |
| 6 | D-02: `image`/`gif` store relative storage paths, never full URLs | VERIFIED | Columns are named `image`/`gif` (not `image_url`/`gif_url`), migration comment explicitly states "Relative storage paths (e.g. `{exercise_id}/thumb.png`), not full URLs". |
| 7 | D-03/D-04: bucket paths organized folder-per-`exercise_id` with fixed filenames `thumb.png`/`animation.gif` | VERIFIED (documented convention) | Convention documented in migration comments and `01-CONTEXT.md`; enforced by application-layer write code in Phase 3 (not yet built) — no DB-level constraint enforces filename convention, which is expected/correct for this phase (pure infra, no data movement yet). |
| 8 | D-05: bucket created `public:true`, zero `CREATE POLICY` statements | VERIFIED | Live bucket JSON confirms `"public":true`. `grep` confirms zero policy statements referencing the bucket in the migration. Empirical anon-write-denied test confirms no write policy exists live. |
| 9 | D-06: `exercise_import_log.status` CHECK constraint with the 4-value enum | VERIFIED | Live constraint violation test (`23514`) confirms the CHECK constraint is active in production with exactly this enum. |
| 10 | D-07: `exercise_import_log` has `source_id`, nullable `exercise_id`, nullable `error_message`, `processed_at` | VERIFIED | All fields present in migration DDL and confirmed queryable live via REST select. |
| 11 | D-08: dated migration filename convention | VERIFIED | File is `supabase/migrations/20260814_exercise_media_schema.sql`. |
| 12 | Migration committed to git | VERIFIED | `git log --oneline -- supabase/migrations/20260814_exercise_media_schema.sql` → commit `5440c44`; `git status --short` on the file is clean (no uncommitted changes). |

**Score:** 12/12 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `supabase/migrations/20260814_exercise_media_schema.sql` | exercises.image/gif columns + exercise-media bucket + exercise_import_log table DDL | VERIFIED | Exists, committed (`5440c44`), contains all three sections, all acceptance-criteria greps pass (11/11), applied live to production (independently confirmed via REST/Storage API, not just CLI bookkeeping). |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `exercise_import_log.exercise_id` | `public.exercises.id` | `FOREIGN KEY REFERENCES` | VERIFIED | `REFERENCES public.exercises(id) ON DELETE SET NULL` present in migration (grep confirms). |
| `supabase/migrations/20260814_exercise_media_schema.sql` | linked Supabase project (`slkobhavpwsubnsmuhya`) | `supabase db push --linked` | PARTIAL — goal achieved via alternate verified mechanism | The specific CLI push mechanism was never successfully executed (blocked by a pre-existing, unrelated 30-version migration-history bookkeeping drift on the shared production project). Confirmed via `npx supabase migration list --linked`: `20260814` shows `local` only, `remote:""`. Instead, the migration SQL was applied directly via the Supabase dashboard SQL editor (human-executed, Rule-4 documented deviation) and the resulting live schema state was independently verified via direct REST/Storage API calls against `$SUPABASE_URL` from `backend/api/.env.prod` (see Truths 1–4 above), which is the more authoritative check for "is this actually live in production" than CLI bookkeeping. The underlying goal — production has this schema — is verified true. |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| — | — | None found | — | `grep -iE "TBD\|FIXME\|XXX\|TODO\|HACK\|PLACEHOLDER"` on the migration file returned zero matches. |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| MEDIA-01 | 01-01-PLAN.md | Colonne `image` (chemin thumbnail) ajoutée à `public.exercises` via une migration datée | SATISFIED | Truth 1, 5, 6, 11 above — column live in production, dated migration. |
| MEDIA-02 | 01-01-PLAN.md | GIFs + thumbnails uploadés vers un nouveau bucket Supabase Storage public `exercise-media` — écriture service-role uniquement, aucune policy d'écriture client | SATISFIED | Truth 2, 8 above — bucket live, public, empirically confirmed no client-facing write path (anon key blocked with RLS violation). |

Both requirement IDs declared in `01-01-PLAN.md` frontmatter (`MEDIA-01`, `MEDIA-02`) match exactly the two IDs `REQUIREMENTS.md`'s traceability table maps to Phase 1 — no orphaned requirements for this phase. (Note: `REQUIREMENTS.md`'s traceability table still shows both as "Pending" status text — this is a document-bookkeeping field, not evidence of an implementation gap; it is not updated automatically by phase execution in this project's workflow.)

### Carry-Forward Concern (non-blocking for Phase 1, flagged for Phase 4)

**WR-01 from `01-REVIEW.md`, independently confirmed:** The new `exercises.gif` column (this migration) coexists with a pre-existing `exercises.gif_url` column (`supabase/migrations/004_exercises_extended.sql:13`), which is actively read/written by the coach custom-exercise feature:
- `backend/api/src/coach/exercises/db.ts:39` — function signature returns `{ video_url, photo_url, gif_url }`
- `apps/mobile/app/(app)/workout/[id].tsx:218` — `setMediaGifUrl(json.gif_url ?? null)`

This is confirmed accurate: two differently-named, differently-semantic columns (`gif` = relative storage path for image-exo library import; `gif_url` = full/signed URL for coach custom-exercise uploads) now exist on the same table for conceptually similar data. Phase 1's own success criteria only require the `image`/`gif` columns to exist and be correctly configured — which they are — so this is **not a Phase 1 blocker**. It is carried forward as a design input for Phase 4 (mobile rendering, MOBILE-01/02), which will need an explicit precedence/selection rule between `gif` and `gif_url` depending on whether an exercise is library (`is_custom=false`) or custom (`is_custom=true`).

### Standing Concern (non-blocking, tracked in SUMMARY)

The production Supabase project's migration-history bookkeeping (`supabase_migrations.schema_migrations`) has a pre-existing 30-version drift unrelated to this migration's content, confirmed still present (`npx supabase migration list --linked` run during this verification shows the same pattern the SUMMARY documented: many `local`-only and `remote`-only entries, including `20260814` itself showing `remote:""`). This will block any future `supabase db push --linked` from this branch until reconciled (Options A/B in the SUMMARY's deviation note). Does not affect Phase 1's goal achievement since production schema state was independently verified live.

### Human Verification Required

None. All must-haves for this phase are infrastructure-only (schema/storage DDL) and were verified programmatically against both the local file and the live production API — no UI, UX, or subjective behavior to assess.

### Gaps Summary

No gaps. All 12 derived must-haves (4 roadmap-level truths + 8 CONTEXT.md decisions D-01–D-08) are verified both in the committed migration file and independently in live production via direct REST/Storage API inspection (not merely trusting SUMMARY.md's claims or CLI migration-history bookkeeping, which is known to be unreliable here due to the documented bookkeeping drift). The one deviation from the plan (migration applied via Supabase dashboard SQL editor instead of `supabase db push --linked`) was a human-approved Rule-4 stop, is fully documented in SUMMARY.md, and does not compromise the actual production outcome — verified independently in this report via fresh curl calls, not by re-reading the SUMMARY's claims.

---

_Verified: 2026-08-15_
_Verifier: Claude (gsd-verifier)_
