#!/usr/bin/env node
/**
 * Phase 5 storage verification suite (D-09): one re-runnable, read-only CLI.
 *
 * Usage:
 *   node scripts/portfolio-migration/09-verify-storage.mjs --project-ref <scratch|portfolio>
 *        --source-ref <ziko> --check buckets|policies|objects|hashes|rekey|urls|tenants|all
 *        [--remap-file <path>] [--baseline <file>] [--json-out <path>]
 *   node scripts/portfolio-migration/09-verify-storage.mjs --project-ref <ref> --snapshot-tenants --out <file>
 *
 * Read-only: SELECT queries through the logged-in Supabase CLI (runSql) and Storage object
 * downloads with the service-role key held in memory. Output is limited to bucket ids, policy
 * names, counts, booleans, masked UUIDs and hashed object keys (never object names).
 * Exit codes: 0 all passed; 1 a check failed; 2 bad arguments.
 */

import { readFile, writeFile } from 'node:fs/promises';
import { PROJECTS, parseCliArgs, requireRef, runSql, redactPii, isMain, getProjectApiKeys } from '../auth-merge/lib.mjs';
import { assertReportSafe } from './lib-verify.mjs';
import { loadRenameMap, buildTablePlan, parseRemapFile, IDENT_RE } from './lib-data.mjs';
import {
  maskUuid,
  maskObjectKey,
  sha256Hex,
  targetBucketId,
  rekeyObjectName,
  diffBucketConfig,
  rewritePolicy,
  findStalePolicyRefs,
  evaluatePolicies,
  evaluateObjects,
  evaluateHashes,
  evaluateRekey,
  evaluateStorageTenants,
  buildUrlScanSql,
} from './lib-storage.mjs';

export const CHECKS = ['buckets', 'policies', 'objects', 'hashes', 'rekey', 'urls', 'tenants'];
const ALL_CHECKS = [...CHECKS, 'all'];
const NEEDS_SOURCE = new Set(['buckets', 'policies', 'objects', 'hashes', 'rekey', 'urls', 'all']);
const NEEDS_REMAP = new Set(['objects', 'hashes', 'rekey', 'all']);
const BASE_ALL = CHECKS.filter((c) => c !== 'tenants');
const FULL_UUID_G = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;
const HASH_CONCURRENCY = 4;
const DOWNLOAD_ATTEMPTS = 3;

const HELP = `09-verify-storage.mjs - Phase 5 storage verification suite (read-only)

Required:
  --project-ref <ref>   Target project (scratch or portfolio; ziko is refused).
  --check <name>        buckets|policies|objects|hashes|rekey|urls|tenants|all
Conditional:
  --source-ref <ref>    ziko ref; required for every check except tenants.
  --remap-file <path>   uuid-remap.json; required for objects/hashes/rekey/all.
  --baseline <file>     Storage tenant snapshot; required for tenants, and for all on portfolio.
Optional:
  --json-out <path>     Write a PII-free JSON report.
  --snapshot-tenants --out <file>   Write a storage tenant snapshot (read-only) and exit.
  --help, -h            Show this help.

Exit codes: 0 pass; 1 a check failed; 2 bad arguments.
`;

export class UsageError extends Error {}

/** Ordered list of checks to run; throws UsageError on invalid argument combinations. */
export function resolveChecks(args) {
  const { projectRef, sourceRef, check, remapFile, baseline } = args ?? {};
  if (!projectRef) throw new UsageError('--project-ref is required');
  if (projectRef === PROJECTS.ziko) throw new UsageError('ziko is the source and is never a verification target');
  if (!ALL_CHECKS.includes(check)) throw new UsageError(`--check must be one of ${ALL_CHECKS.join('|')}`);
  if (NEEDS_SOURCE.has(check) || sourceRef) {
    if (sourceRef !== PROJECTS.ziko) throw new UsageError('--source-ref must be the ziko project ref');
  }
  if (NEEDS_REMAP.has(check) && !remapFile) throw new UsageError('--remap-file is required for objects/hashes/rekey/all');
  if (check === 'tenants' && !baseline) throw new UsageError('--baseline is required for tenants');
  if (check === 'all' && projectRef === PROJECTS.portfolio && !baseline) {
    throw new UsageError('--baseline is required for --check all on portfolio');
  }
  if (check === 'all') return baseline ? [...BASE_ALL, 'tenants'] : [...BASE_ALL];
  return [check];
}

