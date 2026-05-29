# Phase 2: Upload UX & Pipeline - Context

**Gathered:** 2026-05-30
**Status:** Ready for planning

<domain>
## Phase Boundary

Build the file upload UI inside `WizardStep4Import.tsx` and wire the Phase 28 pipeline (create → upload → status → parse) per file, with per-file progress display. No backend changes. Classification and chat are Phase 3. Review and commit are Phase 4.

</domain>

<decisions>
## Implementation Decisions

### IA Opening Message
- **D-01:** Render a chat bubble at the top of the card — NOT a static banner. This is the foundation that Phase 3 will build on by appending more messages to the same container. Phase 3 must NOT replace this component — it must extend it.
- **D-02:** Chat bubble anatomy: avatar (`bg-primary text-white w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold` showing "IA") + bubble div to its right. Avatar and bubble are the canonical style for all future chat messages.
- **D-03:** Opening message text (i18n key `step4AiGreeting`): `"Envoie-moi tes docs et je m'occupe du reste."` — add this key to both `fr.json` and `en.json`.

### File Picker UI
- **D-04:** Drop zone + button inside. A styled `div` with drag-over state (`onDragOver`, `onDragLeave`, `onDrop`) + a hidden `<input type="file" multiple accept=".pdf,.xlsx,.xls,.docx">` triggered by a "Parcourir les fichiers" button inside the zone. No dropzone library — custom implementation.
- **D-05:** Drop zone stays visible after files are selected. File cards appear below it. Coach can add more files incrementally up to the 4-file cap.
- **D-06:** When the 4-file cap is hit, the drop zone dims (reduced opacity) and shows "Maximum de 4 fichiers atteint". Attempting to add a 5th file is silently blocked (no error state, just the visual indicator). Coach must remove a file first.
- **D-07:** Drop zone has two visual states: default (dashed border `border-border`) and drag-over (dashed border `border-primary bg-primary/5`). Transition via `useState(isDragOver)`.

### Per-File Progress
- **D-08:** Each accepted file appears as a card row below the drop zone: file icon (based on type) + filename + size on the left, status pill on the right, × remove button on the far right.
- **D-09:** Status pill states and labels:
  - `uploading` → pill: `bg-blue-50 text-blue-600` + "Envoi…" + spinner
  - `parsing` → pill: `bg-orange-50 text-orange-600` + "Analyse…" + spinner
  - `ready` → pill: `bg-green-50 text-green-700` + "✓ Prêt" (no spinner)
  - `failed` → pill: `bg-red-50 text-red-600` + "Erreur" (no spinner) + inline error message below filename
- **D-10:** Error display: when status is `failed`, show a short inline error string below the filename in `text-xs text-red-500`. Source: the `error_message` field from `GET /:id` response. Truncate at 80 chars if needed.
- **D-11:** The × button is always visible (even during upload/parse). Clicking it removes the file card and stops polling. Best-effort cancel — the server-side parse may still complete but is ignored.

### Pipeline Orchestration
- **D-12:** All files fire in parallel. When multiple files are selected/dropped at once, all pipelines start simultaneously via `Promise.all` / independent `useEffect` triggers. No sequencing.
- **D-13:** Pipeline per file: `POST /coach/imports` → upload to signed URL (`fetch` PUT) → `PUT /:id/status { status: 'uploaded' }` → `POST /:id/parse` → poll `GET /:id` every 3 seconds until status is `ready` or `failed`. Stop polling on terminal status or component unmount.
- **D-14:** Polling via `setInterval` (3s). Clear interval on `ready`, `failed`, or file removal. Also clear on component unmount (`useEffect` cleanup).
- **D-15:** The API base URL comes from the `apiUrl` prop. JWT from the `jwt` prop. Both already passed from `OnboardingWizard`. No additional auth setup needed.

### Component Architecture
- **D-16:** All state lives in `WizardStep4Import.tsx` — no separate store for Phase 2. Each file's state tracked in a local array: `type FileState = { id: string; file: File; importId?: string; status: 'uploading' | 'parsing' | 'ready' | 'failed'; errorMessage?: string }`.
- **D-17:** The "Continue" / `onSuccess` callback is NOT triggered in Phase 2. Phase 2 ends with files in `ready` or `failed` state — Phase 3 adds the next action. The skip button (`onSkip`) remains as-is from Phase 1.

### Claude's Discretion
- File type icon mapping (📄 for PDF, 📊 for Excel, 📝 for Word) — Claude's call, keep it simple using emoji or react-icons matching existing web app icon set.
- Exact Tailwind classes for the drop zone container sizing (height, padding) within the card — must fit inside the existing `bg-white rounded-2xl p-8 border border-border shadow-sm` card.
- i18n key name for the "Maximum de 4 fichiers atteint" message — Claude picks a sensible key name under the `Onboarding` namespace.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements & Roadmap
- `.planning/workstreams/onboarding/REQUIREMENTS.md` — UPLOAD-01, UPLOAD-02, UPLOAD-03 are the exact acceptance criteria for Phase 2
- `.planning/workstreams/onboarding/ROADMAP.md` — Phase 2 success criteria (4 items)

