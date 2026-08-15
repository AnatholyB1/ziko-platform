/**
 * Fetch entrypoint for the exercise-import pipeline.
 *
 * Clones (or reuses a cached clone of) hasaneyldrm/exercises-dataset via
 * `git clone --depth 1`, then verifies the clone against exercises.json's
 * own array (the manifest equivalent — see lib/verify.ts docstring) before
 * declaring success. On any verification failure this hard-exits with a
 * non-zero status and NO report is written — dataset drift or corruption
 * must be a loud, itemised failure, not a silently partial artifact.
 *
 * Run only via `npx tsx --env-file=backend/api/.env.local scripts/exercise-import/fetch.ts`
 * from the repo root — never imported by a test, so it is safe to call
 * main() unconditionally at module load. This is what keeps the two-runtime
 * module-system constraint (see README.md "Module System") entirely out of
 * this pipeline: fetch.ts never needs the current-module-directory global
 * or the current-module-URL meta property, since it is only ever executed
 * directly by tsx, never transformed by vitest.
 *
 * This file performs zero Supabase access — fetch is a pure filesystem/
 * network step. No credential of any kind is imported or read here.
 */
import { existsSync, mkdirSync, readdirSync, rmSync } from 'fs';
import { join } from 'path';
import { spawnSync } from 'child_process';
import {
  assertRunFromRepoRoot,
  DATASET_CACHE_DIR,
  DATASET_ROOT,
  DATASET_JSON_PATH,
  DATASET_REPO_URL,
} from './lib/paths';
import { loadDatasetJson, verifyDataset } from './lib/verify';
import { ZodError } from 'zod';

async function main(): Promise<void> {
  console.log('=== Exercise Dataset Fetch ===\n');

  // 1. Must run from the repo root — every path constant is repo-root-relative.
  assertRunFromRepoRoot();

  // 2. Parse --refetch flag.
  const refetch = process.argv.includes('--refetch');

  // 3. Clone-or-reuse.
  if (existsSync(DATASET_ROOT) && !refetch) {
    console.log(`Cached clone found at ${DATASET_ROOT} — reusing it (pass --refetch to force a fresh clone).`);
  } else {
    if (refetch && existsSync(DATASET_CACHE_DIR)) {
      console.log('--refetch passed — removing existing cache before re-cloning...');
      rmSync(DATASET_CACHE_DIR, { recursive: true, force: true });
    }
    mkdirSync(DATASET_CACHE_DIR, { recursive: true });
    console.log(`Cloning ${DATASET_REPO_URL} (depth 1) into ${DATASET_ROOT}...`);
    const cloneResult = spawnSync(
      'git',
      ['clone', '--depth', '1', DATASET_REPO_URL, DATASET_ROOT],
      { stdio: 'inherit' },
    );
    if (cloneResult.error || cloneResult.status !== 0) {
      console.error('MANIFEST VERIFICATION FAILED:\ngit clone failed — see output above.');
      process.exit(1);
    }
  }

  // 4. Record + print the cloned commit SHA in a machine-greppable form.
  const revParseResult = spawnSync('git', ['-C', DATASET_ROOT, 'rev-parse', 'HEAD'], {
    encoding: 'utf-8',
  });
  if (revParseResult.error || revParseResult.status !== 0) {
    console.error('MANIFEST VERIFICATION FAILED:\ncould not read the cloned commit SHA.');
    process.exit(1);
  }
  const datasetCommit = revParseResult.stdout.trim();
  console.log(`dataset_commit=${datasetCommit}`);

  // 5. Parse exercises.json through the zod schema — a ZodError here means
  // upstream schema drift, which must fail loudly (IMPORT-01).
  let recordCount: number;
  try {
    const records = loadDatasetJson(DATASET_JSON_PATH);
    recordCount = records.length;
  } catch (err) {
    if (err instanceof ZodError) {
      console.error('MANIFEST VERIFICATION FAILED (upstream schema drift):');
      console.error(err.message);
      process.exit(1);
    }
    throw err;
  }

  // 6. Verify the manifest-equivalent (exercises.json array vs. images/videos).
  const mismatches = verifyDataset(DATASET_ROOT);
  if (mismatches.length > 0) {
    console.error('MANIFEST VERIFICATION FAILED:');
    for (const mismatch of mismatches) {
      console.error(`  - ${mismatch}`);
    }
    process.exit(1);
  }

  // 7. Success summary.
  const imageCount = readdirSync(join(DATASET_ROOT, 'images')).length;
  const videoCount = readdirSync(join(DATASET_ROOT, 'videos')).length;
  console.log('\n=== Verified ===');
  console.log(`Records: ${recordCount}`);
  console.log(`Images: ${imageCount}`);
  console.log(`Videos: ${videoCount}`);
  console.log(`dataset_commit=${datasetCommit}`);
  console.log('\nNext: npx tsx --env-file=backend/api/.env.local scripts/exercise-import/match.ts');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
