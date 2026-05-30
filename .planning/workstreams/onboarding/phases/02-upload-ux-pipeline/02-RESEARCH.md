# Phase 2: Upload UX & Pipeline - Research

**Researched:** 2026-05-30
**Domain:** React file upload UI, browser drag-and-drop, HTTP pipeline orchestration (Next.js / Tailwind v4)
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Chat bubble at top of card (not a static banner). Phase 3 appends to the same container — must NOT replace it.
- **D-02:** Chat bubble anatomy: `bg-primary text-white w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold shrink-0` avatar showing "IA", plus bubble div.
- **D-03:** Opening message i18n key `step4AiGreeting`: FR = `"Envoie-moi tes docs et je m'occupe du reste."`, EN = `"Send me your docs and I'll handle the rest."`
- **D-04:** Custom drag-and-drop (no dropzone library). Hidden `<input type="file" multiple accept=".pdf,.xlsx,.xls,.docx">` triggered by button.
- **D-05:** Drop zone stays visible after file selection. File cards appear below it.
- **D-06:** 4-file cap: drop zone dims (`opacity-50`) + shows `step4CapReached` text. 5th file silently blocked.
- **D-07:** Drop zone states: default `border-border`, drag-over `border-primary bg-primary/5`.
- **D-08:** File card row: file icon + filename + size (left), status pill (right), × remove button (far right).
- **D-09:** Status pill states: `uploading` (blue), `parsing` (orange), `ready` (green), `failed` (red) — exact Tailwind classes in UI-SPEC.
- **D-10:** Failed state: inline `text-xs text-red-500` error below filename, truncate at 80 chars from `error_message` GET field.
- **D-11:** × button always visible; clicking removes card and stops polling (best-effort).
- **D-12:** All files fire in parallel via independent pipelines.
- **D-13:** Pipeline: POST → PUT upload → PUT status `uploaded` → POST parse → poll GET every 3s.
- **D-14:** Polling via `setInterval` (3s). Clear on `ready`, `failed`, removal, or unmount.
- **D-15:** `apiUrl` and `jwt` from existing props — no new auth setup.
- **D-16:** All state in `WizardStep4Import.tsx` local state. `FileState` array, no Zustand.
- **D-17:** `onSuccess` NOT triggered in Phase 2. Skip button unchanged.

### Claude's Discretion

- File type icon mapping (react-icons/io5 preferred) — confirmed by UI-SPEC: `IoDocumentOutline` (PDF/fallback), `IoGridOutline` (Excel), `IoReaderOutline` (Word).
- Exact Tailwind classes for drop zone sizing — confirmed by UI-SPEC: `min-h-[120px]`, `p-6`.
- i18n key for cap message — confirmed by UI-SPEC: `step4CapReached`.

### Deferred Ideas (OUT OF SCOPE)

- Retry button on failed files
- Upload progress bar (bytes via XHR)
- `onSuccess` / Continue trigger (Phase 3)

</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| UPLOAD-01 | Coach can upload up to 4 files (PDF, Excel, Word) from Step 4 | Drop zone with 4-file cap; `input accept=".pdf,.xlsx,.xls,.docx"` |
| UPLOAD-02 | IA opens conversation with an explicit invite message | Chat bubble with `step4AiGreeting` i18n key rendered at top of card |
| UPLOAD-03 | Each file triggers Phase 28 pipeline automatically (create → upload → status → parse) | POST `/coach/imports` → signed URL PUT → PUT status → POST parse → poll GET |

</phase_requirements>

---

## Summary

Phase 2 fills the `{/* Phase 2: upload UI goes here */}` slot in the `WizardStep4Import.tsx` shell created in Phase 1. The component is a self-contained client component with three visual sections: an IA chat bubble (foundation for Phase 3), a drag-and-drop zone, and a per-file status list. No new npm packages are introduced — `react-icons/io5` is already installed.

The backend is Phase 28's `importsRouter`, which is read-only for this phase (no changes). The full API contract is verified by direct codebase inspection. The pipeline sequence is exactly: `POST /coach/imports` (returns `import_id` + `signed_upload_url`) → `fetch PUT` to signed URL → `PUT /:id/status { status: 'uploaded' }` → `POST /:id/parse` (202 async) → poll `GET /:id` every 3 seconds until `status` is `ready` or `failed`.

