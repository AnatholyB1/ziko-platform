# Phase 4: Review & Commit - Research

**Researched:** 2026-08-12
**Domain:** React (Next.js 15 / next-intl) client-side state machine over an existing REST commit endpoint — no new libraries, no backend changes
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Review Screen Transition**
- **D-01:** Clicking "Continuer →" swaps the entire `WizardStep4Import` card content to a dedicated review screen — the chat, drop zone, and file list are fully replaced (not appended below, not partially replaced). This becomes a second internal view state within the same component (e.g. `view: 'import' | 'review'`), not a new wizard step — the wizard stays at 4 steps total.
- **D-02:** The review screen is one-way: no back button to return to the file list. Once on review, the only actions are "Confirmer et importer" and "Ignorer pour l'instant".
- **D-03:** "Ignorer pour l'instant" remains available on the review screen and still redirects to `/coach/dashboard` without committing anything — consistent with Step 4 being optional throughout (PROJECT.md: not a blocker).

**Consolidated Review List**
- **D-04:** All classified docs (both `coach_template` and `da_coach`) appear together in one consolidated list — satisfies REVIEW-01 ("coach sees consolidated summary of all analyzed docs"). Nothing is omitted or grouped into separate sections.
- **D-05:** `da_coach` rows show a distinct "no action" badge/label (e.g. "Enregistré comme contexte") instead of an import indicator, making clear they won't be committed — without hiding them from the review.

