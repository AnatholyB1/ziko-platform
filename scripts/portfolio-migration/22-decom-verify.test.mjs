import { test } from 'node:test';
import assert from 'node:assert/strict';
import { maskObjectKey } from './lib-storage.mjs';
import {
  evaluatePkSubset,
  classifyExtras,
  buildPostFlipCountSql,
  evaluateObjectSubset,
  evaluateTenantDelta,
  buildPkListSql,
  PK_COLUMNS_SQL,
  buildRowDigestSql,
  evaluateContentDigest,
  diffColumns,
  buildDecomReport,
  rewriteZikoStorageUrl,
  buildUrlRewrite,
  buildMultisetDigestSql,
  evaluateDigestMultiset,
} from './22-decom-verify.mjs';
import { PROJECTS as REFS } from '../auth-merge/lib.mjs';
import { assertCommittedSafe } from './18-decom-guard.mjs';

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

// ---------------- buildRowDigestSql ----------------

const DIGEST_ARGS = { table: 'ziko_foo', pkCols: ['id'], sharedCols: ['id', 'name', 'updated_at'], flipAt: FLIP, timestampCols: ['updated_at'] };

test('row digest sql: shape, select-only, md5 over shared columns', () => {
  const sql = buildRowDigestSql(DIGEST_ARGS);
  assert.match(sql, /^SELECT /);
  assert.match(sql, /AS pk_key/);
  assert.match(sql, /md5\(/);
  assert.match(sql, /AS digest/);
  assert.match(sql, /AS modified_after_flip/);
  assert.match(sql, /ARRAY\['id', 'name', 'updated_at'\]/);
  assert.match(sql, new RegExp(`'${FLIP}'::timestamptz`));
  assert.doesNotMatch(sql, /\b(insert|update\s+public|delete\s+from|truncate|drop|alter)\b/i);
  assert.doesNotMatch(sql, /replace\(/);
});

test('row digest sql: no timestamp columns yields false, multiple use greatest', () => {
  assert.match(buildRowDigestSql({ ...DIGEST_ARGS, timestampCols: [] }), /false AS modified_after_flip/);
  assert.match(buildRowDigestSql({ ...DIGEST_ARGS, timestampCols: ['created_at', 'updated_at'] }), /greatest\(t\."created_at", t\."updated_at"\)/);
});

test('row digest sql: remap replaces the source uuid on the ziko side only', () => {
  const sql = buildRowDigestSql({ ...DIGEST_ARGS, remap: REMAP });
  assert.ok(sql.includes(`'${U_SRC}'`) && sql.includes(`'${U_TGT}'`));
  assert.match(sql, /replace\(/);
  // lower() on the ziko side only would make every row with uppercase text differ from portfolio
  assert.doesNotMatch(sql, /lower\(/);
});

test('row digest sql: rejects bad identifiers, bad remap and bad flipAt', () => {
  assert.throws(() => buildRowDigestSql({ ...DIGEST_ARGS, table: 'x"; drop' }));
  assert.throws(() => buildRowDigestSql({ ...DIGEST_ARGS, sharedCols: ["a'b"] }));
  assert.throws(() => buildRowDigestSql({ ...DIGEST_ARGS, pkCols: ['i d'] }));
  assert.throws(() => buildRowDigestSql({ ...DIGEST_ARGS, timestampCols: ['x y'] }));
  assert.throws(() => buildRowDigestSql({ ...DIGEST_ARGS, remap: { sourceUuid: "x'; --", targetUuid: U_TGT } }));
  assert.throws(() => buildRowDigestSql({ ...DIGEST_ARGS, flipAt: "now'; --" }));
});

// ---------------- evaluateContentDigest ----------------

const row = (digest, mod = false) => ({ digest, modified_after_flip: mod });

test('content: timestamped table, altered pre-flip row fails', () => {
  const r = evaluateContentDigest({
    table: 't', hasCreatedAt: true, hasUpdatedAt: true, countsEqual: false,
    source: new Map([['1', row('a')], ['2', row('b')]]),
    target: new Map([['1', row('a')], ['2', row('CHANGED')]]),
  });
  assert.equal(r.ok, false);
  assert.match(r.detail, /content_mismatch=1/);
  assert.doesNotMatch(r.detail, /no-updated_at/);
});

test('content: altered post-flip row is skipped and passes', () => {
  const r = evaluateContentDigest({
    table: 't', hasTimestamps: true, hasCreatedAt: true, hasUpdatedAt: true,
    source: { 1: row('a'), 2: row('b') },
    target: { 1: row('a'), 2: row('CHANGED', true) },
  });
  assert.equal(r.ok, true);
  assert.equal(r.skippedPostFlip, 1);
  assert.equal(r.compared, 1);
});

test('content: created_at without updated_at still fails and says no-updated_at', () => {
  const r = evaluateContentDigest({
    table: 't', hasCreatedAt: true, hasUpdatedAt: false,
    source: new Map([['1', row('a')]]), target: new Map([['1', row('x')]]),
  });
  assert.equal(r.ok, false);
  assert.match(r.detail, /no-updated_at/);
});

test('content: no timestamps and equal counts compares every row', () => {
  const src = new Map([['1', row('a')], ['2', row('b')]]);
  assert.equal(evaluateContentDigest({ table: 't', countsEqual: true, source: src, target: new Map(src) }).ok, true);
  const bad = evaluateContentDigest({ table: 't', countsEqual: true, source: src, target: new Map([['1', row('a')], ['2', row('z')]]) });
  assert.equal(bad.ok, false);
});

test('content: no timestamps and unequal counts is not compared and carries a limit', () => {
  const r = evaluateContentDigest({
    table: 't', countsEqual: false,
    source: new Map([['1', row('a')]]), target: new Map([['1', row('different')], ['2', row('b')]]),
  });
  assert.equal(r.ok, true);
  assert.equal(r.notCompared, true);
  assert.equal(r.limit, 'content-not-compared: no timestamp column and counts differ');
});

test('content: detail never carries pk values or digests', () => {
  const r = evaluateContentDigest({
    table: 't', hasUpdatedAt: true,
    source: new Map([['SECRETPK', row('0123456789abcdef0123456789abcdef')]]),
    target: new Map([['SECRETPK', row('fedcba9876543210fedcba9876543210')]]),
  });
  assert.equal(r.ok, false);
  assert.doesNotMatch(r.detail, /SECRETPK|[0-9a-f]{32}/);
});

test('content: remapped ziko row matches when the SQL layer already remapped the pk', () => {
  // The remap happens inside buildRowDigestSql, so the pk_key maps are directly comparable.
  const pk = evaluatePkSubset({ table: 't', sourcePks: [U_SRC], targetPks: [U_TGT], remap: REMAP });
  assert.equal(pk.ok, true);
  const r = evaluateContentDigest({
    table: 't', hasUpdatedAt: true,
    source: new Map([[U_TGT, row('a')]]), target: new Map([[U_TGT, row('a')]]),
  });
  assert.equal(r.ok, true);
});

test('diffColumns lists one-sided columns by name', () => {
  const d = diffColumns(['a', 'b', 'c'], ['b', 'c', 'd']);
  assert.deepEqual(d.shared, ['b', 'c']);
  assert.deepEqual(d.sourceOnly, ['a']);
  assert.deepEqual(d.targetOnly, ['d']);
});

// ---------------- buildDecomReport ----------------

const PASSING = { ok: true };
function tableEntry(name, over = {}) {
  return {
    table: name,
    pk: { ok: true, table: name, extra: 0 },
    extras: { ok: true },
    content: { ok: true, compared: 10, skippedPostFlip: 0, mismatched: 0 },
    ...over,
  };
}
function reportInput(over = {}) {
  return {
    generatedAt: '2026-10-04T12:00:00Z', target: 'portfolio', source: 'ziko', flipAt: FLIP,
    expectedTables: 3,
    tables: [tableEntry('ziko_a'), tableEntry('ziko_b'), tableEntry('ziko_c')],
    storage: { ok: true, buckets: 2, objects: 7, missing: 0, unexplained: 0 },
    integrity: { rls: PASSING, triggers: PASSING, fk: PASSING, orphans: PASSING },
    auth: { users: PASSING, identities: PASSING },
    tenants: evaluateTenantDelta({ data: { problems: [], warnings: [] }, storage: { failures: [], warnings: [] }, auth: { problems: [], warnings: [] } }),
    ...over,
  };
}

test('report: shape and passing verdict', () => {
  const r = buildDecomReport(reportInput());
  assert.equal(r.passed, true);
  assert.deepEqual(Object.keys(r).sort(), ['auth', 'content', 'deviations', 'flip_at', 'generated_at', 'integrity', 'passed', 'source', 'storage', 'target', 'tables', 'tenants'].sort());
  assert.deepEqual(r.tables, { total: 3, pass: 3, explained_extra: 0, failed: [] });
  assert.equal(r.content.compared_rows, 30);
  assert.deepEqual(r.integrity, { rls: 'PASS', triggers: 'PASS', fk: 'PASS', orphans: 'PASS' });
  assert.deepEqual(r.deviations, []);
  assertCommittedSafe(r);
});

test('report: explained extras counted, failed tables listed, overall fails', () => {
  const r = buildDecomReport(reportInput({
    tables: [
      tableEntry('ziko_a', { pk: { ok: true, table: 'ziko_a', extra: 2 }, extras: { ok: true } }),
      tableEntry('ziko_b', { pk: { ok: false, table: 'ziko_b', extra: 0 } }),
      tableEntry('ziko_c', { pk: { ok: true, table: 'ziko_c', extra: 1 }, extras: { ok: false } }),
    ],
  }));
  assert.equal(r.passed, false);
  assert.equal(r.tables.explained_extra, 1);
  assert.deepEqual(r.tables.failed, ['ziko_b', 'ziko_c']);
});

test('report: content mismatches and limits surface; limits become deviations', () => {
  const r = buildDecomReport(reportInput({
    tables: [
      tableEntry('ziko_a', { content: { ok: false, compared: 5, skippedPostFlip: 1, mismatched: 2 } }),
      tableEntry('ziko_b', { content: { ok: true, compared: 0, skippedPostFlip: 0, mismatched: 0, limit: 'content-not-compared: no timestamp column and counts differ', notCompared: true } }),
      tableEntry('ziko_c', { content: { ok: true, compared: 3, skippedPostFlip: 0, mismatched: 0, columnDiff: { sourceOnly: ['legacy'], targetOnly: [] } } }),
    ],
  }));
  assert.deepEqual(r.content.mismatched, ['ziko_a']);
  assert.deepEqual(r.content.not_compared, ['ziko_b']);
  assert.equal(r.content.skipped_post_flip, 1);
  assert.equal(r.deviations.length, 2);
  assert.deepEqual(r.deviations[0], { table: 'ziko_b', limit: 'content-not-compared: no timestamp column and counts differ' });
  assert.match(r.deviations[1].limit, /legacy/);
  assert.equal(r.passed, false);
});

test('report: fail closed on wrong table count, missing sections, or tenant failure', () => {
  assert.equal(buildDecomReport(reportInput({ expectedTables: 99 })).passed, false);
  assert.equal(buildDecomReport(reportInput({ storage: null })).passed, false);
  const noInteg = buildDecomReport(reportInput({ integrity: { rls: PASSING } }));
  assert.equal(noInteg.passed, false);
  assert.equal(noInteg.integrity.fk, 'NOT-RUN');
  const badTenant = evaluateTenantDelta({ data: { problems: ['rh_x: emptied'], warnings: [] }, storage: { failures: [], warnings: [] }, auth: { problems: [], warnings: [] } });
  assert.equal(buildDecomReport(reportInput({ tenants: badTenant })).passed, false);
  assert.equal(buildDecomReport(reportInput({ tenants: null })).tenants.data, 'NOT-RUN');
});

test('report: serialized output has no digest, pk value, uuid or email', () => {
  const digest = '0123456789abcdef0123456789abcdef';
  const content = evaluateContentDigest({
    table: 'ziko_a', hasUpdatedAt: true,
    source: new Map([[U_SRC, row(digest)]]), target: new Map([[U_SRC, row('fedcba9876543210fedcba9876543210')]]),
  });
  const pk = evaluatePkSubset({ table: 'ziko_a', sourcePks: [U_SRC, U_OTHER], targetPks: [U_SRC] });
  const r = buildDecomReport(reportInput({
    expectedTables: 1,
    tables: [{ table: 'ziko_a', pk, extras: classifyExtras({ extraRows: [], flipAt: FLIP }), content }],
  }));
  const text = JSON.stringify(r);
  assert.doesNotMatch(text, /[0-9a-f]{32}/);
  assert.ok(!text.includes(U_SRC) && !text.includes(U_OTHER));
  assert.doesNotMatch(text, /@/);
  assert.equal(r.passed, false);
});

// ---------------- CLI (07-22) ----------------

import { PROJECTS } from '../auth-merge/lib.mjs';
import {
  run,
  buildChildSteps,
  parseTenantOutput,
  assertReadOnlySql,
} from './22-decom-verify.mjs';

const ZIKO = PROJECTS.ziko;
const PORT = PROJECTS.portfolio;
const SCRATCH = PROJECTS.scratch;
const KNOWN_COLLISION = 'ea0f0b65-6681-4780-8ee0-dbf20b95d4d9';
const OLD = '2026-09-01T00:00:00Z';
const NEW = '2026-10-04T00:00:00Z';
const PLAN = [{ source: 'a', target: 'ziko_a' }, { source: 'b', target: 'ziko_b' }];
const MUTATING_RE = /\b(INSERT|UPDATE|DELETE|TRUNCATE|ALTER|DROP)\b/i;

function bytes(...n) {
  return new Uint8Array(n).buffer;
}

function makeEnv({ zikoPkA = ['1', '2'], failSteps = [], objectBytes = [1, 2, 3] } = {}) {
  const sqlCalls = [];
  const runnerCalls = [];
  const written = {};
  const gates = [];
  const out = [];
  const runSqlFake = async (ref, sql) => {
    sqlCalls.push({ ref, sql });
    const ziko = ref === ZIKO;
    if (sql.includes('i.indisprimary')) {
      return ['a', 'b'].map((t) => ({ tbl: ziko ? t : `ziko_${t}`, col: 'id', ord: 1 }));
    }
    if (sql.includes('information_schema.columns')) {
      const isA = /table_name = '(ziko_)?a'/.test(sql);
      return (isA ? ['id', 'name', 'created_at', 'updated_at'] : ['id', 'name']).map((c) => ({ column_name: c }));
    }
    if (sql.includes('AS digest')) {
      const isA = /public\."(ziko_)?a"/.test(sql);
      if (!isA) {
        return [{ pk_key: 'x', digest: 'e', modified_after_flip: false }];
      }
      const rows = zikoPkA.map((k) => ({ pk_key: k, digest: `d${k}`, modified_after_flip: false }));
      return ziko ? rows : [...rows, { pk_key: '3', digest: 'dz', modified_after_flip: true }];
    }
    if (sql.includes('AS pk_key,')) {
      return [{ pk_key: '1', created_at: OLD, updated_at: OLD }, { pk_key: '2', created_at: OLD, updated_at: OLD }, { pk_key: '3', created_at: NEW, updated_at: NEW }];
    }
    if (sql.includes('AS pk_key FROM public."a"') || sql.includes('AS pk_key FROM public."ziko_a"')) {
      return (ziko ? zikoPkA : ['1', '2', '3']).map((k) => ({ pk_key: k }));
    }
    if (sql.includes('AS pk_key FROM')) return [{ pk_key: 'x' }];
    if (sql.includes('FROM storage.buckets')) return [{ id: ziko ? 'avatars' : 'ziko-avatars' }];
    if (sql.includes('FROM storage.objects')) {
      return [{ bucket_id: ziko ? 'avatars' : 'ziko-avatars', name: 'u1/x.png', created_at: OLD, updated_at: OLD }];
    }
    throw new Error(`unexpected sql: ${sql.slice(0, 60)}`);
  };
  const client = { storage: { from: () => ({ download: async () => ({ data: { arrayBuffer: async () => bytes(...objectBytes) }, error: null }) }) } };
  const deps = {
    runSql: runSqlFake,
    runner: (step) => {
      runnerCalls.push(step);
      return { status: failSteps.includes(step.name) ? 1 : 0, stdout: '', stderr: '' };
    },
    loadPlan: async () => PLAN,
    makeStorageClient: async () => client,
    readText: async (p) => {
      if (String(p).includes('HANDOFF')) return JSON.stringify({ phase7_handoff_from_phase6: { backend_flip_at: FLIP } });
      return JSON.stringify({ source_ref: ZIKO, target_ref: PORT, remaps: [{ source_user_id: KNOWN_COLLISION, target_user_id: U_TGT }] });
    },
    writeText: async (p, t) => { written[p] = t; },
    recordGate: (key, opts) => gates.push({ key, opts }),
    now: () => '2026-10-04T12:00:00Z',
    log: (m) => out.push(m),
    errlog: (m) => out.push(m),
    retryOpts: { sleep: async () => {}, delays: [0] },
    expectedTables: 2,
  };
  return { deps, sqlCalls, runnerCalls, written, gates, out };
}

const ARGS = (extra = []) => ['--project-ref', PORT, '--source-ref', ZIKO, '--check', 'all', ...extra];

test('cli: wrong target or source is refused with zero side effects', async () => {
  const cases = [
    ['--project-ref', ZIKO, '--source-ref', ZIKO, '--check', 'all'],
    ['--project-ref', SCRATCH, '--source-ref', ZIKO, '--check', 'all'],
    ['--project-ref', PORT, '--source-ref', PORT, '--check', 'all'],
  ];
  for (const argv of cases) {
    const env = makeEnv();
    assert.equal(await run(argv, env.deps), 1);
    assert.equal(env.sqlCalls.length, 0);
    assert.equal(env.runnerCalls.length, 0);
  }
});

test('cli: bad arguments exit 2 with zero side effects', async () => {
  for (const argv of [['--nope'], ['--project-ref', PORT], ['--project-ref', PORT, '--source-ref', ZIKO, '--check', 'counts'], ['--project-ref', 'bad', '--source-ref', ZIKO, '--check', 'all']]) {
    const env = makeEnv();
    assert.equal(await run(argv, env.deps), 2);
    assert.equal(env.sqlCalls.length, 0);
    assert.equal(env.runnerCalls.length, 0);
  }
});

test('cli: missing flip time exits 1 before any query', async () => {
  const env = makeEnv();
  env.deps.readText = async (p) => (String(p).includes('HANDOFF') ? JSON.stringify({ phase7_handoff_from_phase6: {} }) : '{}');
  assert.equal(await run(ARGS(), env.deps), 1);
  assert.equal(env.sqlCalls.length, 0);
  assert.equal(env.runnerCalls.length, 0);
});

test('buildChildSteps: groups, baselines, and never counts / 13-cutover-delta / 05-load-data', () => {
  const s = buildChildSteps({ projectRef: PORT, sourceRef: ZIKO });
  assert.deepEqual(s.integrity.map((x) => x.name), ['integrity-rls', 'integrity-triggers', 'integrity-fk', 'integrity-orphans']);
  assert.deepEqual(s.auth.map((x) => x.name), ['auth-users', 'auth-identities']);
  assert.equal(s.tenants.length, 3);
  for (const step of [...s.integrity, ...s.auth, ...s.tenants]) {
    const text = [step.script, ...step.argv].join(' ');
    assert.ok(!step.argv.includes('counts'), step.name);
    assert.ok(!text.includes('13-cutover-delta') && !text.includes('05-load-data'), step.name);
  }
  for (const step of s.tenants) assert.ok(step.argv.includes('--baseline'));
});

test('cli: fixture run passes, is read-only, report is safe and the gate is recorded', async () => {
  const env = makeEnv();
  const code = await run(ARGS(['--json-out', 'reports/decom-verify.json', '--record-gate']), env.deps);
  assert.equal(code, 0, env.out.join('\n'));
  assert.ok(env.sqlCalls.length > 0);
  for (const { sql } of env.sqlCalls) {
    assert.match(sql, /^\s*(SELECT|WITH)\b/i);
    assert.doesNotMatch(sql, MUTATING_RE);
  }
  const text = env.written['reports/decom-verify.json'];
  assertCommittedSafe(text);
  const report = JSON.parse(text);
  assert.equal(report.passed, true);
  assert.equal(report.tables.total, 2);
  assert.equal(report.tables.explained_extra, 1);
  assert.equal(report.storage.objects, 1);
  assert.equal(env.runnerCalls.length, 9);
  assert.deepEqual(env.gates, [{ key: 'verify_pass', opts: { evidence: 'reports/decom-verify.json' } }]);
  assert.ok(env.out.includes('VERIFICATION PASSED'));
});

test('cli: a failing child step does not stop the run, report is written, exit 1, no gate', async () => {
  const env = makeEnv({ failSteps: ['integrity-fk'] });
  const code = await run(ARGS(['--json-out', 'r.json', '--record-gate']), env.deps);
  assert.equal(code, 1);
  assert.equal(env.runnerCalls.length, 9);
  assert.equal(JSON.parse(env.written['r.json']).integrity.fk, 'FAIL');
  assert.equal(env.gates.length, 0);
  assert.ok(env.out.includes('VERIFICATION FAILED'));
});

test('cli: a ziko-only PK fails pk-subset but storage and children still run', async () => {
  const env = makeEnv({ zikoPkA: ['1', '2', '9'] });
  const code = await run(ARGS(['--json-out', 'r.json']), env.deps);
  assert.equal(code, 1);
  assert.ok(env.out.some((l) => l.startsWith('[FAIL] pk-subset')));
  assert.ok(env.out.some((l) => l.startsWith('[PASS] storage-subset')));
  assert.equal(env.runnerCalls.length, 9);
  assert.ok(env.out.every((l) => !/\b9\b/.test(l)), 'no PK value in output');
});

test('cli: --tables scopes pk-subset to the named targets, refuses unknown names and --record-gate', async () => {
  const env = makeEnv();
  const code = await run(['--project-ref', PORT, '--source-ref', ZIKO, '--check', 'pk-subset', '--tables', 'ziko_a'], env.deps);
  assert.equal(code, 0, env.out.join('\n'));
  assert.ok(env.out.some((l) => l.startsWith('[PASS] pk-subset: tables=1 ')), env.out.join('\n'));
  assert.ok(env.sqlCalls.every(({ sql }) => !sql.includes('"b"') && !sql.includes('"ziko_b"')));

  const bad = makeEnv();
  assert.equal(await run(['--project-ref', PORT, '--source-ref', ZIKO, '--check', 'pk-subset', '--tables', 'nope'], bad.deps), 1);
  assert.equal(bad.sqlCalls.length, 0);

  const gate = makeEnv();
  assert.equal(await run(ARGS(['--tables', 'ziko_a', '--json-out', 'r.json', '--record-gate']), gate.deps), 2);
  assert.equal(gate.gates.length, 0);
});

function pkCreatedEnv(extraPurchasedAt) {
  const env = makeEnv();
  const base = env.deps.runSql;
  env.deps.loadPlan = async () => [{ source: 'c', target: 'ziko_c' }];
  env.deps.runSql = async (ref, sql) => {
    const ziko = ref === ZIKO;
    if (sql.includes('i.indisprimary')) return [{ tbl: ziko ? 'c' : 'ziko_c', col: 'id', ord: 1 }];
    if (sql.includes('information_schema.columns')) return ['id', 'purchased_at'].map((c) => ({ column_name: c }));
    if (sql.includes('purchased_at') && sql.includes('AS pk_key')) {
      return [{ pk_key: '1', purchased_at: OLD }, { pk_key: '2', purchased_at: extraPurchasedAt }];
    }
    if (sql.includes('AS pk_key FROM public."ziko_c"')) return [{ pk_key: '1' }, { pk_key: '2' }];
    if (sql.includes('AS pk_key FROM public."c"')) return [{ pk_key: '1' }];
    return base(ref, sql);
  };
  return env;
}

test('pk table without created_at/updated_at: extra row explained by purchased_at/installed_at after flip', async () => {
  const env = pkCreatedEnv(NEW);
  const code = await run(['--project-ref', PORT, '--source-ref', ZIKO, '--check', 'pk-subset'], env.deps);
  assert.equal(code, 0, env.out.join('\n'));
  assert.ok(env.out.some((l) => /^\[PASS\] pk-subset: .*tables_with_explained_extras=1/.test(l)));
});

test('pk table without created_at/updated_at: extra row timestamped before flip stays unexplained', async () => {
  const env = pkCreatedEnv(OLD);
  const code = await run(['--project-ref', PORT, '--source-ref', ZIKO, '--check', 'pk-subset'], env.deps);
  assert.equal(code, 1);
  assert.ok(env.out.some((l) => l.startsWith('[FAIL] pk-subset')));
});

test('cli: failed pk-subset entries carry PII-free extras detail', async () => {
  const env = makeEnv({ zikoPkA: ['1', '2', '9'] });
  await run(['--project-ref', PORT, '--source-ref', ZIKO, '--check', 'pk-subset'], env.deps);
  assert.ok(env.out.some((l) => /^\[FAIL\] pk-subset: .*\[ziko_a\]/.test(l)));
});

test('cli: object bytes that differ between sides fail storage-subset', async () => {
  const env = makeEnv();
  let n = 0;
  env.deps.makeStorageClient = async () => {
    const side = n++;
    return { storage: { from: () => ({ download: async () => ({ data: { arrayBuffer: async () => bytes(side + 1) }, error: null }) }) } };
  };
  assert.equal(await run(['--project-ref', PORT, '--source-ref', ZIKO, '--check', 'storage-subset'], env.deps), 1);
  assert.ok(env.out.some((l) => /^\[FAIL\] storage-subset: .*sha_mismatch=1/.test(l)));
});

test('assertReadOnlySql refuses anything but a read statement', () => {
  assert.doesNotThrow(() => assertReadOnlySql('SELECT 1'));
  assert.doesNotThrow(() => assertReadOnlySql('WITH x AS (SELECT 1) SELECT * FROM x'));
  for (const s of ['UPDATE t SET a = 1', 'SELECT 1; DELETE FROM t', 'TRUNCATE t', 'DROP TABLE t', 'ALTER TABLE t ADD c int', 'INSERT INTO t VALUES (1)']) {
    assert.throws(() => assertReadOnlySql(s), /read-only/);
  }
});

test('tenants via child output: sv_ problems informational, rh_ warnings fail', () => {
  const clean = { problems: [], warnings: [] };
  const sv = parseTenantOutput('[FAIL] tenants: sv_orders: emptied\n  [WARN] sv_users: 1 -> 2\n', 1);
  assert.equal(evaluateTenantDelta({ data: sv, storage: clean, auth: clean }).ok, true);
  const rh = parseTenantOutput('[PASS] tenants: ok\n  [WARN] rh_orders: 5 -> 6\n', 0);
  assert.equal(evaluateTenantDelta({ data: rh, storage: clean, auth: clean }).ok, false);
  assert.equal(parseTenantOutput('', 1).problems.length, 1);
});

// ---------------- storage URL normalization (strict) ----------------

const URL_RW = buildUrlRewrite({ buckets: [{ id: 'avatars', target_id: 'ziko-avatars' }, { id: 'profile-photos', target_id: 'ziko-profile-photos' }] });
const zu = (b, rest = 'u1/a.jpg?t=1') => `https://${REFS.ziko}.supabase.co/storage/v1/object/public/${b}/${rest}`;
const pu = (b, rest = 'u1/a.jpg?t=1') => `https://${REFS.portfolio}.supabase.co/storage/v1/object/public/${b}/${rest}`;

test('url rewrite: exact ziko prefix on a _url column is rewritten to portfolio + mapped bucket', () => {
  assert.equal(rewriteZikoStorageUrl('photo_url', zu('profile-photos'), URL_RW), pu('ziko-profile-photos'));
  assert.equal(rewriteZikoStorageUrl('avatar_url', zu('avatars'), URL_RW), pu('ziko-avatars'));
  for (const mode of ['sign', 'authenticated']) {
    const v = `https://${REFS.ziko}.supabase.co/storage/v1/object/${mode}/avatars/x.png`;
    assert.equal(rewriteZikoStorageUrl('avatar_url', v, URL_RW), `https://${REFS.portfolio}.supabase.co/storage/v1/object/${mode}/ziko-avatars/x.png`);
  }
});

test('url rewrite: changed path still differs after normalization', () => {
  const n = rewriteZikoStorageUrl('photo_url', zu('profile-photos', 'u1/OTHER.jpg?t=1'), URL_RW);
  assert.notEqual(n, pu('ziko-profile-photos'));
});

test('url rewrite: unmapped bucket is left untouched (so it fails)', () => {
  const v = zu('mystery');
  assert.equal(rewriteZikoStorageUrl('photo_url', v, URL_RW), v);
  assert.notEqual(rewriteZikoStorageUrl('photo_url', v, URL_RW), pu('ziko-mystery'));
});

test('url rewrite: non-_url column with the same pattern is not rewritten', () => {
  const v = zu('avatars');
  assert.equal(rewriteZikoStorageUrl('avatar_link', v, URL_RW), v);
  assert.equal(rewriteZikoStorageUrl('url_x', v, URL_RW), v);
  assert.equal(rewriteZikoStorageUrl('note', v, URL_RW), v);
});

test('url rewrite: other host or non-string/ prefix-embedded value is not rewritten', () => {
  const other = 'https://evil.example.com/storage/v1/object/public/avatars/u1/a.jpg';
  assert.equal(rewriteZikoStorageUrl('avatar_url', other, URL_RW), other);
  const emb = `x ${zu('avatars')}`;
  assert.equal(rewriteZikoStorageUrl('avatar_url', emb, URL_RW), emb);
  assert.equal(rewriteZikoStorageUrl('avatar_url', null, URL_RW), null);
  assert.equal(rewriteZikoStorageUrl('avatar_url', 5, URL_RW), 5);
});

test('url rewrite: SQL builder mirrors the rule, ziko side only, refs come from PROJECTS', () => {
  const sql = buildRowDigestSql({ ...DIGEST_ARGS, urlRewrite: URL_RW });
  assert.ok(sql.includes("right(e.key, 4) = '_url'"));
  assert.match(sql, /regexp_replace\(/);
  assert.ok(sql.includes(REFS.ziko) && sql.includes(REFS.portfolio));
  assert.ok(sql.includes('ziko-avatars') && sql.includes('ziko-profile-photos'));
  assert.doesNotMatch(buildRowDigestSql(DIGEST_ARGS), /regexp_replace/);
  assert.match(sql, /^SELECT /);
  assert.doesNotMatch(sql, /(insert|delete\s+from|truncate|drop|alter)/i);
});

test('url rewrite: bad bucket map entries are rejected', () => {
  assert.throws(() => buildUrlRewrite({ buckets: [{ id: "a'b", target_id: 'ziko-x' }] }));
  assert.throws(() => buildUrlRewrite({ buckets: [{ id: 'a', target_id: "ziko-x'; --" }] }));
  assert.throws(() => buildUrlRewrite({ buckets: [{ id: 'a', target_id: 'other-a' }] }));
});

// ---------------- no-PK multiset ----------------

test('multiset sql: select-only, grouped digest, same normalization hooks', () => {
  const sql = buildMultisetDigestSql({ table: 'ziko_foo', sharedCols: ['a', 'b'], remap: REMAP, urlRewrite: URL_RW });
  assert.match(sql, /^SELECT /);
  assert.match(sql, /AS digest/);
  assert.match(sql, /count\(\*\)::bigint AS n/);
  assert.match(sql, /GROUP BY 1/);
  assert.match(sql, /regexp_replace\(/);
  assert.throws(() => buildMultisetDigestSql({ table: 'x"y', sharedCols: ['a'] }));
  assert.throws(() => buildMultisetDigestSql({ table: 'foo', sharedCols: [] }));
});

test('multiset: portfolio superset passes and reports the extra count', () => {
  const r = evaluateDigestMultiset({ table: 't', source: new Map([['a', 2], ['b', 1]]), target: new Map([['a', 2], ['b', 1], ['c', 1]]) });
  assert.equal(r.ok, true);
  assert.equal(r.missing, 0);
  assert.equal(r.extra, 1);
  assert.equal(r.shared, 3);
});

test('multiset: a ziko digest absent or under-represented in portfolio fails', () => {
  assert.equal(evaluateDigestMultiset({ table: 't', source: new Map([['a', 1]]), target: new Map() }).ok, false);
  const r = evaluateDigestMultiset({ table: 't', source: new Map([['a', 3]]), target: new Map([['a', 2], ['z', 5]]) });
  assert.equal(r.ok, false);
  assert.equal(r.missing, 1);
  assert.doesNotMatch(r.detail, /a.*z/);
});

test('no-PK extras: post-flip count over purchased_at/installed_at explains extras', () => {
  assert.match(buildPostFlipCountSql('ziko_user_inventory', ['purchased_at'], FLIP), /greatest\("purchased_at"\)/);
  assert.equal(classifyExtras({ extraCount: 1, postFlipCount: 1, flipAt: FLIP, hasCreatedAt: true }).ok, true);
  assert.equal(classifyExtras({ extraCount: 1, postFlipCount: 0, flipAt: FLIP, hasCreatedAt: true }).ok, false);
});
