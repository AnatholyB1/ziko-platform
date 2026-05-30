---
phase: 02-upload-ux-pipeline
verified: 2026-05-30T12:00:00Z
status: human_needed
score: 4/4 must-haves verified
overrides_applied: 0
human_verification:
  - test: "IA chat bubble renders with orange avatar on Step 4 load"
    expected: "Orange 'IA' avatar pill + 'Envoie-moi tes docs et je m'occupe du reste.' speech bubble visible immediately on Step 4"
    why_human: "Visual rendering — cannot verify DOM output without a browser"
  - test: "Drag-and-drop zone visual state on drag-over"
    expected: "Border turns orange (border-primary) and background tints (bg-primary/5) when a file is dragged over the zone"
    why_human: "DragEvent visual feedback — requires browser interaction"
  - test: "4-file cap enforcement in UI"
    expected: "After selecting 4 files, drop zone dims (opacity-50 pointer-events-none) and label changes to 'Maximum de 4 fichiers atteint'; Browse button disabled"
    why_human: "State-driven visual change requiring file selection interaction"
  - test: "Status pill progression during live pipeline"
    expected: "Each file shows blue 'Envoi...' pill with spinner on add, transitions to orange 'Analyse...' after parse trigger 202, then green '✓ Prêt' or red 'Erreur' when polling resolves"
    why_human: "Requires a live backend (POST /coach/imports) responding correctly — cannot test without running server"
  - test: "File removal mid-pipeline"
    expected: "Clicking × on a file during 'Envoi...' or 'Analyse...' state removes the card, stops the polling interval, and re-enables the drop zone if count drops below 4"
    why_human: "Async pipeline interaction requires browser with real file + network"
---

# Phase 02: Upload UX & Pipeline — Verification Report

