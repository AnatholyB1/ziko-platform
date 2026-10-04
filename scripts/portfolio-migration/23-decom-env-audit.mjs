#!/usr/bin/env node
/**
 * 23-decom-env-audit.mjs (07-06) - find every remote env value that still points at ziko (D-12).
 *
 * Read-only audit of the API and web Vercel projects (production, preview incl. branch-specific
 * entries, development), the EAS environments and GitHub Actions / ci.yml. Every value is classified
 * clean | points_at_ziko | points_at_scratch | unknown by ref substring, 8-char sha256 fingerprint of
 * a ziko/scratch API key, or the `ref` claim of a JWT. Values are NEVER printed, logged or written to
 * a report: output carries names and statuses only.
 *
 * Remediation is planned as names/environments/branches only, and applied only with the 07-14
 * approval block in 07-AUTHORIZATIONS.md plus --confirm-ref equal to the portfolio ref; portfolio
 * values go to Vercel on stdin.
 *
 * Exit codes: 0 ok | 1 refused/failed/not passed | 2 bad args.
 */
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync, rmSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { PROJECTS, getProjectApiKeys, parseCliArgs, isMain, redactPii } from '../auth-merge/lib.mjs';
import { fingerprint, ENV_MATRIX, EAS_CLI_VERSION, auditEnvNames, collectSources } from './17-env-switch.mjs';
import { checkAuthBlock, assertCommittedSafe, assertOutsideRepo, recordGate, AUTH_LOG_PATH, REPO_ROOT } from './18-decom-guard.mjs';

export const REMEDIATION_HEADING = '07-14 env remediation';
export const REMEDIATION_LINE = 'Approved: env-remediation';
export const CI_SECRET_NAMES = Object.freeze(['SUPABASE_URL', 'SUPABASE_PUBLISHABLE_KEY', 'SUPABASE_SERVICE_ROLE_KEY']);
const ENVIRONMENTS = Object.freeze(['production', 'preview', 'development']);

// ---------------------------------------------------------------- classification

function jwtRef(value) {
  const parts = String(value).trim().split('.');
  if (parts.length !== 3) return null;
  try {
    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
    return typeof payload?.ref === 'string' ? payload.ref : null;
  } catch {
    return null;
  }
}

