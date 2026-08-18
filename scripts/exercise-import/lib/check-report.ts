/**
 * Structural sanity checker for a generated match-report.json.
 *
 * This exists so the "does the report look sane" pass is repeatable across
 * every tuning iteration in plan 02-06 (run -> inspect -> adjust
 * TIER2_THRESHOLD -> re-run), instead of being a one-off eyeball check.
 *
 * `checkReport` is a pure function: it accepts whatever was JSON.parse'd
 * from disk (typed `unknown`) and returns a list of human-readable problem
 * strings, never throwing on a malformed shape. Every check here is
 * independent of the others — a schema failure does not suppress the rest
 * of the structural checks, since a caller iterating on a broken report
 * needs to see everything wrong with it in one pass, not one problem at a
 * time.
 *
 * No CommonJS-directory-global / ESM-module-url-meta usage here
 * (module-system constraint, see README.md "Module System"). Like
 * fetch.ts/match.ts, this file calls its CLI entrypoint unconditionally at
 * module load and is never imported by a test.
 */
import { existsSync, readFileSync } from 'fs';
import { REPORT_JSON_PATH } from './paths';
import { MatchReportSchema, type MatchReport } from './types';

const MAX_AMBIGUOUS_CANDIDATES = 3;
const PAGINATION_TRUNCATION_COUNT = 1000;

type UnknownRow = Record<string, unknown>;

function asArray(value: unknown): UnknownRow[] {
  return Array.isArray(value) ? (value as UnknownRow[]) : [];
}

function asNumber(value: unknown): number | undefined {
  return typeof value === 'number' ? value : undefined;
}

/**
 * Runs every structural check against a JSON.parse'd match report and
 * returns the list of problems found. An empty array means the report is
 * structurally sound. Never throws — every field access is defensive so a
 * badly malformed report still yields a useful (long) problem list instead
 * of an uncaught exception.
 */
