#!/usr/bin/env node
/**
 * Phase 3 / D-12 / AUTHMIG-05 tooling: bilingual "please sign in again" notice to ziko users.
 *
 * Usage:
 *   node scripts/auth-merge/07-notify-relogin.mjs --source-ref <ziko-ref> --cutover-date YYYY-MM-DD [--dry-run]
 *   node --env-file=backend/api/.env.local scripts/auth-merge/07-notify-relogin.mjs \
 *        --source-ref <ziko-ref> --cutover-date YYYY-MM-DD --send [--limit n] [--only-user-id uuid] [--log path]
 *
 * Dry-run is the default; sending requires an explicit --send. The real send is a Phase 6 task.
 * Recipients are read live from ziko auth.users (read-only) and held in memory only. Console output
 * shows masked emails; the send log stores user UUIDs only (idempotency key).
 */

import { readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { PROJECTS, parseCliArgs, requireRef, runSql, maskEmail, isMain } from './lib.mjs';
import { isTestAccountEmail } from '../purge-test-accounts/lib.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DEFAULT_LOG = join(__dirname, 'notify-log.json');
const SEND_PAUSE_MS = 600;

/**
 * Partition ziko users. Every row lands in EXACTLY ONE bucket using the precedence
 * test_domain > deleted_or_banned > unconfirmed > already_sent > toSend, implemented as a
 * single if / else-if chain (never independent filters), so bucket sizes are disjoint and
 * toSend.length + sum(excluded) === rows.length.
 * @param {Array<{id:string,email:string,email_confirmed_at:any,deleted_at:any,banned_until:any,full_name?:string}>} rows
 * @param {Iterable<string|{user_id:string}>} sentLog ids (or log entries) already notified
 * @param {Date} [now]
 */
export function buildRecipients(rows, sentLog = [], now = new Date()) {
  const sent = new Set([...(sentLog ?? [])].map((e) => (typeof e === 'string' ? e : e?.user_id)));
  const toSend = [];
  const excluded = { test_domain: [], deleted_or_banned: [], unconfirmed: [], already_sent: [] };
  for (const r of rows) {
    const banned = r.banned_until && new Date(r.banned_until) > now;
    if (isTestAccountEmail(r.email)) excluded.test_domain.push(r);
    else if (r.deleted_at || banned) excluded.deleted_or_banned.push(r);
    else if (!r.email_confirmed_at) excluded.unconfirmed.push(r);
    else if (sent.has(r.id)) excluded.already_sent.push(r);
    else {
      const firstName = typeof r.full_name === 'string' ? r.full_name.trim().split(/\s+/)[0] || undefined : undefined;
      toSend.push({ id: r.id, email: r.email, firstName });
    }
  }
  return { toSend, excluded };
}

/** @param {string} iso YYYY-MM-DD */
export function formatCutoverDate(iso) {
  if (typeof iso !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) {
    throw new Error('cutover date must be YYYY-MM-DD');
  }
  const d = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== iso) {
    throw new Error(`invalid cutover date: ${iso}`);
  }
  const f = (loc) => new Intl.DateTimeFormat(loc, { timeZone: 'UTC', day: 'numeric', month: 'long', year: 'numeric' }).format(d);
  return { fr: f('fr-FR'), en: f('en-US') };
}

async function fetchRows(ref) {
  return runSql(
    ref,
    `SELECT id::text AS id, email, email_confirmed_at, deleted_at, banned_until,
            raw_user_meta_data->>'full_name' AS full_name
       FROM auth.users ORDER BY created_at`
  );
}

async function readLog(path) {
  try {
    const parsed = JSON.parse(await readFile(path, 'utf8'));
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    if (err.code === 'ENOENT') return [];
    throw err;
  }
}

