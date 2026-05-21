---
phase: 28-ai-file-imports
plan: "07"
subsystem: mobile-import-screen
tags: [mobile, expo, ai-programs, file-import, reanimated]
dependency_graph:
  requires: [28-04]
  provides: [mobile-import-screen, import-route]
  affects: [plugins/ai-programs, apps/mobile]
tech_stack:
  added: []
  patterns: [expo-document-picker, XMLHttpRequest-upload-progress, reanimated-v3-animations, signed-url-upload]
key_files:
  created:
    - plugins/ai-programs/src/screens/ImportFileScreen.tsx
    - apps/mobile/app/(app)/(plugins)/ai-programs/import.tsx
  modified:
    - plugins/ai-programs/src/manifest.ts
    - plugins/ai-programs/package.json
decisions:
  - "Réviser les détails button shows showAlert (mobile web redirect) — deep editing deferred to web per plan spec"
  - "XHR used for upload (not fetch) to get real upload progress events"
  - "package.json exports updated to expose ImportFileScreen — blocking fix (Rule 3)"
metrics:
  duration: "~15 minutes"
  completed: "2026-05-21T14:12:49Z"
  tasks_completed: 3
  tasks_total: 3
  files_created: 2
  files_modified: 2
requirements:
  - IMPORT-01
  - IMPORT-04
  - IMPORT-05
  - IMPORT-06
---

# Phase 28 Plan 07: Mobile Import Screen Summary

Mobile athlete import screen delivering the full 5-state file import flow (idle → uploading → parsing → result → failed) inside the ai-programs plugin with Reanimated v3 animations.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Update ai-programs manifest with import route | d0fb77b | plugins/ai-programs/src/manifest.ts |
| 2 | Build ImportFileScreen.tsx with all 5 states | 91be049 | plugins/ai-programs/src/screens/ImportFileScreen.tsx |
| 3 | Create thin Expo Router wrapper import.tsx | ce3874b | apps/mobile/app/(app)/(plugins)/ai-programs/import.tsx, plugins/ai-programs/package.json |

## What Was Built

`ImportFileScreen.tsx` (1042 lines) implements the full mobile athlete import flow:

- **Idle state** — upload card with cloud-upload-outline icon, CTA button with press-scale animation, credit cost card, format chips
- **Uploading state** — XHR-based upload with real `onprogress` events feeding an animated Reanimated progress bar, cancel support via `xhr.abort()`
- **Parsing state** — rotating sparkles-outline icon (3s loop via `withRepeat`), slow-fill progress bar (0.2→0.85 over 55s) with opacity pulse, elapsed MM:SS timer
- **Result state** — confidence banner (green/amber/red per threshold), 3-column stats row with count-up animations, editable program name input, Valider/Réviser buttons
- **Failed state** — shake animation on mount, error message from API, Réessayer l'analyse (re-POST parse) and Choisir un autre fichier (full reset) buttons

## Key Decisions

- **XHR for upload progress** — `fetch()` does not expose `upload.onprogress`; XMLHttpRequest provides real bytes-loaded progress events for the uploading state bar
- **Réviser les détails** shows a `showAlert` redirecting to web — deep structural editing on mobile is out of Phase 28 scope (per CONTEXT.md Claude's Discretion)
- **Polling cleanup** — both polling interval and elapsed timer intervals are cleared in `useEffect` cleanup functions and on state transitions to prevent memory leaks

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Missing package.json export for ImportFileScreen**
- **Found during:** Task 3 — TypeScript reported `Cannot find module '@ziko/plugin-ai-programs/screens/ImportFileScreen'`
- **Issue:** The `package.json` `exports` map only listed `AIProgramsDashboard` and `GenerateProgram`; the new screen was not exported, preventing the route wrapper from resolving it
- **Fix:** Added `"./screens/ImportFileScreen": "./src/screens/ImportFileScreen.tsx"` to exports
- **Files modified:** `plugins/ai-programs/package.json`
- **Commit:** ce3874b

## Known Stubs

None — all state transitions wire to real API endpoints (`/coach/imports`, `/coach/imports/:id/status`, `/coach/imports/:id/parse`, `/coach/imports/:id`, `/coach/imports/:id/commit`). Backend provided by plan 28-04.

## Threat Flags

None — no new network endpoints or auth paths introduced. The screen uses existing `/coach/imports` backend from plan 28-04 with standard Bearer token auth.

## Self-Check: PASSED

- [x] `plugins/ai-programs/src/screens/ImportFileScreen.tsx` — exists
- [x] `apps/mobile/app/(app)/(plugins)/ai-programs/import.tsx` — exists
- [x] `plugins/ai-programs/src/manifest.ts` — contains `cloud-upload-outline` and `/(plugins)/ai-programs/import`
- [x] d0fb77b — confirmed in git log
- [x] 91be049 — confirmed in git log
- [x] ce3874b — confirmed in git log
- [x] TypeScript: no errors on ImportFileScreen or import route
- [x] showAlert used (6 calls), no Alert.alert
- [x] paddingBottom: 100 on ScrollView
- [x] All 5 states render conditionally
- [x] fetch(asset.uri).blob() pattern used for upload
- [x] setInterval polling cleared on unmount
