---
phase: 04-review-commit
reviewed: 2026-08-12T00:00:00Z
depth: standard
files_reviewed: 4
files_reviewed_list:
  - apps/web/messages/en.json
  - apps/web/messages/fr.json
  - apps/web/src/components/coach/WizardStep4Import.test.tsx
  - apps/web/src/components/coach/WizardStep4Import.tsx
findings:
  critical: 1
  warning: 4
  info: 3
  total: 8
status: issues_found
---

# Phase 04: Code Review Report

**Reviewed:** 2026-08-12T00:00:00Z
**Depth:** standard
**Files Reviewed:** 4
**Status:** issues_found

## Summary

Reviewed the review/commit screen added to `WizardStep4Import.tsx`, its test file, and both locale files. Locale key coverage is complete and consistent between `en.json` and `fr.json` (all `step4*` and `unit*` keys used in the component exist in both files with matching interpolation variables). The component's happy-path logic (upload -> parse -> classify -> review -> parallel commit -> auto-redirect) is well structured, with careful state-machine handling and cleanup of intervals/AbortControllers on unmount and on file removal.

However, there is one **critical** logic bug: clicking "Confirm and import" when zero documents are classified as `template_programme` (i.e. every uploaded document is `da_coach`, a fully valid and expected scenario per this feature's own design) permanently traps the user in the `committing` phase — the completion effect never fires because it early-returns when there is nothing to commit, and the Confirm button is disabled while `committing`, with no automatic recovery. Several other issues around missing user feedback for silently-dropped files, a raw UUID fallback shown to end users, orphaned chat messages after file removal, and unvalidated/duplicated magic numbers were also found.

## Critical Issues

### CR-01: "Confirm and import" permanently hangs when there are zero committable documents

**File:** `apps/web/src/components/coach/WizardStep4Import.tsx:364-371,452-463,631-641`
**Issue:**
The completion effect that transitions `reviewPhase` from `'committing'` to `'done'` early-returns whenever there is nothing to commit:

```tsx
useEffect(() => {
  if (reviewPhase !== 'committing') return;
  const committable = fileStates.filter((f) => f.status === 'ready' && f.docType === 'template_programme');
  if (committable.length === 0) return;   // <-- never reaches setReviewPhase('done')
  const allDone = committable.every((f) => f.commitStatus === 'committed');
  if (!allDone) return;
  setReviewPhase('done');
}, [fileStates, reviewPhase]);
```

`handleConfirm` unconditionally sets `reviewPhase` to `'committing'` before checking whether `toCommit` is non-empty:

```tsx
async function handleConfirm(): Promise<void> {
  setReviewPhase('committing');
  const toCommit = fileStates.filter((f) => f.status === 'ready' && f.docType === 'template_programme');
  ...
  await Promise.all(toCommit.map((f) => commitDoc(f.id, f)));
}
```

And the Confirm button is only disabled while `reviewPhase === 'committing'` — it is never disabled when `committableCount === 0`:

```tsx
<button type="button" onClick={handleConfirm} disabled={reviewPhase === 'committing'} ...>
```

Since this feature explicitly supports uploads that are entirely `da_coach` (context-only, "no action" — see `step4ReviewNoAction`), a coach who uploads only methodology/DA documents and clicks "Confirmer et importer" will see the spinner start and never stop: `reviewPhase` stays `'committing'` forever, the Confirm button stays disabled (spinner spinning indefinitely), `onSuccess` is never invoked, and there is no error message. The only escape is if the user happens to notice the still-enabled "Skip" button. This is a broken primary user flow reachable in normal usage, not just an edge case.

None of the existing tests cover the "all documents are da_coach" path, so this regression is untested.

**Fix:** Either disable Confirm when there is nothing to commit and treat it as an immediate success, or make `handleConfirm` short-circuit before entering `committing` phase:

```tsx
async function handleConfirm(): Promise<void> {
  const toCommit = fileStates.filter((f) => f.status === 'ready' && f.docType === 'template_programme');
  if (toCommit.length === 0) {
    setReviewPhase('done');
    return;
  }
  setReviewPhase('committing');
  setFileStates((prev) =>
    prev.map((f) =>
      f.status === 'ready' && f.docType === 'template_programme'
        ? { ...f, commitStatus: 'pending', commitError: undefined }
        : f,
    ),
  );
  await Promise.all(toCommit.map((f) => commitDoc(f.id, f)));
}
```
(and drop the now-redundant `committable.length === 0` early return in the completion effect, or keep it as a defensive no-op since `handleConfirm` now guarantees `committing` is only entered with committable docs).

## Warnings

### WR-01: Invalid/oversized files are silently dropped with no user feedback

**File:** `apps/web/src/components/coach/WizardStep4Import.tsx:488-505`
**Issue:** `handleFiles` filters out files with disallowed extensions or size `> MAX_FILE_BYTES` with no message shown to the user:

```tsx
function handleFiles(fileList: FileList | null): void {
  if (!fileList) return;
  const incoming = Array.from(fileList).filter((file) => {
    const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
    return ALLOWED_EXTENSIONS.has(ext) && file.size <= MAX_FILE_BYTES;
  });
  ...
}
```
A coach who drags in a `.zip`, `.png`, or an 8 MB PDF will see nothing happen — no row added, no error, no indication why. This is confusing and indistinguishable from a bug/dead UI.
**Fix:** Track rejected files (e.g. `rejectedCount`/`rejectedNames`) and surface a short inline error (new locale keys, e.g. `step4FileRejected`) listing why files were skipped (extension or size).

### WR-02: Fallback for AI-analyzed document name shows a raw internal UUID to the user

**File:** `apps/web/src/components/coach/WizardStep4Import.tsx:254,307`
**Issue:** In the polling handler, `filename` (the real, user-facing file name) is already captured in scope, but the template-summary fallback uses the internal `fileId` (a `crypto.randomUUID()` value) instead:

```tsx
const filename = fileState.file.name;
...
const name = importRow.parsed_data?.name ?? fileId;   // should fall back to filename, not the internal id
```
If the backend's parsed data omits `name`, the chat bubble will literally read "I analyzed 3fa85f64-5717-4562-b3fc-2c963f66afa6 — it looks like a 4-week program...", which is confusing/unprofessional and leaks an internal identifier into user-facing copy.
**Fix:**
```tsx
const name = importRow.parsed_data?.name ?? filename;
```

### WR-03: Chat messages referencing a removed file become orphaned/stale

**File:** `apps/web/src/components/coach/WizardStep4Import.tsx:507-518,685-714`
**Issue:** `removeFile` clears intervals/abort controllers and removes the entry from `fileStates`, but never prunes `chatMessages`. For `ia-ambiguous` messages, the clarification buttons correctly disappear once `fileState` is no longer found (`fileState?.clarificationPending ?? false`), but the message text itself ("I'm not sure about the type of X. Is it a program template or a coaching DA?") remains displayed forever with no way to resolve or dismiss it, since the file it refers to no longer exists. The same applies to `ia-template-summary`/`ia-da-coach-summary` messages, which persist referencing a file that's no longer in the upload list.
**Fix:** When removing a file, also filter `chatMessages` to drop entries whose `fileId` matches the removed file:
```tsx
setChatMessages((prev) => prev.filter((m) => m.fileId !== id));
```

### WR-04: Import creation response is trusted without shape validation

**File:** `apps/web/src/components/coach/WizardStep4Import.tsx:143-145`
**Issue:**
```tsx
const data = await res.json() as { import_id: string; signed_upload_url: string };
importId = data.import_id;
signedUploadUrl = data.signed_upload_url;
```
The response is blindly cast with `as` and used directly without checking that `import_id`/`signed_upload_url` are actually present/non-empty strings. If the backend ever returns `200` with a malformed or partial body (e.g. a proxy/CDN error page, or an API contract drift), `importId`/`signedUploadUrl` become `undefined`, and the pipeline proceeds to `fetch(undefined, { method: 'PUT', ... })` in the next step. The `try/catch` around Step 2 will catch the resulting failure and mark the file `failed`, so this is not a crash, but it produces a generic "server error" message that obscures a real API-contract bug and makes debugging harder.
**Fix:** Validate the response shape before proceeding, e.g.:
```tsx
const data = await res.json() as { import_id?: string; signed_upload_url?: string };
if (!data.import_id || !data.signed_upload_url) {
  // treat as failed, same as a non-ok response
}
```

## Info

### IN-01: Max-file-count cap (`4`) duplicated as a magic number

**File:** `apps/web/src/components/coach/WizardStep4Import.tsx:84,495`
**Issue:** The file cap is hardcoded twice — `const isCapHit = fileStates.length >= 4;` and `const remaining = 4 - prev.length;`. If the cap ever changes, both sites must be updated in sync, or the drop-zone "cap reached" message and the actual enforced limit will silently diverge.
**Fix:** Extract a single `const MAX_FILES = 4;` constant near `ALLOWED_EXTENSIONS`/`MAX_FILE_BYTES` and reference it from both call sites.

### IN-02: Confidence thresholds (`0.4` / `0.6`) are unnamed magic numbers embedded in control flow

**File:** `apps/web/src/components/coach/WizardStep4Import.tsx:283-330`
**Issue:** The classification thresholds that decide `da_coach` vs. `template_programme` vs. "ambiguous, needs clarification" are inline literals (`confidence < 0.4`, `confidence >= 0.6`) with no named constant or comment explaining the chosen boundaries or the deliberate gap between them.
**Fix:** Hoist to named constants, e.g. `const DA_COACH_THRESHOLD = 0.4; const TEMPLATE_THRESHOLD = 0.6;`, for readability and to make future tuning a one-line change.

### IN-03: Truncation length (`80`) is an unnamed magic number

**File:** `apps/web/src/components/coach/WizardStep4Import.tsx:780`
**Issue:** `fileState.errorMessage.length > 80 ? fileState.errorMessage.slice(0, 80) + '…' : fileState.errorMessage` hardcodes `80` inline.
**Fix:** Extract `const ERROR_MESSAGE_TRUNCATE_LENGTH = 80;` for clarity/consistency with the file's other named constants.

---

_Reviewed: 2026-08-12T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