export function checkReport(report: unknown): string[] {
  const problems: string[] = [];

  const parsed = MatchReportSchema.safeParse(report);
  if (!parsed.success) {
    problems.push(`report fails MatchReportSchema.parse: ${parsed.error.message}`);
  }

  const r = (report ?? {}) as UnknownRow;
  const counts = (r.counts ?? {}) as UnknownRow;
  const matched = asArray(r.matched);
  const unmatchedNew = asArray(r.unmatched_new);
  const unmatchedLegacy = asArray(r.unmatched_legacy);
  const ambiguous = asArray(r.ambiguous);

  const countsMatched = asNumber(counts.matched);
  const countsUnmatchedNew = asNumber(counts.unmatched_new);
  const countsUnmatchedLegacy = asNumber(counts.unmatched_legacy);
  const countsAmbiguous = asNumber(counts.ambiguous);
  const datasetCount = asNumber(r.dataset_count);

  if (
    countsMatched !== undefined &&
    countsUnmatchedNew !== undefined &&
    countsAmbiguous !== undefined &&
    datasetCount !== undefined
  ) {
    const total = countsMatched + countsUnmatchedNew + countsAmbiguous;
    if (total !== datasetCount) {
      problems.push(
        `counts.matched + counts.unmatched_new + counts.ambiguous (${total}) !== dataset_count (${datasetCount})`,
      );
    }
  }

  if (countsMatched !== undefined && countsMatched !== matched.length) {
    problems.push(`counts.matched (${countsMatched}) !== matched.length (${matched.length})`);
  }
  if (countsUnmatchedNew !== undefined && countsUnmatchedNew !== unmatchedNew.length) {
    problems.push(
      `counts.unmatched_new (${countsUnmatchedNew}) !== unmatched_new.length (${unmatchedNew.length})`,
    );
  }
  if (countsUnmatchedLegacy !== undefined && countsUnmatchedLegacy !== unmatchedLegacy.length) {
    problems.push(
      `counts.unmatched_legacy (${countsUnmatchedLegacy}) !== unmatched_legacy.length (${unmatchedLegacy.length})`,
    );
  }
  if (countsAmbiguous !== undefined && countsAmbiguous !== ambiguous.length) {
    problems.push(`counts.ambiguous (${countsAmbiguous}) !== ambiguous.length (${ambiguous.length})`);
  }

  const productionCount = asNumber(r.production_count);
  if (productionCount === PAGINATION_TRUNCATION_COUNT) {
    problems.push(
      `production_count is exactly ${PAGINATION_TRUNCATION_COUNT} — possible PostgREST pagination ` +
        'truncation (see fetchAllProductionExercises)',
    );
  }

  if (countsMatched === 0) {
    problems.push('counts.matched is 0 — normalization or index wiring may be broken');
  }

  const rowsWithCategory: Array<{ category: string; id: unknown; row: UnknownRow }> = [
    ...matched.map((row) => ({ category: 'matched', id: row.dataset_id, row })),
    ...unmatchedNew.map((row) => ({ category: 'unmatched_new', id: row.dataset_id, row })),
    ...unmatchedLegacy.map((row) => ({ category: 'unmatched_legacy', id: row.exercise_id, row })),
    ...ambiguous.map((row) => ({ category: 'ambiguous', id: row.dataset_id, row })),
  ];
  for (const { category, id, row } of rowsWithCategory) {
    if (row.phase3_status === undefined) {
      problems.push(`${category} row ${String(id)} is missing phase3_status`);
    } else if (row.phase3_status === 'skipped') {
      problems.push(
        `${category} row ${String(id)} carries phase3_status "skipped" — Phase 2 must never produce this value`,
      );
    }
  }

  for (const row of ambiguous) {
    const candidates = asArray(row.candidates);
    if (candidates.length > MAX_AMBIGUOUS_CANDIDATES) {
      problems.push(
        `ambiguous row ${String(row.dataset_id)} has ${candidates.length} candidates (max ${MAX_AMBIGUOUS_CANDIDATES})`,
      );
    }
  }

  const matchedExerciseIds = new Set(matched.map((row) => row.exercise_id));
  for (const row of unmatchedLegacy) {
    if (matchedExerciseIds.has(row.exercise_id)) {
      problems.push(
        `production exercise_id ${String(row.exercise_id)} appears in both matched and unmatched_legacy`,
      );
    }
  }

  // CR-01 / WR-01: no exercise_id offered as an ambiguous candidate may
  // already be claimed in matched — a human approving that candidate would
  // otherwise produce two independent claims on the same production row in
  // Phase 3.
  for (const row of ambiguous) {
    const candidates = asArray(row.candidates);
    for (const candidate of candidates) {
      if (matchedExerciseIds.has(candidate.exercise_id)) {
        problems.push(
          `ambiguous row ${String(row.dataset_id)} offers candidate ` +
            `${String(candidate.exercise_id)}, which is already claimed in matched`,
        );
      }
    }
  }

  // Every matched production exercise_id must be unique — a repeat means
  // two dataset records double-claimed the same production row (see the
  // Tier 1 consumed-check fix in lib/matcher.ts, found via this exact
  // check against the real dataset during plan 02-06).
  const seenMatchedIds = new Map<unknown, number>();
  for (const row of matched) {
    seenMatchedIds.set(row.exercise_id, (seenMatchedIds.get(row.exercise_id) ?? 0) + 1);
  }
  for (const [exerciseId, count] of seenMatchedIds) {
    if (count > 1) {
      problems.push(`production exercise_id ${String(exerciseId)} appears ${count} times in matched (must be unique)`);
    }
  }

  return problems;
}

function main(): void {
  if (!existsSync(REPORT_JSON_PATH)) {
    console.error(`No report found at ${REPORT_JSON_PATH}. Run match.ts first.`);
    process.exit(1);
  }

  let parsed: unknown;
  try {
    const raw = readFileSync(REPORT_JSON_PATH, 'utf-8');
    parsed = JSON.parse(raw);
  } catch (err) {
    console.error(
      `Could not read/parse ${REPORT_JSON_PATH} as JSON: ${err instanceof Error ? err.message : String(err)}`,
    );
    process.exit(1);
    return;
  }

  const problems = checkReport(parsed);

  if (problems.length === 0) {
    console.log(`OK — ${REPORT_JSON_PATH} passes all structural checks.`);
    process.exit(0);
  }

  console.error(`FAILED — ${problems.length} problem(s) found in ${REPORT_JSON_PATH}:`);
  for (const problem of problems) {
    console.error(`  - ${problem}`);
  }
  process.exit(1);
}

main();

// Exported for future type reference — not used internally, kept to signal
// this file's checks are meant to validate a real MatchReport shape.
export type { MatchReport };
