#!/usr/bin/env node
/**
 * Phase 5 storage transport: copy ziko storage buckets/objects into ziko-<id> buckets of a target
 * project (scratch rehearsal, portfolio for the real run, reusable for the Phase 6 delta).
 *
 * Usage:
 *   node scripts/portfolio-migration/08-copy-storage.mjs --source-ref <ziko> --project-ref <target> \
 *     --remap-file <path> [--confirm-ref <ref>] (--plan | --apply) [--concurrency N] \
 *     [--report-out <path>] [--bucket-map <path>]
 *
 * Modes (exactly one; default --plan):
 *   --plan   read-only on both sides: bucket drift, mime/size violations, re-key preview, target state,
 *            global size limit, policy privilege probe. Counts only.
 *   --apply  add-only and idempotent: converge ziko-<id> buckets from live config, copy objects
 *            (sha256 verified), report destination-only objects for human review. Nothing is ever removed.
 *
 * Exit codes: 0 ok; 1 failure (any guard, drift, failed object); 2 bad arguments.
 * Service-role keys live in memory only and never reach any output or file.
 */

import { readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';
import {
  PROJECTS,
  parseCliArgs,
  assertProjectRefFormat,
  assertWriteAllowed,
  runSql,
  getProjectApiKeys,
  loadAccessToken,
  redactPii,
  isMain,
} from '../auth-merge/lib.mjs';
import { parseRemapFile } from './lib-data.mjs';
import { assertReportSafe } from './lib-verify.mjs';
import { redactSecrets } from './lib-conn.mjs';
import {
  targetBucketId,
  assertTargetBucket,
  rekeyObjectName,
  findMimeSizeViolations,
  diffBucketConfig,
  sha256Hex,
  maskObjectKey,
  parseCacheControl,
} from './lib-storage.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DEFAULT_BUCKET_MAP = join(__dirname, 'bucket-map.generated.json');

const SPEC = {
  'source-ref': 'string',
  'project-ref': 'string',
  'confirm-ref': 'string',
  'remap-file': 'string',
  plan: 'boolean',
  apply: 'boolean',
  concurrency: 'string',
  'report-out': 'string',
  'bucket-map': 'string',
};

const HELP = `Phase 5 storage copy (ziko buckets -> ziko-<id> buckets, add-only)

  node scripts/portfolio-migration/08-copy-storage.mjs --source-ref <ref> --project-ref <ref> --remap-file <path>
       [--confirm-ref <ref>] (--plan | --apply) [--concurrency 1..8] [--report-out <path>] [--bucket-map <path>]

Default mode is --plan (read-only). Writing to portfolio needs --confirm-ref <portfolio ref>.
--apply refuses until the target has the ziko_ storage policies. Nothing is ever removed.
Exit codes: 0 ok, 1 failure, 2 bad arguments.`;

export class CliError extends Error {
  constructor(message, exitCode = 1) {
    super(message);
    this.exitCode = exitCode;
  }
}

// ---------------------------------------------------------------------------
// Pure helpers
// ---------------------------------------------------------------------------

/** Argument validation, no I/O. Usage problems exit 2, safety refusals exit 1. */
export function resolveRun(args) {
  if (args.plan && args.apply) throw new CliError('only one of --plan, --apply may be given', 2);
  const mode = args.apply ? 'apply' : 'plan';
  if (!args.projectRef) throw new CliError('--project-ref <ref> is required (no default)', 2);
  if (!args.sourceRef) throw new CliError('--source-ref <ref> is required (no default)', 2);
  try {
    assertProjectRefFormat(args.projectRef);
    assertProjectRefFormat(args.sourceRef);
  } catch (err) {
    throw new CliError(err.message, 2);
  }
  if (!args.remapFile) throw new CliError('--remap-file is required', 2);
  let concurrency = 4;
  if (args.concurrency !== null && args.concurrency !== undefined) {
    if (!/^\d+$/.test(String(args.concurrency))) throw new CliError('--concurrency must be an integer 1..8', 2);
    concurrency = Number(args.concurrency);
    if (concurrency < 1 || concurrency > 8) throw new CliError('--concurrency must be an integer 1..8', 2);
  }
  if (args.sourceRef !== PROJECTS.ziko) throw new CliError('--source-ref must be the ziko project', 1);
  if (args.projectRef === PROJECTS.ziko) throw new CliError('Refusing: ziko can never be the target', 1);
  if (mode === 'apply') {
    try {
      assertWriteAllowed({ projectRef: args.projectRef, confirmRef: args.confirmRef });
    } catch (err) {
      throw new CliError(err.message, 1);
    }
  }
  return {
    mode,
    sourceRef: args.sourceRef,
    targetRef: args.projectRef,
    remapFile: args.remapFile,
    concurrency,
  };
}

/** 'copy' unless the destination already holds an object with equal size and equal sha256. */
export function decideObject({ src, dst }) {
  if (!dst) return 'copy';
  if (Number(dst.size) !== Number(src.size)) return 'copy';
  if (!dst.sha || dst.sha !== src.sha) return 'copy';
  return 'skip';
}

/** The SDK can only emit max-age=<n>; anything else goes through a raw POST with the literal header. */
export function uploadStrategy(cacheControl) {
  const p = parseCacheControl(cacheControl);
  if (p.mode === 'max-age') return { kind: 'sdk', cacheControl: String(p.seconds) };
  return { kind: 'raw', header: p.value };
}

/** Global storage file-size limit must cover every bucket limit and the largest object. */
export function checkGlobalLimit({ globalLimit, bucketRows, maxObjectSize }) {
  if (globalLimit === null || globalLimit === undefined) return { status: 'unknown', reasons: [] };
  const limit = Number(globalLimit);
  const reasons = [];
  for (const b of bucketRows ?? []) {
    if (b.file_size_limit !== null && b.file_size_limit !== undefined && limit < Number(b.file_size_limit)) {
      reasons.push(`global limit below bucket ${b.id} limit`);
    }
  }
  if (limit < Number(maxObjectSize ?? 0)) reasons.push('global limit below largest object');
  return { status: reasons.length === 0 ? 'ok' : 'fail', reasons };
}

/** Counts only (no object names, no UUIDs); throws if anything PII-shaped slips in. */
export function buildCopyReport({ targetRef, mode, buckets, perBucket, destOnly, cacheControlRaw }) {
  const num = (v) => Number(v ?? 0);
  const rows = (buckets ?? []).map((id) => {
    const p = perBucket?.[id] ?? {};
    return {
      source: id,
      target: targetBucketId(id),
      objects: num(p.objects),
      bytes: num(p.bytes),
      copied: num(p.copied),
      changed: num(p.changed),
      skipped: num(p.skipped),
      rekeyed: num(p.rekeyed),
      failed: num(p.failed),
    };
  });
  const sum = (k) => rows.reduce((a, r) => a + r[k], 0);
  const report = {
    target_ref: targetRef,
    mode,
    generated_at: new Date().toISOString(),
    buckets: rows,
    total_objects: sum('objects'),
    total_bytes: sum('bytes'),
    total_copied: sum('copied'),
    total_failed: sum('failed'),
    dest_only: num(destOnly),
    cache_control_raw: num(cacheControlRaw),
    notes: ['created_at is reset on copied objects; the scan-photos 90-day cleanup clock restarts'],
  };
  assertReportSafe(report);
  return report;
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

export async function main(argv) {
  const log = (s) => console.log(s);
  let args;
  try {
    args = parseCliArgs(argv, SPEC, {
      exit: (c) => {
        throw new CliError('bad arguments', c);
      },
      log: console.error,
    });
  } catch (err) {
    return err.exitCode ?? 2;
  }
  if (args.help) {
    console.log(HELP);
    return 0;
  }
  try {
    const run = resolveRun(args);
    return await execute(run, args, log);
  } catch (err) {
    console.error(`ERROR: ${redactSecrets(redactPii(err.message), [process.env.SUPABASE_ACCESS_TOKEN])}`);
    return err instanceof CliError ? err.exitCode : 1;
  }
}

// ---------------------------------------------------------------------------
// Live I/O
// ---------------------------------------------------------------------------

const BUCKETS_SQL = 'SELECT id, public, file_size_limit, allowed_mime_types FROM storage.buckets ORDER BY id';
const OBJECTS_SQL = `SELECT bucket_id, name, (metadata->>'size')::bigint AS size, metadata->>'mimetype' AS mimetype, metadata->>'cacheControl' AS cache_control FROM storage.objects ORDER BY bucket_id, name`;
const TARGET_OBJECTS_SQL = `SELECT bucket_id, name, (metadata->>'size')::bigint AS size, metadata->>'mimetype' AS mimetype, metadata->>'cacheControl' AS cache_control FROM storage.objects WHERE bucket_id LIKE 'ziko-%' ORDER BY bucket_id, name`;
const SOURCE_POLICY_COUNT_SQL = `SELECT count(*)::int AS n FROM pg_policies WHERE schemaname = 'storage'`;
const TARGET_POLICY_COUNT_SQL = `SELECT count(*)::int AS n FROM pg_policies WHERE schemaname = 'storage' AND policyname LIKE 'ziko\\_%'`;
const PRIVILEGE_SQL = `SELECT current_user::text AS current_user_name,
  pg_get_userbyid(c.relowner)::text AS objects_owner,
  pg_has_role(current_user, c.relowner, 'MEMBER') AS is_member
FROM pg_class c WHERE c.oid = 'storage.objects'::regclass`;

const RETRY_DELAYS_MS = [1000, 2000, 4000, 8000];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const keyOf = (bucket, name) => `${bucket}\u0000${name}`;

function isRetryable(err) {
  const status = Number(err?.status ?? err?.statusCode ?? err?.originalError?.status);
  if (Number.isFinite(status) && status > 0) return status === 429 || status >= 500;
  return true; // network-level failure
}

async function withRetry(fn) {
  let last;
  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
    try {
      return await fn();
    } catch (err) {
      last = err;
      if (!isRetryable(err) || attempt === RETRY_DELAYS_MS.length) break;
      await sleep(RETRY_DELAYS_MS[attempt]);
    }
  }
  throw last;
}

async function mapPool(items, concurrency, worker) {
  let next = 0;
  const runners = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (next < items.length) {
      const i = next++;
      await worker(items[i], i);
    }
  });
  await Promise.all(runners);
}

