import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { CHECKS, resolveChecks, buildJsonReport, UsageError } from './09-verify-storage.mjs';

const ZIKO = 'slkobhavpwsubnsmuhya';
const PORTFOLIO = 'ubxllsvanurkwkohzxau';
const SCRATCH = 'rkirvurggtgjlkeuhded';

const base = { projectRef: SCRATCH, sourceRef: ZIKO, check: 'all', remapFile: 'r.json', baseline: null };

test('CHECKS lists every check', () => {
  assert.deepEqual(CHECKS, ['buckets', 'policies', 'objects', 'hashes', 'rekey', 'urls', 'tenants']);
});

test('each single check resolves to itself', () => {
  const extra = { sourceRef: ZIKO, remapFile: 'r.json', baseline: 'b.json' };
  for (const check of CHECKS) assert.deepEqual(resolveChecks({ projectRef: SCRATCH, check, ...extra }), [check]);
});

test('unknown check is a usage error', () => {
  assert.throws(() => resolveChecks({ ...base, check: 'bogus' }), UsageError);
});

test('source ref must be ziko for source-based checks and all', () => {
  for (const check of ['buckets', 'policies', 'objects', 'hashes', 'rekey', 'urls', 'all']) {
    assert.throws(() => resolveChecks({ ...base, check, sourceRef: null }), UsageError);
    assert.throws(() => resolveChecks({ ...base, check, sourceRef: SCRATCH }), UsageError);
  }
});

test('objects/hashes/rekey/all require --remap-file', () => {
  for (const check of ['objects', 'hashes', 'rekey', 'all']) {
    assert.throws(() => resolveChecks({ ...base, check, remapFile: null }), UsageError);
  }
  assert.deepEqual(resolveChecks({ ...base, check: 'buckets', remapFile: null }), ['buckets']);
});

test('tenants requires --baseline and no source', () => {
  assert.throws(() => resolveChecks({ projectRef: SCRATCH, check: 'tenants' }), UsageError);
  assert.deepEqual(resolveChecks({ projectRef: SCRATCH, check: 'tenants', baseline: 'b.json' }), ['tenants']);
});

test('all on portfolio requires --baseline and includes tenants', () => {
  assert.throws(() => resolveChecks({ ...base, projectRef: PORTFOLIO }), UsageError);
  const r = resolveChecks({ ...base, projectRef: PORTFOLIO, baseline: 'b.json' });
  assert.equal(r.at(-1), 'tenants');
  assert.equal(r.length, CHECKS.length);
});

test('all on scratch without baseline skips tenants', () => {
  assert.deepEqual(resolveChecks(base), CHECKS.filter((c) => c !== 'tenants'));
});

test('ziko target is refused', () => {
  assert.throws(() => resolveChecks({ ...base, projectRef: ZIKO }), UsageError);
  assert.throws(() => resolveChecks({ projectRef: ZIKO, check: 'tenants', baseline: 'b.json' }), UsageError);
});

test('buildJsonReport: shape, pass flag, warnings, no extra fields', () => {
  const r = buildJsonReport({
    targetRef: SCRATCH,
    sourceRef: ZIKO,
    results: {
      buckets: { ok: true, detail: '3 buckets', warnings: ['w'], secret: 'ignored' },
      urls: { ok: false, detail: 'leftover' },
    },
  });
  assert.equal(r.passed, false);
  assert.deepEqual(Object.keys(r.checks.buckets).sort(), ['detail', 'ok', 'warnings']);
  assert.deepEqual(r.checks.buckets.warnings, ['w']);
  assert.deepEqual(r.checks.urls.warnings, []);
});

test('buildJsonReport refuses emails and full uuids', () => {
  assert.throws(() => buildJsonReport({ targetRef: SCRATCH, sourceRef: ZIKO, results: { x: { ok: true, detail: 'a@b.com' } } }));
  assert.throws(() =>
    buildJsonReport({
      targetRef: SCRATCH,
      sourceRef: ZIKO,
      results: { x: { ok: true, detail: '11111111-2222-3333-4444-555555555555' } },
    }),
  );
});

test('CLI refuses ziko target with exit 2 and no network', () => {
  const script = fileURLToPath(new URL('./09-verify-storage.mjs', import.meta.url));
  const r = spawnSync(process.execPath, [script, '--project-ref', ZIKO, '--check', 'buckets', '--source-ref', ZIKO], {
    encoding: 'utf8',
  });
  assert.equal(r.status, 2);
});
