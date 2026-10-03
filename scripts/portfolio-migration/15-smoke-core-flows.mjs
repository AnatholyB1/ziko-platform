#!/usr/bin/env node
/**
 * Phase 6 CUTOVER-03 core-flow smoke (D-12), per surface, against a deployed or local base URL.
 *
 * Usage:
 *   node scripts/portfolio-migration/15-smoke-core-flows.mjs --project-ref <ref> --confirm-ref <ref>
 *        --api-url <url> [--web-url <url>] [--skip-ai] [--skip-web] [--bypass-file <path>]
 *        [--other-ref <ref>] [--authorization-file <path> --authorization-phrase <phrase>]
 *        [--report-out <path>]
 *
 * Temp athlete + coach are created with the Admin API, exercised with their own JWTs, and always
 * deleted in a finally block (leftovers asserted zero). Reports never contain URLs, ids or secrets.
 * Exit codes: 0 all pass; 1 any failed or refused; 2 bad arguments.
 */

import { readFile } from 'node:fs/promises';

import { PROJECTS, parseCliArgs, getProjectApiKeys, isMain } from '../auth-merge/lib.mjs';
import {
  requireWriteAuthorization,
  createTempUser,
  signInTemp,
  cleanupTempUsers,
  writeSafeReport,
  detectProjectRefs,
  newRunId,
  safeMessage,
} from './lib-cutover.mjs';

const HELP = `15-smoke-core-flows.mjs - CUTOVER-03 core-flow smoke

Required: --project-ref <ref> --confirm-ref <ref> --api-url <url>
Portfolio also requires: --authorization-file <path> --authorization-phrase <phrase>
Optional: --web-url <url> --skip-ai --skip-web --bypass-file <path> --other-ref <ref> --report-out <path>
Exit codes: 0 pass; 1 failed or refused; 2 bad arguments.
`;

const SPEC = {
  'project-ref': 'string',
  'confirm-ref': 'string',
  'api-url': 'string',
  'web-url': 'string',
  'skip-ai': 'boolean',
  'skip-web': 'boolean',
  'bypass-file': 'string',
  'other-ref': 'string',
  'authorization-file': 'string',
  'authorization-phrase': 'string',
  'report-out': 'string',
};

export const BYPASS_HEADER = 'x-vercel-protection-bypass';

// ---------------------------------------------------------------------------
// Pure helpers (offline-tested)
// ---------------------------------------------------------------------------

/** Pass only on an exact match; unknown/missing observation is a failure. */
export function evaluateCase(expect, observed) {
  if (expect === undefined || expect === null) return false;
  if (observed === undefined || observed === null || observed === 'unknown') return false;
  return expect === observed;
}

export function buildChecks({ skipAi = false, skipWeb = false } = {}) {
  return [
    'api-health',
    'login-athlete',
    'read-credits',
    'read-own-profile',
    'write-own-row',
    'read-back',
    'delete-own-row',
    ...(skipAi ? [] : ['ai-chat']),
    'coach-crm-read',
    'unauth-denied',
    ...(skipWeb ? [] : ['web-home', 'web-login', 'web-inlined-ref']),
  ];
}

/** Passes only when the target ref is inlined in the bundles and the other ref is absent. */
export function webInlinedRef(chunksText, targetRef, otherRef) {
  const refs = detectProjectRefs(chunksText);
  return refs.has(targetRef) && !refs.has(otherRef);
}

/** Bypass header only when a secret was supplied. The secret is never part of any report. */
export function buildHeaders(bypassSecret, extra = {}) {
  return { ...(bypassSecret ? { [BYPASS_HEADER]: bypassSecret } : {}), ...extra };
}

export function defaultOtherRef(projectRef) {
  return projectRef === PROJECTS.portfolio ? PROJECTS.ziko : PROJECTS.portfolio;
}

/** Returns { exitCode, message } for a refusal, or the resolved run. */
export function resolveSmokeRun(args) {
  if (!args?.projectRef) return { exitCode: 2, message: '--project-ref is required' };
  if (!args.apiUrl) return { exitCode: 2, message: '--api-url is required' };
  if (!args.skipWeb && !args.webUrl) {
    // web checks need a base URL; default to skipping rather than guessing one
    args = { ...args, skipWeb: true };
  }
  try {
    requireWriteAuthorization({
      projectRef: args.projectRef,
      confirmRef: args.confirmRef,
      authorizationFile: args.authorizationFile,
      phrase: args.authorizationPhrase,
    });
  } catch (err) {
    return { exitCode: 1, message: safeMessage(err) };
  }
  return {
    run: {
      projectRef: args.projectRef,
      apiUrl: args.apiUrl.replace(/\/+$/, ''),
      webUrl: args.webUrl ? args.webUrl.replace(/\/+$/, '') : null,
      skipAi: !!args.skipAi,
      skipWeb: !!args.skipWeb,
      otherRef: args.otherRef ?? defaultOtherRef(args.projectRef),
      bypassFile: args.bypassFile ?? null,
    },
  };
}