State lives entirely in local React state as a `FileState[]` array. Polling is managed with `setInterval` refs cleaned up on terminal status, file removal, or component unmount. All decisions are fully pre-specified in 02-CONTEXT.md and 02-UI-SPEC.md — this phase has zero design ambiguity.

**Primary recommendation:** Implement in a single plan (one task per section: chat bubble, drop zone, file state + pipeline, i18n keys). All implementation details are locked — execution is a direct translation of the CONTEXT + UI-SPEC into code.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| File selection (drag-drop + picker) | Browser / Client | — | Pure DOM event handling; no server involvement |
| Pipeline orchestration (POST → upload → status → parse) | Browser / Client | API / Backend | Client drives the sequence; backend executes async parse |
| Per-file status polling | Browser / Client | — | `setInterval` polling GET endpoint; all logic stays in component |
| Import record creation | API / Backend | — | `POST /coach/imports` — server creates DB row + signed URL |
| File storage | CDN / Static (Supabase Storage) | API / Backend | Direct PUT to Supabase signed URL; backend triggers async parse after |
| Parse execution | API / Backend | — | Async background chain in `importsRouter.post('/:id/parse')` |
| i18n strings | Browser / Client | — | `next-intl` `useTranslations('Onboarding')` — client-side |

---

## Standard Stack

No new packages. All libraries already installed in `apps/web/`.

### Core (already installed)
| Library | Verified In | Purpose | Notes |
|---------|-------------|---------|-------|
| `react` | `apps/web/package.json` (Next.js dep) | `useState`, `useEffect`, `useRef` for state + polling | [VERIFIED: codebase] |
| `next-intl` | Used in Phase 1 shell (`useTranslations`) | i18n | [VERIFIED: codebase] |
| `react-icons/io5` | `apps/web/src/components/coach/*.tsx` (many usages) | File type icons + upload cloud icon | [VERIFIED: codebase] |
| Tailwind CSS v4 | `apps/web/src/app/globals.css` | All styling | [VERIFIED: codebase] |

### No New Packages Required

The UI-SPEC explicitly states: "No third-party component registries. No new npm packages introduced — `react-icons/io5` is already installed in the web app." [VERIFIED: 02-UI-SPEC.md]

**Installation:** None required.

---

## Package Legitimacy Audit

No packages are installed in this phase. Audit: N/A.

---

## Architecture Patterns

### System Architecture Diagram

```
Coach browser
    │
    │  1. Drop / select files
    ▼
WizardStep4Import.tsx (client component)
    │  FileState[] local state
    │  Per-file: { id, file, importId?, status, errorMessage? }
    │
    ├── for each file (parallel):
    │     │
    │     │  POST /coach/imports  { filename, mime_type, size_bytes, mode: 'coach_template' }
    │     ▼
    │   Hono API (/coach/imports)
    │     │  201 { import_id, signed_upload_url }
    │     │
    │     │  fetch PUT → Supabase Storage (signed URL)
    │     │  200 OK
    │     │
    │     │  PUT /coach/imports/:id/status  { status: 'uploaded' }
    │     │  200 { ok: true }
    │     │
    │     │  POST /coach/imports/:id/parse
    │     │  202 { ok: true, status: 'parsing' }
    │     │
    │     │  setInterval(3000) → GET /coach/imports/:id
    │     │       ├── status: 'parsing' → keep polling
    │     │       ├── status: 'ready'   → clearInterval, show green pill
    │     │       └── status: 'failed'  → clearInterval, show red pill + error_message
    │     ▼
    │   FileState update → re-render StatusPill
    │
    └── (Phase 3 will read FileState[status==='ready'] for classification)
```

### Recommended Project Structure

No new files beyond `WizardStep4Import.tsx`. The component is self-contained.

```
apps/web/src/components/coach/
└── WizardStep4Import.tsx    ← Phase 1 shell; Phase 2 fills {/* Phase 2: upload UI goes here */}
apps/web/messages/
├── fr.json                  ← Add 9 new keys under "Onboarding"
└── en.json                  ← Same keys, English values
```

### Pattern 1: Local FileState Array with Per-File Polling

**What:** Each file has a local state entry. A `useEffect` runs the pipeline when a new entry with `status: 'uploading'` appears. A `useRef<Map<string, ReturnType<typeof setInterval>>>` tracks interval handles by file ID for cleanup.