async function renderHtml(props) {
  const require = createRequire(resolve(__dirname, '../../packages/email/package.json'));
  const React = require('react');
  const { render } = require('@react-email/components');
  const mod = await import(new URL('../../packages/email/dist/ReloginNotice.mjs', import.meta.url).href);
  const Template = mod.ReloginNotice ?? mod.default;
  return render(React.createElement(Template, props));
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const args = parseCliArgs(process.argv.slice(2), {
    'source-ref': 'string',
    'cutover-date': 'string',
    'dry-run': 'boolean',
    send: 'boolean',
    limit: 'string',
    'only-user-id': 'string',
    log: 'string',
  });
  if (args.help) {
    console.log(
      'Usage: 07-notify-relogin.mjs --source-ref <ziko-ref> --cutover-date YYYY-MM-DD [--dry-run | --send] [--limit n] [--only-user-id uuid] [--log path]'
    );
    return;
  }
  const ref = requireRef(args, 'sourceRef');
  if (ref !== PROJECTS.ziko) {
    console.error('ERROR: --source-ref must be the ziko project (the live user base).');
    process.exit(2);
  }
  if (!args.cutoverDate) {
    console.error('ERROR: --cutover-date YYYY-MM-DD is required.');
    process.exit(2);
  }
  const dates = formatCutoverDate(args.cutoverDate);
  const send = args.send && !args.dryRun;
  const logPath = args.log ?? DEFAULT_LOG;

  const rows = await fetchRows(ref);
  const sentLog = send || args.log ? await readLog(logPath) : [];
  const { toSend: all, excluded } = buildRecipients(rows, sentLog);
  let toSend = all;
  if (args.onlyUserId) toSend = toSend.filter((r) => r.id === args.onlyUserId);
  if (args.limit) toSend = toSend.slice(0, Number(args.limit));

  const excludedTotal = Object.values(excluded).reduce((n, l) => n + l.length, 0);
  console.log(`mode=${send ? 'SEND' : 'DRY-RUN'} total=${rows.length}`);
  for (const [k, v] of Object.entries(excluded)) console.log(`excluded.${k}=${v.length}`);
  console.log(`to_send=${all.length} (selected=${toSend.length}) excluded_sum=${excludedTotal}`);
  if (all.length + excludedTotal !== rows.length) {
    console.error('ERROR: bucket invariant violated');
    process.exit(1);
  }

  if (!send) {
    for (const r of toSend) console.log(`  would send: ${maskEmail(r.email)}`);
    const sample = all[0] ?? { firstName: undefined };
    const html = await renderHtml({ cutoverDateFr: dates.fr, cutoverDateEn: dates.en, firstName: sample.firstName });
    const out = join(tmpdir(), 'ziko-relogin-notice-preview.html');
    await writeFile(out, html, 'utf8');
    console.log(`preview: ${out}`);
    for (const needle of ['reconnecter', 'sign in again', dates.fr, dates.en]) {
      if (!html.includes(needle)) {
        console.error(`ERROR: rendered HTML is missing expected text "${needle}"`);
        process.exit(1);
      }
    }
    console.log('render check OK (FR + EN + dates)');
    return;
  }

  if (!process.env.RESEND_API_KEY) {
    console.error('ERROR: RESEND_API_KEY is not set (run with --env-file=backend/api/.env.local).');
    process.exit(2);
  }
  const { Resend } = createRequire(resolve(__dirname, '../../backend/api/package.json'))('resend');
  const resend = new Resend(process.env.RESEND_API_KEY);
  const subject = `Ziko : reconnexion nécessaire le ${dates.fr} / Sign-in required on ${dates.en}`;
  const log = [...sentLog];
  let failed = 0;
  for (const r of toSend) {
    const html = await renderHtml({ cutoverDateFr: dates.fr, cutoverDateEn: dates.en, firstName: r.firstName });
    const { data, error } = await resend.emails.send({
      from: 'Ziko <coach@ziko-app.com>',
      to: r.email,
      subject,
      html,
    });
    if (error) {
      failed++;
      console.error(`FAILED ${maskEmail(r.email)}: ${error.name ?? 'error'}`);
    } else {
      log.push({ user_id: r.id, sent_at: new Date().toISOString(), resend_id: data?.id ?? null });
      await writeFile(logPath, JSON.stringify(log, null, 2), 'utf8');
      console.log(`sent ${maskEmail(r.email)}`);
    }
    await sleep(SEND_PAUSE_MS);
  }
  console.log(`done sent=${toSend.length - failed} failed=${failed}`);
  if (failed) process.exit(1);
}

if (isMain(import.meta.url)) {
  main().catch((err) => {
    console.error(`ERROR: ${err.message}`);
    process.exit(1);
  });
}
