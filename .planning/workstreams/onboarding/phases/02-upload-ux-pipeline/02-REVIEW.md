---
phase: 02-upload-ux-pipeline
reviewed: 2026-05-30T00:00:00Z
depth: standard
files_reviewed: 3
files_reviewed_list:
  - apps/web/src/components/coach/WizardStep4Import.tsx
  - apps/web/messages/fr.json
  - apps/web/messages/en.json
findings:
  critical: 3
  warning: 6
  info: 3
  total: 12
status: issues_found
---

# Phase 02: Code Review Report

**Reviewed:** 2026-05-30
**Depth:** standard
**Files Reviewed:** 3
**Status:** issues_found

## Summary

Reviewed `WizardStep4Import.tsx` (the upload wizard step) and both i18n locale files. The component implements a four-step upload pipeline (create import record → PUT to signed URL → mark uploaded → trigger parse → poll for status). The architecture is sound, but there are three blockers: the `onSuccess` callback is never called (wizard cannot advance), `userId` is passed as a prop but never sent to the API, and there is no file type or size validation on drag-and-drop (the `accept` attribute only gates the file picker, not drops). Six additional warnings cover a polling leak, stale closure risk, orphaned uploads on file removal, raw server error exposure, hardcoded French byte units, and missing abort on removal. Three info items round out i18n gaps.

---

## Critical Issues

### CR-01: `onSuccess` callback is never called — wizard cannot advance

**File:** `apps/web/src/components/coach/WizardStep4Import.tsx:31-382`
**Issue:** The `onSuccess` prop is declared in the component interface and destructured, but there is no call to `onSuccess()` anywhere in the file. When all files reach `ready` status the wizard has no way to auto-advance. The only exit is the `onSkip` button. Any integration that relies on `onSuccess` to move to the next wizard step will be permanently broken.
**Fix:**
```tsx
// After setFileStates in startPolling, check if all files are terminal:
setFileStates((prev) => {
  const next = prev.map((f) =>
    f.id === fileId
      ? { ...f, status: importRow.status as FileStatus, errorMessage: importRow.error_message ?? undefined }
      : f,
  );
  // Auto-advance when every file is ready (at least one must exist)
  if (next.length > 0 && next.every((f) => f.status === 'ready')) {
    onSuccess();
  }
  return next;
});
```

---

### CR-02: `userId` prop is declared but never sent to the API

**File:** `apps/web/src/components/coach/WizardStep4Import.tsx:32,116-121`
**Issue:** `userId` is in the props destructure (line 32) and component interface (line 38) but is never referenced in the function body. The `POST /coach/imports` request body at line 116–121 does not include `user_id`. If the backend derives `user_id` from the JWT this is a no-op, but if the endpoint expects it in the body the import record will be created with a null or missing owner, causing authorization failures at every subsequent step (status update, parse trigger, polling).
**Fix:**
```tsx
body: JSON.stringify({
  filename: fileState.file.name,
  mime_type: fileState.file.type,
  size_bytes: fileState.file.size,
  mode: 'coach_template',
  user_id: userId,           // ← add this
}),
```
If the backend always derives `user_id` from the JWT, remove the `userId` prop from the interface to prevent the misleading dead prop.

---

### CR-03: Drag-and-drop bypasses file type and size validation

**File:** `apps/web/src/components/coach/WizardStep4Import.tsx:250-261,286-291`
**Issue:** The `<input accept=".pdf,.xlsx,.xls,.docx">` attribute blocks non-matching files in the native file picker, but the browser's drag-and-drop API does not enforce `accept`. The `handleDrop` handler passes `e.dataTransfer.files` directly to `handleFiles`, which creates a `FileState` with `status: 'uploading'` for any file type (`.exe`, `.zip`, video files, etc.). There is also no size check anywhere in the client: a multi-gigabyte file will be sent to the API and then PUT to a signed URL, failing only at the server. The `Upload.errorSize` key (max 5 MB) exists in both locales but is never used by this component.
**Fix:**
```tsx
const ALLOWED_EXTENSIONS = new Set(['pdf', 'xlsx', 'xls', 'docx']);
const MAX_FILE_BYTES = 5 * 1024 * 1024; // 5 MB

function handleFiles(fileList: FileList | null): void {
  if (!fileList) return;
  const incoming = Array.from(fileList).filter((file) => {
    const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
    if (!ALLOWED_EXTENSIONS.has(ext)) return false;
    if (file.size > MAX_FILE_BYTES) return false;   // surface Upload.errorSize to user
    return true;
  });
  const remaining = 4 - fileStates.length;
  if (remaining <= 0) return;
  const toAdd = incoming.slice(0, remaining);
  const newStates: FileState[] = toAdd.map((file) => ({
    id: crypto.randomUUID(),
    file,
    status: 'uploading',
  }));
  setFileStates((prev) => [...prev, ...newStates]);
}
```

