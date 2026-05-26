---
phase: "45-storage-pipeline-mobile-upload"
plan: "03"
subsystem: "coach-plugin-mobile"
tags: ["upload", "video", "expo-image-picker", "xhr", "progress", "coach"]

requires:
  - "45-01"
  - "45-02"
provides:
  - "VideoUploadSheet — H.264 picker + XHR progress upload"
  - "VideoListScreen — coach_client_videos list with status badges"
  - "videos.tsx — Expo Router route wrapper"
affects:
  - "plugins/coach"
  - "apps/mobile"

tech-stack:
  added: []
  patterns:
    - "XHR PUT to Supabase signed URL with xhr.upload.onprogress for progress events"
    - "expo-image-picker mediaTypes string array + VideoExportPreset.H264_1920x1080"
    - "React Native Modal animationType=slide presentationStyle=pageSheet"
    - "TanStack Query useQuery with coach_client_videos + invalidateQueries on upload"

key-files:
  created:
    - plugins/coach/src/screens/VideoUploadSheet.tsx
    - plugins/coach/src/screens/VideoListScreen.tsx
    - apps/mobile/app/(app)/(plugins)/coach/videos.tsx
  modified:
    - plugins/coach/package.json

key-decisions:
  - "XHR PUT (not fetch().blob()) for video upload to expose xhr.upload.onprogress byte-level progress events"
  - "allowsEditing: false mandatory — combining with videoExportPreset requires false to apply H.264 export (Pitfall 3)"
  - "Auto-suggested title 'Exercice YYYY-MM-DD' initialized on each sheet open — editable, required before upload (D-09, D-10)"
  - "Package exports updated in plugins/coach/package.json to expose VideoListScreen and VideoUploadSheet paths"

requirements-completed:
  - UPLOAD-01
  - UPLOAD-02
  - UPLOAD-03
  - INFRA-02

metrics:
  duration: "14 min"
  completed: "2026-05-26"
  tasks: 2
  files: 4
---

# Phase 45 Plan 03: VideoUploadSheet + VideoListScreen Summary

Mobile upload screens for the coach plugin: VideoUploadSheet (H.264 picker + XHR upload with progress bar) and VideoListScreen (coach_client_videos list with status badges + upload FAB), plus the Expo Router route wrapper.

## Duration

- Start: 2026-05-26T12:32:42Z
- End: 2026-05-26T12:46:53Z
- Duration: 14 min
- Tasks: 2/2 completed
- Files: 4 (3 created, 1 modified)

## Tasks Completed

| # | Name | Commit | Files |
|---|------|--------|-------|
| 1 | VideoUploadSheet — H.264 picker + XHR progress upload | ec82448 | plugins/coach/src/screens/VideoUploadSheet.tsx |
| 2 | VideoListScreen + videos.tsx route wrapper | a226247 | plugins/coach/src/screens/VideoListScreen.tsx, apps/mobile/app/(app)/(plugins)/coach/videos.tsx, plugins/coach/package.json |

## What Was Built

**VideoUploadSheet** (`plugins/coach/src/screens/VideoUploadSheet.tsx`):
- Source picker via showAlert (Galerie / Caméra / Annuler) on modal open
- `launchImageLibraryAsync` + `launchCameraAsync` with `mediaTypes: ['videos']`, `allowsEditing: false`, `VideoExportPreset.H264_1920x1080` (INFRA-02), `videoMaxDuration: 0`
- Auto-suggested title initialized to `"Exercice YYYY-MM-DD"` on each open (D-09)
- TextInput for title — Upload button disabled when `title.trim() === ''` or `isUploading` (D-10)
- Duration display formatted as "MM:SS" from asset.duration
- XHR PUT to signed URL with `xhr.upload.onprogress` setting uploadProgress 0-100% (UPLOAD-02)
- Progress bar View with `width: ${uploadProgress}%` and `backgroundColor: theme.primary`
- handleUpload: getSession → POST /coach/videos/upload-url → XHR PUT → POST /coach/videos/:videoId/complete → onUploadComplete + onClose
- Error handling via `showAlert('Erreur', "L'upload a échoué. Réessaie.")` — no Alert.alert

**VideoListScreen** (`plugins/coach/src/screens/VideoListScreen.tsx`):
- `useQuery(['coach-videos', userId])` querying `coach_client_videos` with `athlete_id` filter, `created_at DESC`
- Status badges: `'uploading'` → ActivityIndicator + "En cours...", `'ready'` → green dot (#2E9E5B) + "Prête", `'annotated'` → orange dot (theme.primary) + "Annotée"
- Video card: borderRadius 12, Surface white, border theme.border, padding 14, flexDirection row
- Empty state: `cloud-upload-outline` size=48, instructional text
- FAB: position absolute, bottom 24, right 20, 56x56, borderRadius 28, theme.primary background, `add` icon
- Header "MES VIDÉOS" uppercase, fontSize 10, fontWeight 800, letterSpacing 1.2, color theme.primary
- VideoUploadSheet rendered with `visible={showUploadSheet}`, `onUploadComplete` calls `queryClient.invalidateQueries({ queryKey: ['coach-videos'] })`

**videos.tsx** (`apps/mobile/app/(app)/(plugins)/coach/videos.tsx`):
- Mirrors `dashboard.tsx` exactly: imports VideoListScreen + supabase, exports `CoachVideosRoute`

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocker] Added VideoListScreen + VideoUploadSheet exports to plugins/coach/package.json**
- **Found during:** Task 2 TypeScript verification
- **Issue:** `TS2307 Cannot find module '@ziko/plugin-coach/screens/VideoListScreen'` — the package.json `exports` field only exposed `CoachScreen`, not the two new screens
- **Fix:** Added `"./screens/VideoListScreen"` and `"./screens/VideoUploadSheet"` entries to the `exports` map in `plugins/coach/package.json`
- **Files modified:** `plugins/coach/package.json`
- **Commit:** a226247

**Total deviations:** 1 auto-fixed (Rule 3 blocker). **Impact:** None — module resolution now correct, TypeScript clean.

## Pre-existing Issues (Out of Scope)

5 pre-existing TS2307 errors in unrelated plugin routes (hydration, persona, habits, community, ai-programs) — not introduced by this plan, not fixed (out of scope per deviation boundary rule). Logged for deferred-items.

## Known Stubs

None — VideoListScreen queries live Supabase data, VideoUploadSheet calls live Hono endpoints.

## Threat Flags

None — no new network endpoints added on mobile side. Upload flow uses existing `/coach/videos/*` routes created in plan 45-02.

## Self-Check

- [x] `plugins/coach/src/screens/VideoUploadSheet.tsx` exists — FOUND
- [x] `plugins/coach/src/screens/VideoListScreen.tsx` exists — FOUND
- [x] `apps/mobile/app/(app)/(plugins)/coach/videos.tsx` exists — FOUND
- [x] `plugins/coach/package.json` updated with new exports — FOUND
- [x] Commit ec82448 exists — FOUND
- [x] Commit a226247 exists — FOUND
- [x] `grep "coach_client_videos" VideoListScreen.tsx` — PASS
- [x] `grep "H264_1920x1080" VideoUploadSheet.tsx` — PASS
- [x] TSC: no errors for VideoUploadSheet, VideoListScreen, CoachVideosRoute — PASS

## Self-Check: PASSED

## Next

Ready for plan 45-04 (if any) or phase complete.
