import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Readable, Writable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import {
  EXPECTED_TABLE_COUNT,
  ZIKO_TABLE_RE,
  IDENT_RE,
  UUID_RE,
  loadRenameMap,
  buildTablePlan,
  quoteIdent,
  assertZikoTable,
  buildTruncateSql,
  buildCopyToSql,
  buildCopyFromSql,
  buildTriggerToggleSql,
  compareColumnLists,
  parseRemapFile,
  createRemapTransform,
  topoSortTables,
  assertNoForeignReferrers,
  evaluateLoadedTable,
} from './lib-data.mjs';
import { PROJECTS, KNOWN_COLLISION_SOURCE_IDS } from '../auth-merge/lib.mjs';

const SRC = KNOWN_COLLISION_SOURCE_IDS[0];
const TGT = '11111111-2222-4333-8444-555555555555';

async function runTransform(chunks, src = SRC, tgt = TGT) {
  const t = createRemapTransform(src, tgt);
  let out = '';
  await pipeline(
    Readable.from(chunks.map((c) => Buffer.from(c, 'utf8'))),
    t,
    new Writable({
      write(chunk, _e, cb) {
        out += chunk.toString('utf8');
        cb();
      },
    }),
  );
  return { out, stats: t.stats };
}

test('constants', () => {
  assert.equal(EXPECTED_TABLE_COUNT, 99);
  assert.ok(ZIKO_TABLE_RE.test('ziko_a'));
  assert.ok(!ZIKO_TABLE_RE.test('rh_a'));
  assert.ok(IDENT_RE.test('abc_1'));
  assert.ok(UUID_RE.test(SRC.toUpperCase()));
});

test('buildTablePlan real map has 99 pairs', async () => {
  const map = await loadRenameMap();
  const plan = buildTablePlan(map);
  assert.equal(plan.length, 99);
  for (const p of plan) {
    assert.equal(p.target, 'ziko_' + p.source);
    assert.ok(ZIKO_TABLE_RE.test(p.target));
  }
  const targets = plan.map((p) => p.target);
  assert.deepEqual(targets, [...targets].sort());
});

function fakeMap(n, over = {}) {
  const tables = {};
  for (let i = 0; i < n; i++) tables['t' + String(i).padStart(3, '0')] = 'ziko_t' + String(i).padStart(3, '0');
  return { tables: { ...tables, ...over } };
}

test('buildTablePlan rejects drift and bad names', () => {
  assert.equal(buildTablePlan(fakeMap(99)).length, 99);
  assert.throws(() => buildTablePlan(fakeMap(98)), /99/);
  assert.throws(() => buildTablePlan(fakeMap(98, { x: 'rh_users' })), /rh_users|ziko_/);
  assert.throws(() => buildTablePlan(fakeMap(98, { x: 'ziko_X' })));
  assert.throws(() => buildTablePlan(fakeMap(98, { 'a;b': 'ziko_ab' })));
  assert.throws(() => buildTablePlan(fakeMap(98, { x: 'ziko_t000' })), /duplicate/i);
});

test('quoteIdent', () => {
  assert.equal(quoteIdent('ziko_a'), '"ziko_a"');
  assert.throws(() => quoteIdent('a"b'));
  assert.throws(() => quoteIdent('Bad'));
});

test('assertZikoTable', () => {
  for (const bad of ['rh_users', 'gecko_admins', 'users', 'auth.users', 'ziko_']) {
    assert.throws(() => assertZikoTable(bad), undefined, bad);
  }
  assert.doesNotThrow(() => assertZikoTable('ziko_user_profiles'));
});

test('buildTruncateSql', () => {
  assert.equal(buildTruncateSql(['ziko_a', 'ziko_b']), 'TRUNCATE public."ziko_a", public."ziko_b";');
  assert.throws(() => buildTruncateSql([]));
  assert.throws(() => buildTruncateSql(['ziko_a', 'rh_x']));
  assert.throws(() => buildTruncateSql(['ziko_a', 'ziko_a']));
  assert.ok(!/cascade|restart/i.test(buildTruncateSql(['ziko_a'])));
});

