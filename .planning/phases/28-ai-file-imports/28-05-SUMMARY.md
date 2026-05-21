---
phase: 28-ai-file-imports
plan: "05"
subsystem: web-coach
tags:
  - imports
  - file-upload
  - drag-and-drop
  - gsap
  - server-component
dependency_graph:
  requires:
    - 28-04  # backend /coach/imports routes
  provides:
    - imports-list-page
    - imports-nav-entry
  affects:
    - apps/web/src/components/coach/CoachSidebar.tsx
    - apps/web/src/app/[locale]/(coach)/coach/imports/
tech_stack:
  added: []
  patterns:
    - Next.js Server Component + Client Component split
    - GSAP page entrance + row stagger animations
    - HTML5 drag-and-drop + file picker
    - Polling useEffect with clearInterval cleanup
key_files:
  created:
    - apps/web/src/app/[locale]/(coach)/coach/imports/page.tsx
    - apps/web/src/app/[locale]/(coach)/coach/imports/ImportsClient.tsx
  modified:
    - apps/web/src/components/coach/CoachSidebar.tsx
decisions:
  - CoachSidebar already had Imports entry from prior plan (28-07) — confirmed aligned
  - gsap already declared in apps/web/package.json, just needed npm install to hoist to root
metrics:
  duration: "~17 minutes"
  completed: "2026-05-21"
  tasks_completed: 2
  tasks_total: 2
  files_changed: 3
---

# Phase 28 Plan 05: Imports List Page Summary

**One-liner:** Web coach imports list page with drag-and-drop upload zone, live polling status, and imports table using GSAP animations.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Add Imports entry to CoachSidebar | d0fb77b (pre-existing) | CoachSidebar.tsx |
| 2 | Create page.tsx + ImportsClient.tsx | a28b956 | page.tsx, ImportsClient.tsx |

## What Was Built

### Task 1 — CoachSidebar Imports Entry
The `IoCloudUploadOutline` import and `Imports` nav entry were already present in CoachSidebar.tsx from a prior plan (28-07 pre-commit: d0fb77b). The entry is correctly positioned between `Programmes` and `IA` with `disabled: false`.

### Task 2 — page.tsx (Server Component)
- `export const dynamic = 'force-dynamic'` and `export const revalidate = 0` per Phase 23 D-15
- Auth guard: `createServerSupabase()` → redirect to login if no user
- Session-based JWT extraction → `GET ${apiUrl}/coach/imports` with `cache: 'no-store'`
- Props passed to `<ImportsClient>`: `imports`, `locale`, `accessToken`, `apiUrl`
- `ImportRow` interface exported for downstream use

### Task 2 — ImportsClient.tsx (Client Component)
- `'use client'` + all state management with `useState` / `useRef`
- Drop zone: HTML5 `onDragOver`, `onDragEnter`, `onDragLeave`, `onDrop` events
- `dragOver` state drives `#FF5C1A` border + `#FFF7F4` background per UI-SPEC Screen 1
- Hidden `<input type="file" accept=".pdf,.png,.jpg,.jpeg,.xlsx,.xls,.docx" />`
- Upload flow: POST create import → PUT to signed URL → PUT status=uploaded → POST parse
- 25 MB client-side guard before POST (UX only; server validates, DB has CHECK constraint)
- Polling `useEffect` every 2s for `parsing`/`uploaded` rows using Bearer token (T-28-05-02: RLS enforced owner-only)
- `clearInterval` on unmount

**Imports table (populated state):**
- Columns: Fichier | Format | Statut | Confiance | Crédits | Date | Actions
- Format chips: PDF (yellow), Excel (green), Word (blue), Image (purple)
- Status chips: pending/uploaded/parsing/ready/failed/committed with colors per UI-SPEC Screen 3
- Parsing chip uses `className="animate-pulse"` (Tailwind) + spinning border indicator
- Confidence badge: green ≥0.8, amber 0.5–0.79, red <0.5, muted `—` if null
- Credits: computed from `credit_transaction_id` + `page_count` (min(pages, 10) for PDFs, 1 for others)
- Date: French locale "21 mai 2026, 14h32" format
- Actions: "Voir" with chevron-forward appears on row hover

**Empty state:**
- `IoAlbumsOutline` icon (64px, `#E2E0DA`)
- Copy: "Aucun import pour le moment" + "Vos fichiers importés apparaîtront ici."

**GSAP animations:**
- Page entrance: `.imports-page` fade + slide-up on mount
- Row stagger: `.import-row` when table transitions from empty to populated
- Credit cost info block always visible below drop zone

## Deviations from Plan

### Auto-observed: CoachSidebar already updated
The plan described adding `IoCloudUploadOutline` to CoachSidebar as Task 1. Inspecting the HEAD commit (d0fb77b: feat(28-07)) showed this was already done in a prior plan execution. No action was needed; confirmed correct.

### Rule 3 — gsap package resolution
`gsap` was already declared in `apps/web/package.json` (`"gsap": "^3.12.7"`) but not installed in `apps/web/node_modules/`. Running `npm install` from `apps/web/` resolved the hoisting to root `node_modules`. No package.json change needed.

## Known Stubs

None. All data comes from real API calls. Empty state renders accurately when `imports.length === 0`.

## Pre-existing Issues (Out of Scope)

| File | Error | Status |
|------|-------|--------|
| `apps/web/src/app/[locale]/(coach)/coach/imports/[id]/PreviewClient.tsx` | TS2352: ParsedExercise to Record<string,unknown> cast | Pre-existing from plan 28-06, deferred |
| `apps/web/test/safe-next.spec.ts` | TS2339: safeNext not on login actions | Pre-existing, out of scope |

These are logged to deferred-items.md scope.

## Threat Surface Scan

No new trust boundaries beyond those declared in the plan's threat model:
- `browser → POST /coach/imports`: server-side MIME validation + size_bytes check handles real validation
- `browser → Supabase Storage`: signed URL is time-limited, path-scoped per D-21
- Polling calls use Bearer token; RLS on `ai_imports` enforces owner-only access (T-28-05-02 mitigated)

## Self-Check: PASSED

- [x] `apps/web/src/app/[locale]/(coach)/coach/imports/page.tsx` exists
- [x] `apps/web/src/app/[locale]/(coach)/coach/imports/ImportsClient.tsx` exists
- [x] Commit a28b956 exists
- [x] CoachSidebar.tsx has IoCloudUploadOutline (commit d0fb77b)
- [x] TypeScript compiles files without errors (gsap module resolved)
