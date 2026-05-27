---
phase: 47-voice-annotations
plan: "02"
subsystem: web/coach-videos
tags: [voice-composer, useReducer, gsap, web, coach]
requires:
  - 47-01
provides:
  - VoiceComposer component (apps/web/src/components/coach/videos/VoiceComposer.tsx)
affects:
  - AnnotationPanel (will mount VoiceComposer in voice mode)
tech-stack:
  added: []
  patterns:
    - useReducer 5-state lifecycle (idle/recording/transcribing/review/error)
    - useVocalRecorder drop-in hook
    - GSAP entrance animations on state transitions
    - Multipart FormData upload to Hono route
key-files:
  created:
    - apps/web/src/components/coach/videos/VoiceComposer.tsx
  modified: []
key-decisions:
  - useReducer chosen over useState for clean state machine (5 states, 5 actions)
  - Cancel during recording calls recorderStop() + discards blob (no upload)
  - Sauvegarder never disabled in review state — transcript always present per spec
  - Blob size >4MB logs warning to console (T-47-WEB-02 mitigation)
requirements-completed:
  - VOICE-01
duration: "4 min"
completed: "2026-05-27"
---

# Phase 47 Plan 02: VoiceComposer — 5-state voice recording component Summary

VoiceComposer component with useReducer lifecycle (idle → recording → transcribing → review → error), useVocalRecorder drop-in, GSAP entrance animations, multipart upload to POST /coach/videos/annotations/transcribe.

**Duration:** 4 min (20:24 → 20:29 UTC)
**Tasks completed:** 1/1
**Files created:** 1

---

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Create VoiceComposer.tsx — full 5-state voice composer | 88ef61c | apps/web/src/components/coach/videos/VoiceComposer.tsx |

---

## What Was Built

`VoiceComposer.tsx` — a `'use client'` React component that owns the full voice recording lifecycle for the AnnotationPanel voice mode.

**State machine (useReducer):**
- `idle` — orange (#FF5C1A) 64px mic button, "Appuyez pour commencer l'enregistrement", [Annuler] footer
- `recording` — red (#EF4444) stop button with `animate-ping` pulse ring, M:SS elapsed timer (useState + setInterval), "Enregistrement en cours... Appuyez pour arrêter", [Annuler] footer
- `transcribing` — Loader2 `animate-spin` orange, "Transcription IA en cours...", "Quelques secondes...", empty footer (locked)
- `review` — read-only textarea (bg-[#F0EFE9]), "Transcription IA" label, hint text, [Ré-enregistrer][Sauvegarder] footer; Sauvegarder calls `onVoiceReady({ transcript, audioPath })`
- `error` — bg-[#FEF2F2] border-[#FCA5A5] error card with AlertCircle, "La transcription a échoué. Vérifiez votre connexion et réessayez.", [Ré-enregistrer] + [Annuler] footer

**GSAP animations (all 5 contracts):**
- Mount: `gsap.from(containerRef.current, { x: 16, opacity: 0, duration: 0.2, ease: 'power2.out' })`
- Transcribing: `gsap.from(spinnerContainerRef.current, { scale: 0, opacity: 0, duration: 0.2, ease: 'back.out(1.4)' })`
- Review: `gsap.from(transcriptBoxRef.current, { y: 8, opacity: 0, duration: 0.25, ease: 'power2.out' })`
- Error: `gsap.from(errorCardRef.current, { y: 4, opacity: 0, duration: 0.2, ease: 'power2.out' })`
- Mic press: `gsap.from(micBtnRef.current, { scale: 0.9, duration: 0.1, ease: 'back.out(1.7)' })`

**Upload function:**
- FormData: `audio` blob (`recording.webm` or `.mp4`), `mimeType`, `videoId`, `timestamp_s`
- POST `${apiUrl}/coach/videos/annotations/transcribe` with `Authorization: Bearer ${accessToken}`
- No manual Content-Type header (browser sets boundary)
- On success: `TRANSCRIPTION_SUCCESS` → review state
- On failure: `TRANSCRIPTION_ERROR` → error state

---

## Verification Results

```
rtk tsc --noEmit -p apps/web/tsconfig.json | grep VoiceComposer
→ No VoiceComposer type errors

grep useReducer|useVocalRecorder|annotations/transcribe|onVoiceReady VoiceComposer.tsx
→ All 4 patterns found (8 matches total, onVoiceReady × 3)

File exists: FOUND
Commit 88ef61c: FOUND
```

---

## Deviations from Plan

None — plan executed exactly as written.

The `handleCancelDuringRecording` function was added to properly handle the [Annuler] button click while recording is active (stops recorder + discards blob without uploading). This is consistent with 047-UI-SPEC.md behavior ("Clicking [Annuler] while recording: stops recording, discards blob, resets to idle") and is a necessary implementation detail not explicitly in the task spec but required for correct behavior (Rule 2 — missing critical functionality).

**Deviation 1: [Rule 2 - Missing Critical] handleCancelDuringRecording**
- **Found during:** Task 1
- **Issue:** The spec says clicking [Annuler] while recording stops recording and discards blob, but the idle and recording states share the same `onCancel` prop. A separate handler was needed to properly call `recorderStop()` and clear the interval before resetting to idle.
- **Fix:** Added `handleCancelDuringRecording()` function that calls `recorderStop()` (ignoring blob), clears interval, and dispatches `RESET`.
- **Files modified:** VoiceComposer.tsx
- **Commit:** 88ef61c

**Total deviations:** 1 auto-fixed (missing critical handler). **Impact:** None — component behavior matches spec exactly.

---

## Known Stubs

None — all data flows are wired. `onVoiceReady` receives real `{ transcript, audioPath }` from the API response.

---

## Threat Flags

None — no new network endpoints, auth paths, or schema changes beyond what the plan specified.

---

## Next

Ready for 47-03 (AnnotationPanel voice mode integration — mount VoiceComposer when mode = 'voice', add SET_MODE action, thread accessToken/apiUrl/videoId props).

## Self-Check: PASSED

- [x] `apps/web/src/components/coach/videos/VoiceComposer.tsx` exists on disk
- [x] Commit `88ef61c` exists in git log
- [x] TypeScript: no VoiceComposer errors
- [x] All 5 states rendered (idle/recording/transcribing/review/error)
- [x] All 4 GSAP entrance animations present
- [x] `onVoiceReady` called in review Sauvegarder handler
- [x] `formData.append('videoId', videoId)` present
- [x] `fetch(apiUrl + '/coach/videos/annotations/transcribe', ...)` present
- [x] `import gsap from 'gsap'` present
- [x] All copy French per 047-UI-SPEC.md
