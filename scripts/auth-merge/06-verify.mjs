#!/usr/bin/env node
/**
 * Phase 3 verification suite: one idempotent CLI proving every auth-merge outcome on any target.
 *
 * Usage:
 *   node scripts/auth-merge/06-verify.mjs --project-ref <target> --check <name>
 *        [--source-ref <ziko>] [--baseline <file>] [--allow-instance-id-fill] [--allow-token-fill]
 *
 * Checks: users | identities | gotrue | triggers | signup | sequence | tenants | all
 *
 * Destructive probes (temporary password swap with restore, real signups) run on the scratch project
 * ONLY. Portfolio gets read-only checks plus the self-rolling-back trigger probe.
 * Output is limited to UUIDs, counts and booleans. Keys, tokens and hashes are never printed.
 * Exit codes: 0 all passed; 1 a check failed; 2 bad arguments.
 */

import { readFile } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
import {
  PROJECTS,
  KNOWN_COLLISION_SOURCE_IDS,
  VOLATILE_AUTH_USER_COLUMNS,
  VOLATILE_AUTH_IDENTITY_COLUMNS,
  parseCliArgs,
  requireRef,
  runSql,
  runSqlExpectError,
  fetchNonGeneratedColumns,
  intersectColumns,
  fetchEmailFingerprints,
  matchCollisions,
  getProjectApiKeys,
  chooseDollarTag,
  isMain,
} from './lib.mjs';
import { collectBaseline } from './00-baseline-snapshot.mjs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROBE_SQL = join(__dirname, 'sql', 'trigger-gate-probe.sql');
const CHECKS = ['users', 'identities', 'gotrue', 'triggers', 'signup', 'sequence', 'tenants', 'all'];
const NEEDS_SOURCE = new Set(['users', 'identities', 'gotrue', 'sequence', 'all']);
const NEEDS_BASELINE = new Set(['tenants', 'all']);
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const IDENT_RE = /^[a-z_][a-z0-9_]*$/;

const HELP = `06-verify.mjs - Phase 3 verification suite

Required:
  --project-ref <ref>        Target project. No default.
  --check <name>             users|identities|gotrue|triggers|signup|sequence|tenants|all
Conditional:
  --source-ref <ref>         ziko ref; required for users/identities/gotrue/sequence/all.
                             Optional for tenants (needed there only after the import, so the
                             approved collision fills are recognised).
  --baseline <file>          Baseline JSON; required for tenants/all.
Optional:
  --allow-instance-id-fill   Accept NULL -> all-zeros instance_id on the collision row (use only when
                             the import ran with --fill-null-instance-id).
  --allow-token-fill         Accept NULL -> '' on confirmation_token/recovery_token/email_change_token_new/
                             email_change of the collision row (use only when the import ran with
                             --fill-null-token-columns).
  --help, -h                 Show this help.

signup is accepted on the scratch project only. Exit codes: 0 pass; 1 fail; 2 bad arguments.
`;

// ---------------------------------------------------------------- pure evaluators

/** Parse the PROBE line produced by trigger-gate-probe.sql. */
export function parseProbeOutput(text) {
  const keys = ['unflagged_profiles', 'unflagged_credits', 'unflagged_txns', 'flagged_profiles', 'flagged_credits', 'flagged_txns'];
  const s = String(text ?? '');
  if (!/PROBE\s/.test(s)) throw new Error('No PROBE line found in probe output');
  const out = {};
  for (const k of keys) {
    const m = new RegExp(`\\b${k}=(\\d+)`).exec(s);
    if (!m) throw new Error(`PROBE line is missing ${k}`);
    out[k] = Number(m[1]);
  }
  return out;
}

/** Columns that participate in an equality digest: the input minus the shared volatile lists. */
export function digestColumns(table, cols) {
  let volatile;
  if (table === 'users') volatile = VOLATILE_AUTH_USER_COLUMNS;
  else if (table === 'identities') volatile = VOLATILE_AUTH_IDENTITY_COLUMNS;
  else throw new Error(`Unknown table for digest: ${table}`);
  return cols.filter((c) => !volatile.includes(c));
}

