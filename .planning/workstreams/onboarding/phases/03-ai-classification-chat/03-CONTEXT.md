# Phase 3: AI Classification & Chat - Context

**Gathered:** 2026-05-30
**Status:** Ready for planning

<domain>
## Phase Boundary

Extend the Phase 2 chat UI in `WizardStep4Import.tsx` with a conversational AI layer: as each file reaches `ready` status, classify its type (da_coach vs template_programme) using the `overall_confidence` from `parsed_data`, append a plain-language IA summary bubble, and — when confidence is borderline (0.4–0.6) — ask a clarification question with choice buttons. Coach can reply to resolve the type. Once all ready files are classified and clarifications resolved, a Continue button appears to advance to Phase 4. No backend changes.

</domain>

<decisions>
## Implementation Decisions

### Classification Logic
- **D-01:** Classification is derived from `overall_confidence` in `parsed_data`: `>= 0.6` → `template_programme`, `< 0.4` → `da_coach` (confident), `0.4–0.6` → ambiguous (triggers clarification question).
- **D-02:** `données_client` type is NOT shown in v1.0. All docs below the template threshold fold into `da_coach`. Only two visible types: `da_coach` and `template_programme`.
- **D-03:** The classification type (`docType`) lives in local React state only — added to `FileState`. No API call to persist. Phase 4 receives it via parent state.

