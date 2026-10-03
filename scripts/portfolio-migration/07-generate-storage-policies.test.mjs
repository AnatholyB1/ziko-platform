import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveRun, deriveFunctionRenames, buildMigration, staleCheckFile, UsageError } from './07-generate-storage-policies.mjs';

const ZIKO = 'slkobhavpwsubnsmuhya';
const PORTFOLIO = 'ubxllsvanurkwkohzxau';
const SCRATCH = 'rkirvurggtgjlkeuhded';

const buckets = [
  { id: 'avatars', public: true, file_size_limit: 1000, allowed_mime_types: ['image/png'] },
  { id: 'coach-kyc', public: false, file_size_limit: null, allowed_mime_types: null },
];
const policies = [
  {
    policyname: 'avatars_read',
    cmd: 'SELECT',
    roles: '{public}',
    permissive: 'PERMISSIVE',
    qual: "(bucket_id = 'avatars'::text)",
    with_check: null,
  },
  {
    policyname: 'kyc_coach_read',
    cmd: 'SELECT',
    roles: '{authenticated}',
    permissive: 'PERMISSIVE',
    qual: "((bucket_id = 'coach-kyc'::text) AND is_coach_of(auth.uid(), ((storage.foldername(name))[1])::uuid))",
    with_check: null,
  },
];
const renameMap = { functions: { 'is_coach_of(coach uuid, client uuid)': 'ziko_is_coach_of(coach uuid, client uuid)', 'handle_new_user()': 'ziko_handle_new_user()' } };

test('resolveRun: no mode is a usage error', () => {
  assert.throws(() => resolveRun({}), UsageError);
});

test('resolveRun: exactly one mode', () => {
  assert.throws(() => resolveRun({ generate: true, check: true, sourceRef: ZIKO }), UsageError);
});

test('resolveRun: generate/check need ziko source ref', () => {
  assert.throws(() => resolveRun({ generate: true, sourceRef: SCRATCH }), UsageError);
  assert.throws(() => resolveRun({ check: true }), UsageError);
  assert.equal(resolveRun({ generate: true, sourceRef: ZIKO }).mode, 'generate');
  assert.equal(resolveRun({ check: true, sourceRef: ZIKO }).mode, 'check');
});

test('resolveRun: apply guards', () => {
  assert.throws(() => resolveRun({ apply: true }), UsageError);
  assert.throws(() => resolveRun({ apply: true, projectRef: ZIKO }), UsageError);
  assert.throws(() => resolveRun({ apply: true, projectRef: PORTFOLIO }), UsageError);
  assert.throws(() => resolveRun({ apply: true, projectRef: PORTFOLIO, confirmRef: SCRATCH }), UsageError);
  assert.equal(resolveRun({ apply: true, projectRef: PORTFOLIO, confirmRef: PORTFOLIO }).mode, 'apply');
  assert.equal(resolveRun({ apply: true, projectRef: SCRATCH }).mode, 'apply');
});

test('deriveFunctionRenames strips signatures', () => {
  assert.deepEqual(deriveFunctionRenames(renameMap), { is_coach_of: 'ziko_is_coach_of', handle_new_user: 'ziko_handle_new_user' });
});

test('buildMigration: generated, transactional, no stale refs', () => {
  const sql = buildMigration(buckets, policies, deriveFunctionRenames(renameMap));
  assert.match(sql, /generated/i);
  assert.match(sql, /expected policy count: 2/);
  assert.match(sql, /^BEGIN;$/m);
  assert.match(sql, /^COMMIT;$/m);
  assert.match(sql, /"ziko_avatars_read"/);
  assert.match(sql, /public\.ziko_is_coach_of\(/);
  assert.deepEqual(staleCheckFile(sql, buckets.map((b) => b.id)), []);
});

test('staleCheckFile flags an injected bare bucket literal', () => {
  const sql = buildMigration(buckets, policies, deriveFunctionRenames(renameMap));
  const bad = `${sql}\nCREATE POLICY "x" ON storage.objects USING (bucket_id = 'avatars');`;
  assert.ok(staleCheckFile(bad, ['avatars', 'coach-kyc']).length > 0);
  const bad2 = `${sql}\nUSING (is_coach_of(a, b))`;
  assert.ok(staleCheckFile(bad2, ['avatars']).length > 0);
});
