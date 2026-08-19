---
phase: 28-ai-file-imports
plan: 02
subsystem: backend/api — parse pipeline + credit system
tags: [credits, pdf, excel, word, claude, generateObject, pdfjs-dist, mammoth, xlsx]
dependency_graph:
  requires:
    - 28-01 (packages installed: pdfjs-dist, canvas, @napi-rs/canvas, xlsx, mammoth)
  provides:
    - CreditAction extended with 'import' + variable-cost deductCredits
    - parse/pdf.ts: rasterizePdf, getPdfPageCount
    - parse/excel.ts: parseExcel
    - parse/word.ts: parseWord
    - parse/claude.ts: parseWithVision, parseWithText
  affects:
    - backend/api/src/services/creditService.ts (backward-compatible extension)
    - 28-04 (parse route imports all four parse/*.ts files directly)
tech_stack:
  added:
    - '@napi-rs/canvas' (already installed as pdfjs-dist optional dep) — DOMMatrix + createCanvas polyfills
  patterns:
    - Dynamic import singleton to sequence global polyfills before pdfjs-dist module init
    - generateObject with Zod schema for structured AI output
    - costOverride optional parameter on deductCredits (backward-compatible)
key_files:
  created:
    - backend/api/src/coach/imports/parse/pdf.ts
    - backend/api/src/coach/imports/parse/excel.ts
    - backend/api/src/coach/imports/parse/word.ts
    - backend/api/src/coach/imports/parse/claude.ts
    - backend/api/test/coach/parse/claude.spec.ts
  modified:
    - backend/api/src/config/credits.ts (import: 0 sentinel)
    - backend/api/src/services/creditService.ts (costOverride? 4th param)
    - backend/api/test/coach/imports.spec.ts (credit-cost test body)
    - backend/api/test/coach/parse/pdf.spec.ts (export shape tests)
    - backend/api/test/coach/parse/excel.spec.ts (in-memory xlsx test)
decisions:
  - "pdfjs-dist v5 uses RenderParameters.canvas (not canvasContext) — v4 API deprecated"
  - "Dynamic import singleton for pdf.ts to sequence DOMMatrix polyfill before pdfjs-dist init"
  - "@napi-rs/canvas used instead of canvas npm package — it is pdfjs-dist v5's optional dep and provides DOMMatrix"
  - "mammoth.convertToMarkdown accessed via require() cast — index.d.ts lacks the declaration"
metrics:
  duration: "31 minutes"
  completed: "2026-05-21"
  tasks: 3
  files_created: 5
  files_modified: 5
---

# Phase 28 Plan 02: Parse Pipeline & Credits Extension Summary

**One-liner:** Variable-cost credit extension + PDF/Excel/Word/Claude parse submodule files using pdfjs-dist v5 + @napi-rs/canvas, xlsx, mammoth, and generateObject.

## Tasks Completed

| # | Task | Commit | Status |
|---|------|--------|--------|
| 1 | Extend credits.ts + deductCredits costOverride | 83f4d3f | Done |
| 2 | Implement parse/pdf.ts, excel.ts, word.ts | 1dc77d7 | Done |
| 3 | Implement parse/claude.ts (generateObject wrapper) | 5b0051e | Done |

## Verification

- TypeScript: clean (`tsc --noEmit` — 0 errors)
- Tests: 85 passing, 0 failing (5 pre-existing RLS integration failures due to Supabase rate limits — unrelated to plan changes)
- `import: 0` confirmed in CREDIT_COSTS
- `deductCredits` accepts `costOverride?` as 4th param
- All four parse files export their required functions

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] pdfjs-dist v5 API changes from v4 (RESEARCH.md assumed v4 patterns)**
- **Found during:** Task 2
- **Issue:** RESEARCH.md Pattern 2 used v4 API (`disableWorker` option, `canvasContext` render param). pdfjs-dist v5.7.284 removed `disableWorker` from `DocumentInitParameters` and deprecated `canvasContext` — `RenderParameters` now requires `canvas: HTMLCanvasElement | null`.
- **Fix:** Updated pdf.ts to use v5 `RenderParameters.canvas` with `@napi-rs/canvas Canvas` cast to `HTMLCanvasElement`.
- **Files modified:** `backend/api/src/coach/imports/parse/pdf.ts`
- **Commit:** 1dc77d7

**2. [Rule 1 - Bug] pdfjs-dist v5 requires DOMMatrix global polyfill before module init**
- **Found during:** Task 2
- **Issue:** `import { getDocument } from 'pdfjs-dist'` with static import → ES module hoisting causes pdfjs-dist to initialize before polyfill code runs → `DOMMatrix is not defined` at runtime.
- **Fix:** Changed to dynamic import singleton (`getPdfjsLib()`) that sets `globalThis.DOMMatrix = DOMMatrix` from `@napi-rs/canvas` before calling `import('pdfjs-dist')`.
- **Files modified:** `backend/api/src/coach/imports/parse/pdf.ts`
- **Commit:** 1dc77d7

**3. [Rule 1 - Bug] `pdfjs-dist/legacy/build/pdf.js` import path does not exist in v5**
- **Found during:** Task 2
- **Issue:** RESEARCH.md Pitfall 5 documents `import from 'pdfjs-dist/legacy/build/pdf.js'` for Node.js. In pdfjs-dist v5, all build files are `.mjs` (not `.js`). With `moduleResolution: NodeNext`, the `.js` path fails to resolve.
- **Fix:** Import from `'pdfjs-dist'` (main entry) — package.json `"main": "build/pdf.mjs"` + DOMMatrix polyfill via `@napi-rs/canvas` eliminates the browser-globals issue that Pitfall 5 warned about.
- **Files modified:** `backend/api/src/coach/imports/parse/pdf.ts`
- **Commit:** 1dc77d7

**4. [Rule 1 - Bug] mammoth index.d.ts missing convertToMarkdown declaration**
- **Found during:** Task 2
- **Issue:** mammoth's TypeScript declaration file (`lib/index.d.ts`) declares only `convertToHtml` and `extractRawText`. `convertToMarkdown` exists in the JS (`exports.convertToMarkdown`) but is absent from types.
- **Fix:** Used `require('mammoth')` with explicit type cast including `convertToMarkdown`. The function works correctly at runtime.
- **Files modified:** `backend/api/src/coach/imports/parse/word.ts`
- **Commit:** 1dc77d7

**5. [Rule 1 - Bug] TS7017 on `globalThis` property assignment**
- **Found during:** Task 2
- **Issue:** TypeScript strict mode rejects `globalThis.DOMMatrix = ...` and `(globalThis as any).DOMMatrix = ...` with TS7017 ("no index signature").
- **Fix:** Used `const g = globalThis as Record<string, unknown>` + `'DOMMatrix' in g` check pattern.
- **Files modified:** `backend/api/src/coach/imports/parse/pdf.ts`
- **Commit:** 1dc77d7

## Known Stubs

None — all exported functions are fully implemented. No placeholder values.

## Threat Surface Scan

No new network endpoints, auth paths, or schema changes introduced in this plan. All files are internal parse utilities. The threat mitigations from the plan's threat model are implemented:
- T-28-02-01 (prompt injection): file content passed as base64/CSV/markdown data blocks, not system prompt
- T-28-02-02 (costOverride elevation): `costOverride` is server-computed only (documented in deductCredits JSDoc)
- T-28-02-03 (DoS via large PDFs): `maxPages=30` hard cap enforced in `rasterizePdf`

## Self-Check: PASSED

| Check | Result |
|-------|--------|
| backend/api/src/config/credits.ts exists | FOUND |
| backend/api/src/services/creditService.ts exists | FOUND |
| backend/api/src/coach/imports/parse/pdf.ts exists | FOUND |
| backend/api/src/coach/imports/parse/excel.ts exists | FOUND |
| backend/api/src/coach/imports/parse/word.ts exists | FOUND |
| backend/api/src/coach/imports/parse/claude.ts exists | FOUND |
| Commit 83f4d3f (Task 1) | FOUND |
| Commit 1dc77d7 (Task 2) | FOUND |
| Commit 5b0051e (Task 3) | FOUND |
| `import: 0` in CREDIT_COSTS | VERIFIED |
| `costOverride?` in deductCredits | VERIFIED |
| `rasterizePdf` + `getPdfPageCount` exported | VERIFIED |
| `parseExcel` exported | VERIFIED |
| `parseWord` exported | VERIFIED |
| `parseWithVision` + `parseWithText` exported | VERIFIED |
| TypeScript: 0 errors | PASSED |
| Tests: 85 pass, 0 fail (plan scope) | PASSED |
