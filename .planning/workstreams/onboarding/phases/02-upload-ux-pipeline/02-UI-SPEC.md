---
phase: 2
slug: upload-ux-pipeline
status: draft
shadcn_initialized: false
preset: none
created: 2026-05-30
---

# Phase 2 — UI Design Contract: Upload UX & Pipeline

> Visual and interaction contract for the file upload UI inside `WizardStep4Import.tsx`.
> All decisions pre-populated from 02-CONTEXT.md. No new design decisions introduced.
> Phase 2 fills the `{/* Phase 2: upload UI goes here */}` slot in the existing Phase 1 card shell.

---

## Design System

| Property | Value | Source |
|----------|-------|--------|
| Tool | none | Tailwind CSS only — no shadcn, no component library |
| Preset | not applicable | No shadcn |
| Component library | none | Tailwind utility classes only |
| Icon library | `react-icons/io5` | 02-CONTEXT.md canonical refs, web app convention |
| Font | System default (Inter via Tailwind) | Inherited from existing wizard steps (Phase 1 UI-SPEC) |

---

## Spacing Scale

Inherits from Phase 1. No new scale values introduced. All values are multiples of 4.

| Token | Value | Tailwind | Usage in this phase |
|-------|-------|----------|---------------------|
| xs | 4px | `gap-1` | File icon ↔ filename gap |
| sm | 8px | `gap-2` / `p-2` | Avatar ↔ bubble gap; status pill internal padding |
| md | 16px | `p-4` / `gap-4` | File card row padding; drop zone button margin |
| lg | 24px | `p-6` / `gap-6` | Chat bubble container bottom margin before drop zone |
| xl | 32px | `mt-8` | Button row top margin (inherited from Phase 1 shell) |
| 2xl | 48px | `py-12` | Page container vertical padding (parent, unchanged) |
| 3xl | 64px | — | Not used in this phase |

Exceptions:
- Avatar: `w-8 h-8` (32px square) — prescribed exactly in D-02.
- Drop zone min-height: `min-h-[120px]` — fits comfortably within the `p-8` card without overflow.
- Touch/click target on × remove button: `w-8 h-8` (32px) minimum.

---

## Typography

Inherits Phase 1 type scale. Two new roles added for file card micro-text.

| Role | Size | Weight | Line Height | Tailwind Classes | Usage |
|------|------|--------|-------------|------------------|-------|
| Step heading | 20px (xl) | 700 (bold) | 1.4 | `text-xl font-bold text-text` | Card H2 (unchanged from Phase 1) |
| Step subtitle | 14px (sm) | 400 (normal) | 1.5 | `text-sm font-normal text-muted` | Card body copy (unchanged) |
| Chat bubble body | 14px (sm) | 400 (normal) | 1.5 | `text-sm text-text` | AI opening message text |
| File card filename | 14px (sm) | 500 (medium) | 1.4 | `text-sm font-medium text-text` | Filename in file card row |
| File card meta | 12px (xs) | 400 (normal) | 1.4 | `text-xs text-muted` | File size, inline error message |
| Status pill label | 12px (xs) | 500 (medium) | 1.0 | `text-xs font-medium` | State label inside pill |
| Drop zone label | 14px (sm) | 400 (normal) | 1.5 | `text-sm text-muted` | Drop zone instructions |
| Avatar initials | 12px (xs) | 700 (bold) | 1.0 | `text-xs font-bold` | "IA" inside avatar circle |
| Button label (ghost) | 14px (sm) | 400 (normal) | n/a | `text-sm font-normal text-muted` | Skip button (unchanged) |

---

## Color

Inherits Phase 1 palette. Phase 2 adds four semantic pill color pairs and one drag-over state.

