# Phase 4: Review & Commit - Context

**Gathered:** 2026-08-12
**Status:** Ready for planning

<domain>
## Phase Boundary

Coaches confirm a consolidated review of all classified docs, correct any doc type before committing, commit `coach_template` docs to `workout_programs` via `PUT /coach/imports/:id/commit`, and reach `/coach/dashboard`. This phase closes the gap left by Phase 3: today, Phase 3's "Continuer →" button calls `onSuccess()` directly, which redirects straight to the dashboard with no review or commit step — Phase 4 inserts the review screen between classification and that redirect. No backend changes (Phase 28 endpoints used as-is).

</domain>

<decisions>
## Implementation Decisions

### Review Screen Transition
- **D-01:** Clicking "Continuer →" swaps the entire `WizardStep4Import` card content to a dedicated review screen — the chat, drop zone, and file list are fully replaced (not appended below, not partially replaced). This becomes a second internal view state within the same component (e.g. `view: 'import' | 'review'`), not a new wizard step — the wizard stays at 4 steps total.
- **D-02:** The review screen is one-way: no back button to return to the file list. Once on review, the only actions are "Confirmer et importer" and "Ignorer pour l'instant".
- **D-03:** "Ignorer pour l'instant" remains available on the review screen and still redirects to `/coach/dashboard` without committing anything — consistent with Step 4 being optional throughout (PROJECT.md: not a blocker).

### Consolidated Review List
- **D-04:** All classified docs (both `coach_template` and `da_coach`) appear together in one consolidated list — satisfies REVIEW-01 ("coach sees consolidated summary of all analyzed docs"). Nothing is omitted or grouped into separate sections.
- **D-05:** `da_coach` rows show a distinct "no action" badge/label (e.g. "Enregistré comme contexte") instead of an import indicator, making clear they won't be committed — without hiding them from the review.

