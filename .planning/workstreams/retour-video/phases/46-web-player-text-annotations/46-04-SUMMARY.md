---
phase: 46
plan: "04"
subsystem: mobile-coach-plugin
tags: [expo-video, mobile, annotation-review, native-video-player]
requires: [46-01]
provides: [VideoPlayerScreen, video-player-route, VideoListScreen-navigation]
affects: [plugins/coach, apps/mobile]
tech-stack:
  added:
    - expo-video ~3.0.16 (SDK 54 native video player, replaces deprecated expo-av)
  patterns:
    - useVideoPlayer + VideoView from expo-video 3.x
    - useEvent(player, 'statusChange') to detect readyToPlay and read duration
    - player.currentTime = timestamp_s for seek-to-timecode
    - Custom annotation timeline strip with 44×44px TouchableOpacity touch targets
    - Duration gate (duration > 0) before rendering annotation dots
key-files:
  created:
    - apps/mobile/app/(app)/(plugins)/coach/video-player.tsx
    - plugins/coach/src/screens/VideoPlayerScreen.tsx
  modified:
    - apps/mobile/package.json (expo-video ~3.0.16)
    - plugins/coach/src/screens/VideoListScreen.tsx (useRouter + onPress navigation)
    - plugins/coach/package.json (VideoPlayerScreen export entry)
key-decisions:
  - expo-video resolved to 3.0.16 (not 2.0.6 as estimated in RESEARCH.md); SDK resolver determines correct version automatically
  - VideoPlayerStatus uses 'readyToPlay' (not 'readyForDisplay') in expo-video 3.x
  - TimeUpdateEventPayload requires currentLiveTimestamp, currentOffsetFromLive, bufferedPosition fields for correct TS typing
  - Duration set via useEffect watching playerStatus to avoid race conditions
requirements-completed: [REVIEW-01, REVIEW-02]
duration: "20 min"
completed: "2026-05-27"
---

# Phase 46 Plan 04: Mobile VideoPlayerScreen — expo-video + Annotation Timeline

expo-video 3.0.16 installed; VideoPlayerScreen with signed URL fetch, native video player, annotation timeline strip with orange dots at timestamp % positions, seek-on-tap, and annotation list with MM:SS chips.

**Duration:** ~20 min | **Start:** 2026-05-27T14:44Z | **End:** 2026-05-27T15:05Z | **Tasks:** 2/2 | **Files:** 5

---

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | Install expo-video + route wrapper + VideoListScreen extension | ae51c3e | package.json, video-player.tsx, VideoListScreen.tsx |
| 2 | VideoPlayerScreen — expo-video + annotation timeline strip + annotation list | e56379c | VideoPlayerScreen.tsx, plugin package.json |

---

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] expo-video resolved to 3.0.16 instead of 2.0.6**
- **Found during:** Task 1
- **Issue:** RESEARCH.md estimated `~2.0.6` for SDK 54, but the Expo SDK resolver pinned `~3.0.16` — the actual latest compatible version for the installed SDK 54 environment.
- **Fix:** Accepted 3.0.16 as the correct resolved version (expo install resolver is authoritative).
- **Files modified:** apps/mobile/package.json
- **Impact:** None — 3.0.16 API is backward compatible with 2.x for the APIs used (VideoView, useVideoPlayer, player.currentTime, timeUpdateEventInterval).

**2. [Rule 1 - Bug] VideoPlayerStatus value corrected to 'readyToPlay'**
- **Found during:** Task 2
- **Issue:** PLAN.md and 046-UI-SPEC.md reference `'readyForDisplay'` as the status value for duration detection. In expo-video 3.x, the correct status enum is `'readyToPlay'`.
- **Fix:** Used `'readyToPlay'` in the statusChange useEffect duration gate.
- **Files modified:** plugins/coach/src/screens/VideoPlayerScreen.tsx

**3. [Rule 3 - Blocker] TimeUpdateEventPayload requires additional fields**
- **Found during:** Task 2
- **Issue:** PLAN.md specifies `useEvent(player, 'timeUpdate', { currentTime: player.currentTime })` but TypeScript rejects the initial state because `TimeUpdateEventPayload` also requires `currentLiveTimestamp`, `currentOffsetFromLive`, and `bufferedPosition`.
- **Fix:** Added all required fields to the initial state object.
- **Files modified:** plugins/coach/src/screens/VideoPlayerScreen.tsx
- **Commit:** e56379c

**Total deviations:** 3 auto-fixed (1 version, 1 API name, 1 type). **Impact:** none on functionality — all are correct runtime behavior.

---

## Known Stubs

None — VideoPlayerScreen fetches real data from Hono API endpoints. expo-video renders real native video.

---

## Threat Flags

No new threat surface beyond the plan's threat model. Both mobile API calls (signed-url + annotations) require Bearer JWT and access is controlled server-side per T-46-10, T-46-11.

---

## Self-Check

- [x] `apps/mobile/app/(app)/(plugins)/coach/video-player.tsx` exists
- [x] `plugins/coach/src/screens/VideoPlayerScreen.tsx` exists
- [x] Commits ae51c3e and e56379c exist in git log
- [x] tsc --noEmit exits 0 (no errors in VideoPlayerScreen)
- [x] expo-video ~3.0.16 in apps/mobile/package.json
- [x] VideoListScreen.tsx contains router.push with video-player?videoId=
- [x] VideoPlayerScreen.tsx contains player.currentTime = a.timestamp_s
- [x] VideoPlayerScreen.tsx contains duration > 0 gate
- [x] VideoPlayerScreen.tsx contains width: 44, height: 44 touch target
- [x] VideoPlayerScreen.tsx contains paddingBottom: 100
- [x] No Alert.alert — only showAlert from @ziko/plugin-sdk

## Self-Check: PASSED

---

## Next

Phase 46 Plan 04 complete. Ready for next plan or phase-level verification.
