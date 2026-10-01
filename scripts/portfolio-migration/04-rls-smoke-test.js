#!/usr/bin/env node
/**
 * Authenticated owner-vs-non-owner RLS smoke test for the ziko_* tables.
 *
 * Imitates backend/api/test/rls/workout-programs.spec.ts: for every table in
 * rename-map.generated.json.tables whose live schema has a `user_id` column, seed one row owned by
 * user A, then assert (a) user A (authenticated) can read it and (b) user B (authenticated,
 * non-owner) cannot. This proves real RLS behavior, not just relrowsecurity = true.
 *
 * Usage:
 *   node scripts/portfolio-migration/04-rls-smoke-test.js \
 *     --project-url <https://<ref>.supabase.co> \
 *     --service-role-key <key> \
 *     --publishable-key <key>        (anon/publishable key; needed to sign in as the test users)
 *   Optional: --allow-public <table,table>  tables intentionally readable by strangers (reported, not failed)
 *             --strict                      treat tables that could not be seeded as failures
 *             --help
 *
 * The project is ALWAYS passed explicitly. This script never reads the bare SUPABASE_URL /
 * SUPABASE_SERVICE_ROLE_KEY env vars (they implicitly mean "ziko" elsewhere in this repo), so it
 * cannot accidentally run writes against the wrong project (threat T-2-02).
 *
 * Scope split: tables without a user_id column are SKIPPED (listed explicitly) and are covered by
 * 03-verify-post-apply.sql's pg_policies / relrowsecurity checks instead.
 *
 * SERVICE-ROLE ONLY IN TESTS: never import this from backend/api/src/**.
 */

const { randomUUID } = require('node:crypto');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');

const HELP = `04-rls-smoke-test.js - authenticated owner-vs-non-owner RLS smoke test

Required:
  --project-url <url>        Target project URL (scratch or portfolio). No env fallback.
  --service-role-key <key>   Service-role key for that project (creates/deletes test users, seeds rows).
  --publishable-key <key>    Publishable/anon key for that project (signs in as the test users).

Optional:
  --allow-public <a,b,...>   Old-or-new table names intentionally readable by strangers (reported only).
  --strict                   Fail if a user_id table could not be seeded (default: reported as skipped).
  --help, -h                 Show this help and exit 0.

Exit codes: 0 no leaks; 1 a tested table leaked a row to the non-owner (or fatal error); 2 bad arguments.
`;

function parseArgs(argv) {
  const args = { help: false, strict: false, allowPublic: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--help' || a === '-h') args.help = true;
    else if (a === '--strict') args.strict = true;
    else if (a === '--project-url') args.projectUrl = argv[++i];
    else if (a === '--service-role-key') args.serviceRoleKey = argv[++i];
    else if (a === '--publishable-key') args.publishableKey = argv[++i];
    else if (a === '--allow-public') args.allowPublic = (argv[++i] ?? '').split(',').filter(Boolean);
    else {
      console.error(`Unknown argument: ${a}\n\n${HELP}`);
      process.exit(2);
    }
  }
  return args;
}

const args = parseArgs(process.argv.slice(2));
if (args.help) {
  console.log(HELP);
  process.exit(0);
}
for (const [flag, val] of [
  ['--project-url', args.projectUrl],
  ['--service-role-key', args.serviceRoleKey],
  ['--publishable-key', args.publishableKey],
]) {
  if (!val) {
    console.error(`ERROR: ${flag} is required (no env var fallback, to avoid targeting the wrong project).\n\n${HELP}`);
    process.exit(2);
  }
}

// Loaded after arg validation so --help / bad-arg paths never need the dependency.
const { createClient } = require('@supabase/supabase-js');

const PROJECT_URL = args.projectUrl.replace(/\/+$/, '');
const noPersist = { auth: { autoRefreshToken: false, persistSession: false } };
const admin = createClient(PROJECT_URL, args.serviceRoleKey, noPersist);

/** Mirrors fixtures.ts createTestUser: admin-created confirmed user + signed-in publishable-key client. */
async function createTestUser(prefix) {
  const email = `${prefix}-${randomUUID().slice(0, 8)}@ziko.test`;
  const password = `Pw-${randomUUID()}`;
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error || !data?.user) throw new Error(`createUser failed: ${error?.message}`);
  const id = data.user.id; // tracked by caller immediately so cleanup still runs if sign-in fails
  return { id, email, password };
}

async function getAuthedClient(user) {
  const client = createClient(PROJECT_URL, args.publishableKey, noPersist);
  const { error } = await client.auth.signInWithPassword({ email: user.email, password: user.password });
  if (error) throw new Error(`signIn failed for ${user.email}: ${error.message}`);
  return client;
}

/** PostgREST OpenAPI root (service role) lists every exposed table's properties + required columns. */
async function fetchSchemaDefinitions() {
  const res = await fetch(`${PROJECT_URL}/rest/v1/`, {
    headers: { apikey: args.serviceRoleKey, Authorization: `Bearer ${args.serviceRoleKey}` },
  });
  if (!res.ok) throw new Error(`OpenAPI schema fetch failed: HTTP ${res.status}`);
  const spec = await res.json();
  return spec.definitions ?? {};
}

