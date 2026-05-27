---
phase: 47-voice-annotations
plan: "03"
subsystem: retour-video
tags: [voice-annotations, annotation-panel, voice-composer, audio-player, web]
dependency_graph:
  requires: [47-02]
  provides: [voice-annotation-panel, mode-toggle, audio-player-list]
  affects: [AnnotationPanel, VideoPlayerClient]
tech_stack:
  added: []
  patterns: [useReducer-extension, audioUrlMap-signed-url-cache, VoiceComposer-child-mount]
key_files:
  created: []
  modified:
    - apps/web/src/components/coach/videos/AnnotationPanel.tsx
    - apps/web/src/components/coach/videos/VideoPlayerClient.tsx
decisions:
  - "VOICE_READY action kept in type union for documentation but handled in handleVoiceReady handler (not in reducer) per plan spec"
  - "audio controls rendered as JSX attribute (no string quotes) — standard HTML5 audio element"
  - "Footer area returns null in voice mode — VoiceComposer owns its own footer section"
metrics:
  duration: "~15 minutes"
  completed: "2026-05-27T20:36:52Z"
  tasks_completed: 2
  files_modified: 2
---

# Phase 47 Plan 03: AnnotationPanel Voice Mode + Audio Player Summary

**One-liner:** Mode toggle [Texte][Voix] + VoiceComposer mount + signed audio URL fetch + voice annotation list item with native `<audio controls>` player in AnnotationPanel.

---

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | Update Annotation interface in VideoPlayerClient.tsx | 1e49060 | VideoPlayerClient.tsx |
| 2 | Extend AnnotationPanel with mode toggle, VoiceComposer mount, voice save, voice list rendering, audio URL fetch | f22ec33 | AnnotationPanel.tsx |

---

## What Was Built

### Task 1 — VideoPlayerClient.tsx
Extended `export interface Annotation` with two optional backward-compatible fields:
- `type?: 'text' | 'voice'` — annotation type discriminator
- `audio_path?: string | null` — Supabase storage path for recorded audio

### Task 2 — AnnotationPanel.tsx

**Type extensions:**
- `composing` and `editing` states in `AnnotationState` union gain `mode: 'text' | 'voice'` field (default `'text'` via `START_COMPOSE` / `START_EDIT` reducers)
- New action types: `SET_MODE` (handled in reducer) and `VOICE_READY` (documented in union, handled in component handler)

**Reducer additions:**
- `START_COMPOSE` / `START_EDIT`: now set `mode: 'text'` in returned state
- `SET_MODE` case: returns `{ ...state, mode: action.mode }` when composing or editing; no-op otherwise

**New state:**
- `audioUrlMap: Map<string, string>` — annotation ID → signed audio URL

**Signed URL fetch (`useEffect`):**
- Fires when `state.status === 'list'` and annotations change
- For each `type === 'voice'` annotation with `audio_path`, fetches `GET /coach/videos/annotations/:id/audio-url`
- Skips already-fetched IDs (idempotent); logs errors to console without UI disruption (skeleton persists on failure)

**handleVoiceReady:**
- POSTs to `/:videoId/annotations` with `{ timestamp_s, content: transcript, type: 'voice', audio_path: audioPath }`
- On success: dispatches `SAVE_SUCCESS` → panel returns to list state

**Mode toggle UI:**
- Two-tab segmented control above timestamp chip: `[Type icon] Texte` / `[Mic icon] Voix`
- Text tab active: `bg-white text-[#1C1A17]`; inactive: `bg-[#F0EFE9] text-[#6B6963]`
- Voix tab active: `bg-[#FF5C1A] text-white`; inactive: `bg-[#F0EFE9] text-[#6B6963]`

**VoiceComposer mount:**
- Renders when `currentMode === 'voice'`; receives `timestampSeconds`, `onVoiceReady`, `onCancel`, `accessToken`, `apiUrl`, `videoId`
- Panel footer (Annuler / Enregistrer) hidden when voice mode — VoiceComposer owns its own footer

**Voice annotation list item:**
- Header row: mic badge (`bg-[#FFF0E8]` with `Mic size={10}`) + timestamp chip + transcript text + action icons
- Edit pencil: disabled with tooltip "Ré-enregistrement disponible dans une prochaine version"
- Audio player line: skeleton (`animate-pulse`) while URL loading; `<audio controls preload="none">` when ready
- Left accent strip: same as text annotations

**Text annotation rendering:** Unchanged from Phase 46 implementation.

---

## Deviations from Plan

None — plan executed exactly as written.

---

## Threat Surface Scan

No new network endpoints or auth paths introduced beyond those already in the plan's threat model (`GET /annotations/:id/audio-url` and `POST /:videoId/annotations`). Both are covered by T-47-P3-01 and T-47-P3-02.

---

## Self-Check

- [x] `apps/web/src/components/coach/videos/AnnotationPanel.tsx` exists and modified
- [x] `apps/web/src/components/coach/videos/VideoPlayerClient.tsx` exists and modified
- [x] Commit 1e49060 exists (VideoPlayerClient interface)
- [x] Commit f22ec33 exists (AnnotationPanel extensions)
- [x] TypeScript compiles without errors (`rtk tsc --noEmit` → clean)
- [x] All plan verification greps return matches

## Self-Check: PASSED
