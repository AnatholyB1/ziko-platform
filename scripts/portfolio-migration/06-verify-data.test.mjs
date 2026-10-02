import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveChecks, buildJsonReport, UsageError } from './06-verify-data.mjs';

const ZIKO = 'slkobhavpwsubnsmuhya';
const PORTFOLIO = 'ubxllsvanurkwkohzxau';
const SCRATCH = 'rkirvurggtgjlkeuhded';

const base = { projectRef: SCRATCH, sourceRef: ZIKO, check: 'all', remapFile: 'r.json', baseline: null };

test('all on scratch without baseline: 7 checks, no tenants', () => {
  assert.deepEqual(resolveChecks(base), ['counts', 'rls', 'triggers', 'fk', 'orphans', 'sequence', 'remap']);
});

test('all with baseline adds tenants', () => {
  assert.equal(resolveChecks({ ...base, baseline: 'b.json' }).at(-1), 'tenants');
});

test('single check returns itself', () => {
  assert.deepEqual(resolveChecks({ projectRef: SCRATCH, check: 'rls' }), ['rls']);
});

test('refuses ziko as target', () => {
  assert.throws(() => resolveChecks({ ...base, projectRef: ZIKO }), UsageError);
});

test('requires ziko source for counts/sequence/remap/all', () => {
  for (const check of ['counts', 'sequence', 'remap', 'all']) {
    assert.throws(() => resolveChecks({ ...base, check, sourceRef: null }), UsageError);
  }
  assert.throws(() => resolveChecks({ ...base, sourceRef: SCRATCH }), UsageError);
});

test('rejects unknown check', () => {
  assert.throws(() => resolveChecks({ ...base, check: 'bogus' }), UsageError);
});

test('remap and all require --remap-file', () => {
  assert.throws(() => resolveChecks({ ...base, remapFile: null }), UsageError);
  assert.throws(() => resolveChecks({ ...base, check: 'remap', remapFile: null }), UsageError);
});

test('tenants requires --baseline', () => {
  assert.throws(() => resolveChecks({ projectRef: SCRATCH, check: 'tenants' }), UsageError);
});

test('all on portfolio requires --baseline', () => {
  assert.throws(() => resolveChecks({ ...base, projectRef: PORTFOLIO }), UsageError);
  assert.ok(resolveChecks({ ...base, projectRef: PORTFOLIO, baseline: 'b.json' }).includes('tenants'));
});

test('buildJsonReport shape and pass flag', () => {
  const r = buildJsonReport({
    targetRef: SCRATCH,
    sourceRef: ZIKO,
    results: { rls: { ok: true, detail: 'x', data: { n: 1 } }, fk: { ok: false, detail: 'y' } },
  });
  assert.equal(r.passed, false);
  assert.equal(r.target_ref, SCRATCH);
  assert.equal(r.checks.rls.ok, true);
  assert.equal(r.checks.fk.data, null);
  assert.ok(r.generated_at);
});

test('buildJsonReport rejects emails and full UUIDs', () => {
  assert.throws(() =>
    buildJsonReport({ targetRef: SCRATCH, results: { a: { ok: true, detail: 'a@b.com' } } }));
  assert.throws(() =>
    buildJsonReport({
      targetRef: SCRATCH,
      results: { a: { ok: true, detail: '11111111-2222-3333-4444-555555555555' } },
    }));
});
