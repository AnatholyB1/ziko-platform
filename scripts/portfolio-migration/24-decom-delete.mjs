#!/usr/bin/env node
/**
 * 24-decom-delete.mjs - fail-closed project deletion (D-16, scratch deletion D-12b).
 *
 * IRREVERSIBLE. The only path to a DELETE request passes every gate, in this fixed order:
 *   format/project/ref/confirm-ref -> gate file + evidence sha256 -> authorization block ->
 *   token -> pre-delete GET identity (name + ref) -> exactly one DELETE (never retried).
 * Project refs come only from DECOM_REFS (PROJECTS); no literal ref appears in this file.
 *
 * Modes (see HELP). Exit codes: 0 ok | 1 refused/failed | 2 bad args | 3 API refused the delete
 * (403/409, use the dashboard then --confirm-gone) | 4 deleted but not yet confirmed gone.
 * Output is PII-free and never contains the access token.
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { setTimeout as delay } from 'node:timers/promises';
import { parseCliArgs, isMain, redactPii, loadAccessToken } from '../auth-merge/lib.mjs';
import { redactSecrets } from './lib-conn.mjs';
import {
  assertCommittedSafe,
  assertDeleteAllowed,
  checkAuthBlock,
  checkConfirmation,
  EXPECTED_NAMES,
  DECOM_REFS,
  GATE_KEYS,
  REQUIRED_GATES,
  REPO_ROOT,
  AUTH_LOG_PATH,
  readGates,
  verifyGates,
} from './18-decom-guard.mjs';

// ---------------------------------------------------------------- pure evaluators

const IN_PROGRESS_RE = /^(REMOVED|GOING_DOWN|REMOVING|DELETING|DELETED)$/i;

/** Pre-delete identity check against the GET /v1/projects/{ref} body. */
export function evaluatePreDelete({ project, ref, info } = {}) {
  if (!Object.hasOwn(EXPECTED_NAMES, project)) return { ok: false, detail: "project must be 'ziko' or 'scratch'" };
  if (!info || typeof info !== 'object') return { ok: false, detail: 'no project info returned' };
  if (info.name !== EXPECTED_NAMES[project]) {
    return { ok: false, detail: `name mismatch (expected ${EXPECTED_NAMES[project]}, got ${String(info.name).slice(0, 60)})` };
  }
  if ((info.ref ?? info.id) !== ref) return { ok: false, detail: 'ref mismatch between request and returned project' };
  if (IN_PROGRESS_RE.test(String(info.status ?? ''))) {
    return { ok: false, detail: `project already ${String(info.status)}` };
  }
  return { ok: true, detail: 'identity matches' };
}

/** 'present' | 'in-progress' | 'gone' | 'error' */
export function classifyGetResponse({ status, body } = {}) {
  if (status === 404 || status === 410) return 'gone';
  if (status === 200) return IN_PROGRESS_RE.test(String(body?.status ?? '')) ? 'in-progress' : 'present';
  return 'error';
}

/** Deletion log pair: { json, markdown }, both safe for commit. */
export function buildDeletionLog({ project, ref, preDelete, deletedAt, confirmedGoneAt, method, evidence = [], authBlock } = {}) {
  if (method !== 'api' && method !== 'dashboard') throw new Error("method must be 'api' or 'dashboard'");
  const json = {
    project,
    ref,
    method,
    deleted_at: deletedAt,
    confirmed_gone_at: confirmedGoneAt,
    pre_delete: { name: preDelete?.name, status: preDelete?.status, region: preDelete?.region },
    evidence: evidence.map((e) => ({ gate: e.gate, path: e.path, sha256: e.sha256 })),
    auth_block: authBlock ?? null,
  };
  const lines = [
    `# ${project} deletion log`,
    '',
    `- Deleted at: ${deletedAt}`,
    `- Confirmed gone at: ${confirmedGoneAt}`,
    `- Project ref: ${ref}`,
    `- Method: ${method}`,
    `- Pre-delete identity: name ${json.pre_delete.name}, status ${json.pre_delete.status}, region ${json.pre_delete.region}`,
    authBlock ? `- Authorization: ${authBlock}` : '- Authorization: (none recorded)',
    '',
    '## Evidence pointers',
    '',
    ...(json.evidence.length
      ? json.evidence.map((e) => `- ${e.gate}: ${e.path} (sha256 ${e.sha256})`)
      : ['- (none)']),
    '',
    'This deletion is the final action of milestone v1.19.',
    '',
  ];
  const markdown = lines.join('\n');
  assertCommittedSafe(json);
  assertCommittedSafe(markdown);
  return { json, markdown };
}

// ---------------------------------------------------------------- CLI

