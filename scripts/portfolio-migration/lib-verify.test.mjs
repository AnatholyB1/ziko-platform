import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  CHECK_NAMES,
  FK_TO_AUTH_USERS_SQL,
  FK_LIST_SQL,
  RLS_SQL,
  TRIGGER_STATE_SQL,
  AUTH_USERS_TRIGGER_STATE_SQL,
  buildCountsSql,
  buildOrphanSql,
  buildValidateConstraintSql,
  evaluateCounts,
  evaluateRls,
  evaluateTriggers,
  evaluateFks,
  evaluateOrphans,
} from './lib-verify.mjs';

const plan3 = [
  { source: 'habits', target: 'ziko_habits' },
  { source: 'user_profiles', target: 'ziko_user_profiles' },
  { source: 'exercises', target: 'ziko_exercises' },
];

test('CHECK_NAMES lists the eight checks', () => {
  assert.deepEqual(CHECK_NAMES, ['counts', 'rls', 'triggers', 'fk', 'orphans', 'sequence', 'remap', 'tenants']);
});

test('FK_TO_AUTH_USERS_SQL uses relnamespace/relname and not the broken regclass::text predicate', () => {
  assert.ok(FK_TO_AUTH_USERS_SQL.includes("confrelid = 'auth.users'::regclass"));
  assert.ok(FK_TO_AUTH_USERS_SQL.includes("relnamespace = 'public'::regnamespace"));
  assert.ok(FK_TO_AUTH_USERS_SQL.includes("relname LIKE 'ziko\\_%'"));
  assert.ok(!FK_TO_AUTH_USERS_SQL.includes('::regclass::text LIKE'));
});

test('FK_LIST_SQL selects the documented columns and filters ziko_ tables in public', () => {
  for (const c of ['conname', 'child', 'parent_schema', 'parent_table', 'child_cols', 'parent_cols', 'convalidated', 'confmatchtype']) {
    assert.ok(FK_LIST_SQL.includes(c), c);
  }
  assert.ok(FK_LIST_SQL.includes("relnamespace = 'public'::regnamespace"));
  assert.ok(FK_LIST_SQL.includes("relname LIKE 'ziko\\_%'"));
  assert.ok(!FK_LIST_SQL.includes('::regclass::text LIKE'));
});

test('buildCountsSql builds exact counts for source and target', () => {
  const s = buildCountsSql(plan3, 'source');
  assert.ok(s.includes(`'ziko_habits' AS tbl, count(*)::bigint AS n FROM public."habits"`));
  assert.equal((s.match(/count\(\*\)/g) || []).length, 3);
  assert.ok(s.includes('UNION ALL'));
  const t = buildCountsSql(plan3, 'target');
  assert.ok(t.includes(`FROM public."ziko_habits"`));
  assert.ok(!t.includes(`public."habits"`));
  assert.throws(() => buildCountsSql(plan3, 'both'));
  assert.ok(!/n_live_tup/.test(s));
});

test('buildCountsSql emits 99 counts for the real rename map', () => {
  const map = JSON.parse(readFileSync(fileURLToPath(new URL('./rename-map.generated.json', import.meta.url)), 'utf8'));
  const plan = Object.entries(map.tables)
    .map(([source, target]) => ({ source, target }))
    .sort((a, b) => a.target.localeCompare(b.target));
  assert.equal(plan.length, 99);
  assert.equal((buildCountsSql(plan, 'target').match(/count\(\*\)/g) || []).length, 99);
});

test('buildCountsSql rejects bad identifiers', () => {
  assert.throws(() => buildCountsSql([{ source: 'a"; drop', target: 'ziko_a' }], 'source'));
  assert.throws(() => buildCountsSql([{ source: 'a', target: 'notziko' }], 'target'));
});

test('evaluateCounts passes on parity incl. bigint strings', () => {
  const src = [{ tbl: 'ziko_habits', n: '5' }, { tbl: 'ziko_user_profiles', n: 2 }, { tbl: 'ziko_exercises', n: '0' }];
  const tgt = [{ tbl: 'ziko_habits', n: 5 }, { tbl: 'ziko_user_profiles', n: '2' }, { tbl: 'ziko_exercises', n: 0 }];
  const r = evaluateCounts(plan3, src, tgt);
  assert.equal(r.ok, true);
  assert.deepEqual(r.mismatches, []);
  assert.deepEqual(r.missing, []);
});

test('evaluateCounts reports mismatches and missing tables', () => {
  const src = [{ tbl: 'ziko_habits', n: 5 }, { tbl: 'ziko_user_profiles', n: 2 }, { tbl: 'ziko_exercises', n: 1 }];
  const tgt = [{ tbl: 'ziko_habits', n: 4 }, { tbl: 'ziko_user_profiles', n: 2 }];
  const r = evaluateCounts(plan3, src, tgt);
  assert.equal(r.ok, false);
  assert.deepEqual(r.mismatches, [{ tbl: 'ziko_habits', source: '5', target: '4' }]);
  assert.equal(r.missing.length, 1);
  assert.equal(r.missing[0].tbl, 'ziko_exercises');
});

