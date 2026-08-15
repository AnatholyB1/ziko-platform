/**
 * Guard against a Postgres 23514 check_violation on exercises.category.
 * STUB — implementation pending (TDD RED phase).
 */
export const ALLOWED_CATEGORIES: readonly string[] = [];

export function mapDatasetCategory(_raw: string | null | undefined): string | null {
  throw new Error('not implemented');
}

export function collectUnmappableCategories(
  _records: { id: string; category: string }[],
): { value: string; dataset_ids: string[] }[] {
  throw new Error('not implemented');
}
