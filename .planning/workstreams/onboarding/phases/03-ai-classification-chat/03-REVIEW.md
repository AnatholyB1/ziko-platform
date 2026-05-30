---
phase: 03-ai-classification-chat
reviewed: 2026-05-30T00:00:00Z
depth: standard
files_reviewed: 3
files_reviewed_list:
  - apps/web/src/components/coach/WizardStep4Import.tsx
  - apps/web/messages/fr.json
  - apps/web/messages/en.json
findings:
  critical: 3
  warning: 5
  info: 1
  total: 9
status: issues_found
---

# Phase 03: Code Review Report

**Reviewed:** 2026-05-30T00:00:00Z
**Depth:** standard
**Files Reviewed:** 3
**Status:** issues_found

## Summary

The implementation covers the file-import wizard step (WizardStep4Import) along with both locale files (fr.json, en.json). The component handles a multi-step upload pipeline (create import record → signed URL upload → mark uploaded → trigger parse → poll for result → classify), plus a chat-bubble UI for AI feedback and user clarification.

Three blockers were found. The most serious inverts the confidence classification logic: files with a missing `overall_confidence` score are silently auto-classified as `da_coach` instead of falling into the ambiguous bucket, and the boundary condition between `da_coach` and `template_programme` is logically backwards vs. the comment. Two additional blockers cover a race condition that can push the file count beyond the 4-file cap, and an unchecked status cast that can crash the `StatusPill` component. Five warnings cover raw error text exposure to users, stale closure over `startPolling`, an unstable React key pattern, an unused `useCallback` dependency, and the off-by-one in the polling timeout. One info item flags a spelling inconsistency in the English locale.

---

## Critical Issues

### CR-01: Missing confidence score auto-classifies as `da_coach` instead of ambiguous

**File:** `apps/web/src/components/coach/WizardStep4Import.tsx:261-263`

**Issue:** When `parsed_data` is absent or `overall_confidence` is not present in the server response, `confidence` is `undefined`, which satisfies `confidence == null`. This triggers the first branch, which silently auto-classifies the file as `da_coach` with the comment "Confident: da_coach". A missing confidence score is not a confident classification — it should fall into the ambiguous bucket requiring user clarification. Additionally the boundary semantics are arguably inverted: the first branch fires on `< 0.4` (low confidence), yet the comment and intent appear to treat this as a confident `da_coach` result. If the model returns a score of 0.1 because it found some coach-style text but is mostly unsure, the file is classified as da_coach with no user prompt.

**Fix:**
```typescript
if (confidence == null) {
  // Unknown confidence — treat as ambiguous
  setFileStates((prev) =>
    prev.map((f) =>
      f.id === fileId ? { ...f, status: 'ready', clarificationPending: true } : f,
    ),
  );
  setChatMessages((prev) => [
    ...prev,
    { kind: 'ia-ambiguous', fileId, filename },
  ]);
} else if (confidence < 0.4) {
  // Low confidence for template → classify as da_coach
  setFileStates(...)
  setChatMessages(...)
} else if (confidence >= 0.6) {
  // High confidence for template_programme
  ...
} else {
  // Ambiguous: 0.4 <= confidence < 0.6
  ...
}
```

---

### CR-02: Race condition allows exceeding the 4-file cap on rapid successive drops/selections

**File:** `apps/web/src/components/coach/WizardStep4Import.tsx:348-356`

**Issue:** `handleFiles` computes `remaining = 4 - fileStates.length` using the closure-captured `fileStates` snapshot at call time, then calls `setFileStates((prev) => [...prev, ...newStates])`. If two drop events fire in quick succession before React commits the first state update, both invocations see the same stale `fileStates.length` (e.g., `0`) and both compute `remaining = 4`, allowing up to 8 files to be added. The CSS `pointer-events-none` guard only applies when `isCapHit` is already true at render time and does not protect against this race.

**Fix:** Move the cap guard inside the functional state updater so it reads the authoritative current length:
```typescript
function handleFiles(fileList: FileList | null): void {
  if (!fileList) return;
  const incoming = Array.from(fileList).filter((file) => {
    const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
    return ALLOWED_EXTENSIONS.has(ext) && file.size <= MAX_FILE_BYTES;
  });
  setFileStates((prev) => {
    const remaining = 4 - prev.length;
    if (remaining <= 0) return prev;
    const toAdd = incoming.slice(0, remaining);
    const newStates: FileState[] = toAdd.map((file) => ({
      id: crypto.randomUUID(),
      file,
      status: 'uploading',
    }));
    return [...prev, ...newStates];
  });
}
```

---

### CR-03: Unchecked cast of server `status` to `FileStatus` can crash `StatusPill`

**File:** `apps/web/src/components/coach/WizardStep4Import.tsx:302-303`

**Issue:** `importRow.status as FileStatus` performs an unchecked cast. If the backend returns an unexpected status value (e.g., `'processing'`, `'cancelled'`, `'error'`), the value is cast to `FileStatus` silently and stored in state. `StatusPill` then performs `config[status]` at line 34, which returns `undefined` for any key not in `{ uploading, parsing, ready, failed }`. The immediately following destructure `const { colorClasses, labelKey, hasSpinner } = config[status]` throws `TypeError: Cannot destructure property 'colorClasses' of undefined`, crashing the component.