---

## Warnings

### WR-01: Polling interval never times out — runs forever on a broken backend

**File:** `apps/web/src/components/coach/WizardStep4Import.tsx:72-101`
**Issue:** `startPolling` creates a `setInterval` that clears only when the API returns `status === 'ready'` or `status === 'failed'`. If the API continuously returns a non-OK HTTP status (lines 76-78 silently continue), or returns a status value other than `ready`/`failed`, the interval runs indefinitely. The component unmount cleanup (lines 54-59) does clear all intervals, but if the user navigates away through an SPA transition without unmounting this component, intervals leak. There is no maximum retry count or wall-clock timeout.
**Fix:**
```tsx
function startPolling(importId: string, fileId: string): void {
  let attempts = 0;
  const MAX_ATTEMPTS = 60; // 3 min at 3s interval
  const handle = setInterval(async () => {
    attempts++;
    if (attempts >= MAX_ATTEMPTS) {
      clearInterval(handle);
      intervalsRef.current.delete(fileId);
      setFileStates((prev) =>
        prev.map((f) =>
          f.id === fileId ? { ...f, status: 'failed', errorMessage: 'Timeout' } : f,
        ),
      );
      return;
    }
    // ... existing fetch logic
  }, 3000);
  intervalsRef.current.set(fileId, handle);
}
```

---

### WR-02: `removeFile` does not abort in-flight uploads — orphaned storage objects

**File:** `apps/web/src/components/coach/WizardStep4Import.tsx:264-272`
**Issue:** Removing a file during the `uploading` phase stops polling (which hasn't started yet) and removes the UI entry, but the ongoing `fetch` PUT to the signed URL continues to completion. The import record was already created in storage; the file will be uploaded and stored with no reference in the UI. Subsequent `setFileStates` calls inside `runPipeline` operate on the removed file ID but the `prev.filter` at line 271 means those updates are no-ops — however the pipeline steps (status update, parse trigger) still execute against a live import record the user intended to discard.
**Fix:** Use `AbortController` per file:
```tsx
const abortControllersRef = useRef<Map<string, AbortController>>(new Map());

// In runPipeline, create controller:
const controller = new AbortController();
abortControllersRef.current.set(fileId, controller);

// Pass signal to all fetch calls:
const res = await fetch(`${apiUrl}/coach/imports`, {
  method: 'POST',
  signal: controller.signal,
  // ...
});

// In removeFile:
const controller = abortControllersRef.current.get(id);
controller?.abort();
abortControllersRef.current.delete(id);
```

---

### WR-03: `runPipeline` uses stale closure — `jwt` and `apiUrl` not in `useEffect` deps

**File:** `apps/web/src/components/coach/WizardStep4Import.tsx:62-70,103`
**Issue:** The `useEffect` at line 62 has `// eslint-disable-next-line react-hooks/exhaustive-deps` to suppress the missing `runPipeline` dependency. `runPipeline` is a plain function (not wrapped in `useCallback`) that closes over `jwt`, `apiUrl`, and `userId`. If the parent re-renders with a new JWT (token refresh) before a pipeline step executes, `runPipeline` will use the old token because `pipelineStartedRef` prevents it from being re-registered. This is most likely to occur during a long upload when a short-lived JWT expires.
**Fix:** Either wrap `runPipeline` in `useCallback` with `[jwt, apiUrl, userId]` deps and add it to the effect's dep array, or pass the current values as parameters:
```tsx
const runPipeline = useCallback(async (fileState: FileState): Promise<void> => {
  // ... same body
}, [jwt, apiUrl, userId]);

useEffect(() => {
  fileStates.forEach((fs) => {
    if (fs.status === 'uploading' && !fs.importId && !pipelineStartedRef.current.has(fs.id)) {
      pipelineStartedRef.current.add(fs.id);
      runPipeline(fs);
    }
  });
}, [fileStates, runPipeline]);
```

---

### WR-04: Raw server error text rendered in UI — leaks internal details

**File:** `apps/web/src/components/coach/WizardStep4Import.tsx:124-128,157-160,186-189,210-213`
**Issue:** At every failed step, `await res.text()` is stored directly as `errorMessage` and rendered at line 353. Server error responses can contain stack traces, internal file paths, SQL error messages, or HTML error pages. While the text is truncated at 80 chars (line 353) and rendered as a React text node (not HTML, so no XSS), it still leaks internal server state to the browser. A network tab inspection or screenshot of the UI could expose backend internals.
**Fix:** Map server error responses to localized, user-friendly messages. Add i18n keys for common failure scenarios, or use a generic fallback:
```tsx
// Replace direct errText assignment with a generic message:
const errText = res.status >= 500
  ? t('step4ErrorServer')      // new i18n key: "Server error. Please try again."
  : await res.text();          // 4xx may contain actionable user-facing text
```

---

### WR-05: `formatBytes` uses hardcoded French unit labels

**File:** `apps/web/src/components/coach/WizardStep4Import.tsx:237-240`
**Issue:** File sizes are formatted with `"o"` (octets), `"Ko"`, and `"Mo"` — French SI unit names. In the English locale this component will display `"512 Ko"` instead of `"512 KB"`. The i18n locale is not consulted.
**Fix:** Either add i18n keys for byte units or use the browser `Intl` API:
```tsx
function formatBytes(bytes: number, locale: string): string {
  // Intl.NumberFormat with unit formatting (Chrome 77+, Safari 14+):
  // Or simpler — two i18n keys: "Ko"/"KB", "Mo"/"MB"
  if (bytes < 1024) return `${bytes} ${t('unitBytes')}`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} ${t('unitKB')}`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} ${t('unitMB')}`;
}
```