// ---------------------------------------------------------------------------
// Live run
// ---------------------------------------------------------------------------

async function http(method, url, { token, body, headers, timeoutMs = 30000 } = {}) {
  const started = Date.now();
  try {
    const res = await fetch(url, {
      method,
      headers: {
        ...(headers ?? {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(body ? { 'Content-Type': 'application/json' } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(timeoutMs),
    });
    const text = await res.text();
    let json = null;
    try {
      json = JSON.parse(text);
    } catch {
      /* not json */
    }
    return { status: res.status, text, json, ms: Date.now() - started };
  } catch {
    return { status: 0, text: '', json: null, ms: Date.now() - started };
  }
}

async function runLive(run) {
  const { createClient } = await import('@supabase/supabase-js');
  const bypass = run.bypassFile ? (await readFile(run.bypassFile, 'utf8')).trim() : null;
  const baseHeaders = buildHeaders(bypass);
  const keys = await getProjectApiKeys(run.projectRef);
  const url = `https://${run.projectRef}.supabase.co`;
  const admin = createClient(url, keys.secret, { auth: { autoRefreshToken: false, persistSession: false } });
  const runId = newRunId();
  const created = [];
  const results = new Map();
  const record = (id, expect, observed, ms = 0) =>
    results.set(id, { id, expect, observed, ok: evaluateCase(expect, observed), ms });

  let athlete = null;
  let coach = null;
  let cleanup = { leftoverUsers: -1, leftoverRows: -1 };
  let habitId = null;

  const api = (method, p, opts = {}) => http(method, `${run.apiUrl}${p}`, { ...opts, headers: baseHeaders });
  const web = (p) => http('GET', `${run.webUrl}${p}`, { headers: baseHeaders });
  const balanceOf = async () => {
    const r = await api('GET', '/credits/balance', { token: athlete.jwt });
    return { r, balance: typeof r.json?.balance === 'number' ? r.json.balance : null };
  };

  const impls = {
    'api-health': async () => {
      const r = await api('GET', '/health');
      record('api-health', 200, r.status, r.ms);
    },
    'login-athlete': async () => {
      const started = Date.now();
      const u = await createTempUser(admin, { runId, role: 'athlete', metadata: { app: 'ziko', full_name: 'smoke athlete' } });
      created.push(u);
      const s = await signInTemp(createClient, url, keys.publishable, u);
      athlete = { ...u, ...s };
      record('login-athlete', 'session', s.jwt ? 'session' : 'none', Date.now() - started);
    },
    'read-credits': async () => {
      const { r, balance } = await balanceOf();
      record('read-credits', 'ok', r.status === 200 && balance !== null && balance > 0 ? 'ok' : `status-${r.status}`, r.ms);
    },
    'read-own-profile': async () => {
      const started = Date.now();
      const { data, error } = await athlete.client.from('ziko_user_profiles').select('id').eq('id', athlete.id);
      record('read-own-profile', 1, error ? -1 : data.length, Date.now() - started);
    },
    'write-own-row': async () => {
      const started = Date.now();
      const { data, error } = await athlete.client
        .from('ziko_habits')
        .insert({ user_id: athlete.id, name: 'smoke' })
        .select('id')
        .single();
      habitId = data?.id ?? null;
      record('write-own-row', 'ok', error || !habitId ? 'error' : 'ok', Date.now() - started);
    },
    'read-back': async () => {
      const started = Date.now();
      if (!habitId) return record('read-back', 1, 'skipped', 0);
      const { data, error } = await athlete.client.from('ziko_habits').select('id').eq('id', habitId);
      record('read-back', 1, error ? -1 : data.length, Date.now() - started);
    },
    'delete-own-row': async () => {
      const started = Date.now();
      if (!habitId) return record('delete-own-row', 'ok', 'skipped', 0);
      const { error } = await athlete.client.from('ziko_habits').delete().eq('id', habitId);
      const { data } = await athlete.client.from('ziko_habits').select('id').eq('id', habitId);
      record('delete-own-row', 'ok', !error && data?.length === 0 ? 'ok' : 'error', Date.now() - started);
    },
    'ai-chat': async () => {
      const before = (await balanceOf()).balance;
      const r = await api('POST', '/ai/chat', {
        token: athlete.jwt,
        body: { messages: [{ role: 'user', content: 'Bonjour, reponds juste: ok' }] },
        timeoutMs: 90000,
      });
      let observed;
      if (r.status !== 200) observed = `status-${r.status}`;
      else if (typeof r.json?.content !== 'string' || r.json.content.trim() === '') observed = 'empty';
      else {
        const after = (await balanceOf()).balance;
        observed = before !== null && after !== null && after < before ? 'ok' : 'no-debit';
      }
      record('ai-chat', 'ok', observed, r.ms);
    },
    'coach-crm-read': async () => {
      const started = Date.now();
      coach = null;
      const u = await createTempUser(admin, { runId, role: 'coach', metadata: { app: 'ziko', full_name: 'smoke coach' } });
      created.push(u);
      // Mechanism read by coach/identity: ziko_user_profiles.role. Restricted to the temp coach id.
      const { error } = await admin.from('ziko_user_profiles').update({ role: 'coach' }).eq('id', u.id);
      if (error) return record('coach-crm-read', 200, 'role-update-failed', Date.now() - started);
      const s = await signInTemp(createClient, url, keys.publishable, u);
      coach = { ...u, ...s };
      const r = await api('GET', '/coach/clients', { token: coach.jwt });
      record('coach-crm-read', 200, r.status === 200 && r.json !== null ? 200 : r.status, Date.now() - started);
    },
    'unauth-denied': async () => {
      const r = await api('GET', '/credits/balance');
      record('unauth-denied', 401, r.status, r.ms);
    },
    'web-home': async () => {
      const r = await web('/');
      record('web-home', 200, r.status, r.ms);
    },
    'web-login': async () => {
      const r = await web('/fr/login');
      record('web-login', 200, r.status, r.ms);
    },
    'web-inlined-ref': async () => {
      const started = Date.now();
      const page = await web('/fr/login');
      const srcs = [...new Set([...page.text.matchAll(/\/_next\/static\/chunks\/[^"'\s\\)]+\.js/g)].map((m) => m[0]))].slice(0, 60);
      let all = page.text;
      for (const s of srcs) all += `\n${(await web(s)).text}`;
      record(
        'web-inlined-ref',
        'ok',
        webInlinedRef(all, run.projectRef, run.otherRef) ? 'ok' : 'mismatch',
        Date.now() - started,
      );
    },
  };

  const ids = buildChecks({ skipAi: run.skipAi, skipWeb: run.skipWeb });
  try {
    for (const id of ids) {
      try {
        await impls[id]();
      } catch (err) {
        console.error(`check ${id}: ${safeMessage(err)}`);
        const expectDefault = results.get(id)?.expect ?? 'ok';
        record(id, expectDefault, 'error');
      }
    }
  } finally {
    try {
      cleanup = await cleanupTempUsers(admin, run.projectRef, created);
    } catch (err) {
      console.error(`cleanup failed: ${safeMessage(err)}`);
    }
  }

  const cases = ids.map((id) => results.get(id) ?? { id, expect: 'ok', observed: 'not-run', ok: false, ms: 0 });
  const cleanupOk = cleanup.leftoverUsers === 0 && cleanup.leftoverRows === 0;
  cases.push({ id: 'cleanup-zero-leftovers', expect: 0, observed: cleanup.leftoverUsers + cleanup.leftoverRows, ok: cleanupOk, ms: 0 });
  return {
    target: run.projectRef === PROJECTS.portfolio ? 'portfolio' : 'scratch',
    passed: cases.every((c) => c.ok),
    cases,
    cleanup,
  };
}

export async function main(argv) {
  const args = parseCliArgs(argv, SPEC);
  if (args.help) {
    console.log(HELP);
    return 0;
  }
  const resolved = resolveSmokeRun(args);
  if (!resolved.run) {
    console.error(`ERROR: ${resolved.message}`);
    return resolved.exitCode;
  }
  let report;
  try {
    report = await runLive(resolved.run);
  } catch (err) {
    console.error(`ERROR: ${safeMessage(err)}`);
    return 1;
  }
  if (args.reportOut) await writeSafeReport(args.reportOut, report);
  console.log(`core-flow smoke on ${report.target}: ${report.passed ? 'PASS' : 'FAIL'}`);
  for (const c of report.cases) console.log(`  ${c.ok ? 'ok  ' : 'FAIL'} ${c.id}${c.ok ? '' : `: expected ${c.expect}, observed ${c.observed}`}`);
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
