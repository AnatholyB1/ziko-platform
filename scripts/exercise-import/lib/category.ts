/**
 * Guard against a Postgres `23514` check_violation on `exercises.category`
 * (Pitfall 7 of 03-RESEARCH.md). `public.exercises.category` is NOT NULL
 * with `CHECK (category IN ('strength','cardio','flexibility','balance',
 * 'sports','stretching'))` (migration 004), while the upstream dataset's
 * `category` is free-text (`z.string().min(1)` — no promise about which
 * values appear). Without this guard, an unexpected value would produce a
 * `23514` mid-batch, potentially failing hundreds of rows.
 *
 * An unmappable value is deliberately NOT coerced to a default — silently
 * relabelling an exercise's category would corrupt the library more
 * quietly than failing the row.
 *
 * Consumption contract for downstream plans (do not improvise this in
 * merge.ts): plan 03-05's `merge.ts` calls `collectUnmappableCategories`
 * in preflight and prints the result in the pre-confirmation summary;
 * plan 03-04's `merge-row.ts` calls `mapDatasetCategory` per row and, on
 * `null`, OMITS `category` from the UPDATE payload for a matched row
 * (leaving production's existing valid value intact) and FAILS the row
 * with an explicit `error_message` for an unmatched_new INSERT (there is
 * no existing row to fall back to, and `category` is NOT NULL).
 *
 * Pure functions only, no I/O. No CommonJS-directory-global /
 * ESM-module-url-meta usage here (module-system constraint, see
 * README.md "Module System").
 */

// Order matches migration 004's CHECK constraint literal order.
export const ALLOWED_CATEGORIES: readonly string[] = Object.freeze([
  'strength',
  'cardio',
  'flexibility',
  'balance',
  'sports',
  'stretching',
]) as readonly string[];

const ALLOWED_SET = new Set(ALLOWED_CATEGORIES);

/**
 * Trims and lowercases `raw`, then returns it only if it is one of the six
 * CHECK-allowed values, else `null`. No fuzzy matching, no aliasing, no
 * fallback default — an unrecognized value is reported, never guessed.
 */
export function mapDatasetCategory(raw: string | null | undefined): string | null {
  if (raw == null) return null;
  const normalized = raw.trim().toLowerCase();
  if (normalized === '') return null;
  return ALLOWED_SET.has(normalized) ? normalized : null;
}

/**
 * Returns one entry per distinct raw category value that `mapDatasetCategory`
 * cannot map, each carrying the dataset ids that used it. The outer array is
 * sorted by `value` and each `dataset_ids` array is sorted ascending, so
 * output is deterministic across runs (matching the deterministic-ordering
 * convention already applied to the Phase 2 report).
 */
export function collectUnmappableCategories(
  records: { id: string; category: string }[],
): { value: string; dataset_ids: string[] }[] {
  const idsByValue = new Map<string, string[]>();

  for (const record of records) {
    if (mapDatasetCategory(record.category) !== null) continue;
    const existing = idsByValue.get(record.category);
    if (existing) {
      existing.push(record.id);
    } else {
      idsByValue.set(record.category, [record.id]);
    }
  }

  return Array.from(idsByValue.entries())
    .map(([value, dataset_ids]) => ({ value, dataset_ids: [...dataset_ids].sort() }))
    .sort((a, b) => (a.value < b.value ? -1 : a.value > b.value ? 1 : 0));
}
