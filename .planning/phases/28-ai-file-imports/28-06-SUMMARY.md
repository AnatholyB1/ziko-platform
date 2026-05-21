---
phase: 28-ai-file-imports
plan: "06"
subsystem: web-coach-imports
tags: [web, imports, preview, editor, diff-view, gsap, coach]
dependency_graph:
  requires: [28-04]
  provides: [coach-imports-preview-page]
  affects: [apps/web]
tech_stack:
  added: [gsap@3.15.0]
  patterns: [force-dynamic-ssr, polling-client-component, gsap-animations, inline-editing, client-side-diff]
key_files:
  created:
    - apps/web/src/app/[locale]/(coach)/coach/imports/[id]/page.tsx
    - apps/web/src/app/[locale]/(coach)/coach/imports/[id]/PreviewClient.tsx
  modified:
    - apps/web/package.json
decisions:
  - "Used inline `any` cast (with eslint-disable comment) for dynamic ParsedExercise field update — index signature not worth adding to interface for a single write path"
  - "Diff algorithm is client-side: match by week_number → session name → exercise name; no library dependency"
  - "Polling for re-upload parse uses a local setInterval (not shared with the main parsing state polling) — avoids state collision when original import is 'ready'"
metrics:
  duration: "16 minutes"
  completed: "2026-05-21"
  tasks_completed: 2
  files_created: 2
  files_modified: 1
---

# Phase 28 Plan 06: Parse Preview & Editor Summary

**One-liner:** Parse preview page with GSAP-animated progress bar, full structural editor with confidence highlighting, and client-side diff view for re-uploads.

## Tasks Completed

| # | Task | Commit | Key Files |
|---|------|--------|-----------|
| 1 | Create page.tsx Server Component for /coach/imports/[id] | 80e8cd7 | page.tsx |
| 2 | Build PreviewClient.tsx — all states + weeks accordion + diff view | 3f880ed | PreviewClient.tsx, package.json |

## What Was Built

### Task 1: page.tsx (Server Component)
- `export const dynamic = 'force-dynamic'` + `export const revalidate = 0`
- Props accept Next.js 15 async params: `{ params: Promise<{ locale, id }> }`
- Auth guard via `createServerSupabase()` → redirect to `/login` if no session
- Fetches `GET ${apiUrl}/coach/imports/${id}` with Bearer JWT + `cache: 'no-store'`
- Redirects to `/coach/imports` on 404, 403, error, or missing data
- Passes `importRow`, `locale`, `accessToken`, `apiUrl` to PreviewClient

### Task 2: PreviewClient.tsx ('use client')
**State machine over `ImportRow.status`:**

- **Parsing / pending / uploaded state:** GSAP progress bar fill 10%→90% over 55s with `ease: 'none'`, then opacity pulse loop. Elapsed timer via `setInterval`. 2-second polling via `setInterval`; stops automatically on `ready` or `failed`. Cancel button stops polling only.

- **Failed state:** GSAP keyframes shake on mount (`[-8, 8, -6, 6, -3, 3, 0]`). Error card with #FEE2E2 background and 4px #EF4444 left border. Displays `error_message` from API or generic fallback. Credit note italic. Two buttons: retry (POST /parse) + change file (navigate to /coach/imports).

- **Ready state (editor):**
  - `OverallConfidenceBanner` — green/amber/red per confidence thresholds (0.8 / 0.5)
  - Weeks accordion: all closed by default, GSAP `from({ height:0, opacity:0 })` on expand
  - Session cards within weeks with exercise tables
  - Inline-editable inputs: focus → `border: 2px solid #FF5C1A`; blur saves to `editedProgram` state
  - Yellow `#FEF9C3` background on cells where `confidence < 0.70` AND field not yet edited
  - Hover tooltip: "Confiance: X% — vérifiez cette valeur" with GSAP entrance
  - Add/delete week, session, exercise (all in local state; `window.confirm` for destructive operations per UI-SPEC copy)

- **Diff view:** Triggered by re-upload file selection. Client-side algorithm matches exercises by week_number → session name → exercise name. DiffStatus: `new` (green bg + NEW badge), `removed` (red bg + SUPPRIMÉ badge + strikethrough), `changed` (MODIFIÉ badge + inline old~~→~~new), `unchanged` (opacity 0.6, collapsed if >3 with "tout afficher" toggle). GSAP stagger reveal on diff rows.

- **Committed state:** Success banner with link to /coach/programs.

- **Sticky footer (ready state only):** Hidden file input for re-upload. [Re-upload nouvelle version] outlined + [Créer le template] accent with GSAP press feedback. Commit POSTs to `PUT /coach/imports/:id/commit` → navigates to `/coach/programs` on success.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added gsap to apps/web/package.json**
- **Found during:** Task 2
- **Issue:** `gsap` was not installed in apps/web despite being used by ImportsClient.tsx (plan 05) — TypeScript error TS2307 on `import gsap from 'gsap'`
- **Fix:** Added `"gsap": "^3.15.0"` to apps/web/package.json dependencies; ran `npm install --workspace=apps/web gsap`
- **Files modified:** apps/web/package.json, package-lock.json
- **Commit:** 3f880ed

**2. [Rule 2 - Type Safety] Used `any` cast for dynamic field update**
- **Found during:** Task 2
- **Issue:** TypeScript TS2352 — `ParsedExercise` cannot be cast to `Record<string, unknown>` for dynamic field write
- **Fix:** Used `as any` with eslint-disable comment — cleaner than adding an index signature to the interface for a single internal write path

### Pre-existing Issues (out of scope, not fixed)

- `TS2307 Cannot find module '@/lib/supabase/server'` — affects programs/page.tsx and many other files; pre-existing tsc issue with `moduleResolution: bundler` + `server-only` import. Not introduced by this plan.

## Known Stubs

None — all data is wired to the backend API. The editor uses real `importRow.parsed_data` cast to `ParsedProgram`. Polling uses real API endpoints.

## Threat Surface Scan

No new network endpoints introduced by this plan. The page fetches `GET /coach/imports/:id` (existing route from plan 04) and commits via `PUT /coach/imports/:id/commit` (existing route). RLS enforces owner-only access. T-28-06-02 mitigation (redirect on 404/403) is implemented in page.tsx.

## Self-Check: PASSED

| Item | Status |
|------|--------|
| apps/web/src/app/[locale]/(coach)/coach/imports/[id]/page.tsx | FOUND |
| apps/web/src/app/[locale]/(coach)/coach/imports/[id]/PreviewClient.tsx | FOUND |
| Commit 80e8cd7 (page.tsx) | FOUND |
| Commit 3f880ed (PreviewClient + gsap) | FOUND |
