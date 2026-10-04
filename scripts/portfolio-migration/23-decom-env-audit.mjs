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
import { mkdtempSync, readFileSync, writeFileSync, rmSync, existsSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PROJECTS, getProjectApiKeys, parseCliArgs, isMain, redactPii } from '../auth-merge/lib.mjs';
import { fingerprint, ENV_MATRIX, EAS_CLI_VERSION, auditEnvNames } from './17-env-switch.mjs';
import { checkAuthBlock, assertCommittedSafe, assertOutsideRepo, recordGate, AUTH_LOG_PATH, REPO_ROOT } from './18-decom-guard.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));

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

export { auditEnvNames, EAS_CLI_VERSION, redactPii, getProjectApiKeys, PROJECTS, parseCliArgs, isMain, recordGate, assertOutsideRepo, AUTH_LOG_PATH, REPO_ROOT, HERE, spawnSync, mkdtempSync, readFileSync, writeFileSync, rmSync, existsSync, mkdirSync, tmpdir, resolve, join };
