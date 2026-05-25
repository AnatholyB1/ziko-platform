// ─── Excel Parsing ────────────────────────────────────────────────────────────
// Converts Excel (.xlsx / .xls) buffer to a CSV string for Claude text parsing.
// Uses xlsx (SheetJS) — pure JS, no native dependencies. Phase 28 D-10.

import * as XLSX from 'xlsx';

/**
 * Parses an Excel buffer (xlsx or xls) and returns the first sheet as CSV.
 *
 * Only the first sheet is extracted — workout program files typically contain
 * all program data in a single sheet. If multi-sheet programs become common,
 * this can be extended in a future plan.
 *
 * Synchronous — XLSX.read is not async.
 */
export function parseExcel(buffer: Buffer): string {
  const workbook = XLSX.read(buffer, { type: 'buffer' });

  // First sheet with data
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];

  return XLSX.utils.sheet_to_csv(sheet);
}
