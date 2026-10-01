import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { buildImportSql, mergeRemaps, TOKEN_COLUMNS } from './02-import-auth.mjs';

const HASH = '$2a$10$' + 'x'.repeat(53);
const userCols = ['id', 'email', 'encrypted_password', 'instance_id', 'raw_user_meta_data'];
const identityCols = ['id', 'provider_id', 'user_id', 'identity_data', 'provider'];

function fixture(n = 3) {
  const users = [];
  const identities = [];
  for (let i = 0; i < n; i++) {
    const id = randomUUID();
    users.push({ id, email: `u${i}@example.invalid`, encrypted_password: HASH, instance_id: null, raw_user_meta_data: {} });
    identities.push({ id: randomUUID(), provider_id: id, user_id: id, identity_data: { sub: id }, provider: 'email' });
  }
  return { users, identities };
}

function build(extra = {}) {
  const { users, identities } = fixture();
  const collision = { sourceId: users[0].id, targetId: randomUUID() };
  return {
    users,
    identities,
    collision,
    sql: buildImportSql({
      userCols,
      identityCols,
      users,
      identities,
      collisions: [collision],
      mode: 'apply',
      expectedPresent: 2,
      ...extra,
    }),
  };
}

const count = (s, re) => (s.match(re) ?? []).length;

test('structure: BEGIN first, COMMIT then summary, single user INSERT with conflict target', () => {
  const { sql } = build();
  assert.ok(sql.startsWith('BEGIN;'));
  assert.ok(sql.indexOf('COMMIT;') < sql.lastIndexOf('SELECT'));
  assert.equal(count(sql, /^INSERT INTO auth\.users/gm), 1);
  assert.equal(count(sql, /^INSERT INTO auth\.identities/gm), 1);
  assert.equal(count(sql, /ON CONFLICT \(id\) DO NOTHING/g) >= 2, true);
  assert.ok(sql.includes('jsonb_populate_recordset'));
});

test('column lists equal the provided lists exactly', () => {
  const { sql } = build();
  const m = sql.match(/^INSERT INTO auth\.users \(([^)]*)\)/m)[1];
  assert.equal(m, userCols.map((c) => `"${c}"`).join(', '));
  const mi = sql.match(/^INSERT INTO auth\.identities \(([^)]*)\)/m)[1];
  assert.equal(mi, identityCols.map((c) => `"${c}"`).join(', '));
  assert.ok(!sql.includes('confirmed_at'));
});

test('bulk inserts exclude collision source ids', () => {
  const { sql, collision } = build();
  assert.ok(sql.includes(`s.id <> ALL(ARRAY['${collision.sourceId}']::uuid[])`));
  assert.ok(sql.includes(`s.user_id <> ALL(ARRAY['${collision.sourceId}']::uuid[])`));
});

test('collision: guarded NULL-password fill and re-pointed identity', () => {
  const { sql, collision } = build();
  assert.ok(sql.includes(`WHERE id = '${collision.targetId}' AND encrypted_password IS NULL`));
  assert.ok(sql.includes(`'${collision.targetId}'::uuid`));
  assert.ok(sql.includes(`to_jsonb('${collision.targetId}'::text)`));
  assert.ok(sql.includes('NOT EXISTS'));
  assert.ok(sql.includes("x.provider = 'email'"));
});

test('instance_id fill only when flag set; summary names instance_id_filled', () => {
  const off = build().sql;
  const on = build({ fillNullInstanceId: true }).sql;
  assert.ok(!off.includes('SET instance_id'));
  assert.ok(on.includes("SET instance_id = '00000000-0000-0000-0000-000000000000'"));
  assert.ok(on.includes('AND instance_id IS NULL'));
  assert.ok(off.includes('AS instance_id_filled'));
  assert.ok(on.includes('AS instance_id_filled'));
});

test('default: the only SET encrypted_password is the collision IS NULL fill', () => {
  const { sql } = build();
  assert.equal(count(sql, /SET encrypted_password/g), 1);
  assert.ok(sql.includes('AND encrypted_password IS NULL'));
  const empty = build({ passwordUpdates: [] }).sql;
  assert.equal(count(empty, /SET encrypted_password/g), 1);
  assert.ok(sql.includes('AS passwords_updated'));
});

test('passwordUpdates: digest guard, IS DISTINCT FROM guard, count assertion', () => {
  const f = fixture();
  const collision = { sourceId: randomUUID(), targetId: randomUUID() };
  f.users.push({ id: collision.sourceId, email: 'c@example.invalid', encrypted_password: HASH });
  const digest = 'a'.repeat(32);
  const sql = buildImportSql({
    ...f,
    userCols,
    identityCols,
    collisions: [collision],
    mode: 'apply',
    expectedPresent: 3,
    passwordUpdates: [
      { id: f.users[0].id, expectedTargetDigest: digest },
      { id: f.users[1].id, expectedTargetDigest: digest },
    ],
  });
  assert.equal(count(sql, /SET encrypted_password/g), 3);
  assert.equal(count(sql, new RegExp(`md5\\(coalesce\\(encrypted_password, ''\\)\\) = '${digest}'`, 'g')), 2);
  assert.equal(count(sql, /encrypted_password IS DISTINCT FROM/g), 2);
  assert.ok(sql.includes('password update count mismatch'));
  assert.ok(sql.includes('<> 2 THEN RAISE EXCEPTION'));
  assert.ok(!sql.slice(sql.indexOf('INSERT INTO auth.users')).includes(HASH), 'hash only appears inside the JSON payload');
});