### Phase 1 Context (prior decisions)
- `.planning/workstreams/onboarding/phases/01-wizard-integration/01-CONTEXT.md` — D-01 through D-07: prop interface, card structure, i18n namespace, skip button pattern

### Component to Modify
- `apps/web/src/components/coach/WizardStep4Import.tsx` — Phase 1 shell, Phase 2 fills it in. The `{/* Phase 2: upload UI goes here */}` comment marks the insertion point.

### Backend API (Phase 28 — no changes)
- `backend/api/src/coach/imports/service.ts` — All 6 routes: POST /, PUT /:id/status, POST /:id/parse, GET /:id, PUT /:id/commit. Read especially the POST / request body shape (`filename`, `mime_type`, `size_bytes`, `mode`) and the GET /:id response fields (`status`, `error_message`, `parsed_data`).
- `backend/api/src/coach/imports/types.ts` — `CreateImportBody`, `CommitImportBody` types

### i18n Files
- `apps/web/messages/fr.json` — Add `step4AiGreeting` under `Onboarding` namespace (after existing step4 keys)
- `apps/web/messages/en.json` — Same key, English value

### Design & Conventions
- `.planning/codebase/CONVENTIONS.md` — Web section: `'use client'` directive, Tailwind v4, `react-icons/io5` icons, named exports
- `apps/web/src/app/globals.css` — Tailwind v4 custom tokens: `--color-primary: #FF5C1A`, `--color-border: #E2E0DA`, `--color-muted: #6B6963`

### Existing Component Reference
- `apps/web/src/components/coach/WizardStep3Kyc.tsx` — Source of truth for card DOM structure and prop interface that WizardStep4Import mirrors

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `WizardStep4Import.tsx` prop interface (`userId`, `apiUrl`, `jwt`, `onSuccess`, `onSkip`) — all props needed for Phase 2 are already defined from Phase 1. `apiUrl` and `jwt` are used to call the Phase 28 backend.
- Existing card shell from Phase 1: `bg-white rounded-2xl p-8 border border-border shadow-sm` — Phase 2 fills the `{/* Phase 2: upload UI goes here */}` slot with the chat bubble + drop zone + file list.
- `goToStep()` / `useRouter` already imported in `OnboardingWizard.tsx` — no changes to the parent component in Phase 2.

### Established Patterns
- Tailwind v4 semantic tokens: `text-primary`, `bg-primary`, `border-border`, `text-muted`, `text-text` — use exclusively, no hex values in JSX.
- Named exports only: `export function WizardStep4Import(` — no default export.
- i18n via `useTranslations('Onboarding')` from `next-intl` — already wired in the Phase 1 shell.
- `'use client';` directive required — already present from Phase 1.
- No external drag-drop library (react-dropzone, etc.) — custom implementation with native browser drag events.

### Integration Points
- `POST /coach/imports` requires `mode` field — use `'coach_template'` for all Phase 2 uploads (classification of actual doc type happens in Phase 3).
- Signed upload URL: direct `fetch(signedUrl, { method: 'PUT', body: file, headers: { 'Content-Type': file.type } })` — standard Supabase signed URL PUT.
- Polling `GET /coach/imports/:id`: check `import.status` field (`pending`, `uploaded`, `parsing`, `ready`, `failed`).
- Error details in `import.error_message` (string | null) from the GET response.

</code_context>

<specifics>
## Specific Ideas

- Chat bubble avatar: `bg-primary text-white w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold` with text "IA" — user confirmed this exact style.
- Opening message: `"Envoie-moi tes docs et je m'occupe du reste."` — exact French text, confirmed.
- Drop zone stays visible after file selection. Cap hit shows "Maximum de 4 fichiers atteint" (dimmed zone).
- All files parallel — no queue, no sequencing.
- 3-second polling interval for parse status.
- The chat bubble container created in Phase 2 is the foundation for Phase 3's full conversation UI — Phase 3 appends messages to it, does NOT replace it.

</specifics>

<deferred>
## Deferred Ideas

- **Retry button on failed files** — user could click retry to re-trigger the pipeline. Deferred to a future improvement phase.
- **Upload progress bar** — showing bytes uploaded via XHR `progress` events. Deferred — polling covers the UX need for Phase 2.
- **Continue / onSuccess trigger** — Phase 2 does not call `onSuccess`. Phase 3 decides when to advance (after classification + chat). Deliberate deferral.

</deferred>

---

*Phase: 02-Upload UX & Pipeline*
*Context gathered: 2026-05-30*