test('RLS_SQL and evaluateRls', () => {
  assert.ok(RLS_SQL.includes('relrowsecurity'));
  assert.ok(RLS_SQL.includes("relkind = 'r'"));
  assert.ok(RLS_SQL.includes("relnamespace = 'public'::regnamespace"));
  const ok = evaluateRls(plan3, plan3.map((p) => ({ relname: p.target, relrowsecurity: true })));
  assert.equal(ok.ok, true);
  assert.match(ok.detail, /3\/3/);
  const off = evaluateRls(plan3, [
    { relname: 'ziko_habits', relrowsecurity: true },
    { relname: 'ziko_user_profiles', relrowsecurity: false },
  ]);
  assert.equal(off.ok, false);
});

test('trigger SQL never prints definitions; evaluateTriggers flags non-O', () => {
  for (const s of [TRIGGER_STATE_SQL, AUTH_USERS_TRIGGER_STATE_SQL]) {
    assert.ok(!s.includes('pg_get_triggerdef'));
    assert.ok(s.includes('tgenabled'));
    assert.ok(s.includes('tgname'));
    assert.ok(s.includes('NOT t.tgisinternal'));
  }
  assert.ok(AUTH_USERS_TRIGGER_STATE_SQL.includes("'auth.users'::regclass"));
  const good = evaluateTriggers([
    { relname: 'ziko_a', tgname: 'x', tgenabled: 'O' },
    { relname: 'users', tgname: 'ziko_on_auth_user_created', tgenabled: 'O' },
  ]);
  assert.equal(good.ok, true);
  assert.match(good.detail, /2/);
  const bad = evaluateTriggers([{ relname: 'ziko_a', tgname: 'x', tgenabled: 'D' }]);
  assert.equal(bad.ok, false);
});

const fk1 = {
  conname: 'ziko_habits_user_id_fkey',
  child: 'ziko_habits',
  child_cols: ['user_id'],
  parent_schema: 'auth',
  parent_table: 'users',
  parent_cols: ['id'],
  convalidated: true,
};
const fk2 = {
  conname: 'ziko_x_multi_fkey',
  child: 'ziko_x',
  child_cols: ['a_id', 'b_id'],
  parent_schema: 'public',
  parent_table: 'ziko_y',
  parent_cols: ['a', 'b'],
  convalidated: true,
};
const fkSelf = {
  conname: 'ziko_c_parent_fkey',
  child: 'ziko_c',
  child_cols: ['parent_id'],
  parent_schema: 'public',
  parent_table: 'ziko_c',
  parent_cols: ['id'],
  convalidated: true,
};

test('buildOrphanSql single column', () => {
  const s = buildOrphanSql(fk1);
  assert.equal(
    s,
    `SELECT 'ziko_habits_user_id_fkey' AS conname, count(*)::bigint AS orphans FROM public."ziko_habits" c WHERE c."user_id" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "auth"."users" p WHERE p."id" = c."user_id")`,
  );
});

test('buildOrphanSql multi-column and self-reference', () => {
  const s = buildOrphanSql(fk2);
  assert.ok(s.includes('c."a_id" IS NOT NULL AND c."b_id" IS NOT NULL'));
  assert.ok(s.includes('p."a" = c."a_id" AND p."b" = c."b_id"'));
  assert.ok(buildOrphanSql(fkSelf).includes('"public"."ziko_c" p'));
});

test('buildOrphanSql validation', () => {
  assert.throws(() => buildOrphanSql({ ...fk1, child: 'habits' }));
  assert.throws(() => buildOrphanSql({ ...fk1, parent_schema: 'storage' }));
  assert.throws(() => buildOrphanSql({ ...fk1, parent_table: 'identities' }));
  assert.throws(() => buildOrphanSql({ ...fk2, parent_table: 'other' }));
  assert.throws(() => buildOrphanSql({ ...fk2, parent_cols: ['a'] }));
  assert.throws(() => buildOrphanSql({ ...fk1, child_cols: ['x"y'] }));
});

test('buildValidateConstraintSql', () => {
  assert.equal(
    buildValidateConstraintSql(fk1),
    'ALTER TABLE public."ziko_habits" VALIDATE CONSTRAINT "ziko_habits_user_id_fkey"',
  );
  assert.throws(() => buildValidateConstraintSql({ ...fk1, child: 'habits' }));
});

test('evaluateFks guards against empty discovery and unvalidated constraints', () => {
  const ok = evaluateFks({ fkRows: [fk1, fk2], authFkRows: [{ child: 'ziko_habits', column: 'user_id' }] });
  assert.equal(ok.ok, true);
  assert.match(ok.detail, /2/);
  assert.match(ok.detail, /1/);
  assert.equal(evaluateFks({ fkRows: [], authFkRows: [{}] }).ok, false);
  assert.equal(evaluateFks({ fkRows: [fk1], authFkRows: [] }).ok, false);
  assert.equal(evaluateFks({ fkRows: [{ ...fk1, convalidated: false }], authFkRows: [{}] }).ok, false);
});

test('evaluateOrphans', () => {
  assert.equal(evaluateOrphans([{ conname: 'a', orphans: '0' }, { conname: 'b', orphans: 0 }]).ok, true);
  const bad = evaluateOrphans([{ conname: 'a', orphans: '3' }, { conname: 'b', orphans: 0 }]);
  assert.equal(bad.ok, false);
  assert.match(bad.detail, /a/);
  assert.match(bad.detail, /3/);
});
