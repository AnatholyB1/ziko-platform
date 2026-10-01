import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  PROJECTS,
  KNOWN_COLLISION_SOURCE_IDS,
  VOLATILE_AUTH_USER_COLUMNS,
  VOLATILE_AUTH_IDENTITY_COLUMNS,
  maskEmail,
  redactPii,
  intersectColumns,
  chooseDollarTag,
  parseUriList,
  unionUriList,
  diffAuthConfig,
  matchCollisions,
  assertWriteAllowed,
  requireRef,
  parseCliArgs,
} from './lib.mjs';

test('maskEmail masks local part and domain, keeps TLD', () => {
  assert.equal(maskEmail('alice@example.com'), 'a***@***.com');
  assert.equal(maskEmail(42), '***');
  assert.equal(maskEmail('no-at-sign'), '***');
});

test('redactPii masks emails and bcrypt hashes', () => {
  const hash = '$2a$10$' + 'a'.repeat(53);
  const out = redactPii(`dup key bob@example.com value ${hash} and carol@example.invalid`);
  assert.ok(!out.includes('bob@example.com'));
  assert.ok(!out.includes('carol@example.invalid'));
  assert.ok(!out.includes(hash));
  assert.ok(out.includes('b***@***.com'));
  assert.ok(out.includes('[bcrypt]'));
  assert.ok(redactPii(`$2b$12$${'Z'.repeat(53)}`).includes('[bcrypt]'));
  assert.ok(redactPii(`$2y$04$${'.'.repeat(53)}`).includes('[bcrypt]'));
});

test('intersectColumns keeps order of first list and requires id', () => {
  assert.deepEqual(intersectColumns(['id', 'email', 'x'], ['email', 'id']), ['id', 'email']);
  assert.throws(() => intersectColumns(['email', 'x'], ['email', 'id']));
});

test('chooseDollarTag returns a unique tag', () => {
  const tag = chooseDollarTag('select 1');
  assert.match(tag, /^\$ziko_[0-9a-f]+\$$/);
  let calls = 0;
  const fixed = Buffer.from('aabbccdd', 'hex');
  const other = Buffer.from('11223344', 'hex');
  const t2 = chooseDollarTag('x $ziko_aabbccdd$ y', () => (calls++ === 0 ? fixed : other));
  assert.equal(t2, '$ziko_11223344$');
  assert.equal(calls, 2);
});

test('parseUriList and unionUriList', () => {
  assert.deepEqual(parseUriList('a, b,,a '), ['a', 'b']);
  assert.equal(unionUriList('a,b', ['b', 'c']), 'a,b,c');
  assert.equal(unionUriList('', ['x']), 'x');
});

test('diffAuthConfig reports removed/added uris and changed keys', () => {
  const before = { uri_allow_list: 'a,b', site_url: 's', only_before: 1, same: { k: 1 } };
  const after = { uri_allow_list: 'b,c', site_url: 's2', only_after: 2, same: { k: 1 } };
  const d = diffAuthConfig(before, after, { allowChanged: ['uri_allow_list'] });
  assert.deepEqual(d.removedUris, ['a']);
  assert.deepEqual(d.addedUris, ['c']);
  assert.deepEqual(d.changedKeys.sort(), ['only_after', 'only_before', 'site_url']);
});

test('matchCollisions classifies rows', () => {
  const src = [
    { id: 's1', fp: 'F1', has_password: true, has_email_identity: true, instance_id_null: false },
    { id: 's2', fp: 'F2', has_password: true, has_email_identity: true, instance_id_null: false },
    { id: 's3', fp: 'F3', has_password: true, has_email_identity: true, instance_id_null: false },
    { id: 's4', fp: 'F4', has_password: true, has_email_identity: true, instance_id_null: false },
  ];
  const tgt = [
    { id: 't1', fp: 'F1', has_password: false, has_email_identity: false, instance_id_null: true },
    { id: 's2', fp: 'F2', has_password: true, has_email_identity: true, instance_id_null: false },
    { id: 's3', fp: 'OTHER', has_password: true, has_email_identity: true, instance_id_null: false },
  ];
  const r = matchCollisions(src, tgt);
  assert.deepEqual(r.collisions, [
    { sourceId: 's1', targetId: 't1', targetHasPassword: false, targetHasEmailIdentity: false, targetInstanceIdNull: true },
  ]);
  assert.deepEqual(r.alreadyImported, ['s2']);
  assert.deepEqual(r.idConflicts, ['s3']);
});