**When to use:** Parallel per-file state tracking without a global store.

**Example (canonical pattern for this phase):**
```typescript
// Source: 02-CONTEXT.md D-16, D-14
type FileStatus = 'uploading' | 'parsing' | 'ready' | 'failed';
type FileState = {
  id: string;
  file: File;
  importId?: string;
  status: FileStatus;
  errorMessage?: string;
};

// Client-side ID generation — browser already has crypto.randomUUID
// [VERIFIED: codebase — pattern confirmed in apps/web/src/components/coach/SessionSlideOver.tsx]
const id = crypto.randomUUID();

// Interval cleanup ref — map from file ID to interval handle
const intervalsRef = useRef<Map<string, ReturnType<typeof setInterval>>>(new Map());

// Cleanup on unmount — clear ALL pending intervals
useEffect(() => {
  return () => {
    intervalsRef.current.forEach(clearInterval);
  };
}, []);
```

### Pattern 2: Drag-and-Drop with Native Browser Events

**What:** Custom drag-and-drop using `onDragOver` / `onDragLeave` / `onDrop` on a styled div, plus a hidden `<input type="file">` triggered by a button click.

**When to use:** When no dropzone library is used (D-04).

**Key implementation notes:**
- `e.preventDefault()` in `onDragOver` is required — without it the browser will open the file in a new tab instead of triggering `onDrop`. [ASSUMED — standard browser behavior]
- `e.dataTransfer.files` is the drop payload; `e.target.files` is the input payload. Both return a `FileList`.
- `Array.from(fileList)` converts `FileList` to array for filtering.
- Cap check: `fileStates.length + newFiles.length > 4` → slice to fill remaining slots silently.

**Example:**
```typescript
// Source: 02-CONTEXT.md D-04, D-06, D-07; 02-UI-SPEC.md Drop Zone section
function handleFiles(fileList: FileList | null) {
  if (!fileList) return;
  const incoming = Array.from(fileList);
  const remaining = 4 - fileStates.length;
  if (remaining <= 0) return; // cap hit, silent block
  const accepted = incoming.slice(0, remaining);
  const newStates: FileState[] = accepted.map(f => ({
    id: crypto.randomUUID(),
    file: f,
    status: 'uploading',
  }));
  setFileStates(prev => [...prev, ...newStates]);
}
```

### Pattern 3: Pipeline Orchestration via useEffect

**What:** A `useEffect` watching `fileStates` triggers the pipeline for any entry whose `status === 'uploading'` and which has no `importId` yet.

**When to use:** Reactive pipeline trigger without imperative calls scattered across event handlers.

**Key implementation notes:**
- The effect must only fire for entries in `uploading` status without an `importId` (idempotency guard).
- All 5 pipeline steps are sequential within each file's async function, but all files run concurrently.
- Polling interval handle stored in `intervalsRef.current.set(fileId, handle)`.
- On `removeFile(id)`: clear the interval from the ref map, filter from state.

### Pattern 4: Signed URL Upload

**What:** Standard Supabase signed URL PUT pattern. The backend generates the URL via `createSignedUploadUrl`; the client does a direct `fetch` PUT to that URL.

**Example (verified from service.ts):**
```typescript
// Source: backend/api/src/coach/imports/service.ts lines 136-144
// POST /coach/imports response: { import_id, signed_upload_url, path }

await fetch(signed_upload_url, {
  method: 'PUT',
  body: file,
  headers: { 'Content-Type': file.type },
});
// No Authorization header needed on the signed URL — it is self-authenticating
```

**Critical note:** The signed URL is self-authenticating — do NOT add `Authorization: Bearer` to the PUT request. The `Authorization` header goes only on requests to the Hono API (`/coach/imports/*`). [VERIFIED: codebase — service.ts uses `adminSupabase.storage.createSignedUploadUrl`]

### Anti-Patterns to Avoid

