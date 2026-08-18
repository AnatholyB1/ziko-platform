// Unit tests for dataset manifest verification (lib/verify.ts).
// Framework: vitest. Every fixture is a small temp tree built with
// fs.mkdtempSync under os.tmpdir() — created and torn down inside each
// test, never touching the real cloned-dataset cache directory used by
// fetch.ts (see lib/paths.ts DATASET_CACHE_DIR).
import { describe, test, expect, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { ZodError } from 'zod';
import { resolveInsideRoot, loadDatasetJson, verifyDataset } from './verify';
import type { DatasetExercise } from './types';

// ─── Fixture helpers ───────────────────────────────────────────────────────

const tempDirs: string[] = [];

function makeTempRoot(): string {
  const dir = mkdtempSync(join(tmpdir(), 'exercise-import-verify-test-'));
  tempDirs.push(dir);
  return dir;
}

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop()!;
    rmSync(dir, { recursive: true, force: true });
  }
});

function makeRecord(overrides: Partial<DatasetExercise> = {}): DatasetExercise {
  const id = overrides.id ?? '0001';
  return {
    id,
    name: 'Push-up',
    category: 'strength',
    body_part: 'chest',
    equipment: 'body weight',
    instructions: { en: 'Do a push-up' },
    instruction_steps: { en: ['Get into plank', 'Lower', 'Push up'] },
    muscle_group: 'pectorals',
    secondary_muscles: ['triceps'],
    target: 'pectorals',
    media_id: id,
    image: `images/${id}.jpg`,
    gif_url: `videos/${id}.gif`,
    attribution: 'Gym visual',
    created_at: '2026-01-01',
    ...overrides,
  };
}

/**
 * Builds a fixture tree: data/exercises.json + images/ + videos/ populated
 * with real (empty) files matching every record's image/gif_url path,
 * unless the caller opts out via `skipMediaFor`.
 */
function buildFixture(
  root: string,
  records: DatasetExercise[],
  opts: { skipMediaFor?: Set<string>; extraImageFile?: string } = {},
): void {
  const dataDir = join(root, 'data');
  const imagesDir = join(root, 'images');
  const videosDir = join(root, 'videos');
  mkdirSync(dataDir, { recursive: true });
  mkdirSync(imagesDir, { recursive: true });
  mkdirSync(videosDir, { recursive: true });

  writeFileSync(join(dataDir, 'exercises.json'), JSON.stringify(records), 'utf-8');

  const skip = opts.skipMediaFor ?? new Set<string>();
  for (const record of records) {
    if (skip.has(record.id)) continue;
    // Only materialize media for records whose path is a plain,
    // non-escaping images/videos path — escape-testing fixtures
    // intentionally leave the file unwritten.
    if (record.image.startsWith('images/') && !record.image.includes('..')) {
      writeFileSync(join(root, record.image), '', 'utf-8');
    }
    if (record.gif_url.startsWith('videos/') && !record.gif_url.includes('..')) {
      writeFileSync(join(root, record.gif_url), '', 'utf-8');
    }
  }

  if (opts.extraImageFile) {
    writeFileSync(join(imagesDir, opts.extraImageFile), '', 'utf-8');
  }
}

// ─── resolveInsideRoot ──────────────────────────────────────────────────────

describe('resolveInsideRoot', () => {
  test('returns the resolved path for a value inside the root', () => {
    const root = makeTempRoot();
    const resolved = resolveInsideRoot(root, 'images/0001.jpg');
    expect(resolved).not.toBeNull();
    expect(resolved).toContain('0001.jpg');
  });

  test('returns null for a path-traversal payload', () => {
    const root = makeTempRoot();
    expect(resolveInsideRoot(root, '../../../etc/passwd')).toBeNull();
  });

  test('returns null for a traversal payload disguised with an images/ prefix and .jpg suffix', () => {
    // This is the case the zod regex alone cannot catch: the string
    // matches ^images/.+\.(jpg|jpeg|png)$ but still escapes the root
    // once resolved — resolveInsideRoot is the defence-in-depth layer.
    const root = makeTempRoot();
    expect(resolveInsideRoot(root, 'images/../../../../etc/passwd.jpg')).toBeNull();
  });
});

// ─── loadDatasetJson ────────────────────────────────────────────────────────