test('COPY builders', () => {
  assert.equal(buildCopyToSql('food_database', ['id', 'name']), 'COPY public."food_database" ("id", "name") TO STDOUT');
  assert.equal(
    buildCopyFromSql('ziko_food_database', ['id', 'name']),
    'COPY public."ziko_food_database" ("id", "name") FROM STDIN',
  );
  assert.throws(() => buildCopyFromSql('rh_x', ['id']));
  assert.throws(() => buildCopyFromSql('ziko_a', []));
  assert.throws(() => buildCopyToSql('a', []));
});

test('buildTriggerToggleSql', () => {
  assert.equal(buildTriggerToggleSql('ziko_a', false), 'ALTER TABLE public."ziko_a" DISABLE TRIGGER USER');
  assert.equal(buildTriggerToggleSql('ziko_a', true), 'ALTER TABLE public."ziko_a" ENABLE TRIGGER USER');
  assert.throws(() => buildTriggerToggleSql('rh_a', true));
});

test('compareColumnLists', () => {
  const a = [{ name: 'id', type: 'uuid' }];
  assert.deepEqual(compareColumnLists(a, [{ name: 'id', type: 'uuid' }]), { ok: true, diffs: [] });
  const r1 = compareColumnLists(a, [{ name: 'id2', type: 'uuid' }]);
  assert.equal(r1.ok, false);
  assert.equal(r1.diffs.length, 1);
  const r2 = compareColumnLists(a, [{ name: 'id', type: 'text' }]);
  assert.equal(r2.ok, false);
  const r3 = compareColumnLists(a, [...a, { name: 'x', type: 'int4' }]);
  assert.equal(r3.ok, false);
  assert.equal(r3.diffs.length, 1);
  const two = [{ name: 'a', type: 't' }, { name: 'b', type: 't' }];
  const r4 = compareColumnLists(two, [two[1], two[0]]);
  assert.equal(r4.ok, false);
  assert.equal(r4.diffs.length, 2);
});

const goodRemap = () => ({
  generated_at: 'x',
  source_ref: PROJECTS.ziko,
  target_ref: PROJECTS.portfolio,
  remaps: [{ source_user_id: SRC.toUpperCase(), target_user_id: TGT.toUpperCase() }],
});
const ctx = { projectRef: PROJECTS.portfolio, sourceRef: PROJECTS.ziko };

test('parseRemapFile ok', () => {
  assert.deepEqual(parseRemapFile(goodRemap(), ctx), { sourceUuid: SRC, targetUuid: TGT });
});

test('parseRemapFile rejections never leak target uuid', () => {
  const cases = [
    (o) => (o.target_ref = PROJECTS.scratch),
    (o) => (o.source_ref = PROJECTS.portfolio),
    (o) => o.remaps.push({ ...o.remaps[0] }),
    (o) => (o.remaps = []),
    (o) => (o.remaps[0].source_user_id = '99999999-2222-4333-8444-555555555555'),
    (o) => (o.remaps[0].target_user_id = 'not-a-uuid'),
    (o) => (o.remaps[0].target_user_id = SRC),
  ];
  for (const mutate of cases) {
    const o = goodRemap();
    mutate(o);
    assert.throws(
      () => parseRemapFile(o, ctx),
      (e) => !e.message.toLowerCase().includes(TGT),
    );
  }
});

test('remap transform rewrites variants', async () => {
  const lines = [
    `${SRC}\tfoo`,
    `${SRC.toUpperCase()}\tfoo`,
    `{"user":"${SRC}"}\tx`,
    `path/${SRC}/avatar.jpg\tx`,
    `{${SRC},${SRC}}\tx`,
  ];
  const { out, stats } = await runTransform([lines.join('\n') + '\n']);
  const rows = out.split('\n');
  assert.equal(rows[0], `${TGT}\tfoo`);
  assert.equal(rows[1], `${TGT}\tfoo`);
  assert.equal(rows[2], `{"user":"${TGT}"}\tx`);
  assert.equal(rows[3], `path/${TGT}/avatar.jpg\tx`);
  assert.equal(rows[4], `{${TGT},${TGT}}\tx`);
  assert.deepEqual(stats, { rows: 5, replacements: 6, rowsTouched: 5 });
});