const API = 'https://api.supabase.com';
const ZIKO_AUTH_HEADING = '07-17 D-15 confirmation';
const SCRATCH_AUTH_HEADING = '07-16 scratch deletion';

const SPEC = {
  preflight: 'boolean',
  'dry-run': 'boolean',
  delete: 'boolean',
  'confirm-gone': 'boolean',
  'write-log': 'boolean',
  project: 'string',
  'confirm-ref': 'string',
  except: 'string',
  'json-out': 'string',
  'timeout-s': 'string',
  from: 'string',
  'log-md': 'string',
  'log-json': 'string',
};

const HELP = `Usage: node scripts/portfolio-migration/24-decom-delete.mjs <mode> --project ziko|scratch
  --preflight                                   read-only: project identity, org kind, other projects [--json-out f]
  --dry-run --confirm-ref <ref> [--except confirmation_yes]   every gate, never DELETE
  --delete --confirm-ref <ref> --json-out <f>   IRREVERSIBLE: all gates, then one DELETE (never retried)
  --confirm-gone [--timeout-s 180] [--json-out f]   poll until the project is absent
  --write-log --from <delete json> --log-md <p> --log-json <p>   (project ziko)
Exit: 0 ok | 1 refused/failed | 2 bad args | 3 API refused delete (use dashboard) | 4 not yet confirmed gone`;

function defaultDeps() {
  return {
    fetchImpl: (...a) => fetch(...a),
    readText: (p) => readFileSync(p, 'utf8'),
    readBytes: (p) => readFileSync(p),
    writeText: (p, t) => writeFileSync(p, t, 'utf8'),
    fileExists: (p) => existsSync(p),
    repoRoot: REPO_ROOT,
    now: () => new Date().toISOString(),
    nowMs: () => Date.now(),
    sleep: (ms) => delay(ms),
    loadToken: () => loadAccessToken(),
    log: (m) => console.log(m),
    errlog: (m) => console.error(m),
  };
}

async function getJson(res) {
  try {
    return await res.json();
  } catch {
    return null;
  }
}

async function apiGet(deps, token, path) {
  const res = await deps.fetchImpl(`${API}${path}`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  });
  return { status: res.status, body: await getJson(res) };
}

/** Local gates 1-3 (no network). Prints one PASS/FAIL line per gate. */
function checkLocalGates({ project, confirmRef, except, requireConfirmRef }, deps, say) {
  const ref = DECOM_REFS[project];
  try {
    assertDeleteAllowed({ project, ref, confirmRef: requireConfirmRef ? confirmRef : ref });
    say('[PASS] project/ref/confirm-ref');
  } catch (e) {
    say(`[FAIL] project/ref/confirm-ref: ${e.message}`);
    return { ok: false, ref };
  }

  let gates;
  try {
    gates = readGates(deps);
  } catch (e) {
    say(`[FAIL] gate file: ${e.message}`);
    return { ok: false, ref };
  }
  const required = REQUIRED_GATES[project].filter((k) => k !== except);
  const v = verifyGates(gates, { required, readBytes: deps.readBytes, readText: deps.readText, repoRoot: deps.repoRoot });
  if (!v.ok) {
    say(`[FAIL] gates: missing=${v.missing.join(',') || '-'} mismatched=${v.mismatched.join(',') || '-'}`);
    return { ok: false, ref };
  }
  say(`[PASS] gates: ${required.length} verified (evidence sha256 re-checked)`);

  let authText = '';
  try {
    authText = deps.readText(AUTH_LOG_PATH);
  } catch {
    authText = '';
  }
  const skipYes = project === 'ziko' && except === 'confirmation_yes';
  let authOk;
  if (project === 'ziko') {
    authOk = skipYes ? true : checkConfirmation(authText, ZIKO_AUTH_HEADING);
  } else {
    authOk = checkAuthBlock(authText, SCRATCH_AUTH_HEADING, `Approved: delete scratch ${DECOM_REFS.scratch}`);
  }
  if (!authOk) {
    say('[FAIL] authorization block missing or not exact');
    return { ok: false, ref };
  }
  say(`[PASS] authorization block${skipYes ? ' (skipped by --except)' : ''}`);
  return { ok: true, ref, gates };
}

function readJsonOut(deps, path) {
  if (!path) return {};
  try {
    return JSON.parse(deps.readText(path));
  } catch {
    return {};
  }
}