### Type Correction UX
- **D-06:** Each doc row on the review screen has a pill toggle (reusing Phase 3's pill-button visual pattern: "Template programme" / "DA coach") to let the coach correct the type — satisfies REVIEW-02.
- **D-07:** Changing a doc's type live-updates the commit set — the review screen shows a running count (e.g. "N programmes seront importés") that updates immediately as the coach corrects types, computed from current `docType` values at any moment (not just at confirm-click time).

### Commit Flow
- **D-08:** On "Confirmer et importer", all `coach_template`-typed docs (per D-07's live commit set) fire `PUT /coach/imports/:id/commit` in parallel (`Promise.all` / independent calls) — matches Phase 2's parallel-upload precedent. `da_coach` docs are never sent to `/commit`.
- **D-09:** Partial failure handling: successful commits stay committed. A doc whose commit call fails shows an inline error with a "Retry" button scoped to that doc only — re-fires just that doc's `PUT /:id/commit` call. This is a deliberate exception to Phase 2's "retry deferred" decision — commit failures get retry because losing an already-uploaded, already-classified doc at the final step is a worse UX than the upload-stage failures Phase 2 deferred.
- **D-10:** Once every `coach_template` doc is committed (including any retried ones), show a brief success confirmation (e.g. "3 programmes importés !") then auto-redirect to `/coach/dashboard` — no extra click required (satisfies COMPLETE-02).

### Commit Request Body
- **D-11:** `PUT /:id/commit` requires `parsed_data` (full object) in the body per `CommitImportBody` (`backend/api/src/coach/imports/types.ts`). This is NOT currently stored in `FileState` — Phase 3 only extracted display fields (`name`, `weeks`, `sessions`) transiently inside the polling closure. Phase 4 (or a small Phase 3 follow-up within this phase's plans) must persist the full `parsed_data` object per file — either by storing it on `FileState` during polling, or by re-fetching `GET /coach/imports/:id` at review time. Exact approach is Claude's discretion during planning/research — flagged here so it isn't missed.

### Claude's Discretion
- Exact French wording for the review screen heading, per-doc summary lines, success message, and retry error text.
- Whether the running "N programmes seront importés" count (D-07) is a simple text line or a styled badge/counter.
- Visual treatment of the "no action" badge for `da_coach` docs (D-05) — exact copy and styling within the established badge pattern (`bg-surface-alt text-text border border-border`, matching the existing `docType` badge from Phase 3).
- Whether the internal view-state variable is named `view`, `step`, or similar — internal implementation detail.
- i18n key names for all new Phase 4 strings under the `Onboarding` namespace.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements & Roadmap
- `.planning/workstreams/onboarding/REQUIREMENTS.md` — REVIEW-01, REVIEW-02, REVIEW-03, COMPLETE-01, COMPLETE-02 are the exact acceptance criteria for Phase 4
- `.planning/workstreams/onboarding/ROADMAP.md` — Phase 4 success criteria (5 items)

### Prior Phase Context (mandatory reading)
- `.planning/workstreams/onboarding/phases/03-ai-classification-chat/03-CONTEXT.md` — D-01 through D-11: `docType` lives in local `FileState`, only two visible types (`da_coach`, `template_programme`), pill-button visual pattern, `onSuccess()` is currently called directly by the "Continuer →" button (Phase 4 must intercept this)
- `.planning/workstreams/onboarding/phases/02-upload-ux-pipeline/02-CONTEXT.md` — D-16 (`FileState` type shape), D-17 (`onSuccess` deferral precedent), status pill / error display patterns
- `.planning/workstreams/onboarding/phases/01-wizard-integration/01-CONTEXT.md` — prop interface (`userId`, `apiUrl`, `jwt`, `onSuccess`, `onSkip`), card layout conventions

### Component to Extend
- `apps/web/src/components/coach/WizardStep4Import.tsx` — current implementation after Phase 3 (`canAdvance` logic at line 80, `onSuccess` wired directly to the "Continuer →" button at line 593). Phase 4 must intercept this click to show the review view instead of calling `onSuccess()` immediately.
- `apps/web/src/app/[locale]/coach/onboarding/OnboardingWizard.tsx` — line 98: `onSuccess={() => router.push(...coach/dashboard)}` — this is what fires after Phase 4's internal commit flow completes (D-10). No changes needed here; Phase 4 work is entirely inside `WizardStep4Import.tsx`.

### Backend API (Phase 28 — no changes)
- `backend/api/src/coach/imports/service.ts` lines 372-414 — `PUT /:id/commit` handler: requires `parsed_data` (object, required) and optional `program_name`; returns 409 if already committed or not in `ready` status; returns `{ program_id }` on success.
- `backend/api/src/coach/imports/types.ts` — `CommitImportBody` (`parsed_data: Record<string, unknown>`, `program_name?: string`), `ImportStatus` machine (`ready` → `committed`)
- `backend/api/src/coach/imports/db.ts` lines 140-221 — `commitImport()`: writes to `workout_programs`, sets `committed_program_id`/`status: 'committed'`/`committed_at` on the import row. Idempotent commit re-attempts are blocked by the route layer (409 on already-committed).

### Parsed Data Schema
- `packages/coach-sdk/src/schemas/imported-program.ts` — `ImportedProgramSchema`: shape of the `parsed_data` object required by the commit body (see D-11)

### i18n Files
- `apps/web/messages/fr.json` — add Phase 4 review/commit keys under `Onboarding` namespace
- `apps/web/messages/en.json` — same keys, English values

### Design & Conventions
- `.planning/codebase/CONVENTIONS.md` — Web section: `'use client'`, Tailwind v4, `react-icons/io5`, named exports, no default exports

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- Pill button pattern (Phase 3, lines 474-488 of `WizardStep4Import.tsx`): `px-3 py-2 rounded-full border border-border text-sm font-bold text-text hover:border-primary hover:text-primary transition-colors` — reuse directly for D-06's type-correction toggles.
- `docType` badge (Phase 3, lines 564-568): `bg-surface-alt text-text border border-border` styled `<span>` — pattern to extend for D-05's "no action" badge on `da_coach` rows.
- Primary CTA button style (line 590-598): `h-11 px-6 rounded-xl bg-primary text-white text-sm font-bold hover:opacity-90 transition-opacity` — reuse for "Confirmer et importer".
- Skip button style (line 583-589): `h-11 px-4 text-sm font-normal text-muted hover:text-text transition-colors` — reuse for "Ignorer pour l'instant" on the review screen (D-03).

### Established Patterns
- `setFileStates(prev => prev.map(...))` functional updater — same pattern applies for tracking per-doc commit status (pending/committed/failed) in D-09.
- Tailwind v4 semantic tokens only (`text-primary`, `bg-surface-alt`, `border-border`, `text-muted`) — no hex values in JSX.
- `useTranslations('Onboarding')` already initialized — no setup needed for new keys.
- No default exports — `export function WizardStep4Import(`.

### Integration Points
- `canAdvance` (line 80-87) currently gates the "Continuer →" button's visibility. Per D-01, clicking it should transition to a review view instead of calling `onSuccess()` — the click handler on line 593 needs to change from `onClick={onSuccess}` to a view-transition handler.
- `parsed_data` is not currently retained per file after the polling closure runs (see D-11) — the polling callback in `runPipeline` (line 244-334) discards it after extracting `name`/`weeks`/`sessions` for the chat summary. This needs to change to persist the full object.
- `fileStates` already has everything needed to build the review list except full `parsed_data` (per D-11) and a commit-status field.

</code_context>

<specifics>
## Specific Ideas

- Review screen heading and copy: exact French wording at Claude's discretion, but should clearly state what will happen (e.g. distinguish "sera importé" vs "enregistré comme contexte" per doc).
- The success message before auto-redirect should mention the count, e.g. "3 programmes importés !" (exact wording Claude's discretion).
- Retry button for failed commits should be scoped per-doc, not a full-batch retry — matches the granularity of D-09.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope. (Note: full `parsed_data` editing beyond type correction was never proposed; REQUIREMENTS.md REVIEW-02 explicitly scopes correction to doc type only, not content.)

</deferred>

---

*Phase: 04-Review & Commit*
*Context gathered: 2026-08-12*