function pointsAt(value, ref, fingerprints) {
  const v = String(value);
  if (ref && v.includes(ref)) return true;
  const fps = new Set(fingerprints ?? []);
  const trimmed = v.trim().replace(/^(['"])(.*)\1$/, '$2');
  if (fps.size > 0 && (fps.has(fingerprint(v)) || fps.has(fingerprint(trimmed)))) return true;
  const jr = jwtRef(trimmed);
  return !!(ref && jr && jr === ref);
}

/** Never returns, logs or stores the value: only the classification string. */
export function classifyValue(value, { zikoRef, scratchRef, zikoFingerprints, scratchFingerprints } = {}) {
  if (value === undefined || value === null || value === '') return 'unknown';
  if (pointsAt(value, zikoRef, zikoFingerprints)) return 'points_at_ziko';
  if (pointsAt(value, scratchRef, scratchFingerprints)) return 'points_at_scratch';
  return 'clean';
}

// ---------------------------------------------------------------- parsers

export function parseDotenv(text) {
  const out = {};
  for (const raw of String(text ?? '').replace(/^﻿/, '').split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const m = /^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=(.*)$/.exec(line);
    if (!m) continue;
    let v = m[2].trim();
    const q = /^(['"])([\s\S]*)\1$/.exec(v);
    if (q) v = q[2];
    out[m[1]] = v;
  }
  return out;
}

function parseEnvPiece(piece) {
  const m = /^(production|preview|development)(?:\s*\((.+)\))?$/i.exec(piece.trim());
  return m ? { env: m[1].toLowerCase(), branch: m[2] ?? null } : null;
}

/** `vercel env ls` rows -> {name, environments[], gitBranch|null}. Accepts --format json or the table text. */
export function parseVercelEnvLs(text) {
  const s = String(text ?? '');
  const start = s.indexOf('{');
  if (start >= 0 && /"envs"\s*:/.test(s)) {
    try {
      const doc = JSON.parse(s.slice(start, s.lastIndexOf('}') + 1));
      return (doc.envs ?? []).map((e) => ({
        name: e.key,
        environments: [].concat(e.target ?? []).map((t) => String(t).toLowerCase()),
        gitBranch: e.gitBranch || null,
      }));
    } catch {
      // fall through to table parsing
    }
  }
  const rows = [];
  for (const raw of s.split(/\r?\n/)) {
    const cells = raw.trim().split(/\s{2,}/);
    if (cells.length < 2 || !/^[A-Za-z_][A-Za-z0-9_]*$/.test(cells[0]) || cells[0] === 'name') continue;
    const envCell = cells.find((c, i) => i > 0 && /(production|preview|development)/i.test(c));
    if (!envCell) continue;
    const environments = [];
    let gitBranch = null;
    for (const piece of envCell.split(/,\s*(?![^(]*\))/)) {
      const p = parseEnvPiece(piece);
      if (!p) continue;
      environments.push(p.env);
      if (p.branch) gitBranch = p.branch;
    }
    if (environments.length > 0) rows.push({ name: cells[0], environments, gitBranch });
  }
  return rows;
}

/** `eas env:list --format short` style NAME=value lines, or `Name:`/`Value:` blocks. */
export function parseEasEnvList(text) {
  const out = {};
  let current = null;
  for (const raw of String(text ?? '').split(/\r?\n/)) {
    const line = raw.replace(/\x1b\[[0-9;]*m/g, '').trim();
    const block = /^(Name|Value):\s*(.*)$/.exec(line);
    if (block) {
      if (block[1] === 'Name') {
        current = block[2].trim();
        out[current] = '';
      } else if (current) {
        out[current] = /^[*•]+$/.test(block[2].trim()) ? '' : block[2].trim();
      }
      continue;
    }
    const kv = /^([A-Z][A-Z0-9_]*)=(.*)$/.exec(line);
    if (kv) out[kv[1]] = /^[*•]+$/.test(kv[2].trim()) ? '' : kv[2].trim();
  }
  return out;
}

export function scanCiWorkflow(yamlText) {
  const found = new Set();
  for (const m of String(yamlText ?? '').matchAll(/secrets\.(SUPABASE_URL|SUPABASE_PUBLISHABLE_KEY|SUPABASE_SERVICE_ROLE_KEY)\b/g)) found.add(m[1]);
  return { test_step_uses_supabase_secrets: found.size > 0, secret_names: [...found] };
}

// ---------------------------------------------------------------- remediation

const isBad = (s) => s === 'points_at_ziko' || s === 'unknown';

/**
 * Plan from audit rows: names/environments/branches/actions only. Production of a surface whose
 * production rows are all clean is never targeted. EAS rows are reported but not remediated here.
 */
export function buildRemediationPlan(rows, { codeNames = {} } = {}) {
  const vercelRows = rows.filter((r) => ENV_MATRIX[r.surface] && r.project !== 'eas');
  const surfaces = [...new Set(vercelRows.map((r) => r.surface))];
  const cleanProduction = surfaces.filter((s) => !vercelRows.some((r) => r.surface === s && r.environment === 'production' && isBad(r.status)));
  const items = [];
  for (const r of vercelRows) {
    if (!isBad(r.status)) continue;
    if (r.environment === 'production' && cleanProduction.includes(r.surface)) continue;
    const inMatrix = Object.hasOwn(ENV_MATRIX[r.surface], r.name);
    const readByCode = codeNames[r.surface] ? codeNames[r.surface].has(r.name) : true;
    items.push({
      surface: r.surface,
      project: r.project,
      environment: r.environment,
      branch: r.branch ?? null,
      name: r.name,
      action: inMatrix && readByCode ? 'set-portfolio' : 'rm',
    });
  }
  return { items, clean_production_surfaces: cleanProduction };
}

/** Refuses (throws) unless the 07-14 approval block exists. argv only; values come later on stdin. */
export function buildRemediationCommands(plan, { authorizationText } = {}) {
  if (!checkAuthBlock(authorizationText, REMEDIATION_HEADING, REMEDIATION_LINE)) {
    throw new Error(`Refusing remediation: missing approval block "### ${REMEDIATION_HEADING}" with "${REMEDIATION_LINE}", Timestamp and Reply in the authorization log`);
  }
  const clean = new Set(plan.clean_production_surfaces ?? []);
  const cmds = [];
  for (const it of plan.items ?? []) {
    if (!ENVIRONMENTS.includes(it.environment)) throw new Error(`Unknown vercel environment ${it.environment}`);
    if (it.environment === 'production' && clean.has(it.surface)) continue;
    const branchArg = it.environment === 'preview' && it.branch ? [it.branch] : [];
    cmds.push({ op: 'rm', surface: it.surface, project: it.project, name: it.name, args: ['env', 'rm', it.name, it.environment, ...branchArg, '--yes'], tolerateAbsent: true });
    if (it.action === 'set-portfolio') {
      const spec = ENV_MATRIX[it.surface][it.name];
      const typeArgs = /^NEXT_PUBLIC_.*KEY$/.test(it.name) ? ['--type', 'config'] : [];
      cmds.push({
        op: 'add',
        surface: it.surface,
        project: it.project,
        name: it.name,
        args: ['env', 'add', it.name, it.environment, ...branchArg, ...typeArgs],
        stdin: true,
        valueFrom: spec.from,
      });
    }
  }
  return cmds;
}

// ---------------------------------------------------------------- report

export function buildAuditReport({ projects = [], rows = [], ci = {}, eas = {}, includeCi = false, now = () => new Date().toISOString() } = {}) {
  const counts = {};
  for (const r of rows) counts[r.status] = (counts[r.status] ?? 0) + 1;
  const ciFail = includeCi && ci?.status === 'on_scratch';
  const passed = !rows.some((r) => isBad(r.status)) && !ciFail;
  const report = {
    generated_at: now(),
    projects,
    rows: rows.map((r) => ({ surface: r.surface, project: r.project, environment: r.environment, branch: r.branch ?? null, name: r.name, status: r.status, ...(r.reason ? { reason: r.reason } : {}) })),
    counts,
    ci,
    eas,
    include_ci: !!includeCi,
    passed,
  };
  assertCommittedSafe(report);
  return report;
}

// ---------------------------------------------------------------- CLI

const SPEC = {
  all: 'boolean',
  'include-ci': 'boolean',
  'vercel-scope': 'string',
  'json-out': 'string',
  'plan-remediation': 'boolean',
  'apply-remediation': 'boolean',
  from: 'string',
  'confirm-ref': 'string',
  'record-gate': 'boolean',
  'authorization-file': 'string',
};

const HELP = `Usage: node scripts/portfolio-migration/23-decom-env-audit.mjs <mode>
  --all --vercel-project <api-name> --vercel-project <web-name> [--vercel-scope <team>] [--include-ci]
       [--json-out <report>] [--record-gate]
        audit every env var (production, preview incl. branch entries, development), EAS and, with
        --include-ci, GitHub secrets + ci.yml. Values are never printed. Exit 0 iff the report passed.
        (--vercel-project may be prefixed api= or web=; otherwise the first is api, the second web)
  --plan-remediation --from <report>
  --apply-remediation --from <report> --confirm-ref <portfolio ref> [--authorization-file <path>]
        needs the "### ${REMEDIATION_HEADING}" approval block (${REMEDIATION_LINE}) in 07-AUTHORIZATIONS.md`;

const mask = (text) => redactPii(String(text ?? '')).replace(/eyJ[\w.-]+/g, '[jwt]').slice(0, 300);

function defaultRunner(cmd, args, { input, cwd } = {}) {
  const r = spawnSync(cmd, args, { input, cwd, encoding: 'utf8', shell: process.platform === 'win32', maxBuffer: 32 * 1024 * 1024 });
  return { status: r.status ?? 1, stdout: r.stdout ?? '', stderr: r.stderr ?? '' };
}

function defaultCodeNames() {
  const out = {};
  for (const surface of ['api', 'web']) out[surface] = new Set(auditEnvNames(collectSources(surface)).found);
  return out;
}

function defaultDeps() {
  return {
    runner: defaultRunner,
    readText: (p) => readFileSync(p, 'utf8'),
    writeText: (p, t) => {
      mkdirSync(dirname(p), { recursive: true });
      writeFileSync(p, t, 'utf8');
    },
    removePath: (p) => rmSync(p, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 }),
    mkTmp: () => mkdtempSync(join(tmpdir(), 'ziko-decom-env-')),
    getKeys: getProjectApiKeys,
    classify: classifyValue,
    collectCodeNames: defaultCodeNames,
    recordGate,
    repoRoot: REPO_ROOT,
    now: () => new Date().toISOString(),
    log: (m) => console.log(m),
    errlog: (m) => console.error(m),
  };
}

/** Pull `--vercel-project` (repeatable) out of argv; parseCliArgs keeps only the last occurrence. */
function extractProjects(argv) {
  const rest = [];
  const projects = [];
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--vercel-project') projects.push(argv[++i] ?? '');
    else rest.push(argv[i]);
  }
  const named = projects.map((p, i) => {
    const m = /^(api|web)=(.+)$/.exec(p);
    return m ? { surface: m[1], name: m[2] } : { surface: i === 0 ? 'api' : i === 1 ? 'web' : null, name: p };
  });
  return { rest, named };
}

const scopeArgs = (args) => (args.vercelScope ? ['--scope', args.vercelScope] : []);

function linkProject(deps, args, name, tmp) {
  return deps.runner('vercel', ['link', '--yes', '--project', name, '--cwd', tmp, ...scopeArgs(args)]).status === 0;
}

async function auditVercelProject({ deps, args, ctx, surface, name, rows, pulled }) {
  const tmp = deps.mkTmp();
  assertOutsideRepo(tmp, deps.repoRoot);
  try {
    if (!linkProject(deps, args, name, tmp)) throw new Error(`vercel link failed for ${surface}`);
    for (const env of ENVIRONMENTS) {
      const ls = deps.runner('vercel', ['env', 'ls', env, '--format', 'json', '--cwd', tmp]);
      if (ls.status !== 0) throw new Error(`vercel env ls ${env} failed for ${surface}`);
      const listed = parseVercelEnvLs(ls.stdout);
      const branches = env === 'preview' ? [...new Set(listed.map((r) => r.gitBranch).filter(Boolean))] : [];
      for (const branch of [null, ...branches]) {
        const file = join(tmp, `.env.pull.${env}.${branch ? `b${branches.indexOf(branch) + 1}` : 'all'}`);
        pulled.push(file);
        const pull = deps.runner('vercel', ['env', 'pull', file, `--environment=${env}`, ...(branch ? [`--git-branch=${branch}`] : []), '--yes', '--cwd', tmp]);
        let values = {};
        if (pull.status === 0) values = parseDotenv(deps.readText(file));
        const names = listed.filter((r) => (r.gitBranch ?? null) === branch).map((r) => r.name);
        for (const n of names) {
          const v = values[n];
          const status = v === undefined || v === '' ? 'unknown' : deps.classify(v, ctx);
          rows.push({ surface, project: name, environment: env, branch, name: n, status, ...(status === 'unknown' ? { reason: pull.status === 0 ? 'sensitive-or-unpullable' : 'pull-failed' } : {}) });
        }
        for (const [n, v] of Object.entries(values)) {
          if (names.includes(n) || v === '') continue;
          const status = deps.classify(v, ctx);
          if (status !== 'clean') rows.push({ surface, project: name, environment: env, branch, name: n, status });
        }
      }
    }
  } finally {
    for (const f of pulled) {
      try {
        deps.removePath(f);
      } catch {
        // tmp dir removal below covers it
      }
    }
    try {
      deps.removePath(tmp);
    } catch {
      // best effort (Windows EPERM)
    }
  }
}

function auditEas({ deps, ctx, rows }) {
  const eas = { available: true, reason: null };
  for (const env of ENVIRONMENTS) {
    const r = deps.runner('npx', ['--yes', `eas-cli@${EAS_CLI_VERSION}`, 'env:list', '--environment', env, '--include-sensitive', '--non-interactive'], { cwd: join(deps.repoRoot, 'apps', 'mobile') });
    if (r.status !== 0) {
      eas.available = false;
      eas.reason = 'eas-unavailable';
      for (const name of Object.keys(ENV_MATRIX.mobile)) rows.push({ surface: 'mobile', project: 'eas', environment: env, branch: null, name, status: 'unknown', reason: 'eas-unavailable' });
      continue;
    }
    const values = parseEasEnvList(r.stdout);
    for (const name of Object.keys(ENV_MATRIX.mobile)) {
      if (!Object.hasOwn(values, name)) continue;
      const v = values[name];
      rows.push({ surface: 'mobile', project: 'eas', environment: env, branch: null, name, status: v === '' ? 'unknown' : deps.classify(v, ctx), ...(v === '' ? { reason: 'hidden-value' } : {}) });
    }
    for (const [name, v] of Object.entries(values)) {
      if (Object.hasOwn(ENV_MATRIX.mobile, name) || v === '') continue;
      const status = deps.classify(v, ctx);
      if (status !== 'clean') rows.push({ surface: 'mobile', project: 'eas', environment: env, branch: null, name, status });
    }
  }
  return eas;
}

function auditCi({ deps }) {
  const ci = { status: 'off_scratch', test_step_uses_supabase_secrets: false, secret_names: [], github_secrets: null };
  let yml = '';
  try {
    yml = deps.readText(join(deps.repoRoot, '.github', 'workflows', 'ci.yml'));
  } catch {
    ci.workflow = 'unreadable';
  }
  const scan = scanCiWorkflow(yml);
  ci.test_step_uses_supabase_secrets = scan.test_step_uses_supabase_secrets;
  ci.secret_names = scan.secret_names;
  if (scan.test_step_uses_supabase_secrets) ci.status = 'on_scratch';
  const gh = deps.runner('gh', ['secret', 'list', '--json', 'name,updatedAt']);
  if (gh.status === 0) {
    try {
      ci.github_secrets = JSON.parse(gh.stdout).map((s) => ({ name: s.name, updated_at: s.updatedAt }));
    } catch {
      ci.github_secrets = null;
    }
  }
  return ci;
}

async function runAudit(args, named, deps) {
  const { log, errlog } = deps;
  if (named.length === 0 || named.some((p) => !p.name || !p.surface)) {
    errlog('ERROR: --all needs --vercel-project <api-name> --vercel-project <web-name>');
    return 2;
  }
  const zikoKeys = await deps.getKeys(PROJECTS.ziko);
  const ctx = {
    zikoRef: PROJECTS.ziko,
    scratchRef: PROJECTS.scratch,
    zikoFingerprints: [zikoKeys.publishable, zikoKeys.secret].filter(Boolean).map(fingerprint),
    scratchFingerprints: [],
  };
  const notes = [];
  try {
    const scratchKeys = await deps.getKeys(PROJECTS.scratch);
    ctx.scratchFingerprints = [scratchKeys.publishable, scratchKeys.secret].filter(Boolean).map(fingerprint);
  } catch {
    notes.push('scratch keys unavailable (project deleted or inaccessible): scratch fingerprints skipped');
  }
  for (const n of notes) log(`NOTE: ${n}`);

  const rows = [];
  const pulled = [];
  let eas = { available: false, reason: 'not-run' };
  let ci = { status: 'not_checked' };
  try {
    for (const p of named) await auditVercelProject({ deps, args, ctx, surface: p.surface, name: p.name, rows, pulled });
    eas = auditEas({ deps, ctx, rows });
    if (args.includeCi) ci = auditCi({ deps });
  } catch (e) {
    errlog(`ERROR: ${mask(e?.message ?? e)}`);
    return 1;
  }
  const report = buildAuditReport({ projects: named.map((p) => p.name), rows, ci, eas: { ...eas, notes }, includeCi: !!args.includeCi, now: deps.now });
  for (const r of report.rows) log(`${r.surface} | ${r.project} | ${r.environment} | ${r.branch ?? '-'} | ${r.name} | ${r.status}`);
  if (args.includeCi) log(`ci | ${ci.status}${ci.test_step_uses_supabase_secrets ? ` | ci.yml injects ${ci.secret_names.join(',')}` : ''}`);
  log(report.passed ? 'AUDIT PASSED' : 'AUDIT NOT PASSED');
  if (args.jsonOut) deps.writeText(resolve(args.jsonOut), `${JSON.stringify(report, null, 2)}\n`);
  if (report.passed && args.recordGate) {
    if (!args.jsonOut) {
      errlog('ERROR: --record-gate needs --json-out (the evidence file)');
      return 2;
    }
    const abs = resolve(args.jsonOut);
    const rel = abs.replaceAll('\\', '/').toLowerCase().startsWith(`${deps.repoRoot.replaceAll('\\', '/').toLowerCase()}/`) ? abs.slice(deps.repoRoot.length + 1).replaceAll('\\', '/') : null;
    if (!rel) {
      errlog('ERROR: --json-out must be inside the repository to be recorded as gate evidence');
      return 1;
    }
    deps.recordGate('env_scopes_clean', { evidence: rel });
    log('gate recorded: env_scopes_clean');
  }
  return report.passed ? 0 : 1;
}

function loadReport(args, deps) {
  if (!args.from) throw new Error('--from <report> is required');
  const doc = JSON.parse(deps.readText(resolve(args.from)));
  if (!Array.isArray(doc?.rows)) throw new Error('report has no rows');
  return doc;
}

export async function run(argv, depsIn = {}) {
  const deps = { ...defaultDeps(), ...Object.fromEntries(Object.entries(depsIn).filter(([, v]) => v !== undefined)) };
  const { log, errlog } = deps;
  const { rest, named } = extractProjects(argv);
  let badArgs = false;
  const args = parseCliArgs(rest, SPEC, { exit: () => { badArgs = true; }, log: errlog });
  if (badArgs) return 2;
  if (args.help) {
    log(HELP);
    return 0;
  }
  const modes = [args.all, args.planRemediation, args.applyRemediation].filter(Boolean).length;
  if (modes !== 1) {
    errlog('ERROR: exactly one of --all, --plan-remediation, --apply-remediation is required');
    return 2;
  }

  try {
    if (args.all) return await runAudit(args, named, deps);

    if (args.planRemediation) {
      const plan = buildRemediationPlan(loadReport(args, deps).rows, { codeNames: deps.collectCodeNames() });
      for (const it of plan.items) log(`${it.action} | ${it.surface} | ${it.project} | ${it.environment} | ${it.branch ?? '-'} | ${it.name}`);
      log(`plan: ${plan.items.length} item(s); production left untouched for: ${plan.clean_production_surfaces.join(',') || '-'}`);
      return 0;
    }

    // --apply-remediation: every refusal happens before any subprocess runs
    if (args.confirmRef !== PROJECTS.portfolio) {
      errlog('ERROR: --confirm-ref must equal the portfolio ref (remediation writes portfolio values)');
      return 1;
    }
    const authText = deps.readText(args.authorizationFile ? resolve(args.authorizationFile) : AUTH_LOG_PATH);
    const plan = buildRemediationPlan(loadReport(args, deps).rows, { codeNames: deps.collectCodeNames() });
    const cmds = buildRemediationCommands(plan, { authorizationText: authText });
    const keys = await deps.getKeys(PROJECTS.portfolio);
    const sources = { url: `https://${PROJECTS.portfolio}.supabase.co`, publishable: keys.publishable, secret: keys.secret };
    const byProject = new Map();
    for (const c of cmds) byProject.set(c.project, [...(byProject.get(c.project) ?? []), c]);
    for (const [project, list] of byProject) {
      const tmp = deps.mkTmp();
      assertOutsideRepo(tmp, deps.repoRoot);
      try {
        if (!linkProject(deps, args, project, tmp)) throw new Error('vercel link failed');
        for (const c of list) {
          const r = deps.runner('vercel', [...c.args, '--cwd', tmp], c.stdin ? { input: sources[c.valueFrom] } : {});
          if (r.status !== 0) {
            const absent = c.tolerateAbsent && /not found|does not exist|no environment variable/i.test(r.stdout + r.stderr);
            if (!absent) throw new Error(`vercel ${c.op} ${c.name} failed`);
          }
          log(`${c.op} | ${project} | ${c.name} | ok`);
        }
      } finally {
        try {
          deps.removePath(tmp);
        } catch {
          // best effort
        }
      }
    }
    log(`REMEDIATION APPLIED: ${cmds.length} command(s)`);
    return 0;
  } catch (e) {
    errlog(`ERROR: ${mask(e?.message ?? e)}`);
    return 1;
  }
}

if (isMain(import.meta.url)) {
  run(process.argv.slice(2)).then(
    (code) => process.exit(code),
    (e) => {
      console.error(`ERROR: ${mask(e?.message ?? e)}`);
      process.exit(1);
    },
  );
}
