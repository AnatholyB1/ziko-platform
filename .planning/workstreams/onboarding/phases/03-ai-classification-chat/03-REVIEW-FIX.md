---
phase: 03-ai-classification-chat
fixed_at: 2026-05-30T00:00:00Z
review_path: .planning/workstreams/onboarding/phases/03-ai-classification-chat/03-REVIEW.md
iteration: 1
fix_scope: critical_warning
findings_in_scope: 8
fixed: 8
skipped: 0
status: all_fixed
---

# Phase 03: Code Review Fix Report

**Fixed at:** 2026-05-30
**Source review:** `.planning/workstreams/onboarding/phases/03-ai-classification-chat/03-REVIEW.md`
**Iteration:** 1

**Summary:**
- Findings in scope: 8 (3 Critical + 5 Warning; 1 Info excluded from scope)
- Fixed: 8
- Skipped: 0

---

## Fixed Issues

### CR-01: Missing confidence score auto-classifies as `da_coach` instead of ambiguous

**Files modified:** `apps/web/src/components/coach/WizardStep4Import.tsx`
**Commit:** `046a8e9`
**Applied fix:** Split the original `if (confidence == null || confidence < 0.4)` branch into two separate branches. The `null` case now routes to the ambiguous bucket (sets `clarificationPending: true`, pushes `ia-ambiguous` chat message). The `< 0.4` case (low confidence) now explicitly classifies as `da_coach`. The boundary logic now matches the intent described in the review.

---

### CR-02: Race condition allows exceeding 4-file cap on rapid drops

**Files modified:** `apps/web/src/components/coach/WizardStep4Import.tsx`
**Commit:** `4465131`
**Applied fix:** Moved the `remaining = 4 - fileStates.length` computation and the `toAdd` slice inside the `setFileStates` functional updater. The updater now reads `prev.length` (authoritative current length) so concurrent state update batches correctly enforce the cap even under rapid successive file drops.

---

### CR-03: Unchecked cast of server status crashes `StatusPill`

**Files modified:** `apps/web/src/components/coach/WizardStep4Import.tsx`
**Commit:** `7d5d76c`
**Applied fix:** Added `const VALID_FILE_STATUSES = new Set<string>(['uploading', 'parsing', 'ready', 'failed'])` at module level. In the polling else-branch, replaced `importRow.status as FileStatus` with a validated cast: unknown statuses fall back to `'failed'` instead of crashing `StatusPill`'s config lookup.

---

### WR-01: Raw server error text surfaced to users

**Files modified:** `apps/web/src/components/coach/WizardStep4Import.tsx`
**Commit:** `e7ad7ba`
**Applied fix:** Replaced all four occurrences of `res.status >= 500 ? t('step4ErrorServer') : await res.text()` (one per pipeline step) with `t('step4ErrorServer')` unconditionally. All API error paths now use the i18n key, removing raw server text from user-visible output.

---

### WR-02: `startPolling` stale closure over `jwt`/`apiUrl`

**Files modified:** `apps/web/src/components/coach/WizardStep4Import.tsx`
**Commit:** `1a03d4e`
**Applied fix:** Removed the standalone `startPolling` function and moved all polling logic inline at the end of `runPipeline`'s `useCallback`. The inline closure captures `jwt`, `apiUrl`, and `t` from the same closure as the rest of the pipeline, ensuring consistency if any of those values change. Updated `runPipeline`'s deps to `[jwt, apiUrl, t]`. This also resolves WR-04 and WR-05 (see below).

---

### WR-03: Array index used as React key in chat message list

**Files modified:** `apps/web/src/components/coach/WizardStep4Import.tsx`
**Commit:** `c4d8764`
**Applied fix:** Added `id: string` to all five `ChatMessage` union variants. Added `id: crypto.randomUUID()` to each `setChatMessages` push site (6 total: 2 in confidence null branch, 1 for da_coach, 1 for template, 1 each in `handleClarification`). Updated the `.map((msg, i) =>` to `.map((msg) =>` and replaced all `key={\`${msg.fileId}-${i}\`}` with `key={msg.id}`.

---

### WR-04: `userId` unused in `runPipeline` dependency array

**Files modified:** `apps/web/src/components/coach/WizardStep4Import.tsx`
**Commit:** `1a03d4e` (resolved as part of WR-02)
**Applied fix:** When `runPipeline` was rewritten to inline the polling logic, the deps were set to `[jwt, apiUrl, t]`. `userId` was not included since it is not referenced anywhere inside `runPipeline`.

---

### WR-05: Off-by-one in polling max attempts check

**Files modified:** `apps/web/src/components/coach/WizardStep4Import.tsx`
**Commit:** `1a03d4e` (resolved as part of WR-02)
**Applied fix:** When the polling logic was moved inline, the timeout check was written as `if (attempts > MAX_ATTEMPTS)` (strict greater-than), allowing exactly 60 poll requests before timing out, matching the "3 min at 3s interval" comment.

---

## Skipped Issues

None — all 8 in-scope findings were fixed.

---

_Fixed: 2026-05-30_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
