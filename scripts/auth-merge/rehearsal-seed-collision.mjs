/**
 * SCRATCH-ONLY rehearsal helper. This file must never be pointed at portfolio or ziko;
 * the ref check below is the first statement executed (exit 2 otherwise, no SQL sent).
 *
 *   --seed   insert a portfolio-shaped collision row (NULL password, NULL instance_id, NULL token columns, no identity)
 *            for each known collision email, if no row with that email exists on scratch
 *   --reset  delete every auth.users row on scratch (cascades identities and scratch ziko_* rows)
 *
 * The email is read into memory only and travels inside a temp SQL file (lib runSql), never logged unmasked.
 */

import { PROJECTS, KNOWN_COLLISION_SOURCE_IDS, parseCliArgs, runSql, maskEmail, chooseDollarTag, redactPii, isMain } from './lib.mjs';

async function main() {
  const args = parseCliArgs(process.argv.slice(2), { 'project-ref': 'string', seed: 'boolean', reset: 'boolean' });
  if (args.projectRef !== PROJECTS.scratch) {
    console.error('ERROR: this tool only runs against the scratch project (--project-ref must equal PROJECTS.scratch)');
    return 2;
  }
  if (args.help || args.seed === args.reset) {
    console.log('Usage: node scripts/auth-merge/rehearsal-seed-collision.mjs --project-ref <scratch> (--seed | --reset)');
    return args.help ? 0 : 2;
  }
  const scratch = PROJECTS.scratch;

  if (args.reset) {
    const rows = await runSql(
      scratch,
      `WITH d AS (DELETE FROM auth.users RETURNING 1) SELECT count(*)::int AS deleted FROM d`
    );
    console.log(`deleted=${rows[0].deleted}`);
    return 0;
  }

  for (const id of KNOWN_COLLISION_SOURCE_IDS) {
    const r = await runSql(PROJECTS.ziko, `SELECT email FROM auth.users WHERE id = '${id}'`);
    const email = r[0]?.email;
    if (typeof email !== 'string' || !/^[^\s'$\\]+@[^\s'$\\]+$/.test(email)) {
      console.error(`ERROR: known collision source ${id} not found or email not usable`);
      return 1;
    }
    const tag = chooseDollarTag(email);
    const rows = await runSql(
      scratch,
      `WITH e AS (SELECT ${tag}${email}${tag}::text AS email),
ins AS (
  INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, confirmation_token, recovery_token, email_change_token_new,
    email_change, email_change_token_current, phone_change, phone_change_token, reauthentication_token,
    is_sso_user, is_anonymous, created_at, updated_at)
  SELECT gen_random_uuid(), NULL, 'authenticated', 'authenticated', e.email, NULL, now(),
    '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, NULL, NULL, NULL, NULL, '', '', '', '',
    false, false, now(), now()
  FROM e WHERE NOT EXISTS (SELECT 1 FROM auth.users x WHERE lower(x.email) = lower(e.email))
  RETURNING id)
SELECT id::text AS id FROM ins`
    );
    if (rows.length === 0) console.log(`skipped (email ${maskEmail(email)} already present on scratch)`);
    else console.log(`seeded email=${maskEmail(email)} uuid=${rows[0].id}`);
  }
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
