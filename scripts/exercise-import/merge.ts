/**
 * Merge entrypoint for the exercise-import pipeline (IMPORT-03/04/05,
 * MEDIA-03/04).
 *
 * This is the ONE script in this pipeline permitted and required to write
 * — it uses the service-role key via `lib/supabase-write-client` (unlike
 * `fetch.ts`/`match.ts`, which are read-only, publishable-key-only dry
 * runs). It reads the human-approved `.planning/workstreams/image-exo/
 * reports/match-report.json`, writes to `public.exercises`,
 * `public.exercises_merge_backup`, `public.exercise_import_log`, and the
 * `exercise-media` Storage bucket, and never issues a DELETE anywhere.
 *
 * It requires an interactive TTY confirmation and has NO bypass flag by
 * design — see the `isTTY` guard at the very top of `main()` below. There
 * is no `--yes`/`--force`/`--non-interactive` flag, no `process.argv`
 * inspection, and no environment-variable escape hatch anywhere in this
 * file.
 *
 * Run only via
 * `npx tsx --env-file=backend/api/.env.local scripts/exercise-import/merge.ts`
 * from the repo root — never imported by a test, so it is safe to call
 * main() unconditionally at module load (same convention as fetch.ts and
 * match.ts).
 *
 * MODULE SYSTEM CONSTRAINT (see README.md "Module System"): this file must
 * never rely on Node's CommonJS current-module-directory global or the ESM
 * current-module-URL meta property. No CommonJS-directory-global /
 * ESM-module-url-meta usage here — extensionless relative imports, run
 * only from the repo root (enforced by `assertRunFromRepoRoot()`).
 */
import { existsSync, readFileSync } from 'fs';
import { spawnSync } from 'child_process';
import { createInterface } from 'readline/promises';
import { randomUUID } from 'crypto';
import { assertRunFromRepoRoot, DATASET_ROOT, DATASET_JSON_PATH, REPORT_JSON_PATH } from './lib/paths';
import { loadDatasetJson, resolveInsideRoot } from './lib/verify';
import { createWriteClient } from './lib/supabase-write-client';
import { buildResumeMap, type ImportLogRow, type ResumeState } from './lib/import-log';
import { collectUnmappableCategories } from './lib/category';
import { capImage, capGif } from './lib/media';
import { withRetry } from './lib/retry';
import { processRow, type MergeRowInput, type MergeRowKind } from './lib/merge-row';
import { MatchReportSchema, type MatchReport, type DatasetExercise } from './lib/types';

const LOG_PAGE_SIZE = 1000;
const SAMPLE_ROWS_PER_CATEGORY = 5;
const PROGRESS_INTERVAL = 50;
const MAX_REPORTED_ERRORS = 10;

interface WorkItem {
  kind: MergeRowKind;
  sourceId: string;
  exerciseId: string | null;
  datasetRecord: DatasetExercise | null;
}

/**
 * Prints a summary of what is about to be written and requires the
 * operator to type exactly "yes" on an interactive TTY. Does NOT re-check
 * `process.stdin.isTTY` — that invariant is already established as the
 * very first statement of `main()`, and duplicating the check here would
 * reintroduce ambiguity about which guard actually fired.
 *
 * This is a single, whole-report confirmation (D-05): no per-category
 * prompt, no second prompt.
 */
