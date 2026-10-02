#!/usr/bin/env node
/**
 * Phase 6 CUTOVER-04 signup isolation proof (D-13, Phase 3 D-07).
 *
 * Usage:
 *   node scripts/portfolio-migration/14-signup-isolation.mjs --project-ref <ref> --confirm-ref <ref>
 *        [--authorization-file <path> --authorization-phrase <phrase>] [--report-out <path>]
 *
 * Creates four temp users (no metadata, app 'rh', app 'gecko', app 'ziko') through the Admin API and
 * proves the gated Ziko signup triggers: non-ziko signups create zero ziko_ rows; the ziko signup
 * creates its profile and the welcome-credit rows. Users and their ziko_ rows are always removed.
 * Exit codes: 0 pass; 1 failed or refused; 2 bad arguments.
 */

import { PROJECTS, parseCliArgs, getProjectApiKeys, runSql, isMain } from '../auth-merge/lib.mjs';
import {
  requireWriteAuthorization,
  createTempUser,
  cleanupTempUsers,
  countRowsByPrefix,
  writeSafeReport,
  newRunId,
  safeMessage,
} from './lib-cutover.mjs';

// Mirrors supabase/portfolio-migrations/20261002090000_portfolio_ziko_auth_gate_functions.sql
// (ziko_handle_new_user -> ziko_user_profiles; ziko_handle_new_user_credits -> ziko_user_ai_credits + welcome transaction).
const WELCOME_AMOUNT = 5;

const HELP = `14-signup-isolation.mjs - CUTOVER-04 signup isolation proof

Required: --project-ref <ref> --confirm-ref <ref>
Portfolio also requires: --authorization-file <path> --authorization-phrase <phrase>
Optional: --report-out <path>
Exit codes: 0 pass; 1 failed or refused; 2 bad arguments.
`;

const SPEC = {
  'project-ref': 'string',
  'confirm-ref': 'string',
  'authorization-file': 'string',
  'authorization-phrase': 'string',
  'report-out': 'string',
};

const USERS = [
  { key: 'none', metadata: undefined },
  { key: 'rh', metadata: { app: 'rh' } },
  { key: 'gecko', metadata: { app: 'gecko' } },
  { key: 'ziko', metadata: { app: 'ziko', full_name: 'iso test' } },
];

async function runLive(projectRef) {
  const { createClient } = await import('@supabase/supabase-js');
  const keys = await getProjectApiKeys(projectRef);
  const url = `https://${projectRef}.supabase.co`;
  const admin = createClient(url, keys.secret, { auth: { autoRefreshToken: false, persistSession: false } });
  const runId = newRunId();
  const created = [];
  const cases = [];
  let cleanup = { leftoverUsers: -1, leftoverRows: -1 };
  const info = [];
  try {
    for (const u of USERS) {
      const user = await createTempUser(admin, { runId, role: `iso-${u.key}`, metadata: u.metadata });
      created.push({ ...user, key: u.key });
    }
    for (const u of created.filter((x) => x.key !== 'ziko')) {
      const n = await countRowsByPrefix(projectRef, 'ziko_', [u.id]);
      cases.push({ id: `non-ziko-${u.key}-zero-ziko-rows`, expect: 0, observed: n, ok: n === 0 });
      for (const prefix of ['rh_', 'gecko_']) {
        info.push({ user: u.key, prefix, rows: await countRowsByPrefix(projectRef, prefix, [u.id]) });
      }
    }
    const z = created.find((x) => x.key === 'ziko');
    const profile = await runSql(projectRef, `SELECT count(*)::int AS n FROM public.ziko_user_profiles WHERE id = '${z.id}'`);
    cases.push({ id: 'ziko-profile-created', expect: 1, observed: Number(profile[0]?.n), ok: Number(profile[0]?.n) === 1 });
    const bal = await runSql(projectRef, `SELECT balance::int AS n FROM public.ziko_user_ai_credits WHERE user_id = '${z.id}'`);
    cases.push({ id: 'ziko-welcome-balance', expect: WELCOME_AMOUNT, observed: bal[0] ? Number(bal[0].n) : null, ok: bal[0] ? Number(bal[0].n) === WELCOME_AMOUNT : false });
    const tx = await runSql(
      projectRef,
      `SELECT count(*)::int AS n FROM public.ziko_ai_credit_transactions WHERE user_id = '${z.id}' AND type = 'welcome' AND amount = ${WELCOME_AMOUNT}`,
    );
    cases.push({ id: 'ziko-welcome-transaction', expect: 1, observed: Number(tx[0]?.n), ok: Number(tx[0]?.n) === 1 });
  } finally {
    try {
      cleanup = await cleanupTempUsers(admin, projectRef, created);
    } catch (err) {
      console.error(`cleanup failed: ${safeMessage(err)}`);
    }
  }
  const cleanupOk = cleanup.leftoverUsers === 0 && cleanup.leftoverRows === 0;
  cases.push({ id: 'cleanup-zero-leftovers', expect: 0, observed: cleanup.leftoverUsers + cleanup.leftoverRows, ok: cleanupOk });
  return {
    target: projectRef === PROJECTS.portfolio ? 'portfolio' : 'scratch',
    passed: cases.every((c) => c.ok),
    cases,
    informational: info,
    cleanup,
  };
}

export async function main(argv) {
  const args = parseCliArgs(argv, SPEC);
  if (args.help) {
    console.log(HELP);
    return 0;
  }
  if (!args.projectRef) {
    console.error('ERROR: --project-ref is required');
    return 2;
  }
  try {
    requireWriteAuthorization({
      projectRef: args.projectRef,
      confirmRef: args.confirmRef,
      authorizationFile: args.authorizationFile,
      phrase: args.authorizationPhrase,
    });
  } catch (err) {
    console.error(`ERROR: ${safeMessage(err)}`);
    return 1;
  }
  let report;
  try {
    report = await runLive(args.projectRef);
  } catch (err) {
    console.error(`ERROR: ${safeMessage(err)}`);
    return 1;
  }
  if (args.reportOut) await writeSafeReport(args.reportOut, report);
  console.log(`signup isolation on ${report.target}: ${report.passed ? 'PASS' : 'FAIL'}`);
  for (const c of report.cases.filter((x) => !x.ok)) console.log(`  FAIL ${c.id}: expected ${c.expect}, observed ${c.observed}`);
  return report.passed ? 0 : 1;
}

if (isMain(import.meta.url)) {
  main(process.argv.slice(2))
    .then((code) => process.exit(code))
    .catch((err) => {
      console.error(`ERROR: ${safeMessage(err)}`);
      process.exit(1);
    });
}