/**
 * Compare a fresh baseline snapshot with the stored one. Users/identities absent from the baseline
 * (new imports, new tenant signups) are ignored. Approved fills are one-directional (NULL -> value).
 */
export function evaluateTenants(baseline, current, { allowedPasswordFillIds = [], allowedInstanceIdFillIds = [], allowedTokenFillIds = [] } = {}) {
  const failures = [];
  const warnings = [];
  const pwOk = new Set(allowedPasswordFillIds);
  const instOk = new Set(allowedInstanceIdFillIds);
  const tokOk = new Set(allowedTokenFillIds);

  for (const [table, before] of Object.entries(baseline.tenant_tables ?? {})) {
    if (!(table in (current.tenant_tables ?? {}))) {
      failures.push(`tenant table missing: ${table}`);
      continue;
    }
    const delta = current.tenant_tables[table] - before;
    if (delta !== 0) warnings.push(`row count drift in ${table}: ${delta > 0 ? '+' : ''}${delta}`);
  }

  const cur = new Map((current.auth_users ?? []).map((u) => [u.id, u]));
  for (const b of baseline.auth_users ?? []) {
    const c = cur.get(b.id);
    if (!c) {
      failures.push(`baseline auth user missing: ${b.id}`);
      continue;
    }
    if (c.stable_hash !== b.stable_hash) {
      // Approved NULL -> '' fill of the four GoTrue token columns: the row must be identical to the baseline
      // once those four columns are masked to NULL, and the four columns must now be exactly ''.
      const tokenFillOnly = tokOk.has(b.id) && c.token_cols_empty === true && c.stable_hash_tokens_nulled === b.stable_hash;
      if (!tokenFillOnly) failures.push(`auth user changed (stable hash): ${b.id}`);
    }
    if (b.has_password && !c.has_password) failures.push(`password removed: ${b.id}`);
    else if (!b.has_password && c.has_password && !pwOk.has(b.id)) failures.push(`unexpected password fill: ${b.id}`);
    if (!b.instance_id_null && c.instance_id_null) failures.push(`instance_id reset to NULL: ${b.id}`);
    else if (b.instance_id_null && !c.instance_id_null && !instOk.has(b.id)) failures.push(`unexpected instance_id fill: ${b.id}`);
  }

  const curIdent = new Map((current.auth_identities ?? []).map((i) => [i.id, i]));
  for (const b of baseline.auth_identities ?? []) {
    const c = curIdent.get(b.id);
    if (!c) failures.push(`baseline identity missing: ${b.id}`);
    else if (c.stable_hash !== b.stable_hash) failures.push(`identity changed: ${b.id}`);
  }

  const foreign = (list) =>
    new Map((list ?? []).filter((t) => !String(t.name).startsWith('ziko_')).map((t) => [t.name, t.enabled]));
  const bt = foreign(baseline.auth_user_triggers);
  const ct = foreign(current.auth_user_triggers);
  for (const [name, en] of bt) {
    if (!ct.has(name)) failures.push(`non-ziko auth.users trigger removed: ${name}`);
    else if (ct.get(name) !== en) failures.push(`non-ziko auth.users trigger changed state: ${name}`);
  }
  for (const name of ct.keys()) if (!bt.has(name)) failures.push(`non-ziko auth.users trigger added: ${name}`);

  return { failures, warnings };
}

// ---------------------------------------------------------------- helpers

const ok = (detail) => ({ ok: true, detail });
const fail = (detail) => ({ ok: false, detail });

function uuidList(ids) {
  for (const id of ids) if (!UUID_RE.test(id)) throw new Error('Non-UUID id encountered');
  return `ARRAY[${ids.map((i) => `'${i}'`).join(',')}]::uuid[]`;
}

