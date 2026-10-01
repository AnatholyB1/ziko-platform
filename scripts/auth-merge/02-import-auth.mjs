/**
 * Phase 3 auth import: copy ziko auth.users / auth.identities into the target project (D-08, D-09).
 *
 * Modes (exactly one; default --plan):
 *   --plan          read-only counts + collision summary
 *   --dry-run       full import inside a transaction that is always rolled back (counts in stderr)
 *   --apply         real import (single transaction, count assertion) + --remap-out file
 *   --delta-report  read-only: UUIDs of already-imported users whose password / other fields changed
 * Modifier: --apply-password-updates (only with --dry-run / --apply).
 *
 * Safety: ziko is never a target; portfolio needs --confirm-ref; collision gate re-runs every time (D-04);
 * only the known collision is merged and the portfolio row is never re-keyed or deleted (D-02).
 * Console output: UUIDs, counts, booleans, masked values only. Payload lives in an OS temp file (lib).
 */

import { readFile, writeFile } from 'node:fs/promises';
import {
  PROJECTS,
  KNOWN_COLLISION_SOURCE_IDS,
  parseCliArgs,
  requireRef,
  assertWriteAllowed,
  runSql,
  runSqlExpectError,
  fetchNonGeneratedColumns,
  intersectColumns,
  fetchEmailFingerprints,
  matchCollisions,
  chooseDollarTag,
  redactPii,
  isMain,
} from './lib.mjs';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const DIGEST_RE = /^[0-9a-f]{32}$/;
const IDENT_RE = /^[a-z_][a-z0-9_]*$/;
const ZERO_UUID = '00000000-0000-0000-0000-000000000000';
/** auth.users token columns GoTrue scans as non-NULL strings; a NULL here makes admin GET return HTTP 500. */
export const TOKEN_COLUMNS = Object.freeze(['confirmation_token', 'recovery_token', 'email_change_token_new', 'email_change']);

/**
 * Merge a freshly produced remap list into a previously written one (idempotent re-runs must not erase
 * the historical truth of the first apply). Booleans are OR-ed, token_columns_filled counts are summed.
 */
export function mergeRemaps(existing, fresh) {
  const key = (r) => `${r.source_user_id}>${r.target_user_id}`;
  const out = new Map((existing ?? []).map((r) => [key(r), { ...r }]));
  for (const r of fresh ?? []) {
    const prev = out.get(key(r));
    if (!prev) {
      out.set(key(r), { ...r });
      continue;
    }
    for (const [k, v] of Object.entries(r)) {
      if (typeof v === 'boolean') prev[k] = Boolean(prev[k]) || v;
      else if (k === 'token_columns_filled') prev[k] = Number(prev[k] ?? 0) + Number(v ?? 0);
      else prev[k] = v;
    }
  }
  return [...out.values()];
}

function uuid(v, label) {
  if (typeof v !== 'string' || !UUID_RE.test(v)) throw new Error(`Invalid UUID for ${label}`);
  return v;
}

function colList(cols, prefix = '') {
  return cols
    .map((c) => {
      if (!IDENT_RE.test(c)) throw new Error('Unsafe column identifier');
      return `${prefix}"${c}"`;
    })
    .join(', ');
}

/**
 * Pure SQL builder. Data travels only inside dollar-quoted JSON literals; UUIDs are regex-validated.
 */
