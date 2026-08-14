---
phase: 28-ai-file-imports
plan: "04"
subsystem: backend/coach-imports
tags: [hono, route-layer, imports, async-parse, credits, supabase-storage]
dependency_graph:
  requires:
    - 28-02 (parse submodule: pdf.ts, excel.ts, word.ts, claude.ts)
    - 28-03 (db layer: types.ts, db.ts, credits sentinel)
  provides:
    - importsRouter (6 live API routes at /coach/imports)
    - ALLOWED_BUCKETS includes 'ai-imports'
  affects:
    - backend/api/src/app.ts (route mount)
    - backend/api/src/routes/storage.ts (bucket allowlist)
tech_stack:
  added: []
  patterns:
    - static-before-dynamic route registration (Pitfall 4)
    - inline variable-cost credit check (Pattern 1, not middleware)
    - 202-then-async parse with 55s guard
    - JWT-scoped DB client + admin client for Storage only
key_files:
  created:
    - backend/api/src/coach/imports/service.ts
  modified:
    - backend/api/src/routes/storage.ts
    - backend/api/src/app.ts
decisions:
  - "Inline credit check (not middleware) — variable cost requires page_count from DB row at parse time"
  - "Admin client scoped to Storage download only; all DB queries via JWT client (ARCH-03)"
  - "55s guard uses setTimeout + parseResolved flag to handle Vercel 60s maxDuration"
  - "POST /:id/parse responds with c.newResponse() at 202 then fires non-awaited async IIFE"
metrics:
  duration: "~7 minutes"
  completed: "2026-05-21"
  tasks_completed: 2
  tasks_total: 2
  files_changed: 3
---

# Phase 28 Plan 04: Imports Route Layer Summary

**One-liner:** Hono route layer for AI file imports — 6 endpoints (create/upload/parse/poll/commit) with 202 async parse, inline variable-cost credit check, and 55s timeout guard.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Extend ALLOWED_BUCKETS and mount importsRouter | 217b964 | storage.ts, app.ts |
| 2 | Build service.ts — 6 Hono routes for imports module | 5030c77 | service.ts |

## What Was Built

### `backend/api/src/coach/imports/service.ts`

6 Hono routes registered in static-before-dynamic order:

1. **GET /** — `listImports` → returns user's last 50 imports newest first
2. **POST /** — `createImport` + `createSignedUploadUrl` → returns `{ import_id, signed_upload_url, path }` (201)
3. **PUT /:id/status** — validates current `status='pending'` → transitions to `uploaded` (409 on wrong state)
4. **POST /:id/parse** — validates `status='uploaded'`, inline credit check, marks `parsing`, returns **202** immediately, fires async IIFE background chain with 55s guard
5. **GET /:id** — polls import row; RLS returns 404 for non-owned rows (T-28-04-06)
6. **PUT /:id/commit** — validates `status='ready'`, calls `db.commitImport`, returns `{ program_id }`

**Async parse chain** (background, non-blocking):
- Downloads file from `ai-imports` bucket via admin client
- Dispatches by MIME type: PDF → `rasterizePdf` + `parseWithVision`, PNG/JPEG → `parseWithVision([base64])`, Excel → `parseExcel` + `parseWithText`, Word → `parseWord` + `parseWithText`
- On success: deducts credits with `costOverride` (D-01/D-02), updates status to `ready`
- On failure: updates status to `failed` with French UX error message
- 55s guard: `setTimeout` with `parseResolved` flag, clears on completion

**Credit logic (D-01/D-02/D-03):**
- `creditCost = pdf ? Math.min(page_count ?? 1, 10) : 1`
- Computed from server-stored `page_count` — not from client input (T-28-04-04)
- `getQuotaStatus` check: `withinFreeQuota || balance >= creditCost`
- Insufficient credits → update status='failed', return 402
- Credits deducted ONLY on parse success (D-03)

### `backend/api/src/routes/storage.ts`

Added `'ai-imports'` to `ALLOWED_BUCKETS` array. `AllowedBucket` type is derived via `typeof ALLOWED_BUCKETS[number]` — auto-updated.

### `backend/api/src/app.ts`

Added import and route mount:
```ts
import { importsRouter } from './coach/imports/service.js';
app.route('/coach/imports', importsRouter);
```

## Deviations from Plan

None — plan executed exactly as written.

## Threat Model Coverage

| Threat | Applied |
|--------|---------|
| T-28-04-01 — mime_type validation | `ALLOWED_MIME_TYPES` check in POST / before DB insert |
| T-28-04-02 — size_bytes validation | `size_bytes > 0 && <= 26214400` check before DB insert |
| T-28-04-03 — storage path prefix | `${userId}/${importId}/${filename}` — user cannot upload to another user's path |
| T-28-04-04 — credit bypass | `creditCost` derived from server-stored `page_count`, never from request body |
| T-28-04-05 — parsed_data injection | JSONB passthrough; `db.commitImport` validates shape downstream |
| T-28-04-06 — cross-user GET | `db.getImport` uses JWT client; RLS `ai_imports_own` returns null → 404 |

## Known Stubs

None — all routes are fully wired to their respective db.ts functions and parse submodule.

## Threat Flags

No new security-relevant surface introduced beyond what is covered by the threat model above.

## Self-Check: PASSED

- `backend/api/src/coach/imports/service.ts` — FOUND
- `backend/api/src/routes/storage.ts` — FOUND (contains 'ai-imports')
- `backend/api/src/app.ts` — FOUND (contains importsRouter mount)
- Commit 217b964 — FOUND
- Commit 5030c77 — FOUND
- TypeScript compilation — PASSED (no errors)