async function confirmOrExit(
  report: MatchReport,
  resumeSummary: { unprocessed: number; retry: number; skip: number },
  unmappableCategories: { value: string; dataset_ids: string[] }[],
): Promise<void> {
  console.log('\n=== Merge Summary ===');
  console.log(`Matched (UPDATE):      ${report.counts.matched}`);
  console.log(`Unmatched new (INSERT): ${report.counts.unmatched_new}`);
  console.log(`Unmatched legacy (needs_review): ${report.counts.unmatched_legacy}`);
  console.log(`Ambiguous (needs_review): ${report.counts.ambiguous}`);
  console.log('\n--- Resume state ---');
  console.log(`Unprocessed (will run):  ${resumeSummary.unprocessed}`);
  console.log(`Retry (prior error):     ${resumeSummary.retry}`);
  console.log(`Already done (skip):     ${resumeSummary.skip}`);

  console.log('\n--- Sample rows ---');
  console.log('Matched (up to 5):');
  for (const row of report.matched.slice(0, SAMPLE_ROWS_PER_CATEGORY)) {
    console.log(`  ${row.dataset_id} ${row.dataset_name} -> ${row.exercise_id} ${row.production_name}`);
  }
  console.log('Unmatched new (up to 5):');
  for (const row of report.unmatched_new.slice(0, SAMPLE_ROWS_PER_CATEGORY)) {
    console.log(`  ${row.dataset_id} ${row.dataset_name}`);
  }
  console.log('Unmatched legacy (up to 5):');
  for (const row of report.unmatched_legacy.slice(0, SAMPLE_ROWS_PER_CATEGORY)) {
    console.log(`  ${row.exercise_id} ${row.production_name}`);
  }
  console.log('Ambiguous (up to 5):');
  for (const row of report.ambiguous.slice(0, SAMPLE_ROWS_PER_CATEGORY)) {
    console.log(`  ${row.dataset_id} ${row.dataset_name} (${row.reason})`);
  }

  if (unmappableCategories.length > 0) {
    console.log('\n--- WARNING: unmappable dataset category values ---');
    for (const entry of unmappableCategories) {
      console.log(
        `  "${entry.value}" affects ${entry.dataset_ids.length} dataset id(s). ` +
          'Matched rows keep their existing category unchanged; unmatched-new rows ' +
          'with this category will fail and be logged.',
      );
    }
  }

  const rl = createInterface({ input: process.stdin, output: process.stdout });
  let answer: string;
  try {
    answer = await rl.question('\nProceed with merge? Type "yes" to continue: ');
  } finally {
    rl.close();
  }

  if (answer.trim().toLowerCase() !== 'yes') {
    console.log('Aborted — no writes made.');
    process.exit(0);
  }
}

/**
 * Reads every row of `public.exercise_import_log`, paginated in 1000-row
 * pages past PostgREST's silent default cap (same pattern as
 * `fetchAllProductionExercises` in lib/supabase-client.ts).
 */
async function readAllImportLogRows(client: ReturnType<typeof createWriteClient>): Promise<ImportLogRow[]> {
  const all: ImportLogRow[] = [];
  let from = 0;

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const { data, error } = await client
      .from('exercise_import_log')
      .select('source_id, exercise_id, status, error_message, processed_at')
      .range(from, from + LOG_PAGE_SIZE - 1);

    if (error) throw error;
    if (!data || data.length === 0) break;

    all.push(...(data as ImportLogRow[]));

    if (data.length < LOG_PAGE_SIZE) break;
    from += LOG_PAGE_SIZE;
  }

  return all;
}

