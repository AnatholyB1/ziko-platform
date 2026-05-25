// ─── Excel Parsing ────────────────────────────────────────────────────────────
// Converts Excel (.xlsx / .xls) buffer to a CSV string for Claude text parsing.
// Uses xlsx (SheetJS) — pure JS, no native dependencies. Phase 28 D-10.

import * as XLSX from 'xlsx';

// Max CSV chars sent to Claude across all sheets combined.
const MAX_CSV_CHARS = 120_000;

// Sheets to skip — these are dashboards/metadata, not workout data.
const SKIP_SHEET_PATTERNS = [
  /^accueil$/i,
  /^données$/i,
  /^data$/i,
  /^feuille de match$/i,
  /^feuille\s*\d*$/i,
  /^préparation$/i,
  /^preparation$/i,
  /^summary$/i,
  /^résumé$/i,
];

function shouldSkip(name: string): boolean {
  return SKIP_SHEET_PATTERNS.some((p) => p.test(name.trim()));
}

/**
 * Strips rows that are entirely empty (commas and whitespace only).
 */
function stripEmptyRows(csv: string): string {
  return csv
    .split('\n')
    .filter((line) => line.replace(/,/g, '').trim().length > 0)
    .join('\n');
}

/**
 * Parses an Excel buffer (xlsx or xls) and returns all workout sheets as a
 * single concatenated CSV string, with sheet name headers between sections.
 *
 * Administrative/dashboard sheets (Accueil, Données, etc.) are skipped.
 * Empty rows are stripped. Combined output is truncated at MAX_CSV_CHARS.
 *
 * Synchronous — XLSX.read is not async.
 */
export function parseExcel(buffer: Buffer): string {
  const workbook = XLSX.read(buffer, { type: 'buffer' });

  const parts: string[] = [];
  let totalChars = 0;

  for (const sheetName of workbook.SheetNames) {
    if (shouldSkip(sheetName)) {
      console.log(`[parseExcel] Skipping sheet: "${sheetName}"`);
      continue;
    }

    const sheet = workbook.Sheets[sheetName];
    const raw = XLSX.utils.sheet_to_csv(sheet);
    const stripped = stripEmptyRows(raw);

    if (!stripped.trim()) continue;

    const section = `\n### ${sheetName}\n${stripped}`;
    totalChars += section.length;

    if (totalChars > MAX_CSV_CHARS) {
      console.warn(
        `[parseExcel] Reached MAX_CSV_CHARS (${MAX_CSV_CHARS}) at sheet "${sheetName}" — stopping`,
      );
      break;
    }

    parts.push(section);
    console.log(`[parseExcel] Sheet "${sheetName}": ${stripped.length} chars`);
  }

  const result = parts.join('\n');
  console.log(`[parseExcel] Total: ${result.length} chars across ${parts.length} sheets`);
  return result;
}
