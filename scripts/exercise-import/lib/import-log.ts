/**
 * IMPORT-04 resumability: pure resume-state reduction over
 * `exercise_import_log` rows. Pure functions only — no filesystem access,
 * no Supabase client construction; the caller (`merge.ts`) performs the
 * SELECT and passes rows in, mirroring `report.ts`'s I/O-vs-logic split.
 *
 * The resume signal is `error_message`, NOT `status` — Phase 1's locked
 * `exercise_import_log` CHECK constraint has no `'error'` value, and
 * inventing one would raise a Postgres `23514` (see README.md's linked
 * pitfalls; `status` is deliberately not consulted here).
 *
 * `exercise_import_log` is append-only with no unique constraint on
 * `source_id` (only a plain btree index) — multiple rows per `source_id`
 * accumulate across runs, so `ON CONFLICT (source_id)` is invalid and the
 * only safe way to determine current state is to reduce over every row.
 *
 * No CommonJS-directory-global / ESM-module-url-meta usage here
 * (module-system constraint, see README.md "Module System").
 */

export interface ImportLogRow {
  source_id: string;
  exercise_id: string | null;
  status: 'matched' | 'inserted' | 'skipped' | 'needs_review';
  error_message: string | null;
  processed_at: string;
}

export type ResumeState = 'done' | 'retry' | 'unprocessed';

/**
 * `undefined` (no log row at all for this source_id) gives `'unprocessed'`.
 * A non-null `error_message` on the latest row gives `'retry'` (D-08: an
 * errored row is picked back up automatically on the next run, no manual
 * clear step). Otherwise `'done'`. `status` is deliberately not consulted.
 */
export function computeResumeState(latest: ImportLogRow | undefined): ResumeState {
  if (latest === undefined) return 'unprocessed';
  if (latest.error_message !== null) return 'retry';
  return 'done';
}

/**
 * In-memory equivalent of
 * `SELECT DISTINCT ON (source_id) * ... ORDER BY source_id, processed_at DESC`.
 * `processed_at` is an ISO 8601 string; comparison is done via `Date.parse`
 * (rather than lexicographic string comparison) so this stays correct even
 * if two rows' `processed_at` values use differing but equally-valid ISO
 * 8601 representations (e.g. differing fractional-second precision).
 * Keeps the row with the greatest `processed_at` per `source_id`. Input
 * order does not affect the result.
 */
export function reduceLatestBySourceId(rows: ImportLogRow[]): Map<string, ImportLogRow> {
  const latestBySourceId = new Map<string, ImportLogRow>();

  for (const row of rows) {
    const existing = latestBySourceId.get(row.source_id);
    if (!existing || Date.parse(row.processed_at) > Date.parse(existing.processed_at)) {
      latestBySourceId.set(row.source_id, row);
    }
  }

  return latestBySourceId;
}

/**
 * Composes `reduceLatestBySourceId` and `computeResumeState` into a single
 * `source_id -> ResumeState` map. A `source_id` with no log row at all is
 * simply absent from the returned map (callers treat a missing key as
 * `'unprocessed'`); this function never invents `'unprocessed'` entries
 * for source_ids it hasn't seen, since it only has rows that exist.
 */
export function buildResumeMap(rows: ImportLogRow[]): Map<string, ResumeState> {
  const latestBySourceId = reduceLatestBySourceId(rows);
  const resumeMap = new Map<string, ResumeState>();

  for (const [sourceId, latest] of latestBySourceId) {
    resumeMap.set(sourceId, computeResumeState(latest));
  }

  return resumeMap;
}
