import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  UsageError,
  resolveAuthRun,
  MATRIX,
  casesFor,
  evaluateMatrix,
  testEmail,
  buildAuthReport,
  writeFixture,
} from './10-storage-auth-tests.mjs';
import { targetBucketId } from './lib-storage.mjs';
import { PROJECTS } from '../auth-merge/lib.mjs';
import { assertReportSafe } from './lib-verify.mjs';
import { mkdtemp, readFile, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

const SOURCE_IDS = [
  'ai-imports', 'avatars', 'coach-exercises', 'coach-kyc', 'coach-logos',
  'coach-videos', 'exercise-media', 'exports', 'profile-photos', 'scan-photos',
];

function exitCodeOf(fn) {
  try {
    fn();
  } catch (e) {
    assert.ok(e instanceof UsageError, `expected UsageError, got ${e}`);
    return e.exitCode;
  }
  return 0;
}

test('resolveAuthRun: project-ref required', () => {
  assert.equal(exitCodeOf(() => resolveAuthRun({ mode: 'smoke' })), 2);
});

test('resolveAuthRun: ziko refused in every mode (exit 1)', () => {
  assert.equal(exitCodeOf(() => resolveAuthRun({ projectRef: PROJECTS.ziko, mode: 'smoke' })), 1);
  assert.equal(exitCodeOf(() => resolveAuthRun({ projectRef: PROJECTS.ziko, mode: 'full' })), 1);
});

test('resolveAuthRun: full on portfolio refused (exit 1) even with confirm-ref', () => {
  assert.equal(
    exitCodeOf(() => resolveAuthRun({ projectRef: PROJECTS.portfolio, mode: 'full', confirmRef: PROJECTS.portfolio })),
    1,
  );
});

test('resolveAuthRun: smoke on portfolio needs --confirm-ref', () => {
  assert.equal(exitCodeOf(() => resolveAuthRun({ projectRef: PROJECTS.portfolio, mode: 'smoke' })), 1);
  assert.equal(exitCodeOf(() => resolveAuthRun({ projectRef: PROJECTS.portfolio, mode: 'smoke', confirmRef: PROJECTS.scratch })), 1);
  const run = resolveAuthRun({ projectRef: PROJECTS.portfolio, mode: 'smoke', confirmRef: PROJECTS.portfolio });
  assert.equal(run.mode, 'smoke');
  assert.equal(run.targetRef, PROJECTS.portfolio);
});

test('resolveAuthRun: mode must be full|smoke (exit 2)', () => {
  assert.equal(exitCodeOf(() => resolveAuthRun({ projectRef: PROJECTS.scratch, mode: 'x' })), 2);
  assert.equal(exitCodeOf(() => resolveAuthRun({ projectRef: PROJECTS.scratch, mode: null })), 2);
});

test('resolveAuthRun: scratch full and smoke are accepted', () => {
  assert.equal(resolveAuthRun({ projectRef: PROJECTS.scratch, mode: 'full' }).mode, 'full');
  assert.equal(resolveAuthRun({ projectRef: PROJECTS.scratch, mode: 'smoke' }).mode, 'smoke');
});

test('MATRIX: every case is well formed', () => {
  assert.ok(MATRIX.length > 30);
  const ids = new Set();
  for (const c of MATRIX) {
    for (const k of ['id', 'surface', 'bucket', 'actor', 'op', 'expect', 'modes']) {
      assert.ok(c[k] !== undefined && c[k] !== null, `${c.id} missing ${k}`);
    }
    assert.ok(!ids.has(c.id), `duplicate id ${c.id}`);
    ids.add(c.id);
    assert.ok(['mobile-profile', 'plugin-nutrition', 'plugin-coach', 'web-coach', 'backend', 'storage-only'].includes(c.surface), c.surface);
    assert.ok(c.modes.length === 1 ? c.modes[0] === 'full' : c.modes.join() === 'full,smoke');
    assert.ok(!c.bucket.startsWith('ziko-'), 'cases reference source bucket ids');
  }
});

test('MATRIX: at least one case per ziko- bucket', () => {
  const targets = new Set(MATRIX.map((c) => targetBucketId(c.bucket)));
  for (const id of SOURCE_IDS) assert.ok(targets.has(targetBucketId(id)), `no case for ${id}`);
  assert.equal(SOURCE_IDS.length, 10);
});

test('casesFor(smoke) contains no write operation', () => {
  const smoke = casesFor('smoke');
  assert.ok(smoke.length > 5);
  for (const c of smoke) assert.ok(!['upload', 'update', 'delete', 'link', 'revoke'].includes(c.op), `${c.id} uses ${c.op}`);
  assert.ok(casesFor('full').length === MATRIX.length);
  assert.throws(() => casesFor('nope'));
});

test('evaluateMatrix: ok only when every non-deferred case matches', () => {
  const cases = [
    { id: 'a', surface: 'storage-only', bucket: 'avatars', actor: 'A', op: 'upload', expect: 'allow', modes: ['full'] },
    { id: 'b', surface: 'storage-only', bucket: 'avatars', actor: 'B', op: 'upload', expect: 'deny', modes: ['full'] },
  ];
  assert.equal(evaluateMatrix([{ id: 'a', status: 'allow' }, { id: 'b', status: 'deny' }], { cases }).ok, true);
  const bad = evaluateMatrix([{ id: 'a', status: 'allow' }, { id: 'b', status: 'allow' }], { cases });
  assert.equal(bad.ok, false);
  assert.equal(bad.failed, 1);
  const missing = evaluateMatrix([{ id: 'a', status: 'allow' }], { cases });
  assert.equal(missing.ok, false);
  assert.equal(missing.missing, 1);
});

test('evaluateMatrix: baseline cases pass on documented quirk only', () => {
  const cases = [{ id: 'q', surface: 'mobile-profile', bucket: 'profile-photos', actor: 'A', op: 'baseline-public-url', expect: 'baseline', modes: ['full'] }];
  assert.equal(evaluateMatrix([{ id: 'q', status: 'baseline' }], { cases }).ok, true);
  assert.equal(evaluateMatrix([{ id: 'q', status: 'allow' }], { cases }).ok, false);
});

test('evaluateMatrix: deferred cases are counted separately, never as pass', () => {
  const cases = [
    { id: 'a', surface: 'storage-only', bucket: 'avatars', actor: 'A', op: 'read', expect: 'allow', modes: ['full'] },
    { id: 'd', surface: 'backend', bucket: 'coach-videos', actor: 'A', op: 'route-call', expect: 'deferred-table-codemod', modes: ['full'] },
  ];
  const r = evaluateMatrix([{ id: 'a', status: 'allow' }, { id: 'd', status: 'deferred-table-codemod' }], { cases });
  assert.equal(r.ok, true);
  assert.equal(r.passed, 1);
  assert.equal(r.deferred, 1);
  // a deferred case that actually passed/failed is not silently counted as pass
  const r2 = evaluateMatrix([{ id: 'a', status: 'allow' }, { id: 'd', status: 'allow' }], { cases });
  assert.equal(r2.passed, 1);
  assert.equal(r2.ok, false);
});

test('testEmail format', () => {
  for (const role of ['a', 'b', 'c', 'd']) {
    assert.match(testEmail('k3x9z1', role), /^ziko-storage-test-[a-z0-9]+-(a|b|c|d)@example\.com$/);
  }
  assert.throws(() => testEmail('k3x9z1', 'e'));
  assert.throws(() => testEmail('BAD ID', 'a'));
});

test('buildAuthReport: PII-safe and per-surface', () => {
  const cases = casesFor('full');
  const results = cases.map((c) => ({ id: c.id, status: c.expect }));
  const ev = evaluateMatrix(results, { cases });
  const report = buildAuthReport({ targetRef: PROJECTS.scratch, mode: 'full', cases, results, evaluation: ev });
  assertReportSafe(report);
  assert.equal(report.passed, true);
  assert.ok(report.perSurface['backend']);
  assert.ok(report.perSurface['mobile-profile']);
  const text = JSON.stringify(report);
  assert.ok(!/@/.test(text));
});

test('buildAuthReport: refuses leaking input', () => {
  const cases = [{ id: 'a', surface: 'storage-only', bucket: 'avatars', actor: 'A', op: 'read', expect: 'allow', modes: ['full'] }];
  const results = [{ id: 'a', status: 'allow', note: 'user someone@example.com' }];
  const ev = evaluateMatrix(results, { cases });
  const report = buildAuthReport({ targetRef: PROJECTS.scratch, mode: 'full', cases, results, evaluation: ev });
  assert.ok(!JSON.stringify(report).includes('@'));
});

test('writeFixture writes JSON to the given path', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'fx-'));
  try {
    const p = path.join(dir, '.tmp-fixture.json');
    await writeFixture(p, { a: 1 });
    assert.deepEqual(JSON.parse(await readFile(p, 'utf8')), { a: 1 });
    assert.ok((await stat(p)).isFile());
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