**Phase Goal:** Coaches can drop up to 4 files and the Phase 28 pipeline runs automatically per file
**Verified:** 2026-05-30
**Status:** human_needed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths (Roadmap Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|---------|
| 1 | An IA opening message greets the coach on Step 4 load | VERIFIED | `WizardStep4Import.tsx` lines 299-308: `<div className="flex flex-col gap-3 mb-6">` contains avatar div `bg-primary text-white w-8 h-8 rounded-lg` with "IA" text + speech bubble div `bg-surface-alt rounded-xl rounded-tl-none` rendering `{t('step4AiGreeting')}`. fr.json line 141: value `"Envoie-moi tes docs et je m'occupe du reste."` |
| 2 | Coach can select up to 4 PDF/Excel/Word files via drag-and-drop or file picker | VERIFIED | Drop zone (lines 311-340) has `onDragOver`, `onDragLeave`, `onDrop` handlers. Hidden input `accept=".pdf,.xlsx,.xls,.docx"` with `multiple`. `handleFiles` enforces `remaining = 4 - fileStates.length`, returns if `remaining <= 0`. `isCapHit` disables button and dims zone. |
| 3 | Each file automatically triggers create → upload → status → parse without manual action | VERIFIED | `useEffect([fileStates])` lines 62-70 fires `runPipeline(fs)` for any entry with `status === 'uploading'` and no `importId`. `runPipeline` executes all 5 steps sequentially (lines 103-233). `pipelineStartedRef` deduplication prevents double-trigger. |
| 4 | A per-file progress indicator shows upload and parse state (loading, done, error) | VERIFIED | `StatusPill` component (lines 15-29) renders 4 states: uploading (blue + spinner), parsing (orange + spinner), ready (green), failed (red). File cards render `StatusPill` per `fileState.status`. Failed state also renders inline error text `text-xs text-red-500` truncated at 80 chars. |

**Score:** 4/4 truths verified

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|---------|--------|---------|
| `apps/web/src/components/coach/WizardStep4Import.tsx` | Chat bubble, drop zone, file card list UI + pipeline orchestration | VERIFIED | 383 lines. Full implementation with all types, state, handlers, useEffects, and JSX sections. `contains: "step4AiGreeting"` — confirmed line 305. |
| `apps/web/messages/fr.json` | French i18n keys for Phase 2 | VERIFIED | All 9 keys present at lines 141-149. Values match UI-SPEC exactly. Inserted after `step4Skip` line 140. Existing keys unchanged. |
| `apps/web/messages/en.json` | English i18n keys for Phase 2 | VERIFIED | All 9 keys present at lines 141-149. Values match UI-SPEC exactly. Existing keys unchanged. |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `WizardStep4Import.tsx` | `apps/web/messages/fr.json` | `useTranslations('Onboarding')` | WIRED | Line 44: `const t = useTranslations('Onboarding')`. Pattern `t('step4AiGreeting')` at line 305, `t('step4DropZoneLabel')` line 319, `t('step4CapReached')` line 319, `t('step4BrowseFiles')` line 328, etc. All 9 keys consumed. |
| `WizardStep4Import.tsx` | `backend/api/src/coach/imports/` | `fetch POST/PUT/GET /coach/imports` | WIRED | `runPipeline` lines 110-233: POST `${apiUrl}/coach/imports` (step 1), PUT `${apiUrl}/coach/imports/${importId}/status` (step 3), POST `${apiUrl}/coach/imports/${importId}/parse` (step 4). `startPolling` line 75: GET `${apiUrl}/coach/imports/${importId}`. All calls use `Authorization: Bearer ${jwt}`. Signed URL PUT (step 2, line 150) has NO Authorization header per design. |

---

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|--------------|--------|--------------------|--------|
| `WizardStep4Import.tsx` | `fileStates` | `handleFiles()` sets initial state; `runPipeline()` updates `importId` + `status`; `startPolling()` updates terminal `status` + `errorMessage` | Yes — pipeline calls live API; polling reads from `GET /coach/imports/:id` | FLOWING |
| `WizardStep4Import.tsx` | `t('step4AiGreeting')` | `useTranslations('Onboarding')` → `fr.json` / `en.json` | Yes — keys exist with real values | FLOWING |

---

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| TypeScript compilation | `npx tsc --noEmit --project apps/web/tsconfig.json` | SUMMARY reports: "pre-existing VocalReview.test.tsx error unrelated to this plan" — WizardStep4Import.tsx has no errors | PASS (per SUMMARY 02-02; unrelated pre-existing error in test file) |
| All 9 FR i18n keys present | grep count in fr.json | 9 keys found at lines 141-149 | PASS |
| All 9 EN i18n keys present | grep count in en.json | 9 keys found at lines 141-149 | PASS |
| `onSuccess` not called anywhere | grep pattern in WizardStep4Import.tsx | File has `onSuccess` as prop declaration only — never invoked in component body | PASS |

Note: Step 7b live server checks (pipeline execution, visual drag state) deferred to human verification — require running server with live backend.

---

### Probe Execution

No probe scripts declared in PLAN frontmatter or conventional `scripts/*/tests/probe-*.sh` paths for this phase. Step 7c: SKIPPED (no probe scripts).

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|---------|
| UPLOAD-01 | 02-01-PLAN.md | Le coach peut uploader jusqu'à 4 fichiers (PDF, Excel, Word) depuis Step 4 | SATISFIED | `handleFiles` 4-file cap enforcement; `accept=".pdf,.xlsx,.xls,.docx"`; drag-and-drop + file picker both wired |
| UPLOAD-02 | 02-01-PLAN.md | L'IA ouvre la conversation avec un message d'invite explicite | SATISFIED | Chat bubble renders `{t('step4AiGreeting')}` = "Envoie-moi tes docs et je m'occupe du reste." on Step 4 load |
| UPLOAD-03 | 02-02-PLAN.md | Chaque fichier sélectionné déclenche automatiquement le pipeline Phase 28 | SATISFIED | `useEffect([fileStates])` triggers `runPipeline` for every new uploading file; 5-step sequence implemented and wired |

All 3 phase requirement IDs from PLAN frontmatter are accounted for. No orphaned requirements: REQUIREMENTS.md maps UPLOAD-01, UPLOAD-02, UPLOAD-03 to Phase 2 — all three verified.

PARSE-0x, REVIEW-0x, COMPLETE-0x, and WIZARD-0x requirements are assigned to other phases and are not in scope here.

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `WizardStep4Import.tsx` | 69 | `eslint-disable-next-line react-hooks/exhaustive-deps` | Info | Intentional — documented in SUMMARY-02-02 decisions: adding `runPipeline` to deps would cause infinite loop. Fire-and-forget pattern per design. |
| `WizardStep4Import.tsx` | 105 | `onSuccess` prop accepted but never called | Info | Intentional stub — SUMMARY-02-02 known stubs: "per D-17, Phase 3 decides when to advance." Not a bug. |
| `WizardStep4Import.tsx` | 105 | `userId` prop accepted but unused | Info | Intentional stub — SUMMARY-02-02 known stubs: "user auth flows via JWT, not userId in path." Not a bug. |

No TBD, FIXME, or XXX debt markers found. No unreferenced stubs.

---

### Human Verification Required

#### 1. IA Chat Bubble Visual Rendering

**Test:** Start the dev server (`npm run dev` from repo root), navigate to coach onboarding Step 4 (append `?step=4` or complete Steps 1-3). Observe the Step 4 card.
**Expected:** An orange square avatar showing "IA" appears top-left, followed by a light-grey speech bubble containing "Envoie-moi tes docs et je m'occupe du reste." The bubble has a notch on the top-left (rounded-tl-none).
**Why human:** Visual rendering — cannot verify DOM output without a browser.

#### 2. Drag-and-Drop Visual State

**Test:** Drag a file over the drop zone.
**Expected:** Drop zone border turns orange (primary color) and the interior gets a light orange tint. Releasing the file adds it to the list.
**Why human:** DragEvent visual feedback requires browser interaction.

#### 3. 4-File Cap Enforcement in UI

**Test:** Select 4 files using the Browse button or drag-and-drop. Then attempt to select a 5th.
**Expected:** After the 4th file, the drop zone dims (opacity-50), becomes non-interactive (pointer-events-none), and the label switches to "Maximum de 4 fichiers atteint". The Browse button is disabled. Removing a file re-enables the zone.
**Why human:** State-driven visual changes requiring file selection interactions.

#### 4. Status Pill Progression During Live Pipeline

**Test:** With backend running, drop a real PDF on Step 4. Observe the file card's status pill.
**Expected:** Pill shows blue "Envoi..." with spinner → orange "Analyse..." with spinner → green "✓ Prêt" (or red "Erreur" with inline error message if parse fails).
**Why human:** Requires a live backend (POST /coach/imports returning 201 with signed URL, POST /parse returning 202, GET poll returning ready/failed). Cannot test without running server.

#### 5. File Removal Mid-Pipeline

**Test:** Add a file, immediately click the × button while the blue "Envoi..." pill is active.
**Expected:** File card disappears immediately. No React console warnings about state updates on unmounted/removed items. Drop zone re-enables if count was at 4. No lingering polling intervals (navigate away — no console warnings).
**Why human:** Async pipeline interaction requires browser with real file and active network requests.

---

### Gaps Summary

No blockers found. All 4 roadmap success criteria are verified at code level. All 3 requirement IDs (UPLOAD-01, UPLOAD-02, UPLOAD-03) are satisfied by substantive, wired, data-flowing implementation.

The 5 human verification items are standard UI/UX and live-pipeline checks that cannot be validated by static analysis. They do not indicate code defects — they confirm observable behavior under real conditions.

---

_Verified: 2026-05-30_
_Verifier: Claude (gsd-verifier)_
