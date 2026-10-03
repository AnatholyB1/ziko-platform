import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveRun, decideObject, uploadStrategy, checkGlobalLimit, buildCopyReport } from './08-copy-storage.mjs';
import { findDeleteCalls } from './lib-storage.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const SCRIPT = join(here, '08-copy-storage.mjs');
const ZIKO = 'slkobhavpwsubnsmuhya';
const PORTFOLIO = 'ubxllsvanurkwkohzxau';
const SCRATCH = 'rkirvurggtgjlkeuhded';

const base = (over = {}) => ({
  sourceRef: ZIKO,
  projectRef: SCRATCH,
  confirmRef: null,
  remapFile: 'x.json',
  plan: false,
  apply: false,
  concurrency: null,
  ...over,
});

function code(fn) {
  try {
    fn();
  } catch (e) {
    return e.exitCode;
  }
  return 0;
}

test('resolveRun defaults to plan with concurrency 4', () => {
  const r = resolveRun(base());
  assert.equal(r.mode, 'plan');
  assert.equal(r.concurrency, 4);
  assert.equal(r.targetRef, SCRATCH);
});

test('resolveRun usage errors exit 2', () => {
  assert.equal(code(() => resolveRun(base({ plan: true, apply: true }))), 2);
  assert.equal(code(() => resolveRun(base({ projectRef: null }))), 2);
  assert.equal(code(() => resolveRun(base({ sourceRef: null }))), 2);
  assert.equal(code(() => resolveRun(base({ remapFile: null }))), 2);
  assert.equal(code(() => resolveRun(base({ concurrency: '0' }))), 2);
  assert.equal(code(() => resolveRun(base({ concurrency: '9' }))), 2);
  assert.equal(code(() => resolveRun(base({ concurrency: 'abc' }))), 2);
});

test('resolveRun safety refusals exit 1', () => {
  assert.equal(code(() => resolveRun(base({ sourceRef: SCRATCH }))), 1);
  assert.equal(code(() => resolveRun(base({ projectRef: ZIKO }))), 1);
  assert.equal(code(() => resolveRun(base({ projectRef: ZIKO, apply: true }))), 1);
  assert.equal(code(() => resolveRun(base({ projectRef: PORTFOLIO, apply: true }))), 1);
});

test('resolveRun apply on portfolio needs confirm-ref; scratch does not', () => {
  assert.equal(resolveRun(base({ projectRef: PORTFOLIO, apply: true, confirmRef: PORTFOLIO })).mode, 'apply');
  assert.equal(resolveRun(base({ apply: true })).mode, 'apply');
  assert.equal(resolveRun(base({ concurrency: '8' })).concurrency, 8);
});

test('decideObject', () => {
  const src = { size: 10, sha: 'a' };
  assert.equal(decideObject({ src, dst: null }), 'copy');
  assert.equal(decideObject({ src, dst: { size: 11 } }), 'copy');
  assert.equal(decideObject({ src, dst: { size: 10, sha: 'b' } }), 'copy');
  assert.equal(decideObject({ src, dst: { size: 10 } }), 'copy');
  assert.equal(decideObject({ src, dst: { size: 10, sha: 'a' } }), 'skip');
});

test('uploadStrategy splits max-age from raw cache-control', () => {
  assert.deepEqual(uploadStrategy('max-age=3600'), { kind: 'sdk', cacheControl: '3600' });
  assert.deepEqual(uploadStrategy('no-cache'), { kind: 'raw', header: 'no-cache' });
  assert.deepEqual(uploadStrategy(null), { kind: 'sdk', cacheControl: '3600' });
});

test('checkGlobalLimit', () => {
  const rows = [{ id: 'a', file_size_limit: 5000 }, { id: 'b', file_size_limit: null }];
  assert.equal(checkGlobalLimit({ globalLimit: 10000, bucketRows: rows, maxObjectSize: 4000 }).status, 'ok');
  assert.equal(checkGlobalLimit({ globalLimit: 4000, bucketRows: rows, maxObjectSize: 100 }).status, 'fail');
  assert.equal(checkGlobalLimit({ globalLimit: 10000, bucketRows: rows, maxObjectSize: 20000 }).status, 'fail');
  assert.equal(checkGlobalLimit({ globalLimit: null, bucketRows: rows, maxObjectSize: 1 }).status, 'unknown');
  assert.equal(checkGlobalLimit({ globalLimit: undefined, bucketRows: rows, maxObjectSize: 1 }).status, 'unknown');
});

test('buildCopyReport is counts only and passes assertReportSafe', () => {
  const r = buildCopyReport({
    targetRef: SCRATCH,
    mode: 'apply',
    buckets: ['avatars', 'scan-photos'],
    perBucket: {
      avatars: { objects: 3, bytes: 30, copied: 2, changed: 1, skipped: 1, rekeyed: 1, failed: 0 },
      'scan-photos': { objects: 1, bytes: 5, copied: 1, changed: 0, skipped: 0, rekeyed: 0, failed: 0 },
    },
    destOnly: 2,
    cacheControlRaw: 31,
  });
  assert.equal(r.buckets.length, 2);
  assert.equal(r.buckets[0].target, 'ziko-avatars');
  assert.equal(r.buckets[0].copied, 2);
  assert.equal(r.dest_only, 2);
  assert.equal(r.total_failed, 0);
  assert.equal(r.total_objects, 4);
});

test('static guard: script has no delete path and no key material handling', () => {
  const text = readFileSync(SCRIPT, 'utf8');
  assert.deepEqual(findDeleteCalls(text), []);
  assert.ok(!/SUPABASE_SERVICE_ROLE_KEY/.test(text));
  assert.ok(!/writeFile\([^)]*(secret|serviceKey|apiKey)/i.test(text));
});

test('CLI --help exits 0', () => {
  const r = spawnSync(process.execPath, [SCRIPT, '--help'], { encoding: 'utf8' });
  assert.equal(r.status, 0);
  assert.match(r.stdout, /--apply/);
});

test('CLI --apply against portfolio without confirm exits 1 before any network', () => {
  const r = spawnSync(
    process.execPath,
    [SCRIPT, '--source-ref', ZIKO, '--project-ref', PORTFOLIO, '--remap-file', 'x.json', '--apply'],
    { encoding: 'utf8', env: { ...process.env, SUPABASE_ACCESS_TOKEN: '' } }
  );
  assert.equal(r.status, 1);
});

test('CLI refuses ziko target', () => {
  const r = spawnSync(
    process.execPath,
    [SCRIPT, '--source-ref', ZIKO, '--project-ref', ZIKO, '--remap-file', 'x.json', '--apply'],
    { encoding: 'utf8' }
  );
  assert.equal(r.status, 1);
});
