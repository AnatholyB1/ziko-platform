#!/usr/bin/env node
/**
 * Phase 5 storage verification suite (D-09): one re-runnable, read-only CLI.
 *
 * Usage:
 *   node scripts/portfolio-migration/09-verify-storage.mjs --project-ref <scratch|portfolio>
 *        --source-ref <ziko> --check buckets|policies|objects|hashes|rekey|urls|tenants|all
 *        [--remap-file <path>] [--baseline <file>] [--json-out <path>]
 *   node scripts/portfolio-migration/09-verify-storage.mjs --project-ref <ref> --snapshot-tenants --out <file>
 */

import { PROJECTS, parseCliArgs, requireRef, isMain } from '../auth-merge/lib.mjs';
import { assertReportSafe } from './lib-verify.mjs';

export const CHECKS = ['buckets', 'policies', 'objects', 'hashes', 'rekey', 'urls', 'tenants'];
const ALL_CHECKS = [...CHECKS, 'all'];
const NEEDS_SOURCE = new Set(['buckets', 'policies', 'objects', 'hashes', 'rekey', 'urls', 'all']);
const NEEDS_REMAP = new Set(['objects', 'hashes', 'rekey', 'all']);
const BASE_ALL = CHECKS.filter((c) => c !== 'tenants');

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
    resolveChecks(args);
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
    console.error(`ERROR: ${String(err.message).slice(0, 400)}`);
    process.exit(1);
  });
}