export async function run(argv, depsIn = {}) {
  const deps = { ...defaultDeps(), ...Object.fromEntries(Object.entries(depsIn).filter(([, v]) => v !== undefined)) };
  let token = '';
  const clean = (m) => redactSecrets(m, [token]);
  const log = (m) => deps.log(clean(m));
  const errlog = (m) => deps.errlog(clean(m));

  let badArgs = false;
  const args = parseCliArgs(argv, SPEC, { exit: () => { badArgs = true; }, log: errlog });
  if (badArgs) return 2;
  if (args.help) {
    deps.log(HELP);
    return 0;
  }
  const mode = [
    args.preflight && 'preflight',
    args.dryRun && 'dry-run',
    args.delete && 'delete',
    args.confirmGone && 'confirm-gone',
    args.writeLog && 'write-log',
  ].filter(Boolean);
  if (mode.length !== 1) {
    errlog('ERROR: exactly one of --preflight, --dry-run, --delete, --confirm-gone, --write-log is required');
    return 2;
  }
  if (!args.project) {
    errlog('ERROR: --project ziko|scratch is required');
    return 2;
  }
  if (args.except && !(args.dryRun && args.except === 'confirmation_yes')) {
    errlog('ERROR: --except confirmation_yes is allowed only with --dry-run');
    return 2;
  }
  if (args.delete && !args.jsonOut) {
    errlog('ERROR: --delete requires --json-out');
    return 2;
  }
  const m = mode[0];
  const project = args.project;

  try {
    // ---- write-log: no network
    if (m === 'write-log') {
      if (project !== 'ziko') {
        errlog('ERROR: --write-log is for the ziko project only');
        return 1;
      }
      if (!args.from || !args.logMd || !args.logJson) {
        errlog('ERROR: --write-log requires --from, --log-md and --log-json');
        return 2;
      }
      const g = checkLocalGates({ project, requireConfirmRef: false }, deps, log);
      if (!g.ok) return 1;
      const doc = readJsonOut(deps, args.from);
      if (!doc.confirmed_gone_at) {
        errlog('ERROR: refusing to write the log: confirmed_gone_at is missing (run --confirm-gone first)');
        return 1;
      }
      if (!doc.pre_delete?.name) {
        errlog('ERROR: refusing to write the log: pre_delete identity is missing');
        return 1;
      }
      const evidence = GATE_KEYS.filter((k) => g.gates[k]?.evidence && g.gates[k]?.sha256).map((k) => ({
        gate: k,
        path: g.gates[k].evidence,
        sha256: g.gates[k].sha256,
      }));
      const out = buildDeletionLog({
        project,
        ref: g.ref,
        preDelete: doc.pre_delete,
        deletedAt: doc.deleted_at ?? doc.confirmed_gone_at,
        confirmedGoneAt: doc.confirmed_gone_at,
        method: doc.method === 'dashboard' ? 'dashboard' : 'api',
        evidence,
        authBlock: g.gates.confirmation_yes?.auth_block ?? ZIKO_AUTH_HEADING,
      });
      await deps.writeText(args.logMd, out.markdown);
      await deps.writeText(args.logJson, `${JSON.stringify(out.json, null, 2)}\n`);
      log('deletion log written');
      return 0;
    }

    // ---- preflight: read-only
    if (m === 'preflight') {
      if (!Object.hasOwn(EXPECTED_NAMES, project)) {
        errlog("ERROR: --project must be 'ziko' or 'scratch'");
        return 1;
      }
      const ref = DECOM_REFS[project];
      token = await deps.loadToken();
      const p = await apiGet(deps, token, `/v1/projects/${ref}`);
      if (p.status !== 200) {
        errlog(`ERROR: GET project returned HTTP ${p.status}`);
        return 1;
      }
      const orgs = await apiGet(deps, token, '/v1/organizations');
      const list = await apiGet(deps, token, '/v1/projects');
      const orgId = p.body?.organization_id ?? p.body?.organization_slug ?? '';
      const orgList = Array.isArray(orgs.body) ? orgs.body : [];
      const org = orgList.find((o) => o.id === orgId || o.slug === orgId);
      const slug = String(org?.slug ?? orgId ?? '');
      const vercelManaged = slug.startsWith('vercel_icfg_');
      const known = Object.values(DECOM_REFS);
      const projects = Array.isArray(list.body) ? list.body : [];
      const others = projects.map((x) => x.ref ?? x.id).filter((r) => r && !known.includes(r));
      const report = {
        project,
        ref,
        pre_delete: { name: p.body?.name, status: p.body?.status, region: p.body?.region },
        vercel_marketplace_managed: vercelManaged,
        other_projects: { count: others.length, refs: others },
      };
      log(`name=${report.pre_delete.name} status=${report.pre_delete.status} region=${report.pre_delete.region}`);
      log(`vercel_marketplace_managed=${vercelManaged}`);
      log(`other_projects=${others.length}${others.length ? ` (${others.join(',')})` : ''}`);
      if (args.jsonOut) {
        assertCommittedSafe(report);
        await deps.writeText(args.jsonOut, `${JSON.stringify(report, null, 2)}\n`);
      }
      return 0;
    }

    // ---- confirm-gone / dry-run / delete: gates first
    const g = checkLocalGates(
      { project, confirmRef: args.confirmRef, except: args.except, requireConfirmRef: m !== 'confirm-gone' },
      deps,
      log,
    );
    if (!g.ok) return 1;
    const ref = g.ref;
    token = await deps.loadToken();

    if (m === 'confirm-gone') {
      const timeoutMs = Number(args.timeoutS ?? 180) * 1000;
      if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
        errlog('ERROR: --timeout-s must be a positive number');
        return 2;
      }
      const deadline = deps.nowMs() + timeoutMs;
      let wait = 2000;
      for (;;) {
        const p = await apiGet(deps, token, `/v1/projects/${ref}`);
        const state = classifyGetResponse(p);
        if (state === 'gone') {
          const list = await apiGet(deps, token, '/v1/projects');
          const present = Array.isArray(list.body) && list.body.some((x) => (x.ref ?? x.id) === ref);
          if (list.status === 200 && !present) break;
        }
        if (deps.nowMs() >= deadline) {
          errlog(`TIMEOUT: project still ${state} after ${args.timeoutS ?? 180}s`);
          return 4;
        }
        await deps.sleep(wait);
        wait = Math.min(wait * 2, 15000);
      }
      const prior = readJsonOut(deps, args.jsonOut);
      const doc = {
        ...prior,
        project,
        ref,
        confirmed_gone_at: deps.now(),
        method: prior.deleted_at ? 'api' : 'dashboard',
      };
      log(`confirmed gone (method ${doc.method})`);
      if (args.jsonOut) {
        assertCommittedSafe(doc);
        await deps.writeText(args.jsonOut, `${JSON.stringify(doc, null, 2)}\n`);
      }
      return 0;
    }

    // pre-delete identity (dry-run and delete)
    const pre = await apiGet(deps, token, `/v1/projects/${ref}`);
    if (pre.status !== 200) {
      log(`[FAIL] pre-delete GET returned HTTP ${pre.status}`);
      return 1;
    }
    const ev = evaluatePreDelete({ project, ref, info: pre.body });
    if (!ev.ok) {
      log(`[FAIL] pre-delete identity: ${ev.detail}`);
      return 1;
    }
    log(`[PASS] pre-delete identity: name ${pre.body.name}, status ${pre.body.status}`);
    if (m === 'dry-run') {
      log('DRY RUN complete: every gate passed, no DELETE sent');
      return 0;
    }

    // exactly one DELETE, never retried
    const preDelete = { name: pre.body.name, status: pre.body.status, region: pre.body.region };
    let res;
    try {
      res = await deps.fetchImpl(`${API}/v1/projects/${ref}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      });
    } catch (e) {
      errlog(`DELETE request failed (${e?.message ?? e}); NOT retrying. Checking state.`);
      const s = await apiGet(deps, token, `/v1/projects/${ref}`).catch(() => ({ status: 0, body: null }));
      errlog(`state after failure: ${classifyGetResponse(s)} (HTTP ${s.status})`);
      return 1;
    }
    if (res.status === 200) {
      const body = await getJson(res);
      const doc = { project, ref, deleted_at: deps.now(), pre_delete: preDelete, response_ref: body?.ref ?? body?.id ?? null };
      log(`DELETE accepted: ${JSON.stringify(doc)}`);
      assertCommittedSafe(doc);
      await deps.writeText(args.jsonOut, `${JSON.stringify(doc, null, 2)}\n`);
      return 0;
    }
    if (res.status === 403 || res.status === 409) {
      errlog(`API refused the delete (HTTP ${res.status}). Use the dashboard, then run --confirm-gone.`);
      return 3;
    }
    errlog(`DELETE returned HTTP ${res.status}; NOT retrying. Checking state.`);
    const s = await apiGet(deps, token, `/v1/projects/${ref}`).catch(() => ({ status: 0, body: null }));
    errlog(`state after failure: ${classifyGetResponse(s)} (HTTP ${s.status})`);
    return 1;
  } catch (e) {
    errlog(`ERROR: ${redactPii(e?.message ?? e)}`);
    return 1;
  }
}

if (isMain(import.meta.url)) {
  run(process.argv.slice(2)).then(
    (code) => process.exit(code),
    (e) => {
      console.error(`ERROR: ${redactPii(e?.message ?? e)}`);
      process.exit(1);
    },
  );
}