/** Best-effort minimal row for a table, driven by the OpenAPI definition's required columns. */
function buildSeedRow(def, ownerId) {
  const row = { user_id: ownerId };
  for (const col of def.required ?? []) {
    if (col === 'user_id' || col in row) continue;
    const p = def.properties?.[col] ?? {};
    if (p.default !== undefined) continue; // DB default will fill it
    if (p.enum?.length) row[col] = p.enum[0];
    else if (p.format === 'uuid') row[col] = randomUUID();
    else if (p.type === 'integer' || p.type === 'number') row[col] = 0;
    else if (p.type === 'boolean') row[col] = false;
    else if (p.format?.startsWith('timestamp')) row[col] = new Date().toISOString();
    else if (p.format === 'date') row[col] = new Date().toISOString().slice(0, 10);
    else if (p.type === 'object' || p.format === 'jsonb' || p.format === 'json') row[col] = {};
    else if (p.type === 'array') row[col] = [];
    else row[col] = 'smoke-test';
  }
  return row;
}

async function main() {
  const map = JSON.parse(readFileSync(join(__dirname, 'rename-map.generated.json'), 'utf8'));
  const oldNames = Object.keys(map.tables);
  const allowPublic = new Set(args.allowPublic.flatMap((n) => [n, n.replace(/^ziko_/, '')]));

  const definitions = await fetchSchemaDefinitions();
  const tested = [];
  const skipped = [];
  const failures = [];
  const createdUserIds = [];
  const seeded = []; // { table, userId }

  try {
    const a = await createTestUser('rls-smoke-a');
    createdUserIds.push(a.id);
    const b = await createTestUser('rls-smoke-b');
    createdUserIds.push(b.id);
    const clientA = await getAuthedClient(a);
    const clientB = await getAuthedClient(b);

    for (const oldName of oldNames) {
      const table = map.tables[oldName];
      const def = definitions[table];
      if (!def) {
        skipped.push({ table, reason: 'not exposed via PostgREST (missing from schema)' });
        continue;
      }
      if (!def.properties || !('user_id' in def.properties)) {
        skipped.push({ table, reason: 'no user_id column (covered by 03-verify-post-apply.sql)' });
        continue;
      }

      const seed = await admin.from(table).insert(buildSeedRow(def, a.id));
      if (seed.error) {
        skipped.push({ table, reason: `could not seed row: ${seed.error.message}`, seedFailure: true });
        continue;
      }
      seeded.push({ table, userId: a.id });

      const own = await clientA.from(table).select('user_id').eq('user_id', a.id);
      const other = await clientB.from(table).select('user_id').eq('user_id', a.id);
      const ownerRows = own.data?.length ?? 0;
      const leakedRows = other.data?.length ?? 0;
      // A permission-denied error for the stranger is a valid (non-leaking) outcome.
      const otherDenied = other.error && (other.error.code === '42501' || /permission denied/i.test(other.error.message));
      const otherBroken = other.error && !otherDenied;

      const result = { table, ownerRows, leakedRows, ownerError: own.error?.message, otherError: other.error?.message };
      if (leakedRows > 0 && !allowPublic.has(table)) {
        failures.push({ ...result, why: `non-owner read ${leakedRows} row(s) owned by another user` });
      } else if (otherBroken) {
        failures.push({ ...result, why: `non-owner query errored unexpectedly: ${other.error.message}` });
      } else if (own.error) {
        failures.push({ ...result, why: `owner query errored: ${own.error.message}` });
      } else if (ownerRows === 0 && !otherDenied) {
        failures.push({ ...result, why: 'owner cannot read own row (policy over-restrictive or stale reference)' });
      } else {
        tested.push({ ...result, publicByDesign: leakedRows > 0 });
      }
    }
  } finally {
    // Always runs, pass or fail: remove seeded rows, then the users (FK CASCADE wipes any remainder).
    for (const s of seeded) {
      await admin.from(s.table).delete().eq('user_id', s.userId).then(() => {}, () => {});
    }
    for (const id of createdUserIds) {
      await admin.auth.admin.deleteUser(id).catch((e) => console.error(`WARN: failed to delete test user ${id}: ${e.message}`));
    }
  }

  const seedFailures = skipped.filter((s) => s.seedFailure);
  console.log('\n=== RLS smoke test summary ===');
  console.log(`Tables tested (pass): ${tested.length}`);
  console.log(`Tables failed:        ${failures.length}`);
  console.log(`Tables skipped:       ${skipped.length}`);
  for (const t of tested.filter((x) => x.publicByDesign)) console.log(`  [public-by-design] ${t.table}`);
  console.log('\nSkipped tables:');
  for (const s of skipped) console.log(`  - ${s.table}: ${s.reason}`);
  if (failures.length) {
    console.log('\nFAILURES:');
    for (const f of failures) console.log(`  - ${f.table}: ${f.why}`);
  }

  const failed = failures.length > 0 || (args.strict && seedFailures.length > 0);
  console.log(failed ? '\nRLS SMOKE TEST FAILED' : '\nRLS SMOKE TEST PASSED');
  process.exit(failed ? 1 : 0);
}

main().catch((err) => {
  console.error(err.message ?? err);
  process.exit(1);
});
