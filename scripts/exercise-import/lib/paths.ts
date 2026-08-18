/**
 * Repo-root-relative path constants shared by fetch.ts and match.ts.
 *
 * MODULE SYSTEM CONSTRAINT (see README.md "Module System"): this file must
 * never rely on Node's CommonJS current-module-directory global or the ESM
 * current-module-URL meta property. Root package.json has no `"type"`
 * field, so `tsx` compiles this file as CommonJS while vitest transforms
 * it as ESM — either of those two directory-resolution mechanisms breaks
 * under the other runtime. Every path below is a plain repo-root-relative
 * string; every entrypoint that consumes them must be run from the repo
 * root (enforced by `assertRunFromRepoRoot()`).
 */
import { readFileSync } from 'fs';

export const DATASET_CACHE_DIR = 'scripts/exercise-import/.dataset-cache';
export const DATASET_ROOT = 'scripts/exercise-import/.dataset-cache/exercises-dataset';
export const DATASET_JSON_PATH =
  'scripts/exercise-import/.dataset-cache/exercises-dataset/data/exercises.json';

// D-07: reports live under .planning/workstreams/image-exo/reports/, versioned in git.
export const REPORTS_DIR = '.planning/workstreams/image-exo/reports';
// D-08: fixed filenames, overwritten on every run, never timestamped.
export const REPORT_JSON_PATH = '.planning/workstreams/image-exo/reports/match-report.json';
export const REPORT_MD_PATH = '.planning/workstreams/image-exo/reports/match-report.md';

export const DATASET_REPO_URL = 'https://github.com/hasaneyldrm/exercises-dataset.git';

/**
 * Verifies the current working directory is the repo root by reading
 * `package.json` in the cwd and checking `name === 'ziko-platform'`.
 * Every entrypoint (fetch.ts/match.ts) calls this first, since every path
 * constant above is repo-root-relative.
 */
export function assertRunFromRepoRoot(): void {
  let pkgRaw: string;
  try {
    pkgRaw = readFileSync('package.json', 'utf-8');
  } catch {
    throw new Error(
      'Could not read package.json in the current working directory. ' +
        'This script must be run from the ziko-platform repo root (e.g. ' +
        '`npx tsx --env-file=backend/api/.env.local scripts/exercise-import/fetch.ts`), ' +
        'not from scripts/exercise-import/ or any other subdirectory.',
    );
  }
  const pkg = JSON.parse(pkgRaw);
  if (pkg.name !== 'ziko-platform') {
    throw new Error(
      `Expected to run from the ziko-platform repo root, but found package.json with ` +
        `name "${pkg.name}" instead. Run this script from the repo root, e.g. ` +
        '`npx tsx --env-file=backend/api/.env.local scripts/exercise-import/fetch.ts`.',
    );
  }
}
