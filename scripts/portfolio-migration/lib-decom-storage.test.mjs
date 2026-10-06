import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  withRetry,
  mapPool,
  buildObjectListSql,
  BUCKET_LIST_SQL,
  downloadBuffer,
  uploadObject,
} from './lib-decom-storage.mjs';
import { findDeleteCalls } from './lib-storage.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const noSleep = { sleep: async () => {} };

test('withRetry retries retryable errors up to 3 attempts then rethrows', async () => {
  let n = 0;
  const sleeps = [];
  await assert.rejects(
    withRetry(async () => { n++; throw Object.assign(new Error('x'), { status: 503 }); }, { sleep: async (ms) => sleeps.push(ms) }),
    /x/,
  );
  assert.equal(n, 3);
  assert.equal(sleeps.length, 2);
});

test('withRetry succeeds after a transient failure', async () => {
  let n = 0;
  const v = await withRetry(async () => { if (++n < 2) throw new Error('net'); return 'ok'; }, noSleep);
  assert.equal(v, 'ok');
  assert.equal(n, 2);
});

test('withRetry rethrows non-retryable immediately', async () => {
  let n = 0;
  await assert.rejects(withRetry(async () => { n++; throw Object.assign(new Error('nope'), { status: 404 }); }, noSleep), /nope/);
  assert.equal(n, 1);
});

test('mapPool respects concurrency and preserves order', async () => {
  let active = 0;
  let peak = 0;
  const out = await mapPool([1, 2, 3, 4, 5, 6], 2, async (x) => {
    active++;
    peak = Math.max(peak, active);
    await new Promise((r) => setTimeout(r, 5 * (7 - x)));
    active--;
    return x * 10;
  });
  assert.deepEqual(out, [10, 20, 30, 40, 50, 60]);
  assert.ok(peak <= 2);
});

test('buildObjectListSql lists required columns in order and validates bucket ids', () => {
  const sql = buildObjectListSql(['scan-photos', 'avatars']);
  for (const col of ['bucket_id', 'name', "metadata->>'size'", "metadata->>'mimetype'", "metadata->>'cacheControl'", "metadata->>'eTag'"]) {
    assert.ok(sql.includes(col), col);
  }
  assert.ok(sql.includes("'scan-photos', 'avatars'"));
  assert.ok(sql.endsWith('ORDER BY bucket_id, name'));
  assert.throws(() => buildObjectListSql(["a'; drop"]), /invalid bucket id/);
  assert.throws(() => buildObjectListSql(['Upper']), /invalid bucket id/);
  assert.throws(() => buildObjectListSql([]), /at least one/);
});

test('BUCKET_LIST_SQL selects bucket settings', () => {
  for (const c of ['id', 'public', 'file_size_limit', 'allowed_mime_types', 'storage.buckets']) assert.ok(BUCKET_LIST_SQL.includes(c));
});

test('downloadBuffer returns a Buffer from the injected client', async () => {
  const client = { storage: { from: (b) => ({ download: async (n) => ({ data: { arrayBuffer: async () => new TextEncoder().encode(`${b}/${n}`).buffer }, error: null }) }) } };
  const buf = await downloadBuffer(client, 'bk', 'a.txt', noSleep);
  assert.equal(buf.toString(), 'bk/a.txt');
});

test('downloadBuffer surfaces client errors', async () => {
  const client = { storage: { from: () => ({ download: async () => ({ data: null, error: Object.assign(new Error('gone'), { status: 404 }) }) }) } };
  await assert.rejects(downloadBuffer(client, 'bk', 'a', noSleep), /gone/);
});

test('uploadObject uses the sdk with upsert false for max-age cache control', async () => {
  const calls = [];
  const client = { storage: { from: (b) => ({ upload: async (k, buf, opts) => { calls.push([b, k, opts]); return { error: null }; } }) } };
  await uploadObject({ client }, 'bk', 'dir/a.png', Buffer.from('x'), { mimetype: 'image/png', cacheControl: 'max-age=60' }, noSleep);
  assert.equal(calls.length, 1);
  assert.equal(calls[0][2].upsert, false);
  assert.equal(calls[0][2].cacheControl, '60');
  assert.equal(calls[0][2].contentType, 'image/png');
});

test('uploadObject uses a raw POST with the literal header otherwise', async () => {
  const seen = [];
  const fetchImpl = async (url, init) => { seen.push([url, init]); return { ok: true, status: 200 }; };
  await uploadObject({ client: null, url: 'https://x.test', secret: 's', fetchImpl }, 'bk', 'a b/c.png', Buffer.from('x'), { cacheControl: 'public, max-age=5' }, noSleep);
  assert.equal(seen.length, 1);
  assert.equal(seen[0][0], 'https://x.test/storage/v1/object/bk/a%20b/c.png');
  assert.equal(seen[0][1].headers['cache-control'], 'public, max-age=5');
  assert.equal(seen[0][1].headers['x-upsert'], 'false');
});

test('lib-decom-storage.mjs contains no delete calls', () => {
  const src = readFileSync(join(HERE, 'lib-decom-storage.mjs'), 'utf8');
  assert.deepEqual(findDeleteCalls(src), []);
});
