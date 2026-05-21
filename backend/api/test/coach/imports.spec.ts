// Phase 28 plan 01 — AI file imports stubs (Wave 0)
// All tests are it.todo — implement bodies in Wave 1 after routes exist.
import { describe, it, expect } from 'vitest';
import { ImportedProgramSchema } from '@ziko/coach-sdk';

// Verify the schema import resolves at compile time
void ImportedProgramSchema;

// ─── Credit cost formula (IMPORT-02) ────────────────────────────────────────
// Pure logic — no DB: Math.min(pageCount, 10) maps page counts to credits

function pdfCreditCost(pageCount: number): number {
  return Math.min(pageCount, 10);
}

describe('imports routes', () => {
  it.todo('upload-url: POST /coach/imports returns import_id and signed_upload_url');    // IMPORT-01
  it('credit-cost: PDF page_count maps to min(n,10) credits', () => {                   // IMPORT-02
    expect(pdfCreditCost(1)).toBe(1);
    expect(pdfCreditCost(5)).toBe(5);
    expect(pdfCreditCost(10)).toBe(10);
    expect(pdfCreditCost(11)).toBe(10);
    expect(pdfCreditCost(30)).toBe(10);
    expect(pdfCreditCost(0)).toBe(0);
  });
  it.todo('schema-validation: ImportedProgramSchema passes on valid Claude output');      // IMPORT-03
  it.todo('dual-mode: import route accepts athlete JWT and coach JWT');                   // IMPORT-04
  it.todo('status-machine: pending→uploaded→parsing→ready transitions');                 // IMPORT-05
  it.todo('202-async: POST /coach/imports/:id/parse returns 202 immediately');           // IMPORT-06
});

describe('diff algorithm', () => {
  it.todo('diff-algo: new/removed/changed rows identified correctly');                   // IMPORT-09
  it.todo('commit: PUT /coach/imports/:id/commit creates workout_programs row with correct is_template'); // IMPORT-10
});