- **Adding `Authorization` to signed URL PUT:** The signed URL is opaque and self-authenticating. Adding an `Authorization` header will cause Supabase Storage to reject the upload with 400.
- **Polling on non-terminal status without cleanup:** Always store the interval handle and clear it in the `useEffect` cleanup, on `removeFile`, and on terminal status. Missing cleanup causes memory leaks and state updates on unmounted components.
- **Using `e.dataTransfer.files` without `e.preventDefault()` in `onDragOver`:** The browser will navigate away instead of triggering `onDrop`.
- **Triggering the pipeline inside the `onDrop`/`onChange` handlers directly:** Complex async pipelines triggered from event handlers are harder to test and debug. Prefer the reactive `useEffect` pattern that watches `fileStates`.
- **Calling `onSuccess` in Phase 2:** Explicitly deferred (D-17). Phase 3 decides when to advance.
- **Replacing the chat bubble container:** Phase 3 appends to it. The root `<div class="flex flex-col gap-3 mb-6">` must not be restructured or conditionally hidden.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| File type spinner | Custom animated component | Tailwind `animate-spin` on a `border-t-transparent rounded-full` div | Already in Tailwind; zero additional code |
| File type icons | Emoji or custom SVG | `react-icons/io5` — `IoDocumentOutline`, `IoGridOutline`, `IoReaderOutline`, `IoCloudUploadOutline`, `IoCloseOutline` | Already installed; consistent with all other coach components |
| ID generation for FileState | UUID library | `crypto.randomUUID()` (browser API) | Already used throughout the web codebase (SessionSlideOver.tsx) |
| Byte formatting | External lib | Inline `formatBytes` function (~5 lines) | Too small to justify a dependency |

**Key insight:** This phase needs zero new dependencies. All tools (icons, animation, UUID, i18n) are already available.

---

## Common Pitfalls

### Pitfall 1: Polling after Unmount (Stale State Update)
**What goes wrong:** `setInterval` fires after component unmounts; React throws "Can't perform a state update on unmounted component".
**Why it happens:** Missing cleanup in `useEffect` return function.
**How to avoid:** Store ALL active interval handles in a `useRef<Map>`. Return a cleanup function that iterates and clears them all. Also clear individual handles on terminal status and on `removeFile`.
**Warning signs:** Console warning "Warning: Can't perform a state update on an unmounted component."

### Pitfall 2: Uploading to Signed URL with Auth Header
**What goes wrong:** Supabase Storage rejects the PUT with a 400 or 403 error.
**Why it happens:** The signed URL includes authentication in the URL parameters. Adding an `Authorization` header conflicts.
**How to avoid:** Omit the `Authorization` header on the `fetch(signedUrl, { method: 'PUT', body: file, headers: { 'Content-Type': file.type } })` call.
**Warning signs:** Storage upload returns non-200, `error_message` will reflect "Storage download failed" in the parse step later.

### Pitfall 3: DragOver Without preventDefault
**What goes wrong:** `onDrop` never fires; browser opens the dropped file in a new tab.
**Why it happens:** `dragover` default browser behavior is to open the file.
**How to avoid:** Always call `e.preventDefault()` inside `onDragOver`.
**Warning signs:** Drop zone visually highlights (border changes) but nothing happens on drop.

### Pitfall 4: Race Condition — Pipeline Triggered Twice
**What goes wrong:** Same file triggers `POST /coach/imports` twice (duplicate DB rows).
**Why it happens:** `useEffect` with `fileStates` dependency re-fires when state changes within the pipeline; if the idempotency guard (`!fileState.importId`) is not set atomically the effect can fire again before `importId` is written to state.
**How to avoid:** Use a `useRef<Set<string>>` to track "pipeline started" file IDs, checked before `POST /coach/imports`, in addition to the state check. Alternatively, use a functional update pattern and move the pipeline into the event handler instead of a `useEffect`.
**Warning signs:** Duplicate import records in the DB; `PUT /status` receives 409 "Cannot transition from 'uploaded' to 'uploaded'".

### Pitfall 5: `status` Mismatch Between UI State and API State
**What goes wrong:** The UI shows `uploading` but the API already has `parsing`, or vice versa.
**Why it happens:** UI state transitions are driven locally; polling only updates from `GET /:id`. The local state must be explicitly set to `parsing` after `POST /:id/parse` returns 202 — polling alone would eventually catch it, but there may be a 3s delay showing wrong status.
**How to avoid:** Update local `FileState.status` to `'parsing'` immediately after `POST /:id/parse` 202 returns, before the first poll tick.
**Warning signs:** Status pill stuck on "Envoi…" after `parse` was triggered.