export function buildImportSql({
  userCols,
  identityCols,
  users,
  identities,
  collisions = [],
  mode = 'apply',
  expectedPresent,
  fillNullInstanceId = false,
  fillNullTokenColumns = false,
  passwordUpdates = [],
  tag,
}) {
  if (mode !== 'apply' && mode !== 'dry-run') throw new Error(`Unknown mode: ${mode}`);
  if (!Number.isInteger(expectedPresent) || expectedPresent < 0) throw new Error('expectedPresent must be a non-negative integer');
  const usersJson = JSON.stringify(users);
  const identitiesJson = JSON.stringify(identities);
  const T = tag ?? chooseDollarTag(usersJson + identitiesJson);
  if (usersJson.includes(T) || identitiesJson.includes(T)) throw new Error('Dollar tag occurs inside payload');

  const colls = collisions.map((c, i) => ({
    sourceId: uuid(c.sourceId, `collision[${i}].sourceId`),
    targetId: uuid(c.targetId, `collision[${i}].targetId`),
  }));
  const srcIds = colls.map((c) => c.sourceId);
  const tgtIds = colls.map((c) => c.targetId);
  const blocked = new Set([...srcIds, ...tgtIds]);
  const arr = (ids) => `ARRAY[${ids.map((i) => `'${i}'`).join(', ')}]::uuid[]`;

  const payloadIds = new Set(users.map((u) => u.id));
  for (const [i, p] of passwordUpdates.entries()) {
    uuid(p.id, `passwordUpdates[${i}].id`);
    if (blocked.has(p.id)) throw new Error('passwordUpdates must not include a collision source or target id (D-03)');
    if (!payloadIds.has(p.id)) throw new Error('passwordUpdates id not present in users payload');
    if (typeof p.expectedTargetDigest !== 'string' || !DIGEST_RE.test(p.expectedTargetDigest)) {
      throw new Error('expectedTargetDigest must be 32 lowercase hex chars');
    }
  }

  const uc = colList(userCols);
  const ic = colList(identityCols);
  const out = [];
  out.push('BEGIN;');
  out.push(`CREATE TEMP TABLE _am_counts (k text, ref text, v int);`);
  out.push(
    `CREATE TEMP TABLE _am_users ON COMMIT DROP AS SELECT * FROM jsonb_populate_recordset(null::auth.users, ${T}${usersJson}${T}::jsonb);`
  );
  out.push(
    `CREATE TEMP TABLE _am_identities ON COMMIT DROP AS SELECT * FROM jsonb_populate_recordset(null::auth.identities, ${T}${identitiesJson}${T}::jsonb);`
  );
  out.push(
    `INSERT INTO auth.users (${uc}) SELECT ${colList(userCols, 's.')} FROM _am_users s WHERE s.id <> ALL(${arr(srcIds)}) ON CONFLICT (id) DO NOTHING;`
  );
  out.push(
    `INSERT INTO auth.identities (${ic}) SELECT ${colList(identityCols, 's.')} FROM _am_identities s WHERE s.user_id <> ALL(${arr(srcIds)}) ON CONFLICT (id) DO NOTHING;`
  );

  for (const c of colls) {
    out.push(
      `WITH u AS (UPDATE auth.users SET encrypted_password = (SELECT s.encrypted_password FROM _am_users s WHERE s.id = '${c.sourceId}') WHERE id = '${c.targetId}' AND encrypted_password IS NULL RETURNING 1) INSERT INTO _am_counts SELECT 'password_filled', '${c.targetId}', count(*) FROM u;`
    );
    const exprs = identityCols.map((col) => {
      if (col === 'id') return 'gen_random_uuid()';
      if (col === 'provider_id') return `'${c.targetId}'`;
      if (col === 'user_id') return `'${c.targetId}'::uuid`;
      if (col === 'identity_data') return `jsonb_set(s."identity_data", '{sub}', to_jsonb('${c.targetId}'::text))`;
      return `s."${col}"`;
    });
    out.push(
      `WITH i AS (INSERT INTO auth.identities (${ic}) SELECT ${exprs.join(', ')} FROM _am_identities s WHERE s.user_id = '${c.sourceId}' AND NOT EXISTS (SELECT 1 FROM auth.identities x WHERE x.user_id = '${c.targetId}' AND x.provider = 'email') ON CONFLICT (id) DO NOTHING RETURNING 1) INSERT INTO _am_counts SELECT 'identity_inserted', '${c.targetId}', count(*) FROM i;`
    );
    if (fillNullInstanceId) {
      out.push(
        `WITH n AS (UPDATE auth.users SET instance_id = '${ZERO_UUID}' WHERE id = '${c.targetId}' AND instance_id IS NULL RETURNING 1) INSERT INTO _am_counts SELECT 'instance_id_filled', '${c.targetId}', count(*) FROM n;`
      );
    } else {
      out.push(`INSERT INTO _am_counts VALUES ('instance_id_filled', '${c.targetId}', 0);`);
    }
    if (fillNullTokenColumns) {
      // Collision target only; each column touched solely where it is currently NULL (never overwrites a value).
      for (const col of TOKEN_COLUMNS) {
        out.push(
          `WITH t AS (UPDATE auth.users SET ${col} = '' WHERE id = '${c.targetId}' AND ${col} IS NULL RETURNING 1) INSERT INTO _am_counts SELECT 'token_columns_filled', '${c.targetId}', count(*) FROM t;`
        );
      }
    } else {
      out.push(`INSERT INTO _am_counts VALUES ('token_columns_filled', '${c.targetId}', 0);`);
    }
  }

  if (passwordUpdates.length > 0) {
    for (const p of passwordUpdates) {
      const sub = `(SELECT s.encrypted_password FROM _am_users s WHERE s.id = '${p.id}')`;
      out.push(
        `WITH w AS (UPDATE auth.users SET encrypted_password = ${sub} WHERE id = '${p.id}' AND md5(coalesce(encrypted_password, '')) = '${p.expectedTargetDigest}' AND encrypted_password IS DISTINCT FROM ${sub} RETURNING 1) INSERT INTO _am_counts SELECT 'passwords_updated', '${p.id}', count(*) FROM w;`
      );
    }
    out.push(
      `DO $pw$ DECLARE n int; BEGIN SELECT coalesce(sum(v), 0) INTO n FROM _am_counts WHERE k = 'passwords_updated'; IF n <> ${passwordUpdates.length} THEN RAISE EXCEPTION 'password update count mismatch: % expected ${passwordUpdates.length}', n; END IF; END $pw$;`
    );
  }

  out.push(
    `DO $chk$ DECLARE vu int; vi int; BEGIN
  SELECT count(*) INTO vu FROM auth.users WHERE id IN (SELECT id FROM _am_users WHERE id <> ALL(${arr(srcIds)}));
  SELECT count(*) INTO vi FROM auth.identities WHERE id IN (SELECT id FROM _am_identities WHERE user_id <> ALL(${arr(srcIds)}));
  INSERT INTO _am_counts VALUES ('users_present', NULL, vu), ('identities_present', NULL, vi);
  IF vu <> ${expectedPresent} THEN RAISE EXCEPTION 'count assertion failed: users_present=% expected ${expectedPresent}', vu; END IF;
END $chk$;`
  );

  if (mode === 'dry-run') {
    out.push(
      `DO $dry$ DECLARE a int; b int; c int; d int; e int; f int; g int; BEGIN
  SELECT coalesce(max(v) FILTER (WHERE k = 'users_present'), 0), coalesce(max(v) FILTER (WHERE k = 'identities_present'), 0),
         coalesce(sum(v) FILTER (WHERE k = 'password_filled'), 0), coalesce(sum(v) FILTER (WHERE k = 'identity_inserted'), 0),
         coalesce(sum(v) FILTER (WHERE k = 'instance_id_filled'), 0), coalesce(sum(v) FILTER (WHERE k = 'passwords_updated'), 0),
         coalesce(sum(v) FILTER (WHERE k = 'token_columns_filled'), 0)
    INTO a, b, c, d, e, f, g FROM _am_counts;
  RAISE EXCEPTION 'DRYRUN users_present=% identities_present=% collision_password_filled=% collision_identity_added=% instance_id_filled=% passwords_updated=% token_columns_filled=%', a, b, c, d, e, f, g;
END $dry$;`
    );
  } else {
    out.push('COMMIT;');
    const collJson = JSON.stringify(colls.map((c) => ({ source: c.sourceId, target: c.targetId })));
    out.push(
      `SELECT coalesce(max(v) FILTER (WHERE k = 'users_present'), 0) AS users_present,
       coalesce(max(v) FILTER (WHERE k = 'identities_present'), 0) AS identities_present,
       coalesce(sum(v) FILTER (WHERE k = 'passwords_updated'), 0) AS passwords_updated,
       coalesce(sum(v) FILTER (WHERE k = 'instance_id_filled'), 0) AS instance_id_filled,
       coalesce(sum(v) FILTER (WHERE k = 'token_columns_filled'), 0) AS token_columns_filled,
       (SELECT coalesce(jsonb_agg(jsonb_build_object(
          'source_user_id', e->>'source', 'target_user_id', e->>'target',
          'password_filled', coalesce((SELECT sum(v) FROM _am_counts WHERE k = 'password_filled' AND ref = e->>'target'), 0) > 0,
          'identity_inserted', coalesce((SELECT sum(v) FROM _am_counts WHERE k = 'identity_inserted' AND ref = e->>'target'), 0) > 0,
          'instance_id_filled', coalesce((SELECT sum(v) FROM _am_counts WHERE k = 'instance_id_filled' AND ref = e->>'target'), 0) > 0,
          'token_columns_filled', coalesce((SELECT sum(v) FROM _am_counts WHERE k = 'token_columns_filled' AND ref = e->>'target'), 0)::int)), '[]'::jsonb)
          FROM jsonb_array_elements('${collJson}'::jsonb) e) AS collisions
  FROM _am_counts;`
    );
  }
  return out.join('\n');
}

