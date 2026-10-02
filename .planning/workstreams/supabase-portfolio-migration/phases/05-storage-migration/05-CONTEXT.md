# Phase 5: Storage Migration - Context

**Gathered:** 2026-10-02
**Status:** Ready for planning

<domain>
## Phase Boundary

All 10 ziko storage buckets (live inventory, not the "9" in REQUIREMENTS.md — `coach-videos` is the 10th, empty) and their 2,699 objects (~205 MB) are recreated in `portfolio` as `ziko-<id>`, with storage RLS rebuilt and signed-URL flows proven under real authenticated sessions. Also delivered: the application-layer bucket-name codemod (inert until cutover) and in-flight rewrite of DB-stored storage URLs. Out of scope: flipping env/apps to portfolio and the actual write-freeze delta run (Phase 6), decommission (Phase 7), any functional change to buckets beyond rename-and-relocate.

</domain>

<decisions>
## Implementation Decisions

### Bucket config & policy fidelity
- **D-01:** Buckets are recreated as `ziko-<id>` with settings **read live from ziko `storage.buckets` at run time** (public flag, `file_size_limit`, `allowed_mime_types`) — exact copy, nothing hardcoded. Known live values on 2026-10-02: `exercise-media` public, 2 MB, png/gif; `ai-imports` private, 25 MB, pdf/xlsx/xls/docx; `coach-videos` private, mp4/quicktime/x-m4v; `avatars`, `coach-logos` public; rest private/no limits.
- **D-02:** The `profile-photos` quirk (private bucket, but mobile calls `getPublicUrl`) is **copied as-is** and logged as a known pre-existing issue — not fixed in this phase (rename-and-relocate scope).
- **D-03:** The 25 `storage.objects` policies are **generated from live `pg_policies`**, rewritten: bucket ids → `ziko-<id>`, `is_coach_of` → `ziko_is_coach_of`, and **policy names prefixed `ziko_`** to avoid collision with portfolio's 17 policies on the shared `storage.objects`. Shipped as a migration file in the portfolio series and checked by a stale-reference grep (same approach as Phase 2 SCHEMA-04). Policies are created before any object is copied.

### Code rename & stored URLs
- **D-04:** **Phase 5 builds the bucket-name codemod, Phase 6 merges/flips it.** Scripted, rename-map-driven, covering the ~57 literals across ~26 files (mobile, web, backend `storage.ts` ALLOWED_BUCKETS, coach services, plugins), preferably introducing a central bucket-name constant. Committed separately, behaviour-inert until the Phase 6 flip. Mobile binaries cannot be patched after release, so this must be exact.
- **D-05:** DB rows holding full storage URLs (host + bucket segment; 3 known rows in `user_profiles`/`body_measurements`, live scan may find more) are fixed **in-flight in the Phase 4 loader** (`scripts/portfolio-migration/lib-data.mjs` / `05-load-data.mjs` transform): rewrite ziko host → portfolio host and `/<bucket>/` → `/ziko-<bucket>/`. Phase 5 adds a live scan of all text/jsonb columns for old host/bucket patterns and a verify check asserting zero leftovers on portfolio. No after-the-fact UPDATE (a Phase 6 truncate-reload must stay consistent).

### Copy mechanism & delta
- **D-06:** Transport is a **Node `.mjs` script in `scripts/portfolio-migration/`** (next number in the series) using supabase-js Storage API with service-role keys from a gitignored file: list each ziko bucket → download → upload to `ziko-<bucket>` preserving content-type/cache-control, bounded concurrency, idempotent skip when size+hash already match. Collision-user objects under `<source uuid>/` are re-keyed to `<target uuid>/` (target read from `scripts/auth-merge/uuid-remap.json`, never hardcoded; spec §8). Service-role key use stays out of `backend/api/src/**`.
- **D-07:** Final delta (Phase 6, inside write-freeze) re-runs the same script **add-only**: copy new/changed objects, **never auto-delete** on portfolio; destination-only objects are reported for human review. Objects created after the rehearsal are covered by this.
- **D-08:** Rehearse on the Phase 2 scratch project first (full copy + verification + auth tests), then a human typed-phrase checkpoint (Phase 3/4 pattern), then the real portfolio copy. Retire any PAT/keys on every path.

### Verification & authenticated tests
- **D-09:** STORAGE-02 verification is **full, no sampling**: per-object SHA-256 (hash streamed source bytes, re-download from destination and compare), exact per-bucket object count and total bytes, re-keyed objects mapped through the remap. Re-runnable, `--check <name>`/`--check all` style, JSON + PII-safe masked summary (no raw user ids/emails in git-tracked files), modeled on `06-verify-data.mjs`.
- **D-10:** STORAGE-04: **scratch full rehearsal + portfolio smoke.** Scratch: scripted suite with throwaway athlete/coach/outsider users covering every bucket's upload, download and cross-user denial through real policies and the real code paths (backend `/storage/upload-url`, coach exercises/videos/clients signed URLs, web `api/storage/upload-url` and `api/photo`). Portfolio: after the real copy, a smaller read-only check with temporary test users cleaned up afterwards (Phase 3 D-07 pattern). Mobile/web UI-level flows deferred to the Phase 6 smoke test.

