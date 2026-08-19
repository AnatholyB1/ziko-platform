# Phase 4: Review & Commit - Pattern Map

**Mapped:** 2026-08-12
**Files analyzed:** 4 (1 modified component, 1 new test file, 2 i18n message files)
**Analogs found:** 4 / 4 (3 exact/self, 1 partial)

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `apps/web/src/components/coach/WizardStep4Import.tsx` | component | request-response + CRUD (parallel commit) | itself — `WizardStep4Import.tsx` (Phase 2/3 code already in file) | exact (self-extension) |
| `apps/web/src/components/coach/WizardStep4Import.test.tsx` | test | request-response (RTL + mocked fetch) | `apps/web/src/components/coach/vocal/VocalReview.test.tsx` (render/assert structure) + `apps/web/src/components/coach/vocal/useVocalRecorder.test.ts` (global mocking conventions) | partial — no existing test in the repo mocks `fetch`; this is a genuine gap (see "No Analog Found") |
| `apps/web/messages/fr.json` (`Onboarding` namespace) | config (i18n) | CRUD (key insert) | itself — existing `step4*` keys at lines 138-163 | exact |
| `apps/web/messages/en.json` (`Onboarding` namespace) | config (i18n) | CRUD (key insert) | itself — existing `step4*` keys at lines 138-163 | exact |

## Pattern Assignments

### `apps/web/src/components/coach/WizardStep4Import.tsx` (component, request-response + CRUD)

**Analog:** the file itself — Phase 2/3 code already shipped in this component. Phase 4 is a strict extension, not a new pattern. Every pattern below is a concrete excerpt from the current file (`apps/web/src/components/coach/WizardStep4Import.tsx`), read in full.

**Imports pattern** (lines 1-4):
```typescript
'use client';
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { IoCloudUploadOutline, IoCloseOutline, IoDocumentOutline, IoGridOutline, IoReaderOutline } from 'react-icons/io5';
```
Per UI-SPEC.md, Phase 4 adds two new icon imports to this same line: `IoCheckmarkCircleOutline` (success state) and `IoRefreshOutline` (retry button) — no new icon library, same `react-icons/io5` import block.

**`FileState` type — extend, don't replace** (lines 8-16):
```typescript
type FileStatus = 'uploading' | 'parsing' | 'ready' | 'failed';
type DocType = 'da_coach' | 'template_programme';
type FileState = {
  id: string;
  file: File;
  importId?: string;
  status: FileStatus;
  errorMessage?: string;
  docType?: DocType;
  clarificationPending?: boolean;
};
```
Phase 4 adds three optional fields (per RESEARCH.md Pattern 1 / D-11, D-08, D-09) — same shape convention (all new fields optional, added at the end):
```typescript
type CommitStatus = 'pending' | 'committed' | 'failed';
// ... inside FileState:
  parsedData?: Record<string, unknown>;   // NEW — Phase 4, D-11
  commitStatus?: CommitStatus;             // NEW — Phase 4, D-08/D-09 (undefined = not yet attempted)
  commitError?: string;                    // NEW — Phase 4, D-09
```

**Derived-boolean gating idiom (`canAdvance`) — reuse for `committableCount` and `allDone`** (lines 80-87):
```typescript
const canAdvance =
  fileStates.length > 0 &&
  fileStates.every(
    (f) =>
      f.status === 'failed' ||
      (f.status === 'ready' && Boolean(f.docType) && !f.clarificationPending),
  ) &&
  fileStates.some((f) => f.status === 'ready');
```
Phase 4's D-07 live count and Pattern 3's `allDone` completion check both follow this exact idiom — a plain derived expression computed on every render from `fileStates`, no `useMemo`, no separate reducer:
```typescript
const committableCount = fileStates.filter((f) => f.docType === 'template_programme').length;
// and, inside the completion useEffect:
const allDone = committable.every((f) => f.commitStatus === 'committed');
```

**Functional `setFileStates` updater — core mutation pattern, reuse verbatim for commit status** (lines 124-128, repeated throughout `runPipeline`):
```typescript
setFileStates((prev) =>
  prev.map((f) =>
    f.id === fileId ? { ...f, status: 'failed', errorMessage: errText } : f,
  ),
);
```
Every state mutation in this file uses this exact `prev.map(f => f.id === X ? {...f, ...} : f)` shape. Phase 4's `commitDoc` must follow it identically for `commitStatus`/`commitError` updates (see RESEARCH.md Pattern 2 for the full `commitDoc` implementation, already written against this exact idiom).

