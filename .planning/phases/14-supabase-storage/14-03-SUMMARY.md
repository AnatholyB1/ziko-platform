---
phase: 14-supabase-storage
plan: "03"
subsystem: mobile-storage-upload
tags: [storage, signed-url, profile-photo, meal-scan, vision-ai, binary-upload]
dependency_graph:
  requires: [14-02]
  provides: [signed-url-mobile-upload, vision-nutrition-dual-mode]
  affects: [profile-photo-flow, nutrition-scan-flow, ai-vision-route]
tech_stack:
  added: []
  patterns: [signed-url-put-upload, blob-fetch-from-uri, supabase-createSignedUrl]
key_files:
  created: []
  modified:
    - apps/mobile/app/(app)/profile/settings.tsx
    - plugins/nutrition/src/screens/LogMealScreen.tsx
    - backend/api/src/routes/ai.ts
decisions:
  - "D-19: ImagePicker base64:false in both screens — blob fetched from URI instead"
  - "D-20: fetch(asset.uri) → blob → PUT to signed URL — no base64 encode/decode cycle"
  - "D-21: avatars bucket (017) left intact — only new uploads go to profile-photos"
  - "D-22: scan-photos signed URL path pattern userId/scan-${Date.now()}.jpg"
  - "D-23: POST /vision/nutrition accepts storage_path OR image (backward compat) — 400 if neither"
  - "D-24: createSignedUrl(storage_path, 300) — 300s TTL for Claude to fetch"
  - "D-25: new URL(readData.signedUrl) passed to Claude — Vercel AI SDK v6 accepts URL objects"
metrics:
  duration: "6 minutes"
  completed_date: "2026-04-03"
  tasks_completed: 2
  files_modified: 3
---

# Phase 14 Plan 03: Mobile Signed URL Upload Migration Summary

Signed URL direct upload flow wired into profile photo and meal scan screens; backend vision/nutrition route updated to accept storage_path with auto-generated 300s signed download URL passed to Claude as a URL object.

## What Was Built

### Task 1 — settings.tsx: Profile photo upload via profile-photos bucket

Replaced the base64-arraybuffer upload pattern with the signed URL flow:
- Removed `import { decode } from 'base64-arraybuffer'` (no longer needed)
- `ImagePicker.launchImageLibraryAsync` now uses `base64: false`
- Fetches signed upload URL from `GET /storage/upload-url?bucket=profile-photos&path=${userId}/avatar.${ext}`
- Fetches blob via `fetch(asset.uri)` and PUTs to Supabase Storage directly
- Reads public URL via `supabase.storage.from('profile-photos').getPublicUrl(filePath)` with cache-bust timestamp
- Persists public URL to `user_profiles.avatar_url`

The old `avatars` bucket (migration 017) is untouched — existing avatar_url values remain valid.

### Task 2 — LogMealScreen.tsx + ai.ts: Meal scan via scan-photos bucket

**LogMealScreen.tsx:**
- `pickImage` changed `base64: true` to `base64: false` in both `launchCameraAsync` and `launchImageLibraryAsync`
- `analyzeImage(asset.base64!)` changed to `analyzeImage(asset.uri)`
- `analyzeImage` fully rewritten: fetches session+userId, gets signed upload URL for `scan-photos`, PUTs blob, then POSTs `{ storage_path, meal_context }` to `/ai/vision/nutrition`

**ai.ts:**
- Added `import { createClient } from '@supabase/supabase-js'` and supabase client instance (service key, no session)
- `POST /vision/nutrition` now accepts `{ image?, storage_path?, meal_context? }`
- Returns 400 if neither `image` nor `storage_path` provided
- `storage_path` branch: calls `supabase.storage.from('scan-photos').createSignedUrl(storage_path, 300)` and passes `new URL(readData.signedUrl)` to Claude
- Legacy `image` base64 branch preserved unchanged for backward compat

## Commits

| Task | Commit | Files |
|------|--------|-------|
| 1 | a30d1f4 | apps/mobile/app/(app)/profile/settings.tsx |
| 2 | 4919982 | plugins/nutrition/src/screens/LogMealScreen.tsx, backend/api/src/routes/ai.ts |

## Deviations from Plan

None — plan executed exactly as written. Both tasks matched the interfaces and decisions documented in 14-CONTEXT.md.

## Verification Results

1. **Profile photo flow:** settings.tsx calls `/storage/upload-url?bucket=profile-photos`, PUTs blob, stores public URL — confirmed via grep (3 matches for `profile-photos`, 2 for `upload_url`, 0 for `base64-arraybuffer`)
2. **No binary in Hono:** LogMealScreen POSTs `{ storage_path: scanPath }` not base64 body — confirmed at line 211
3. **No public writes:** migration 025 has only `FOR SELECT TO public` (profile_photos_public_read) — no INSERT for public role
4. **exports bucket exists:** migration 025 inserts `('exports', 'exports', false)` into storage.buckets
5. **TypeScript compiles:** `npx tsc --noEmit` exits 0 with no errors

## Self-Check: PASSED

- `apps/mobile/app/(app)/profile/settings.tsx` — exists, contains `profile-photos` and `upload_url`, no `base64-arraybuffer`
- `plugins/nutrition/src/screens/LogMealScreen.tsx` — contains `scan-photos`, `storage_path: scanPath`
- `backend/api/src/routes/ai.ts` — contains `createClient`, `storage_path`, `createSignedUrl(storage_path, 300)`, `new URL(readData.signedUrl)`
- Commits a30d1f4 and 4919982 verified in git log
- TypeScript compiles clean
