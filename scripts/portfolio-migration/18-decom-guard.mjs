#!/usr/bin/env node
/**
 * 18-decom-guard.mjs - Phase 7 fail-closed foundation (D-15, D-16).
 *
 * Library: ref guards (only the ziko project can pass the ziko delete guard, portfolio is refused by
 * every guard, scratch passes only the scratch guards), the decommission gate file, authorization
 * block checkers (the D-15 confirmation is a plain yes in its own block) and a committed-content
 * safety check. Project refs come only from PROJECTS (no literal ref in this file).
 *
 * CLI:
 *   --init                              write an all-false gate file (refuses if it exists)
 *   --status [--require ziko|scratch [--except <key>]]
 *                                       one line per gate; with --require exit 1 unless every required
 *                                       gate verifies (evidence sha256 or authorization block re-check)
 *   --record-gate <key> (--evidence <repo-relative path> | --auth-block "<heading>" --required-line "<line>")
 *
 * All file dependencies are synchronous and injectable (readText, readBytes, writeText, fileExists).
 * Exit codes: 0 ok | 1 refused or not passed | 2 bad args. Output is PII-free.
 */
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, isAbsolute, posix, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PROJECTS, assertProjectRefFormat, parseCliArgs, isMain, redactPii } from '../auth-merge/lib.mjs';
import { assertReportSafe } from './lib-verify.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = resolve(HERE, '..', '..');

export const DECOM_REFS = Object.freeze({ ziko: PROJECTS.ziko, portfolio: PROJECTS.portfolio, scratch: PROJECTS.scratch });
export const EXPECTED_NAMES = Object.freeze({ ziko: 'ziko', scratch: 'ziko-migration-scratch' });

export const GATE_KEYS = Object.freeze([
  'freeze_proven',
  'backup_encrypted',
  'backup_second_copy',
  'restore_proven',
  'verify_pass',
  'env_scopes_clean',
  'ci_off_scratch',
  'ci_token_revoked',
  'scratch_deleted',
  'confirmation_yes',
]);

export const REQUIRED_GATES = Object.freeze({
  ziko: GATE_KEYS,
  scratch: Object.freeze(['restore_proven', 'ci_off_scratch']),
});

/** The one and only gate that may be recorded as waived (07-15: user declined to revoke the stale CI token). */
export const WAIVABLE_GATE = 'ci_token_revoked';
export const WAIVER_HEADING = '07-15 ci token waiver';
export const WAIVER_LINE = 'Waiver: ci_token_revoked (token ziko-ci-portfolio NOT revoked; user decision)';

export const GATES_PATH = resolve(REPO_ROOT, 'scripts', 'portfolio-migration', 'baseline', 'decom-gates.json');
export const AUTH_LOG_PATH = resolve(
  REPO_ROOT,
  '.planning',
  'workstreams',
  'supabase-portfolio-migration',
  'phases',
  '07-monitoring-decommission',
  '07-AUTHORIZATIONS.md',
);

// ---------------------------------------------------------------- ref guards

/** Delete guard: only project 'ziko' (its own ref) or 'scratch' (its own ref); portfolio never. */
export function assertDeleteAllowed({ project, ref, confirmRef } = {}) {
  if (project === 'portfolio') {
    throw new Error('Refusing to delete: portfolio is the live target and is never deletable by this phase');
  }
  if (project !== 'ziko' && project !== 'scratch') {
    throw new Error("Refusing to delete: project must be 'ziko' or 'scratch'");
  }
  assertProjectRefFormat(ref);
  if (ref === PROJECTS.portfolio) throw new Error('Refusing to delete: ref is the portfolio project');
  if (ref !== DECOM_REFS[project]) throw new Error(`Refusing to delete: ref does not match the ${project} project`);
  if (confirmRef !== ref) throw new Error('Refusing to delete: --confirm-ref must equal the project ref');
}

/** Freeze guard: ziko or scratch only (scratch is the dry-run target); portfolio always refused. */
export function assertZikoFreezeAllowed({ target, confirmRef } = {}) {
  if (target === 'portfolio') throw new Error('Refusing to freeze: portfolio is the live target');
  if (target !== 'ziko' && target !== 'scratch') throw new Error("Refusing to freeze: target must be 'ziko' or 'scratch'");
  if (confirmRef !== DECOM_REFS[target]) throw new Error(`Refusing to freeze: --confirm-ref must equal the ${target} ref`);
}