### Claude's Discretion
- Script numbering/module layout, concurrency tuning, retry policy, exact name of the central bucket constant, how throwaway users are created/cleaned, handling of the empty buckets (`coach-videos`, `exports`) in hash checks, `storage.objects` owner/metadata columns handling beyond what the Storage API sets.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Workstream scope
- `.planning/workstreams/supabase-portfolio-migration/ROADMAP.md` — Phase 5 goal and success criteria
- `.planning/workstreams/supabase-portfolio-migration/REQUIREMENTS.md` — STORAGE-01..04 (note: 10 buckets, not 9)
- `.planning/workstreams/supabase-portfolio-migration/STATE.md` — current position

### Inventory & prior decisions
- `.planning/workstreams/supabase-portfolio-migration/phases/01-inventory-pre-flight-audit/01-INVENTORY.md` — Storage Buckets / Storage RLS Policies sections for ziko (25 policies) and portfolio (7 buckets, 17 policies, zero name collisions)
- `.planning/workstreams/supabase-portfolio-migration/phases/03-auth-merge/03-UUID-REMAP-SPEC.md` §8 — collision-user storage folder re-key
- `.planning/workstreams/supabase-portfolio-migration/phases/03-auth-merge/03-CONTEXT.md` — D-02 portfolio UUID wins; D-07 test-signup cleanup pattern
- `.planning/workstreams/supabase-portfolio-migration/phases/04-data-copy-integrity-verification/04-CONTEXT.md` — loader/verification conventions, typed-phrase checkpoint, PII-safe output
- `.planning/workstreams/supabase-portfolio-migration/phases/02-schema-rename-function-rls-rewrite/02-CONTEXT.md` — ziko_ prefix rationale, stale-reference grep approach
- `scripts/portfolio-migration/RUNBOOK.md` §4.7 — open items: URL-bearing rows, `<uuid>/file` paths
- `scripts/portfolio-migration/rename-map.generated.json` — rename map (functions incl. `ziko_is_coach_of`)

### Research
- `.planning/workstreams/supabase-portfolio-migration/research/PITFALLS.md` Pitfall 3 — storage RLS/bucket rename pitfalls, signed-URL retest
- `.planning/workstreams/supabase-portfolio-migration/research/ARCHITECTURE.md` — bucket defensive prefixing, codemod build order

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `scripts/portfolio-migration/lib-conn.mjs`, `lib-data.mjs`, `lib-verify.mjs`, `05-load-data.mjs`, `06-verify-data.mjs`: connection handling, transform hook for URL rewrite, `--check` suite pattern, masked report sanitizer
- `scripts/auth-merge/uuid-remap.json`, `lib.mjs`: remap target source
- Existing storage migrations `supabase/migrations/017_avatars_storage.sql`, `025_storage_buckets.sql`, `037_coach_kyc_bucket.sql`, `20260521174343_ai_imports_bucket.sql`: reference only (live DB is source of truth)

### Established Patterns
- `.mjs` + `node:test`, `--check all`, JSON + masked summary, guarded writes refusing non-`ziko_`/`ziko-` targets, rehearse on scratch then typed-phrase checkpoint
- Backend relative imports need `.js` extension; service-role key never imported from `backend/api/src/**`

### Integration Points
- Bucket literals: `backend/api/src/routes/storage.ts` (ALLOWED_BUCKETS, cleanup cron on scan-photos/exports), `backend/api/src/coach/{exercises,videos,clients,imports}`, `apps/web/src/app/api/{storage/upload-url,photo}/route.ts`, `apps/web/src/components/coach/*`, `plugins/coach/src/screens/*`, `apps/mobile/app/(app)/profile/*`, `apps/mobile/app/(app)/workout/exercise/[exerciseId].tsx`, `apps/mobile/src/components/ExercisePicker.tsx`, `scripts/purge-test-accounts/*`
- Stored URL/path columns: `user_profiles`, `body_measurements` (full URLs), exercise `gif`/`image`, coach logo/photo/video/audio paths

</code_context>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches within the decisions above.

</specifics>

<deferred>
## Deferred Ideas

- Fixing the `profile-photos` private-bucket/`getPublicUrl` mismatch — functional fix, outside rename-and-relocate; candidate backlog item after the migration.
- Mirror/delete-extras sync for storage — rejected for user-data safety; revisit only if parity drift becomes an issue.
- Env-driven bucket prefix config — rejected for now (new mechanism, needs EXPO_PUBLIC var).
- Portfolio's own four ownership-less storage policies (album-*, portfolio-photos) — pre-existing, not a ziko item.

</deferred>

---

*Phase: 5-Storage Migration*
*Context gathered: 2026-10-02*