**Fix:**
```typescript
const VALID_FILE_STATUSES = new Set<string>(['uploading', 'parsing', 'ready', 'failed']);

// In the polling callback:
const rawStatus = importRow.status;
const safeStatus: FileStatus = VALID_FILE_STATUSES.has(rawStatus)
  ? (rawStatus as FileStatus)
  : 'failed';
setFileStates((prev) =>
  prev.map((f) =>
    f.id === fileId
      ? { ...f, status: safeStatus, errorMessage: importRow.error_message ?? undefined }
      : f,
  ),
);
```

---

## Warnings

### WR-01: Raw server error text surfaced directly to users

**File:** `apps/web/src/components/coach/WizardStep4Import.tsx:107, 140, 170, 199`

**Issue:** On non-5xx API failures, `await res.text()` is used verbatim as `errorMessage`. This text is rendered directly in the file list row (lines 522-525). Depending on the backend implementation, this may expose stack traces, JSON error payloads, or HTML error pages to the user. It also makes error messages non-localizable.

**Fix:** Replace each occurrence with a generic localizable error or a short sanitized extract:
```typescript
// Instead of: const errText = res.status >= 500 ? t('step4ErrorServer') : await res.text();
const errText = t('step4ErrorServer'); // use a single i18n key for all API errors
// or cap length and strip HTML: (await res.text()).replace(/<[^>]+>/g, '').slice(0, 120)
```

---

### WR-02: `startPolling` closure over `apiUrl`/`jwt` is not captured at pipeline start time

**File:** `apps/web/src/components/coach/WizardStep4Import.tsx:83, 222, 235`

**Issue:** `startPolling` is a plain function declaration inside the component, not memoized with `useCallback`. It closes over `apiUrl` and `jwt` from the enclosing render scope. `runPipeline` (a `useCallback`) calls `startPolling(...)` at step 5, but `startPolling` itself is not in `runPipeline`'s dependency array. If `jwt` rotates between the pipeline start and the point where polling begins, polling will use the stale token from the render when `runPipeline` was last created, not from when `startPolling` was called.

**Fix:** Either include `startPolling` in `runPipeline`'s `useCallback` deps (which requires memoizing `startPolling` too), or move the polling logic inline into `runPipeline` to ensure it captures the current `jwt` at invocation time.

---

### WR-03: Chat message list uses array index in React key, risking reconciliation bugs

**File:** `apps/web/src/components/coach/WizardStep4Import.tsx:413, 421, 433, 462, 469`

**Issue:** Keys are constructed as `` `${msg.fileId}-${i}` `` where `i` is the array index from `chatMessages.map`. If a message is ever removed from the middle of the array (e.g., after removing a file), React will incorrectly reuse DOM nodes for the wrong messages. This is particularly relevant for the `ia-ambiguous` message which renders interactive buttons.

**Fix:** Assign a stable unique ID to each `ChatMessage` at the time it is created and use that as the key:
```typescript
type ChatMessage =
  | { id: string; kind: 'ia-template-summary'; fileId: string; ... }
  | ...

// When pushing to chatMessages:
{ id: crypto.randomUUID(), kind: 'ia-da-coach-summary', fileId, filename }

// In JSX:
{chatMessages.map((msg) => {
  // use msg.id as key
  ...
  return <div key={msg.id} ...>
```

---

### WR-04: `userId` is listed as a `useCallback` dependency but never used inside `runPipeline`

**File:** `apps/web/src/components/coach/WizardStep4Import.tsx:223`

**Issue:** `useCallback(..., [jwt, apiUrl, userId])` — `userId` appears in the dependency array but is not referenced anywhere inside the `runPipeline` function body. This is dead dependency that adds a misleading signal to future readers (suggesting `userId` is sent somewhere in the pipeline, when it is not).

**Fix:** Remove `userId` from the dependency array:
```typescript
}, [jwt, apiUrl]);
```

---

### WR-05: Off-by-one in polling max attempts check

**File:** `apps/web/src/components/coach/WizardStep4Import.tsx:239-249`

**Issue:** `attempts` is incremented to 1 on the first tick, then checked `if (attempts >= MAX_ATTEMPTS)`. With `MAX_ATTEMPTS = 60`, the interval fires 60 times total: on tick 60, the check `60 >= 60` is true and the timeout triggers — but the network request for that tick never executes. Only 59 actual poll requests are made, not 60 (2 minutes 57 seconds of effective polling, not 3 minutes as the comment states).

**Fix:** Either check `> MAX_ATTEMPTS` (allowing exactly 60 requests), or increment after the request:
```typescript
if (attempts > MAX_ATTEMPTS) {
  // timeout
  return;
}
// ... do the fetch ...
attempts += 1;
```

---

## Info

### IN-01: British spelling "analysed" inconsistency in English locale

**File:** `apps/web/messages/en.json:154-155`

**Issue:** `step4AiTemplateSummary` and `step4AiTemplateSummaryShort` use `"I analysed"` (British English). The rest of the English copy uses American English conventions (e.g., `"Analyze"`, `"analyze"`). This is a minor inconsistency in copy tone.

**Fix:** Standardize to `"I analyzed"` to match the rest of the English locale copy.

---

_Reviewed: 2026-05-30T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