/** JSON report (ok/detail/warnings per check); throws if it would contain an email or a full UUID. */
export function buildJsonReport({ targetRef, sourceRef, results }) {
  const checks = {};
  let passed = true;
  for (const [name, r] of Object.entries(results)) {
    checks[name] = { ok: r.ok === true, detail: r.detail, warnings: r.warnings ?? [] };
    if (r.ok !== true) passed = false;
  }
  const report = {
    generated_at: new Date().toISOString(),
    target_ref: targetRef,
    source_ref: sourceRef ?? null,
    passed,
    checks,
  };
  assertReportSafe(report);
  return report;
}

const ok = (detail, extra = {}) => ({ ok: true, detail, ...extra });
const fail = (detail, extra = {}) => ({ ok: false, detail, ...extra });

function safeText(text) {
  return redactPii(String(text ?? '')).replace(FULL_UUID_G, (u) => maskUuid(u)).slice(0, 400);
}

// ---------------------------------------------------------------- SQL (SELECT only)

const BUCKETS_SQL = 'SELECT id, public, file_size_limit, allowed_mime_types FROM storage.buckets ORDER BY id';
const OBJECTS_SQL = `SELECT bucket_id, name,
  coalesce((metadata->>'size')::bigint, 0)::bigint AS size,
  metadata->>'mimetype' AS mimetype,
  metadata->>'cacheControl' AS "cacheControl"
FROM storage.objects ORDER BY bucket_id, name`;
const POLICIES_SQL = `SELECT policyname, cmd, roles, permissive, qual, with_check
FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' ORDER BY policyname`;
const TENANT_BUCKETS_SQL = `SELECT b.id, b.public, b.file_size_limit, b.allowed_mime_types,
  (SELECT count(*) FROM storage.objects o WHERE o.bucket_id = b.id)::bigint AS objects,
  (SELECT coalesce(sum((o.metadata->>'size')::bigint), 0) FROM storage.objects o WHERE o.bucket_id = b.id)::bigint AS bytes
FROM storage.buckets b WHERE b.id NOT LIKE 'ziko-%' ORDER BY b.id`;
const TENANT_POLICIES_SQL = `SELECT policyname AS name, cmd, roles,
  md5(regexp_replace(coalesce(qual, '') || '|' || coalesce(with_check, ''), '\\s+', ' ', 'g')) AS hash
FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname NOT LIKE 'ziko\\_%' ORDER BY policyname`;

function policyRow(r) {
  return { name: r.policyname, cmd: r.cmd, roles: r.roles, permissive: r.permissive, qual: r.qual, with_check: r.with_check };
}

/** { oldName: newName } from the rename map "name(args)" keys. */
function deriveFunctionRenames(map) {
  const out = {};
  for (const [oldSig, newSig] of Object.entries(map.functions ?? {})) {
    const o = oldSig.slice(0, oldSig.indexOf('('));
    const n = newSig.slice(0, newSig.indexOf('('));
    if (IDENT_RE.test(o) && IDENT_RE.test(n)) out[o] = n;
  }
  return out;
}

async function loadRemap(ctx) {
  return parseRemapFile(JSON.parse(await readFile(ctx.args.remapFile, 'utf8')), {
    projectRef: ctx.target,
    sourceRef: ctx.source,
  });
}

function toObjects(rows) {
  return rows.map((r) => ({
    bucket_id: r.bucket_id,
    name: r.name,
    size: Number(r.size),
    mimetype: r.mimetype ?? null,
    cacheControl: r.cacheControl ?? null,
  }));
}

async function loadObjectLists(ctx) {
  const source = toObjects(await runSql(ctx.source, OBJECTS_SQL));
  const target = toObjects(await runSql(ctx.target, OBJECTS_SQL)).filter((o) => o.bucket_id.startsWith('ziko-'));
  return { source, target };
}

async function tenantData(target) {
  const buckets = (await runSql(target, TENANT_BUCKETS_SQL)).map((b) => ({
    id: b.id,
    public: b.public === true,
    file_size_limit: b.file_size_limit ?? null,
    allowed_mime_types: b.allowed_mime_types ?? null,
    objects: Number(b.objects),
    bytes: Number(b.bytes ?? 0),
  }));
  const policies = (await runSql(target, TENANT_POLICIES_SQL)).map((p) => ({
    name: p.name,
    cmd: p.cmd,
    roles: p.roles,
    hash: p.hash,
  }));
  return { buckets, policies };
}

// ---------------------------------------------------------------- checks

