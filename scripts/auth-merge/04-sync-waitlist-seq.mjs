#!/usr/bin/env node
/**
 * Copy ziko's live waitlist sequence state (last_value + is_called) onto the target
 * public.ziko_waitlist_founder_seq with a direct setval. Never uses the reset helper function
 * and never a hardcoded number (D-09, D-15).
 *
 * Usage:
 *   node scripts/auth-merge/04-sync-waitlist-seq.mjs --source-ref <ziko> --project-ref <ref>
 *        [--confirm-ref <ref>] [--dry-run]
 *
 * Exit codes: 0 ok; 1 failure; 2 bad arguments.
 */

import { PROJECTS, parseCliArgs, requireRef, assertWriteAllowed, runSql, isMain } from './lib.mjs';

const HELP = `04-sync-waitlist-seq.mjs - live setval copy of the waitlist founder sequence

Required:
  --source-ref <ref>    Must be the ziko ref.
  --project-ref <ref>   Target project. No default.
Optional:
  --confirm-ref <ref>   Must equal the portfolio ref to write to portfolio.
  --dry-run             Print values only; write nothing.
  --help, -h            Show this help.

Exit codes: 0 ok; 1 failure; 2 bad arguments.
`;

async function readSeq(ref, name) {
  const rows = await runSql(ref, `SELECT last_value::text AS last_value, is_called FROM public.${name}`);
  return { lastValue: rows[0]?.last_value, isCalled: rows[0]?.is_called };
}

async function main() {
  const args = parseCliArgs(process.argv.slice(2), {
    'source-ref': 'string',
    'project-ref': 'string',
    'confirm-ref': 'string',
    'dry-run': 'boolean',
  });
  if (args.help) {
    console.log(HELP);
    return;
  }
  const source = requireRef(args, 'sourceRef');
  const target = requireRef(args, 'projectRef');
  if (source !== PROJECTS.ziko) {
    console.error('ERROR: --source-ref must be the ziko project ref.');
    process.exit(2);
  }

  const src = await readSeq(source, 'waitlist_founder_seq');
  if (!/^[1-9][0-9]*$/.test(String(src.lastValue)) || typeof src.isCalled !== 'boolean') {
    throw new Error('Source sequence state is not a positive integer / boolean');
  }
  const before = await readSeq(target, 'ziko_waitlist_founder_seq');
  console.log(`source (ziko) : last_value=${src.lastValue} is_called=${src.isCalled}`);
  console.log(`target before : last_value=${before.lastValue} is_called=${before.isCalled}`);
  console.log(`planned       : setval(ziko_waitlist_founder_seq, ${src.lastValue}, ${src.isCalled})`);
  if (args.dryRun) {
    console.log('DRY RUN: nothing written.');
    return;
  }

  assertWriteAllowed({ projectRef: target, confirmRef: args.confirmRef });
  await runSql(target, `SELECT setval('public.ziko_waitlist_founder_seq', ${src.lastValue}, ${src.isCalled})`);
  const after = await readSeq(target, 'ziko_waitlist_founder_seq');
  console.log(`target after  : last_value=${after.lastValue} is_called=${after.isCalled}`);
  if (String(after.lastValue) !== String(src.lastValue) || after.isCalled !== src.isCalled) {
    console.error('FAIL: post-write value does not equal the source');
    process.exit(1);
  }
  console.log('SEQUENCE SYNCED');
}

if (isMain(import.meta.url)) {
  main().catch((err) => {
    console.error(`ERROR: ${err.message}`);
    process.exit(1);
  });
}
