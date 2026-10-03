import { test } from 'node:test';
import assert from 'node:assert/strict';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildMergedAllowList, redactConfig, rawSnapshotPath } from './05-auth-config-merge.mjs';

test('buildMergedAllowList keeps portfolio order and appends only new entries', () => {
  const r = buildMergedAllowList('https://a.test/**,https://b.test/**', 'https://b.test/**,ziko://**', ['https://c.test/**']);
  assert.equal(r.merged, 'https://a.test/**,https://b.test/**,ziko://**,https://c.test/**');
  assert.deepEqual(r.added, ['ziko://**', 'https://c.test/**']);
});

test('buildMergedAllowList never removes a portfolio entry', () => {
  const r = buildMergedAllowList('x://1,x://2', '', []);
  assert.equal(r.merged, 'x://1,x://2');
  assert.deepEqual(r.added, []);
});

test('buildMergedAllowList tolerates empty/null inputs and dedupes extras', () => {
  const r = buildMergedAllowList(null, undefined, ['x://1', 'x://1']);
  assert.equal(r.merged, 'x://1');
  assert.deepEqual(r.added, ['x://1']);
});

test('redactConfig exposes only key names, digests, url list and site_url', () => {
  const secret = 'SUPER-SECRET-VALUE-123';
  const cfg = { site_url: 'https://site.test', uri_allow_list: 'a://1, b://2', smtp_pass: secret, jwt_exp: 3600 };
  const red = redactConfig(cfg);
  assert.deepEqual(red.keys, ['jwt_exp', 'site_url', 'smtp_pass', 'uri_allow_list']);
  assert.deepEqual(red.uri_allow_list, ['a://1', 'b://2']);
  assert.equal(red.site_url, 'https://site.test');
  assert.match(red.digests.smtp_pass, /^[0-9a-f]{64}$/);
  assert.ok(!JSON.stringify(red).includes(secret));
});

test('redactConfig digests change when a value changes', () => {
  const a = redactConfig({ x: 1 }).digests.x;
  const b = redactConfig({ x: 2 }).digests.x;
  assert.notEqual(a, b);
});

test('rawSnapshotPath is deterministic and label-validated', () => {
  assert.equal(
    rawSnapshotPath('rkirvurggtgjlkeuhded', 'before'),
    join(tmpdir(), 'ziko-auth-merge', 'rkirvurggtgjlkeuhded-before.raw.json')
  );
  assert.throws(() => rawSnapshotPath('rkirvurggtgjlkeuhded', 'Bad/Label'));
  assert.throws(() => rawSnapshotPath('rkirvurggtgjlkeuhded', '../x'));
  assert.throws(() => rawSnapshotPath('rkirvurggtgjlkeuhded', ''));
});