function digestExpr(alias, cols) {
  for (const c of cols) if (!IDENT_RE.test(c)) throw new Error('Unsafe column identifier');
  const list = `ARRAY[${cols.map((c) => `'${c}'`).join(',')}]::text[]`;
  return `md5((SELECT jsonb_object_agg(e.k, e.v) FROM jsonb_each(to_jsonb(${alias})) e(k, v) WHERE e.k = ANY(${list}))::text)`;
}

async function fetchDigests(ref, table, cols) {
  const dc = digestColumns(table, cols);
  if (table === 'users') {
    return runSql(ref, `SELECT u.id::text AS id, ${digestExpr('u', dc)} AS d FROM auth.users u ORDER BY u.id`);
  }
  return runSql(ref, `SELECT i.id::text AS id, i.user_id::text AS user_id, ${digestExpr('i', dc)} AS d FROM auth.identities i ORDER BY i.id`);
}

async function commonCols(source, target, table) {
  const [a, b] = await Promise.all([fetchNonGeneratedColumns(source, table), fetchNonGeneratedColumns(target, table)]);
  return intersectColumns(a, b);
}

function makeContext(args, source, target) {
  let match;
  return {
    args,
    source,
    target,
    async getMatch() {
      if (!match) {
        const [src, tgt] = await Promise.all([fetchEmailFingerprints(source), fetchEmailFingerprints(target)]);
        match = { src, tgt, ...matchCollisions(src, tgt) };
      }
      return match;
    },
  };
}

const API = (ref) => `https://${ref}.supabase.co`;

async function httpJson(url, init) {
  const res = await fetch(url, init);
  let body = null;
  try {
    body = await res.json();
  } catch {
    /* no body */
  }
  return { status: res.status, body };
}

// ---------------------------------------------------------------- checks

async function checkUsers(ctx) {
  const m = await ctx.getMatch();
  const problems = [];
  if (m.idConflicts.length) problems.push(`${m.idConflicts.length} id conflicts`);
  const unknown = m.collisions.filter((c) => !KNOWN_COLLISION_SOURCE_IDS.includes(c.sourceId));
  if (unknown.length) problems.push(`${unknown.length} unknown collisions`);
  const targetIds = new Set(m.tgt.map((t) => t.id));
  for (const id of KNOWN_COLLISION_SOURCE_IDS) if (targetIds.has(id)) problems.push(`collision source id present on target: ${id}`);

  const cols = await commonCols(ctx.source, ctx.target, 'users');
  const [sd, td] = await Promise.all([fetchDigests(ctx.source, 'users', cols), fetchDigests(ctx.target, 'users', cols)]);
  const tmap = new Map(td.map((r) => [r.id, r.d]));
  let compared = 0;
  let mismatched = 0;
  for (const r of sd) {
    if (KNOWN_COLLISION_SOURCE_IDS.includes(r.id)) continue;
    compared++;
    if (tmap.get(r.id) !== r.d) {
      mismatched++;
      problems.push(`digest mismatch: ${r.id}`);
    }
  }
  const total = m.alreadyImported.length + m.collisions.length;
  if (total !== m.src.length) problems.push(`ziko total ${m.src.length} != imported+merged ${total}`);
  const detail = `ziko=${m.src.length} imported=${m.alreadyImported.length} merged=${m.collisions.length} compared=${compared} mismatched=${mismatched}`;
  return problems.length ? fail(`${detail}; ${problems.slice(0, 10).join('; ')}`) : ok(detail);
}

