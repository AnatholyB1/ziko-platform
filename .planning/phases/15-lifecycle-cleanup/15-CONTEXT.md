# Phase 15: Lifecycle & Cleanup — Context

**Gathered:** 2026-04-05
**Status:** Ready for planning

<domain>
## Phase Boundary

Pure backend phase — one new cron endpoint, one vercel.json entry. No mobile changes, no new DB tables, no new Supabase migrations.

Files changed:
- `backend/api/src/routes/storage.ts` — add `POST /cron/cleanup` handler
- `backend/api/vercel.json` — add cleanup cron entry

The storage router is already mounted at `/storage` in `app.ts` (Phase 14). The cleanup endpoint slots directly into the existing `storageRouter`.

</domain>

<decisions>
## Implementation Decisions

### Stale object identification
- **D-01:** Use `created_at` from Supabase Storage `list()` API — `FileObject.created_at` is a ISO string returned on every file. No changes to Phase 14 upload code required.
- **D-02:** Retention thresholds: `scan-photos` → 90 days, `exports` → 7 days. Computed as `new Date(Date.now() - RETENTION_MS)`.
- **D-03:** Do NOT use `expires_at` metadata — Phase 14 never writes metadata on upload; reading metadata would always be undefined. `created_at` is the authoritative age signal.

### Object enumeration strategy
- **D-04:** Files are stored under `${userId}/filename`. To enumerate all objects: call `supabase.storage.from(bucket).list('')` to get top-level "folders" (user ID entries), then `list(folder.name)` for each → collect file paths → filter by age.
- **D-05:** Use `Promise.allSettled` per folder so one failing user folder does not abort the entire cleanup run.

### Cron authentication
- **D-06:** Same pattern as supplement scraper (`supplements.ts` line 131–136): check `c.req.header('authorization') === \`Bearer ${process.env.CRON_SECRET}\``. Return 401 if mismatch. If `CRON_SECRET` is unset, allow (dev/local behavior — same as supplements).
- **D-07:** HTTP method: `POST` (as specified in ROADMAP SC-01 and Vercel cron config). Note: supplement scraper uses `GET` — cleanup uses `POST` as specified.

### Cron schedule
- **D-08:** Daily at 4am UTC — cron expression `0 4 * * *`. Different hour from supplement scraper (3am Monday) to avoid overlap.
- **D-09:** Add to `backend/api/vercel.json` `crons` array alongside existing supplement scraper entry.

### Response payload
- **D-10:** On success: `{ success: true, deleted: { scan_photos: number, exports: number }, errors: string[] }` — detailed summary for Vercel log inspection.
- **D-11:** `errors[]` collects non-fatal failures (e.g., one folder failed to list) without aborting the run. If any critical error prevents the whole run, return 500.

### Deletion method
- **D-12:** Use `supabase.storage.from(bucket).remove([paths])` — NOT raw SQL DELETE (ROADMAP mandate). Prevents orphaned storage objects.
- **D-13:** Build `paths` array for each bucket (`expired files from scan-photos` + `expired files from exports`), then call `remove()` in one batch per bucket.

### Exports cleanup
- **D-14:** Implement full exports cleanup (list + delete > 7 days) even though no exports exist yet in v1.3. Listing an empty bucket is a no-op. This makes the endpoint correct when Phase 16+ starts writing exports.

### Claude's Discretion
- Whether to extract the age-filter logic into a shared helper or inline per bucket
- Exact console.log format for Vercel logs
- Whether to paginate `list()` calls (Supabase default limit is 100 — acceptable for v1.3 scale)

</decisions>

<specifics>
## Specific Notes

- `storageRouter` in `storage.ts` is currently wrapped with `storageRouter.use('*', authMiddleware)` — the cron endpoint must be registered BEFORE that blanket middleware, or bypass it (cron uses `CRON_SECRET`, not user JWT).
- Alternatively: mount cleanup on a separate mini-router without `authMiddleware`, and mount it separately in `app.ts` as `app.route('/storage', cleanupRouter)`. This avoids auth middleware conflict.
- The Supabase client in `storage.ts` already uses service key — it has permission to list and delete across all user paths.
- `vercel.json` `crons` path must match the actual route. Since app.ts mounts storageRouter at `/storage`, the cron path is `/storage/cron/cleanup`.

</specifics>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase requirements
- `.planning/ROADMAP.md` §Phase 15 — 3 success criteria (cron auth, scan-photos cleanup, exports cleanup)
- `.planning/REQUIREMENTS.md` §INFRA-02 — the one remaining unchecked requirement

### Existing code to extend
- `backend/api/src/routes/storage.ts` — add POST /cron/cleanup here (Supabase client already available)
- `backend/api/vercel.json` — add cleanup cron entry to existing `crons` array

### Patterns to follow exactly
- `backend/api/src/routes/supplements.ts` lines 127–148 — cron auth pattern (`CRON_SECRET` header check, try/catch, return `{ success, results }`)
- `backend/api/vercel.json` — existing cron entry format (`{ "path": "...", "schedule": "..." }`)

### Key constraint
- `storageRouter.use('*', authMiddleware)` in `storage.ts` covers ALL routes — cleanup endpoint must be registered outside this blanket middleware or use a separate router instance to avoid JWT auth conflict with Vercel cron caller.

</canonical_refs>

<deferred>
## Deferred Ideas

- Paginate `list()` calls for buckets with > 100 objects per user folder — acceptable to skip in v1.3 (no production users yet)
- Dry-run mode (`?dry=true`) that logs what would be deleted without removing — useful for debugging but out of scope
- Metrics/alerting when deletion count exceeds a threshold — v1.4+
- Migrate existing scan photos to set expires_at metadata — unnecessary since we use created_at

</deferred>

---

*Phase: 15-lifecycle-cleanup*
*Context gathered: 2026-04-05*
