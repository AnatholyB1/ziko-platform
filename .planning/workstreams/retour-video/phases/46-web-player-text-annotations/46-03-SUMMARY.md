---
phase: 46
plan: "03"
subsystem: coach-web-video-player
tags: [vidstack, annotation-panel, useReducer, gsap, typescript]
dependency_graph:
  requires: [46-01, 46-02]
  provides: [VideoPlayerPage, VideoPlayer, AnnotatedTimeSlider, VideoPlayerClient, AnnotationPanel]
  affects: [coach-web-videos, retour-video-workflow]
tech_stack:
  added: ["@vidstack/react@1.15.1 (next tag)"]
  patterns: ["useReducer state machine", "MediaPlayer subtree hook constraint", "GSAP entrance animation", "SSR server-component fetch + client pass-through"]
key_files:
  created:
    - apps/web/src/app/[locale]/(coach)/coach/clients/[id]/videos/[videoId]/page.tsx
    - apps/web/src/components/coach/videos/VideoPlayer.tsx
    - apps/web/src/components/coach/videos/AnnotatedTimeSlider.tsx
    - apps/web/src/components/coach/videos/AnnotationPanel.tsx
  modified:
    - apps/web/src/components/coach/videos/VideoPlayerClient.tsx
    - apps/web/src/app/globals.css
    - apps/web/package.json
decisions:
  - "@vidstack/react@next (1.15.1) installed — not @vidstack/react@latest (0.6.x) which requires React 18 only"
  - "Both VideoPlayer and AnnotationPanel wrapped inside single <MediaPlayer> root in VideoPlayerClient so useMediaState/useMediaRemote work in AnnotationPanel (Risk 2 mitigation)"
  - "AnnotationPanel uses useReducer (5 states) with annotationReducer pattern identical to vocalReducer.ts"
  - "Orange annotation dots gated on duration > 0 to prevent clustering at left:0% on mount (Risk 3)"
metrics:
  duration: "17 minutes"
  completed: "2026-05-27"
  tasks_completed: 3
  files_created: 4
  files_modified: 3
---

# Phase 46 Plan 03: Vidstack Player + AnnotationPanel State Machine Summary

**One-liner:** @vidstack/react@next MediaPlayer integration with 5-state useReducer AnnotationPanel — orange dot overlay, paused-gated compose, POST/PATCH/DELETE/send-feedback API, GSAP animations.

## Tasks Completed

| # | Task | Commit | Status |
|---|------|--------|--------|
| 1 | Install @vidstack/react@next + CSS imports + VideoPlayerPage server component | 5d7dd7c | Done |
| 2 | VideoPlayer + AnnotatedTimeSlider + VideoPlayerClient 2/3+1/3 layout | 8bd0db7 | Done |
| 3 | AnnotationPanel — full useReducer state machine (5 states) + GSAP + API | 39c9e18 | Done |

## What Was Built

### Task 1
- Installed `@vidstack/react@1.15.1` (next tag — React 19 compatible, not 0.6.x)
- Added 3 CSS lines to `globals.css`: `@import theme.css`, `@import video.css`, `@plugin tailwind.cjs`
- Created `VideoPlayerPage` server component with `Promise.all` SSR fetch: signed-url + annotations + video record; all fetches use `Authorization: Bearer` + `cache: 'no-store'`

### Task 2
- `VideoPlayer.tsx`: `<MediaPlayer>` wrapping `<MediaProvider>` + `DefaultVideoLayout` + `AnnotatedTimeSlider`; error state for empty `src`; GSAP `y:16→0` entrance; children slot for AnnotationPanel inside MediaPlayer tree
- `AnnotatedTimeSlider.tsx`: Vidstack `TimeSlider.Root` + absolute orange dot overlay; `useMediaState('duration')` gated on `duration > 0`; `remote.seek(timestamp_s)` on dot click; title tooltip with `MM:SS — [first 60 chars]`
- `VideoPlayerClient.tsx`: page header (back link, H1 title, date·duration caption); flex `gap-6 items-start` layout; passes `annotations` state + `setAnnotations` callback down to AnnotationPanel

### Task 3
- `AnnotationPanel.tsx`: full `useReducer` state machine with 5 states: `list / composing / editing / sending / sent`
- `useMediaState('paused')` + `useMediaState('currentTime')` + `useMediaRemote()` inside MediaPlayer subtree
- GSAP: panel entrance `y:16→0`, composer slide-in `x:16→0`, sent chip `scale 0.95→1` back.out(1.4)
- "Annoter à ce moment" disabled when `!paused`; title tooltip `'Mettez la vidéo en pause d'abord'`
- "Envoyer le retour" hidden when `annotations.length === 0`; POST `/send-feedback` → green chip `bg-[#DCFCE7] text-[#166534]`
- Inline delete confirmation (no modal); `maxLength={2000}` textarea + char counter; error banners
- Auth: `Authorization: Bearer accessToken` on every annotation write (T-46-08 mitigated)
- Content length gate: `maxLength={2000}` on textarea (T-46-09 client side)

## Deviations from Plan

### Auto-fixed Issues

None — plan executed exactly as written.

### Implementation Notes

1. **VideoPlayer structure** — The plan spec (Component 2a) shows `AnnotatedTimeSlider` as a sibling to `MediaProvider` inside a relative container. To also satisfy the Risk 2 requirement that AnnotationPanel is inside `<MediaPlayer>`, `VideoPlayer.tsx` accepts `children` which are rendered inside the MediaPlayer's flex layout. This matches the UI-SPEC layout contract exactly.

2. **VideoPlayerClient min-w conflict** — CSS `min-w-0` and `min-w-[280px]` are both applied on the annotation panel column. `min-w-[280px]` overrides `min-w-0` which is the intended behavior (minimum 280px, but flex-shrink allowed). Left as written in spec.

## Threat Mitigations Applied

| Threat ID | Mitigation |
|-----------|-----------|
| T-46-08 (EoP) | `Authorization: Bearer accessToken` on all annotation writes (POST, PATCH, DELETE, send-feedback) |
| T-46-09 (Tampering) | `maxLength={2000}` on textarea (client enforcement; server validates at Hono layer per plan 46-02) |

## Known Stubs

None — all components are fully implemented. AnnotationPanel.tsx stub from Task 2 was replaced with full implementation in Task 3 in the same commit wave.

## Self-Check: PASSED

- FOUND: `apps/web/src/app/[locale]/(coach)/coach/clients/[id]/videos/[videoId]/page.tsx`
- FOUND: `apps/web/src/components/coach/videos/VideoPlayer.tsx`
- FOUND: `apps/web/src/components/coach/videos/AnnotatedTimeSlider.tsx`
- FOUND: `apps/web/src/components/coach/videos/VideoPlayerClient.tsx`
- FOUND: `apps/web/src/components/coach/videos/AnnotationPanel.tsx`
- Commits: `5d7dd7c`, `8bd0db7`, `39c9e18` — all present in git log
- `tsc --noEmit -p apps/web/tsconfig.json` exits 0
