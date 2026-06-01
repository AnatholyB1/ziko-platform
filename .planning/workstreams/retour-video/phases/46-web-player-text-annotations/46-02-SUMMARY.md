---
phase: 46
plan: 02
subsystem: web-coach
tags: [navigation, ui, video, gsap, next-js]
dependency_graph:
  requires: [46-01]
  provides: [ClientTabStrip-videos-tab, VideoListClient, ClientNotesPanelConditional, videos-page-route]
  affects: [layout.tsx, ClientTabStrip.tsx]
tech_stack:
  added: []
  patterns: [server-component-to-client, usePathname-conditional-render, createBrowserClient-auth, gsap-stagger]
key_files:
  created:
    - apps/web/src/components/coach/videos/ClientNotesPanelConditional.tsx
    - apps/web/src/app/[locale]/(coach)/coach/clients/[id]/videos/page.tsx
    - apps/web/src/components/coach/videos/VideoListClient.tsx
  modified:
    - apps/web/src/components/coach/ClientTabStrip.tsx
    - apps/web/src/app/[locale]/(coach)/coach/clients/[id]/layout.tsx
decisions:
  - "VideoListClient fetches client-side using createBrowserClient to get JWT; matches DashboardGrid pattern already in codebase"
  - "ClientNotesPanelConditional wraps ClientNotesPanel with usePathname check; layout.tsx stays a server component"
  - "isActive detection for videos tab uses pathname.includes('/videos') to cover both /videos and /videos/[videoId]"
metrics:
  duration: ~15min
  completed: "2026-05-27T14:56:37Z"
  tasks_completed: 2
  files_modified: 5
---

# Phase 46 Plan 02: Videos Tab + VideoListPage Summary

## One-liner

Vidéos tab wired into ClientTabStrip (11th tab) with notes panel auto-hidden on /videos/* and VideoListClient delivering loading/empty/error/populated states with GSAP stagger.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | ClientTabStrip + layout notes panel fix | 0505217 | ClientTabStrip.tsx, layout.tsx, ClientNotesPanelConditional.tsx |
| 2 | videos/page.tsx + VideoListClient.tsx | 35ec49f | videos/page.tsx, VideoListClient.tsx |

## What Was Built

### Task 1 — ClientTabStrip + Notes Panel Fix

**ClientTabStrip.tsx**: Added `{ key: 'videos', label: 'Vidéos' }` as the 11th tab. Updated isActive detection so the videos tab stays active on both `/videos` and `/videos/[videoId]` sub-pages via `pathname.includes('/videos')`.

**ClientNotesPanelConditional.tsx**: New `'use client'` component in `apps/web/src/components/coach/videos/`. Wraps `ClientNotesPanel` and returns `null` when `pathname.includes('/videos')`. Accepts same props as `ClientNotesPanel` (clientId, initialNote, initialTags, apiUrl).

**layout.tsx**: Replaced `ClientNotesPanel` import with `ClientNotesPanelConditional`. All existing props passed unchanged. The outer `<div className="hidden lg:block w-72 shrink-0">` stays — only the inner component changes. layout.tsx remains a server component.

### Task 2 — videos/page.tsx + VideoListClient

**videos/page.tsx**: Thin server component following the `vocal/page.tsx` pattern. Awaits params, extracts `id`, renders `<VideoListClient clientId={id} />`. No force-dynamic needed (inherited from parent layout.tsx).

**VideoListClient.tsx**: Full-featured client component with four states:
- **Loading**: 3 skeleton rows using `bg-[#E2E0DA] animate-pulse` only — no orange
- **Error**: `AlertCircle` 24px `text-[#EF4444]`, French copy, "Réessayer" button that re-triggers fetch
- **Empty**: `Video` icon 40px opacity-40, French copy with max-w-[320px] body
- **Populated**: card container with per-row film icon, title+date, status badge, chevron for clickable rows

Status badges: uploading `bg-[#FEF3C7] text-[#92400E]`, ready `bg-[#DCFCE7] text-[#166534]`, annotated `bg-[#FFF0E8] text-[#C2410C]`.

Row behavior: `ready`/`annotated` rows navigate to `/coach/clients/${clientId}/videos/${video.id}` via `router.push`; `uploading` rows have `cursor-default`, no chevron, no click handler.

GSAP: page entrance `gsap.from(listRef.current, { y: 16, opacity: 0, duration: 0.2 })` + list stagger `gsap.from('.video-list-item', { y: 8, opacity: 0, stagger: 0.04 })` after data loads.

Auth: uses `createBrowserClient` from `@supabase/ssr` to get the JWT client-side, following the established `DashboardGrid.tsx` pattern.

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None. VideoListClient fetches live data from `GET /coach/clients/${clientId}/videos` (backend route provided by 46-01). No hardcoded/placeholder data flows to the UI.

## Threat Flags

No new security surface introduced beyond what the plan's threat model covered. VideoListClient sends `Authorization: Bearer ${jwt}` on every fetch (T-46-05 mitigated). ClientNotesPanelConditional pathname check is UI-only, as expected (T-46-06 accepted).

## Self-Check: PASSED

- FOUND: apps/web/src/components/coach/ClientTabStrip.tsx
- FOUND: apps/web/src/components/coach/videos/ClientNotesPanelConditional.tsx
- FOUND: apps/web/src/app/[locale]/(coach)/coach/clients/[id]/videos/page.tsx
- FOUND: apps/web/src/components/coach/videos/VideoListClient.tsx
- Commit 0505217: exists (Task 1)
- Commit 35ec49f: exists (Task 2)
- tsc --noEmit: exits 0