| Role | Hex | Tailwind Token | Usage |
|------|-----|----------------|-------|
| Dominant (60%) | `#F7F6F3` | `bg-background` | Page background (parent component, unchanged) |
| Secondary (30%) | `#FFFFFF` | `bg-white` | Card surface (unchanged from Phase 1) |
| Accent (10%) | `#FF5C1A` | `bg-primary` / `text-primary` / `border-primary` | Avatar background; drag-over drop zone border + `bg-primary/5` tint |
| Border default | `#E2E0DA` | `border-border` | Drop zone default dashed border; file card border |
| Text | `#1C1A17` | `text-text` | Filenames, chat bubble text |
| Muted text | `#6B6963` | `text-muted` | File size, drop zone instructions, skip button |
| Status: uploading | — | `bg-blue-50 text-blue-600` | "Envoi…" pill — uploading state |
| Status: parsing | — | `bg-orange-50 text-orange-600` | "Analyse…" pill — parsing state |
| Status: ready | — | `bg-green-50 text-green-700` | "✓ Prêt" pill — ready state |
| Status: failed | — | `bg-red-50 text-red-600` | "Erreur" pill — failed state |
| Error text | — | `text-red-500` | Inline error string below filename |
| Cap indicator | — | `opacity-50` on drop zone | When 4-file cap is hit, drop zone dims |
| Destructive | `#EF4444` | `text-danger` | Not used in Phase 2 (× is best-effort remove, no confirmation) |

Accent (`#FF5C1A`) reserved for:
1. AI avatar background (`bg-primary`)
2. Drop zone drag-over border (`border-primary`)
3. Drop zone drag-over background tint (`bg-primary/5`)

No other elements use accent in this phase. Status pills use their own semantic colors from Tailwind's blue/orange/green/red scale — they do NOT use the primary accent.

---

## Component Inventory

### 1. AI Chat Bubble Container

**Purpose:** Renders the IA opening message. Extensible — Phase 3 appends more messages here.

**DOM structure:**
```
<div class="flex flex-col gap-3 mb-6">   ← chat message list root; Phase 3 appends <div> children here
  <div class="flex items-start gap-2">   ← single message row
    <div class="bg-primary text-white w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold shrink-0">
      IA
    </div>
    <div class="bg-surface-alt rounded-xl rounded-tl-none px-4 py-3 text-sm text-text max-w-xs">
      {t('step4AiGreeting')}
    </div>
  </div>
</div>
```

**Rules:**
- Avatar: `bg-primary text-white w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold shrink-0` — exact per D-02.
- Bubble background: `bg-surface-alt` (`#F0EFE9`) — chat feel distinct from white card surface.
- Bubble border radius: `rounded-xl rounded-tl-none` — removes top-left corner to point toward avatar.
- Container root element is the anchor Phase 3 appends to — do not remove or restructure it.

### 2. Drop Zone

**Purpose:** Accepts drag-and-drop or file picker input for up to 4 files.

**DOM structure:**
```
<div
  onDragOver={…}
  onDragLeave={…}
  onDrop={…}
  class="
    border-2 border-dashed rounded-xl min-h-[120px]
    flex flex-col items-center justify-center gap-3 p-6
    transition-colors
    {isDragOver ? 'border-primary bg-primary/5' : 'border-border'}
    {isCapHit ? 'opacity-50 pointer-events-none' : ''}
  "
>
  <IoCloudUploadOutline class="w-8 h-8 text-muted" />    ← from react-icons/io5
  <p class="text-sm text-muted text-center">
    {isCapHit ? t('step4CapReached') : t('step4DropZoneLabel')}
  </p>
  <button
    type="button"
    onClick={() => inputRef.current?.click()}
    disabled={isCapHit}
    class="h-9 px-4 rounded-lg border border-border text-sm text-text hover:bg-surface-alt transition-colors disabled:opacity-50"
  >
    {t('step4BrowseFiles')}
  </button>
  <input
    ref={inputRef}
    type="file"
    multiple
    accept=".pdf,.xlsx,.xls,.docx"
    class="hidden"
    onChange={…}
  />
</div>
```

**State transitions:**
| State | Border | Background | Opacity | Pointer events |
|-------|--------|------------|---------|----------------|
| default | `border-border` dashed | transparent | 100% | enabled |
| drag-over (`isDragOver=true`) | `border-primary` dashed | `bg-primary/5` | 100% | enabled |
| cap hit (4 files) | `border-border` dashed | transparent | 50% (`opacity-50`) | none (`pointer-events-none`) |

