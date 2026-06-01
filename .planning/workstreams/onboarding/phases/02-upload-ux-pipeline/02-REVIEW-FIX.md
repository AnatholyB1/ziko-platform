---
phase: 02-upload-ux-pipeline
fixed_at: 2026-05-30T00:00:00Z
review_path: .planning/workstreams/onboarding/phases/02-upload-ux-pipeline/02-REVIEW.md
iteration: 1
findings_in_scope: 9
fixed: 7
skipped: 2
status: partial
skipped_findings:
  - id: CR-01
    reason: intentional_stub
    note: "onSuccess not called by design — per D-17, Phase 3 decides when to advance (documented in 02-02-SUMMARY.md)"
  - id: CR-02
    reason: intentional_stub
    note: "userId not sent to API by design — user auth flows via JWT, not userId in body (documented in 02-02-SUMMARY.md)"
---

# Phase 02: Code Review Fix Report

**Fixed at:** 2026-05-30
**Source review:** .planning/workstreams/onboarding/phases/02-upload-ux-pipeline/02-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 9 (CR-01, CR-02, CR-03, WR-01–WR-06)
- Fixed: 7
- Skipped: 2 (intentional design stubs per 02-02-SUMMARY.md)

---

## Skipped Issues (By Design)

### CR-01 — onSuccess never called

**File:** `apps/web/src/components/coach/WizardStep4Import.tsx`
**Reason:** Intentional stub per D-17. The 02-02-SUMMARY.md explicitly documents: "onSuccess prop is accepted but not called — per D-17, Phase 3 decides when to advance." This is by design, not a bug. Phase 3 will wire the auto-advance logic.

### CR-02 — userId prop unused

**File:** `apps/web/src/components/coach/WizardStep4Import.tsx`
**Reason:** Intentional stub. The 02-02-SUMMARY.md explicitly documents: "userId prop is accepted but not used in Phase 2 pipeline calls (user auth flows via JWT, not userId in path)." Not a bug — the backend derives user identity from the Bearer JWT on every request.

---

## Fixed Issues

### CR-03 — File type/size validation on drag-and-drop

**Files modified:** `apps/web/src/components/coach/WizardStep4Import.tsx`
**Commit:** `2f18582`
**Applied fix:** Added `ALLOWED_EXTENSIONS` (`Set(['pdf', 'xlsx', 'xls', 'docx'])`) and `MAX_FILE_BYTES` (5 MB) as module-level constants above `StatusPill`. Updated `handleFiles` to filter the incoming `FileList` against both constraints before creating `FileState` entries. Invalid file types and oversized files are now silently dropped (they never enter the upload pipeline) rather than being blindly sent to the API.

### WR-01 — Polling timeout after 3 minutes

**Files modified:** `apps/web/src/components/coach/WizardStep4Import.tsx`
**Commit:** `3920de7`
**Applied fix:** Added `attempts` counter and `MAX_ATTEMPTS = 60` (3 min at 3s interval) to `startPolling`. On each tick, `attempts` is incremented with safe arithmetic (`attempts = attempts + 1`). When the counter reaches the limit, the interval is cleared and the file state is set to `failed` with `errorMessage: 'Timeout'`, preventing the interval from running indefinitely on a broken backend.

### WR-02 — Abort in-flight uploads on file removal

**Files modified:** `apps/web/src/components/coach/WizardStep4Import.tsx`
**Commit:** `6312dc8`
**Applied fix:** Added `abortControllersRef` (`useRef<Map<string, AbortController>>`). In `runPipeline`, an `AbortController` is created at the start and stored per `fileId`. Its `signal` is passed to all 4 pipeline `fetch` calls (Steps 1–4; not to polling intervals). In `removeFile`, `controller?.abort()` is called before removing the entry, cancelling any in-flight network request. The cleanup `useEffect` also aborts and clears all controllers on unmount.

### WR-03 — Stale closure on runPipeline

**Files modified:** `apps/web/src/components/coach/WizardStep4Import.tsx`
**Commit:** `8e19772`
**Applied fix:** Added `useCallback` to the React import. Converted `runPipeline` from a plain `async function` declaration to a `useCallback`-wrapped arrow function with deps `[jwt, apiUrl, userId]`. Updated the pipeline trigger `useEffect` to include `runPipeline` in its deps array and removed the `// eslint-disable-next-line react-hooks/exhaustive-deps` suppression comment. JWT token refreshes will now produce a new stable `runPipeline` reference that new pipeline runs will use.

### WR-04 — Raw server error text in UI

**Files modified:** `apps/web/src/components/coach/WizardStep4Import.tsx`, `apps/web/messages/fr.json`, `apps/web/messages/en.json`
**Commit:** `5255074`
**Applied fix:** In all 4 `if (!res.ok)` branches in `runPipeline` (Steps 1–4), replaced `const errText = await res.text()` with `const errText = res.status >= 500 ? t('step4ErrorServer') : await res.text()`. 5xx responses now show a generic localized message instead of raw server internals; 4xx responses still surface the (actionable) server text. Added `"step4ErrorServer"` key to both locale files: `"Erreur serveur. Veuillez réessayer."` (fr) and `"Server error. Please try again."` (en).

### WR-05 — French byte units in formatBytes

**Files modified:** `apps/web/src/components/coach/WizardStep4Import.tsx`, `apps/web/messages/fr.json`, `apps/web/messages/en.json`
**Commit:** `c505cdf`
**Applied fix:** Replaced hardcoded `"o"`, `"Ko"`, `"Mo"` literals in `formatBytes` with `t('unitBytes')`, `t('unitKB')`, `t('unitMB')`. Added the three unit keys to both locale files: `"o"/"Ko"/"Mo"` in fr.json and `"B"/"KB"/"MB"` in en.json under the `Onboarding` namespace.

### WR-06 — Missing Content-Type on parse trigger POST

**Files modified:** `apps/web/src/components/coach/WizardStep4Import.tsx`
**Commit:** `8e00524`
**Applied fix:** Added `'Content-Type': 'application/json'` to the headers object of the `POST /coach/imports/${importId}/parse` fetch call (Step 4). This aligns it with Steps 1 and 3 and prevents potential 415 rejections from Hono middleware that matches on content type.

---

_Fixed: 2026-05-30_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
