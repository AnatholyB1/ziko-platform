#!/usr/bin/env node
/**
 * 13-cutover-delta.mjs - Phase 6 final delta runbook (D-05, D-06, D-07).
 *
 * One gated command that composes only the proven Phase 3/4/5 scripts, in order:
 *   collision check -> auth delta report -> auth import -> waitlist setval -> auth verify
 *   -> loader probe -> loader apply -> storage add-only copy
 *   -> 06-verify-data --check all -> 09-verify-storage --check all
 *
 * Modes:
 *   --mode plan    read-only children only (no --apply / --probe / --confirm-ref)
 *   --mode apply   writes; needs --confirm-ref == --project-ref, and on portfolio an authorization
 *                  file holding the exact line `Typed authorization: <phrase>`
 *
 * ziko is refused as a target on every mode. This script never touches SQL itself; every write goes
 * through a child script. Report and console output are PII-free (step names, exit codes, counts,
 * durations only).
 *
 * Exit codes: 0 ok | 1 refused or a step failed | 2 bad args | 4 new collision / remap mismatch
 *             | 5 password changes need human review.
 */
import { spawnSync } from 'node:child_process';
import { readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PROJECTS, parseCliArgs, assertProjectRefFormat, assertWriteAllowed, isMain, redactPii } from '../auth-merge/lib.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const AUTH_DIR = resolve(HERE, '..', 'auth-merge');

const SCRIPTS = {
  collision: join(AUTH_DIR, '01-collision-check.mjs'),
  import: join(AUTH_DIR, '02-import-auth.mjs'),
  waitlist: join(AUTH_DIR, '04-sync-waitlist-seq.mjs'),
  authVerify: join(AUTH_DIR, '06-verify.mjs'),
  load: join(HERE, '05-load-data.mjs'),
  copy: join(HERE, '08-copy-storage.mjs'),
  verifyData: join(HERE, '06-verify-data.mjs'),
  verifyStorage: join(HERE, '09-verify-storage.mjs'),
};

export const DEFAULT_PHRASE = 'approve ubxllsvanurkwkohzxau option-cutover-delta';

// Flags recorded in 03-11 / 05-11 SUMMARY for the portfolio runs; nothing else may be passed through.
const IMPORT_EXTRA_ALLOWED = ['--fill-null-instance-id', '--fill-null-token-columns', '--allow-unmatched-known-collision'];
const VERIFY_EXTRA_ALLOWED = ['--allow-instance-id-fill', '--allow-token-fill'];

const JWT_RE = /eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]*/g;

export function maskOutput(text) {
  return redactPii(text).replace(JWT_RE, '[jwt]');
}

// ---------------------------------------------------------------- pure helpers

/** True only when a line equals `Typed authorization: <phrase>` exactly (a trailing \r is tolerated). */
export function checkAuthorization(text, phrase) {
  const want = `Typed authorization: ${phrase}`;
  return String(text ?? '')
    .split('\n')
    .some((line) => line.replace(/\r$/, '') === want);
}

/** Counts from the `--delta-report` output (and `to_insert=` when a plan line is present). */
export function parseDeltaReport(text) {
  const num = (key) => {
    const m = String(text ?? '').match(new RegExp(`(?:^|\\s)${key}=(\\d+)(?![\\w-])`, 'm'));
    return m ? Number(m[1]) : 0;
  };
  return { newUsers: num('to_insert'), passwordChanged: num('password_changed'), otherChanged: num('other_changed') };
}