async function checkIdentities(ctx) {
  const m = await ctx.getMatch();
  const problems = [];
  const collisionSrc = new Set(m.collisions.map((c) => c.sourceId));
  const cols = await commonCols(ctx.source, ctx.target, 'identities');
  const [sd, td] = await Promise.all([fetchDigests(ctx.source, 'identities', cols), fetchDigests(ctx.target, 'identities', cols)]);
  const tmap = new Map(td.map((r) => [r.id, r.d]));
  let compared = 0;
  for (const r of sd) {
    if (collisionSrc.has(r.user_id)) continue;
    compared++;
    if (tmap.get(r.id) !== r.d) problems.push(`identity digest mismatch: ${r.id}`);
  }
  for (const c of m.collisions) {
    const rows = await runSql(
      ctx.target,
      `SELECT count(*)::int AS n,
              count(*) FILTER (WHERE provider_id = '${c.targetId}' AND identity_data->>'sub' = '${c.targetId}')::int AS good
         FROM auth.identities WHERE user_id = '${c.targetId}' AND provider = 'email'`
    );
    if (rows[0].n !== 1 || rows[0].good !== 1) problems.push(`collision ${c.targetId}: email identities=${rows[0].n} well-formed=${rows[0].good}`);
  }
  const detail = `compared=${compared} collisions=${m.collisions.length}`;
  return problems.length ? fail(`${detail}; ${problems.slice(0, 10).join('; ')}`) : ok(detail);
}

