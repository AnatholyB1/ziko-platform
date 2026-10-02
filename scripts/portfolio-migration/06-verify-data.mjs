#!/usr/bin/env node
/**
 * Phase 4 data verification suite (D-09, DATA-05): one re-runnable, credential-free CLI.
 *
 * Usage:
 *   node scripts/portfolio-migration/06-verify-data.mjs --project-ref <scratch|portfolio>
 *        --source-ref <ziko> --check counts|rls|triggers|fk|orphans|sequence|remap|tenants|all
 *        [--remap-file <path>] [--baseline <file>] [--json-out <path>]
 *   node scripts/portfolio-migration/06-verify-data.mjs --project-ref <ref> --snapshot-tenants --out <file>
 *
 * Read-only except VALIDATE CONSTRAINT on ziko_ tables of the target (fk check).
 * Queries go through the logged-in Supabase CLI (runSql): no PAT or DB password needed.
 * Output is limited to table names, constraint names, counts, booleans and masked UUIDs.
 * Exit codes: 0 all passed; 1 a check failed; 2 bad arguments.
 */

import { readFile, writeFile } from 'node:fs/promises';
import { PROJECTS, parseCliArgs, requireRef, runSql, redactPii, isMain } from '../auth-merge/lib.mjs';
import { loadRenameMap, buildTablePlan, parseRemapFile } from './lib-data.mjs';
import {
  CHECK_NAMES,
  FK_TO_AUTH_USERS_SQL,
  FK_LIST_SQL,
  RLS_SQL,
  TRIGGER_STATE_SQL,
  AUTH_USERS_TRIGGER_STATE_SQL,
  SEQUENCE_LIST_SQL,
  OWNED_SEQUENCE_COLUMNS_SQL,
  TENANT_TABLES_SQL,
  SEQUENCE_CONSUMERS,
  buildCountsSql,
  buildOrphanSql,
  buildValidateConstraintSql,
  buildSequenceStateSql,
  buildConsumerMaxSql,
  mapSequenceName,
  buildUuidOccurrenceSql,
  buildTenantCountsSql,
  evaluateCounts,
  evaluateRls,
  evaluateTriggers,
  evaluateFks,
  evaluateOrphans,
  evaluateSequences,
  evaluateRemap,
  evaluateTenants,
  assertReportSafe,
} from './lib-verify.mjs';

const ALL_CHECKS = [...CHECK_NAMES, 'all'];
const NEEDS_SOURCE = new Set(['counts', 'sequence', 'remap', 'all']);
const NEEDS_REMAP = new Set(['remap', 'all']);
const BASE_ALL = ['counts', 'rls', 'triggers', 'fk', 'orphans', 'sequence', 'remap'];
const FULL_UUID_G = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;