/** Scratch write guard (restore proof): only the scratch ref with a matching confirm ref. */
export function assertScratchWriteAllowed({ ref, confirmRef } = {}) {
  assertProjectRefFormat(ref);
  if (ref !== PROJECTS.scratch) throw new Error('Refusing to write: only the scratch project is writable here');
  if (confirmRef !== ref) throw new Error('Refusing to write: --confirm-ref must equal the scratch ref');
}

// ---------------------------------------------------------------- authorization checkers

const TIMESTAMP_ISO_RE = /^Timestamp: \d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/;
const TIMESTAMP_LOOSE_RE = /^Timestamp: \d{4}-\d{2}-\d{2}/;
const REPLY_RE = /^Reply: "(.*)"$/;

/** Every block under the exact `### <heading>` line; a block ends at the next heading line. */
function blocksFor(text, heading) {
  const lines = String(text ?? '').split('\n').map((l) => l.replace(/\r$/, ''));
  const want = `### ${heading}`;
  const blocks = [];
  for (let i = 0; i < lines.length; i++) {
    if (lines[i] !== want) continue;
    const body = [];
    for (let j = i + 1; j < lines.length && !/^#{1,6} /.test(lines[j]); j++) body.push(lines[j]);
    blocks.push(body);
  }
  return blocks;
}

export function confirmationLine() {
  return `Confirmation: yes (delete ziko ${PROJECTS.ziko})`;
}

function plainYes(reply) {
  return reply.trim().toLowerCase().replace(/[.!]$/, '') === 'yes';
}

/** D-15: exactly one heading block with the exact confirmation line, ISO timestamp and a plain-yes reply. */
export function checkConfirmation(text, heading) {
  const blocks = blocksFor(text, heading);
  if (blocks.length !== 1) return false;
  const body = blocks[0];
  if (body.some((l) => l === 'Confirmation: none (abort)')) return false;
  if (!body.includes(confirmationLine())) return false;
  if (!body.some((l) => TIMESTAMP_ISO_RE.test(l))) return false;
  const replies = body.map((l) => l.match(REPLY_RE)).filter(Boolean);
  if (replies.length !== 1) return false;
  return plainYes(replies[0][1]);
}

/** Generic block check: exact required line, a Timestamp line and a Reply line. */
export function checkAuthBlock(text, heading, requiredLine) {
  if (typeof requiredLine !== 'string' || requiredLine === '') return false;
  return blocksFor(text, heading).some(
    (body) =>
      body.includes(requiredLine) &&
      body.some((l) => TIMESTAMP_LOOSE_RE.test(l)) &&
      body.some((l) => REPLY_RE.test(l)),
  );
}

// ---------------------------------------------------------------- committed-content safety

const SECRET_PATTERNS = [
  [/eyJ[A-Za-z0-9_-]{10,}/, 'a JWT fragment'],
  [/sbp_[A-Za-z0-9]/, 'a Supabase access token'],
  [/sb_secret_/, 'a Supabase secret key'],
];

/** Throws if text (or the JSON of an object) holds an email, a full UUID, a JWT fragment or a token. */
export function assertCommittedSafe(objOrText) {
  const text = typeof objOrText === 'string' ? objOrText : JSON.stringify(objOrText);
  assertReportSafe(text);
  for (const [re, what] of SECRET_PATTERNS) {
    if (re.test(text)) throw new Error(`committed content contains ${what}`);
  }
  return true;
}

function normalizeForCompare(p) {
  return posix.normalize(String(p).replaceAll('\\', '/')).replace(/\/+$/, '').toLowerCase();
}

/** Throws when absPath equals or lies inside repoRoot (case-insensitive, both slash styles). */
export function assertOutsideRepo(absPath, repoRoot) {
  const p = normalizeForCompare(absPath);
  const r = normalizeForCompare(repoRoot);
  if (p === r || p.startsWith(`${r}/`)) {
    throw new Error('Refusing: path is inside the repository (backups must live outside it)');
  }
}

// ---------------------------------------------------------------- gate file

export function emptyGates() {
  const out = {};
  for (const k of GATE_KEYS) {
    out[k] = { passed: false, at: null, evidence: null, sha256: null, auth_block: null, required_line: null };
  }
  return out;
}

const sha256Hex = (bytes) => createHash('sha256').update(bytes).digest('hex');

function fileDeps(depsIn = {}) {
  return {
    repoRoot: REPO_ROOT,
    now: () => new Date().toISOString(),
    readText: (p) => readFileSync(p, 'utf8'),
    readBytes: (p) => readFileSync(p),
    writeText: (p, t) => writeFileSync(p, t, 'utf8'),
    fileExists: (p) => existsSync(p),
    ...Object.fromEntries(Object.entries(depsIn).filter(([, v]) => v !== undefined)),
  };
}

export function readGates(depsIn = {}) {
  const deps = fileDeps(depsIn);
  let doc;
  try {
    doc = JSON.parse(deps.readText(GATES_PATH));
  } catch (e) {
    throw new Error(`cannot read gate file: ${redactPii(e?.message ?? e)}`);
  }
  if (!doc || typeof doc !== 'object' || Array.isArray(doc)) throw new Error('gate file is not an object');
  const keys = Object.keys(doc);
  const unknown = keys.filter((k) => !GATE_KEYS.includes(k));
  const missing = GATE_KEYS.filter((k) => !keys.includes(k));
  if (unknown.length || missing.length) {
    throw new Error(`gate file keys invalid (unknown: ${unknown.join(',') || '-'}; missing: ${missing.join(',') || '-'})`);
  }
  return doc;
}

function writeGates(doc, deps) {
  assertCommittedSafe(doc);
  deps.writeText(GATES_PATH, `${JSON.stringify(doc, null, 2)}\n`);
}

/** Marks a gate passed, only with existing safe evidence (sha256 recorded) or a verbatim authorization block. */
export function recordGate(key, { evidence, authBlock, requiredLine, waiver } = {}, depsIn = {}) {
  const deps = fileDeps(depsIn);
  if (!GATE_KEYS.includes(key)) throw new Error(`unknown gate key: ${String(key).slice(0, 40)}`);
  const entry = { passed: true, at: deps.now(), evidence: null, sha256: null, auth_block: null, required_line: null };

  if (waiver) {
    if (key !== WAIVABLE_GATE) throw new Error(`only ${WAIVABLE_GATE} can be waived`);
    if (evidence || authBlock || requiredLine) throw new Error('a waiver takes no evidence or block arguments');
    if (!checkAuthBlock(deps.readText(AUTH_LOG_PATH), WAIVER_HEADING, WAIVER_LINE)) {
      throw new Error('waiver block not found or incomplete in the authorization log');
    }
    entry.passed = 'waived';
    entry.auth_block = WAIVER_HEADING;
    entry.required_line = WAIVER_LINE;
  } else if (key === 'confirmation_yes') {
    if (!authBlock) throw new Error('confirmation_yes requires --auth-block (the D-15 block)');
    if (!checkConfirmation(deps.readText(AUTH_LOG_PATH), authBlock)) {
      throw new Error('D-15 confirmation block is missing or not a plain yes');
    }
    entry.auth_block = authBlock;
    entry.required_line = confirmationLine();
  } else if (authBlock) {
    if (!requiredLine) throw new Error('--auth-block requires --required-line');
    if (!checkAuthBlock(deps.readText(AUTH_LOG_PATH), authBlock, requiredLine)) {
      throw new Error('authorization block not found or incomplete');
    }
    entry.auth_block = authBlock;
    entry.required_line = requiredLine;
  } else if (evidence) {
    if (isAbsolute(evidence) || /^[A-Za-z]:/.test(evidence) || evidence.split(/[\\/]/).includes('..')) {
      throw new Error('evidence must be a repo-relative path');
    }
    let bytes;
    try {
      bytes = Buffer.from(deps.readBytes(resolve(deps.repoRoot, evidence)));
    } catch {
      throw new Error(`evidence file does not exist: ${evidence}`);
    }
    assertCommittedSafe(bytes.toString('utf8'));
    entry.evidence = evidence.replaceAll('\\', '/');
    entry.sha256 = sha256Hex(bytes);
  } else {
    throw new Error('recordGate needs evidence or an authorization block');
  }

  const gates = readGates(deps);
  gates[key] = entry;
  writeGates(gates, deps);
  return gates;
}

/** ok only when every required gate is passed AND its evidence hash / authorization block still verifies. */
export function verifyGates(gates, { required = GATE_KEYS, readBytes, readText, repoRoot } = {}) {
  const deps = fileDeps({ readBytes, readText, repoRoot });
  const missing = [];
  const mismatched = [];
  let authText;
  const authLog = () => {
    if (authText === undefined) {
      try {
        authText = deps.readText(AUTH_LOG_PATH);
      } catch {
        authText = '';
      }
    }
    return authText;
  };
  for (const key of required) {
    const g = gates?.[key];
    const waived = g?.passed === 'waived' && key === WAIVABLE_GATE;
    if (!g || (g.passed !== true && !waived)) {
      missing.push(key);
      continue;
    }
    let ok = false;
    if (waived) {
      // satisfied only by the exact waiver block, never by evidence or any other heading/line
      ok = g.auth_block === WAIVER_HEADING && g.required_line === WAIVER_LINE && checkAuthBlock(authLog(), WAIVER_HEADING, WAIVER_LINE);
    } else if (key === 'confirmation_yes') {
      ok = !!g.auth_block && checkConfirmation(authLog(), g.auth_block);
    } else {
      if (g.evidence && g.sha256) {
        try {
          ok = sha256Hex(Buffer.from(deps.readBytes(resolve(deps.repoRoot, g.evidence)))) === g.sha256;
        } catch {
          ok = false;
        }
      }
      if (!ok && g.auth_block && g.required_line) ok = checkAuthBlock(authLog(), g.auth_block, g.required_line);
    }
    if (!ok) mismatched.push(key);
  }
  return { ok: missing.length === 0 && mismatched.length === 0, missing, mismatched };
}

// ---------------------------------------------------------------- CLI

const SPEC = {
  init: 'boolean',
  status: 'boolean',
  'record-gate': 'string',
  'record-waiver': 'string',
  evidence: 'string',
  'auth-block': 'string',
  'required-line': 'string',
  require: 'string',
  except: 'string',
};

const HELP = `Usage: node scripts/portfolio-migration/18-decom-guard.mjs <mode>
  --init
  --status [--require ziko|scratch [--except <gate key>]]
  --record-waiver ci_token_revoked   (needs the '### 07-15 ci token waiver' block; shown as WAIVED)
  --record-gate <key> (--evidence <repo-relative path> | --auth-block "<heading>" --required-line "<line>")
Gate keys: ${GATE_KEYS.join(', ')}`;

export async function run(argv, depsIn = {}) {
  const deps = fileDeps(depsIn);
  const log = depsIn.log ?? ((m) => console.log(m));
  const errlog = depsIn.errlog ?? ((m) => console.error(m));
  let badArgs = false;
  const args = parseCliArgs(argv, SPEC, { exit: () => { badArgs = true; }, log: errlog });
  if (badArgs) return 2;
  if (args.help) {
    log(HELP);
    return 0;
  }
  const modes = [args.init, args.status, !!args.recordGate, !!args.recordWaiver].filter(Boolean).length;
  if (modes !== 1) {
    errlog('ERROR: exactly one of --init, --status, --record-gate, --record-waiver is required');
    return 2;
  }

  try {
    if (args.init) {
      if (deps.fileExists(GATES_PATH)) {
        errlog('ERROR: gate file already exists; refusing to overwrite');
        return 1;
      }
      writeGates(emptyGates(), deps);
      log(`gate file created with ${GATE_KEYS.length} gates, all false`);
      return 0;
    }

    if (args.status) {
      const gates = readGates(deps);
      for (const k of GATE_KEYS) {
        const g = gates[k];
        const mark = g.passed === true ? 'PASS' : g.passed === 'waived' ? 'WAIVED' : '----';
        log(`${k}: ${mark}  ${g.evidence ?? g.auth_block ?? ''}`.trimEnd());
      }
      if (!args.require) return 0;
      if (!Object.hasOwn(REQUIRED_GATES, args.require)) {
        errlog('ERROR: --require must be ziko or scratch');
        return 2;
      }
      const required = REQUIRED_GATES[args.require].filter((k) => k !== args.except);
      const r = verifyGates(gates, { required, ...deps });
      if (!r.ok) {
        errlog(`NOT READY (${args.require}): missing=${r.missing.join(',') || '-'} mismatched=${r.mismatched.join(',') || '-'}`);
        return 1;
      }
      log(`READY (${args.require}): ${required.length} gates verified`);
      return 0;
    }

    if (args.recordWaiver) {
      recordGate(args.recordWaiver, { waiver: true }, deps);
      log(`gate waived: ${args.recordWaiver}`);
      return 0;
    }
    recordGate(args.recordGate, { evidence: args.evidence, authBlock: args.authBlock, requiredLine: args.requiredLine }, deps);
    log(`gate recorded: ${args.recordGate}`);
    return 0;
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
