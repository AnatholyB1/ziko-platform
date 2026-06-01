---
phase: 03-ai-classification-chat
fixed_at: 2026-05-30T00:00:00Z
review_path: .planning/workstreams/onboarding/phases/03-ai-classification-chat/03-REVIEW.md
iteration: 2
findings_in_scope: 5
fixed: 5
skipped: 0
status: all_fixed
---

# Phase 03: Code Review Fix Report

**Fixed at:** 2026-05-30T00:00:00Z
**Source review:** `.planning/workstreams/onboarding/phases/03-ai-classification-chat/03-REVIEW.md`
**Iteration:** 2

**Summary:**
- Findings in scope: 5 (3 Warning + 2 Info; fix_scope=all)
- Fixed: 5
- Skipped: 0

## Fixed Issues

### WR-01: `canAdvance` ignores files still in `uploading`/`parsing`

**Files modified:** `apps/web/src/components/coach/WizardStep4Import.tsx`
**Commit:** 6c66e68
**Applied fix:** Replaced the `canAdvance` expression (lines 68-72). Previously it evaluated to `true` as soon as at least one ready file had a confirmed `docType`, allowing the user to advance while other files were still in `uploading` or `parsing` state. The new expression requires every file to be in a terminal state (`failed`, or `ready` with `Boolean(f.docType) && !f.clarificationPending`), plus at least one file must be `ready`. This prevents silently abandoning in-progress uploads when the wizard advances.

### WR-02: Catch blocks do not guard against `AbortError`

**Files modified:** `apps/web/src/components/coach/WizardStep4Import.tsx`
**Commit:** 829b75d
**Applied fix:** Added `if (err instanceof DOMException && err.name === 'AbortError') return;` as the first statement in all four catch blocks in `runPipeline` (steps 1–4). This prevents the removed-file `failed` state update from racing with the `removeFile` filter call under React 18 concurrent mode when the user removes a file mid-pipeline. Combined with IN-02 fix in the same commit (see below).

### IN-02: Raw network error messages from catch blocks reach the UI

**Files modified:** `apps/web/src/components/coach/WizardStep4Import.tsx`
**Commit:** 829b75d
**Applied fix:** Replaced `const msg = err instanceof Error ? err.message : '...'` with `const msg = t('step4ErrorServer')` in all four catch blocks. Network-level errors now use the same localized `step4ErrorServer` key as HTTP non-2xx responses, preventing browser-internal strings such as "Failed to fetch" from appearing in the file list error row.

### WR-03: `file.type` is empty string for `.xlsx`/`.xls`

**Files modified:** `apps/web/src/components/coach/WizardStep4Import.tsx`
**Commit:** f4c4f88
**Applied fix:** Added a `getMimeType(file: File): string` helper function at module level (after `VALID_FILE_STATUSES`). Returns `file.type` when non-empty; otherwise derives MIME type from the file extension using a lookup map covering xlsx, xls, docx, and pdf, with `application/octet-stream` as fallback. Replaced both `fileState.file.type` usages with `getMimeType(fileState.file)`: the `mime_type` field in the import creation POST body (step 1) and the `Content-Type` header in the signed URL PUT request (step 2).

### IN-01: British English spellings in `en.json`

**Files modified:** `apps/web/messages/en.json`
**Commit:** b8d6c56
**Applied fix:** Standardized three AI chat bubble string values to American English: `analysed` → `analyzed` and `programme` → `program` in `step4AiTemplateSummary`, `step4AiTemplateSummaryShort`, and `step4AiAmbiguous`.

---

_Fixed: 2026-05-30T00:00:00Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 2_
