/**
 * lib-decom-storage.mjs - storage list/download/upload helpers for the Phase 7 backup and restore
 * proof. Logic is copied from 08-copy-storage.mjs (which stays untouched). This module is
 * strictly additive: it contains no call that removes anything (guarded by a test that scans this
 * file with findDeleteCalls). The scratch wipe lives only in the restore-proof script.
 */
import { uploadStrategy } from './08-copy-storage.mjs';
import { SOURCE_BUCKET_RE } from './lib-storage.mjs';

export const RETRY_ATTEMPTS = 3;
export const RETRY_DELAYS_MS = Object.freeze([1000, 2000]);
const defaultSleep = (ms) => new Promise((r) => setTimeout(r, ms));

export function isRetryable(err) {
  const status = Number(err?.status ?? err?.statusCode ?? err?.originalError?.status);
  if (Number.isFinite(status) && status > 0) return status === 429 || status >= 500;
  return true; // network-level failure
}

/** Up to RETRY_ATTEMPTS attempts; non-retryable errors are rethrown immediately. */
export async function withRetry(fn, { sleep = defaultSleep, delays = RETRY_DELAYS_MS } = {}) {
  let last;
  for (let attempt = 0; attempt < RETRY_ATTEMPTS; attempt++) {
    try {
      return await fn();
    } catch (err) {
      last = err;
      if (!isRetryable(err) || attempt === RETRY_ATTEMPTS - 1) break;
      await sleep(delays[Math.min(attempt, delays.length - 1)]);
    }
  }
  throw last;
}

/** Runs worker over items with bounded concurrency; results keep the input order. */
export async function mapPool(items, concurrency, worker) {
  const results = new Array(items.length);
  let next = 0;
  const runners = Array.from({ length: Math.min(Math.max(1, concurrency), items.length) }, async () => {
    while (next < items.length) {
      const i = next++;
      results[i] = await worker(items[i], i);
    }
  });
  await Promise.all(runners);
  return results;
}

export const BUCKET_LIST_SQL =
  'SELECT id, public, file_size_limit, allowed_mime_types FROM storage.buckets ORDER BY id';

/** Object listing for the given bucket ids (ids are validated, never interpolated unchecked). */
export function buildObjectListSql(buckets) {
  if (!Array.isArray(buckets) || buckets.length === 0) throw new Error('buildObjectListSql needs at least one bucket id');
  for (const b of buckets) {
    if (typeof b !== 'string' || !SOURCE_BUCKET_RE.test(b)) throw new Error('invalid bucket id');
  }
  const list = buckets.map((b) => `'${b}'`).join(', ');
  return (
    `SELECT bucket_id, name, (metadata->>'size')::bigint AS size, metadata->>'mimetype' AS mimetype, ` +
    `metadata->>'cacheControl' AS cache_control, metadata->>'eTag' AS etag ` +
    `FROM storage.objects WHERE bucket_id IN (${list}) ORDER BY bucket_id, name`
  );
}

export async function downloadBuffer(client, bucket, name, retryOpts) {
  return withRetry(async () => {
    const { data, error } = await client.storage.from(bucket).download(name);
    if (error) throw error;
    return Buffer.from(await data.arrayBuffer());
  }, retryOpts);
}

/** Upload without upsert: the restore target is expected to be empty. Raw POST for non max-age cache control. */
export async function uploadObject(
  { client, url, secret, fetchImpl = fetch },
  bucket,
  key,
  buf,
  { mimetype, cacheControl } = {},
  retryOpts,
) {
  const strategy = uploadStrategy(cacheControl);
  const contentType = mimetype || 'application/octet-stream';
  return withRetry(async () => {
    if (strategy.kind === 'sdk') {
      const { error } = await client.storage.from(bucket).upload(key, buf, {
        contentType,
        cacheControl: strategy.cacheControl,
        upsert: false,
      });
      if (error) throw error;
      return;
    }
    const path = key.split('/').map(encodeURIComponent).join('/');
    const res = await fetchImpl(`${url}/storage/v1/object/${bucket}/${path}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${secret}`,
        apikey: secret,
        'content-type': contentType,
        'cache-control': strategy.header,
        'x-upsert': 'false',
      },
      body: buf,
    });
    if (!res.ok) {
      const e = new Error(`raw upload failed with HTTP ${res.status}`);
      e.status = res.status;
      throw e;
    }
  }, retryOpts);
}
