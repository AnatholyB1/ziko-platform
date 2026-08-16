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
import { assertRunFromRepoRoot, DATASET_ROOT, DATASET_JSON_PATH, REPORT_JSON_PATH } from './lib/paths';
import { loadDatasetJson } from './lib/verify';
import { createWriteClient } from './lib/supabase-write-client';
import { buildResumeMap, type ImportLogRow, type ResumeState } from './lib/import-log';
import { collectUnmappableCategories } from './lib/category';
import { MatchReportSchema, type MatchReport } from './lib/types';

const LOG_PAGE_SIZE = 1000;
const SAMPLE_ROWS_PER_CATEGORY = 5;

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
  void datasetById; // consumed by the post-confirmation loop (Task 2)

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

  // Resume summary for the confirmation prompt (per-row work-list
  // assembly and the post-confirmation loop itself land in Task 2).
  const allSourceIds = [
    ...report.matched.map((r) => r.dataset_id),
    ...report.unmatched_new.map((r) => r.dataset_id),
    ...report.unmatched_legacy.map((r) => r.exercise_id),
    ...report.ambiguous.map((r) => r.dataset_id),
  ];
  let unprocessedCount = 0;
  let retryCount = 0;
  let skipCount = 0;
  for (const sourceId of allSourceIds) {
    const state: ResumeState | undefined = resumeMap.get(sourceId);
    if (state === undefined) unprocessedCount++;
    else if (state === 'retry') retryCount++;
    else skipCount++;
  }

  await confirmOrExit(
    report,
    { unprocessed: unprocessedCount, retry: retryCount, skip: skipCount },
    unmappableCategories,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