test('assertWriteAllowed enforces project safety', () => {
  assert.throws(() => assertWriteAllowed({ projectRef: PROJECTS.ziko }));
  assert.throws(() => assertWriteAllowed({ projectRef: PROJECTS.ziko, confirmRef: PROJECTS.ziko }));
  assert.throws(() => assertWriteAllowed({ projectRef: PROJECTS.portfolio }));
  assert.throws(() => assertWriteAllowed({ projectRef: PROJECTS.portfolio, confirmRef: 'x' }));
  assert.doesNotThrow(() => assertWriteAllowed({ projectRef: PROJECTS.portfolio, confirmRef: PROJECTS.portfolio }));
  assert.doesNotThrow(() => assertWriteAllowed({ projectRef: PROJECTS.scratch }));
  assert.throws(() => assertWriteAllowed({ projectRef: 'NOT-A-REF' }));
  assert.throws(() => assertWriteAllowed({ projectRef: 'abc' }));
});

test('requireRef exits 2 when missing', () => {
  let code = null;
  requireRef({}, 'projectRef', { exit: (c) => { code = c; } });
  assert.equal(code, 2);
  code = null;
  assert.equal(requireRef({ projectRef: PROJECTS.scratch }, 'projectRef', { exit: (c) => { code = c; } }), PROJECTS.scratch);
  assert.equal(code, null);
});

test('parseCliArgs handles types and unknown flags', () => {
  const spec = { 'project-ref': 'string', 'dry-run': 'boolean', only: 'list' };
  const a = parseCliArgs(['--project-ref', 'r', '--dry-run', '--only', 'a,b'], spec);
  assert.equal(a.projectRef, 'r');
  assert.equal(a.dryRun, true);
  assert.deepEqual(a.only, ['a', 'b']);
  let code = null;
  parseCliArgs(['--bogus'], spec, { exit: (c) => { code = c; }, log: () => {} });
  assert.equal(code, 2);
});

test('volatile column lists and constants', () => {
  assert.ok(Object.isFrozen(VOLATILE_AUTH_USER_COLUMNS));
  assert.ok(Object.isFrozen(VOLATILE_AUTH_IDENTITY_COLUMNS));
  assert.ok(VOLATILE_AUTH_USER_COLUMNS.includes('last_sign_in_at'));
  assert.ok(VOLATILE_AUTH_USER_COLUMNS.includes('updated_at'));
  assert.ok(!VOLATILE_AUTH_USER_COLUMNS.includes('encrypted_password'));
  assert.ok(!VOLATILE_AUTH_USER_COLUMNS.includes('instance_id'));
  assert.deepEqual([...VOLATILE_AUTH_IDENTITY_COLUMNS], ['last_sign_in_at', 'updated_at']);
  assert.ok(Object.isFrozen(PROJECTS));
  assert.deepEqual([...KNOWN_COLLISION_SOURCE_IDS], ['ea0f0b65-6681-4780-8ee0-dbf20b95d4d9']);
});

test('pickApiKeys skips masked sb_secret keys and falls back to legacy service_role', async () => {
  const { pickApiKeys } = await import('./lib.mjs');
  const keys = [
    { type: 'legacy', name: 'anon', api_key: 'eyJanon' },
    { type: 'legacy', name: 'service_role', api_key: 'eyJservice' },
    { type: 'publishable', name: 'default', api_key: 'sb_publishable_abc' },
    { type: 'secret', name: 'default', api_key: 'sb_secret_ab••••' },
  ];
  assert.deepEqual(pickApiKeys(keys), { publishable: 'sb_publishable_abc', secret: 'eyJservice' });
  keys[3].api_key = 'sb_secret_full';
  assert.equal(pickApiKeys(keys).secret, 'sb_secret_full');
  assert.equal(pickApiKeys([keys[0]]), null);
});
