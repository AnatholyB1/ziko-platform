import { test } from 'node:test';
import assert from 'node:assert/strict';
import { maskObjectKey } from './lib-storage.mjs';
import {
  evaluatePkSubset,
  classifyExtras,
  evaluateObjectSubset,
  evaluateTenantDelta,
  buildPkListSql,
  PK_COLUMNS_SQL,
} from './22-decom-verify.mjs';

const FLIP = '2026-10-03T14:29:36Z';
const U_SRC = '00000000-0000-0000-0000-00000000000a';
const U_TGT = '00000000-0000-0000-0000-00000000000b';
const U_OTHER = '00000000-0000-0000-0000-00000000000c';
const REMAP = { sourceUuid: U_SRC, targetUuid: U_TGT };

// ---------------- evaluatePkSubset ----------------

test('pk subset: portfolio superset passes and reports extras', () => {
  const r = evaluatePkSubset({ table: 't', sourcePks: ['1', '2'], targetPks: ['1', '2', '3'] });
  assert.equal(r.ok, true);
  assert.equal(r.extra, 1);
  assert.equal(r.shared, 2);
  assert.deepEqual(r.extraKeys, ['3']);
});

test('pk subset: a ziko-only PK fails and detail has no PK value', () => {
  const r = evaluatePkSubset({ table: 't', sourcePks: ['111', '222'], targetPks: ['111'] });
  assert.equal(r.ok, false);
  assert.equal(r.missing, 1);
  assert.match(r.detail, /missing=1/);
  assert.doesNotMatch(r.detail, /222/);
});

test('pk subset: collision uuid is remapped before comparison', () => {
  const r = evaluatePkSubset({ table: 't', sourcePks: [U_SRC, U_OTHER], targetPks: [U_TGT, U_OTHER], remap: REMAP });
  assert.equal(r.ok, true);
  assert.equal(r.extra, 0);
  const noRemap = evaluatePkSubset({ table: 't', sourcePks: [U_SRC], targetPks: [U_TGT] });
  assert.equal(noRemap.ok, false);
});

test('pk subset: composite keys and uuid inside composite are remapped', () => {
  const sep = '\u001f';
  const r = evaluatePkSubset({ table: 't', sourcePks: [`${U_SRC}${sep}5`], targetPks: [`${U_TGT}${sep}5`], remap: REMAP });
  assert.equal(r.ok, true);
});

test('pk subset: no-PK table count fallback', () => {
  assert.equal(evaluatePkSubset({ table: 't', sourcePks: null, targetPks: null, counts: { source: 5, target: 4 } }).ok, false);
  const r = evaluatePkSubset({ table: 't', sourcePks: null, targetPks: null, counts: { source: 5, target: 7 } });
  assert.equal(r.ok, true);
  assert.equal(r.extra, 2);
  assert.equal(evaluatePkSubset({ table: 't', sourcePks: null, targetPks: null }).ok, false);
});

// ---------------- classifyExtras ----------------

test('extras: all post-flip created_at or updated_at is explained', () => {
  const r = classifyExtras({
    extraRows: [{ created_at: '2026-10-03T15:00:00Z', updated_at: null }, { created_at: '2026-01-01T00:00:00Z', updated_at: '2026-10-04T00:00:00Z' }],
    flipAt: FLIP, hasCreatedAt: true, hasUpdatedAt: true,
  });
  assert.equal(r.ok, true);
  assert.equal(r.verdict, 'explained');
});

test('extras: one pre-flip extra is unexplained', () => {
  const r = classifyExtras({
    extraRows: [{ created_at: '2026-10-03T15:00:00Z' }, { created_at: '2026-09-01T00:00:00Z' }],
    flipAt: FLIP, hasCreatedAt: true, hasUpdatedAt: false,
  });
  assert.equal(r.ok, false);
  assert.equal(r.verdict, 'unexplained-needs-review');
  assert.equal(r.unexplained, 1);
});

test('extras: strictly after flip (equal timestamp is not explained)', () => {
  const r = classifyExtras({ extraRows: [{ created_at: FLIP }], flipAt: FLIP, hasCreatedAt: true });
  assert.equal(r.ok, false);
});

test('extras: table without timestamp columns fails closed when extras exist', () => {
  const r = classifyExtras({ extraRows: [{}], flipAt: FLIP, hasCreatedAt: false, hasUpdatedAt: false });
  assert.equal(r.ok, false);
  assert.equal(r.verdict, 'unexplained-needs-review');
  assert.equal(classifyExtras({ extraRows: [], flipAt: FLIP }).ok, true);
});

test('extras: count-based form for no-PK tables', () => {
  assert.equal(classifyExtras({ extraCount: 3, postFlipCount: 3, flipAt: FLIP, hasCreatedAt: true }).ok, true);
  assert.equal(classifyExtras({ extraCount: 3, postFlipCount: 2, flipAt: FLIP, hasCreatedAt: true }).ok, false);
});

// ---------------- evaluateObjectSubset ----------------

const sha = (c) => c.repeat(64);
const srcObj = (name, c = 'a') => ({ bucket_id: 'avatars', name, sha256: sha(c) });
const tgtObj = (name, c = 'a', extra = {}) => ({ bucket_id: 'ziko-avatars', name, sha256: sha(c), ...extra });