### Summary Message Content
- **D-04:** Summary messages are template strings built from `parsed_data` fields — no AI API call, zero added latency.
  - `template_programme` summary: `"J'ai analysé [name] — c'est un programme de [N] semaines avec [M] séances par semaine."` (exact wording at Claude's discretion).
  - `da_coach` summary: generic message indicating it looks like a coaching methodology doc (e.g., `"J'ai reçu [filename] — ce document ressemble à une DA coach ou un document méthodologique."`). Exact French wording at Claude's discretion.
- **D-05:** Summary message appends to the existing Phase 2 chat bubble container (D-01 from Phase 2 — never replace, only append).

### Ambiguity Flow
- **D-06:** Ambiguity trigger: `overall_confidence` in `[0.4, 0.6)` (borderline range). Below 0.4 = classified as `da_coach` confidently (no question). Above 0.6 = classified as `template_programme` (no question).
- **D-07:** Clarification UX: the IA bubble renders two clickable pill buttons inline in the chat — "Template programme" and "DA coach". No text input. Coach taps one.
- **D-08:** After coach clicks a clarification button:
  1. Update `docType` in local `FileState`.
  2. The IA appends a short confirmation bubble (e.g., `"Compris — j'ai mis à jour le type."`). Exact wording at Claude's discretion.
  3. The choice buttons are replaced by the coach's selection shown as a right-aligned coach bubble (matching the established chat metaphor).
  4. No API call.

### Trigger Timing & Advance
- **D-09:** Phase 3 triggers **per file**, immediately when polling detects `status === 'ready'`. Classification + summary bubble appear as soon as a file is ready — no waiting for other files.
- **D-10:** The "Continuer →" primary button appears when: `(at least 1 file is ready) AND (all ready files have a confirmed docType — either auto-classified or coach-resolved via clarification)`. Failed files do NOT block the button.
- **D-11:** Clicking "Continuer →" calls `onSuccess()` — advancing to Phase 4 Review. The existing "Ignorer pour l'instant" skip button remains alongside it.

### Claude's Discretion
- Exact French wording for all IA chat messages (summary, confirmation, clarification question text).
- Visual styling of the clarification choice pills (size, spacing, active/hover state) within the established Tailwind v4 palette.
- Exact Tailwind classes for right-aligned coach reply bubbles (mirroring the left-aligned IA bubble pattern from Phase 2, but flipped).
- i18n key names for new chat messages under the `Onboarding` namespace.
- Whether the `docType` badge (da_coach / template_programme) is displayed on the file card row, in the chat bubble, or both.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements & Roadmap
- `.planning/workstreams/onboarding/REQUIREMENTS.md` — PARSE-01, PARSE-02, PARSE-03 are the exact acceptance criteria for Phase 3
- `.planning/workstreams/onboarding/ROADMAP.md` — Phase 3 success criteria (4 items)

### Prior Phase Context (mandatory reading)
- `.planning/workstreams/onboarding/phases/02-upload-ux-pipeline/02-CONTEXT.md` — D-01 (chat container: Phase 3 appends, never replaces), D-02 (avatar style), D-16 (FileState type), D-17 (onSuccess not triggered in Phase 2 — Phase 3 decides when to advance)
- `.planning/workstreams/onboarding/phases/01-wizard-integration/01-CONTEXT.md` — prop interface, card structure, i18n namespace

### Component to Extend
- `apps/web/src/components/coach/WizardStep4Import.tsx` — Phase 2 implementation. Phase 3 extends `FileState`, adds classification logic in polling callback, and appends IA chat messages to the existing bubble container. Read completely before planning.

### Backend API (Phase 28 — no changes)
- `backend/api/src/coach/imports/types.ts` — `ImportRow` type: `parsed_data: Record<string, unknown> | null`, `confidence_scores: Record<string, unknown> | null`, `overall_confidence` lives inside `parsed_data` (as `ImportedProgramSchema.overall_confidence`)
- `backend/api/src/coach/imports/parse/claude.ts` — How `overall_confidence` is computed (weighted average of exercise confidence values). Understand this to know what values to expect in practice.

### Parsed Data Schema
- `packages/coach-sdk/src/schemas/imported-program.ts` — `ImportedProgramSchema`: `name`, `goal`, `weeks: WeekSchema[]` (each week has `sessions: SessionSchema[]` with `exercises[]`), `overall_confidence: number | null`. Use this to build the template summary strings.

### i18n Files
- `apps/web/messages/fr.json` — Add Phase 3 chat message keys under `Onboarding` namespace
- `apps/web/messages/en.json` — Same keys, English values

### Design & Conventions
- `.planning/codebase/CONVENTIONS.md` — Web section: `'use client'`, Tailwind v4, `react-icons/io5`, named exports, no default exports

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **Phase 2 chat container** — already rendered in WizardStep4Import.tsx: `<div className="flex flex-col gap-3 mb-6">` containing `<div className="flex items-start gap-2">` (IA avatar + bubble). Phase 3 appends more `flex items-start gap-2` rows to this container.
- **IA avatar style** (canonical, from D-02 Phase 2): `bg-primary text-white w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold shrink-0` with text "IA".
- **IA bubble style**: `bg-surface-alt rounded-xl rounded-tl-none px-4 py-3 text-sm text-text max-w-xs`
- **FileState type** (Phase 2): `{ id: string; file: File; importId?: string; status: FileStatus; errorMessage?: string }` — Phase 3 adds `docType?: 'da_coach' | 'template_programme'` and `clarificationPending?: boolean`.
- **Polling callback** (`startPolling`) — when `importRow.status === 'ready'`, Phase 3 logic runs here: read `parsed_data.overall_confidence`, set `docType`, append chat message.

### Established Patterns
- State updates via `setFileStates(prev => prev.map(...))` functional updater.
- i18n via `useTranslations('Onboarding')` — already initialized, no setup needed.
- Tailwind v4 semantic tokens: `text-primary`, `bg-surface-alt`, `border-border`, `text-muted` — no hex values in JSX.
- No default exports — `export function WizardStep4Import(`.
- `'use client';` already present.

### Integration Points
- Phase 3 classification + chat must run inside the existing `startPolling` interval callback at the `if (importRow.status === 'ready')` branch — no new polling loop needed.
- `onSuccess()` is called by Phase 3's "Continuer →" button — this is the first time `onSuccess` is called in the wizard flow (Phase 2 deliberately deferred it, per D-17).
- `parsed_data` arrives as `Record<string, unknown>` from the API response — cast it as `z.infer<typeof ImportedProgramSchema>` or access `(parsed_data as any).overall_confidence` for the classification threshold check.

</code_context>

<specifics>
## Specific Ideas

- The clarification choice pills ("Template programme" / "DA coach") should render as clickable buttons INSIDE the IA chat bubble — not below it. The bubble body contains the question text followed by the two pill buttons.
- After clarification: the coach's choice appears as a right-aligned bubble (no avatar, right-aligned flex row), then the IA confirmation bubble appears below it. This creates a conversational back-and-forth pattern.
- The "Continuer →" button uses `bg-primary text-white` styling consistent with other primary CTAs in the web app. It appears below the file list (not inside the chat area).
- `overall_confidence` can be `null` if parsing succeeded but confidence was not set — treat `null` as `< 0.4` (da_coach, confident, no clarification).

</specifics>

<deferred>
## Deferred Ideas

- **données_client type** — displaying and handling this third type is deferred to a future phase (no target table in v1.0, per REQUIREMENTS.md).
- **Retry button on failed files** — noted in Phase 2 deferred, still out of scope here.
- **Re-uploading or replacing a failed file** — out of scope in v1.0.

</deferred>

---

*Phase: 03-AI Classification & Chat*
*Context gathered: 2026-05-30*
