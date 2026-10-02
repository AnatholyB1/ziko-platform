import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  resolveRun,
  defaultMode,
  buildLoadReport,
  buildColumnsSql,
  groupColumns,
  buildSourceUuidOccurrenceSql,
  buildTruncatePrivilegeSql,
  FOREIGN_REFERRERS_SQL,
} from './05-load-data.mjs';

const ZIKO = 'slkobhavpwsubnsmuhya';
const PORTFOLIO = 'ubxllsvanurkwkohzxau';
const SCRATCH = 'rkirvurggtgjlkeuhded';
const U1 = 'ea0f0b65-6681-4780-8ee0-dbf20b95d4d9';
const U2 = '11111111-2222-4333-8444-555555555555';

const base = (over = {}) => ({
  sourceRef: ZIKO,
  projectRef: SCRATCH,
  confirmRef: null,
  remapFile: 'x.json',
  plan: false,
  probe: false,
  apply: false,
  triggerMode: null,
  ...over,
});

test('defaultMode is plan without a mode flag', () => {
  assert.equal(defaultMode(base()), 'plan');
  assert.equal(defaultMode(base({ apply: true })), 'apply');
  assert.equal(defaultMode(base({ probe: true })), 'probe');
});

test('resolveRun accepts a scratch apply and defaults trigger mode to auto', () => {
  const r = resolveRun(base({ apply: true }));
  assert.equal(r.mode, 'apply');
  assert.equal(r.targetRef, SCRATCH);
  assert.equal(r.triggerMode, 'auto');
});

test('resolveRun usage errors exit 2', () => {
  for (const a of [
    base({ projectRef: null }),
    base({ sourceRef: null }),
    base({ plan: true, apply: true }),
    base({ triggerMode: 'bogus' }),
    base({ apply: true, remapFile: null }),
    base({ plan: true, remapFile: null }),
  ]) {
    assert.throws(() => resolveRun(a), (e) => e.exitCode === 2);
  }
});

test('resolveRun safety refusals exit 1', () => {
  for (const a of [
    base({ sourceRef: SCRATCH, apply: true }),
    base({ projectRef: ZIKO, apply: true }),
    base({ projectRef: PORTFOLIO, apply: true }),
    base({ projectRef: PORTFOLIO, probe: true, confirmRef: SCRATCH }),
  ]) {
    assert.throws(() => resolveRun(a), (e) => e.exitCode === 1);
  }
  assert.doesNotThrow(() => resolveRun(base({ projectRef: PORTFOLIO, apply: true, confirmRef: PORTFOLIO })));
});

test('buildLoadReport is PII-safe and masks UUIDs', () => {
  const r = buildLoadReport({
    targetRef: SCRATCH,
    mode: 'apply',
    triggerMode: 'replica',
    tables: [{ table: 'ziko_a', sourceCount: 3, streamedRows: 3, targetCount: 3, rowsTouched: 1, replacements: 2 }],
    sequences: [{ name: 'ziko_s', before: 1, after: 87 }],
    remap: { sourceUuid: U1, targetUuid: U2 },
  });
  assert.equal(r.total_rows, 3);
  assert.equal(r.remap.source, 'ea0f0b65-…');
  assert.ok(!JSON.stringify(r).includes(U1));
});

test('buildLoadReport throws on a full UUID or email', () => {
  const mk = (table) =>
    buildLoadReport({ targetRef: SCRATCH, mode: 'apply', triggerMode: 'replica', tables: [{ table, sourceCount: 1, streamedRows: 1, targetCount: 1 }], sequences: [] });
  assert.throws(() => mk(U1));
  assert.throws(() => mk('a@example.com'));
});

test('SQL builders validate identifiers', () => {
  assert.throws(() => buildColumnsSql(['bad name']));
  assert.throws(() => buildSourceUuidOccurrenceSql(['x'], 'not-a-uuid'));
  assert.throws(() => buildTruncatePrivilegeSql(["a'; drop"]));
  assert.match(buildColumnsSql(['a', 'b']), /attgenerated = ''/);
  assert.match(buildSourceUuidOccurrenceSql(['a'], U1), /FROM public\."a"/);
  assert.ok(!/cascade/i.test(FOREIGN_REFERRERS_SQL));
});

test('groupColumns keeps ordinal order per table', () => {
  const m = groupColumns([
    { tbl: 'a', name: 'id', type: 'uuid' },
    { tbl: 'a', name: 'n', type: 'text' },
    { tbl: 'b', name: 'id', type: 'uuid' },
  ]);
  assert.deepEqual(m.get('a'), [{ name: 'id', type: 'uuid' }, { name: 'n', type: 'text' }]);
});
