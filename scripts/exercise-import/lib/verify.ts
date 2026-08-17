/**
 * Pure dataset manifest verification for the exercise-import pipeline.
 *
 * There is no literal manifest/checksums file in `hasaneyldrm/exercises-dataset`
 * (verified live against the GitHub API — only `exercises.json` and
 * `exercises.schema.json` exist under `data/`). This module treats
 * `exercises.json`'s own array as the manifest: its length must equal the
 * file counts in `images/` and `videos/`, and every record's `image`/
 * `gif_url` path must resolve to a real file inside the dataset root.
 *
 * Every path is taken as a function parameter — no reliance on Node's
 * CommonJS current-module-directory global or the ESM current-module-URL
 * meta property (module-system constraint, see README.md "Module
 * System"). This keeps every function here testable against a small
 * temp fixture tree instead of the real cloned dataset.
 */
import { existsSync, readFileSync, readdirSync } from 'fs';
import { join, resolve, sep } from 'path';
import { DatasetExerciseArraySchema, type DatasetExercise } from './types';

const MAX_REPORTED_MISMATCHES = 25;

/**
 * Joins `datasetRoot` and `relativePath`, then verifies the resolved
 * absolute path is still contained within `datasetRoot`. Returns `null`
 * for anything that escapes (e.g. `../../../etc/passwd`).
 *
 * This is defence-in-depth behind the zod path regexes in `lib/types.ts`
 * (threat T-02-01): even if a regex were loosened later, a crafted
 * `image`/`gif_url` value can never cause a read outside the clone. The
 * containment check is trailing-separator-aware (compares against
 * `root + sep`), not a bare `startsWith` on the raw resolved string —
 * a bare `startsWith('/a/b')` would wrongly accept `/a/bc/../b-evil`.
 */
export function resolveInsideRoot(datasetRoot: string, relativePath: string): string | null {
  const resolvedRoot = resolve(datasetRoot);
  const resolvedPath = resolve(datasetRoot, relativePath);
  const rootWithSep = resolvedRoot.endsWith(sep) ? resolvedRoot : resolvedRoot + sep;
  if (resolvedPath === resolvedRoot || resolvedPath.startsWith(rootWithSep)) {
    return resolvedPath;
  }
  return null;
}

/**
 * Reads and parses `exercises.json`, validating it against
 * `DatasetExerciseArraySchema`. Lets a `ZodError` propagate — upstream
 * schema drift must be a loud failure (IMPORT-01), not a silent
 * `undefined`-field bug deep in the matcher.
 */
export function loadDatasetJson(jsonPath: string): DatasetExercise[] {
  const raw = readFileSync(jsonPath, 'utf-8');
  const parsed = JSON.parse(raw);
  return DatasetExerciseArraySchema.parse(parsed);
}

/**
 * Verifies a cloned dataset tree at `datasetRoot` against its own
 * `exercises.json` array (the manifest-equivalent, see module docstring).
 * Returns an array of human-readable mismatch strings — an empty array
 * means the dataset is verified.
 */
export function verifyDataset(datasetRoot: string): string[] {
  const dataJsonPath = join(datasetRoot, 'data', 'exercises.json');
  const imagesDir = join(datasetRoot, 'images');
  const videosDir = join(datasetRoot, 'videos');

  // 1. Structural check first — stop immediately if the dataset shape is
  // fundamentally missing, rather than cascading into confusing errors below.
  if (!existsSync(dataJsonPath) || !existsSync(imagesDir) || !existsSync(videosDir)) {
    return [
      `dataset structure missing: expected data/exercises.json, images/, and videos/ under ${datasetRoot}`,
    ];
  }

  const records = loadDatasetJson(dataJsonPath);

  const mismatches: string[] = [];

  // 2 & 3. File counts vs. record count.
  const imageFiles = readdirSync(imagesDir);
  const videoFiles = readdirSync(videosDir);
  if (imageFiles.length !== records.length) {
    mismatches.push(
      `images/ has ${imageFiles.length} files, exercises.json has ${records.length} records`,
    );
  }
  if (videoFiles.length !== records.length) {
    mismatches.push(
      `videos/ has ${videoFiles.length} files, exercises.json has ${records.length} records`,
    );
  }

  // 4. Per-record media path resolution + existence, with path-escape detection.
  const perRecordMismatches: string[] = [];
  for (const record of records) {
    const resolvedImage = resolveInsideRoot(datasetRoot, record.image);
    if (resolvedImage === null) {
      perRecordMismatches.push(
        `record ${record.id}: image path escapes dataset root: ${record.image}`,
      );
    } else if (!existsSync(resolvedImage)) {
      perRecordMismatches.push(`record ${record.id}: missing image file: ${record.image}`);
    }

    const resolvedGif = resolveInsideRoot(datasetRoot, record.gif_url);
    if (resolvedGif === null) {
      perRecordMismatches.push(
        `record ${record.id}: gif_url path escapes dataset root: ${record.gif_url}`,
      );
    } else if (!existsSync(resolvedGif)) {
      perRecordMismatches.push(`record ${record.id}: missing gif file: ${record.gif_url}`);
    }
  }

  // 5. Duplicate id detection — a duplicate dataset id would silently
  // collapse rows in the matcher's index later.
  const idCounts = new Map<string, number>();
  for (const record of records) {
    idCounts.set(record.id, (idCounts.get(record.id) ?? 0) + 1);
  }
  for (const [id, count] of idCounts) {
    if (count > 1) {
      perRecordMismatches.push(`duplicate dataset id: ${id} appears ${count} times`);
    }
  }

  // Cap the per-record mismatch list so a totally-wrong clone doesn't
  // print one line per dataset record.
  if (perRecordMismatches.length > MAX_REPORTED_MISMATCHES) {
    const shown = perRecordMismatches.slice(0, MAX_REPORTED_MISMATCHES);
    const remaining = perRecordMismatches.length - MAX_REPORTED_MISMATCHES;
    mismatches.push(...shown, `...and ${remaining} more`);
  } else {
    mismatches.push(...perRecordMismatches);
  }

  return mismatches;
}