// ---------------------------------------------------------------- CLI

const HELP = `Usage: node scripts/auth-merge/02-import-auth.mjs --source-ref <ref> --project-ref <ref> [mode]
Modes: --plan (default) | --dry-run | --apply --remap-out <path> | --delta-report
Flags: --confirm-ref <ref> --fill-null-instance-id --fill-null-token-columns --apply-password-updates --allow-unmatched-known-collision --help`;

const SPEC = {
  'source-ref': 'string',
  'project-ref': 'string',
  'confirm-ref': 'string',
  plan: 'boolean',
  'dry-run': 'boolean',
  apply: 'boolean',
  'delta-report': 'boolean',
  'remap-out': 'string',
  'fill-null-instance-id': 'boolean',
  'fill-null-token-columns': 'boolean',
  'apply-password-updates': 'boolean',
  'allow-unmatched-known-collision': 'boolean',
};

const DELTA_SQL = `SELECT id::text AS id,
  md5(coalesce(encrypted_password, '')) AS pw,
  md5(concat_ws('|', email, email_confirmed_at::text, raw_user_meta_data::text, raw_app_meta_data::text, banned_until::text, deleted_at::text)) AS other
FROM auth.users ORDER BY id`;

async function computeDelta(sourceRef, targetRef, excluded) {
  const [src, tgt] = [await runSql(sourceRef, DELTA_SQL), await runSql(targetRef, DELTA_SQL)];
  const tmap = new Map(tgt.map((r) => [r.id, r]));
  const passwordChanged = [];
  const otherChanged = [];
  for (const s of src) {
    const t = tmap.get(s.id);
    if (!t || excluded.has(s.id)) continue;
    if (t.pw !== s.pw) passwordChanged.push({ id: s.id, expectedTargetDigest: t.pw });
    if (t.other !== s.other) otherChanged.push(s.id);
  }
  return { passwordChanged, otherChanged };
}