**Type Correction UX**
- **D-06:** Each doc row on the review screen has a pill toggle (reusing Phase 3's pill-button visual pattern: "Template programme" / "DA coach") to let the coach correct the type — satisfies REVIEW-02.
- **D-07:** Changing a doc's type live-updates the commit set — the review screen shows a running count (e.g. "N programmes seront importés") that updates immediately as the coach corrects types, computed from current `docType` values at any moment (not just at confirm-click time).

**Commit Flow**
- **D-08:** On "Confirmer et importer", all `coach_template`-typed docs (per D-07's live commit set) fire `PUT /coach/imports/:id/commit` in parallel (`Promise.all` / independent calls) — matches Phase 2's parallel-upload precedent. `da_coach` docs are never sent to `/commit`.
- **D-09:** Partial failure handling: successful commits stay committed. A doc whose commit call fails shows an inline error with a "Retry" button scoped to that doc only — re-fires just that doc's `PUT /:id/commit` call. This is a deliberate exception to Phase 2's "retry deferred" decision — commit failures get retry because losing an already-uploaded, already-classified doc at the final step is a worse UX than the upload-stage failures Phase 2 deferred.
- **D-10:** Once every `coach_template` doc is committed (including any retried ones), show a brief success confirmation (e.g. "3 programmes importés !") then auto-redirect to `/coach/dashboard` — no extra click required (satisfies COMPLETE-02).

**Commit Request Body**
- **D-11:** `PUT /:id/commit` requires `parsed_data` (full object) in the body per `CommitImportBody` (`backend/api/src/coach/imports/types.ts`). This is NOT currently stored in `FileState` — Phase 3 only extracted display fields (`name`, `weeks`, `sessions`) transiently inside the polling closure. Phase 4 (or a small Phase 3 follow-up within this phase's plans) must persist the full `parsed_data` object per file — either by storing it on `FileState` during polling, or by re-fetching `GET /coach/imports/:id` at review time. Exact approach is Claude's discretion during planning/research — flagged here so it isn't missed. **Resolved by this research: store on `FileState` during polling — see Summary and Pattern 1.**

### Claude's Discretion
- Exact French wording for the review screen heading, per-doc summary lines, success message, and retry error text.
- Whether the running "N programmes seront importés" count (D-07) is a simple text line or a styled badge/counter.
- Visual treatment of the "no action" badge for `da_coach` docs (D-05) — exact copy and styling within the established badge pattern (`bg-surface-alt text-text border border-border`, matching the existing `docType` badge from Phase 3).
- Whether the internal view-state variable is named `view`, `step`, or similar — internal implementation detail.
- i18n key names for all new Phase 4 strings under the `Onboarding` namespace.

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope. (Note: full `parsed_data` editing beyond type correction was never proposed; REQUIREMENTS.md REVIEW-02 explicitly scopes correction to doc type only, not content.)

**Note:** The UI Design Contract (`04-UI-SPEC.md`) further locks exact copy, Tailwind classes, color usage, and the three-sub-state model (`editing` / `committing` / `done`) for the review screen. It is treated as equally authoritative alongside CONTEXT.md throughout this research — see Architecture Patterns and Code Examples, which follow its exact class names and copy keys.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| REVIEW-01 | Le coach voit un résumé consolidé de tous les docs analysés avant toute action définitive | Architecture Patterns (Pattern showing `view: 'review'` + `reviewPhase: 'editing'` render), UI-SPEC's consolidated row-per-`fileStates`-entry contract — see System Architecture Diagram |
| REVIEW-02 | Le coach peut corriger le type d'un doc (ex : "c'est un template, pas une DA") | Pill-toggle reuse from Phase 3 (D-06), live count derivation (Code Examples: "Live running count") |
| REVIEW-03 | Les docs de type `coach_template` sont commités via `PUT /coach/imports/:id/commit` après confirmation | Pattern 1 (parsed_data persistence, D-11 resolution), Pattern 2 (parallel commit with per-doc isolation), Common Pitfalls 1-4 |
| COMPLETE-01 | Un bouton "Ignorer pour l'instant" permet de quitter Step 4 et d'aller au dashboard sans importer | Confirmed unchanged from Phase 2/3 — `onSkip` prop already wired; Open Questions flags whether it stays visible during `'committing'` sub-state |
| COMPLETE-02 | Après confirmation et commit, le coach est redirigé vers `/coach/dashboard` | Pattern 3 (reactive completion detection + 1500ms `setTimeout` → `onSuccess`), confirmed `onSuccess` already wired to `router.push` in `OnboardingWizard.tsx` |
</phase_requirements>

## Summary

Phase 4 is a pure frontend extension of `WizardStep4Import.tsx`. Every technical question this phase raises (D-11's parsed_data persistence, D-08's parallel commit, D-09's scoped retry, D-10's auto-redirect) is answerable directly from code already in the repo — no external library research needed, no new packages, no backend changes. The component already establishes every pattern Phase 4 needs: functional `setFileStates` updaters, a polling closure that receives the full `ImportRow` (including full `parsed_data`) but currently discards it after narrowing types, and a `canAdvance`-style derived-boolean pattern for gating UI.

The single most consequential decision is D-11: **persist `parsed_data` on `FileState` during Phase 3's existing polling closure**, not by re-fetching `GET /coach/imports/:id` at review time. The full object is already sitting in memory in the closure at the moment `status === 'ready'` is detected (see Code Examples) — the local `ParsedData` TypeScript type only narrows the *read* surface for classification logic, it does not strip data at runtime. Capturing `importRow.parsed_data` verbatim onto `FileState` costs zero extra network round-trips and produces exactly the `Record<string, unknown>` shape `CommitImportBody.parsed_data` requires, with no transformation step.

**Primary recommendation:** Extend `FileState` with `parsedData?: Record<string, unknown>`, `commitStatus?: 'idle' | 'pending' | 'committed' | 'failed'`, and `commitError?: string`. Capture `parsed_data` in all three `ready`-branch outcomes of the existing polling closure (confident-template, confident-da_coach, and ambiguous — since an ambiguous doc can later be corrected to `template_programme` on the review screen and must have its data available at commit time). Fire `PUT /:id/commit` per doc via independent async functions that internally catch all errors and update `commitStatus` on `FileState` — call them through `Promise.all` so failures never abort sibling commits (matches D-08/D-09 exactly). Drive the `'committing' → 'done'` transition with a `useEffect` that watches `fileStates` and derives "all committable docs have `commitStatus === 'committed'`" — the same derived-boolean idiom already used for `canAdvance`.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Review list rendering (all doc types, D-04/D-05) | Browser / Client | — | Pure client state (`fileStates`) already in the component; no server round-trip needed to render the list |
| Type correction (D-06/D-07) | Browser / Client | — | `docType` already lives in local React state (Phase 3 D-03); correction is a local state mutation, no API call |
| Commit request (D-08) | Browser / Client → API / Backend | — | Client fires `PUT /:id/commit` per doc; all business logic (is_template derivation, workout_programs insert) lives server-side in `db.ts` — client only supplies `parsed_data` |
| Commit persistence | API / Backend → Database / Storage | — | `commitImport()` in `db.ts` performs the `workout_programs` insert + `ai_imports` status update; entirely out of scope for this phase (Phase 28, no changes) |
| Retry isolation (D-09) | Browser / Client | — | Retry re-fires a single client-side fetch; server treats each `PUT /:id/commit` call independently (idempotent via 409 guard) |
| Auto-redirect (D-10) | Browser / Client | — | `router.push` already wired at `OnboardingWizard.tsx` via the existing `onSuccess` prop; Phase 4 only decides *when* to call it |

## Standard Stack

### Core
No new libraries. This phase uses only what's already installed and already imported in `WizardStep4Import.tsx`.

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `react` | 19.2.6 [VERIFIED: apps/web/package.json] | Component state (`useState`, `useEffect`, `useCallback`) | Already the sole state mechanism in this component |
| `next-intl` | ^4.8.3 [VERIFIED: apps/web/package.json] | i18n incl. ICU plural syntax for the running count / success message | Already initialized (`useTranslations('Onboarding')`); ICU plural (`{count, plural, ...}`) is a native next-intl feature [CITED: next-intl.dev/docs/usage/translations] |
| `react-icons/io5` | ^5.6.0 [VERIFIED: apps/web/package.json] | `IoCheckmarkCircleOutline` (success state), `IoRefreshOutline` (retry button) | Both icon names confirmed present in `node_modules/react-icons/io5/index.d.ts` [VERIFIED: local type defs] — no new icon library per UI-SPEC |

### Supporting
None needed — no new runtime dependency for this phase.

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Re-fetch `GET /:id` at review-confirm time (D-11 option b) | Persist `parsed_data` on `FileState` during polling (option a, recommended) | Re-fetching adds a network round-trip per doc before commit can fire, complicates D-09 retry (must decide whether to re-fetch on every retry too), and risks staleness/race if fetched data differs from what was shown during Phase 3 classification. Persisting costs nothing extra since the data is already in the closure. |
| `Promise.allSettled` for parallel commit | `Promise.all` over functions that internally catch all errors and never reject (recommended) | Functionally equivalent outcome, but `Promise.all` + internal catch matches the codebase's existing idiom (every fetch call in `runPipeline` already catches its own errors and calls `setFileStates`, never lets a rejection propagate) — no new pattern introduced. |

**Installation:** None — no packages to install.

**Version verification:** All three libraries above were verified present in `apps/web/package.json` (read directly, not searched) at the versions listed. No registry lookups needed since nothing new is being added.

## Package Legitimacy Audit

**Not applicable.** This phase installs zero new packages — it exclusively reuses `react`, `next-intl`, and `react-icons` already present in `apps/web/package.json`. No `npm install`, no slopcheck run, no registry verification required.

## Architecture Patterns

### System Architecture Diagram

```
Coach clicks "Continuer →" (Phase 3 button, D-01 intercepts it)
        │
        ▼
┌─────────────────────────────┐
│ view: 'import' → 'review'    │  (WizardStep4Import internal state)
│ reviewPhase: 'editing'       │
└─────────────────────────────┘
        │
        │ renders one row per fileStates[] entry (D-04)
        │  - template_programme rows: pill toggle + live count
        │  - da_coach rows: pill toggle + "no action" badge (D-05)
        ▼
Coach corrects docType via pill (D-06) ──► setFileStates (local only, no API call)
        │                                        │
        │                                        ▼
        │                          running count recomputed (D-07, derived from fileStates)
        ▼
Coach clicks "Confirmer et importer"
        │
        ▼
┌─────────────────────────────┐
│ reviewPhase: 'committing'     │
└─────────────────────────────┘
        │
        │ toCommit = fileStates.filter(f => f.docType === 'template_programme')
        │ Promise.all(toCommit.map(f => commitDoc(f.id)))
        ▼
┌───────────────┐   PUT /coach/imports/:id/commit   ┌──────────────────────┐
│ commitDoc(id) │ ──────────────────────────────────►│ backend (Phase 28,   │
│ (per doc,     │   body: { parsed_data }             │ no changes)          │
│ isolated      │ ◄──────────────────────────────────│ commitImport() →      │
│ try/catch)    │   { program_id } | 409 | error       │ workout_programs +   │
└───────────────┘                                      │ ai_imports.status    │
        │                                               └──────────────────────┘
        │ success → commitStatus: 'committed'
        │ failure → commitStatus: 'failed' + inline Retry button (D-09, scoped)
        ▼
useEffect watches fileStates: all committable docs commitStatus === 'committed'?
        │ yes
        ▼
┌─────────────────────────────┐
│ reviewPhase: 'done'           │  → success message, setTimeout(1500ms)
└─────────────────────────────┘
        │
        ▼
onSuccess() → router.push('/coach/dashboard')   (already wired, OnboardingWizard.tsx:98)
```

### Recommended Project Structure

No new files. All Phase 4 code lives inside the existing single-file component:

```
apps/web/src/components/coach/
└── WizardStep4Import.tsx   # extend: FileState, view state, review render branch, commit logic
apps/web/src/components/coach/
└── WizardStep4Import.test.tsx   # NEW — Wave 0 gap, see Validation Architecture
apps/web/messages/
├── fr.json   # add step4Review* keys under Onboarding namespace
└── en.json   # same keys, English
```

### Pattern 1: Persist full `parsed_data` in the existing polling closure (D-11)

**What:** Capture `importRow.parsed_data` verbatim onto `FileState` at the same point Phase 3 already reads `overall_confidence` from it — in all three `ready` outcomes (confident-template, confident-da_coach, ambiguous).

**When to use:** Any time a doc reaches `status === 'ready'`, regardless of which classification branch fires, because an ambiguous doc can later be coach-corrected to `template_programme` on the review screen and will need its `parsed_data` at commit time just as much as a confidently-classified one.

**Example:**
```typescript
// Source: apps/web/src/components/coach/WizardStep4Import.tsx lines 258-334 (existing, Phase 3)
// importRow.parsed_data is ALREADY the full Record<string, unknown> object from the
// API response — the local `ParsedData` type only narrows what fields TypeScript lets
// you *read* off it for classification; it does not strip data at runtime.
type ParsedData = { overall_confidence?: number | null; name?: string; weeks?: Array<{ sessions?: unknown[] }> } | null;
const data = await res.json() as { import: { status: string; error_message: string | null; parsed_data: ParsedData } };
const importRow = data.import;

if (importRow.status === 'ready') {
  const rawParsedData = importRow.parsed_data as unknown as Record<string, unknown> | undefined;
  const confidence = importRow.parsed_data?.overall_confidence;

  if (confidence == null) {
    setFileStates((prev) =>
      prev.map((f) =>
        f.id === fileId ? { ...f, status: 'ready', clarificationPending: true, parsedData: rawParsedData } : f,
      ),
    );
    // ... existing chat message logic unchanged
  } else if (confidence < 0.4) {
    setFileStates((prev) =>
      prev.map((f) =>
        f.id === fileId ? { ...f, status: 'ready', docType: 'da_coach', parsedData: rawParsedData } : f,
      ),
    );
  } else if (confidence >= 0.6) {
    setFileStates((prev) =>
      prev.map((f) =>
        f.id === fileId ? { ...f, status: 'ready', docType: 'template_programme', parsedData: rawParsedData } : f,
      ),
    );
  } else {
    setFileStates((prev) =>
      prev.map((f) =>
        f.id === fileId ? { ...f, status: 'ready', clarificationPending: true, parsedData: rawParsedData } : f,
      ),
    );
  }
}
```

This is a minimal diff to Phase 3's existing closure — no restructuring, just one additional field per `setFileStates` call already present. `FileState` gains `parsedData?: Record<string, unknown>`.

### Pattern 2: Parallel commit with per-doc error isolation (D-08 / D-09)

**What:** Fire all `coach_template` commits in parallel via `Promise.all`, where each individual commit function catches its own errors and never rejects — matching the existing `runPipeline` idiom where every fetch step already catches errors internally and calls `setFileStates` rather than throwing.

**When to use:** On "Confirmer et importer" click, and again (scoped to one doc) on a per-row "Réessayer" click.

**Example:**
```typescript
// New in Phase 4 — mirrors the existing catch-and-setFileStates idiom used throughout
// runPipeline (lines 122-239), so no new error-handling pattern is introduced.
async function commitDoc(fileId: string, fileState: FileState): Promise<boolean> {
  if (!fileState.importId || !fileState.parsedData) {
    setFileStates((prev) =>
      prev.map((f) => (f.id === fileId ? { ...f, commitStatus: 'failed', commitError: t('step4CommitError') } : f)),
    );
    return false;
  }
  try {
    const res = await fetch(`${apiUrl}/coach/imports/${fileState.importId}/commit`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${jwt}` },
      body: JSON.stringify({ parsed_data: fileState.parsedData }),
    });
    // 409 with an existing program_id means this doc was already committed
    // (e.g. a double-fired retry) — treat as success, not failure (idempotency).
    if (res.status === 409) {
      const body = await res.json().catch(() => ({}));
      if (body.program_id) {
        setFileStates((prev) => prev.map((f) => (f.id === fileId ? { ...f, commitStatus: 'committed' } : f)));
        return true;
      }
    }
    if (!res.ok) {
      setFileStates((prev) =>
        prev.map((f) => (f.id === fileId ? { ...f, commitStatus: 'failed', commitError: t('step4CommitError') } : f)),
      );
      return false;
    }
    setFileStates((prev) => prev.map((f) => (f.id === fileId ? { ...f, commitStatus: 'committed' } : f)));
    return true;
  } catch {
    setFileStates((prev) =>
      prev.map((f) => (f.id === fileId ? { ...f, commitStatus: 'failed', commitError: t('step4CommitError') } : f)),
    );
    return false;
  }
}