describe('loadDatasetJson', () => {
  test('parses a well-formed exercises.json', () => {
    const root = makeTempRoot();
    const records = [makeRecord()];
    buildFixture(root, records);
    const loaded = loadDatasetJson(join(root, 'data', 'exercises.json'));
    expect(loaded).toHaveLength(1);
    expect(loaded[0].id).toBe('0001');
  });

  test('throws ZodError when a required field is missing', () => {
    const root = makeTempRoot();
    mkdirSync(join(root, 'data'), { recursive: true });
    const badRecord = { ...makeRecord() } as Record<string, unknown>;
    delete badRecord.name; // required field
    writeFileSync(join(root, 'data', 'exercises.json'), JSON.stringify([badRecord]), 'utf-8');
    expect(() => loadDatasetJson(join(root, 'data', 'exercises.json'))).toThrow(ZodError);
  });
});

// ─── verifyDataset ──────────────────────────────────────────────────────────

describe('verifyDataset', () => {
  test('returns an empty array for a well-formed 2-record fixture', () => {
    const root = makeTempRoot();
    const records = [makeRecord({ id: '0001' }), makeRecord({ id: '0002' })];
    buildFixture(root, records);
    const mismatches = verifyDataset(root);
    expect(mismatches).toEqual([]);
    expect(mismatches).toHaveLength(0);
  });

  test('reports a count mismatch naming both the actual file count and the record count', () => {
    const root = makeTempRoot();
    const records = [makeRecord({ id: '0001' }), makeRecord({ id: '0002' })];
    buildFixture(root, records, { extraImageFile: 'extra-stray-file.jpg' });
    const mismatches = verifyDataset(root);
    const imageMismatch = mismatches.find((m) => m.includes('images/'));
    expect(imageMismatch).toBeDefined();
    expect(imageMismatch).toContain('3'); // actual file count (2 real + 1 extra)
    expect(imageMismatch).toContain('2'); // record count
  });

  test('reports a mismatch naming the record id when its image file is missing', () => {
    const root = makeTempRoot();
    const records = [makeRecord({ id: '0001' }), makeRecord({ id: '0002' })];
    buildFixture(root, records, { skipMediaFor: new Set(['0002']) });
    const mismatches = verifyDataset(root);
    const missingMismatch = mismatches.find((m) => m.includes('0002') && m.includes('missing'));
    expect(missingMismatch).toBeDefined();
  });

  test('reports a distinct "escapes" mismatch for a path-traversal-crafted media path', () => {
    const root = makeTempRoot();
    const records = [
      makeRecord({ id: '0001' }),
      makeRecord({ id: '0002', image: 'images/../../../../etc/passwd.jpg' }),
    ];
    buildFixture(root, records);
    const mismatches = verifyDataset(root);
    const escapeMismatch = mismatches.find((m) => m.includes('escapes'));
    expect(escapeMismatch).toBeDefined();
    expect(escapeMismatch).toContain('0002');
  });

  test('reports duplicate dataset ids', () => {
    const root = makeTempRoot();
    const records = [
      makeRecord({ id: '0001' }),
      makeRecord({ id: '0001', name: 'Push-up variant' }),
    ];
    buildFixture(root, records);
    const mismatches = verifyDataset(root);
    const dupeMismatch = mismatches.find((m) => m.toLowerCase().includes('duplicate'));
    expect(dupeMismatch).toBeDefined();
    expect(dupeMismatch).toContain('0001');
  });

  test('reports the structural mismatch when videos/ is missing entirely', () => {
    const root = makeTempRoot();
    const dataDir = join(root, 'data');
    const imagesDir = join(root, 'images');
    mkdirSync(dataDir, { recursive: true });
    mkdirSync(imagesDir, { recursive: true });
    writeFileSync(join(dataDir, 'exercises.json'), JSON.stringify([makeRecord()]), 'utf-8');
    // videos/ intentionally never created
    const mismatches = verifyDataset(root);
    expect(mismatches).toHaveLength(1);
    expect(mismatches[0]).toContain('dataset structure missing');
  });

  test('caps per-record mismatches at 25 plus a "...and N more" line', () => {
    const root = makeTempRoot();
    const records = Array.from({ length: 30 }, (_, i) => {
      const id = String(i + 1).padStart(4, '0');
      return makeRecord({ id, image: `images/${id}-does-not-exist.jpg` });
    });
    buildFixture(root, records, { skipMediaFor: new Set(records.map((r) => r.id)) });
    const mismatches = verifyDataset(root);
    // 30 missing images + 30 missing gifs = 60 per-record mismatches, capped
    const lastLine = mismatches[mismatches.length - 1];
    expect(lastLine).toMatch(/\.\.\.and \d+ more/);
    expect(mismatches.length).toBeLessThan(60);
  });
});
