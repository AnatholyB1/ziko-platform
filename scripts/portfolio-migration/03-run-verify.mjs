#!/usr/bin/env node
/**
 * Post-apply verification wrapper for the ziko -> portfolio schema rename.
 *
 * Reads rename-map.generated.json, builds the FULL stale-reference alternation lists at runtime
 * (no hardcoded name lists), substitutes them into 03-verify-post-apply.sql, runs each named
 * query block against ONE explicitly named Supabase project, and exits non-zero on any finding.
 *
 * Usage:
 *   node scripts/portfolio-migration/03-run-verify.mjs --project-ref <ref>
 *   node scripts/portfolio-migration/03-run-verify.mjs --print-sql     (no connection; prints the
 *                                                                       generated SQL, e.g. to run
 *                                                                       through the MCP execute_sql tool)
 *   node scripts/portfolio-migration/03-run-verify.mjs --help
 *
 * --project-ref is REQUIRED for a live run. There is deliberately no default: this suite is run
 * against both the scratch project and `portfolio`, and a silent default could point it at the
 * wrong (or production ziko) project.
 *
 * Transport: `supabase db query --linked --project-ref <ref> --file <tmp>` (same as
 * 01-generate-rename-map.mjs). All queries are SELECT-only.
 */

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { readFile, writeFile, unlink } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';

const execFileAsync = promisify(execFile);
const __dirname = dirname(fileURLToPath(import.meta.url));
const MAP_FILE = join(__dirname, 'rename-map.generated.json');
const SQL_FILE = join(__dirname, '03-verify-post-apply.sql');

const HELP = `03-run-verify.mjs - post-apply stale-reference / RLS-enabled / table-count verification

Required for a live run:
  --project-ref <ref>   Supabase project ref to verify (scratch or portfolio). No default.

Optional:
  --print-sql           Print the generated SQL (placeholders substituted) and exit; no connection.
  --help, -h            Show this help and exit 0.

Exit codes: 0 all checks pass; 1 any finding or error; 2 bad arguments.
`;

function parseArgs(argv) {
  const args = { projectRef: null, printSql: false, help: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--help' || a === '-h') args.help = true;
    else if (a === '--print-sql') args.printSql = true;
    else if (a === '--project-ref') args.projectRef = argv[++i] ?? null;
    else {
      console.error(`Unknown argument: ${a}\n`);
      console.error(HELP);
      process.exit(2);
    }
  }
  return args;
}

const IDENT_RE = /^[a-z0-9_]+$/;

/** Strip the identity-args suffix: "award_coins(p_user_id uuid, ...)" -> "award_coins". */
function functionName(key) {
  const idx = key.indexOf('(');
  return idx === -1 ? key : key.slice(0, idx);
}

function assertIdent(name, kind) {
  // Names are interpolated into a SQL regex literal; refuse anything that is not a plain identifier.
  if (!IDENT_RE.test(name)) {
    throw new Error(`Refusing to interpolate non-identifier ${kind} name into SQL: ${JSON.stringify(name)}`);
  }
}

function buildSql(map, template) {
  const tables = Object.keys(map.tables);
  const functions = [...new Set(Object.keys(map.functions).map(functionName))];
  tables.forEach((t) => assertIdent(t, 'table'));
  functions.forEach((f) => assertIdent(f, 'function'));
  return {
    sql: template
      .replaceAll('__TABLE_ALTERNATION__', tables.join('|'))
      .replaceAll('__FUNCTION_ALTERNATION__', functions.join('|'))
      .replaceAll('__EXPECTED_TABLE_COUNT__', String(tables.length)),
    expectedTableCount: tables.length,
    functionCount: functions.length,
  };
}

function parseQueries(sqlText) {
  const markerRe = /^-- QUERY: (\w+)\s*$/gm;
  const markers = [...sqlText.matchAll(markerRe)];
  if (markers.length === 0) throw new Error(`No "-- QUERY: <name>" markers found in ${SQL_FILE}`);
  const queries = {};
  markers.forEach((m, i) => {
    const start = m.index + m[0].length;
    const end = i + 1 < markers.length ? markers[i + 1].index : sqlText.length;
    queries[m[1]] = sqlText.slice(start, end).trim();
  });
  return queries;
}

async function runQuery(projectRef, sql) {
  const tmpFile = join(__dirname, `.tmp-verify-${randomUUID()}.sql`);
  await writeFile(tmpFile, sql, 'utf8');
  try {
    const { stdout } = await execFileAsync(
      process.platform === 'win32' ? 'npx.cmd' : 'npx',
      ['supabase', 'db', 'query', '--linked', '--project-ref', projectRef, '--file', tmpFile],
      // shell on Windows is required for .cmd shims; argv is only fixed flags + a self-generated path.
      { maxBuffer: 1024 * 1024 * 32, shell: process.platform === 'win32' }
    );
    let parsed;
    try {
      parsed = JSON.parse(stdout);
    } catch (err) {
      throw new Error(`Failed to parse "supabase db query" output as JSON: ${err.message}\n${stdout}`);
    }
    if (!Array.isArray(parsed.rows)) {
      throw new Error(`Unexpected "supabase db query" output shape (no "rows" array):\n${stdout}`);
    }
    return parsed.rows;
  } finally {
    await unlink(tmpFile).catch(() => {});
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log(HELP);
    return;
  }

  const map = JSON.parse(await readFile(MAP_FILE, 'utf8'));
  const template = await readFile(SQL_FILE, 'utf8');
  const { sql, expectedTableCount, functionCount } = buildSql(map, template);

  if (args.printSql) {
    console.log(sql);
    return;
  }

  if (!args.projectRef) {
    console.error('ERROR: --project-ref <ref> is required (no default, to avoid verifying the wrong project).\n');
    console.error(HELP);
    process.exit(2);
  }

  const queries = parseQueries(sql);
  const required = ['stale_policy_refs', 'stale_function_refs', 'stale_trigger_refs', 'rls_not_enabled', 'table_count'];
  for (const name of required) {
    if (!queries[name]) throw new Error(`Missing "-- QUERY: ${name}" block in ${SQL_FILE}`);
  }

  console.log(
    `Verifying project ${args.projectRef} against rename map (${expectedTableCount} tables, ${functionCount} functions)...`
  );

  const results = [];
  // Sequential: concurrent `supabase` CLI invocations race on a shared telemetry temp file.
  for (const name of required) {
    const rows = await runQuery(args.projectRef, queries[name]);
    if (name === 'table_count') {
      const count = Number(rows[0]?.table_count);
      results.push({ name, ok: count === expectedTableCount, detail: `found ${count}, expected ${expectedTableCount}` });
    } else {
      results.push({ name, ok: rows.length === 0, detail: `${rows.length} offending row(s)`, rows });
    }
  }

  let failed = false;
  console.log('\nResults:');
  for (const r of results) {
    console.log(`  [${r.ok ? 'PASS' : 'FAIL'}] ${r.name}: ${r.detail}`);
    if (!r.ok) {
      failed = true;
      if (r.rows) for (const row of r.rows.slice(0, 20)) console.log(`         ${JSON.stringify(row).slice(0, 300)}`);
    }
  }
  console.log(failed ? '\nVERIFICATION FAILED' : '\nVERIFICATION PASSED');
  process.exit(failed ? 1 : 0);
}

main().catch((err) => {
  console.error(err.message ?? err);
  process.exit(1);
});