async function checkBuckets(ctx) {
  const src = await runSql(ctx.source, BUCKETS_SQL);
  const tgt = (await runSql(ctx.target, BUCKETS_SQL)).filter((b) => b.id.startsWith('ziko-'));
  const d = diffBucketConfig(src, tgt);
  const detail = `${src.length} source buckets, ${tgt.length} ziko- buckets on target; missing ${d.missing.length}, config mismatches ${d.mismatched.length}, target-only ${d.extraZiko.length}`;
  if (d.ok) return ok(detail);
  return fail(detail, {
    warnings: [
      ...d.missing.map((id) => `missing: ziko-${id}`),
      ...d.mismatched.map((m) => `${m.id}: ${m.field} differs`),
      ...d.extraZiko.map((id) => `target-only: ziko-${id}`),
    ],
  });
}

async function checkPolicies(ctx) {
  const renames = deriveFunctionRenames(await loadRenameMap());
  const bucketIds = (await runSql(ctx.source, BUCKETS_SQL)).map((b) => b.id);
  const srcPolicies = await runSql(ctx.source, POLICIES_SQL);
  const expected = srcPolicies.map((r) => rewritePolicy(r, { bucketIds, functionRenames: renames }));
  const tgtAll = (await runSql(ctx.target, POLICIES_SQL)).map(policyRow);
  const actual = tgtAll.filter((p) => p.name.startsWith('ziko_'));
  const other = tgtAll.filter((p) => !p.name.startsWith('ziko_'));
  let baselineOther = other;
  let baseline = null;
  if (ctx.args.baseline) {
    baseline = JSON.parse(await readFile(ctx.args.baseline, 'utf8'));
    baselineOther = (baseline.policies ?? []).filter((p) => !String(p.name).startsWith('ziko_'));
  }
  const r = evaluatePolicies({ expected, actual, baselineOther, currentOther: other });
  const stale = findStalePolicyRefs(actual, { bucketIds, functionNames: Object.keys(renames) });
  const problems = [];
  if (actual.length !== srcPolicies.length) problems.push(`count ${actual.length} != ${srcPolicies.length}`);
  if (stale.length) problems.push(`${stale.length} policies with stale references`);
  if (baseline) {
    const now = (await tenantData(ctx.target)).policies;
    const t = evaluateStorageTenants({ buckets: [], policies: baseline.policies ?? [] }, { buckets: [], policies: now });
    if (!t.ok) problems.push(`non-ziko policy baseline: ${t.failures.length} differences`);
  }
  const good = r.ok && problems.length === 0;
  return {
    ok: good,
    detail: `${r.detail}; ${actual.length} ziko_ policies on target (live ziko ${srcPolicies.length}), ${stale.length} stale${problems.length ? `; ${problems.join('; ')}` : ''}`,
    warnings: good
      ? []
      : [
          ...r.missing.map((n) => `missing: ${n}`),
          ...r.mismatched.map((n) => `mismatched: ${n}`),
          ...r.unexpected.map((n) => `unexpected: ${n}`),
          ...r.otherChanged.map((n) => `other-changed: ${n}`),
          ...stale.map((n) => `stale reference: ${n}`),
        ],
  };
}

async function checkObjects(ctx) {
  const remap = await loadRemap(ctx);
  const { source, target } = await loadObjectLists(ctx);
  const r = evaluateObjects({ source, target, remap });
  const perBucket = Object.entries(r.perBucket).sort(([a], [b]) => a.localeCompare(b));
  const buckets = perBucket
    .map(([id, s]) => `${id}: n=${s.targetCount} bytes=${s.targetBytes}${s.sourceCount !== s.targetCount || s.sourceBytes !== s.targetBytes ? ` (source n=${s.sourceCount} bytes=${s.sourceBytes})` : ''}`)
    .join(', ');
  const t = perBucket.reduce(
    (a, [, s]) => ({ sc: a.sc + s.sourceCount, sb: a.sb + s.sourceBytes, tc: a.tc + s.targetCount, tb: a.tb + s.targetBytes }),
    { sc: 0, sb: 0, tc: 0, tb: 0 },
  );
  const parity = t.sc === t.tc && t.sb === t.tb && perBucket.every(([, s]) => s.sourceCount === s.targetCount && s.sourceBytes === s.targetBytes);
  return {
    ok: r.ok && parity,
    detail: `source ${t.sc} objects/${t.sb} bytes, target ${t.tc} objects/${t.tb} bytes; missing ${r.missing}, size mismatch ${r.sizeMismatch}, content-type mismatch ${r.mimeMismatch}, destination-only ${r.destOnly}; ${buckets || 'no buckets'}`,
    warnings: r.cacheControlMismatch ? [`cache-control differs on ${r.cacheControlMismatch} objects`] : [],
  };
}