test('remap transform leaves other lines identical and flushes tail', async () => {
  const input = 'a\tb\nc\\tNULL\\N\nlast-no-newline';
  const { out, stats } = await runTransform([input]);
  assert.equal(out, input);
  assert.equal(stats.replacements, 0);
  assert.equal(stats.rows, 2);
});

test('remap transform is chunk-boundary safe at every offset', async () => {
  const input = `pre\t${SRC}\tpost\nother\n${SRC}\téè\n`;
  const whole = (await runTransform([input])).out;
  const buf = Buffer.from(input, 'utf8');
  const start = buf.indexOf(SRC);
  for (let k = 1; k < 36; k++) {
    const t = createRemapTransform(SRC, TGT);
    let out = '';
    await pipeline(
      Readable.from([buf.subarray(0, start + k), buf.subarray(start + k)]),
      t,
      new Writable({
        write(c, _e, cb) {
          out += c.toString('utf8');
          cb();
        },
      }),
    );
    assert.equal(out, whole, 'offset ' + k);
  }
});

test('remap transform keeps multibyte chars split across chunks', async () => {
  const buf = Buffer.from('café\t中\n', 'utf8');
  for (let k = 1; k < buf.length; k++) {
    const t = createRemapTransform(SRC, TGT);
    let out = '';
    await pipeline(
      Readable.from([buf.subarray(0, k), buf.subarray(k)]),
      t,
      new Writable({
        write(c, _e, cb) {
          out += c.toString('utf8');
          cb();
        },
      }),
    );
    assert.equal(out, buf.toString('utf8'));
  }
});

test('topoSortTables', () => {
  const edges = [
    { child: 'ziko_b', parent: 'ziko_a' },
    { child: 'ziko_c', parent: 'ziko_b' },
    { child: 'ziko_c', parent: 'ziko_c' },
    { child: 'ziko_a', parent: 'auth.users' },
  ];
  assert.deepEqual(topoSortTables(['ziko_c', 'ziko_b', 'ziko_a'], edges), ['ziko_a', 'ziko_b', 'ziko_c']);
  assert.throws(
    () =>
      topoSortTables(['ziko_a', 'ziko_b'], [
        { child: 'ziko_a', parent: 'ziko_b' },
        { child: 'ziko_b', parent: 'ziko_a' },
      ]),
    /cycle/i,
  );
});

test('assertNoForeignReferrers', () => {
  assert.doesNotThrow(() => assertNoForeignReferrers([{ referrer: 'ziko_a', referenced: 'ziko_b' }]));
  assert.throws(() => assertNoForeignReferrers([{ referrer: 'rh_x', referenced: 'ziko_b' }]));
});

test('evaluateLoadedTable', () => {
  assert.equal(evaluateLoadedTable({ table: 'ziko_a', sourceCount: 5, streamedRows: 5, targetCount: 5 }).ok, true);
  for (const o of [
    { sourceCount: 6, streamedRows: 5, targetCount: 5 },
    { sourceCount: 5, streamedRows: 4, targetCount: 5 },
    { sourceCount: 5, streamedRows: 5, targetCount: 4 },
  ]) {
    const r = evaluateLoadedTable({ table: 'ziko_a', ...o });
    assert.equal(r.ok, false);
    assert.match(r.reason, /ziko_a/);
    assert.match(r.reason, new RegExp(String(o.sourceCount)));
  }
});

test('buildCopyToSql rejects unsafe source identifier', () => {
  assert.throws(() => buildCopyToSql('a;drop', ['id']));
  assert.throws(() => buildCopyToSql('a', ['I"d']));
});

test('topoSortTables is deterministic for independent tables', () => {
  assert.deepEqual(topoSortTables(['ziko_z', 'ziko_a', 'ziko_m'], []), ['ziko_a', 'ziko_m', 'ziko_z']);
});

test('parseRemapFile rejects non-object input', () => {
  assert.throws(() => parseRemapFile(null, ctx));
});