**Rules:**
- Drop zone stays visible after file selection (D-05). Never hide or collapse it.
- 5th file drop is silently blocked — no toast, no error modal, just the dim visual (D-06).
- `isCapHit` = `fileStates.length >= 4`.

### 3. File Card Row

**Purpose:** Displays per-file status during the pipeline.

**DOM structure:**
```
<div class="flex items-center gap-3 p-3 rounded-xl border border-border bg-white">
  <div class="shrink-0 text-muted">
    {fileTypeIcon}               ← see File Type Icons section below
  </div>
  <div class="flex-1 min-w-0">
    <p class="text-sm font-medium text-text truncate">{file.name}</p>
    <p class="text-xs text-muted">{formatBytes(file.size)}</p>
    {status === 'failed' && errorMessage && (
      <p class="text-xs text-red-500 mt-0.5 truncate" title={errorMessage}>
        {errorMessage.length > 80 ? errorMessage.slice(0, 80) + '…' : errorMessage}
      </p>
    )}
  </div>
  <StatusPill status={fileState.status} />
  <button
    type="button"
    onClick={() => removeFile(fileState.id)}
    class="shrink-0 w-8 h-8 flex items-center justify-center rounded-lg text-muted hover:text-text hover:bg-surface-alt transition-colors"
    aria-label="Supprimer le fichier"
  >
    <IoCloseOutline class="w-4 h-4" />
  </button>
</div>
```

**Rules:**
- × button is always visible regardless of status (D-11).
- Removing a file clears its polling interval immediately.
- File list renders below the drop zone with `gap-2` between rows.

### 4. Status Pill

**Purpose:** Communicates pipeline state for each file.

| Status | Tailwind classes | Label (FR) | Spinner |
|--------|-----------------|------------|---------|
| `uploading` | `bg-blue-50 text-blue-600` | "Envoi…" | yes |
| `parsing` | `bg-orange-50 text-orange-600` | "Analyse…" | yes |
| `ready` | `bg-green-50 text-green-700` | "✓ Prêt" | no |
| `failed` | `bg-red-50 text-red-600` | "Erreur" | no |

**DOM structure:**
```
<span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium {colorClasses}">
  {hasSpinner && <span class="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />}
  {label}
</span>
```

Spinner is a pure CSS border-spin (`animate-spin` from Tailwind) — no additional dependency.

### 5. File Type Icons

**Mapping** (react-icons/io5):

| Extension | Icon component | Fallback emoji (if io5 not available) |
|-----------|---------------|--------------------------------------|
| `.pdf` | `<IoDocumentOutline />` | 📄 |
| `.xlsx`, `.xls` | `<IoGridOutline />` | 📊 |
| `.docx` | `<IoReaderOutline />` | 📝 |
| unknown | `<IoDocumentOutline />` | 📄 |

Icon size: `w-5 h-5` (20px). Color: `text-muted`.

---

## State Model (for executor reference)

```ts
type FileStatus = 'uploading' | 'parsing' | 'ready' | 'failed';

type FileState = {
  id: string;               // uuid — generated client-side at drop/select time
  file: File;               // native File object
  importId?: string;        // returned by POST /coach/imports
  status: FileStatus;
  errorMessage?: string;    // from GET /:id response field error_message
};
```

Local state only — no Zustand store, no context (D-16).

---

## Pipeline Contract (non-visual reference)

| Step | Action | Triggers next step |
|------|--------|--------------------|
| 1 | `POST /coach/imports` with `{ filename, mime_type, size_bytes, mode: 'coach_template' }` | On 201 response |
| 2 | `fetch(signedUrl, { method: 'PUT', body: file, headers: { 'Content-Type': file.type } })` | On 200 response |
| 3 | `PUT /coach/imports/:id/status` with `{ status: 'uploaded' }` | On 200 response |
| 4 | `POST /coach/imports/:id/parse` | On 200 response |
| 5 | Poll `GET /coach/imports/:id` every 3s | Until status is `ready` or `failed` |

