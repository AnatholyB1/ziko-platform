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

async function execute() {
  throw new CliError('not implemented', 1);
}

if (isMain(import.meta.url)) {
  main(process.argv.slice(2)).then((code) => process.exit(code));
}

// referenced by the live I/O layer
void [readFile, writeFile, createClient, loadAccessToken, runSql, getProjectApiKeys, parseRemapFile];
void [assertTargetBucket, rekeyObjectName, findMimeSizeViolations, diffBucketConfig, sha256Hex, maskObjectKey];
void DEFAULT_BUCKET_MAP;