**Error handling / catch pattern — reuse for `commitDoc`** (lines 137-146, one of five near-identical try/catch blocks in `runPipeline`):
```typescript
} catch (err) {
  if (err instanceof DOMException && err.name === 'AbortError') return;
  const msg = t('step4ErrorServer');
  setFileStates((prev) =>
    prev.map((f) =>
      f.id === fileId ? { ...f, status: 'failed', errorMessage: msg } : f,
    ),
  );
  return;
}
```
Every fetch step in this component catches its own error internally and never lets a rejection propagate up — this is the exact idiom RESEARCH.md Pattern 2's `commitDoc` must follow (catch-and-`setFileStates`, return `boolean` instead of throwing, so `Promise.all` in `handleConfirm` never short-circuits on a sibling rejection).

**Fetch call shape (auth header + JSON body) — reuse for `PUT /:id/commit`** (lines 178-186, the `status` PUT call — closest existing analog to the new commit PUT):
```typescript
const statusRes = await fetch(`${apiUrl}/coach/imports/${importId}/status`, {
  method: 'PUT',
  signal: controller.signal,
  headers: {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${jwt}`,
  },
  body: JSON.stringify({ status: 'uploaded' }),
});
```
Phase 4's commit call is structurally identical, just a different URL suffix and body key:
```typescript
const res = await fetch(`${apiUrl}/coach/imports/${fileState.importId}/commit`, {
  method: 'PUT',
  headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${jwt}` },
  body: JSON.stringify({ parsed_data: fileState.parsedData }),
});
```

**Polling closure — where `parsedData` capture is inserted (D-11)** (lines 268-317, all three `ready`-branch outcomes):
```typescript
if (importRow.status === 'ready') {
  const confidence = importRow.parsed_data?.overall_confidence;
  if (confidence == null) {
    setFileStates((prev) =>
      prev.map((f) =>
        f.id === fileId ? { ...f, status: 'ready', clarificationPending: true } : f,
      ),
    );
    // ...
  } else if (confidence < 0.4) {
    setFileStates((prev) =>
      prev.map((f) =>
        f.id === fileId ? { ...f, status: 'ready', docType: 'da_coach' } : f,
      ),
    );
    // ...
  } else if (confidence >= 0.6) {
    setFileStates((prev) =>
      prev.map((f) =>
        f.id === fileId ? { ...f, status: 'ready', docType: 'template_programme' } : f,
      ),
    );
    // ...
  } else {
    setFileStates((prev) =>
      prev.map((f) =>
        f.id === fileId ? { ...f, status: 'ready', clarificationPending: true } : f,
      ),
    );
  }
}
```
Phase 4 must add `parsedData: importRow.parsed_data as unknown as Record<string, unknown> | undefined` to all four `setFileStates` object spreads inside this block (all three `ready` branches, not just the confident-template one) — see RESEARCH.md Pattern 1 for the exact diff and Pitfall 1 for why all three branches (not just `template_programme`) need it (an ambiguous doc can later be coach-corrected to `template_programme` on the review screen).

**Pill-toggle button — exact visual + click pattern to reuse for D-06's type-correction toggles** (lines 474-488):
```tsx
<button
  type="button"
  onClick={() => handleClarification(msg.fileId, 'template_programme')}
  className="px-3 py-2 rounded-full border border-border text-sm font-bold text-text hover:border-primary hover:text-primary transition-colors"
>
  {t('step4PillTemplate')}
</button>
<button
  type="button"
  onClick={() => handleClarification(msg.fileId, 'da_coach')}
  className="px-3 py-2 rounded-full border border-border text-sm font-bold text-text hover:border-primary hover:text-primary transition-colors"
>
  {t('step4PillDaCoach')}
</button>
```
Per UI-SPEC.md, Phase 4's review-screen pills reuse this exact class string but add a **selected-state** variant not previously needed in Phase 3 (clarification pills were single-use-then-gone; review pills persist and must show current selection): the currently-selected pill gets `border-primary text-primary bg-primary/10` appended/swapped in conditionally on `fileState.docType === 'template_programme' | 'da_coach'`.

**`docType` badge — extend for D-05's "no action" badge** (lines 564-568):
```tsx
{fileState.docType && (
  <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-bold bg-surface-alt text-text border border-border">
    {fileState.docType === 'template_programme' ? t('step4DocTypeTemplate') : t('step4DocTypeDaCoach')}
  </span>
)}
```
Per UI-SPEC.md Copywriting Contract, D-05's `da_coach` "no action" badge (`step4ReviewNoAction`) reuses this exact span but with `bg-surface-alt text-muted border border-border` (muted instead of `text-text`, per spec, to visually de-emphasize vs. committed rows).

**Per-file error block — reuse for `step4CommitError` inline error (D-09)** (lines 557-561):
```tsx
{fileState.status === 'failed' && fileState.errorMessage && (
  <p className="text-xs text-red-500 mt-0.5 truncate" title={fileState.errorMessage}>
    {fileState.errorMessage.length > 80 ? fileState.errorMessage.slice(0, 80) + '…' : fileState.errorMessage}
  </p>
)}
```
Per UI-SPEC.md, the commit-failure block for a review row matches this pattern's visual weight (`text-xs text-red-500`) directly under the row, paired with a `step4CommitRetry` button (`h-8 px-3 rounded-lg border border-border text-xs font-bold text-text hover:border-primary hover:text-primary transition-colors`).

**Primary CTA / Skip button styles — reuse verbatim for review-screen footer** (lines 582-598):
```tsx
<button
  type="button"
  onClick={onSkip}
  className="h-11 px-4 text-sm font-normal text-muted hover:text-text transition-colors"
>
  {t('step4Skip')}
</button>
{canAdvance && (
  <button
    type="button"
    onClick={onSuccess}
    className="h-11 px-6 rounded-xl bg-primary text-white text-sm font-bold hover:opacity-90 transition-opacity"
  >
    {t('step4Continue')}
  </button>
)}
```
D-01's view-swap changes `onClick={onSuccess}` on the *import*-view CTA to `onClick={() => setView('review')}` (RESEARCH.md, "View-state gating" example). The review screen's own CTA (`step4ReviewConfirm`, "Confirmer et importer") reuses the exact same class string, with `onClick={handleConfirm}` and — per UI-SPEC.md "Committing" sub-state — an inline spinner (reusing `StatusPill`'s spinner span, see below) plus `disabled` + `disabled:opacity-50 pointer-events-none` while `reviewPhase === 'committing'`.

**Spinner span — reuse for CTA in-flight state and per-row commit-in-progress** (lines 49-50, inside `StatusPill`):
```tsx
{hasSpinner && <span className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />}
```
UI-SPEC.md explicitly directs reusing this exact spinner span inline before the CTA label during `'committing'`, and for per-row in-flight indication.

**Outer card shell / heading / subtitle — reuse verbatim for both new view states** (lines 427-429):
```tsx
<div className="bg-white rounded-2xl p-8 border border-border shadow-sm">
  <h2 className="text-xl font-bold text-text mb-2">{t('step4Heading')}</h2>
  <p className="text-sm font-normal text-muted mb-6">{t('step4Subtitle')}</p>
```
UI-SPEC.md: the review screen fully replaces card content but reuses this exact shell/heading/subtitle class structure with new keys (`step4ReviewHeading`, `step4ReviewSubtitle`).

**File-list row container — reuse verbatim for review-screen doc rows** (line 552):
```tsx
<div key={fileState.id} className="flex items-center gap-3 p-3 rounded-xl border border-border bg-white">
```

**Footer button row container — reuse verbatim** (line 582):
```tsx
<div className="flex gap-3 mt-8 justify-end items-center">
```

---

### `apps/web/src/components/coach/WizardStep4Import.test.tsx` (test, request-response)

**Analogs:** `apps/web/src/components/coach/vocal/VocalReview.test.tsx` (RTL render/assert structure) + `apps/web/src/components/coach/vocal/useVocalRecorder.test.ts` (global mocking conventions, `beforeEach`/`vi.clearAllMocks`, `vi.mock('react', ...)` pattern for hooks needing special environment setup).

**RTL render + assert pattern** (`VocalReview.test.tsx`, full file, lines 1-32):
```typescript
import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { VocalReview } from './VocalReview';

describe('VocalReview', () => {
  it('renders transcript text', () => {
    render(
      <VocalReview
        transcript="test text"
        onValidate={vi.fn()}
        onRelaunch={vi.fn()}
      />
    );
    expect(screen.getByText('test text')).toBeDefined();
  });
});
```
Follow this exact `describe`/`it` + `render` + `screen.getByText`/`getByRole` structure for `WizardStep4Import.test.tsx`. Per RESEARCH.md's Phase Requirements → Test Map, name `it()` blocks matching the vitest `-t` filters already specified: `"consolidated review list"`, `"type correction updates count"`, `"parallel commit fires only for template docs"`, `"skip on review screen"`, `"auto-redirect after commit"`, `"per-doc retry isolation"`.

**Global mock setup + `beforeEach` reset pattern** (`useVocalRecorder.test.ts`, lines 1-20, 67-73):
```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

Object.defineProperty(global, 'navigator', {
  value: { mediaDevices: { getUserMedia: vi.fn().mockResolvedValue(mockStream) } },
  writable: true,
});

describe('useVocalRecorder', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (navigator.mediaDevices.getUserMedia as ReturnType<typeof vi.fn>).mockResolvedValue(mockStream);
  });
  // ...
});
```
This is the closest existing precedent in the repo for defining a global mock (here `navigator`) and resetting it per-test. Apply the same shape for `global.fetch`: define/stub it once at module scope (or in a `beforeEach`) and reset call state before each test. Per RESEARCH.md's Wave 0 Gaps note: **no existing test file in this codebase mocks `fetch`** — this is a genuine gap, not merely a partial match. RESEARCH.md's recommended approach is `vi.stubGlobal('fetch', vi.fn())`, following the same "stub a global, reset in `beforeEach`" shape as `useVocalRecorder.test.ts`'s `navigator` stub, combined with `vi.useFakeTimers()` for the 1500ms auto-redirect assertion (COMPLETE-02) — `vi.useFakeTimers()`/`vi.advanceTimersByTime(1500)` is not yet used anywhere else in the repo's test suite, so this is new-but-standard-Vitest, not a novel project convention.

**Test environment config** (`apps/web/vitest.config.ts` — not excerpted in full, referenced by RESEARCH.md): `.test.tsx` files run under `happy-dom` via `environmentMatchGlobs`. Confirmed present, no changes needed for the new test file to pick up the same environment.

---

### `apps/web/messages/fr.json` / `apps/web/messages/en.json` (config/i18n, CRUD key insert)

**Analog:** the files themselves — existing `Onboarding` namespace `step4*` keys.

**fr.json** (lines 138-163, tail of existing `step4*` block, insertion point for new keys):
```json
"step4DocTypeTemplate": "Template",
"step4DocTypeDaCoach": "DA coach",
"step4Continue": "Continuer →"
```

**en.json** (lines 138-163, same structure, English values):
```json
"step4DocTypeTemplate": "Template",
"step4DocTypeDaCoach": "Coaching DA",
"step4Continue": "Continue →"
```

**New keys required** (per UI-SPEC.md Copywriting Contract — exact copy locked, insert alphabetically-adjacent to existing `step4*` keys, same flat-string style, no nested objects):

| Key | fr.json value | en.json value | ICU plural? |
|-----|----------------|----------------|-------------|
| `step4ReviewHeading` | "Vérifie tes documents avant l'import" | (English equivalent, Claude's discretion) | no |
| `step4ReviewSubtitle` | "Confirme le type de chaque document, puis lance l'import." | (English equivalent) | no |
| `step4ReviewNoAction` | "Enregistré comme contexte" | (English equivalent) | no |
| `step4ReviewCount` | `"{count, plural, =0 {Aucun programme ne sera importé} one {1 programme sera importé} other {# programmes seront importés}}"` | (English ICU equivalent) | **yes** |
| `step4ReviewConfirm` | "Confirmer et importer" | (English equivalent) | no |
| `step4CommitError` | "L'import de ce document a échoué." | (English equivalent) | no |
| `step4CommitRetry` | "Réessayer" | (English equivalent) | no |
| `step4CommitSuccess` | `"{count, plural, one {1 programme importé !} other {# programmes importés !}}"` | (English ICU equivalent) | **yes** |

**ICU plural syntax reference** — no existing key in `fr.json`/`en.json`'s `Onboarding` namespace currently uses ICU plural (`{count, plural, ...}`); all existing `step4*` interpolations are simple named placeholders (e.g. `step4AiTemplateSummary`: `"{name}"`, `"{weeks}"`, `"{sessions}"`, lines 154-155 of `fr.json`). This is a first use of ICU plural within this file, but it is a native, already-installed `next-intl` v4.8.3 feature (RESEARCH.md, "Don't Hand-Roll" table) — no new dependency, syntax confirmed via next-intl docs. Call via `t('step4ReviewCount', { count: committableCount })` and `t('step4CommitSuccess', { count: committedCount })` (same `t()` call shape already used everywhere else in the component, e.g. line 445: `t('step4AiTemplateSummary', { name: msg.name, weeks: msg.weeks, sessions: msg.sessions })`).

---

## Shared Patterns

### Functional state updater (`setFileStates(prev => prev.map(...))`)
**Source:** `apps/web/src/components/coach/WizardStep4Import.tsx` — used ~15 times throughout `runPipeline` (e.g. lines 124-128, 250-254, 272-276, 283-287, 297-301, 308-312, 324-328)
**Apply to:** `commitDoc`, `retryCommit`, and any other Phase 4 state mutation. Never mutate `fileStates` directly; always `prev.map(f => f.id === targetId ? { ...f, ...changes } : f)`.

### Catch-and-set, never throw
**Source:** `apps/web/src/components/coach/WizardStep4Import.tsx` — every fetch step in `runPipeline` (5 near-identical try/catch blocks, e.g. lines 137-146, 165-174, 196-205, 230-239)
**Apply to:** `commitDoc` — must catch all errors internally, call `setFileStates` to record `commitStatus: 'failed'`, and return a `boolean` rather than rejecting, so `Promise.all(toCommit.map(commitDoc))` in `handleConfirm` never short-circuits on a sibling failure (matches D-08/D-09 exactly).

### Derived-boolean gating (no `useMemo`, no reducer)
**Source:** `apps/web/src/components/coach/WizardStep4Import.tsx` lines 80-87 (`canAdvance`)
**Apply to:** `committableCount` (D-07 live count) and the `allDone` check inside Phase 4's completion `useEffect` (Pattern 3) — plain expressions recomputed every render from `fileStates`, consistent with the file's existing style of avoiding memoization for trivial `.filter()`/`.every()` checks.

### Tailwind v4 semantic tokens only
**Source:** entire `WizardStep4Import.tsx` file — zero hex values anywhere in JSX; only `text-primary`, `bg-surface-alt`, `border-border`, `text-muted`, `text-text`, etc.
**Apply to:** all new review-screen JSX — UI-SPEC.md confirms zero new tokens are introduced by Phase 4, every class is either reused verbatim or a variant already documented in the Design System / Color sections above.

### `useTranslations('Onboarding')` — single hook instance, no per-key setup
**Source:** `apps/web/src/components/coach/WizardStep4Import.tsx` line 69: `const t = useTranslations('Onboarding');`
**Apply to:** all new `t('step4Review*')` / `t('step4Commit*')` calls — no new `useTranslations` call needed, same `t` instance covers the whole namespace including new keys once added to both message files.

## No Analog Found

| File/Concern | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `fetch` mocking strategy inside a `.test.tsx` | test infrastructure | request-response | No existing test file in `apps/web/src` (or elsewhere in the repo, confirmed via repo-wide grep for `vi.stubGlobal('fetch'`, `global.fetch =`) mocks `fetch` directly. `VocalReview.test.tsx` and `useVocalRecorder.test.ts` establish the RTL-render and global-mock-with-`beforeEach`-reset conventions respectively, but neither exercises a network call. Planner should follow RESEARCH.md's explicit recommendation: `vi.stubGlobal('fetch', vi.fn())` set up per-test, combined with `vi.useFakeTimers()` for the COMPLETE-02 1500ms redirect assertion — both are standard Vitest APIs already a devDependency, just not yet exercised anywhere else in this codebase's test suite. |

## Metadata

**Analog search scope:** `apps/web/src/components/coach/` (primary), `apps/web/src/components/coach/vocal/` (test conventions), `apps/web/src/app/[locale]/(coach)/coach/imports/ImportsClient.tsx` (independent `Promise.all` precedent, secondary source per RESEARCH.md), `apps/web/messages/fr.json` + `en.json` (i18n key conventions)
**Files scanned:** 7 (`WizardStep4Import.tsx`, `VocalReview.test.tsx`, `useVocalRecorder.test.ts`, `ImportsClient.tsx` excerpt, `fr.json` excerpt, `en.json` excerpt, `04-UI-SPEC.md`)
**Pattern extraction date:** 2026-08-12