async function main() {
  const args = parseCliArgs(process.argv.slice(2), SPEC);
  if (args.help) {
    console.log(HELP);
    return 0;
  }
  const sourceRef = requireRef(args, 'sourceRef');
  const targetRef = requireRef(args, 'projectRef');
  if (sourceRef !== PROJECTS.ziko) {
    console.error('ERROR: --source-ref must be the ziko project');
    return 2;
  }
  const modes = ['plan', 'dryRun', 'apply', 'deltaReport'].filter((m) => args[m]);
  if (modes.length > 1) {
    console.error('ERROR: choose exactly one mode');
    return 2;
  }
  const mode = modes[0] ?? 'plan';
  if (args.applyPasswordUpdates && mode !== 'dryRun' && mode !== 'apply') {
    console.error('ERROR: --apply-password-updates is only valid with --dry-run or --apply');
    return 2;
  }
  if (mode === 'apply' && !args.remapOut) {
    console.error('ERROR: --remap-out <path> is required with --apply');
    return 2;
  }
  if (mode === 'dryRun' || mode === 'apply') {
    try {
      assertWriteAllowed({ projectRef: targetRef, confirmRef: args.confirmRef });
    } catch (e) {
      console.error(`ERROR: ${e.message}`);
      return 1;
    }
  }
  if (targetRef === PROJECTS.ziko) {
    console.error('ERROR: ziko can never be the target');
    return 1;
  }

  const userCols = intersectColumns(await fetchNonGeneratedColumns(targetRef, 'users'), await fetchNonGeneratedColumns(sourceRef, 'users'));
  const identityCols = intersectColumns(
    await fetchNonGeneratedColumns(targetRef, 'identities'),
    await fetchNonGeneratedColumns(sourceRef, 'identities')
  );

  const srcFp = await fetchEmailFingerprints(sourceRef);
  const tgtFp = await fetchEmailFingerprints(targetRef);
  const { collisions, idConflicts, alreadyImported } = matchCollisions(srcFp, tgtFp);
  const unknown = collisions.filter((c) => !KNOWN_COLLISION_SOURCE_IDS.includes(c.sourceId));
  if (unknown.length > 0 || idConflicts.length > 0) {
    console.error('BLOCKING (D-04): new collision');
    for (const c of unknown) {
      console.error(`  source=${c.sourceId} target=${c.targetId} target_has_password=${c.targetHasPassword}`);
    }
    for (const id of idConflicts) console.error(`  id_conflict=${id}`);
    return 1;
  }
  const matched = new Set(collisions.map((c) => c.sourceId));
  const unmatched = KNOWN_COLLISION_SOURCE_IDS.filter((id) => !matched.has(id) && !alreadyImported.includes(id) && srcFp.some((s) => s.id === id));
  if (unmatched.length > 0 && !args.allowUnmatchedKnownCollision) {
    console.error(`BLOCKING (D-04): known collision has no target match: ${unmatched.join(',')}`);
    return 1;
  }

  const collSrc = new Set(collisions.map((c) => c.sourceId));
  const collTgt = new Set(collisions.map((c) => c.targetId));
  const excluded = new Set([...collSrc, ...collTgt]);

  const users = (await runSql(sourceRef, `SELECT coalesce(jsonb_agg(to_jsonb(u)), '[]'::jsonb) AS d FROM auth.users u`))[0].d;
  const identities = (await runSql(sourceRef, `SELECT coalesce(jsonb_agg(to_jsonb(i)), '[]'::jsonb) AS d FROM auth.identities i`))[0].d;
  const nonCollision = users.filter((u) => !collSrc.has(u.id));
  const toInsert = nonCollision.length - alreadyImported.filter((id) => !collSrc.has(id)).length;

  if (mode === 'plan') {
    console.log(`source_users=${users.length} source_identities=${identities.length}`);
    console.log(`already_present=${alreadyImported.length} to_insert=${toInsert} collisions=${collisions.length}`);
    for (const c of collisions) {
      console.log(
        `collision source=${c.sourceId} target=${c.targetId} target_has_password=${c.targetHasPassword} target_has_email_identity=${c.targetHasEmailIdentity} target_instance_id_null=${c.targetInstanceIdNull}`
      );
    }
    return 0;
  }

  if (mode === 'deltaReport') {
    const d = await computeDelta(sourceRef, targetRef, excluded);
    console.log(`password_changed=${d.passwordChanged.length}`);
    for (const p of d.passwordChanged) console.log(`  ${p.id}`);
    console.log(`other_changed=${d.otherChanged.length}`);
    for (const id of d.otherChanged) console.log(`  ${id}`);
    return 0;
  }

  let passwordUpdates = [];
  if (args.applyPasswordUpdates) {
    passwordUpdates = (await computeDelta(sourceRef, targetRef, excluded)).passwordChanged;
    console.log(`password_updates=${passwordUpdates.length}`);
    for (const p of passwordUpdates) console.log(`  ${p.id}`);
  }

  const sql = buildImportSql({
    userCols,
    identityCols,
    users,
    identities,
    collisions,
    mode: mode === 'apply' ? 'apply' : 'dry-run',
    expectedPresent: nonCollision.length,
    fillNullInstanceId: args.fillNullInstanceId,
    fillNullTokenColumns: args.fillNullTokenColumns,
    passwordUpdates,
  });

  if (mode === 'dryRun') {
    const text = await runSqlExpectError(targetRef, sql);
    const m = text.match(/DRYRUN [^\n"]*/);
    console.log(m ? m[0].trim() : `dry-run did not reach the DRYRUN marker: ${redactPii(text).slice(0, 400)}`);
    return m ? 0 : 1;
  }

  const rows = await runSql(targetRef, sql);
  const row = rows[0];
  console.log(
    `users_present=${row.users_present} identities_present=${row.identities_present} passwords_updated=${row.passwords_updated} instance_id_filled=${row.instance_id_filled} token_columns_filled=${row.token_columns_filled}`
  );
  const remaps = typeof row.collisions === 'string' ? JSON.parse(row.collisions) : row.collisions;
  let prior = [];
  try {
    const old = JSON.parse(await readFile(args.remapOut, 'utf8'));
    if (old.source_ref === sourceRef && old.target_ref === targetRef) prior = old.remaps ?? [];
  } catch {
    /* no previous remap file */
  }
  await writeFile(
    args.remapOut,
    JSON.stringify(
      { generated_at: new Date().toISOString(), source_ref: sourceRef, target_ref: targetRef, remaps: mergeRemaps(prior, remaps) },
      null,
      2
    ),
    'utf8'
  );
  console.log(`remap_written collisions=${remaps.length}`);
  return 0;
}

if (isMain(import.meta.url)) {
  main().then(
    (code) => process.exit(code),
    (err) => {
      console.error(`ERROR: ${redactPii(err.message)}`);
      process.exit(1);
    }
  );
}
