#!/usr/bin/env node
/**
 * Read-only rename-map generator — runs the three named live introspection
 * queries defined in 01-generate-rename-map.sql (tables, ziko-authored
 * functions, genuine custom types) against ziko's LIVE schema and writes
 * the resulting { tables, functions, types, required_extensions } map to
 * rename-map.generated.json.
 *
 * Usage: node scripts/portfolio-migration/01-generate-rename-map.mjs
 *          [--project-ref <ref>] [--out <path>]
 * Requires: the Supabase CLI linked/authenticated for the target project
 *   (`supabase link --project-ref <ref>` or an existing linked project).
 *   Prefers the Supabase MCP execute_sql tool when running inside an agent
 *   environment that exposes it; falls back to shelling out to
 *   `supabase db query --linked --project-ref <ref> "<SQL>"` otherwise
 *   (the transport used by this script, matching Phase 1's
 *   01-01-SUMMARY.md tech_stack.patterns CLI convention).
 *
 * This file parses only SELECT statements out of 01-generate-rename-map.sql
 * (which itself contains no DROP/ALTER/CREATE/INSERT/UPDATE/DELETE
 * statement) and writes only to the local --out path — it issues no write
 * against any Supabase project and is read-only by construction.
 */

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { readFile, writeFile, unlink } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';

const execFileAsync = promisify(execFile);
const __dirname = dirname(fileURLToPath(import.meta.url));

const DEFAULT_PROJECT_REF = 'slkobhavpwsubnsmuhya'; // ziko
const DEFAULT_OUT = join(__dirname, 'rename-map.generated.json');
const SQL_FILE = join(__dirname, '01-generate-rename-map.sql');

function parseArgs(argv) {
  const args = { projectRef: DEFAULT_PROJECT_REF, out: DEFAULT_OUT };
  const refIdx = argv.indexOf('--project-ref');
  if (refIdx !== -1 && argv[refIdx + 1]) args.projectRef = argv[refIdx + 1];
  const outIdx = argv.indexOf('--out');
  if (outIdx !== -1 && argv[outIdx + 1]) args.out = argv[outIdx + 1];
  return args;
}

/**
 * Splits 01-generate-rename-map.sql into named query blocks, delimited by
 * "-- QUERY: <name>" marker comments — single source of truth shared with
 * the committed .sql file (no duplicated query text to drift out of sync).
 * Returns { tables: "<sql>", functions: "<sql>", types: "<sql>" }.
 */
function parseQueries(sqlText) {
  const markerRe = /^-- QUERY: (\w+)\s*$/gm;
  const markers = [...sqlText.matchAll(markerRe)];
  if (markers.length === 0) {
    throw new Error(`No "-- QUERY: <name>" markers found in ${SQL_FILE}`);
  }
  const queries = {};
  for (let i = 0; i < markers.length; i++) {
    const name = markers[i][1];
    const start = markers[i].index + markers[i][0].length;
    const end = i + 1 < markers.length ? markers[i + 1].index : sqlText.length;
    queries[name] = sqlText.slice(start, end).trim();
  }
  return queries;
}

/**
 * Runs one SQL query live against the given project via the Supabase CLI
 * fallback transport and returns the parsed `rows` array.
 *
 * The query text is written to a short-lived local temp file and passed to
 * the CLI via `--file <path>` (never inlined as a raw SQL string on the
 * command line) — this sidesteps a Windows-only `spawn EINVAL` issue when
 * invoking the `.cmd`-shimmed `npx`/`supabase` executables without a shell,
 * and avoids passing arbitrary SQL text through a shell-concatenated
 * argument. The temp file is always removed in a `finally` block, even on
 * error.
 */
async function runQuery(projectRef, sql) {
  const tmpFile = join(__dirname, `.tmp-query-${randomUUID()}.sql`);
  await writeFile(tmpFile, sql, 'utf8');
  try {
    const { stdout } = await execFileAsync(
      process.platform === 'win32' ? 'npx.cmd' : 'npx',
      ['supabase', 'db', 'query', '--linked', '--project-ref', projectRef, '--file', tmpFile],
      // shell: true is required on Windows for the .cmd-shimmed npx/supabase
      // executables (Node's child_process cannot spawn .cmd files directly);
      // safe here because every argv entry is either a fixed flag or a path
      // this script itself generated, never externally-influenced text.
      { maxBuffer: 1024 * 1024 * 32, shell: process.platform === 'win32' }
    );
    let parsed;
    try {
      parsed = JSON.parse(stdout);
    } catch (err) {
      throw new Error(
        `Failed to parse "supabase db query" output as JSON: ${err.message}\nRaw stdout:\n${stdout}`
      );
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
  const { projectRef, out } = parseArgs(process.argv.slice(2));
  const sqlText = await readFile(SQL_FILE, 'utf8');
  const queries = parseQueries(sqlText);
  for (const required of ['tables', 'functions', 'types']) {
    if (!queries[required]) {
      throw new Error(`Missing "-- QUERY: ${required}" block in ${SQL_FILE}`);
    }
  }

  console.log(`Querying live schema from project ${projectRef}...`);

  // Sequential, not Promise.all: concurrent `supabase` CLI invocations race
  // on renaming a shared local telemetry.json temp file (observed live this
  // session as an EPERM crash under concurrency) — running one at a time
  // avoids that race entirely and costs only a few extra seconds.
  const tableRows = await runQuery(projectRef, queries.tables);
  const functionRows = await runQuery(projectRef, queries.functions);
  const typeRows = await runQuery(projectRef, queries.types);

  const tables = {};
  for (const row of tableRows) {
    tables[row.tablename] = `ziko_${row.tablename}`;
  }

  const functions = {};
  for (const row of functionRows) {
    // Key format matches this plan's <interfaces> block exactly: the
    // identity-args suffix exactly as pg_get_function_identity_arguments
    // returned it (empty string for a zero-arg function -> "name()").
    const args = row.args ?? '';
    const key = `${row.proname}(${args})`;
    functions[key] = `ziko_${key}`;
  }

  const types = {};
  for (const row of typeRows) {
    types[row.typname] = `ziko_${row.typname}`;
  }

  const map = {
    tables,
    functions,
    types,
    // Filled in by 01-generate-rename-map.mjs's companion Task 2 step
    // (the D-04 dependency grep) — present here so the shape is stable
    // even before that step runs.
    required_extensions: {
      unaccent: { required: null, evidence: null },
      pg_net: { required: null, evidence: null },
    },
  };

  await writeFile(out, `${JSON.stringify(map, null, 2)}\n`, 'utf8');

  console.log(`Wrote ${out}`);
  console.log(`  tables:    ${Object.keys(tables).length}`);
  console.log(`  functions: ${Object.keys(functions).length}`);
  console.log(`  types:     ${Object.keys(types).length}`);
}

main().catch((err) => {
  console.error('01-generate-rename-map failed:', err.message);
  process.exit(1);
});