test('passwordUpdates rejects collision ids, unknown ids and bad digests', () => {
  const { users, identities, collision } = build();
  const base = { userCols, identityCols, users, identities, collisions: [collision], mode: 'apply', expectedPresent: 2 };
  const d = 'b'.repeat(32);
  assert.throws(() => buildImportSql({ ...base, passwordUpdates: [{ id: collision.sourceId, expectedTargetDigest: d }] }), /collision/);
  assert.throws(() => buildImportSql({ ...base, passwordUpdates: [{ id: collision.targetId, expectedTargetDigest: d }] }), /collision/);
  assert.throws(() => buildImportSql({ ...base, passwordUpdates: [{ id: randomUUID(), expectedTargetDigest: d }] }), /not present/);
  assert.throws(() => buildImportSql({ ...base, passwordUpdates: [{ id: users[1].id, expectedTargetDigest: 'XYZ' }] }), /32 lowercase hex/);
  assert.throws(() => buildImportSql({ ...base, passwordUpdates: [{ id: users[1].id, expectedTargetDigest: 'A'.repeat(32) }] }), /32 lowercase hex/);
});

test('forbidden statements never appear', () => {
  const { sql } = build({ fillNullInstanceId: true });
  assert.ok(!/SET id\b/.test(sql));
  assert.ok(!sql.includes('DELETE FROM auth.users'));
  assert.ok(!sql.includes('TRUNCATE'));
  assert.ok(!/ON CONFLICT DO NOTHING/.test(sql));
});

test('count assertion DO block against expectedPresent', () => {
  const { sql } = build();
  assert.ok(sql.includes('count assertion failed'));
  assert.ok(sql.includes('vu <> 2 THEN RAISE EXCEPTION'));
});

test('dry-run replaces COMMIT by a rollback RAISE with counts', () => {
  const { sql } = build({ mode: 'dry-run', fillNullInstanceId: true });
  assert.ok(!sql.includes('COMMIT;'));
  assert.ok(sql.includes("RAISE EXCEPTION 'DRYRUN users_present=% identities_present=% collision_password_filled=% collision_identity_added=% instance_id_filled=% passwords_updated=% token_columns_filled=%'"));
});

test('dollar tag wraps payloads; tag inside payload throws', () => {
  const { users, identities, collision } = build();
  const sql = buildImportSql({ userCols, identityCols, users, identities, collisions: [collision], expectedPresent: 2, tag: '$tg$' });
  assert.ok(sql.includes("$tg$[{"));
  const poisoned = users.map((u) => ({ ...u, email: 'a$tg$b@example.invalid' }));
  assert.throws(() => buildImportSql({ userCols, identityCols, users: poisoned, identities, collisions: [], expectedPresent: 3, tag: '$tg$' }), /Dollar tag/);
});

test('UUIDs and identifiers are validated', () => {
  const { users, identities } = fixture();
  assert.throws(
    () => buildImportSql({ userCols, identityCols, users, identities, collisions: [{ sourceId: "x'; DROP", targetId: randomUUID() }], expectedPresent: 0 }),
    /Invalid UUID/
  );
  assert.throws(
    () => buildImportSql({ userCols: ['id', 'a"b'], identityCols, users, identities, collisions: [], expectedPresent: 0 }),
    /Unsafe column/
  );
});

test('token column fill: off by default, guarded per column on the collision target only', () => {
  const off = build();
  assert.ok(!off.sql.includes('SET confirmation_token'));
  assert.equal(count(off.sql, /'token_columns_filled'/g) >= 2, true);
  const on = build({ fillNullTokenColumns: true });
  assert.deepEqual([...TOKEN_COLUMNS], ['confirmation_token', 'recovery_token', 'email_change_token_new', 'email_change']);
  for (const col of TOKEN_COLUMNS) {
    assert.ok(on.sql.includes(`UPDATE auth.users SET ${col} = '' WHERE id = '${on.collision.targetId}' AND ${col} IS NULL`));
  }
  assert.equal(count(on.sql, /UPDATE auth\.users SET (confirmation_token|recovery_token|email_change_token_new|email_change) = ''/g), 4);
  assert.ok(on.sql.includes('AS token_columns_filled'));
  assert.ok(!/SET (confirmation_token|recovery_token|email_change_token_new|email_change) = [^']/.test(on.sql));
});

test('token column fill never targets the source id nor a bulk row', () => {
  const on = build({ fillNullTokenColumns: true });
  const updates = on.sql.split('\n').filter((l) => /SET (confirmation_token|recovery_token|email_change_token_new|email_change) =/.test(l));
  assert.equal(updates.length, 4);
  for (const l of updates) {
    assert.ok(l.includes(`WHERE id = '${on.collision.targetId}'`));
    assert.ok(!l.includes(on.collision.sourceId));
  }
});

test('mergeRemaps ORs booleans and sums token_columns_filled, keeps first-apply history', () => {
  const k = { source_user_id: 's', target_user_id: 't' };
  const first = [{ ...k, password_filled: true, identity_inserted: true, instance_id_filled: true }];
  const second = [{ ...k, password_filled: false, identity_inserted: false, instance_id_filled: false, token_columns_filled: 4 }];
  const m = mergeRemaps(first, second);
  assert.equal(m.length, 1);
  assert.deepEqual(m[0], { ...k, password_filled: true, identity_inserted: true, instance_id_filled: true, token_columns_filled: 4 });
  assert.deepEqual(mergeRemaps([], second), second);
  assert.equal(mergeRemaps(m, second)[0].token_columns_filled, 4 + 4);
});