async function downloadSha(baseUrl, key, bucket, name) {
  const path = `${encodeURIComponent(bucket)}/${name.split('/').map(encodeURIComponent).join('/')}`;
  for (let attempt = 1; attempt <= DOWNLOAD_ATTEMPTS; attempt += 1) {
    try {
      const res = await fetch(`${baseUrl}/storage/v1/object/${path}`, { headers: { Authorization: `Bearer ${key}`, apikey: key } });
      if (res.ok) return sha256Hex(Buffer.from(await res.arrayBuffer()));
      if (res.status === 404) return null;
    } catch {
      /* retry */
    }
    await new Promise((r) => setTimeout(r, 250 * attempt));
  }
  return null;
}

async function mapPool(items, worker, size) {
  const out = new Array(items.length);
  let next = 0;
  const pool = Array.from({ length: Math.min(size, items.length) }, async () => {
    while (next < items.length) {
      const i = next;
      next += 1;
      out[i] = await worker(items[i]);
    }
  });
  await Promise.all(pool);
  return out;
}

async function checkHashes(ctx) {
  const remap = await loadRemap(ctx);
  const srcBuckets = await runSql(ctx.source, BUCKETS_SQL);
  const source = toObjects(await runSql(ctx.source, OBJECTS_SQL));
  const used = new Set(source.map((o) => o.bucket_id));
  const empty = srcBuckets.map((b) => b.id).filter((id) => !used.has(id));
  const srcKey = (await getProjectApiKeys(ctx.source)).secret;
  const dstKey = (await getProjectApiKeys(ctx.target)).secret;
  const srcUrl = `https://${ctx.source}.supabase.co`;
  const dstUrl = `https://${ctx.target}.supabase.co`;
  const failures = [];
  const pairs = await mapPool(
    source,
    async (o) => {
      const dstName = rekeyObjectName(o.name, remap).key;
      const dstBucket = targetBucketId(o.bucket_id);
      const srcSha = await downloadSha(srcUrl, srcKey, o.bucket_id, o.name);
      const dstSha = await downloadSha(dstUrl, dstKey, dstBucket, dstName);
      if (!srcSha || !dstSha || srcSha !== dstSha) failures.push(maskObjectKey(o.bucket_id, o.name));
      return { srcSha, dstSha };
    },
    HASH_CONCURRENCY,
  );
  const r = evaluateHashes(pairs);
  return {
    ok: r.ok,
    detail: `${r.compared} objects hashed on both sides (no sampling), ${r.mismatched} mismatched; empty buckets (compared=0): ${empty.join(', ') || 'none'}`,
    warnings: r.ok ? [] : failures.slice(0, 50).map((m) => `hash mismatch: ${m}`),
  };
}

async function checkRekey(ctx) {
  const remap = await loadRemap(ctx);
  const { source, target } = await loadObjectLists(ctx);
  const r = evaluateRekey({ source, target, remap });
  return {
    ok: r.ok,
    detail: `${maskUuid(remap.sourceUuid)} -> ${maskUuid(remap.targetUuid)}: ${r.sourceUuidObjects} source objects, ${r.targetUuidObjects} found re-keyed on target, ${r.leftoverSourceKeys} target keys still under the source uuid`,
  };
}