### Pitfall 6: FileList is Not an Array
**What goes wrong:** `Array.prototype.slice.call(files)` or `[...files]` works, but direct iteration index access can be error-prone in edge cases.
**Why it happens:** `FileList` (from `input.files` and `dataTransfer.files`) is array-like but not an `Array`.
**How to avoid:** Use `Array.from(fileList)` consistently. [VERIFIED: codebase — standard pattern]

---

## Code Examples

### API Request Pattern (authenticated Hono calls)
```typescript
// Source: verified from FileUploadRow.tsx and coach component patterns in codebase
const res = await fetch(`${apiUrl}/coach/imports`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${jwt}`,
  },
  body: JSON.stringify({
    filename: file.name,
    mime_type: file.type,
    size_bytes: file.size,
    mode: 'coach_template',  // always for Phase 2 (02-CONTEXT.md code_context)
  }),
});
if (!res.ok) throw new Error(await res.text());
const { import_id, signed_upload_url } = await res.json() as {
  import_id: string;
  signed_upload_url: string;
};
```

### Polling Pattern
```typescript
// Source: 02-CONTEXT.md D-13, D-14
function startPolling(importId: string, fileId: string) {
  const handle = setInterval(async () => {
    try {
      const res = await fetch(`${apiUrl}/coach/imports/${importId}`, {
        headers: { Authorization: `Bearer ${jwt}` },
      });
      if (!res.ok) return; // transient error — keep polling
      const { import: importRow } = await res.json() as { import: { status: string; error_message: string | null } };
      if (importRow.status === 'ready' || importRow.status === 'failed') {
        clearInterval(handle);
        intervalsRef.current.delete(fileId);
        setFileStates(prev =>
          prev.map(f =>
            f.id === fileId
              ? { ...f, status: importRow.status as FileStatus, errorMessage: importRow.error_message ?? undefined }
              : f,
          ),
        );
      }
    } catch {
      // network error — keep polling
    }
  }, 3000);
  intervalsRef.current.set(fileId, handle);
}
```

### Chat Bubble DOM (from UI-SPEC, verified against MessageBubble.tsx pattern)
```tsx
// Source: 02-UI-SPEC.md Component Inventory §1, 02-CONTEXT.md D-02
// Note: MessageBubble.tsx uses similar avatar pattern (w-8 h-8 rounded-full bg-primary)
// Phase 2 uses rounded-lg (not rounded-full) per D-02 exact spec
<div className="flex flex-col gap-3 mb-6">
  <div className="flex items-start gap-2">
    <div className="bg-primary text-white w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold shrink-0">
      IA
    </div>
    <div className="bg-surface-alt rounded-xl rounded-tl-none px-4 py-3 text-sm text-text max-w-xs">
      {t('step4AiGreeting')}
    </div>
  </div>