async function downloadBuffer(client, bucket, name) {
  return withRetry(async () => {
    const { data, error } = await client.storage.from(bucket).download(name);
    if (error) throw error;
    return Buffer.from(await data.arrayBuffer());
  });
}

async function uploadObject({ client, url, secret }, bucket, key, buf, { mimetype, cacheControl }) {
  const strategy = uploadStrategy(cacheControl);
  const contentType = mimetype || 'application/octet-stream';
  return withRetry(async () => {
    if (strategy.kind === 'sdk') {
      const { error } = await client.storage.from(bucket).upload(key, buf, {
        contentType,
        cacheControl: strategy.cacheControl,
        upsert: true,
      });
      if (error) throw error;
      return;
    }
    const path = key.split('/').map(encodeURIComponent).join('/');
    const res = await fetch(`${url}/storage/v1/object/${bucket}/${path}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${secret}`,
        apikey: secret,
        'content-type': contentType,
        'cache-control': strategy.header,
        'x-upsert': 'true',
      },
      body: buf,
    });
    if (!res.ok) {
      const e = new Error(`raw upload failed with HTTP ${res.status}`);
      e.status = res.status;
      throw e;
    }
  });
}

async function fetchGlobalLimit(ref) {
  let token;
  try {
    token = await loadAccessToken();
  } catch {
    return null;
  }
  try {
    const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/config/storage`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return null;
    const json = await res.json();
    return json?.fileSizeLimit ?? null;
  } catch {
    return null;
  }
}

async function loadBucketMapIds(path) {
  let raw;
  try {
    raw = JSON.parse(await readFile(path, 'utf8'));
  } catch {
    throw new CliError(`bucket map not readable at ${path}; generate it first (plan 05-03 script)`, 1);
  }
  return (raw.buckets ?? []).map((b) => b.id).sort();
}

async function loadRemap(run) {
  let obj;
  try {
    obj = JSON.parse(await readFile(run.remapFile, 'utf8'));
  } catch {
    throw new CliError('remap file not readable or not JSON', 1);
  }
  return parseRemapFile(obj, { projectRef: run.targetRef, sourceRef: run.sourceRef });
}

const num = (v) => (v === null || v === undefined ? 0 : Number(v));

async function gatherState(run, args) {
  const mapIds = await loadBucketMapIds(args.bucketMap ?? DEFAULT_BUCKET_MAP);
  const remap = await loadRemap(run);
  const srcBuckets = await runSql(run.sourceRef, BUCKETS_SQL);
  const srcIds = srcBuckets.map((b) => b.id).sort();
  if (JSON.stringify(srcIds) !== JSON.stringify(mapIds)) {
    throw new CliError('bucket drift between live ziko storage.buckets and bucket map; regenerate the map first', 1);
  }
  const srcObjects = await runSql(run.sourceRef, OBJECTS_SQL);
  const violations = findMimeSizeViolations(srcObjects, srcBuckets);
  if (violations.length > 0) {
    const lines = violations.map((v) => `${v.bucket} ${v.reason}=${v.count}`).join(', ');
    throw new CliError(`source objects violate live bucket mime/size config: ${lines}`, 1);
  }
  return { remap, srcBuckets, srcObjects };
}

function planRekey(srcObjects, remap) {
  const perBucket = {};
  for (const o of srcObjects) {
    const { rekeyed } = rekeyObjectName(o.name, remap);
    const b = (perBucket[o.bucket_id] ??= { objects: 0, bytes: 0, rekeyed: 0 });
    b.objects++;
    b.bytes += num(o.size);
    if (rekeyed) b.rekeyed++;
  }
  return perBucket;
}

async function runPlan(run, args, log) {
  const { remap, srcBuckets, srcObjects } = await gatherState(run, args);
  const perBucket = planRekey(srcObjects, remap);
  const maxObjectSize = srcObjects.reduce((a, o) => Math.max(a, num(o.size)), 0);
  log(`source buckets: ${srcBuckets.length}, objects: ${srcObjects.length}, max object bytes: ${maxObjectSize}`);
  for (const b of srcBuckets) {
    const p = perBucket[b.id] ?? { objects: 0, bytes: 0, rekeyed: 0 };
    log(`  ${b.id}: objects=${p.objects} bytes=${p.bytes} rekeyed=${p.rekeyed}`);
  }
  const rawCache = srcObjects.filter((o) => uploadStrategy(o.cache_control).kind === 'raw').length;
  log(`objects needing raw cache-control upload: ${rawCache}`);

  const tgtBuckets = await runSql(run.targetRef, BUCKETS_SQL);
  const zikoTargets = tgtBuckets.filter((b) => b.id.startsWith('ziko-'));
  const diff = diffBucketConfig(srcBuckets, zikoTargets);
  log(`target ziko- buckets: ${zikoTargets.length}; missing=${diff.missing.length} mismatched=${diff.mismatched.length} extra=${diff.extraZiko.length}`);
  const tgtObjects = await runSql(run.targetRef, TARGET_OBJECTS_SQL);
  const counts = {};
  for (const o of tgtObjects) counts[o.bucket_id] = (counts[o.bucket_id] ?? 0) + 1;
  for (const [id, n] of Object.entries(counts)) log(`  target ${id}: objects=${n}`);

  const srcPol = num((await runSql(run.sourceRef, SOURCE_POLICY_COUNT_SQL))[0]?.n);
  const tgtPol = num((await runSql(run.targetRef, TARGET_POLICY_COUNT_SQL))[0]?.n);
  log(`storage policies: ziko=${srcPol} target ziko_=${tgtPol}${srcPol === tgtPol ? '' : ' (apply would refuse)'}`);

  const globalLimit = await fetchGlobalLimit(run.targetRef);
  const gl = checkGlobalLimit({ globalLimit, bucketRows: srcBuckets, maxObjectSize });
  if (gl.status === 'unknown') log('WARN global limit unknown (no PAT)');
  else log(`global storage limit: ${gl.status}${gl.reasons.length ? ` (${gl.reasons.join('; ')})` : ''}`);

  const priv = (await runSql(run.targetRef, PRIVILEGE_SQL))[0] ?? {};
  log(`policy privilege probe: current_user=${priv.current_user_name} objects_owner=${priv.objects_owner} member=${priv.is_member}`);
  if (gl.status === 'fail') throw new CliError('global storage limit too low', 1);
}

async function runApply(run, args, log) {
  const { remap, srcBuckets, srcObjects } = await gatherState(run, args);
  const maxObjectSize = srcObjects.reduce((a, o) => Math.max(a, num(o.size)), 0);

  // D-03: policies before objects
  const srcPol = num((await runSql(run.sourceRef, SOURCE_POLICY_COUNT_SQL))[0]?.n);
  const tgtPol = num((await runSql(run.targetRef, TARGET_POLICY_COUNT_SQL))[0]?.n);
  if (srcPol !== tgtPol) {
    throw new CliError(`policies must be applied before objects (ziko=${srcPol}, target ziko_=${tgtPol})`, 1);
  }

  const globalLimit = await fetchGlobalLimit(run.targetRef);
  const gl = checkGlobalLimit({ globalLimit, bucketRows: srcBuckets, maxObjectSize });
  if (gl.status === 'fail') throw new CliError(`global storage limit too low: ${gl.reasons.join('; ')}`, 1);
  if (gl.status === 'unknown') {
    const existing = await runSql(run.targetRef, BUCKETS_SQL);
    const d = diffBucketConfig(srcBuckets, existing.filter((b) => b.id.startsWith('ziko-')));
    if (d.missing.length > 0 || d.mismatched.length > 0) {
      throw new CliError('global limit unknown (no PAT) and target buckets not yet converged; refusing', 1);
    }
  }

  const [srcKeys, tgtKeys] = await Promise.all([getProjectApiKeys(run.sourceRef), getProjectApiKeys(run.targetRef)]);
  const secrets = [srcKeys.secret, tgtKeys.secret, process.env.SUPABASE_ACCESS_TOKEN];
  const safe = (s) => redactSecrets(redactPii(String(s)), secrets);
  const authOpts = { auth: { persistSession: false, autoRefreshToken: false } };
  const srcClient = createClient(`https://${run.sourceRef}.supabase.co`, srcKeys.secret, authOpts);
  const tgtUrl = `https://${run.targetRef}.supabase.co`;
  const tgtClient = createClient(tgtUrl, tgtKeys.secret, authOpts);
  const tgtCtx = { client: tgtClient, url: tgtUrl, secret: tgtKeys.secret };

  // (c) converge buckets
  for (const b of srcBuckets) {
    const id = targetBucketId(b.id);
    assertTargetBucket(id);
    const cfg = {
      public: b.public === true,
      fileSizeLimit: b.file_size_limit === null || b.file_size_limit === undefined ? undefined : Number(b.file_size_limit),
      allowedMimeTypes: Array.isArray(b.allowed_mime_types) ? b.allowed_mime_types : undefined,
    };
    const { error } = await tgtClient.storage.createBucket(id, cfg);
    if (error) {
      if (!/already exists|duplicate/i.test(error.message ?? '')) throw new Error(safe(`createBucket ${id}: ${error.message}`));
      const upd = await tgtClient.storage.updateBucket(id, cfg);
      if (upd.error) throw new Error(safe(`updateBucket ${id}: ${upd.error.message}`));
    }
  }
  const converged = await runSql(run.targetRef, BUCKETS_SQL);
  const conv = diffBucketConfig(srcBuckets, converged.filter((b) => b.id.startsWith('ziko-')));
  if (conv.missing.length > 0 || conv.mismatched.length > 0) {
    throw new CliError(`bucket convergence failed: missing=${conv.missing.length} mismatched=${conv.mismatched.length}`, 1);
  }
  log(`buckets converged: ${srcBuckets.length}`);

  // (d) copy objects
  const tgtRows = await runSql(run.targetRef, TARGET_OBJECTS_SQL);
  const tgtIndex = new Map(tgtRows.map((r) => [keyOf(r.bucket_id, r.name), r]));
  const stats = {};
  for (const b of srcBuckets) {
    stats[b.id] = { objects: 0, bytes: 0, copied: 0, changed: 0, skipped: 0, rekeyed: 0, failed: 0 };
  }
  const detail = [];
  const mapped = new Set();
  const work = srcObjects.map((o) => {
    const { key, rekeyed } = rekeyObjectName(o.name, remap);
    const tb = targetBucketId(o.bucket_id);
    assertTargetBucket(tb);
    mapped.add(keyOf(tb, key));
    return { o, key, rekeyed, tb };
  });
  let done = 0;
  await mapPool(work, run.concurrency, async ({ o, key, rekeyed, tb }) => {
    const st = stats[o.bucket_id];
    st.objects++;
    st.bytes += num(o.size);
    if (rekeyed) st.rekeyed++;
    let status = 'copied';
    try {
      const buf = await downloadBuffer(srcClient, o.bucket_id, o.name);
      const src = { size: buf.length, sha: sha256Hex(buf) };
      const row = tgtIndex.get(keyOf(tb, key));
      let dst = null;
      if (row) {
        dst = { size: num(row.size) };
        if (dst.size === src.size) dst.sha = sha256Hex(await downloadBuffer(tgtClient, tb, key));
      }
      if (decideObject({ src, dst }) === 'skip') {
        st.skipped++;
        status = 'skipped';
      } else {
        await uploadObject(tgtCtx, tb, key, buf, { mimetype: o.mimetype, cacheControl: o.cache_control });
        const back = await downloadBuffer(tgtClient, tb, key);
        if (sha256Hex(back) !== src.sha) throw new Error('sha256 mismatch after upload');
        st.copied++;
        if (dst) st.changed++;
      }
    } catch (err) {
      st.failed++;
      status = 'failed';
      console.error(`FAILED ${maskObjectKey(o.bucket_id, o.name)}: ${safe(err.message)}`);
    }
    detail.push({ key: maskObjectKey(o.bucket_id, o.name), status });
    if (++done % 100 === 0) log(`progress ${done}/${work.length}`);
  });

  // (e) destination-only scan, never removed (D-07)
  const destOnly = tgtRows.filter((r) => !mapped.has(keyOf(r.bucket_id, r.name))).length;
  log(`destination-only objects (kept, review manually): ${destOnly}`);

  // (f) report
  const cacheControlRaw = srcObjects.filter((o) => uploadStrategy(o.cache_control).kind === 'raw').length;
  const report = buildCopyReport({
    targetRef: run.targetRef,
    mode: 'apply',
    buckets: srcBuckets.map((b) => b.id),
    perBucket: stats,
    destOnly,
    cacheControlRaw,
  });
  if (args.reportOut) await writeFile(args.reportOut, `${JSON.stringify(report, null, 2)}\n`);
  const detailPath = join(__dirname, `.tmp-storage-copy-${run.targetRef}.json`);
  await writeFile(detailPath, `${JSON.stringify(detail.sort((a, b) => a.key.localeCompare(b.key)), null, 2)}\n`);
  log(`copied=${report.total_copied} failed=${report.total_failed} objects=${report.total_objects} bytes=${report.total_bytes}`);
  log('note: created_at is reset on copied objects (scan-photos cleanup clock restarts)');
  if (report.total_failed > 0) throw new CliError(`${report.total_failed} object(s) failed`, 1);
}

async function execute(run, args, log) {
  if (run.mode === 'plan') await runPlan(run, args, log);
  else await runApply(run, args, log);
  return 0;
}

if (isMain(import.meta.url)) {
  main(process.argv.slice(2)).then((code) => process.exit(code));
}
