// Phase 28 plan 02 — Excel parsing tests (Wave 2)
import { describe, it, expect } from 'vitest';
import { parseExcel } from '../../../src/coach/imports/parse/excel.js';
import * as XLSX from 'xlsx';

describe('parse/excel', () => {
  it('excel-parse: parseExcel returns non-empty CSV string for .xlsx buffer', () => { // IMPORT-08
    // Build a minimal in-memory xlsx buffer
    const workbook = XLSX.utils.book_new();
    const wsData = [
      ['Week', 'Session', 'Exercise', 'Sets', 'Reps'],
      ['1', 'Day 1', 'Squat', '4', '6'],
      ['1', 'Day 1', 'Bench Press', '4', '8'],
    ];
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    XLSX.utils.book_append_sheet(workbook, ws, 'Program');
    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }) as Buffer;

    const csv = parseExcel(buffer);

    expect(typeof csv).toBe('string');
    expect(csv.length).toBeGreaterThan(0);
    expect(csv).toContain('Week');
    expect(csv).toContain('Squat');
  });
});
