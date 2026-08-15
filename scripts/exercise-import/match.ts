/**
 * Match entrypoint for the exercise-import pipeline (IMPORT-02).
 *
 * Reads the cached dataset clone (written by fetch.ts) and production
 * `exercises` (read-only, publishable key), categorizes every dataset
 * record via the 3-tier matcher, and writes the two fixed-filename report
 * artifacts (D-07, D-08) a human reviewer approves before Phase 3 ever
 * writes anything. This file only orchestrates lib/ modules — no tier
 * logic, normalization, or report shaping is re-implemented here.
 *
 * DRY RUN — this file performs zero Supabase writes of any kind (no
 * insert/update/upsert/delete/rpc/storage call anywhere below) and never
 * imports or reads a service-role credential.
 *
 * Run only via
 * `npx tsx --env-file=backend/api/.env.local scripts/exercise-import/match.ts`
 * from the repo root — never imported by a test, so it is safe to call
 * main() unconditionally at module load (same convention as fetch.ts and
 * scripts/food-data/import-foods.mjs).
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { spawnSync } from 'child_process';
import {
  assertRunFromRepoRoot,
  DATASET_ROOT,
  DATASET_JSON_PATH,
  REPORTS_DIR,
  REPORT_JSON_PATH,
  REPORT_MD_PATH,
} from './lib/paths';
import { loadDatasetJson } from './lib/verify';
import { createReadOnlyClient, fetchAllProductionExercises } from './lib/supabase-client';
import { categorizeAll } from './lib/matcher';
import { buildReport, mergePriorHumanDecisions, renderMarkdown } from './lib/report';
import { TIER2_THRESHOLD } from './lib/normalize';
import type { MatchReport } from './lib/types';

/**
 * Reads and JSON.parses an existing report file at `path`, if present.
 * A missing file returns null silently (first run). A present-but-corrupt
 * file (bad JSON) also degrades to null, with a printed warning — never a
 * crash. No schema validation happens here: only the `human_decision`
 * field is ever trusted out of a prior report (see
 * mergePriorHumanDecisions), so a tampered/malformed prior file cannot
 * manufacture a fake match result.
 */
function readPriorReport(path: string): MatchReport | null {
  if (!existsSync(path)) return null;
  try {
    const raw = readFileSync(path, 'utf-8');
    return JSON.parse(raw) as MatchReport;
  } catch (err) {
    console.warn(
      `Warning: could not parse existing report at ${path} as JSON — treating as no prior report. (${
        err instanceof Error ? err.message : String(err)
      })`,
    );
    return null;
  }
}

async function main(): Promise<void> {
  console.log('=== Exercise Dataset Match (Dry Run) ===\n');

  // 1. Must run from the repo root — every path constant is repo-root-relative.
  assertRunFromRepoRoot();

  // 2. The cached dataset clone must already exist and be verified.
  if (!existsSync(DATASET_ROOT)) {
    console.error(
      `No cached dataset clone found at ${DATASET_ROOT}. Run fetch.ts first: ` +
        'npx tsx --env-file=backend/api/.env.local scripts/exercise-import/fetch.ts',
    );
    process.exit(1);
  }

  // 3. Re-validate the cached dataset — a hand-edited or partially-written
  // cache must never slip into a report unchecked.
  const dataset = loadDatasetJson(DATASET_JSON_PATH);
  console.log(`Loaded ${dataset.length} dataset records from ${DATASET_JSON_PATH}`);

  // 4. Dataset commit SHA — argv-array spawnSync, no shell. Never crashes.
  const revParseResult = spawnSync('git', ['-C', DATASET_ROOT, 'rev-parse', 'HEAD'], {
    encoding: 'utf-8',
  });
  const datasetCommit =
    !revParseResult.error && revParseResult.status === 0 ? revParseResult.stdout.trim() : 'unknown';
  console.log(`dataset_commit=${datasetCommit}`);

  // 5. Read production, read-only (publishable key — see lib/supabase-client.ts).
  const client = createReadOnlyClient();
  const production = await fetchAllProductionExercises(client);
  console.log(`Loaded ${production.length} production exercises (is_custom=false only)`);

  // 6. Categorize.
  const categorized = categorizeAll(dataset, production);

  // 7. Load any prior report, build the new one, and carry forward reviewer decisions.
  const priorReport = readPriorReport(REPORT_JSON_PATH);
  const newReport = buildReport({
    categorized,
    datasetCount: dataset.length,
    productionCount: production.length,
    datasetCommit,
    tier2Threshold: TIER2_THRESHOLD,
    generatedAt: new Date().toISOString(),
  });
  const { report, carriedForward, stale } = mergePriorHumanDecisions(newReport, priorReport);

  // 8. Write both artifacts at their fixed paths (D-08 — overwritten every run).
  mkdirSync(REPORTS_DIR, { recursive: true });
  writeFileSync(REPORT_JSON_PATH, JSON.stringify(report, null, 2) + '\n', 'utf-8');
  writeFileSync(REPORT_MD_PATH, renderMarkdown(report), 'utf-8');

  // 9. Final summary.
  console.log('\n=== Match Complete ===');
  console.log(`Matched: ${report.counts.matched}`);
  console.log(`Unmatched (new): ${report.counts.unmatched_new}`);
  console.log(`Unmatched (legacy): ${report.counts.unmatched_legacy}`);
  console.log(`Ambiguous: ${report.counts.ambiguous}`);
  console.log(`Duplicate-name warnings: ${report.warnings.duplicate_production_names.length}`);
  console.log(`Carried-forward human decisions: ${carriedForward}`);
  console.log(`Stale carried-forward decisions: ${stale}`);
  console.log(`Report JSON: ${REPORT_JSON_PATH}`);
  console.log(`Report Markdown: ${REPORT_MD_PATH}`);
  console.log('\nDRY RUN — 0 rows written to Supabase');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