test('objects: subset with identical hashes passes', () => {
  const r = evaluateObjectSubset({ source: [srcObj('x/1.png')], target: [tgtObj('x/1.png')], flipAt: FLIP });
  assert.equal(r.ok, true);
  assert.equal(r.objects, 1);
  assert.equal(r.buckets, 1);
});

test('objects: missing object fails', () => {
  const r = evaluateObjectSubset({ source: [srcObj('x/1.png'), srcObj('x/2.png')], target: [tgtObj('x/1.png')], flipAt: FLIP });
  assert.equal(r.ok, false);
  assert.equal(r.missing, 1);
});

test('objects: different sha256 fails', () => {
  const r = evaluateObjectSubset({ source: [srcObj('x/1.png', 'a')], target: [tgtObj('x/1.png', 'b')], flipAt: FLIP });
  assert.equal(r.ok, false);
  assert.equal(r.shaMismatch, 1);
});

test('objects: collision uuid first segment is re-keyed', () => {
  const r = evaluateObjectSubset({ source: [srcObj(`${U_SRC}/a.png`)], target: [tgtObj(`${U_TGT}/a.png`)], remap: REMAP, flipAt: FLIP });
  assert.equal(r.ok, true);
});

test('objects: destination-only explained by post-flip or allowlist, else unexplained', () => {
  const post = evaluateObjectSubset({ source: [], target: [tgtObj('new.png', 'c', { created_at: '2026-10-04T00:00:00Z' })], flipAt: FLIP });
  assert.equal(post.ok, true);
  assert.equal(post.explained, 1);

  const orphan = tgtObj('orphan.png', 'd', { created_at: '2026-01-01T00:00:00Z' });
  const allowed = evaluateObjectSubset({ source: [], target: [orphan], flipAt: FLIP, allowlist: [maskObjectKey('ziko-avatars', 'orphan.png')] });
  assert.equal(allowed.ok, true);

  const bad = evaluateObjectSubset({ source: [], target: [orphan], flipAt: FLIP });
  assert.equal(bad.ok, false);
  assert.equal(bad.unexplained, 1);
  assert.doesNotMatch(bad.detail, /orphan\.png/);
  assert.equal(bad.unexplainedKeys[0], maskObjectKey('ziko-avatars', 'orphan.png'));
});

test('objects: non-ziko buckets in destination are ignored', () => {
  const r = evaluateObjectSubset({ source: [], target: [{ bucket_id: 'rh-files', name: 'a', sha256: sha('e') }], flipAt: FLIP });
  assert.equal(r.ok, true);
});

// ---------------- evaluateTenantDelta ----------------

const clean = { problems: [], warnings: [] };

test('tenants: unchanged passes', () => {
  assert.equal(evaluateTenantDelta({ data: clean, storage: { failures: [], warnings: [] }, auth: clean }).ok, true);
});

test('tenants: rh_ regression fails', () => {
  const r = evaluateTenantDelta({ data: { problems: ['rh_clients: emptied'], warnings: [] }, storage: clean, auth: clean });
  assert.equal(r.ok, false);
  assert.equal(r.perSide.data, 'FAIL');
});

test('tenants: rh_/gecko_ count change (warning form) fails', () => {
  assert.equal(evaluateTenantDelta({ data: { problems: [], warnings: ['rh_clients: 5 -> 6'] }, storage: clean, auth: clean }).ok, false);
  assert.equal(evaluateTenantDelta({ data: { problems: [], warnings: ['gecko_orders: 2 -> 1'] }, storage: clean, auth: clean }).ok, false);
});

test('tenants: sv_ drift is informational only', () => {
  const r = evaluateTenantDelta({
    data: { problems: [], warnings: ['sv_things: 10 -> 14'] },
    storage: { failures: [], warnings: ['bucket sv-media: object count 3 -> 5'] },
    auth: clean,
  });
  assert.equal(r.ok, true);
  assert.equal(r.informational.length, 2);
});

test('tenants: unknown tenant problem fails, missing side fails closed', () => {
  assert.equal(evaluateTenantDelta({ data: { problems: ['other_tbl: missing'], warnings: [] }, storage: clean, auth: clean }).ok, false);
  assert.equal(evaluateTenantDelta({ data: clean, storage: clean }).ok, false);
});

// ---------------- SQL builders ----------------

test('buildPkListSql: select-only, casts, order, ident checks', () => {
  const sql = buildPkListSql('ziko_foo', ['a', 'b']);
  assert.match(sql, /^SELECT concat_ws\(chr\(31\), "a"::text, "b"::text\) AS pk_key FROM public\."ziko_foo" ORDER BY 1$/);
  assert.throws(() => buildPkListSql('foo; drop table x', ['a']));
  assert.throws(() => buildPkListSql('foo', ['a"b']));
  assert.throws(() => buildPkListSql('foo', []));
});

test('PK_COLUMNS_SQL is a read-only catalog query', () => {
  assert.match(PK_COLUMNS_SQL, /indisprimary/);
  assert.doesNotMatch(PK_COLUMNS_SQL, /\b(insert|update|delete|truncate|drop|alter)\b/i);
});
