---
phase: 05-response-viewer
plan: "02"
subsystem: web-coach-crm
tags: [forms, response-viewer, accordion, tab-strip, status-badge]
dependency_graph:
  requires: [05-01]
  provides: [RESPONSES-01, RESPONSES-02, RESPONSES-03]
  affects: [apps/web/src/components/coach/ClientTabStrip.tsx, apps/web/src/components/coach/FormStatusBadge.tsx]
tech_stack:
  added: []
  patterns: [server-component-fetch, client-accordion, css-transition-expand]
key_files:
  created:
    - apps/web/src/components/coach/FormStatusBadge.tsx
    - apps/web/src/app/[locale]/(coach)/coach/clients/[id]/forms/page.tsx
    - apps/web/src/app/[locale]/(coach)/coach/clients/[id]/forms/ClientFormsContent.tsx
  modified:
    - apps/web/src/components/coach/ClientTabStrip.tsx
decisions:
  - "Used div-based row layout inside a single-td wrapper tr for submitted rows to cleanly support the expand panel without nested table semantics issues"
  - "Local QuestionType in ClientFormsContent uses 'yes_no' (RF-03: API contract) not 'yesno' from FormStatusBadge exports to avoid type mismatch"
  - "Worktree ClientTabStrip.tsx synced from dev branch (11 tabs) before adding the 12th forms tab"
metrics:
  duration: "~12 minutes"
  completed: "2026-05-28"
  tasks_completed: 2
  files_changed: 4
---

# Phase 05 Plan 02: Forms Tab — Response Viewer Summary

**One-liner:** Formulaires tab with server-fetch, accordion Q&A transcript, submitted/pending badge variants using CSS max-height transitions.

---

## What Was Built

Four files were created/modified to deliver the "Formulaires" tab in the coach client detail sheet:

1. **ClientTabStrip.tsx** — Added `{ key: 'forms', label: 'Formulaires' }` as the 12th tab entry (after `videos`). Also synced the worktree with the dev branch version (which included dashboard, vocal, and videos tabs that were missing from the worktree's older version).

2. **FormStatusBadge.tsx** — Created in the worktree (file existed on dev branch but not in the worktree). Extended the `FormStatusBadgeProps.status` union from `'draft' | 'active' | 'archived'` to include `'submitted' | 'pending'`. Added STATUS_CONFIG entries: `submitted` (green #DCFCE7/#16A34A, label "Soumis") and `pending` (amber #FEF3C7/#D97706, label "En attente"). Types on lines 1–30 (QuestionType, FormQuestion, TriggerType, TriggerConfig, CoachForm) left unchanged.

3. **forms/page.tsx** — Server component following programs/page.tsx pattern. Auth guard via `getCachedCoachUser()`. Fetches `GET /coach/clients/:clientId/forms` with `Authorization: Bearer {jwt}`. Graceful fallback `{ forms: [] }` on error or missing JWT. Renders `<ClientFormsContent forms={formsData.forms} locale={locale} />`.

4. **ClientFormsContent.tsx** — Client component with `'use client'` directive. `expandedInstanceId: string | null` state (single accordion). Sorts submitted rows by `submitted_at DESC`, pending rows at bottom. Four rendered states: empty (IoDocumentTextOutline + heading), populated (table), expanded Q&A panel (CSS transition), pending-only note. `formatAnswerValue()` maps scale→`N / 10`, yes_no→`Oui`/`Non`, text/choice→raw string. `TYPE_LABELS` record for type chips. CSS expand transitions: 200ms ease-out open, 150ms ease-in close.

---

## Acceptance Criteria Met

- [x] ClientTabStrip TABS array contains `{ key: 'forms', label: 'Formulaires' }` as 12th entry
- [x] FormStatusBadge accepts `'submitted'` and `'pending'` status values
- [x] STATUS_CONFIG submitted: `bg-[#DCFCE7] text-[#16A34A]` label "Soumis"
- [x] STATUS_CONFIG pending: `bg-[#FEF3C7] text-[#D97706]` label "En attente"
- [x] Exported types on lines 1–30 of FormStatusBadge.tsx unchanged
- [x] forms/page.tsx exists with `export default async function ClientFormsPage`
- [x] page.tsx contains `getCachedCoachUser()` auth guard
- [x] page.tsx fetches with `Authorization: Bearer` header
- [x] page.tsx renders `<ClientFormsContent forms={formsData.forms} locale={locale} />`
- [x] ClientFormsContent.tsx has `'use client'` directive
- [x] `type QuestionType = 'text' | 'scale' | 'yes_no' | 'choice'` (RF-03 compliant)
- [x] `useState<string | null>(null)` for expandedInstanceId
- [x] `formatAnswerValue` with scale, yes_no, default branches
- [x] `TYPE_LABELS` record with all 4 keys
- [x] Empty state with IoDocumentTextOutline and "Aucun formulaire pour ce client"
- [x] Pending-only note conditional on `sorted.every(f => f.status === 'pending')`
- [x] TypeScript compilation zero errors in all 4 files (pre-existing VocalReview.test.tsx error is unrelated)

---

## Deviations from Plan

**1. [Rule 1 - Bug] ClientTabStrip.tsx worktree was behind dev branch**
- **Found during:** Task 1
- **Issue:** The worktree had an 8-tab TABS array (missing dashboard, vocal, videos tabs added in earlier phases). Simply appending 'forms' after a non-existent 'videos' entry would break the tab order.
- **Fix:** Synced the file with the dev branch version (11 tabs) before adding the 12th 'forms' tab.
- **Files modified:** `apps/web/src/components/coach/ClientTabStrip.tsx`
- **Commit:** b0d3b59

**2. [Rule 3 - Blocking] FormStatusBadge.tsx missing from worktree**
- **Found during:** Task 1
- **Issue:** The file existed on dev branch (Phase 03 commit) but was not present in the worktree. Both tasks depend on it.
- **Fix:** Created the file in the worktree using the dev branch content, then applied the Phase 05 extensions.
- **Files modified:** `apps/web/src/components/coach/FormStatusBadge.tsx`
- **Commit:** b0d3b59

**3. [Design] Submitted rows use wrapper td + div layout instead of React.Fragment with tr pairs**
- **Found during:** Task 2
- **Issue:** The plan described using React.Fragment with pairs of tr elements (row + expand tr). However, the expand panel for submitted rows contains a div (non-tr content), making it cleaner to wrap in a single `<td colSpan={4}>` wrapper. This avoids invalid HTML (content directly in tbody outside tr).
- **Fix:** Each submitted form renders as a single `<tr>` with `<td colSpan={4}>` containing both the row header div and the expand panel div. Pending rows are standard `<tr>` elements.
- **Impact:** Visually identical to spec. Table semantics are valid. Accordion behavior unchanged.

---

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| Task 1 | b0d3b59 | feat(05-02): extend ClientTabStrip and FormStatusBadge |
| Task 2 | a328afe | feat(05-02): create forms/page.tsx server component and ClientFormsContent.tsx |

---

## Known Stubs

None — all data flows from the API response via server fetch. No hardcoded empty arrays, no placeholder text in the data path.

---

## Threat Flags

None — no new network endpoints, auth paths, file access patterns, or schema changes. The forms/page.tsx server fetch is gated behind `if (jwt)` (T-05-04 mitigated). ClientFormsContent is read-only with no mutations (T-05-05 accepted).

---

## Self-Check: PASSED

- FOUND: apps/web/src/components/coach/ClientTabStrip.tsx
- FOUND: apps/web/src/components/coach/FormStatusBadge.tsx
- FOUND: apps/web/src/app/[locale]/(coach)/coach/clients/[id]/forms/page.tsx
- FOUND: apps/web/src/app/[locale]/(coach)/coach/clients/[id]/forms/ClientFormsContent.tsx
- FOUND commit b0d3b59 (Task 1)
- FOUND commit a328afe (Task 2)
