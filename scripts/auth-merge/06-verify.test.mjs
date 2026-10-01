import test from 'node:test';
import assert from 'node:assert/strict';
import { parseProbeOutput, evaluateTenants, digestColumns } from './06-verify.mjs';
import { VOLATILE_AUTH_USER_COLUMNS, VOLATILE_AUTH_IDENTITY_COLUMNS } from './lib.mjs';

const ID_A = '11111111-1111-1111-1111-111111111111';
const ID_B = '22222222-2222-2222-2222-222222222222';

function base(over = {}) {
  return {
    tenant_tables: { rh_items: 5 },
    auth_users: [{ id: ID_A, has_password: false, instance_id_null: true, stable_hash: 'h1' }],
    auth_identities: [{ id: 'i1', user_id: ID_A, provider: 'email', stable_hash: 'ih1' }],
    auth_user_triggers: [],
    ...over,
  };
}
const clone = (o) => JSON.parse(JSON.stringify(o));

// ------------------------------------------------------------ parseProbeOutput
test('parseProbeOutput reads the PROBE line as numbers', () => {
  const text = 'noise\nERROR: PROBE unflagged_profiles=0 unflagged_credits=0 unflagged_txns=0 flagged_profiles=1 flagged_credits=1 flagged_txns=1 (SQLSTATE P0001)';
  assert.deepEqual(parseProbeOutput(text), {
    unflagged_profiles: 0,
    unflagged_credits: 0,
    unflagged_txns: 0,
    flagged_profiles: 1,
    flagged_credits: 1,
    flagged_txns: 1,
  });
});

test('parseProbeOutput throws without a PROBE line', () => {
  assert.throws(() => parseProbeOutput('syntax error at or near'), /PROBE/);
});

test('parseProbeOutput parses non-zero unflagged counts', () => {
  const r = parseProbeOutput('PROBE unflagged_profiles=2 unflagged_credits=1 unflagged_txns=3 flagged_profiles=1 flagged_credits=1 flagged_txns=1');
  assert.equal(r.unflagged_profiles, 2);
  assert.equal(r.unflagged_txns, 3);
});

// ------------------------------------------------------------ digestColumns
test('digestColumns users drops every volatile column and keeps the rest in order', () => {
  const cols = ['id', 'email', 'last_sign_in_at', 'encrypted_password', 'updated_at', 'raw_user_meta_data'];
  assert.deepEqual(digestColumns('users', cols), ['id', 'email', 'encrypted_password', 'raw_user_meta_data']);
});

test('digestColumns users removes all of VOLATILE_AUTH_USER_COLUMNS', () => {
  const out = digestColumns('users', ['id', ...VOLATILE_AUTH_USER_COLUMNS]);
  assert.deepEqual(out, ['id']);
});

test('digestColumns identities removes all of VOLATILE_AUTH_IDENTITY_COLUMNS', () => {
  const out = digestColumns('identities', ['id', 'provider_id', ...VOLATILE_AUTH_IDENTITY_COLUMNS, 'identity_data']);
  assert.deepEqual(out, ['id', 'provider_id', 'identity_data']);
});

test('digestColumns identities keeps columns that are volatile only for users', () => {
  assert.ok(digestColumns('identities', ['id', 'recovery_token']).includes('recovery_token'));
});

test('digestColumns throws for another table', () => {
  assert.throws(() => digestColumns('sessions', ['id']), /table/i);
});

// ------------------------------------------------------------ evaluateTenants
test('evaluateTenants: identical state has no failures', () => {
  const r = evaluateTenants(base(), base());
  assert.deepEqual(r.failures, []);
  assert.deepEqual(r.warnings, []);
});

test('evaluateTenants: missing baseline user and changed hash fail', () => {
  const cur = base({ auth_users: [] });
  assert.equal(evaluateTenants(base(), cur).failures.length, 1);
  const cur2 = clone(base());
  cur2.auth_users[0].stable_hash = 'other';
  assert.equal(evaluateTenants(base(), cur2).failures.length, 1);
});

test('evaluateTenants: missing tenant table fails, row-count delta only warns', () => {
  assert.equal(evaluateTenants(base(), base({ tenant_tables: {} })).failures.length, 1);
  const r = evaluateTenants(base(), base({ tenant_tables: { rh_items: 9 } }));
  assert.equal(r.failures.length, 0);
  assert.equal(r.warnings.length, 1);
  assert.match(r.warnings[0], /rh_items/);
});

