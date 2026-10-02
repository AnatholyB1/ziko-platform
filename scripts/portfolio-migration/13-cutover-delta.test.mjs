// Tests for 13-cutover-delta.mjs (Phase 6, plan 06-02). All offline: children are replaced by an
// injected fake runner. Fixtures use fake zero-pattern UUIDs only.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildSteps,
  checkAuthorization,
  parseDeltaReport,
  runSteps,
  run,
} from './13-cutover-delta.mjs';

const ZIKO = 'slkobhavpwsubnsmuhya';
const PORTFOLIO = 'ubxllsvanurkwkohzxau';
const SCRATCH = 'rkirvurggtgjlkeuhded';
const PHRASE = 'approve ubxllsvanurkwkohzxau option-cutover-delta';
const ZERO_A = '00000000-0000-0000-0000-00000000000a';
const ZERO_B = '00000000-0000-0000-0000-00000000000b';
const ZERO_C = '00000000-0000-0000-0000-00000000000c';

const DELTA_CLEAN = `password_changed=0\nother_changed=1\n  ${ZERO_A}\n`;
const DELTA_PW = `password_changed=2\n  ${ZERO_A}\n  ${ZERO_B}\nother_changed=0\n`;

const baseOpts = {
  mode: 'apply',
  sourceRef: ZIKO,
  projectRef: PORTFOLIO,
  confirmRef: PORTFOLIO,
  remapFile: 'scripts/auth-merge/uuid-remap.json',
  caFile: 'ca.pem',
  authBaseline: 'auth-baseline.json',
  dataBaseline: 'data-baseline.json',
  storageBaseline: 'storage-baseline.json',
  reportDir: 'reports',
  reportPrefix: 'portfolio-cutover',
  deltaRemapPath: 'tmp/uuid-remap.delta.json',
};

function fakeRunner(script = {}) {
  const calls = [];
  const runner = (step) => {
    calls.push(step);
    const r = script[step.name] ?? {};
    return { status: r.status ?? 0, stdout: r.stdout ?? '', stderr: r.stderr ?? '' };
  };
  runner.calls = calls;
  return runner;
}

function makeDeps({ script = {}, files = {} } = {}) {
  const runner = fakeRunner(script);
  const written = {};
  return {
    runner,
    written,
    tmpdir: 'tmp',
    log: () => {},
    errlog: () => {},
    readText: async (p0) => {
      const p = String(p0).replaceAll('\\', '/');
      if (p in files) return files[p];
      throw new Error(`ENOENT ${p}`);
    },
    writeText: async (p, t) => {
      written[p] = t;
    },
    removeFile: async () => {},
  };
}

const COMMITTED_REMAP = JSON.stringify({
  remaps: [{ source_user_id: ZERO_A, target_user_id: ZERO_B }],
});

const argvApplyPortfolio = (extra = []) => [
  '--source-ref', ZIKO, '--project-ref', PORTFOLIO, '--confirm-ref', PORTFOLIO,
  '--mode', 'apply', '--remap-file', 'remap.json', '--ca-file', 'ca.pem',
  '--auth-baseline', 'a.json', '--data-baseline', 'd.json', '--storage-baseline', 's.json',
  '--report-dir', 'reports', '--report-prefix', 'portfolio-cutover',
  '--authorization-file', 'auth.md',
  ...extra,
];

test('D1: plan mode builds only read-only steps', () => {
  const steps = buildSteps({ ...baseOpts, mode: 'plan', confirmRef: null });
  assert.deepEqual(steps.map((s) => s.name), ['collision', 'delta-report', 'load-plan', 'copy-plan']);
  for (const s of steps) {
    for (const bad of ['--apply', '--probe', '--confirm-ref']) {
      assert.ok(!s.argv.includes(bad), `${s.name} must not contain ${bad}`);
    }
  }
});

