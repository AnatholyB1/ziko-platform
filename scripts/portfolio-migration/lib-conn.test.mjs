import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createLoginRole,
  deleteLoginRoles,
  getSessionPooler,
  pickSessionPooler,
  buildClientConfig,
  connectClient,
  redactSecrets,
} from './lib-conn.mjs';

const REF = 'rkirvurggtgjlkeuhded';

function recorder() {
  const calls = [];
  const fetchImpl = async (...a) => {
    calls.push(a);
    return { ok: true, status: 200, json: async () => [] };
  };
  return { calls, fetchImpl };
}

test('buildClientConfig builds a config object with verified TLS', () => {
  const c = buildClientConfig({ host: 'x.pooler.supabase.com', port: 5432, role: 'cli_login_x', ref: REF, password: 'pw' });
  assert.equal(c.user, `cli_login_x.${REF}`);
  assert.equal(c.database, 'postgres');
  assert.equal(c.port, 5432);
  assert.equal(c.application_name, 'ziko-portfolio-migration-phase4');
  assert.equal(c.ssl.rejectUnauthorized, true);
  assert.equal(c.ssl.ca, undefined);
  const withCa = buildClientConfig({ host: 'x.pooler.supabase.com', role: 'r', ref: REF, password: 'pw', caPem: 'PEM' });
  assert.equal(withCa.ssl.ca, 'PEM');
});

test('buildClientConfig refuses port 6543', () => {
  assert.throws(() => buildClientConfig({ host: 'x.pooler.supabase.com', port: 6543, role: 'r', ref: REF, password: 'p' }));
});

test('redactSecrets masks secrets including short ones, and PII', () => {
  const out = redactSecrets('connect failed for pw=Abc123 token sbp_x a@b.com', ['Abc123', 'sbp_x']);
  assert.ok(!out.includes('Abc123'));
  assert.ok(!out.includes('sbp_x'));
  assert.ok(out.includes('[secret]'));
  assert.ok(!out.includes('a@b.com'));
  assert.ok(!redactSecrets('abc', ['ab']).includes('ab' + 'c'));
});

test('pickSessionPooler picks PRIMARY and forces 5432', () => {
  const r = pickSessionPooler([
    { database_type: 'READ_REPLICA', db_host: 'r.pooler.supabase.com', db_port: 6543 },
    { database_type: 'PRIMARY', db_host: 'aws-0-eu.pooler.supabase.com', db_port: 6543 },
  ]);
  assert.deepEqual(r, { host: 'aws-0-eu.pooler.supabase.com', port: 5432 });
});

test('pickSessionPooler throws on no primary or bad host', () => {
  assert.throws(() => pickSessionPooler([]));
  assert.throws(() => pickSessionPooler([{ database_type: 'PRIMARY', db_host: 'evil.example.com' }]));
});

test('network functions reject an invalid ref before any fetch', async () => {
  const { calls, fetchImpl } = recorder();
  await assert.rejects(createLoginRole('bad', {}, { token: 't', fetchImpl }));
  await assert.rejects(getSessionPooler('bad', { token: 't', fetchImpl }));
  await assert.rejects(connectClient('bad', { token: 't', fetchImpl }));
  assert.equal(await deleteLoginRoles('bad', { token: 't', fetchImpl }), false);
  assert.equal(calls.length, 0);
});

test('parentRoleOf maps cli login roles to their parent and rejects others', async () => {
  const { parentRoleOf } = await import('./lib-conn.mjs');
  assert.equal(parentRoleOf('cli_login_postgres'), 'postgres');
  assert.equal(parentRoleOf('cli_login_supabase_read_only_user'), 'supabase_read_only_user');
  assert.throws(() => parentRoleOf('postgres'));
  assert.throws(() => parentRoleOf('cli_login_x"; drop'));
});

test('assumeParentRole sets the parent role and requires BYPASSRLS', async () => {
  const { assumeParentRole } = await import('./lib-conn.mjs');
  const calls = [];
  const mk = (row) => ({
    query: async (sql) => {
      calls.push(sql);
      return { rows: sql.startsWith('SELECT') ? [row] : [] };
    },
  });
  assert.equal(await assumeParentRole(mk({ u: 'postgres', bypass: true }), 'cli_login_postgres'), 'postgres');
  assert.equal(calls[0], 'SET ROLE "postgres"');
  await assert.rejects(assumeParentRole(mk({ u: 'postgres', bypass: false }), 'cli_login_postgres'));
  await assert.rejects(assumeParentRole(mk({ u: 'cli_login_postgres', bypass: true }), 'cli_login_postgres'));
});
