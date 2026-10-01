#!/usr/bin/env node
/**
 * Apply the Ziko signup gate functions and/or triggers to a target project, by explicit stage.
 *
 *   --stage functions  apply 20261002090000_* (gated functions only; safe before the import)
 *   --stage triggers   apply 20261002090001_* (refuses unless ziko users are already imported, D-06)
 *   --stage all        functions then triggers (same import precondition)
 *
 * Usage:
 *   node scripts/auth-merge/03-apply-trigger-gate.mjs --project-ref <ref> [--confirm-ref <ref>]
 *        --stage functions|triggers|all [--source-ref <ziko ref>]
 *
 * No default ref, no default stage. Idempotent (CREATE OR REPLACE). Output: names, counts, booleans.
 * Exit codes: 0 ok; 1 failure; 2 bad arguments.
 */

import { readFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  PROJECTS,
  parseCliArgs,
  requireRef,
  assertWriteAllowed,
  runSql,
  fetchEmailFingerprints,
  isMain,
} from './lib.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS = join(__dirname, '..', '..', 'supabase', 'portfolio-migrations');
const FUNCTIONS_FILE = '20261002090000_portfolio_ziko_auth_gate_functions.sql';
const TRIGGERS_FILE = '20261002090001_portfolio_ziko_auth_triggers.sql';
const STAGES = ['functions', 'triggers', 'all'];
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

const HELP = `03-apply-trigger-gate.mjs - apply gate functions / triggers by stage

Required:
  --project-ref <ref>   Target project. No default.
  --stage <s>           functions | triggers | all. No default.
Optional:
  --confirm-ref <ref>   Must equal the portfolio ref to write to portfolio.
  --source-ref <ref>    ziko ref; required for stages triggers/all (import precondition).
  --help, -h            Show this help.

Exit codes: 0 ok; 1 failure; 2 bad arguments.
`;

async function checkImportDone(target, source) {
  const rows = await fetchEmailFingerprints(source);
  const ids = rows.map((r) => r.id);
  for (const id of ids) if (!UUID_RE.test(id)) throw new Error('Unexpected non-UUID id from source');
  if (ids.length === 0) throw new Error('Source has no users');
  const arr = `ARRAY[${ids.map((i) => `'${i}'`).join(',')}]::uuid[]`;
  const res = await runSql(target, `SELECT count(*)::int AS n FROM auth.users WHERE id = ANY(${arr})`);
  return res[0].n;
}

async function confirmFunctions(ref) {
  const rows = await runSql(
    ref,
    `SELECT proname, position('raw_user_meta_data->>''app''' IN prosrc) > 0 AS gated
       FROM pg_proc
      WHERE pronamespace = 'public'::regnamespace
        AND proname IN ('ziko_handle_new_user', 'ziko_handle_new_user_credits')
      ORDER BY proname`
  );
  let ok = rows.length === 2;
  for (const r of rows) {
    console.log(`[${r.gated ? 'PASS' : 'FAIL'}] function ${r.proname} gated=${r.gated}`);
    if (!r.gated) ok = false;
  }
  if (rows.length !== 2) console.log(`[FAIL] expected 2 gate functions, found ${rows.length}`);
  return ok;
}

async function confirmTriggers(ref) {
  const rows = await runSql(
    ref,
    `SELECT tgname, tgenabled::text AS tgenabled FROM pg_trigger
      WHERE tgrelid = 'auth.users'::regclass AND NOT tgisinternal AND tgname LIKE 'ziko\\_%'
      ORDER BY tgname`
  );
  let ok = rows.length === 2;
  for (const r of rows) {
    const good = r.tgenabled === 'O';
    console.log(`[${good ? 'PASS' : 'FAIL'}] trigger ${r.tgname} enabled=${r.tgenabled}`);
    if (!good) ok = false;
  }
  if (rows.length !== 2) console.log(`[FAIL] expected 2 ziko_ triggers on auth.users, found ${rows.length}`);
  return ok;
}

async function main() {
  const args = parseCliArgs(process.argv.slice(2), {
    'project-ref': 'string',
    'confirm-ref': 'string',
    stage: 'string',
    'source-ref': 'string',
  });
  if (args.help) {
    console.log(HELP);
    return;
  }
  const ref = requireRef(args, 'projectRef');
  if (!STAGES.includes(args.stage)) {
    console.error(`ERROR: --stage must be one of ${STAGES.join('|')} (no default).\n`);
    console.error(HELP);
    process.exit(2);
  }
  const needsImport = args.stage !== 'functions';
  let source = null;
  if (needsImport) {
    source = requireRef(args, 'sourceRef');
    if (source !== PROJECTS.ziko) {
      console.error('ERROR: --source-ref must be the ziko project ref.');
      process.exit(2);
    }
  }
  assertWriteAllowed({ projectRef: ref, confirmRef: args.confirmRef });

  if (needsImport) {
    const present = await checkImportDone(ref, source);
    console.log(`ziko users already present on target: ${present}`);
    if (present <= 0) {
      console.error('REFUSING: triggers must be attached strictly after the user import (D-06).');
      process.exit(1);
    }
  }

  let ok = true;
  if (args.stage === 'functions' || args.stage === 'all') {
    await runSql(ref, await readFile(join(MIGRATIONS, FUNCTIONS_FILE), 'utf8'));
    console.log('applied gate functions');
    ok = (await confirmFunctions(ref)) && ok;
  }
  if (args.stage === 'triggers' || args.stage === 'all') {
    await runSql(ref, await readFile(join(MIGRATIONS, TRIGGERS_FILE), 'utf8'));
    console.log('applied triggers');
    ok = (await confirmFunctions(ref)) && ok;
    ok = (await confirmTriggers(ref)) && ok;
  }
  console.log(ok ? 'APPLY CONFIRMED' : 'APPLY FAILED');
  process.exit(ok ? 0 : 1);
}

if (isMain(import.meta.url)) {
  main().catch((err) => {
    console.error(`ERROR: ${err.message}`);
    process.exit(1);
  });
}
