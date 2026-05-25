---
phase: 28
slug: ai-file-imports
created: 2026-05-21
nyquist_validation: true
---

# Phase 28: AI File Imports — Validation Strategy

## Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 3.2.4 |
| Config file | `backend/api/vitest.config.ts` |
| Quick run command | `cd backend/api && npm test -- --reporter=dot` |
| Full suite command | `cd backend/api && npm test -- --reporter=verbose` |

## Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File |
|--------|----------|-----------|-------------------|------|
| IMPORT-01 | Signed URL returned for valid upload request | unit | `vitest run test/coach/imports.spec.ts -t "upload-url"` | Wave 0 stub → Wave 5 impl |
| IMPORT-02 | Variable credit cost: PDF page_count → min(n,10) credits | unit | `vitest run test/coach/imports.spec.ts -t "credit-cost"` | Wave 0 stub → Wave 5 impl |
| IMPORT-03 | ImportedProgramSchema Zod validation passes on valid Claude output | unit | `vitest run test/coach/imports.spec.ts -t "schema-validation"` | Wave 0 stub → Wave 5 impl |
| IMPORT-04 | Import route accessible by both athlete JWT and coach JWT | integration | `vitest run test/coach/imports.spec.ts -t "dual-mode"` | Wave 0 stub → Wave 5 impl |
| IMPORT-05 | Status transitions: pending→uploaded→parsing→ready | unit | `vitest run test/coach/imports.spec.ts -t "status-machine"` | Wave 0 stub → Wave 5 impl |
| IMPORT-06 | Parse route returns 202 immediately | integration | `vitest run test/coach/imports.spec.ts -t "202-async"` | Wave 0 stub → Wave 5 impl |
| IMPORT-07 | PDF rasterize: 30 pages → 30 base64 PNG strings | unit | `vitest run test/coach/parse/pdf.spec.ts` | Wave 0 stub → Wave 5 impl |
| IMPORT-08 | Excel → CSV → Claude text produces valid schema | unit | `vitest run test/coach/parse/excel.spec.ts` | Wave 0 stub → Wave 5 impl |
| IMPORT-09 | Diff algo: new/removed/changed rows identified correctly | unit | `vitest run test/coach/imports.spec.ts -t "diff-algo"` | Wave 0 stub → Wave 5 impl |
| IMPORT-10 | Commit creates workout_programs row with correct is_template | integration | `vitest run test/coach/imports.spec.ts -t "commit"` | Wave 0 stub → Wave 5 impl |

## Sampling Rate

- **Per task commit:** `cd backend/api && npm test -- --reporter=dot`
- **Per wave merge:** `cd backend/api && npm test`
- **Phase gate:** Full suite green before `/gsd:verify-work`

## Wave 0 Stubs Required

- [ ] `backend/api/test/coach/imports.spec.ts` — IMPORT-01 through IMPORT-06, IMPORT-09, IMPORT-10
- [ ] `backend/api/test/coach/parse/pdf.spec.ts` — IMPORT-07
- [ ] `backend/api/test/coach/parse/excel.spec.ts` — IMPORT-08

## Phase Gate (must ALL be true before verification passes)

- [ ] `cd backend/api && npm test` exits 0 (all tests green)
- [ ] `GET /coach/imports` returns import list for coach JWT
- [ ] `POST /coach/imports` + signed URL upload + `POST /coach/imports/:id/parse` → status reaches `ready` or `failed` within 60s
- [ ] Preview page at `/coach/imports/[id]` renders confidence highlights for fields < 0.70
- [ ] Commit creates `workout_programs` row with correct `is_template` value
- [ ] Mobile `ImportFileScreen` visible on expo-document-picker trigger (no crash)
- [ ] Vercel preview deployment: PDF rasterization smoke test passes (canvas binary resolved)
