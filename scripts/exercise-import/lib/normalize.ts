/**
 * Name normalization and edit-distance similarity for the exercise-import
 * matcher. No CommonJS-directory-global / ESM-module-url-meta usage here
 * (module-system constraint, see README.md "Module System").
 */
import { distance } from 'fastest-levenshtein';

/**
 * Normalizes an exercise name for Tier 1/2 comparison: NFKD-decomposes
 * accented characters, strips combining marks, lowercases, trims, and
 * collapses internal whitespace to a single space.
 *
 * Deliberately does NOT strip `/` or `-` — they are semantically
 * meaningful in this corpus ("3/4 sit-up", "push-up").
 *
 * Returns '' for a null/undefined input.
 */
export function normalizeExerciseName(raw: string | null | undefined): string {
  if (raw == null) return '';
  return raw
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '') // strip combining marks (keep ASCII base letters)
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ');
}

/**
 * Edit-distance similarity ratio in [0, 1], 1 meaning identical.
 * Callers pass ALREADY-normalized strings (via normalizeExerciseName).
 */
export function similarityRatio(a: string, b: string): number {
  const d = distance(a, b);
  return 1 - d / Math.max(a.length, b.length, 1);
}

// Conservative starting point per IMPORT-02's precision-first mandate
// (D-03). Referenced nowhere else as a literal, so the tuning loop in
// plan 02-06 is a one-line change.
export const TIER2_THRESHOLD = 0.87;

/**
 * The Pitfall-4 safety primitive: groups every row by its normalized name,
 * mapping each normalized name to ALL rows carrying it, so the caller can
 * detect duplicates instead of losing rows to a `Map.set()` collision.
 * Rows whose normalized name is '' are skipped.
 */
export function groupByNormalizedName<T>(
  rows: T[],
  nameOf: (row: T) => string | null | undefined,
): Map<string, T[]> {
  const groups = new Map<string, T[]>();
  for (const row of rows) {
    const normalized = normalizeExerciseName(nameOf(row));
    if (normalized === '') continue;
    const existing = groups.get(normalized);
    if (existing) {
      existing.push(row);
    } else {
      groups.set(normalized, [row]);
    }
  }
  return groups;
}