/** Numeric `key=value` pairs only, so no identifier or PII can reach the report. */
export function extractCounts(text) {
  const counts = {};
  const re = /(?:^|[\s,;(])([a-z][a-z_]*)=(\d+)(?![\w-])/gm;
  let m;
  while ((m = re.exec(String(text ?? ''))) !== null) counts[m[1]] = Number(m[2]);
  return counts;
}

/** Delta remap is acceptable when every non-identity mapping already exists in the committed remap. */
export function compareRemaps(deltaJson, committedJson) {
  const pairs = (j) => (Array.isArray(j?.remaps) ? j.remaps : []).map((r) => [r.source_user_id, r.target_user_id]);
  const committed = new Set(pairs(committedJson).map(([s, t]) => `${s}>${t}`));
  const added = pairs(deltaJson).filter(([s, t]) => s !== t && !committed.has(`${s}>${t}`));
  return { ok: added.length === 0, newMappings: added.length };
}

export function buildSteps(o) {
  const apply = o.mode === 'apply';
  const importExtra = o.importExtra ?? [];
  const verifyExtra = o.verifyExtra ?? [];
  const refs = ['--source-ref', o.sourceRef, '--project-ref', o.projectRef];
  const collisionFlags = importExtra.includes('--allow-unmatched-known-collision') ? ['--allow-unmatched-known-collision'] : [];
  const ca = o.caFile ? ['--ca-file', o.caFile] : [];
  const trig = o.triggerMode ? ['--trigger-mode', o.triggerMode] : [];
  const rp = (suffix) => join(o.reportDir ?? '.', `${o.reportPrefix ?? 'cutover'}-delta-${suffix}.json`);
  const step = (name, script, argv) => ({ name, script, argv });

  const steps = [
    step('collision', SCRIPTS.collision, [...refs, ...collisionFlags]),
    step('delta-report', SCRIPTS.import, [...refs, '--delta-report', ...collisionFlags]),
  ];

  if (!apply) {
    steps.push(step('load-plan', SCRIPTS.load, [...refs, '--remap-file', o.remapFile, '--plan', ...ca, ...trig]));
    steps.push(step('copy-plan', SCRIPTS.copy, [...refs, '--remap-file', o.remapFile, '--plan']));
    return steps;
  }

  const confirm = ['--confirm-ref', o.confirmRef];
  steps.push(step('import', SCRIPTS.import, [...refs, ...confirm, '--apply', '--remap-out', o.deltaRemapPath, ...importExtra]));
  steps.push(step('waitlist', SCRIPTS.waitlist, [...refs, ...confirm]));
  steps.push(
    step('auth-verify', SCRIPTS.authVerify, [
      '--project-ref', o.projectRef, '--source-ref', o.sourceRef, '--check', 'all', '--baseline', o.authBaseline, ...verifyExtra,
    ])
  );
  steps.push(step('load-probe', SCRIPTS.load, [...refs, ...confirm, '--remap-file', o.remapFile, '--probe', ...ca, ...trig]));
  steps.push(
    step('load-apply', SCRIPTS.load, [
      ...refs, ...confirm, '--remap-file', o.remapFile, '--apply', ...ca, ...trig, '--report-out', rp('load'),
    ])
  );
  steps.push(
    step('copy-apply', SCRIPTS.copy, [...refs, ...confirm, '--remap-file', o.remapFile, '--apply', '--report-out', rp('copy')])
  );
  steps.push(
    step('verify-data', SCRIPTS.verifyData, [
      '--project-ref', o.projectRef, '--source-ref', o.sourceRef, '--check', 'all',
      '--remap-file', o.remapFile, '--baseline', o.dataBaseline, '--json-out', rp('verify-data'),
    ])
  );
  steps.push(
    step('verify-storage', SCRIPTS.verifyStorage, [
      '--project-ref', o.projectRef, '--source-ref', o.sourceRef, '--check', 'all',
      '--remap-file', o.remapFile, '--baseline', o.storageBaseline, '--json-out', rp('verify-storage'),
    ])
  );
  return steps;
}

/**
 * Run steps sequentially via runner(step) -> { status, stdout, stderr }.
 * afterStep(step, result) may return { exit, reason } to stop the run (reason is PII-free).
 * Stops at the first non-zero child exit.
 */
export async function runSteps(steps, runner, { afterStep, echo } = {}) {
  const results = [];
  for (const step of steps) {
    const started = Date.now();
    const r = await runner(step);
    const stdout = r.stdout ?? '';
    const stderr = r.stderr ?? '';
    const exitCode = typeof r.status === 'number' ? r.status : 1;
    const entry = {
      step: step.name,
      exitCode,
      durationMs: Date.now() - started,
      counts: extractCounts(`${stdout}\n${stderr}`),
    };
    results.push(entry);
    if (echo) echo(step, stdout, stderr);
    if (exitCode !== 0) {
      return { ok: false, failedStep: step.name, exitCode, exit: 1, results };
    }
    const stop = afterStep ? await afterStep(step, { stdout, stderr, entry }) : undefined;
    if (stop) {
      return { ok: false, failedStep: step.name, exitCode: 0, exit: stop.exit, reason: stop.reason, results };
    }
  }
  return { ok: true, failedStep: null, exitCode: 0, exit: 0, results };
}

// ---------------------------------------------------------------- CLI

const SPEC = {
  'source-ref': 'string',
  'project-ref': 'string',
  mode: 'string',
  'confirm-ref': 'string',
  'remap-file': 'string',
  'ca-file': 'string',
  'auth-baseline': 'string',
  'data-baseline': 'string',
  'storage-baseline': 'string',
  'report-dir': 'string',
  'report-prefix': 'string',
  'authorization-file': 'string',
  'authorization-phrase': 'string',
  'apply-password-updates': 'boolean',
  'reviewed-password-count': 'string',
  'trigger-mode': 'string',
  'import-extra-flags': 'list',
  'verify-extra-flags': 'list',
};

const HELP = `Usage: node scripts/portfolio-migration/13-cutover-delta.mjs --source-ref <ziko> --project-ref <portfolio|scratch> --mode plan|apply
  --remap-file <committed remap> --ca-file <pem> --auth-baseline <p> --data-baseline <p> --storage-baseline <p>
  [--confirm-ref <ref>] [--authorization-file <p>] [--authorization-phrase <s>] [--report-dir <d>] [--report-prefix <s>]
  [--apply-password-updates --reviewed-password-count <n>] [--trigger-mode <m>]
  [--import-extra-flags a,b] [--verify-extra-flags a,b]`;

function defaultDeps() {
  return {
    runner: (step) => {
      const r = spawnSync(process.execPath, [step.script, ...step.argv], {
        env: process.env,
        encoding: 'utf8',
        maxBuffer: 256 * 1024 * 1024,
      });
      return { status: r.status ?? 1, stdout: r.stdout ?? '', stderr: r.stderr ?? (r.error ? String(r.error.message) : '') };
    },
    tmpdir: tmpdir(),
    log: (m) => console.log(m),
    errlog: (m) => console.error(m),
    readText: (p) => readFile(p, 'utf8'),
    writeText: (p, t) => writeFile(p, t, 'utf8'),
    removeFile: (p) => rm(p, { force: true }),
  };
}

export async function run(argv, depsIn = {}) {
  const deps = { ...defaultDeps(), ...depsIn };
  const { log, errlog } = deps;
  let badArgs = false;
  const args = parseCliArgs(argv, SPEC, { exit: () => { badArgs = true; }, log: errlog });
  if (badArgs) return 2;
  if (args.help) {
    log(HELP);
    return 0;
  }

  try {
    assertProjectRefFormat(args.sourceRef);
    assertProjectRefFormat(args.projectRef);
  } catch (e) {
    errlog(`ERROR: ${e.message}`);
    return 2;
  }
  if (args.sourceRef !== PROJECTS.ziko) {
    errlog('ERROR: --source-ref must be the ziko project');
    return 2;
  }
  // Gate 1: ziko is never a target, on any mode.
  if (args.projectRef === PROJECTS.ziko) {
    errlog('ERROR: ziko can never be the target');
    return 1;
  }
  if (args.projectRef !== PROJECTS.portfolio && args.projectRef !== PROJECTS.scratch) {
    errlog('ERROR: --project-ref must be the portfolio or scratch project');
    return 2;
  }
  if (args.mode !== 'plan' && args.mode !== 'apply') {
    errlog('ERROR: --mode plan|apply is required');
    return 2;
  }
  if (!args.remapFile) {
    errlog('ERROR: --remap-file is required');
    return 2;
  }
  const importExtra = args.importExtraFlags;
  const verifyExtra = args.verifyExtraFlags;
  if (importExtra.some((f) => !IMPORT_EXTRA_ALLOWED.includes(f)) || verifyExtra.some((f) => !VERIFY_EXTRA_ALLOWED.includes(f))) {
    errlog('ERROR: extra flag outside the allowlist');
    return 2;
  }
  let reviewedCount = null;
  if (args.reviewedPasswordCount !== null) {
    if (!/^\d+$/.test(args.reviewedPasswordCount)) {
      errlog('ERROR: --reviewed-password-count must be a non-negative integer');
      return 2;
    }
    reviewedCount = Number(args.reviewedPasswordCount);
  }

  const apply = args.mode === 'apply';
  if (apply) {
    // Gate 2: write guard, then confirm-ref must equal project-ref (scratch too).
    try {
      assertWriteAllowed({ projectRef: args.projectRef, confirmRef: args.confirmRef });
    } catch (e) {
      errlog(`ERROR: ${e.message}`);
      return 1;
    }
    if (args.confirmRef !== args.projectRef) {
      errlog('ERROR: --confirm-ref must equal --project-ref for apply');
      return 1;
    }
    for (const k of ['authBaseline', 'dataBaseline', 'storageBaseline', 'caFile']) {
      if (!args[k]) {
        errlog(`ERROR: --${k.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)} is required for apply`);
        return 2;
      }
    }
    // Gate 3: human typed authorization (portfolio only).
    if (args.projectRef === PROJECTS.portfolio) {
      const phrase = args.authorizationPhrase ?? DEFAULT_PHRASE;
      let text = null;
      if (args.authorizationFile) {
        try {
          text = await deps.readText(args.authorizationFile);
        } catch {
          text = null;
        }
      }
      if (text === null || !checkAuthorization(text, phrase)) {
        errlog('ERROR: authorization file missing or lacks the exact "Typed authorization: <phrase>" line');
        return 1;
      }
    }
  }

  const deltaRemapPath = join(deps.tmpdir, 'uuid-remap.delta.json');
  const reportDir = args.reportDir ?? join(HERE, 'reports');
  const reportPrefix = args.reportPrefix ?? (args.projectRef === PROJECTS.portfolio ? 'portfolio-cutover' : 'scratch-cutover');
  const steps = buildSteps({
    mode: args.mode,
    sourceRef: args.sourceRef,
    projectRef: args.projectRef,
    confirmRef: args.confirmRef,
    remapFile: args.remapFile,
    caFile: args.caFile,
    authBaseline: args.authBaseline,
    dataBaseline: args.dataBaseline,
    storageBaseline: args.storageBaseline,
    reportDir,
    reportPrefix,
    triggerMode: args.triggerMode,
    importExtra,
    verifyExtra,
    deltaRemapPath,
  });

  if (apply) await deps.removeFile(deltaRemapPath);

  let delta = { newUsers: 0, passwordChanged: 0, otherChanged: 0 };
  const afterStep = async (step, { stdout }) => {
    if (step.name === 'delta-report') {
      delta = parseDeltaReport(stdout);
      if (apply && delta.passwordChanged > 0) {
        const approved = args.applyPasswordUpdates && reviewedCount === delta.passwordChanged;
        if (!approved) {
          return { exit: 5, reason: `password_changed=${delta.passwordChanged} needs review (--apply-password-updates with matching --reviewed-password-count)` };
        }
        const imp = steps.find((s) => s.name === 'import');
        imp.argv.push('--apply-password-updates');
      }
    }
    if (step.name === 'import') {
      let ok = false;
      try {
        const [d, c] = [JSON.parse(await deps.readText(deltaRemapPath)), JSON.parse(await deps.readText(args.remapFile))];
        ok = compareRemaps(d, c).ok;
      } catch {
        ok = false;
      }
      if (!ok) return { exit: 4, reason: 'new collision: delta remap differs from the committed remap' };
    }
    return undefined;
  };
  const echo = (step, stdout, stderr) => {
    log(`--- step ${step.name}`);
    const out = maskOutput(`${stdout}${stderr ? `\n${stderr}` : ''}`).trim();
    if (out) log(out);
  };

  const res = await runSteps(steps, deps.runner, { afterStep, echo });

  const summary = {
    mode: args.mode,
    projectRef: args.projectRef,
    ok: res.ok,
    failedStep: res.failedStep,
    exit: res.exit,
    reason: res.reason ?? null,
    delta,
    steps: res.results,
  };
  const summaryJson = JSON.stringify(summary, null, 2);
  try {
    await deps.writeText(join(reportDir, `${reportPrefix}-delta-summary.json`), summaryJson);
  } catch (e) {
    errlog(`WARN: could not write summary report: ${maskOutput(e.message)}`);
  }

  log(
    `delta: new_users=${delta.newUsers} password_changed=${delta.passwordChanged} other_changed=${delta.otherChanged}`
  );
  if (!apply) {
    const load = res.results.find((r) => r.step === 'load-plan')?.counts ?? {};
    const copy = res.results.find((r) => r.step === 'copy-plan')?.counts ?? {};
    const sum = (o) => Object.values(o).reduce((a, b) => a + b, 0);
    log(`loader plan numeric total=${sum(load)} storage plan numeric total=${sum(copy)}`);
  }
  if (!res.ok) {
    errlog(`FAILED at step ${res.failedStep}${res.reason ? `: ${res.reason}` : ` (exit ${res.exitCode})`}`);
  } else {
    log(`OK: ${res.results.length} steps passed (${args.mode})`);
  }
  return res.exit;
}

if (isMain(import.meta.url)) {
  run(process.argv.slice(2)).then(
    (code) => process.exit(code),
    (e) => {
      console.error(`ERROR: ${maskOutput(e?.message ?? e)}`);
      process.exit(1);
    }
  );
}