---

### WR-06: No `Content-Type` header on the parse trigger POST

**File:** `apps/web/src/components/coach/WizardStep4Import.tsx:205-208`
**Issue:** The POST to `${apiUrl}/coach/imports/${importId}/parse` sends only `Authorization`. If the server's router matches on `Content-Type: application/json` (common in Hono route middleware), the request may be rejected with a 415 or a body-parsing error, even though the body is intentionally empty. All other POST requests in this component include `Content-Type: application/json`.
**Fix:**
```tsx
const parseRes = await fetch(`${apiUrl}/coach/imports/${importId}/parse`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${jwt}`,
  },
});
```

---

## Info

### IN-01: `step4FileFailed` i18n key contains no detail — shadowed by raw server text

**File:** `apps/web/messages/fr.json:149`, `apps/web/messages/en.json:149`
**Issue:** The `step4FileFailed` key is just `"Error"` / `"Erreur"`. The raw server error message is shown separately below (WR-04 above), but there is no localized vocabulary for known failure categories (size exceeded, unsupported format, server unavailable). This results in ambiguous error UX. Recommend adding at least `step4ErrorServer`, `step4ErrorNetwork`, and leveraging the existing `Upload.errorSize` / `Upload.errorFormat` keys.

---

### IN-02: `userId` prop in component interface creates misleading API contract

**File:** `apps/web/src/components/coach/WizardStep4Import.tsx:38`
**Issue:** (Linked to CR-02.) Even if the backend derives `user_id` from JWT and the prop is truly unused, leaving it in the interface signals to callers that it is consumed. Every call site must provide it, creating dead prop-passing. Once CR-02 is resolved (either use it or remove it), the interface should be updated to match.

---

### IN-03: `step4DropZoneLabel` text ends with "ou" / "or" — implies inline button follows in the label, but the button is a sibling element

**File:** `apps/web/messages/fr.json:143`, `apps/web/messages/en.json:142`
**Issue:** The label `"Glisse tes fichiers ici ou"` / `"Drop your files here or"` trails with a conjunction. The "Parcourir les fichiers" / "Browse files" button is a separate `<button>` element rendered after the `<p>`. Visually this works, but screen readers read the paragraph and button as separate items with no explicit association. For accessibility, use `aria-describedby` or compose the conjunction into the button label.

---

_Reviewed: 2026-05-30_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