async function loginOnce(target, publishable, email, password) {
  const { status, body } = await httpJson(`${API(target)}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: publishable, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  return status === 200 && typeof body?.access_token === 'string';
}

async function scratchLogin(target, publishable, id) {
  const [row] = await runSql(
    target,
    `SELECT email, encrypted_password AS ep, md5(coalesce(encrypted_password, '')) AS d FROM auth.users WHERE id = '${id}'`
  );
  if (!row?.email) return { ok: false, why: 'no email' };
  const throwaway = randomBytes(18).toString('base64url');
  try {
    await runSql(target, `UPDATE auth.users SET encrypted_password = crypt('${throwaway}', gen_salt('bf')) WHERE id = '${id}'`);
    const good = await loginOnce(target, publishable, row.email, throwaway);
    return { ok: good, why: good ? '' : 'grant rejected' };
  } finally {
    const tag = chooseDollarTag(row.ep ?? '');
    const restore = row.ep == null ? 'NULL' : `${tag}${row.ep}${tag}`;
    await runSql(target, `UPDATE auth.users SET encrypted_password = ${restore} WHERE id = '${id}'`);
    const [after] = await runSql(target, `SELECT md5(coalesce(encrypted_password, '')) AS d FROM auth.users WHERE id = '${id}'`);
    if (after.d !== row.d) throw new Error(`Stored credential for ${id} was NOT restored exactly`);
  }
}

async function checkGotrue(ctx) {
  const m = await ctx.getMatch();
  const keys = await getProjectApiKeys(ctx.target);
  const collisionTargets = m.collisions.map((c) => c.targetId);
  const problems = [];
  if (ctx.target === PROJECTS.scratch) {
    const sample = m.alreadyImported[0];
    const ids = [...(sample ? [sample] : []), ...collisionTargets];
    for (const id of ids) {
      const r = await scratchLogin(ctx.target, keys.publishable, id);
      if (!r.ok) problems.push(`login failed for ${id}: ${r.why}`);
    }
    const detail = `password grant on scratch for ${ids.length} users`;
    return problems.length ? fail(`${detail}; ${problems.join('; ')}`) : ok(detail);
  }
  const ids = [...m.alreadyImported, ...collisionTargets];
  const headers = { apikey: keys.secret, Authorization: `Bearer ${keys.secret}` };
  for (const id of ids) {
    const { status, body } = await httpJson(`${API(ctx.target)}/auth/v1/admin/users/${id}`, { headers });
    if (status !== 200 || body?.id !== id) problems.push(`admin lookup failed for ${id} (HTTP ${status})`);
  }
  const detail = `admin lookup (read-only) for ${ids.length} users`;
  return problems.length ? fail(`${detail}; ${problems.slice(0, 10).join('; ')}`) : ok(detail);
}

async function checkTriggers(ctx) {
  const problems = [];
  const trig = await runSql(
    ctx.target,
    `SELECT tgname, tgenabled::text AS en FROM pg_trigger
      WHERE tgrelid = 'auth.users'::regclass AND NOT tgisinternal AND tgname LIKE 'ziko\\_%' ORDER BY tgname`
  );
  if (trig.length !== 2 || trig.some((t) => t.en !== 'O')) problems.push(`expected 2 enabled ziko_ triggers, got ${trig.length}`);
  const fns = await runSql(
    ctx.target,
    `SELECT proname, position('raw_user_meta_data->>''app''' IN prosrc) > 0 AS gated FROM pg_proc
      WHERE pronamespace = 'public'::regnamespace AND proname IN ('ziko_handle_new_user', 'ziko_handle_new_user_credits')`
  );
  if (fns.length !== 2 || fns.some((f) => !f.gated)) problems.push('gate missing from function bodies');

  const probeText = await runSqlExpectError(ctx.target, await readFile(PROBE_SQL, 'utf8'));
  const p = parseProbeOutput(probeText);
  const expected = { unflagged_profiles: 0, unflagged_credits: 0, unflagged_txns: 0, flagged_profiles: 1, flagged_credits: 1, flagged_txns: 1 };
  for (const [k, v] of Object.entries(expected)) if (p[k] !== v) problems.push(`probe ${k}=${p[k]} expected ${v}`);

  const resid = await runSql(ctx.target, `SELECT count(*)::int AS n FROM auth.users WHERE email LIKE 'probe-%@example.invalid'`);
  if (resid[0].n !== 0) problems.push(`${resid[0].n} residual probe users`);
  const detail = `triggers=${trig.length} probe=${Object.values(p).join(' ')} residual=${resid[0].n}`;
  return problems.length ? fail(`${detail}; ${problems.join('; ')}`) : ok(detail);
}

async function checkSignup(ctx) {
  if (ctx.target !== PROJECTS.scratch) return fail('signup check runs on the scratch project only');
  const keys = await getProjectApiKeys(ctx.target);
  const headers = { apikey: keys.secret, Authorization: `Bearer ${keys.secret}`, 'Content-Type': 'application/json' };
  const created = [];
  const problems = [];
  let detail = '';
  try {
    const mk = async (label, meta) => {
      const stamp = randomBytes(6).toString('hex');
      const { status, body } = await httpJson(`${API(ctx.target)}/auth/v1/admin/users`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          email: `verify-${label}-${stamp}@example.invalid`,
          password: randomBytes(18).toString('base64url'),
          email_confirm: true,
          user_metadata: meta,
        }),
      });
      if (!body?.id) throw new Error(`admin user create failed (HTTP ${status})`);
      created.push(body.id);
      return body.id;
    };
    const unflagged = await mk('plain', {});
    const flagged = await mk('ziko', { app: 'ziko' });
    const count = async (id) => {
      const r = await runSql(
        ctx.target,
        `SELECT (SELECT count(*) FROM public.ziko_user_profiles WHERE id = '${id}')::int AS p,
                (SELECT count(*) FROM public.ziko_user_ai_credits WHERE user_id = '${id}')::int AS c,
                (SELECT count(*) FROM public.ziko_ai_credit_transactions WHERE user_id = '${id}')::int AS t`
      );
      return [r[0].p, r[0].c, r[0].t];
    };
    const u = await count(unflagged);
    const f = await count(flagged);
    if (u.join() !== '0,0,0') problems.push(`unflagged rows ${u.join('/')}`);
    if (f.join() !== '1,1,1') problems.push(`flagged rows ${f.join('/')}`);
    detail = `unflagged=${u.join('/')} flagged=${f.join('/')}`;
  } finally {
    for (const id of created) {
      await httpJson(`${API(ctx.target)}/auth/v1/admin/users/${id}`, { method: 'DELETE', headers }).catch(() => {});
    }
  }
  if (created.length) {
    const arr = uuidList(created);
    const r = await runSql(
      ctx.target,
      `SELECT (SELECT count(*) FROM auth.users WHERE id = ANY(${arr}))::int AS u,
              (SELECT count(*) FROM public.ziko_user_profiles WHERE id = ANY(${arr}))::int AS p,
              (SELECT count(*) FROM public.ziko_user_ai_credits WHERE user_id = ANY(${arr}))::int AS c,
              (SELECT count(*) FROM public.ziko_ai_credit_transactions WHERE user_id = ANY(${arr}))::int AS t`
    );
    const left = r[0].u + r[0].p + r[0].c + r[0].t;
    if (left !== 0) problems.push(`${left} residual rows after cleanup`);
    detail += ` residual=${left}`;
  }
  return problems.length ? fail(`${detail}; ${problems.join('; ')}`) : ok(detail);
}

async function checkSequence(ctx) {
  const rd = async (ref, name) => {
    const r = await runSql(ref, `SELECT last_value::text AS lv, is_called FROM public.${name}`);
    return `${r[0].lv}/${r[0].is_called}`;
  };
  const [s, t] = await Promise.all([rd(ctx.source, 'waitlist_founder_seq'), rd(ctx.target, 'ziko_waitlist_founder_seq')]);
  return s === t ? ok(`sequence equal (${t})`) : fail(`sequence differs: source=${s} target=${t}`);
}

async function checkTenants(ctx) {
  const baseline = JSON.parse(await readFile(ctx.args.baseline, 'utf8'));
  const current = await collectBaseline(ctx.target);
  let collisionTargets = [];
  if (ctx.source) {
    const m = await ctx.getMatch();
    collisionTargets = m.collisions.map((c) => c.targetId);
  }
  const { failures, warnings } = evaluateTenants(baseline, current, {
    allowedPasswordFillIds: collisionTargets,
    allowedInstanceIdFillIds: ctx.args.allowInstanceIdFill ? collisionTargets : [],
    allowedTokenFillIds: ctx.args.allowTokenFill ? collisionTargets : [],
  });
  for (const w of warnings) console.log(`  [WARN] ${w}`);
  const detail = `baseline users=${baseline.auth_users.length} warnings=${warnings.length}`;
  return failures.length ? fail(`${detail}; ${failures.slice(0, 10).join('; ')}`) : ok(detail);
}

const RUNNERS = {
  users: checkUsers,
  identities: checkIdentities,
  gotrue: checkGotrue,
  triggers: checkTriggers,
  signup: checkSignup,
  sequence: checkSequence,
  tenants: checkTenants,
};

async function main() {
  const args = parseCliArgs(process.argv.slice(2), {
    'project-ref': 'string',
    'source-ref': 'string',
    check: 'string',
    baseline: 'string',
    'allow-instance-id-fill': 'boolean',
    'allow-token-fill': 'boolean',
  });
  if (args.help) {
    console.log(HELP);
    return;
  }
  const target = requireRef(args, 'projectRef');
  if (!CHECKS.includes(args.check)) {
    console.error(`ERROR: --check must be one of ${CHECKS.join('|')}.\n`);
    process.exit(2);
  }
  let source = null;
  if (NEEDS_SOURCE.has(args.check) || args.sourceRef) {
    source = requireRef(args, 'sourceRef');
    if (source !== PROJECTS.ziko) {
      console.error('ERROR: --source-ref must be the ziko project ref.');
      process.exit(2);
    }
  }
  if (NEEDS_BASELINE.has(args.check) && !args.baseline) {
    console.error('ERROR: --baseline <file> is required for tenants/all.');
    process.exit(2);
  }

  const ctx = makeContext(args, source, target);
  const names = args.check === 'all'
    ? ['users', 'identities', 'gotrue', 'triggers', 'sequence', 'tenants', ...(target === PROJECTS.scratch ? ['signup'] : [])]
    : [args.check];

  let allOk = true;
  for (const name of names) {
    let r;
    try {
      r = await RUNNERS[name](ctx);
    } catch (err) {
      r = fail(`error: ${err.message}`);
    }
    console.log(`[${r.ok ? 'PASS' : 'FAIL'}] ${name}: ${r.detail}`);
    if (!r.ok) allOk = false;
  }
  console.log(allOk ? 'VERIFICATION PASSED' : 'VERIFICATION FAILED');
  process.exit(allOk ? 0 : 1);
}

if (isMain(import.meta.url)) {
  main().catch((err) => {
    console.error(`ERROR: ${err.message}`);
    process.exit(1);
  });
}