const HELP = `06-verify-data.mjs - Phase 4 data verification suite

Required:
  --project-ref <ref>   Target project (scratch or portfolio; ziko is refused).
  --check <name>        counts|rls|triggers|fk|orphans|sequence|remap|tenants|all
Conditional:
  --source-ref <ref>    ziko ref; required for counts/sequence/remap/all.
  --remap-file <path>   uuid-remap.json; required for remap/all.
  --baseline <file>     Tenant snapshot; required for tenants, and for all on portfolio.
Optional:
  --json-out <path>     Write a PII-free JSON report.
  --snapshot-tenants --out <file>   Write a tenant snapshot (read-only) and exit.
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
  if (NEEDS_REMAP.has(check) && !remapFile) throw new UsageError('--remap-file is required for remap/all');
  if (check === 'tenants' && !baseline) throw new UsageError('--baseline is required for tenants');
  if (check === 'all' && projectRef === PROJECTS.portfolio && !baseline) {
    throw new UsageError('--baseline is required for --check all on portfolio');
  }
  if (check === 'all') return baseline ? [...BASE_ALL, 'tenants'] : [...BASE_ALL];
  return [check];
}

/** JSON report; throws if it would contain an email or a full UUID. */
export function buildJsonReport({ targetRef, sourceRef, results }) {
  const checks = {};
  let passed = true;
  for (const [name, r] of Object.entries(results)) {
    checks[name] = { ok: r.ok === true, detail: r.detail, data: r.data ?? null };
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

const ok = (detail, data) => ({ ok: true, detail, data });
const fail = (detail, data) => ({ ok: false, detail, data });

function safeText(text) {
  return redactPii(String(text ?? '')).replace(FULL_UUID_G, (u) => `${u.slice(0, 8)}-…`).slice(0, 400);
}

// ---------------------------------------------------------------- data access

async function getPlan() {
  return buildTablePlan(await loadRenameMap());
}

async function tenantData(target) {
  const names = (await runSql(target, TENANT_TABLES_SQL)).map((r) => r.tbl);
  const tables = (await runSql(target, buildTenantCountsSql(names))).map((r) => ({ tbl: r.tbl, n: String(r.n) }));
  const authTriggers = (await runSql(target, AUTH_USERS_TRIGGER_STATE_SQL)).map((r) => ({
    tgname: r.tgname,
    tgenabled: r.tgenabled,
  }));
  const authUsers = String(tables.find((t) => t.tbl === 'auth.users')?.n ?? 0);
  return { tables: tables.filter((t) => t.tbl !== 'auth.users'), authUsers, authTriggers };
}

// ---------------------------------------------------------------- checks

async function checkCounts(ctx) {
  const plan = await getPlan();
  const src = await runSql(ctx.source, buildCountsSql(plan, 'source'));
  const tgt = await runSql(ctx.target, buildCountsSql(plan, 'target'));
  return evaluateCounts(plan, src, tgt);
}

async function checkRls(ctx) {
  return evaluateRls(await getPlan(), await runSql(ctx.target, RLS_SQL));
}

async function checkTriggers(ctx) {
  const rows = await runSql(ctx.target, TRIGGER_STATE_SQL);
  const authRows = await runSql(ctx.target, AUTH_USERS_TRIGGER_STATE_SQL);
  const r = evaluateTriggers(rows);
  const zikoAuth = authRows.filter((t) => String(t.tgname).startsWith('ziko_'));
  const authNotOn = zikoAuth.filter((t) => t.tgenabled !== 'O');
  const good = r.ok && authNotOn.length === 0;
  return {
    ok: good,
    detail: `${r.detail}; ${zikoAuth.length} ziko_ triggers on auth.users, ${authNotOn.length} not enabled; ${rows.length} ziko_ table triggers`,
    data: { ...r.data, zikoAuthTriggers: zikoAuth.length, zikoAuthNotEnabled: authNotOn.length },
  };
}

async function loadFks(target) {
  const fkRows = await runSql(target, FK_LIST_SQL);
  const authFkRows = await runSql(target, FK_TO_AUTH_USERS_SQL);
  return { fkRows, authFkRows };
}

async function checkFk(ctx) {
  const { fkRows, authFkRows } = await loadFks(ctx.target);
  const r = evaluateFks({ fkRows, authFkRows });
  if (fkRows.length === 0) return r;
  const stmts = fkRows.map((fk) => `${buildValidateConstraintSql(fk)};`).join('\n');
  let validated = null;
  try {
    const rows = await runSql(ctx.target, `${stmts}\nSELECT ${fkRows.length}::int AS validated`);
    validated = Number(rows[0]?.validated);
  } catch (err) {
    return fail(`${r.detail}; VALIDATE CONSTRAINT failed: ${safeText(err.message)}`, { ...r.data, validateFailed: true });
  }
  return {
    ok: r.ok && validated === fkRows.length,
    detail: `${r.detail}; ${validated} validated`,
    data: { ...r.data, validated },
  };
}

async function checkOrphans(ctx) {
  const { fkRows } = await loadFks(ctx.target);
  if (fkRows.length === 0) return fail('FK discovery returned 0 constraints', { checked: 0 });
  const sql = fkRows.map((fk) => buildOrphanSql(fk)).join('\nUNION ALL\n');
  return evaluateOrphans(await runSql(ctx.target, sql));
}

async function checkSequence(ctx) {
  const srcSeqs = (await runSql(ctx.source, SEQUENCE_LIST_SQL)).map((r) => r.sequencename);
  const pairs = [];
  for (const name of srcSeqs) {
    const target = mapSequenceName(name);
    const sourceState = (await runSql(ctx.source, buildSequenceStateSql(name, 'source')))[0];
    let targetState = null;
    try {
      targetState = (await runSql(ctx.target, buildSequenceStateSql(target, 'target')))[0] ?? null;
    } catch {
      targetState = null;
    }
    const pair = { source: name, target, sourceState, targetState };
    const consumer = SEQUENCE_CONSUMERS.find((c) => c.sequence === target);
    if (consumer && targetState) {
      pair.consumerMax = (await runSql(ctx.target, buildConsumerMaxSql(consumer)))[0]?.m ?? 0;
    }
    pairs.push(pair);
  }
  const ownedRaw = await runSql(ctx.target, OWNED_SEQUENCE_COLUMNS_SQL);
  const ownedColumns = [];
  for (const o of ownedRaw) {
    const m = (await runSql(ctx.target, buildConsumerMaxSql({ table: o.table, column: o.column })))[0]?.m ?? 0;
    ownedColumns.push({ sequence: o.sequence, table: o.table, column: o.column, tableMax: m });
  }
  return evaluateSequences({ pairs, ownedColumns });
}

/** Source-side variant of buildUuidOccurrenceSql: source tables carry no ziko_ prefix. */
export function buildSourceUuidOccurrenceSql(names, uuid) {
  if (typeof uuid !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(uuid)) {
    throw new Error('invalid uuid literal');
  }
  if (!Array.isArray(names) || names.length === 0) throw new Error('no tables');
  return names
    .map((n) => {
      if (typeof n !== 'string' || !/^[a-z][a-z0-9_]*$/.test(n)) throw new Error('invalid source table name');
      return `SELECT '${n}' AS tbl, count(*)::bigint AS n FROM public."${n}" t WHERE t::text ILIKE '%${uuid}%'`;
    })
    .join('\nUNION ALL\n');
}

async function checkRemap(ctx) {
  const { sourceUuid, targetUuid } = parseRemapFile(JSON.parse(await readFile(ctx.args.remapFile, 'utf8')), {
    projectRef: ctx.target,
    sourceRef: ctx.source,
  });
  const plan = await getPlan();
  const toTarget = new Map(plan.map((p) => [p.source, p.target]));
  const srcRows = await runSql(ctx.source, buildSourceUuidOccurrenceSql(plan.map((p) => p.source), sourceUuid));
  const sourceSourceOcc = srcRows.map((r) => ({ tbl: toTarget.get(r.tbl) ?? r.tbl, n: r.n }));
  const targetNames = plan.map((p) => p.target);
  const targetSourceOcc = await runSql(ctx.target, buildUuidOccurrenceSql(targetNames, sourceUuid));
  const targetTargetOcc = await runSql(ctx.target, buildUuidOccurrenceSql(targetNames, targetUuid));
  return evaluateRemap({ targetSourceOcc, targetTargetOcc, sourceSourceOcc });
}

async function checkTenants(ctx) {
  const baseline = JSON.parse(await readFile(ctx.args.baseline, 'utf8'));
  const current = await tenantData(ctx.target);
  return evaluateTenants(baseline, current);
}

const RUNNERS = {
  counts: checkCounts,
  rls: checkRls,
  triggers: checkTriggers,
  fk: checkFk,
  orphans: checkOrphans,
  sequence: checkSequence,
  remap: checkRemap,
  tenants: checkTenants,
};

// ---------------------------------------------------------------- main

async function snapshotTenants(target, out) {
  const snap = await tenantData(target);
  const doc = { generated_at: new Date().toISOString(), target_ref: target, ...snap };
  assertReportSafe(doc);
  await writeFile(out, `${JSON.stringify(doc, null, 2)}\n`, 'utf8');
  console.log(`tenant snapshot written: ${snap.tables.length} tables, auth.users=${snap.authUsers}, auth triggers=${snap.authTriggers.length}`);
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
    const ctx = { args, source: args.sourceRef ?? null, target };
    const results = {};
    let allOk = true;
    for (const name of names) {
      let r;
      try {
        r = await RUNNERS[name](ctx);
      } catch (err) {
        r = fail(`error: ${safeText(err.message)}`, null);
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