async function main(): Promise<void> {
  // Step 0 — the interactivity guard. This MUST be the very first
  // statement of main(): before assertRunFromRepoRoot(), before any file
  // read, before any existsSync check, before any subprocess, before any
  // DB call. This ordering is load-bearing, not stylistic: on a machine
  // without .dataset-cache/ (its normal state), a non-interactive
  // invocation must exit 1 for THIS reason, not an unrelated one, so the
  // human gate is always the thing actually exercised regardless of
  // environment state.
  if (!process.stdin.isTTY) {
    console.error(
      'merge.ts requires an interactive terminal to confirm the merge. ' +
        'Input must not be piped, and this script must not run in CI. ' +
        'Run it directly from a terminal.',
    );
    process.exit(1);
  }

  console.log('=== Exercise Dataset Merge (Human-Approved Write) ===\n');

  // 1. Must run from the repo root — every path constant is repo-root-relative.
  assertRunFromRepoRoot();

  // 2. Parse the approved report strictly — a malformed or missing report
  // must be a loud, immediate failure. Use `parse`, NOT `safeParse`: this
  // file is the human-approved input and the entire write authorization
  // derives from it.
  const reportRaw = readFileSync(REPORT_JSON_PATH, 'utf-8');
  const reportParsed = JSON.parse(reportRaw);
  const report = MatchReportSchema.parse(reportParsed);
  console.log(`Loaded approved report: ${REPORT_JSON_PATH}`);
  console.log(`Report dataset_commit=${report.dataset_commit}`);

  // 3. Dataset cache guard — never attempt an implicit re-clone.
  if (!existsSync(DATASET_ROOT)) {
    console.error(
      `No cached dataset clone found at ${DATASET_ROOT}. Run fetch.ts first: ` +
        'npx tsx --env-file=backend/api/.env.local scripts/exercise-import/fetch.ts',
    );
    process.exit(1);
  }

  // 4. Dataset commit consistency — mandatory defence against silent
  // dataset drift between approval and write.
  const revParseResult = spawnSync('git', ['-C', DATASET_ROOT, 'rev-parse', 'HEAD'], {
    encoding: 'utf-8',
  });
  const datasetCommit =
    !revParseResult.error && revParseResult.status === 0 ? revParseResult.stdout.trim() : 'unknown';
  if (datasetCommit !== report.dataset_commit) {
    console.error(
      `Dataset commit mismatch: cloned dataset is at "${datasetCommit}" but the approved ` +
        `report was reviewed against "${report.dataset_commit}". The media and instructions ` +
        'on disk no longer match what the human reviewed. Either re-run fetch.ts at the ' +
        'approved commit, or re-run match.ts and re-approve the new report.',
    );
    process.exit(1);
  }
  console.log(`Dataset commit verified: ${datasetCommit}`);

  // 5. Load the full dataset and index it by dataset id — the report's
  // rows are deliberately thin (no image/gif_url/instructions), so the
  // full record is mandatory for every write.
  const dataset = loadDatasetJson(DATASET_JSON_PATH);
  const datasetById = new Map(dataset.map((r) => [r.id, r]));
  console.log(`Loaded ${dataset.length} dataset records from ${DATASET_JSON_PATH}`);

  // 6. Category preflight — keep the result for the summary, do NOT exit
  // on a non-empty result; the operator decides at the prompt.
  const unmappableCategories = collectUnmappableCategories(dataset);

  // 7. Write-capable (service-role) Supabase client.
  const client = createWriteClient();

  // 8. Resume state — read every row of exercise_import_log, paginated,
  // then reduce to the latest state per source_id. This table is
  // append-only with only a plain btree index on source_id (no unique
  // constraint), so a naive upsert-on-conflict approach is never valid
  // here — see lib/import-log.ts's docstring for the full rationale.
  const logRows = await readAllImportLogRows(client);
  const resumeMap = buildResumeMap(logRows);
  console.log(`Loaded ${logRows.length} prior exercise_import_log rows`);

  // Assemble the work list in a single deterministic order: all
  // report.matched rows, then all report.unmatched_new rows, then all
  // report.unmatched_legacy rows, then all report.ambiguous rows. The
  // legacy and ambiguous branches must exist and be exercised by the code
  // even though the approved report currently contains zero of each
  // (IMPORT-05 requires the path, not just the outcome).
  const workItems: WorkItem[] = [
    ...report.matched.map(
      (row): WorkItem => ({
        kind: 'matched',
        sourceId: row.dataset_id,
        exerciseId: row.exercise_id,
        datasetRecord: datasetById.get(row.dataset_id) ?? null,
      }),
    ),
    ...report.unmatched_new.map(
      (row): WorkItem => ({
        kind: 'unmatched_new',
        sourceId: row.dataset_id,
        exerciseId: null,
        datasetRecord: datasetById.get(row.dataset_id) ?? null,
      }),
    ),
    ...report.unmatched_legacy.map(
      (row): WorkItem => ({
        kind: 'needs_review',
        sourceId: row.exercise_id,
        exerciseId: row.exercise_id,
        datasetRecord: null,
      }),
    ),
    ...report.ambiguous.map(
      (row): WorkItem => ({
        kind: 'needs_review',
        sourceId: row.dataset_id,
        exerciseId: null,
        datasetRecord: null,
      }),
    ),
  ];

  // Resume summary for the confirmation prompt.
  let unprocessedCount = 0;
  let retryCount = 0;
  let skipCount = 0;
  for (const item of workItems) {
    const state: ResumeState | undefined = resumeMap.get(item.sourceId);
    if (state === undefined) unprocessedCount++;
    else if (state === 'retry') retryCount++;
    else skipCount++;
  }

  await confirmOrExit(
    report,
    { unprocessed: unprocessedCount, retry: retryCount, skip: skipCount },
    unmappableCategories,
  );

  // Injected readMediaBytes: resolves a dataset-relative path inside the
  // dataset root via resolveInsideRoot (throwing on an escaping path),
  // then reads the file. All filesystem and path-containment concerns
  // stay in this entrypoint — lib/merge-row.ts never touches the
  // filesystem directly.
  const readMediaBytes = async (datasetRelativePath: string): Promise<Buffer> => {
    const resolved = resolveInsideRoot(DATASET_ROOT, datasetRelativePath);
    if (resolved === null) {
      throw new Error(`Path escapes dataset root: ${datasetRelativePath}`);
    }
    return readFileSync(resolved);
  };

  const deps = { client, readMediaBytes, capImage, capGif, withRetry, newId: randomUUID };

  // Running tallies for the final summary.
  let updated = 0;
  let inserted = 0;
  let skipped = 0;
  let needsReview = 0;
  let errored = 0;
  let categoryOmitted = 0;
  const erroredRows: { sourceId: string; errorMessage: string }[] = [];

  console.log(`\nProcessing ${workItems.length} rows sequentially...`);

  let processedCount = 0;
  for (const item of workItems) {
    const resumeState: ResumeState | undefined = resumeMap.get(item.sourceId);

    if (resumeState === 'done') {
      // Already processed in a prior run — write the resume marker row
      // (Phase 1 D-06's documented meaning of 'skipped') without calling
      // processRow, so the log stays a complete audit trail of every
      // run's pass over every row.
      const { error: logError } = await client.from('exercise_import_log').insert({
        source_id: item.sourceId,
        exercise_id: item.exerciseId,
        status: 'skipped',
        error_message: null,
      });
      if (logError) {
        console.error(`Failed to write skip log row for ${item.sourceId}: ${logError.message}`);
      }
      skipped++;
      processedCount++;
      if (processedCount % PROGRESS_INTERVAL === 0) {
        console.log(`Progress: ${processedCount}/${workItems.length} (errors so far: ${errored})`);
      }
      continue;
    }

    // Both 'retry' and 'unprocessed' states proceed to processRow (D-08:
    // errored rows are picked up automatically, with no manual clear).
    const input: MergeRowInput = {
      kind: item.kind,
      sourceId: item.sourceId,
      exerciseId: item.exerciseId,
      datasetRecord: item.datasetRecord,
    };

    const result = await processRow(input, deps);

    const { error: logError } = await client.from('exercise_import_log').insert({
      source_id: result.sourceId,
      exercise_id: result.exerciseId,
      status: result.status,
      error_message: result.errorMessage,
    });
    if (logError) {
      console.error(`Failed to write log row for ${result.sourceId}: ${logError.message}`);
    }

    if (result.categoryOmitted) categoryOmitted++;

    if (result.errorMessage !== null) {
      errored++;
      if (erroredRows.length < MAX_REPORTED_ERRORS) {
        erroredRows.push({ sourceId: result.sourceId, errorMessage: result.errorMessage });
      }
    } else if (result.status === 'matched') {
      updated++;
    } else if (result.status === 'inserted') {
      inserted++;
    } else if (result.status === 'needs_review') {
      needsReview++;
    }

    processedCount++;
    if (processedCount % PROGRESS_INTERVAL === 0) {
      console.log(`Progress: ${processedCount}/${workItems.length} (errors so far: ${errored})`);
    }
  }

  console.log('\n=== Merge Complete ===');
  console.log(`Updated (matched):    ${updated}`);
  console.log(`Inserted (new):       ${inserted}`);
  console.log(`Skipped (resumed):    ${skipped}`);
  console.log(`Needs review:         ${needsReview}`);
  console.log(`Errored:              ${errored}`);
  console.log(`Category omitted:     ${categoryOmitted}`);

  if (errored > 0) {
    console.log('\nSome rows failed. First 10 errors:');
    for (const row of erroredRows) {
      console.log(`  ${row.sourceId}: ${row.errorMessage}`);
    }
    console.log(
      '\nErrored rows are retried automatically on the next run. Re-run: ' +
        'npx tsx --env-file=backend/api/.env.local scripts/exercise-import/merge.ts',
    );
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
