#!/usr/bin/env node
/**
 * Read-only baseline snapshot of a Supabase project's pre-existing tenant + auth state.
 *
 * Writes ONE json file containing only UUIDs, booleans, md5 digests and counts. No email, no
 * password hash and no metadata content is ever written (it is meant to be committed).
 *
 * Usage:
 *   node scripts/auth-merge/00-baseline-snapshot.mjs --project-ref <ref> --out <path>
 *
 * --project-ref is REQUIRED (no default). All queries are SELECT-only.
 * Exit codes: 0 ok; 1 error; 2 bad arguments.
 *
 * collectBaseline(ref) is exported so 06-verify.mjs reuses the exact same queries.
 */

import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import {
  parseCliArgs,
  requireRef,
  runSql,
  isMain,
  assertProjectRefFormat,
  VOLATILE_AUTH_USER_COLUMNS,
  VOLATILE_AUTH_IDENTITY_COLUMNS,
} from './lib.mjs';

const IDENT_RE = /^[a-z0-9_]+$/;

const HELP = `00-baseline-snapshot.mjs - read-only baseline of tenant tables and auth state

Required:
  --project-ref <ref>   Project to snapshot. No default.
  --out <path>          Output JSON path.
Optional:
  --help, -h            Show this help.

Exit codes: 0 ok; 1 error; 2 bad arguments.
`;

const sqlList = (cols) => `ARRAY[${cols.map((c) => `'${c}'`).join(',')}]::text[]`;

export async function collectBaseline(ref) {
  assertProjectRefFormat(ref);

  // Tenant (non-ziko_) public tables with exact counts, generated from pg_tables at run time.
  const tableRows = await runSql(
    ref,
    `SELECT tablename,
            (xpath('/row/c/text()', query_to_xml(format('select count(*) as c from public.%I', tablename), false, true, '')))[1]::text::bigint AS n
       FROM pg_tables
      WHERE schemaname = 'public' AND left(tablename, 5) <> 'ziko_'
      ORDER BY tablename`
  );
  const tenant_tables = {};
  for (const r of tableRows) {
    if (!IDENT_RE.test(r.tablename)) throw new Error(`Unexpected table name shape: ${JSON.stringify(r.tablename)}`);
    tenant_tables[r.tablename] = Number(r.n);
  }

  const userRows = await runSql(
    ref,
    `SELECT u.id::text AS id,
            (u.encrypted_password IS NOT NULL) AS has_password,
            (u.instance_id IS NULL) AS instance_id_null,
            md5((to_jsonb(u) - 'confirmed_at' - 'encrypted_password' - 'instance_id' - ${sqlList(VOLATILE_AUTH_USER_COLUMNS)})::text) AS stable_hash,
            md5(((to_jsonb(u) || jsonb_build_object('confirmation_token', NULL, 'recovery_token', NULL, 'email_change_token_new', NULL, 'email_change', NULL)) - 'confirmed_at' - 'encrypted_password' - 'instance_id' - ${sqlList(VOLATILE_AUTH_USER_COLUMNS)})::text) AS stable_hash_tokens_nulled,
            (coalesce(u.confirmation_token, 'x') = '' AND coalesce(u.recovery_token, 'x') = '' AND coalesce(u.email_change_token_new, 'x') = '' AND coalesce(u.email_change, 'x') = '') AS token_cols_empty
       FROM auth.users u ORDER BY u.id`
  );
  const auth_users = userRows.map((r) => ({
    id: r.id,
    has_password: r.has_password,
    instance_id_null: r.instance_id_null,
    stable_hash: r.stable_hash,
    stable_hash_tokens_nulled: r.stable_hash_tokens_nulled,
    token_cols_empty: r.token_cols_empty,
  }));

  const identRows = await runSql(
    ref,
    `SELECT i.id::text AS id, i.user_id::text AS user_id, i.provider,
            md5((to_jsonb(i) - 'email' - ${sqlList(VOLATILE_AUTH_IDENTITY_COLUMNS)})::text) AS stable_hash
       FROM auth.identities i ORDER BY i.id`
  );
  const auth_identities = identRows.map((r) => ({
    id: r.id,
    user_id: r.user_id,
    provider: r.provider,
    stable_hash: r.stable_hash,
  }));

  const trigRows = await runSql(
    ref,
    `SELECT tgname, tgenabled::text AS tgenabled FROM pg_trigger
      WHERE tgrelid = 'auth.users'::regclass AND NOT tgisinternal ORDER BY tgname`
  );
  const auth_user_triggers = trigRows.map((r) => ({ name: r.tgname, enabled: r.tgenabled }));

  let ziko_waitlist_seq = null;
  const exists = await runSql(ref, `SELECT (to_regclass('public.ziko_waitlist_founder_seq') IS NOT NULL) AS present`);
  if (exists[0]?.present) {
    const seq = await runSql(ref, `SELECT last_value::text AS last_value, is_called FROM public.ziko_waitlist_founder_seq`);
    ziko_waitlist_seq = { last_value: Number(seq[0].last_value), is_called: seq[0].is_called };
  }

  return {
    taken_at: new Date().toISOString(),
    project_ref: ref,
    tenant_tables,
    auth_users,
    auth_identities,
    auth_user_triggers,
    ziko_waitlist_seq,
  };
}

async function main() {
  const args = parseCliArgs(process.argv.slice(2), { 'project-ref': 'string', out: 'string' });
  if (args.help) {
    console.log(HELP);
    return;
  }
  const ref = requireRef(args, 'projectRef');
  if (!args.out) {
    console.error('ERROR: --out <path> is required.\n');
    console.error(HELP);
    process.exit(2);
  }
  const baseline = await collectBaseline(ref);
  await mkdir(dirname(args.out), { recursive: true });
  await writeFile(args.out, JSON.stringify(baseline, null, 2) + '\n', 'utf8');
  console.log(`Baseline written: ${args.out}`);
  console.log(`  tenant tables : ${Object.keys(baseline.tenant_tables).length}`);
  console.log(`  auth users    : ${baseline.auth_users.length}`);
  console.log(`  auth identities: ${baseline.auth_identities.length}`);
  console.log(`  auth.users triggers: ${baseline.auth_user_triggers.length}`);
  console.log(`  waitlist seq  : ${baseline.ziko_waitlist_seq ? JSON.stringify(baseline.ziko_waitlist_seq) : 'absent'}`);
}

if (isMain(import.meta.url)) {
  main().catch((err) => {
    console.error(`ERROR: ${err.message}`);
    process.exit(1);
  });
}