All files fire in parallel (D-12). Polling via `setInterval` — clear on terminal status or component unmount (D-14).

---

## Copywriting Contract

All keys under `Onboarding` namespace in `fr.json` / `en.json` via `next-intl`.

| i18n Key | FR value | EN value | Source |
|----------|----------|----------|--------|
| `step4AiGreeting` | `Envoie-moi tes docs et je m'occupe du reste.` | `Send me your docs and I'll handle the rest.` | D-03 |
| `step4DropZoneLabel` | `Glisse tes fichiers ici ou` | `Drop your files here or` | Claude's discretion |
| `step4BrowseFiles` | `Parcourir les fichiers` | `Browse files` | D-04 |
| `step4CapReached` | `Maximum de 4 fichiers atteint` | `Maximum of 4 files reached` | D-06 |
| `step4FileUploading` | `Envoi…` | `Uploading…` | D-09 |
| `step4FileParsing` | `Analyse…` | `Analyzing…` | D-09 |
| `step4FileReady` | `✓ Prêt` | `✓ Ready` | D-09 |
| `step4FileFailed` | `Erreur` | `Error` | D-09 |
| `step4RemoveFile` | `Supprimer le fichier` | `Remove file` | aria-label on × button |
| `step4Heading` | `Importer vos documents` | `Import your documents` | Phase 1 (unchanged) |
| `step4Subtitle` | `Vous pourrez importer vos programmes et fiches clients une fois le compte créé.` | `You can import your programs and client files once the account is set up.` | Phase 1 (unchanged) |
| `step4Skip` | `Ignorer pour l'instant` | `Skip for now` | Phase 1 (unchanged) |

**Primary CTA:** Not present in Phase 2. `onSuccess` is not triggered (D-17). Skip button unchanged from Phase 1.

**Empty state:** Not applicable — no data list to be empty. Drop zone covers the zero-file state.

**Error state:** Inline per-file only. Error string appears below the filename in `text-xs text-red-500`, truncated at 80 characters. Source: `error_message` from `GET /coach/imports/:id`. No modal, no toast, no global error banner.

**Destructive actions:** The × remove button is not destructive (no data is permanently deleted — the import record may linger server-side but is ignored). No confirmation dialog required (D-11).

---

## Layout: Insertion Point

Phase 2 content fills the `{/* Phase 2: upload UI goes here */}` slot. The outer card shell and button row are untouched.

```
<div class="bg-white rounded-2xl p-8 border border-border shadow-sm">
  <h2 …>…</h2>
  <p …>…</p>

  ┌── Phase 2 inserts here ──────────────────────────────────────┐
  │                                                               │
  │  [AI Chat Bubble Container]                                   │
  │    └── IA avatar + "Envoie-moi tes docs…" bubble             │
  │                                                               │
  │  [Drop Zone]                                                  │
  │    └── cloud icon + label + "Parcourir les fichiers" button   │
  │                                                               │
  │  [File List]  (empty until files selected)                    │
  │    └── [File Card Row] × N (up to 4)                          │
  │         └── icon | name + size + error? | StatusPill | ×      │
  │                                                               │
  └───────────────────────────────────────────────────────────────┘

  <div class="flex gap-3 mt-8 justify-end items-center">
    <button onSkip>Ignorer pour l'instant</button>
    <!-- No primary CTA in Phase 2 -->
  </div>
</div>
```

---

## Registry Safety

| Registry | Blocks Used | Safety Gate |
|----------|-------------|-------------|
| shadcn official | none | not applicable — no shadcn |
| third-party | none | not applicable |

No third-party component registries. No new npm packages introduced — `react-icons/io5` is already installed in the web app.

---

## Checker Sign-Off

- [ ] Dimension 1 Copywriting: PASS
- [ ] Dimension 2 Visuals: PASS
- [ ] Dimension 3 Color: PASS
- [ ] Dimension 4 Typography: PASS
- [ ] Dimension 5 Spacing: PASS
- [ ] Dimension 6 Registry Safety: PASS

**Approval:** pending
