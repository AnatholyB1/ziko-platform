#!/usr/bin/env node
/**
 * Phase 4 data loader: copy ziko public.* data into the ziko_* tables of a target project
 * (scratch rehearsal, or portfolio for the real run; reusable unchanged for the Phase 6 final reload).
 *
 * Usage:
 *   node scripts/portfolio-migration/05-load-data.mjs --source-ref slkobhavpwsubnsmuhya \
 *     --project-ref <scratch|portfolio> --remap-file <path> [--confirm-ref <ref>] \
 *     [--plan | --probe | --apply] [--trigger-mode auto|replica|disable-trigger] \
 *     [--ca-file <path>] [--report-out <path>]
 *
 * Modes (exactly one; default --plan):
 *   --plan   read-only, via `supabase db query` (no credentials): counts, column parity, FK guard, UUID occurrences
 *   --probe  login roles on both sides; reports RLS bypass, replica-role capability, TRUNCATE privilege; never commits
 *   --apply  guarded TRUNCATE of the 99 ziko_ tables, then one transaction per table (COPY with in-flight UUID
 *            remap), setval reconciliation, trigger-state assertion, PII-safe report
 *
 * Exit codes: 0 ok; 1 failure (any guard, probe, count or trigger assertion); 2 bad arguments.
 * Output: table names, counts, booleans and masked UUIDs only. Never row content, never full UUIDs.
 */

import { readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { pipeline } from 'node:stream/promises';
import copyStreams from 'pg-copy-streams';
import {
  PROJECTS,
  parseCliArgs,
  assertProjectRefFormat,
  assertWriteAllowed,
  runSql,
  loadAccessToken,
  redactPii,
  isMain,
} from '../auth-merge/lib.mjs';
import {
  IDENT_RE,
  UUID_RE,
  loadRenameMap,
  buildTablePlan,
  buildTruncateSql,
  buildCopyToSql,
  buildCopyFromSql,
  buildTriggerToggleSql,
  compareColumnLists,
  parseRemapFile,
  createRemapTransform,
  createUrlRewriteTransform,
  topoSortTables,
  assertNoForeignReferrers,
  evaluateLoadedTable,
} from './lib-data.mjs';
import {
  FK_LIST_SQL,
  FK_TO_AUTH_USERS_SQL,
  SEQUENCE_LIST_SQL,
  TRIGGER_STATE_SQL,
  buildCountsSql,
  buildSequenceStateSql,
  buildSetvalSql,
  buildUuidOccurrenceSql,
  evaluateTriggers,
  mapSequenceName,
  maskUuid,
  assertReportSafe,
} from './lib-verify.mjs';
import { connectClient, redactSecrets } from './lib-conn.mjs';
import { SOURCE_BUCKET_RE } from './lib-storage.mjs';

const { to: copyTo, from: copyFrom } = copyStreams;
const __dirname = dirname(fileURLToPath(import.meta.url));
export const DEFAULT_BUCKET_MAP = join(__dirname, 'bucket-map.generated.json');

const SPEC = {
  'source-ref': 'string',
  'project-ref': 'string',
  'confirm-ref': 'string',
  'remap-file': 'string',
  'bucket-map': 'string',
  plan: 'boolean',
  probe: 'boolean',
  apply: 'boolean',
  'trigger-mode': 'string',
  'ca-file': 'string',
  'report-out': 'string',
};

const HELP = `Phase 4 data loader (ziko -> ziko_* tables)

  node scripts/portfolio-migration/05-load-data.mjs --source-ref <ref> --project-ref <ref> --remap-file <path>
       [--confirm-ref <ref>] [--plan | --probe | --apply]
       [--bucket-map <path>] [--trigger-mode auto|replica|disable-trigger] [--ca-file <path>] [--report-out <path>]

Default mode is --plan (read-only). --probe and --apply need SUPABASE_ACCESS_TOKEN
(or scripts/auth-merge/.access-token). Writing to portfolio needs --confirm-ref <portfolio ref>.
--bucket-map defaults to scripts/portfolio-migration/bucket-map.generated.json; storage URLs stored in rows
are rewritten in-flight to the target host and ziko-<bucket> (needed by --plan and --apply).
Exit codes: 0 ok, 1 failure, 2 bad arguments.`;

const TRIGGER_MODES = ['auto', 'replica', 'disable-trigger'];

export class CliError extends Error {
  constructor(message, exitCode = 1) {
    super(message);
    this.exitCode = exitCode;
  }
}

// ---------------------------------------------------------------------------
// Pure helpers
// ---------------------------------------------------------------------------

export function defaultMode(args) {
  if (args.probe) return 'probe';
  if (args.apply) return 'apply';
  return 'plan';
}

/** Argument validation, no I/O. Usage problems exit 2, safety refusals exit 1. */
export function resolveRun(args) {
  const modes = ['plan', 'probe', 'apply'].filter((m) => args[m]);
  if (modes.length > 1) throw new CliError('only one of --plan, --probe, --apply may be given', 2);
  const mode = modes.length === 0 ? 'plan' : modes[0];
  if (!args.projectRef) throw new CliError('--project-ref <ref> is required (no default)', 2);
  if (!args.sourceRef) throw new CliError('--source-ref <ref> is required (no default)', 2);
  try {
    assertProjectRefFormat(args.projectRef);
    assertProjectRefFormat(args.sourceRef);
  } catch (err) {
    throw new CliError(err.message, 2);
  }
  const triggerMode = args.triggerMode ?? 'auto';
  if (!TRIGGER_MODES.includes(triggerMode)) {
    throw new CliError(`--trigger-mode must be one of ${TRIGGER_MODES.join('|')}`, 2);
  }
  if ((mode === 'apply' || mode === 'plan') && !args.remapFile) {
    throw new CliError(`--remap-file is required for --${mode}`, 2);
  }
  if (args.sourceRef !== PROJECTS.ziko) throw new CliError('--source-ref must be the ziko project', 1);
  if (args.projectRef === PROJECTS.ziko) throw new CliError('Refusing: ziko can never be the target', 1);
  if (mode === 'apply' || mode === 'probe') {
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
    remapFile: args.remapFile ?? null,
    bucketMapFile: args.bucketMap ?? DEFAULT_BUCKET_MAP,
    triggerMode,
  };
}

/** Bucket ids from the generated bucket map (never a literal list). Exit 2 if unreadable or invalid. */
export async function loadBucketIds(file) {
  let obj;
  try {
    obj = JSON.parse(await readFile(file, 'utf8'));
  } catch {
    throw new CliError('bucket map could not be read or parsed (run the bucket-map generator first)', 2);
  }
  const ids = Array.isArray(obj?.buckets) ? obj.buckets.map((b) => b?.id) : [];
  if (ids.length === 0) throw new CliError('bucket map has no buckets', 2);
  for (const id of ids) {
    if (typeof id !== 'string' || !SOURCE_BUCKET_RE.test(id)) throw new CliError('bucket map contains an invalid bucket id', 2);
  }
  return ids;
}

/** Source-side (unprefixed tables) count of rows holding a ziko storage URL in any column (row-as-text). */
export function buildSourceUrlScanSql(names, { ref, buckets }) {
  inList(names);
  if (!/^[a-z0-9]+$/.test(ref)) throw new Error('invalid project ref');
  if (!Array.isArray(buckets) || buckets.length === 0) throw new Error('empty bucket list');
  for (const b of buckets) if (!SOURCE_BUCKET_RE.test(b)) throw new Error('invalid bucket id');
  const alt = buckets.join('|');
  const pattern = `${ref}\\.supabase\\.co/storage/v1/(object|render/image)/(public|sign|authenticated)/(${alt})([^A-Za-z0-9_-]|$)`;
  return names
    .map((n) => `SELECT '${n}' AS tbl, count(*)::bigint AS n FROM public."${n}" r WHERE r::text ~ '${pattern}'`)
    .join('\nUNION ALL\n');
}

/** Names/counts/booleans/masked UUIDs only; throws if anything PII-shaped slips in. */
export function buildLoadReport({ targetRef, mode, triggerMode, tables, sequences, remap }) {
  const report = {
    target_ref: targetRef,
    mode,
    trigger_mode: triggerMode,
    generated_at: new Date().toISOString(),
    remap: remap
      ? { source: maskUuid(remap.sourceUuid), target: maskUuid(remap.targetUuid) }
      : null,
    tables: (tables ?? []).map((t) => ({
      table: t.table,
      source_count: Number(t.sourceCount),
      streamed_rows: Number(t.streamedRows),
      target_count: Number(t.targetCount),
      remap_rows_touched: Number(t.rowsTouched ?? 0),
      remap_replacements: Number(t.replacements ?? 0),
      url_rewrites: Number(t.urlRewrites ?? 0),
    })),
    sequences: (sequences ?? []).map((s) => ({
      name: s.name,
      before: s.before ?? null,
      after: s.after ?? null,
    })),
    total_rows: (tables ?? []).reduce((a, t) => a + Number(t.targetCount), 0),
    url_rewrites_total: (tables ?? []).reduce((a, t) => a + Number(t.urlRewrites ?? 0), 0),
  };
  assertReportSafe(report);
  return report;
}

function inList(names) {
  for (const n of names) {
    if (!IDENT_RE.test(n)) throw new Error('invalid identifier in list');
  }
  return names.map((n) => `'${n}'`).join(', ');
}

/** Column lists (generated columns excluded), ordinal order. */
export function buildColumnsSql(names) {
  return `SELECT c.relname AS tbl, a.attname AS name, format_type(a.atttypid, a.atttypmod) AS type
FROM pg_attribute a
JOIN pg_class c ON c.oid = a.attrelid
WHERE c.relnamespace = 'public'::regnamespace
  AND c.relkind = 'r'
  AND c.relname IN (${inList(names)})
  AND a.attnum > 0
  AND NOT a.attisdropped
  AND a.attgenerated = ''
ORDER BY c.relname, a.attnum`;
}

export function groupColumns(rows) {
  const m = new Map();
  for (const r of rows ?? []) {
    if (!m.has(r.tbl)) m.set(r.tbl, []);
    m.get(r.tbl).push({ name: r.name, type: r.type });
  }
  return m;
}

/** Foreign keys that reference a public ziko_ table; referrer is schema-qualified when not in public. */
export const FOREIGN_REFERRERS_SQL = `SELECT CASE WHEN r.relnamespace = 'public'::regnamespace THEN r.relname
            ELSE r.relnamespace::regnamespace::text || '.' || r.relname END AS referrer,
       pr.relname AS referenced
FROM pg_constraint c
JOIN pg_class r ON r.oid = c.conrelid
JOIN pg_class pr ON pr.oid = c.confrelid
WHERE c.contype = 'f'
  AND pr.relnamespace = 'public'::regnamespace
  AND pr.relname LIKE 'ziko\\_%'
ORDER BY 1, 2`;

/** Source-side UUID occurrence (source tables are unprefixed). */
export function buildSourceUuidOccurrenceSql(names, uuid) {
  inList(names);
  if (!UUID_RE.test(uuid)) throw new Error('invalid uuid literal');
  return names
    .map((n) => `SELECT '${n}' AS tbl, count(*)::bigint AS n FROM public."${n}" t WHERE t::text ILIKE '%${uuid}%'`)
    .join('\nUNION ALL\n');
}

export function buildTruncatePrivilegeSql(targets) {
  return `SELECT t AS tbl, has_table_privilege(current_user, 'public.' || quote_ident(t), 'TRUNCATE') AS ok
FROM unnest(ARRAY[${inList(targets)}]) AS t ORDER BY t`;
}

export function buildPlanLine(table, sourceCount, targetCount) {
  return `${table} source=${sourceCount} target=${targetCount}`;
}

const num = (v) => Number(v);

function countMap(rows) {
  return new Map((rows ?? []).map((r) => [r.tbl, num(r.n)]));
}

// ---------------------------------------------------------------------------
// Shared guards
// ---------------------------------------------------------------------------

function assertColumnsMatch(plan, srcCols, tgtCols) {
  const bad = [];
  for (const p of plan) {
    const a = srcCols.get(p.source) ?? [];
    const b = tgtCols.get(p.target) ?? [];
    if (a.length === 0 || b.length === 0) {
      bad.push(`${p.target}: table missing on ${a.length === 0 ? 'source' : 'target'}`);
      continue;
    }
    const cmp = compareColumnLists(a, b);
    if (!cmp.ok) {
      bad.push(`${p.target}: ${cmp.diffs.map((d) => `#${d.position} ${d.source} vs ${d.target}`).join(', ')}`);
    }
  }
  if (bad.length > 0) throw new CliError(`column mismatch on ${bad.length} tables: ${bad.join(' | ')}`, 1);
}

async function readPlanData(run) {
  const map = await loadRenameMap();
  const plan = buildTablePlan(map);
  let remapObj;
  try {
    remapObj = JSON.parse(await readFile(run.remapFile, 'utf8'));
  } catch {
    throw new CliError('remap file could not be read or parsed', 1);
  }
  let remap;
  try {
    remap = parseRemapFile(remapObj, { projectRef: run.targetRef, sourceRef: run.sourceRef });
  } catch (err) {
    throw new CliError(err.message, 1);
  }
  return { plan, remap };
}

// ---------------------------------------------------------------------------
// --plan (read only, no credentials)
// ---------------------------------------------------------------------------

async function runPlan(run, log) {
  const { plan, remap } = await readPlanData(run);
  const sources = plan.map((p) => p.source);
  const targets = plan.map((p) => p.target);

  const srcCols = groupColumns(await runSql(run.sourceRef, buildColumnsSql(sources)));
  const tgtCols = groupColumns(await runSql(run.targetRef, buildColumnsSql(targets)));
  assertColumnsMatch(plan, srcCols, tgtCols);
  log(`columns: ${plan.length}/${plan.length} tables have identical column lists`);

  assertNoForeignReferrers(await runSql(run.targetRef, FOREIGN_REFERRERS_SQL));
  log('guard: no non-ziko_ table references a ziko_ table on the target');

  const srcCounts = countMap(await runSql(run.sourceRef, buildCountsSql(plan, 'source')));
  const tgtCounts = countMap(await runSql(run.targetRef, buildCountsSql(plan, 'target')));
  let total = 0;
  for (const p of plan) {
    const s = srcCounts.get(p.target) ?? 0;
    total += s;
    log(buildPlanLine(p.target, s, tgtCounts.get(p.target) ?? 0));
  }
  log(`total source rows: ${total}`);

  const buckets = await loadBucketIds(run.bucketMapFile);
  const urlScan = await runSql(run.sourceRef, buildSourceUrlScanSql(sources, { ref: run.sourceRef, buckets }));
  let urlTotal = 0;
  for (const r of urlScan.filter((x) => num(x.n) > 0)) {
    urlTotal += num(r.n);
    log(`source storage urls in ${r.tbl}: ${num(r.n)} rows`);
  }
  log(`total rows with ziko storage urls (rewritten in-flight on apply): ${urlTotal}`);

  const srcOcc = await runSql(run.sourceRef, buildSourceUuidOccurrenceSql(sources, remap.sourceUuid));
  const tgtOcc = await runSql(run.targetRef, buildUuidOccurrenceSql(targets, remap.targetUuid));
  for (const r of srcOcc.filter((x) => num(x.n) > 0)) log(`source uuid ${maskUuid(remap.sourceUuid)} in ${r.tbl}: ${num(r.n)} rows`);
  for (const r of tgtOcc.filter((x) => num(x.n) > 0)) log(`target uuid ${maskUuid(remap.targetUuid)} in ${r.tbl}: ${num(r.n)} rows`);

  const fks = await runSql(run.targetRef, FK_LIST_SQL);
  const authFks = await runSql(run.targetRef, FK_TO_AUTH_USERS_SQL);
  log(`target foreign keys: ${fks.length}; auth.users FK columns: ${authFks.length}`);
  if (fks.length === 0 || authFks.length === 0) throw new CliError('no foreign keys discovered on the target', 1);

  log(`planned trigger mode: ${run.triggerMode === 'auto' ? 'replica (fallback disable-trigger if the probe fails)' : run.triggerMode}`);
  log('plan complete (read-only)');
}

// ---------------------------------------------------------------------------
// Connections
// ---------------------------------------------------------------------------

async function openClients(run, caPem) {
  const token = await loadAccessToken();
  const opened = { token, src: null, dst: null };
  try {
    opened.src = (await connectClient(run.sourceRef, { readOnly: true, token, caPem })).client;
    opened.dst = (await connectClient(run.targetRef, { readOnly: false, token, caPem })).client;
  } catch (err) {
    await closeClients(run, opened);
    throw err;
  }
  return opened;
}

async function closeClients(run, opened) {
  for (const c of [opened.src, opened.dst]) {
    if (c) await c.end().catch(() => {});
  }
  // Login roles are deliberately NOT deleted here: deleting a role and re-creating the same name made
  // the next pooler connection fail (auth failure / stale role OID, observed in the scratch
  // rehearsal). They are short-lived and are revoked with the token at the end (plan 04-07).
}

async function rows(client, sql) {
  return (await client.query(sql)).rows;
}

async function probeReplica(dst) {
  try {
    await dst.query('BEGIN');
    await dst.query('SET LOCAL session_replication_role = replica');
    const r = await rows(dst, "SELECT current_setting('session_replication_role') AS v");
    return r[0]?.v === 'replica';
  } catch {
    return false;
  } finally {
    await dst.query('ROLLBACK').catch(() => {});
  }
}

async function resolveTriggerMode(requested, dst) {
  if (requested === 'disable-trigger') return 'disable-trigger';
  const ok = await probeReplica(dst);
  if (requested === 'replica' && !ok) {
    throw new CliError('replica mode requested but SET LOCAL session_replication_role = replica did not take effect', 1);
  }
  return ok ? 'replica' : 'disable-trigger';
}

// ---------------------------------------------------------------------------
// --probe
// ---------------------------------------------------------------------------

async function runProbe(run, caPem, log) {
  const { plan } = await readPlanData(run);
  const targets = plan.map((p) => p.target);
  const opened = await openClients(run, caPem);
  try {
    const { src, dst } = opened;
    for (const [label, c] of [['source', src], ['target', dst]]) {
      const r = await rows(c, 'SELECT current_user AS u, (SELECT rolbypassrls FROM pg_roles WHERE rolname = current_user) AS bypass');
      log(`${label}: login role ${r[0].u}, rolbypassrls=${r[0].bypass}`);
    }
    for (const t of ['food_database', 'exercise_import_log', 'supplement_prices']) {
      const viaCli = num((await runSql(run.sourceRef, `SELECT count(*)::bigint AS n FROM public.${t}`))[0].n);
      const viaConn = num((await rows(src, `SELECT count(*)::bigint AS n FROM public."${t}"`))[0].n);
      log(`source count check ${t}: cli=${viaCli} conn=${viaConn}`);
      if (viaCli !== viaConn) throw new CliError(`RLS appears to hide rows on source table ${t}`, 1);
    }
    const replicaOk = await probeReplica(dst);
    log(`target replica_ok=${replicaOk}`);
    const privs = await rows(dst, buildTruncatePrivilegeSql(targets));
    const lacking = privs.filter((r) => r.ok !== true).map((r) => r.tbl);
    log(`TRUNCATE privilege on ${privs.length - lacking.length}/${privs.length} target tables`);
    if (lacking.length > 0) throw new CliError(`missing TRUNCATE privilege on ${lacking.length} tables`, 1);
    if (run.targetRef !== PROJECTS.portfolio) {
      try {
        await dst.query('BEGIN');
        await dst.query(buildTruncateSql(targets));
        log('scratch: guarded 99-table TRUNCATE parsed and permitted (rolled back)');
      } finally {
        await dst.query('ROLLBACK').catch(() => {});
      }
    }
    log(`selected trigger mode: ${replicaOk ? 'replica' : 'disable-trigger'}`);
  } finally {
    await closeClients(run, opened);
  }
}

// ---------------------------------------------------------------------------
// --apply
// ---------------------------------------------------------------------------

/**
 * One table, one target transaction. Integration-only (needs live clients).
 * Returns { ok, reason, streamedRows, targetCount, stats }; throws CliError (table + phase + SQLSTATE
 * only, never row content) on any exception. The transaction commits only if
 * source snapshot count = streamed rows = target count.
 */
export async function loadTable({ src, dst, entry, columns, sourceUuid, targetUuid, triggerMode, sourceCount, sourceRef, targetRef, buckets }) {
  const { source, target } = entry;
  const disable = triggerMode === 'disable-trigger';
  const transform = createRemapTransform(sourceUuid, targetUuid);
  const urlTransform = createUrlRewriteTransform({ sourceRef, targetRef, buckets });
  let committed = false;
  let phase = 'begin';
  try {
    await dst.query('BEGIN');
    phase = 'trigger-setup';
    if (disable) {
      await dst.query(buildTriggerToggleSql(target, false));
    } else {
      await dst.query('SET LOCAL session_replication_role = replica');
      const r = await rows(dst, "SELECT current_setting('session_replication_role') AS v");
      if (r[0]?.v !== 'replica') throw new Error('replica role not in effect');
    }
    phase = 'copy';
    await pipeline(
      src.query(copyTo(buildCopyToSql(source, columns))),
      transform,
      urlTransform,
      dst.query(copyFrom(buildCopyFromSql(target, columns)))
    );
    phase = 'trigger-restore';
    if (disable) await dst.query(buildTriggerToggleSql(target, true));
    phase = 'count';
    const targetCount = num((await rows(dst, `SELECT count(*)::bigint AS n FROM public."${target}"`))[0].n);
    const ev = evaluateLoadedTable({
      table: target,
      sourceCount,
      streamedRows: transform.stats.rows,
      targetCount,
    });
    if (!ev.ok) {
      await dst.query('ROLLBACK');
      return { ok: false, reason: ev.reason, streamedRows: transform.stats.rows, targetCount, stats: transform.stats, urlStats: urlTransform.stats };
    }
    if (urlTransform.stats.rows !== transform.stats.rows) {
      await dst.query('ROLLBACK');
      return { ok: false, reason: 'url transform row mismatch', streamedRows: transform.stats.rows, targetCount, stats: transform.stats, urlStats: urlTransform.stats };
    }
    phase = 'commit';
    await dst.query('COMMIT');
    committed = true;
    return { ok: true, reason: null, streamedRows: transform.stats.rows, targetCount, stats: transform.stats, urlStats: urlTransform.stats };
  } catch (err) {
    await dst.query('ROLLBACK').catch(() => {});
    throw new CliError(`${target}: ${phase} phase failed (${err && err.code ? err.code : 'error'})`, 1);
  } finally {
    // ROLLBACK already restores trigger state; the extra statement is defensive.
    if (disable && !committed) await dst.query(buildTriggerToggleSql(target, true)).catch(() => {});
  }
}

async function readSeqState(client, name, side) {
  const r = await rows(client, buildSequenceStateSql(name, side));
  return { last_value: String(r[0].last_value), is_called: r[0].is_called === true };
}

async function runApply(run, caPem, args, log) {
  const { plan, remap } = await readPlanData(run);
  const sources = plan.map((p) => p.source);
  const targets = plan.map((p) => p.target);
  const buckets = await loadBucketIds(run.bucketMapFile);
  const opened = await openClients(run, caPem);
  const { src, dst } = opened;
  let snapshotOpen = false;
  try {
    // (1) re-run guards on the live connections before any write
    assertNoForeignReferrers(await rows(dst, FOREIGN_REFERRERS_SQL));
    const srcCols = groupColumns(await rows(src, buildColumnsSql(sources)));
    const tgtCols = groupColumns(await rows(dst, buildColumnsSql(targets)));
    assertColumnsMatch(plan, srcCols, tgtCols);
    log('guards ok: no foreign referrers, column lists identical');

    // (2) trigger mode and table order
    const triggerMode = await resolveTriggerMode(run.triggerMode, dst);
    log(`trigger mode: ${triggerMode}`);
    let order = plan;
    if (triggerMode === 'disable-trigger') {
      const edges = (await rows(dst, FK_LIST_SQL)).map((r) => ({ child: r.child, parent: r.parent_table }));
      const sorted = topoSortTables(targets, edges);
      const byTarget = new Map(plan.map((p) => [p.target, p]));
      order = sorted.map((t) => byTarget.get(t));
    }

    // (3) previous target sequence states
    const seqNames = (await rows(src, SEQUENCE_LIST_SQL)).map((r) => r.sequencename);
    const previous = new Map();
    for (const s of seqNames) {
      const t = mapSequenceName(s);
      previous.set(s, await readSeqState(dst, t, 'target'));
    }

    // (4) guarded truncate, its own transaction
    try {
      await dst.query('BEGIN');
      await dst.query(buildTruncateSql(targets));
      await dst.query('COMMIT');
    } catch (err) {
      await dst.query('ROLLBACK').catch(() => {});
      throw new CliError(`truncate phase failed (${err && err.code ? err.code : 'error'})`, 1);
    }
    log(`truncated ${targets.length} ziko_ tables`);

    // (5) the target UUID must not pre-exist anywhere in the target tables
    const occ = await rows(dst, buildUuidOccurrenceSql(targets, remap.targetUuid));
    const pre = occ.filter((r) => num(r.n) > 0);
    if (pre.length > 0) throw new CliError(`target uuid ${maskUuid(remap.targetUuid)} already present in ${pre.length} tables after truncate`, 1);

    // (6) one consistent source snapshot for the whole run
    await src.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
    snapshotOpen = true;
    const srcCounts = countMap(await rows(src, buildCountsSql(plan, 'source')));

    // (7) per table load
    const results = [];
    for (const entry of order) {
      const columns = srcCols.get(entry.source).map((c) => c.name);
      const res = await loadTable({
        src,
        dst,
        entry,
        columns,
        sourceUuid: remap.sourceUuid,
        targetUuid: remap.targetUuid,
        triggerMode,
        sourceCount: srcCounts.get(entry.target),
        sourceRef: run.sourceRef,
        targetRef: run.targetRef,
        buckets,
      });
      if (!res.ok) throw new CliError(`count assertion failed, rolled back: ${res.reason}`, 1);
      log(`loaded ${entry.target} rows=${res.targetCount} remapped_rows=${res.stats.rowsTouched} url_rewrites=${res.urlStats.replacements}`);
      results.push({
        table: entry.target,
        sourceCount: srcCounts.get(entry.target),
        streamedRows: res.streamedRows,
        targetCount: res.targetCount,
        rowsTouched: res.stats.rowsTouched,
        replacements: res.stats.replacements,
        urlRewrites: res.urlStats.replacements,
      });
    }

    // (8) close the snapshot
    await src.query('COMMIT');
    snapshotOpen = false;

    // (9) sequences from ziko's live state; the sequence-advancing function is never used
    const sequences = [];
    for (const s of seqNames) {
      const target = mapSequenceName(s);
      const state = await readSeqState(src, s, 'source');
      const prev = previous.get(s);
      if (BigInt(state.last_value) < BigInt(prev.last_value)) {
        throw new CliError(`${target}: source value is below the previous target value; refusing to regress`, 1);
      }
      await dst.query(buildSetvalSql(target, state));
      const after = await readSeqState(dst, target, 'target');
      sequences.push({ name: target, before: Number(prev.last_value), after: Number(after.last_value) });
      log(`sequence ${target}: ${prev.last_value} -> ${after.last_value}`);
    }

    // (10) no user trigger may remain disabled
    const trig = evaluateTriggers(await rows(dst, TRIGGER_STATE_SQL));
    log(`triggers: ${trig.detail}`);
    if (!trig.ok) throw new CliError(`trigger assertion failed: ${trig.data.notEnabled.length} triggers not enabled`, 1);

    // (11) report
    const report = buildLoadReport({
      targetRef: run.targetRef,
      mode: 'apply',
      triggerMode,
      tables: results,
      sequences,
      remap,
    });
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const out = args.reportOut ?? join(__dirname, `.tmp-load-${run.targetRef}-${stamp}.json`);
    await writeFile(out, JSON.stringify(report, null, 2), 'utf8');
    log(`total rows loaded: ${report.total_rows} across ${results.length} tables`);
    log(`report written: ${out}`);
  } catch (err) {
    if (snapshotOpen) await src.query('ROLLBACK').catch(() => {});
    if (err instanceof CliError) throw err;
    throw new CliError(`apply failed (${err && err.code ? err.code : 'error'})`, 1);
  } finally {
    await closeClients(run, opened);
  }
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

export async function main(argv) {
  const log = (m) => console.log(m);
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
  let secrets = [];
  try {
    const run = resolveRun(args);
    let caPem;
    if (args.caFile) caPem = await readFile(args.caFile, 'utf8');
    if (run.mode === 'plan') await runPlan(run, log);
    else if (run.mode === 'probe') await runProbe(run, caPem, log);
    else await runApply(run, caPem, args, log);
    return 0;
  } catch (err) {
    secrets = [process.env.SUPABASE_ACCESS_TOKEN];
    console.error(`ERROR: ${redactSecrets(redactPii(err.message), secrets)}`);
    return err instanceof CliError ? err.exitCode : 1;
  }
}

if (isMain(import.meta.url)) {
  main(process.argv.slice(2)).then((code) => process.exit(code));
}