test('D2: apply mode builds the exact ordered step list with the right flags', () => {
  const steps = buildSteps(baseOpts);
  assert.deepEqual(steps.map((s) => s.name), [
    'collision', 'delta-report', 'import', 'waitlist', 'auth-verify',
    'load-probe', 'load-apply', 'copy-apply', 'verify-data', 'verify-storage',
  ]);
  const by = Object.fromEntries(steps.map((s) => [s.name, s.argv]));
  assert.ok(by.import.includes('--apply') && by.import.includes('--confirm-ref') && by.import.includes('--remap-out'));
  assert.ok(by.waitlist.includes('--confirm-ref'));
  assert.ok(by['auth-verify'].includes('--check') && by['auth-verify'].includes('all'));
  assert.ok(by['load-probe'].includes('--probe'));
  assert.ok(by['load-apply'].includes('--apply') && by['load-apply'].includes('--report-out'));
  assert.ok(by['copy-apply'].includes('--apply') && by['copy-apply'].includes('--report-out'));
  for (const n of ['verify-data', 'verify-storage']) {
    assert.ok(by[n].includes('--check') && by[n].includes('all'));
    assert.ok(by[n].includes('--baseline') && by[n].includes('--json-out'));
  }
});

test('D3: checkAuthorization requires the exact line', () => {
  assert.equal(checkAuthorization(`x\nTyped authorization: ${PHRASE}\ny`, PHRASE), true);
  assert.equal(checkAuthorization(`Typed authorization: ${PHRASE}\r\n`, PHRASE), true);
  assert.equal(checkAuthorization(`Typed authorization: ${PHRASE} extra`, PHRASE), false);
  assert.equal(checkAuthorization(`prefix Typed authorization: ${PHRASE}`, PHRASE), false);
  assert.equal(checkAuthorization(` Typed authorization: ${PHRASE}`, PHRASE), false);
  assert.equal(checkAuthorization('Typed authorization: none (option-abort)', PHRASE), false);
});

test('D4: apply on portfolio without a valid authorization runs no child', async () => {
  const noFile = makeDeps();
  const argvNoFile = argvApplyPortfolio().filter((_, i, a) => a[i] !== '--authorization-file' && a[i - 1] !== '--authorization-file');
  assert.equal(await run(argvNoFile, noFile), 1);
  assert.equal(noFile.runner.calls.length, 0);

  const bad = makeDeps({ files: { 'auth.md': 'Typed authorization: none (option-abort)\n' } });
  assert.equal(await run(argvApplyPortfolio(), bad), 1);
  assert.equal(bad.runner.calls.length, 0);
});

test('D5: ziko target and mismatched confirm-ref are refused before any child', async () => {
  for (const mode of ['plan', 'apply']) {
    const d = makeDeps({ files: { 'auth.md': `Typed authorization: ${PHRASE}\n` } });
    const argv = ['--source-ref', ZIKO, '--project-ref', ZIKO, '--confirm-ref', ZIKO, '--mode', mode, '--remap-file', 'r.json'];
    assert.equal(await run(argv, d), 1);
    assert.equal(d.runner.calls.length, 0);
  }
  const d2 = makeDeps({ files: { 'auth.md': `Typed authorization: ${PHRASE}\n` } });
  const argv2 = argvApplyPortfolio().map((v, i, a) => (a[i - 1] === '--confirm-ref' ? SCRATCH : v));
  assert.equal(await run(argv2, d2), 1);
  assert.equal(d2.runner.calls.length, 0);
});

test('D6: apply against scratch needs confirm-ref but no authorization file', async () => {
  const argv = [
    '--source-ref', ZIKO, '--project-ref', SCRATCH, '--mode', 'apply', '--remap-file', 'remap.json',
    '--ca-file', 'ca.pem', '--auth-baseline', 'a.json', '--data-baseline', 'd.json', '--storage-baseline', 's.json',
    '--report-dir', 'reports', '--report-prefix', 'scratch-cutover',
  ];
  const noConfirm = makeDeps({ files: { 'remap.json': COMMITTED_REMAP } });
  assert.equal(await run(argv, noConfirm), 1);
  assert.equal(noConfirm.runner.calls.length, 0);

  const ok = makeDeps({
    script: { 'delta-report': { stdout: DELTA_CLEAN } },
    files: { 'remap.json': COMMITTED_REMAP, 'tmp/uuid-remap.delta.json': JSON.stringify({ remaps: [] }) },
  });
  assert.equal(await run([...argv, '--confirm-ref', SCRATCH], ok), 0);
  assert.equal(ok.runner.calls.length, 10);
});