function buildSourceUrlScanSql(tables, { ref, buckets }) {
  const alt = buckets.map((b) => b.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
  const pattern = `${ref}\\.supabase\\.co/storage/v1/(object|render/image)/(public|sign|authenticated)/(${alt})/`;
  return tables
    .map((t) => {
      if (!IDENT_RE.test(t)) throw new Error('invalid source table name');
      return `SELECT '${t}' AS tbl, count(*)::bigint AS n FROM public."${t}" r WHERE r::text ~ '${pattern}'`;
    })
    .join('\nUNION ALL\n');
}

async function checkUrls(ctx) {
  const plan = buildTablePlan(await loadRenameMap());
  const buckets = (await runSql(ctx.source, BUCKETS_SQL)).map((b) => b.id);
  const targets = plan.map((p) => p.target);
  const leftover = await runSql(ctx.target, buildUrlScanSql(targets, { ref: ctx.source, buckets, mode: 'leftover' }));
  const leftTables = leftover.filter((r) => Number(r.n) > 0);
  const rewritten = await runSql(ctx.target, buildUrlScanSql(targets, { ref: ctx.target, buckets, mode: 'rewritten' }));
  const srcRows = await runSql(ctx.source, buildSourceUrlScanSql(plan.map((p) => p.source), { ref: ctx.source, buckets }));
  const toTarget = new Map(plan.map((p) => [p.source, p.target]));
  const srcCount = new Map(srcRows.map((r) => [toTarget.get(r.tbl), Number(r.n)]));
  const tgtCount = new Map(rewritten.map((r) => [r.tbl, Number(r.n)]));
  const unequal = targets.filter((t) => (srcCount.get(t) ?? 0) !== (tgtCount.get(t) ?? 0));
  const sum = (m) => [...m.values()].reduce((a, b) => a + b, 0);
  const good = leftTables.length === 0 && unequal.length === 0;
  return {
    ok: good,
    detail: `${targets.length} tables scanned; ${leftTables.length} tables with leftover ziko/bare-bucket URLs; rewritten URL rows source ${sum(srcCount)} vs target ${sum(tgtCount)}; ${unequal.length} tables unequal`,
    warnings: good
      ? []
      : [
          ...leftTables.map((r) => `leftover: ${r.tbl} (${r.n})`),
          ...unequal.map((t) => `count differs: ${t} (source ${srcCount.get(t) ?? 0}, target ${tgtCount.get(t) ?? 0})`),
        ],
  };
}

async function checkTenants(ctx) {
  const baseline = JSON.parse(await readFile(ctx.args.baseline, 'utf8'));
  const current = await tenantData(ctx.target);
  const r = evaluateStorageTenants(baseline, current);
  return {
    ok: r.ok,
    detail: `${current.buckets.length} non-ziko buckets, ${current.policies.length} non-ziko storage policies vs baseline; ${r.failures.length} regressions`,
    warnings: [...r.failures, ...r.warnings],
  };
}

const RUNNERS = {
  buckets: checkBuckets,
  policies: checkPolicies,
  objects: checkObjects,
  hashes: checkHashes,
  rekey: checkRekey,
  urls: checkUrls,
  tenants: checkTenants,
};

// ---------------------------------------------------------------- main

async function snapshotTenants(target, out) {
  const snap = await tenantData(target);
  const doc = { generated_at: new Date().toISOString(), target_ref: target, ...snap };
  assertReportSafe(doc);
  await writeFile(out, `${JSON.stringify(doc, null, 2)}\n`, 'utf8');
  console.log(`storage tenant snapshot written: ${snap.buckets.length} non-ziko buckets, ${snap.policies.length} non-ziko policies`);
}

async function main() {
  const args = parseCliArgs(process.argv.slice(2), {
    'project-ref': 'string',
    'source-ref': 'string',
    check: 'string',
    'remap-file': 'string',
    baseline: 'string',
    'json-out': 'string',
    'snapshot-tenants': 'boolean',
    out: 'string',
  });
  if (args.help) {
    console.log(HELP);
    return;
  }
  const target = requireRef(args, 'projectRef');
  try {
    if (args.snapshotTenants) {
      if (target === PROJECTS.ziko) throw new UsageError('ziko is never a verification target');
      if (!args.out) throw new UsageError('--out <file> is required with --snapshot-tenants');
      await snapshotTenants(target, args.out);
      return;
    }
    const names = resolveChecks(args);
    if (args.check === 'all' && !args.baseline) {
      console.log('[WARN] no --baseline: tenants check skipped (required on portfolio)');
    }
    const ctx = { args, source: args.sourceRef ?? null, target };
    const results = {};
    let allOk = true;
    for (const name of names) {
      let r;
      try {
        r = await RUNNERS[name](ctx);
      } catch (err) {
        r = fail(`error: ${safeText(err.message)}`);
      }
      results[name] = r;
      console.log(`[${r.ok ? 'PASS' : 'FAIL'}] ${name}: ${safeText(r.detail)}`);
      for (const w of r.warnings ?? []) console.log(`  [WARN] ${safeText(w)}`);
      if (!r.ok) allOk = false;
    }
    if (args.jsonOut) {
      const report = buildJsonReport({ targetRef: target, sourceRef: ctx.source, results });
      await writeFile(args.jsonOut, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
    }
    console.log(allOk ? 'VERIFICATION PASSED' : 'VERIFICATION FAILED');
    process.exit(allOk ? 0 : 1);
  } catch (err) {
    if (err instanceof UsageError) {
      console.error(`ERROR: ${err.message}`);
      process.exit(2);
    }
    throw err;
  }
}

if (isMain(import.meta.url)) {
  main().catch((err) => {
    console.error(`ERROR: ${safeText(err.message)}`);
    process.exit(1);
  });
}