</div>
```

### formatBytes Helper
```typescript
// No external dep needed — ~5 lines
function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
}
```

---

## API Contract (Verified)

All routes verified by reading `backend/api/src/coach/imports/service.ts` and `types.ts` directly. [VERIFIED: codebase]

### POST /coach/imports
**Request body:** `{ filename: string, mime_type: string, size_bytes: number, mode: 'coach_template' }`
**Response 201:** `{ import_id: string, signed_upload_url: string, path: string }`
**Validations enforced server-side:** mime_type allowlist, size_bytes 1–26214400 (25 MB), mode must be `'athlete'` or `'coach_template'`.

**Allowed MIME types** (from `ALLOWED_MIME_TYPES` constant):
- `application/pdf`
- `image/png`, `image/jpeg`
- `application/vnd.ms-excel`
- `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`
- `application/vnd.openxmlformats-officedocument.wordprocessingml.document`

**Important:** The input `accept` attribute uses file extensions (`.pdf,.xlsx,.xls,.docx`) but `file.type` returns the MIME type. Mapping needed:
- `.pdf` → `application/pdf`
- `.xlsx` → `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`
- `.xls` → `application/vnd.ms-excel`
- `.docx` → `application/vnd.openxmlformats-officedocument.wordprocessingml.document`

The browser sets `file.type` automatically from the file extension on selection. Passing `file.type` directly to the API is correct.

### Signed URL PUT (Supabase Storage)
**Request:** `fetch(signed_upload_url, { method: 'PUT', body: file, headers: { 'Content-Type': file.type } })`
**No Authorization header** — signed URL is self-authenticating.
**Success:** HTTP 200.

### PUT /coach/imports/:id/status
**Request body:** `{ status: 'uploaded' }`
**Response 200:** `{ ok: true }`
**Constraint:** Only works from `pending` → `uploaded`. Returns 409 if already transitioned.

### POST /coach/imports/:id/parse
**Request body:** empty (no body required)
**Response 202:** `{ ok: true, status: 'parsing' }` (async — returns immediately)
**Constraint:** Must be `uploaded` status. Returns 402 if insufficient credits.

### GET /coach/imports/:id
**Response 200:** `{ import: ImportRow }` where `ImportRow.status` is `'pending' | 'uploaded' | 'parsing' | 'ready' | 'failed' | 'committed'`
**Key polling fields:** `status`, `error_message: string | null`
**Terminal statuses for polling:** `ready`, `failed`

---

## i18n Keys

### Existing Keys in Onboarding Namespace (must NOT overwrite)
```
step4Heading, step4Subtitle, step4Skip   ← Phase 1 keys, already in both fr.json and en.json
```
[VERIFIED: codebase — `apps/web/messages/fr.json` lines 138–140, `apps/web/messages/en.json` lines 138–140]

### New Keys to Add in Phase 2
All under `Onboarding` namespace, per 02-UI-SPEC.md Copywriting Contract:

| Key | FR | EN |
|-----|----|----|
| `step4AiGreeting` | `Envoie-moi tes docs et je m'occupe du reste.` | `Send me your docs and I'll handle the rest.` |
| `step4DropZoneLabel` | `Glisse tes fichiers ici ou` | `Drop your files here or` |
| `step4BrowseFiles` | `Parcourir les fichiers` | `Browse files` |
| `step4CapReached` | `Maximum de 4 fichiers atteint` | `Maximum of 4 files reached` |
| `step4FileUploading` | `Envoi…` | `Uploading…` |
| `step4FileParsing` | `Analyse…` | `Analyzing…` |
| `step4FileReady` | `✓ Prêt` | `✓ Ready` |
| `step4FileFailed` | `Erreur` | `Error` |
| `step4RemoveFile` | `Supprimer le fichier` | `Remove file` |

Insertion point: after `step4Skip` key in both files (alphabetical/sequential grouping maintained). [VERIFIED: fr.json structure]

---

## Tailwind v4 Tokens in Use

All tokens verified in `apps/web/src/app/globals.css`. [VERIFIED: codebase]

| Tailwind Class | CSS Variable | Hex | Use in Phase 2 |
|----------------|-------------|-----|----------------|
| `bg-primary` | `--color-primary` | `#FF5C1A` | Avatar bg, drag-over border |
| `border-border` | `--color-border` | `#E2E0DA` | Drop zone default border, file card border |
| `text-muted` | `--color-muted` | `#6B6963` | File size, drop zone labels, × hover |
| `text-text` | `--color-text` | `#1C1A17` | Filenames, chat bubble text |
| `bg-surface-alt` | `--color-surface-alt` | `#F0EFE9` | Chat bubble background |
| `text-danger` | `--color-danger` | `#EF4444` | Not used in Phase 2 |

**Non-semantic status pill colors** (Tailwind built-in, no custom token needed):
- Uploading: `bg-blue-50 text-blue-600`
- Parsing: `bg-orange-50 text-orange-600`
- Ready: `bg-green-50 text-green-700`
- Failed: `bg-red-50 text-red-600`
- Inline error: `text-red-500`

---

## State of the Art

| Old Approach | Current Approach | Impact |
|--------------|------------------|--------|
| External dropzone library (react-dropzone) | Custom native drag events | Decided in D-04 — no new dep |
| Global Zustand store for upload state | Local `useState` in component | Decided in D-16 — appropriate for phase-scoped state |
| XHR with progress events | Plain `fetch` PUT | Progress bar deferred (D context) |

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `e.preventDefault()` in `onDragOver` is required to receive `onDrop` events | Common Pitfalls §3 | Drop functionality broken; easy to discover and fix |
| A2 | Browser sets `file.type` from extension automatically on file selection | API Contract | Wrong MIME type sent to API → 400 validation error; would be caught in testing |
| A3 | `crypto.randomUUID()` is available in all target browsers for the web coach app | Code Examples | Falls back to `Date.now().toString(36)` pattern already present in codebase |