test('D7: runSteps stops at the first non-zero child exit', async () => {
  const steps = buildSteps(baseOpts);
  const runner = fakeRunner({ waitlist: { status: 3 } });
  const res = await runSteps(steps, runner);
  assert.equal(res.ok, false);
  assert.equal(res.failedStep, 'waitlist');
  assert.equal(res.exitCode, 3);
  assert.deepEqual(runner.calls.map((c) => c.name), ['collision', 'delta-report', 'import', 'waitlist']);
});

test('D8: parseDeltaReport and the password review gate', async () => {
  assert.deepEqual(parseDeltaReport(DELTA_PW), { newUsers: 0, passwordChanged: 2, otherChanged: 0 });
  assert.equal(parseDeltaReport(DELTA_CLEAN).otherChanged, 1);

  const files = {
    'auth.md': `Typed authorization: ${PHRASE}\n`,
    'remap.json': COMMITTED_REMAP,
    'tmp/uuid-remap.delta.json': COMMITTED_REMAP,
  };
  const stopped = makeDeps({ script: { 'delta-report': { stdout: DELTA_PW } }, files });
  assert.equal(await run(argvApplyPortfolio(), stopped), 5);
  assert.deepEqual(stopped.runner.calls.map((c) => c.name), ['collision', 'delta-report']);

  const wrongCount = makeDeps({ script: { 'delta-report': { stdout: DELTA_PW } }, files });
  assert.equal(await run(argvApplyPortfolio(['--apply-password-updates', '--reviewed-password-count', '1']), wrongCount), 5);
  assert.equal(wrongCount.runner.calls.length, 2);

  const approved = makeDeps({ script: { 'delta-report': { stdout: DELTA_PW } }, files });
  assert.equal(await run(argvApplyPortfolio(['--apply-password-updates', '--reviewed-password-count', '2']), approved), 0);
  const imp = approved.runner.calls.find((c) => c.name === 'import');
  assert.ok(imp.argv.includes('--apply-password-updates'));
});

test('D9: a new non-identity delta remap mapping stops before load (exit 4)', async () => {
  const delta = JSON.stringify({
    remaps: [
      { source_user_id: ZERO_A, target_user_id: ZERO_B },
      { source_user_id: ZERO_C, target_user_id: ZERO_A },
      { source_user_id: ZERO_B, target_user_id: ZERO_B },
    ],
  });
  const d = makeDeps({
    script: { 'delta-report': { stdout: DELTA_CLEAN } },
    files: { 'auth.md': `Typed authorization: ${PHRASE}\n`, 'remap.json': COMMITTED_REMAP, 'tmp/uuid-remap.delta.json': delta },
  });
  assert.equal(await run(argvApplyPortfolio(), d), 4);
  const names = d.runner.calls.map((c) => c.name);
  assert.ok(!names.includes('load-probe'));
  assert.ok(!names.includes('load-apply'));
});

test('D10: the written report contains no email, UUID or JWT', async () => {
  const jwt = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ4In0.c2lnbmF0dXJl';
  const noisy = `ok=1 rows=42\nuser someone@example.com id=${ZERO_A} ${jwt}\nid=${ZERO_A}\n`;
  const d = makeDeps({
    script: {
      collision: { stdout: noisy },
      'delta-report': { stdout: DELTA_CLEAN + noisy },
      'load-apply': { stdout: noisy, stderr: noisy },
    },
    files: { 'auth.md': `Typed authorization: ${PHRASE}\n`, 'remap.json': COMMITTED_REMAP, 'tmp/uuid-remap.delta.json': COMMITTED_REMAP },
  });
  assert.equal(await run(argvApplyPortfolio(), d), 0);
  const all = Object.values(d.written).join('\n');
  assert.ok(all.length > 0, 'a summary report is written');
  assert.ok(!all.includes('@'));
  assert.ok(!/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i.test(all));
  assert.ok(!all.includes('eyJ'));
  assert.ok(/"rows": 42/.test(all));
});
