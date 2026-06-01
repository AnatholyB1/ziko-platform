---
phase: 03-ai-classification-chat
reviewed: 2026-05-31T00:00:00Z
depth: standard
files_reviewed: 3
files_reviewed_list:
  - apps/web/src/components/coach/WizardStep4Import.tsx
  - apps/web/messages/fr.json
  - apps/web/messages/en.json
findings:
  critical: 0
  warning: 3
  info: 2
  total: 5
status: issues_found
---

# Phase 03: Code Review Report (Re-Review)

**Reviewed:** 2026-05-31T00:00:00Z
**Depth:** standard
**Files Reviewed:** 3
**Status:** issues_found

## Summary

Re-review after 8 prior fixes (CR-01 through WR-05). All previously-reported fixes have landed correctly: null confidence routes to the ambiguous bucket, polling is inline capturing fresh jwt/apiUrl, ChatMessage has stable UUID keys, the 4-file cap guard is inside the functional updater, the server status cast is validated via VALID_FILE_STATUSES, all API error paths use the t('step4ErrorServer') key, userId was removed from the runPipeline dependency array, and polling uses `> MAX_ATTEMPTS`. i18n key parity between en.json and fr.json is clean.

Three new warnings and two info items were found. The most impactful is WR-01: `canAdvance` gates on "at least one ready file has a docType" while ignoring files still in `uploading` or `parsing` state, allowing the user to advance mid-pipeline and silently abandon in-progress uploads.

---

## Warnings

### WR-01: `canAdvance` ignores files still in `uploading`/`parsing` — user can advance mid-pipeline

**File:** `apps/web/src/components/coach/WizardStep4Import.tsx:68-72`

**Issue:** `canAdvance` evaluates to `true` as soon as at least one file is `ready` with a confirmed `docType`, without requiring all other files to reach a terminal state. Scenario: user drops two files; the first completes classification (`ready`, docType set) while the second is still `parsing`. `canAdvance` becomes `true` and the Continue button appears. When the user clicks it, `onSuccess` fires, the wizard advances, and the component unmounts. The cleanup effect at line 75 aborts the second file's controller and clears its polling interval, but the second file was never persisted as `ready` on the server — the user silently loses it with no error message.

**Fix:** Require every file to have reached a terminal state before enabling advance:

```ts
const canAdvance =
  fileStates.length > 0 &&
  fileStates.every(
    (f) =>
      f.status === 'failed' ||
      (f.status === 'ready' && Boolean(f.docType) && !f.clarificationPending),
  ) &&
  fileStates.some((f) => f.status === 'ready');
```

---

### WR-02: Catch blocks do not guard against `AbortError` — state mutation on intentional cancellation

**File:** `apps/web/src/components/coach/WizardStep4Import.tsx:122-130, 149-157, 179-186, 212-219`

**Issue:** When `removeFile(id)` is called while `runPipeline` is mid-flight, `controller.abort()` fires (line 381), causing the active `fetch()` to throw a `DOMException` with `name === 'AbortError'`. None of the four catch blocks in `runPipeline` (steps 1–4) check for `AbortError` before proceeding. Each catch calls `setFileStates` to mark the file as `failed`, racing with `removeFile`'s own `setFileStates` filter call. Under React 18 concurrent mode the ordering of these two updates is not guaranteed: the `failed` map can be applied after the filter, causing the removed file to transiently re-appear with status `failed`. Additionally, if the timing works out, the raw `DOMException.message` ("The user aborted a request." or browser equivalent) is rendered in the error display at lines 537–540.

**Fix:** Add an `AbortError` guard at the top of every catch block in `runPipeline`:

```ts
} catch (err) {
  if (err instanceof DOMException && err.name === 'AbortError') return;
  const msg = err instanceof Error ? err.message : 'Network error';
  setFileStates((prev) =>
    prev.map((f) =>
      f.id === fileId ? { ...f, status: 'failed', errorMessage: msg } : f,
    ),
  );
  return;
}
```

Apply this guard at lines 122, 149, 179, and 212.

---

### WR-03: `file.type` is empty string for `.xlsx`/`.xls` in most browsers

**File:** `apps/web/src/components/coach/WizardStep4Import.tsx:102, 138`

**Issue:** In Chrome, Firefox, and Safari on both Windows and macOS, `File.type` is an empty string for `.xlsx` and `.xls` files — the browser does not reliably populate MIME type for these extensions. This causes two concrete problems:

1. Line 102: `mime_type: fileState.file.type` sends `mime_type: ""` in the import creation request. If the server uses this field to determine parse strategy, it will receive no useful type hint for Excel files.
2. Line 138: `headers: { 'Content-Type': fileState.file.type }` sends `Content-Type: ""` to the signed storage URL. S3 and GCS signed upload URLs that encode an expected `Content-Type` in their signature will reject the PUT request if the header does not match, returning a 403. Even without signature enforcement, an empty Content-Type header violates the PUT contract for most storage providers.

**Fix:** Derive a fallback MIME type from the file extension when `file.type` is empty:

```ts
function getMimeType(file: File): string {
  if (file.type) return file.type;
  const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
  const map: Record<string, string> = {
    xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    xls: 'application/vnd.ms-excel',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    pdf: 'application/pdf',
  };
  return map[ext] ?? 'application/octet-stream';
}
```

Replace `fileState.file.type` with `getMimeType(fileState.file)` at both lines 102 and 138.

---

## Info

### IN-01: British English spellings in `en.json` ("analysed", "programme") — carried from previous pass

**File:** `apps/web/messages/en.json:154-155, 157`

**Issue:** Three string values use British English spellings that are inconsistent with the rest of the English locale:
- `step4AiTemplateSummary`: "I **analysed** {name} — it looks like a {weeks}-week **programme**…"
- `step4AiTemplateSummaryShort`: "I **analysed** {name} — it looks like a {weeks}-week **programme**."
- `step4AiAmbiguous`: "Is it a **programme** template or a coaching DA?"

These strings are rendered in user-visible AI chat bubbles.

**Fix:** Standardize to American English: `analysed` → `analyzed`, `programme` → `program` in all three values.

---

### IN-02: Raw network error messages from catch blocks reach the UI

**File:** `apps/web/src/components/coach/WizardStep4Import.tsx:123, 150, 180, 213`

**Issue:** The four catch blocks for network-level errors (steps 1–4) set `errorMessage` to `err.message`. For real network failures this produces browser-generated strings such as "Failed to fetch", "NetworkError when attempting to fetch resource", or "Load failed" — none of which are localized or user-friendly. These strings are rendered directly in the file list error row (lines 537–540). The `step4ErrorServer` i18n key is already used for HTTP non-2xx responses but not for thrown errors, creating an inconsistency.

**Fix:** Replace `err.message` with `t('step4ErrorServer')` in all four catch blocks to maintain consistency with the HTTP error path and avoid leaking browser-internal error strings. (This fix also becomes mandatory when WR-02's AbortError guard is added, since the guard returns early and the remaining path should always produce a localized message.)

---

_Reviewed: 2026-05-31T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