**If this table is near-empty:** Most claims were verified directly from the codebase.

---

## Environment Availability

Step 2.6: No new external dependencies. All tools are already installed. SKIPPED (code-only change with existing dependencies).

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Not detected — no `jest.config.*`, `vitest.config.*`, or test files in `apps/web/` |
| Config file | None found |
| Quick run command | N/A |
| Full suite command | N/A |

No existing test infrastructure in `apps/web/src/` was found by inspection. This phase is UI-only — manual smoke testing is the validation approach.

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| UPLOAD-01 | 4-file cap enforced; accepts PDF/Excel/Word | manual-only | N/A — no test framework | N/A |
| UPLOAD-02 | Chat bubble renders with step4AiGreeting text | manual-only | N/A | N/A |
| UPLOAD-03 | Pipeline fires per file (POST → PUT → PUT status → POST parse → poll GET) | manual-only | N/A | N/A |

**Justification for manual-only:** No web test framework is configured. Pipeline tests would require mocking 5 sequential fetch calls and a setInterval — acceptable cost at this phase given no existing test infrastructure.

### Wave 0 Gaps
- No test infrastructure gaps to create — manual verification via running `npm run dev` and exercising the Step 4 UI.

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | JWT passed via prop, validated server-side by authMiddleware |
| V3 Session Management | no | Session managed by existing OnboardingWizard/Supabase |
| V4 Access Control | no | RLS `ai_imports_own` enforces owner-only access server-side |
| V5 Input Validation | yes | File MIME type validated by browser accept attr; server re-validates (service.ts lines 90-94) |
| V6 Cryptography | no | Signed URLs use Supabase-managed crypto |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Uploading malicious file masquerading as PDF | Tampering | Server-side MIME allowlist + size check in `POST /coach/imports` (already in place) |
| Polling import IDs belonging to other users | Elevation of Privilege | RLS `ai_imports_own` policy — `GET /:id` returns 404 for non-owned rows |
| Uploading a 25.1 MB file | Tampering | `MAX_SIZE_BYTES = 26_214_400` enforced server-side; client input `file.size` is advisory only |

No client-side security controls are needed beyond passing the JWT on API calls. The backend handles all authorization.

---

## Sources

### Primary (HIGH confidence)
- `backend/api/src/coach/imports/service.ts` — all 6 routes, request/response shapes, status machine
- `backend/api/src/coach/imports/types.ts` — `ImportRow`, `CreateImportBody`, `ImportStatus` types
- `apps/web/src/components/coach/WizardStep4Import.tsx` — Phase 1 shell, exact insertion point
- `apps/web/src/components/coach/WizardStep3Kyc.tsx` — reference card DOM structure and prop pattern
- `apps/web/src/components/coach/FileUploadRow.tsx` — existing upload pattern (KYC file upload)
- `apps/web/src/components/coach/MessageBubble.tsx` — existing chat avatar pattern
- `apps/web/src/app/globals.css` — all Tailwind v4 token definitions
- `apps/web/messages/fr.json` / `en.json` — existing Onboarding namespace keys
- `.planning/workstreams/onboarding/phases/02-upload-ux-pipeline/02-CONTEXT.md` — all locked decisions
- `.planning/workstreams/onboarding/phases/02-upload-ux-pipeline/02-UI-SPEC.md` — all visual specs
- `.planning/codebase/CONVENTIONS.md` — web coding conventions

### Secondary (MEDIUM confidence)
- None required — all critical claims verified directly from codebase.

### Tertiary (LOW confidence — marked [ASSUMED])
- A1, A2, A3 in Assumptions Log above.

---

## Metadata

**Confidence breakdown:**
- API contract: HIGH — read directly from service.ts and types.ts
- State model: HIGH — prescribed exactly in CONTEXT.md D-16 and UI-SPEC
- i18n keys: HIGH — existing keys verified in fr.json + en.json; new keys from UI-SPEC
- Tailwind tokens: HIGH — all verified in globals.css
- Polling pattern: HIGH — prescribed exactly in D-13/D-14; setInterval cleanup is standard React
- Icons: HIGH — react-icons/io5 confirmed installed and in use throughout coach components

**Research date:** 2026-05-30
**Valid until:** 2026-06-30 (stable stack — no fast-moving dependencies)