test('evaluateTenants: password fill allowed only for listed ids', () => {
  const cur = clone(base());
  cur.auth_users[0].has_password = true;
  assert.equal(evaluateTenants(base(), cur, { allowedPasswordFillIds: [ID_A] }).failures.length, 0);
  assert.equal(evaluateTenants(base(), cur, { allowedPasswordFillIds: [ID_B] }).failures.length, 1);
  assert.equal(evaluateTenants(base(), cur).failures.length, 1);
});

test('evaluateTenants: password true -> false always fails', () => {
  const b = clone(base());
  b.auth_users[0].has_password = true;
  const cur = clone(b);
  cur.auth_users[0].has_password = false;
  assert.equal(evaluateTenants(b, cur, { allowedPasswordFillIds: [ID_A] }).failures.length, 1);
});

test('evaluateTenants: allowed instance_id fill with unchanged hash passes', () => {
  const cur = clone(base());
  cur.auth_users[0].instance_id_null = false;
  const r = evaluateTenants(base(), cur, { allowedInstanceIdFillIds: [ID_A] });
  assert.deepEqual(r.failures, []);
});

test('evaluateTenants: instance_id fill for a non-allowed id fails and names the id', () => {
  const cur = clone(base());
  cur.auth_users[0].instance_id_null = false;
  const r = evaluateTenants(base(), cur, { allowedInstanceIdFillIds: [ID_B] });
  assert.equal(r.failures.length, 1);
  assert.ok(r.failures[0].includes(ID_A));
});

test('evaluateTenants: instance_id fill fails by default (flag omitted)', () => {
  const cur = clone(base());
  cur.auth_users[0].instance_id_null = false;
  assert.equal(evaluateTenants(base(), cur).failures.length, 1);
});

test('evaluateTenants: instance_id false -> true always fails', () => {
  const b = clone(base());
  b.auth_users[0].instance_id_null = false;
  const cur = clone(b);
  cur.auth_users[0].instance_id_null = true;
  assert.equal(evaluateTenants(b, cur, { allowedInstanceIdFillIds: [ID_A] }).failures.length, 1);
});

test('evaluateTenants: identity missing or hash changed fails', () => {
  assert.equal(evaluateTenants(base(), base({ auth_identities: [] })).failures.length, 1);
  const cur = clone(base());
  cur.auth_identities[0].stable_hash = 'x';
  assert.equal(evaluateTenants(base(), cur).failures.length, 1);
});

test('evaluateTenants: ignores new users and identities', () => {
  const cur = clone(base());
  cur.auth_users.push({ id: ID_B, has_password: true, instance_id_null: false, stable_hash: 'z' });
  cur.auth_identities.push({ id: 'i2', user_id: ID_B, provider: 'email', stable_hash: 'z' });
  assert.deepEqual(evaluateTenants(base(), cur).failures, []);
});

test('evaluateTenants: non-ziko trigger change fails, ziko_ trigger addition does not', () => {
  const added = base({ auth_user_triggers: [{ name: 'ziko_on_auth_user_created', enabled: 'O' }] });
  assert.deepEqual(evaluateTenants(base(), added).failures, []);
  const foreign = base({ auth_user_triggers: [{ name: 'rh_new_trigger', enabled: 'O' }] });
  assert.equal(evaluateTenants(base(), foreign).failures.length, 1);
  const b = base({ auth_user_triggers: [{ name: 'rh_trigger', enabled: 'O' }] });
  assert.equal(evaluateTenants(b, base()).failures.length, 1);
});

test('evaluateTenants: token column fill passes only when allowed, masked hash equals baseline and columns are empty', () => {
  const cur = clone(base());
  cur.auth_users[0].stable_hash = 'h2';
  cur.auth_users[0].stable_hash_tokens_nulled = 'h1';
  cur.auth_users[0].token_cols_empty = true;
  assert.deepEqual(evaluateTenants(base(), cur, { allowedTokenFillIds: [ID_A] }).failures, []);
  assert.equal(evaluateTenants(base(), cur).failures.length, 1);
  assert.equal(evaluateTenants(base(), cur, { allowedTokenFillIds: [ID_B] }).failures.length, 1);
  const notEmpty = clone(cur);
  notEmpty.auth_users[0].token_cols_empty = false;
  assert.equal(evaluateTenants(base(), notEmpty, { allowedTokenFillIds: [ID_A] }).failures.length, 1);
  const other = clone(cur);
  other.auth_users[0].stable_hash_tokens_nulled = 'hX';
  assert.equal(evaluateTenants(base(), other, { allowedTokenFillIds: [ID_A] }).failures.length, 1);
});