async function handleConfirm(): Promise<void> {
  setReviewPhase('committing');
  const toCommit = fileStates.filter((f) => f.docType === 'template_programme');
  setFileStates((prev) =>
    prev.map((f) => (f.docType === 'template_programme' ? { ...f, commitStatus: 'pending' } : f)),
  );
  await Promise.all(toCommit.map((f) => commitDoc(f.id, f)));
  // Completion is detected reactively — see Pattern 3 (useEffect watching fileStates).
}

function retryCommit(fileId: string): void {
  const fileState = fileStates.find((f) => f.id === fileId);
  if (!fileState) return;
  setFileStates((prev) => prev.map((f) => (f.id === fileId ? { ...f, commitStatus: 'pending', commitError: undefined } : f)));
  void commitDoc(fileId, fileState);
}
```

### Pattern 3: Reactive completion detection (D-10)

**What:** A `useEffect` watching `fileStates` + `reviewPhase` derives whether every committable doc has reached `commitStatus === 'committed'`, transitions to `'done'`, and schedules the redirect. This mirrors the existing `canAdvance` derived-boolean idiom (line 80-87) rather than trying to synchronously read post-`Promise.all` state (which would be stale due to React's async state batching).

**Example:**
```typescript
useEffect(() => {
  if (reviewPhase !== 'committing') return;
  const committable = fileStates.filter((f) => f.docType === 'template_programme');
  if (committable.length === 0) return; // nothing to commit — should not normally reach 'committing' in this case
  const allDone = committable.every((f) => f.commitStatus === 'committed');
  if (!allDone) return;
  setReviewPhase('done');
  const timer = setTimeout(onSuccess, 1500); // D-10 / UI-SPEC: exactly 1500ms hold
  return () => clearTimeout(timer);
}, [fileStates, reviewPhase, onSuccess]);
```

### Anti-Patterns to Avoid
- **Reading `fileStates` synchronously right after `await Promise.all(...)` in `handleConfirm`:** React state updates triggered inside `commitDoc` are not guaranteed to be reflected in the `fileStates` closure variable by the time `Promise.all` resolves in the same tick — use the reactive `useEffect` pattern (Pattern 3) instead of an inline post-await check.
- **Re-fetching `GET /:id` to obtain `parsed_data` at commit time:** Unnecessary network round-trip; the data is already available from Phase 3's polling closure (see Pattern 1). Only fall back to a fetch if `parsedData` is somehow missing on `FileState` (defensive-only, treated as a commit failure per Pattern 2's guard clause).
- **Treating a 409 response from `PUT /:id/commit` as a hard failure during retry:** The route returns 409 both for "not in `ready` status" and for "already committed" (service.ts line 394-399) — the latter includes `program_id` in the body and should be treated as success to keep retry idempotent (see Pattern 2).
- **A single page-level "Retry all" control:** D-09 explicitly requires per-doc retry scoping, not a batch retry — each failed row gets its own isolated retry button and its own `commitDoc` call.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| ICU plural text ("N programmes seront importés" / "1 programme importé !") | Manual `count === 1 ? singular : plural` string branching | next-intl's built-in `{count, plural, ...}` ICU syntax in the message JSON, called via `t('key', { count })` | Already the project's i18n mechanism (`next-intl` v4.8.3); ICU plural is a first-class feature, not a workaround [CITED: next-intl.dev/docs/usage/translations] |
| Commit-status tracking per doc | A separate Zustand store or context for commit state | `commitStatus` field directly on the existing local `FileState[]` array | Phase 2/3 already established that all Step 4 state lives in local `WizardStep4Import` state (Phase 2 D-16) — introducing a store here would fragment that established pattern for no benefit (single component, single screen) |

**Key insight:** Every "problem" this phase presents is already solved by patterns shipped in Phases 1-3 of this exact component. The research finding is not "what library to add" but "which existing pattern to extend" — confirmed by re-reading `WizardStep4Import.tsx` end-to-end rather than assuming a new mechanism is needed.

## Common Pitfalls

### Pitfall 1: Narrowed TypeScript type hides that `parsed_data` is already complete
**What goes wrong:** A future implementer sees the local `ParsedData` type (`{ overall_confidence?, name?, weeks? }`) in the polling closure and assumes only those three fields are available, then adds a second `GET /:id` fetch at commit time to "get the full object."
**Why it happens:** The type annotation is a read-narrowing for classification convenience, not a description of the actual runtime payload — easy to conflate the two.
**How to avoid:** Capture `importRow.parsed_data as unknown as Record<string, unknown>` (the full runtime object) onto `FileState.parsedData` at the same point the narrowed fields are read, per Pattern 1.
**Warning signs:** A second `fetch(\`${apiUrl}/coach/imports/${id}\`)` call appearing inside the review/commit flow — this is the tell that Pattern 1 was skipped.

### Pitfall 2: Retry re-fires against a doc whose commit already succeeded server-side
**What goes wrong:** A slow network response makes the coach believe the first commit failed (spinner still showing / no visible feedback) and they click retry, or a double-click fires `commitDoc` twice before the first `setFileStates` update disables the button — the second `PUT /:id/commit` call hits the server after the first already transitioned the import to `committed`, and gets a 409.
**Why it happens:** No optimistic UI lock between commit call issuance and completion.
**How to avoid:** (1) Disable the retry button immediately on click (set `commitStatus: 'pending'` synchronously before the fetch starts). (2) Treat a 409 response whose body includes `program_id` as success, not failure (see Pattern 2) — this makes retry naturally idempotent even if a race occurs.
**Warning signs:** A row that flashes "failed" then immediately "committed" on a retry despite no visible change — indicates the first call actually succeeded and only the UI feedback lagged.

### Pitfall 3: `useEffect` completion-detection fires before `commitStatus: 'pending'` is set for all rows
**What goes wrong:** If `setReviewPhase('committing')` and the initial `commitStatus: 'pending'` batch update happen in separate renders (or the `useEffect` in Pattern 3 runs on a stale `fileStates` before the `'pending'` flags are applied), the `.every(...)` check can find zero `template_programme` rows still pending and prematurely transition to `'done'`.
**Why it happens:** React batches `setFileStates` calls, but the `useEffect` dependency on `fileStates` fires on every state change, including the render where rows are still `commitStatus: undefined` (not yet `'pending'` or `'committed'`).
**How to avoid:** In Pattern 3, treat `commitStatus !== 'committed'` as "not yet done" rather than checking for an explicit `'pending'` state — i.e., gate `allDone` on `.every(f => f.commitStatus === 'committed')`, which is false for `undefined` just as much as for `'pending'` or `'failed'`. Never gate on "at least one row has started."
**Warning signs:** The success screen (`'done'`) flashing immediately when the confirm button is clicked, before any network response has returned.

### Pitfall 4: 409 route ordering does not apply here but is easy to assume
**What goes wrong:** Assuming `PUT /:id/commit` needs special Hono route-ordering handling like `/:id/status` and `/:id/parse` do (per `service.ts` header comments).
**Why it happens:** The file's own comments warn heavily about static-suffix-before-`/:id` ordering for other routes.
**How to avoid:** No action needed — `/:id/commit` is already correctly registered after `GET /:id` with its static `/commit` suffix (service.ts confirms Hono matches the more specific path first). This is purely a backend concern already solved in Phase 28; Phase 4 makes no route changes.
**Warning signs:** N/A — flagging only to prevent wasted investigation time, since the file's own comments could mislead a reader into thinking route ordering is still an open concern for this phase.

## Code Examples

### `FileState` extension (Phase 4 additions to the Phase 2/3 type)
```typescript
// Source: apps/web/src/components/coach/WizardStep4Import.tsx line 8-16 (existing) + Phase 4 additions
type CommitStatus = 'pending' | 'committed' | 'failed';
type FileState = {
  id: string;
  file: File;
  importId?: string;
  status: FileStatus;
  errorMessage?: string;
  docType?: DocType;
  clarificationPending?: boolean;
  parsedData?: Record<string, unknown>;   // NEW — Phase 4, D-11
  commitStatus?: CommitStatus;             // NEW — Phase 4, D-08/D-09 (undefined = not yet attempted)
  commitError?: string;                    // NEW — Phase 4, D-09
};
```

### View-state gating the entire card content swap (D-01/D-02)
```typescript
// New top-level state in WizardStep4Import — 'view' naming is Claude's discretion per CONTEXT.md
const [view, setView] = useState<'import' | 'review'>('import');
const [reviewPhase, setReviewPhase] = useState<'editing' | 'committing' | 'done'>('editing');

// "Continuer →" button (line 590-598, existing) — change onClick only:
// BEFORE: onClick={onSuccess}
// AFTER:
<button
  type="button"
  onClick={() => setView('review')}
  className="h-11 px-6 rounded-xl bg-primary text-white text-sm font-bold hover:opacity-90 transition-opacity"
>
  {t('step4Continue')}
</button>
```

### Live running count (D-07) — trivial derived value, no memoization needed
```typescript
// Source: UI-SPEC.md line 114 — "no debounce needed — trivial .filter().length"
const committableCount = fileStates.filter((f) => f.docType === 'template_programme').length;
// Rendered via: t('step4ReviewCount', { count: committableCount })
```

## State of the Art

Not applicable — this phase extends an existing, recently-built (Phase 1-3, same milestone) component using patterns already established in that same file. There is no "old vs. new approach" dimension; the research task was internal-codebase archaeology, not ecosystem tracking.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `res.json()` body on a 409 commit response always includes `program_id` when the cause is "already committed" (vs. other 409 causes) | Pattern 2, Pitfall 2 | If a 409 lacks `program_id` for the "already committed" case, the idempotent-retry-success path would incorrectly fall through to "failed" — low risk since `service.ts` line 395 shows this is a literal, deterministic response the route always returns for that exact condition: `return c.json({ error: 'Import already committed', program_id: importRow.committed_program_id }, 409);`. This was read directly from source, not inferred — confidence is HIGH despite the tag, included here only because the retry-idempotency behavior itself was not explicitly specified in CONTEXT.md and represents an inference beyond the locked decisions. |

**If this table is sparse:** Nearly every claim in this research was verified directly against source files read in full (`service.ts`, `db.ts`, `types.ts`, `imported-program.ts`, `WizardStep4Import.tsx`, `OnboardingWizard.tsx`) rather than assumed from training knowledge — this phase required code archaeology, not library research, so the assumption surface is minimal.

## Open Questions

1. **Should a doc with `commitStatus: 'failed'` block the auto-redirect indefinitely if the coach never retries?**
   - What we know: D-10 says redirect fires "once every `coach_template` doc is committed (including any retried ones)" — this implies the coach screen simply waits, with visible retry buttons, until they act.
   - What's unclear: CONTEXT.md doesn't specify a fallback (e.g., a manual "Continuer quand même" escape hatch) if a coach abandons a failed row without retrying.
   - Recommendation: Match D-10 literally — no auto-timeout, no forced-skip. The "Ignorer pour l'instant" button remains visible during `'committing'` phase (not explicitly stated as hidden anywhere in CONTEXT.md or UI-SPEC) as the coach's existing escape hatch if they choose to abandon a stuck retry; planner should confirm whether Skip stays visible/enabled during the `'committing'` sub-state or is disabled like the CTA is (UI-SPEC only documents the CTA's disabled state, not Skip's, during `'committing'`).

## Environment Availability

Skipped — this phase has no external tool/service/runtime dependencies beyond what's already running in the existing dev environment (Node.js, npm workspaces, the already-deployed Phase 28 backend). No new CLI, database, or service dependency is introduced.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 3.2.4 + @testing-library/react 16.0.0 + @testing-library/user-event 14.5.2 [VERIFIED: apps/web/package.json] |
| Config file | `apps/web/vitest.config.ts` (environment: `happy-dom` for `.test.tsx` files via `environmentMatchGlobs`) |
| Quick run command | `npx vitest run src/components/coach/WizardStep4Import.test.tsx` (from `apps/web/`) |
| Full suite command | `npm run test` (from `apps/web/`, runs `vitest run --passWithNoTests`) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| REVIEW-01 | Review screen renders all fileStates entries (both docTypes) in one consolidated list | unit (RTL render) | `vitest run -t "consolidated review list"` | ❌ Wave 0 |
| REVIEW-02 | Pill toggle changes a row's `docType`; live count updates immediately | unit (RTL render + user-event click) | `vitest run -t "type correction updates count"` | ❌ Wave 0 |
| REVIEW-03 | Confirm click fires `PUT /:id/commit` only for `template_programme`-typed docs, in parallel | unit (mocked `fetch`, assert call count + bodies) | `vitest run -t "parallel commit fires only for template docs"` | ❌ Wave 0 |
| COMPLETE-01 | "Ignorer pour l'instant" on review screen calls `onSkip` without any commit fetch | unit (RTL render + user-event click, assert `onSkip` called and `fetch` not called with `/commit`) | `vitest run -t "skip on review screen"` | ❌ Wave 0 |
| COMPLETE-02 | After all commits settle, success message renders then `onSuccess` fires after 1500ms | unit (mocked `fetch`, `vi.useFakeTimers`, advance 1500ms) | `vitest run -t "auto-redirect after commit"` | ❌ Wave 0 |
| (D-09, implied by REVIEW-03) | A doc whose commit fetch rejects/fails shows scoped retry; retry re-fires only that doc | unit (mocked `fetch` — one reject, one resolve; assert retry button scoped to failed row only) | `vitest run -t "per-doc retry isolation"` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `npx vitest run src/components/coach/WizardStep4Import.test.tsx` (from `apps/web/`)
- **Per wave merge:** `npm run test` (from `apps/web/`, full suite)
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `apps/web/src/components/coach/WizardStep4Import.test.tsx` — new file, covers REVIEW-01, REVIEW-02, REVIEW-03, COMPLETE-01, COMPLETE-02, and D-09 retry isolation. No existing test file for this component (`Glob` confirmed only `WizardStep4Import.tsx` exists in that directory, no `.test.tsx` sibling).
- [ ] `global.fetch` mocking strategy — no shared fixture exists yet for mocking the `apiUrl`/`jwt` fetch calls this component makes; the test file will need to stub `global.fetch` per-test (`vi.stubGlobal('fetch', vi.fn())` pattern), following the existing `VocalReview.test.tsx` style of RTL `render` + `vitest` mocks (no shared `conftest`-equivalent exists in this codebase — each `.test.tsx` sets up its own mocks inline, per the two example test files read: `VocalReview.test.tsx`, `useVocalRecorder.test.ts`).
- [ ] Framework install: none — Vitest, RTL, and happy-dom are already devDependencies; no install step needed.

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | Unchanged — JWT already validated server-side via `authMiddleware` on every `/coach/imports/*` route (Phase 28, no changes this phase) |
| V3 Session Management | no | Unchanged — `jwt` prop passed through from `OnboardingWizard`'s existing Supabase session, no new session handling introduced |
| V4 Access Control | no | Unchanged — RLS (`ai_imports_own`) already enforces owner-only access server-side; client cannot commit another user's import regardless of what `importId` values it holds locally |
| V5 Input Validation | yes | `parsed_data` sent in the commit body is never coach-editable in this phase (REQUIREMENTS.md explicitly scopes REVIEW-02 to type-only correction) — it is a verbatim echo of what the server itself returned during parsing, so no new client-side validation surface is introduced. Server-side, `service.ts` line 385 already validates `parsed_data` is a non-array object before calling `commitImport()`. |
| V6 Cryptography | no | Not applicable — no cryptographic operations in this phase |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Client tampering with `parsed_data` before commit to inject arbitrary program content | Tampering | Out of scope for this phase's threat surface change — `parsed_data` already flows client → server unvalidated-in-shape-detail today (Phase 28 accepts `Record<string, unknown>` and the transform in `commitImport()` defensively `?? `-guards every field access). Phase 4 does not increase this surface since it echoes server-issued data back verbatim rather than accepting new coach-authored content; any hardening here would be a Phase 28 backend concern, not this phase's. |
| Double-submit / race on commit causing duplicate `workout_programs` rows | Repudiation / duplicate side-effect | Server-side idempotency already exists: `service.ts` checks `importRow.status === 'committed'` and returns 409 before ever calling `commitImport()` a second time for the same import id — the client-side retry-isolation logic in Pattern 2 must respect this by treating 409-with-`program_id` as success, not by attempting to suppress duplicate calls purely client-side (client-side prevention alone would be a weaker, bypassable control). |

## Sources

### Primary (HIGH confidence)
- `apps/web/src/components/coach/WizardStep4Import.tsx` — read in full; source for all FileState/polling-closure/view-render patterns
- `backend/api/src/coach/imports/service.ts` — read in full; source for commit route behavior, 409 semantics, route ordering
- `backend/api/src/coach/imports/types.ts` — read in full; source for `CommitImportBody`, `ImportStatus`, `ImportRow`
- `backend/api/src/coach/imports/db.ts` — read in full; source for `commitImport()` transform logic and idempotency comments
- `packages/coach-sdk/src/schemas/imported-program.ts` — read in full; source for `ImportedProgramSchema` shape
- `apps/web/src/app/[locale]/coach/onboarding/OnboardingWizard.tsx` — read in full; confirms `onSuccess` wiring to dashboard redirect
- `.planning/workstreams/onboarding/phases/04-review-commit/04-CONTEXT.md` — read in full; all locked decisions D-01 through D-11
- `.planning/workstreams/onboarding/phases/04-review-commit/04-UI-SPEC.md` — read in full; exact copy, classes, sub-state contract
- `.planning/workstreams/onboarding/phases/03-ai-classification-chat/03-CONTEXT.md` — read in full; prior-phase decisions this phase builds on
- `.planning/workstreams/onboarding/phases/02-upload-ux-pipeline/02-CONTEXT.md` — read in full; parallel-upload precedent (D-12)
- `apps/web/package.json` — read in full; verified all library versions
- `apps/web/vitest.config.ts` — read in full; test environment config
- [next-intl docs — Rendering translations](https://next-intl.dev/docs/usage/translations) — verified ICU plural syntax and `t()` usage

### Secondary (MEDIUM confidence)
- `apps/web/src/app/[locale]/(coach)/coach/imports/ImportsClient.tsx` — read in full; independent codebase precedent for `Promise.all` over per-item async fetches with individual try/catch (dashboard-side imports polling, not this phase's commit flow, but same idiom)
- `apps/web/src/components/coach/vocal/VocalReview.test.tsx` — read; example of this codebase's RTL + vitest test file conventions (no shared fixture file, inline `vi.fn()` mocks)

### Tertiary (LOW confidence)
None — no unverified claims relied upon.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new libraries; all versions read directly from `package.json`
- Architecture: HIGH — every pattern traced to source code already in the repo, not inferred from general React knowledge
- Pitfalls: HIGH — derived from reading the actual closure/state-update code and the actual 409 response shape in `service.ts`, not generic React pitfalls

**Research date:** 2026-08-12
**Valid until:** 30 days (stable — internal codebase research, no fast-moving external dependency)
