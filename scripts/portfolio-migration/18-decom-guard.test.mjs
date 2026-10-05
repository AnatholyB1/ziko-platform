import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { PROJECTS } from '../auth-merge/lib.mjs';
import {
  DECOM_REFS,
  EXPECTED_NAMES,
  GATE_KEYS,
  REQUIRED_GATES,
  GATES_PATH,
  AUTH_LOG_PATH,
  emptyGates,
  readGates,
  recordGate,
  verifyGates,
  assertZikoFreezeAllowed,
  assertScratchWriteAllowed,
  assertDeleteAllowed,
  checkConfirmation,
  checkAuthBlock,
  assertCommittedSafe,
  assertOutsideRepo,
  run,
} from './18-decom-guard.mjs';

// Literals are allowed in tests; they must equal PROJECTS so a future edit breaks loudly.
const ZIKO = 'slkobhavpwsubnsmuhya';
const PORTFOLIO = 'ubxllsvanurkwkohzxau';
const SCRATCH = 'rkirvurggtgjlkeuhded';
test('ref literals match PROJECTS', () => {
  assert.equal(PROJECTS.ziko, ZIKO);
  assert.equal(PROJECTS.portfolio, PORTFOLIO);
  assert.equal(PROJECTS.scratch, SCRATCH);
  assert.deepEqual({ ...DECOM_REFS }, { ziko: ZIKO, portfolio: PORTFOLIO, scratch: SCRATCH });
  assert.equal(EXPECTED_NAMES.ziko, 'ziko');
  assert.equal(EXPECTED_NAMES.scratch, 'ziko-migration-scratch');
});

test('contract constants', () => {
  assert.equal(GATE_KEYS.length, 10);
  assert.deepEqual(REQUIRED_GATES.ziko, GATE_KEYS);
  assert.deepEqual(REQUIRED_GATES.scratch, ['restore_proven', 'ci_off_scratch']);
  assert.match(GATES_PATH.replaceAll('\\', '/'), /scripts\/portfolio-migration\/baseline\/decom-gates\.json$/);
  assert.match(AUTH_LOG_PATH.replaceAll('\\', '/'), /07-monitoring-decommission\/07-AUTHORIZATIONS\.md$/);
});

// ------------------------------------------------------------ guards
test('assertDeleteAllowed passes for ziko with matching refs', () => {
  assert.doesNotThrow(() => assertDeleteAllowed({ project: 'ziko', ref: ZIKO, confirmRef: ZIKO }));
});
test('assertDeleteAllowed refuses portfolio ref under project ziko', () => {
  assert.throws(() => assertDeleteAllowed({ project: 'ziko', ref: PORTFOLIO, confirmRef: PORTFOLIO }));
});
test('assertDeleteAllowed refuses scratch ref under project ziko', () => {
  assert.throws(() => assertDeleteAllowed({ project: 'ziko', ref: SCRATCH, confirmRef: SCRATCH }));
});
test('assertDeleteAllowed refuses malformed ref', () => {
  assert.throws(() => assertDeleteAllowed({ project: 'ziko', ref: 'nope', confirmRef: 'nope' }));
  assert.throws(() => assertDeleteAllowed({ project: 'ziko', ref: undefined, confirmRef: undefined }));
});
test('assertDeleteAllowed refuses confirmRef mismatch', () => {
  assert.throws(() => assertDeleteAllowed({ project: 'ziko', ref: ZIKO, confirmRef: PORTFOLIO }));
  assert.throws(() => assertDeleteAllowed({ project: 'ziko', ref: ZIKO }));
});
test('assertDeleteAllowed refuses project portfolio by name', () => {
  assert.throws(
    () => assertDeleteAllowed({ project: 'portfolio', ref: PORTFOLIO, confirmRef: PORTFOLIO }),
    /portfolio/,
  );
  assert.throws(() => assertDeleteAllowed({ project: 'portfolio', ref: ZIKO, confirmRef: ZIKO }));
});
test('assertDeleteAllowed scratch project only with scratch ref', () => {
  assert.doesNotThrow(() => assertDeleteAllowed({ project: 'scratch', ref: SCRATCH, confirmRef: SCRATCH }));
  assert.throws(() => assertDeleteAllowed({ project: 'scratch', ref: ZIKO, confirmRef: ZIKO }));
  assert.throws(() => assertDeleteAllowed({ project: 'scratch', ref: PORTFOLIO, confirmRef: PORTFOLIO }));
  assert.throws(() => assertDeleteAllowed({ project: 'other', ref: SCRATCH, confirmRef: SCRATCH }));
});

test('assertZikoFreezeAllowed accepts ziko and scratch only', () => {
  assert.doesNotThrow(() => assertZikoFreezeAllowed({ target: 'ziko', confirmRef: ZIKO }));
  assert.doesNotThrow(() => assertZikoFreezeAllowed({ target: 'scratch', confirmRef: SCRATCH }));
  assert.throws(() => assertZikoFreezeAllowed({ target: 'portfolio', confirmRef: PORTFOLIO }));
  assert.throws(() => assertZikoFreezeAllowed({ target: 'ziko', confirmRef: SCRATCH }));
  assert.throws(() => assertZikoFreezeAllowed({ target: 'ziko', confirmRef: PORTFOLIO }));
  assert.throws(() => assertZikoFreezeAllowed({ target: 'scratch', confirmRef: ZIKO }));
  assert.throws(() => assertZikoFreezeAllowed({ target: 'ziko' }));
});

test('assertScratchWriteAllowed accepts only scratch with matching confirm', () => {
  assert.doesNotThrow(() => assertScratchWriteAllowed({ ref: SCRATCH, confirmRef: SCRATCH }));
  assert.throws(() => assertScratchWriteAllowed({ ref: ZIKO, confirmRef: ZIKO }));
  assert.throws(() => assertScratchWriteAllowed({ ref: PORTFOLIO, confirmRef: PORTFOLIO }));
  assert.throws(() => assertScratchWriteAllowed({ ref: SCRATCH, confirmRef: ZIKO }));
  assert.throws(() => assertScratchWriteAllowed({ ref: SCRATCH }));
});

// ------------------------------------------------------------ authorization checkers
const HEAD = '07-17 D-15 confirmation';
const CONF = `Confirmation: yes (delete ziko ${ZIKO})`;
const TS = 'Timestamp: 2026-10-04T10:00:00Z';
const block = (reply, extra = [], conf = CONF, head = HEAD) =>
  ['# Log', '', `### ${head}`, conf, TS, `Reply: "${reply}"`, ...extra, ''].join('\n');

test('checkConfirmation accepts plain yes variants', () => {
  assert.equal(checkConfirmation(block('yes'), HEAD), true);
  assert.equal(checkConfirmation(block('Yes'), HEAD), true);
  assert.equal(checkConfirmation(block('  yes. '), HEAD), true);
  assert.equal(checkConfirmation(block('YES!'), HEAD), true);
  assert.equal(checkConfirmation(block('yes').replaceAll('\n', '\r\n'), HEAD), true);
});
test('checkConfirmation refuses non-plain replies', () => {
  assert.equal(checkConfirmation(block('yes but wait'), HEAD), false);
  assert.equal(checkConfirmation(block('y'), HEAD), false);
  assert.equal(checkConfirmation(block('ok'), HEAD), false);
  assert.equal(checkConfirmation(block('yes!!'), HEAD), false);
  assert.equal(checkConfirmation(block(''), HEAD), false);
});
test('checkConfirmation refuses structural defects', () => {
  assert.equal(checkConfirmation('# Log\n', HEAD), false);
  assert.equal(checkConfirmation(block('yes') + block('yes'), HEAD), false);
  assert.equal(checkConfirmation(block('yes', [], ` ${CONF}`), HEAD), false);
  assert.equal(checkConfirmation(block('yes', [], `Phrase: ${CONF}`), HEAD), false);
  assert.equal(checkConfirmation(block('yes', ['Confirmation: none (abort)']), HEAD), false);
  assert.equal(checkConfirmation(block('yes', [], `Confirmation: yes (delete ziko ${PORTFOLIO})`), HEAD), false);
  assert.equal(checkConfirmation(block('yes', [], CONF, 'other heading'), HEAD), false);
  assert.equal(checkConfirmation(null, HEAD), false);
});
test('checkConfirmation requires a Timestamp line and a Reply line', () => {
  const noTs = ['### ' + HEAD, CONF, 'Reply: "yes"'].join('\n');
  const noReply = ['### ' + HEAD, CONF, TS].join('\n');
  const badTs = ['### ' + HEAD, CONF, 'Timestamp: yesterday', 'Reply: "yes"'].join('\n');
  assert.equal(checkConfirmation(noTs, HEAD), false);
  assert.equal(checkConfirmation(noReply, HEAD), false);
  assert.equal(checkConfirmation(badTs, HEAD), false);
});
test('checkConfirmation block ends at the next heading', () => {
  const t = ['### ' + HEAD, TS, 'Reply: "yes"', '### next', CONF].join('\n');
  assert.equal(checkConfirmation(t, HEAD), false);
});

const REQ = 'Second copy: verified';
const abBlock = (lines) => ['### 07-09 second copy', ...lines, ''].join('\n');
test('checkAuthBlock requires exact line, timestamp and reply', () => {
  const ok = abBlock([REQ, TS, 'Reply: "verified"']);
  assert.equal(checkAuthBlock(ok, '07-09 second copy', REQ), true);
  assert.equal(checkAuthBlock(ok.replaceAll('\n', '\r\n'), '07-09 second copy', REQ), true);
  assert.equal(checkAuthBlock(abBlock([` ${REQ}`, TS, 'Reply: "v"']), '07-09 second copy', REQ), false);
  assert.equal(checkAuthBlock(abBlock([`Phrase: ${REQ}`, TS, 'Reply: "v"']), '07-09 second copy', REQ), false);
  assert.equal(checkAuthBlock(abBlock([REQ, 'Reply: "v"']), '07-09 second copy', REQ), false);
  assert.equal(checkAuthBlock(abBlock([REQ, TS]), '07-09 second copy', REQ), false);
  assert.equal(checkAuthBlock(ok, 'missing heading', REQ), false);
  assert.equal(checkAuthBlock(ok, '07-09 second copy', 'Other: line'), false);
});

// ------------------------------------------------------------ committed safety
test('assertCommittedSafe throws on sensitive content', () => {
  assert.throws(() => assertCommittedSafe('contact a.b@example.invalid'));
  assert.throws(() => assertCommittedSafe({ id: '00000000-0000-0000-0000-00000000000a' }));
  assert.throws(() => assertCommittedSafe('tok eyJhbGciOiJIUzI1NiJ9'));
  assert.throws(() => assertCommittedSafe('sbp_0123456789abcdef'));
  assert.throws(() => assertCommittedSafe('x sb_secret_abc'));
});
test('assertCommittedSafe passes on safe content', () => {
  assert.doesNotThrow(() => assertCommittedSafe({ md5: 'd41d8cd98f00b204e9800998ecf8427e', fp: 'a1b2c3d4' }));
  assert.doesNotThrow(() => assertCommittedSafe('masked 00000000-…'));
  assert.doesNotThrow(() => assertCommittedSafe('eyJshort'));
});

test('assertOutsideRepo', () => {
  assert.throws(() => assertOutsideRepo('C:\\ziko-platform', 'C:\\ziko-platform'));
  assert.throws(() => assertOutsideRepo('C:\\ziko-platform\\out\\x', 'C:\\ziko-platform'));
  assert.throws(() => assertOutsideRepo('c:/ZIKO-platform/out', 'C:\\ziko-platform'));
  assert.throws(() => assertOutsideRepo('C:/ziko-platform/a/../b', 'C:\\ziko-platform\\'));
  assert.doesNotThrow(() => assertOutsideRepo('C:\\ziko-backups\\x', 'C:\\ziko-platform'));
  assert.doesNotThrow(() => assertOutsideRepo('C:\\ziko-platform-other\\x', 'C:\\ziko-platform'));
});

// ------------------------------------------------------------ gates
const ROOT = resolve('fake-repo-root');
const abs = (p) => resolve(ROOT, p);
const sha = (s) => createHash('sha256').update(s).digest('hex');

function makeDeps(files = {}) {
  const store = new Map(Object.entries(files).map(([k, v]) => [resolve(k), v]));
  const written = {};
  const logs = [];
  const errs = [];
  return {
    repoRoot: ROOT,
    now: () => '2026-10-04T10:00:00.000Z',
    readText: (p) => {
      const k = resolve(p);
      if (!store.has(k)) throw new Error(`ENOENT ${p}`);
      return String(store.get(k));
    },
    readBytes: (p) => {
      const k = resolve(p);
      if (!store.has(k)) throw new Error(`ENOENT ${p}`);
      return Buffer.from(store.get(k));
    },
    writeText: (p, t) => {
      store.set(resolve(p), t);
      written[resolve(p)] = t;
    },
    fileExists: (p) => store.has(resolve(p)),
    log: (m) => logs.push(m),
    errlog: (m) => errs.push(m),
    store,
    written,
    logs,
    errs,
  };
}

test('emptyGates has 10 false keys', () => {
  const g = emptyGates();
  assert.deepEqual(Object.keys(g), GATE_KEYS);
  for (const k of GATE_KEYS) {
    assert.deepEqual(g[k], { passed: false, at: null, evidence: null, sha256: null, auth_block: null, required_line: null });
  }
});

test('readGates throws on missing file, unknown key or missing key', () => {
  assert.throws(() => readGates(makeDeps()));
  const extra = { ...emptyGates(), bogus: {} };
  assert.throws(() => readGates(makeDeps({ [GATES_PATH]: JSON.stringify(extra) })));
  const g = emptyGates();
  delete g.verify_pass;
  assert.throws(() => readGates(makeDeps({ [GATES_PATH]: JSON.stringify(g) })));
  assert.deepEqual(readGates(makeDeps({ [GATES_PATH]: JSON.stringify(emptyGates()) })), emptyGates());
});

test('recordGate refuses unknown key and missing evidence', () => {
  const deps = makeDeps({ [GATES_PATH]: JSON.stringify(emptyGates()) });
  assert.throws(() => recordGate('bogus', { evidence: 'a.json' }, deps));
  assert.throws(() => recordGate('freeze_proven', { evidence: 'reports/none.json' }, deps));
  assert.throws(() => recordGate('freeze_proven', {}, deps));
  assert.throws(() => recordGate('freeze_proven', { evidence: abs('x.json') }, deps), /relative/);
  assert.equal(JSON.stringify(readGates(deps)), JSON.stringify(emptyGates()));
});

test('recordGate refuses unsafe evidence', () => {
  const deps = makeDeps({
    [GATES_PATH]: JSON.stringify(emptyGates()),
    [abs('reports/bad.json')]: '{"e":"a.b@example.invalid"}',
  });
  assert.throws(() => recordGate('freeze_proven', { evidence: 'reports/bad.json' }, deps));
});

test('recordGate with evidence records sha256 and writes safe JSON', () => {
  const content = '{"ok":true}';
  const deps = makeDeps({
    [GATES_PATH]: JSON.stringify(emptyGates()),
    [abs('reports/f.json')]: content,
  });
  const g = recordGate('freeze_proven', { evidence: 'reports/f.json' }, deps);
  assert.equal(g.freeze_proven.passed, true);
  assert.equal(g.freeze_proven.sha256, sha(content));
  assert.equal(g.freeze_proven.evidence, 'reports/f.json');
  assert.equal(g.freeze_proven.at, '2026-10-04T10:00:00.000Z');
  const onDisk = deps.written[resolve(GATES_PATH)];
  assert.ok(onDisk.endsWith('\n'));
  assert.equal(JSON.parse(onDisk).freeze_proven.passed, true);
});

test('recordGate with auth block needs a valid block', () => {
  const log = abBlock([REQ, TS, 'Reply: "verified"']);
  const deps = makeDeps({ [GATES_PATH]: JSON.stringify(emptyGates()), [AUTH_LOG_PATH]: log });
  assert.throws(() => recordGate('backup_second_copy', { authBlock: '07-09 second copy', requiredLine: 'Wrong: line' }, deps));
  assert.throws(() => recordGate('backup_second_copy', { authBlock: '07-09 second copy' }, deps));
  const g = recordGate('backup_second_copy', { authBlock: '07-09 second copy', requiredLine: REQ }, deps);
  assert.equal(g.backup_second_copy.passed, true);
  assert.equal(g.backup_second_copy.auth_block, '07-09 second copy');
  assert.equal(g.backup_second_copy.required_line, REQ);
  assert.equal(g.backup_second_copy.sha256, null);
});

test('recordGate confirmation_yes only via checkConfirmation', () => {
  const evidenceOnly = makeDeps({
    [GATES_PATH]: JSON.stringify(emptyGates()),
    [abs('reports/f.json')]: '{}',
    [AUTH_LOG_PATH]: block('yes'),
  });
  assert.throws(() => recordGate('confirmation_yes', { evidence: 'reports/f.json' }, evidenceOnly));
  const weak = makeDeps({ [GATES_PATH]: JSON.stringify(emptyGates()), [AUTH_LOG_PATH]: block('y') });
  assert.throws(() => recordGate('confirmation_yes', { authBlock: HEAD }, weak));
  const good = makeDeps({ [GATES_PATH]: JSON.stringify(emptyGates()), [AUTH_LOG_PATH]: block('yes') });
  const g = recordGate('confirmation_yes', { authBlock: HEAD }, good);
  assert.equal(g.confirmation_yes.passed, true);
  assert.equal(g.confirmation_yes.required_line, CONF);
});

test('verifyGates: all false reports missing', () => {
  const r = verifyGates(emptyGates(), { required: REQUIRED_GATES.ziko, ...makeDeps() });
  assert.equal(r.ok, false);
  assert.deepEqual(r.missing, GATE_KEYS);
  assert.deepEqual(r.mismatched, []);
});

test('verifyGates: scratch subset, evidence tampering, auth re-check', () => {
  const content = '{"ok":true}';
  const deps = makeDeps({
    [GATES_PATH]: JSON.stringify(emptyGates()),
    [abs('reports/r.json')]: content,
    [abs('reports/c.json')]: content,
    [AUTH_LOG_PATH]: abBlock([REQ, TS, 'Reply: "verified"']),
  });
  recordGate('restore_proven', { evidence: 'reports/r.json' }, deps);
  recordGate('ci_off_scratch', { evidence: 'reports/c.json' }, deps);
  let gates = readGates(deps);
  assert.equal(verifyGates(gates, { required: REQUIRED_GATES.scratch, ...deps }).ok, true);
  assert.equal(verifyGates(gates, { required: REQUIRED_GATES.ziko, ...deps }).ok, false);

  deps.store.set(abs('reports/r.json'), '{"ok":false}');
  const r = verifyGates(gates, { required: REQUIRED_GATES.scratch, ...deps });
  assert.equal(r.ok, false);
  assert.deepEqual(r.mismatched, ['restore_proven']);

  deps.store.delete(abs('reports/r.json'));
  assert.deepEqual(verifyGates(gates, { required: ['restore_proven'], ...deps }).mismatched, ['restore_proven']);

  recordGate('backup_second_copy', { authBlock: '07-09 second copy', requiredLine: REQ }, deps);
  gates = readGates(deps);
  assert.equal(verifyGates(gates, { required: ['backup_second_copy'], ...deps }).ok, true);
  deps.store.set(resolve(AUTH_LOG_PATH), abBlock([TS, 'Reply: "x"']));
  assert.deepEqual(verifyGates(gates, { required: ['backup_second_copy'], ...deps }).mismatched, ['backup_second_copy']);
});

test('verifyGates: confirmation_yes re-checked against the log', () => {
  const deps = makeDeps({ [GATES_PATH]: JSON.stringify(emptyGates()), [AUTH_LOG_PATH]: block('yes') });
  recordGate('confirmation_yes', { authBlock: HEAD }, deps);
  const gates = readGates(deps);
  assert.equal(verifyGates(gates, { required: ['confirmation_yes'], ...deps }).ok, true);
  deps.store.set(resolve(AUTH_LOG_PATH), block('yes', ['Confirmation: none (abort)']));
  assert.equal(verifyGates(gates, { required: ['confirmation_yes'], ...deps }).ok, false);
});

// ------------------------------------------------------------ CLI
test('CLI --init writes empty gates and refuses overwrite', async () => {
  const deps = makeDeps();
  assert.equal(await run(['--init'], deps), 0);
  assert.deepEqual(JSON.parse(deps.written[resolve(GATES_PATH)]), emptyGates());
  assert.equal(await run(['--init'], deps), 1);
});

test('CLI --status exits 0, --require ziko exits 1 on empty gates', async () => {
  const deps = makeDeps({ [GATES_PATH]: JSON.stringify(emptyGates()) });
  assert.equal(await run(['--status'], deps), 0);
  assert.equal(deps.logs.length, 10);
  assert.ok(deps.logs[0].startsWith('freeze_proven: ----'));
  assert.equal(await run(['--status', '--require', 'ziko'], deps), 1);
  assert.equal(await run(['--status', '--require', 'scratch'], deps), 1);
  assert.equal(await run(['--status', '--require', 'portfolio'], deps), 2);
});

test('CLI --status --except excludes a key', async () => {
  const deps = makeDeps({ [GATES_PATH]: JSON.stringify(emptyGates()) });
  assert.equal(await run(['--status', '--require', 'scratch', '--except', 'restore_proven'], deps), 1);
  const g = emptyGates();
  for (const k of GATE_KEYS) {
    g[k] = { passed: true, at: 'x', evidence: null, sha256: null, auth_block: null, required_line: null };
  }
  g.confirmation_yes = emptyGates().confirmation_yes;
  // all passed flags true but without evidence or auth: still refused
  const deps2 = makeDeps({ [GATES_PATH]: JSON.stringify(g) });
  assert.equal(await run(['--status', '--require', 'ziko', '--except', 'confirmation_yes'], deps2), 1);
});

test('CLI --record-gate refuses missing evidence and unknown key', async () => {
  const deps = makeDeps({ [GATES_PATH]: JSON.stringify(emptyGates()) });
  assert.equal(await run(['--record-gate', 'freeze_proven', '--evidence', 'reports/none.json'], deps), 1);
  assert.equal(await run(['--record-gate', 'bogus', '--evidence', 'reports/none.json'], deps), 1);
  assert.equal(Object.keys(deps.written).length, 0);
});

test('CLI --record-gate records with evidence', async () => {
  const deps = makeDeps({ [GATES_PATH]: JSON.stringify(emptyGates()), [abs('reports/f.json')]: '{}' });
  assert.equal(await run(['--record-gate', 'freeze_proven', '--evidence', 'reports/f.json'], deps), 0);
  assert.equal(JSON.parse(deps.written[resolve(GATES_PATH)]).freeze_proven.passed, true);
});

test('CLI bad args exit 2, help exits 0', async () => {
  const deps = makeDeps();
  assert.equal(await run(['--bogus'], deps), 2);
  assert.equal(await run([], deps), 2);
  assert.equal(await run(['--help'], deps), 0);
});

// ------------------------------------------------------------ ci_token_revoked waiver (07-15)
const WAIVER_HEAD = '07-15 ci token waiver';
const WAIVER_LINE = 'Waiver: ci_token_revoked (token ziko-ci-portfolio NOT revoked; user decision)';
const waiverLog = (line = WAIVER_LINE, head = WAIVER_HEAD, extra = ['Reply: "I will not revoke it"']) =>
  ['# Log', '', `### ${head}`, line, TS, ...extra, ''].join('\n');

test('waiver: recorded as waived (not true) when the block exists, and verifies', () => {
  const deps = makeDeps({ [GATES_PATH]: JSON.stringify(emptyGates()), [AUTH_LOG_PATH]: waiverLog() });
  const g = recordGate('ci_token_revoked', { waiver: true }, deps);
  assert.equal(g.ci_token_revoked.passed, 'waived');
  assert.notEqual(g.ci_token_revoked.passed, true);
  assert.equal(g.ci_token_revoked.auth_block, WAIVER_HEAD);
  assert.equal(g.ci_token_revoked.required_line, WAIVER_LINE);
  const gates = readGates(deps);
  assert.equal(verifyGates(gates, { required: ['ci_token_revoked'], ...deps }).ok, true);
  // block removed afterwards: no longer satisfied
  deps.store.set(resolve(AUTH_LOG_PATH), '# Log\n');
  const r = verifyGates(gates, { required: ['ci_token_revoked'], ...deps });
  assert.equal(r.ok, false);
  assert.deepEqual(r.mismatched, ['ci_token_revoked']);
});

test('waiver: refused without the block (missing, wrong line, wrong heading, no reply)', () => {
  const cases = [
    '# Log\n',
    waiverLog('Waiver: ci_token_revoked'),
    waiverLog(WAIVER_LINE, 'other heading'),
    waiverLog(WAIVER_LINE, WAIVER_HEAD, []),
  ];
  for (const log of cases) {
    const deps = makeDeps({ [GATES_PATH]: JSON.stringify(emptyGates()), [AUTH_LOG_PATH]: log });
    assert.throws(() => recordGate('ci_token_revoked', { waiver: true }, deps));
    assert.equal(Object.keys(deps.written).length, 0);
  }
});

test('waiver: refused for every other gate, also when hand-written into the gate file', () => {
  for (const key of GATE_KEYS.filter((k) => k !== 'ci_token_revoked')) {
    const deps = makeDeps({ [GATES_PATH]: JSON.stringify(emptyGates()), [AUTH_LOG_PATH]: waiverLog() });
    assert.throws(() => recordGate(key, { waiver: true }, deps), /only ci_token_revoked/);
    const g = emptyGates();
    g[key] = { passed: 'waived', at: 'x', evidence: null, sha256: null, auth_block: WAIVER_HEAD, required_line: WAIVER_LINE };
    const v = verifyGates(g, { required: [key], ...deps });
    assert.equal(v.ok, false, key);
  }
});

test('waiver: other gate values (strings, truthy) never count as passed', () => {
  const deps = makeDeps({ [AUTH_LOG_PATH]: waiverLog() });
  for (const passed of ['true', 'waived', 1, 'yes']) {
    const g = emptyGates();
    g.verify_pass = { passed, at: 'x', evidence: null, sha256: null, auth_block: WAIVER_HEAD, required_line: WAIVER_LINE };
    g.ci_token_revoked = { passed, at: 'x', evidence: null, sha256: null, auth_block: WAIVER_HEAD, required_line: WAIVER_LINE };
    assert.equal(verifyGates(g, { required: ['verify_pass'], ...deps }).ok, false);
    if (passed !== 'waived') assert.equal(verifyGates(g, { required: ['ci_token_revoked'], ...deps }).ok, false);
  }
});

test('waiver: CLI --record-waiver and --status prints WAIVED, distinct from PASS', async () => {
  const deps = makeDeps({ [GATES_PATH]: JSON.stringify(emptyGates()), [AUTH_LOG_PATH]: waiverLog() });
  assert.equal(await run(['--record-waiver', 'ci_token_revoked'], deps), 0);
  assert.equal(JSON.parse(deps.written[resolve(GATES_PATH)]).ci_token_revoked.passed, 'waived');
  assert.equal(await run(['--status'], deps), 0);
  const line = deps.logs.find((l) => l.startsWith('ci_token_revoked:'));
  assert.match(line, /^ci_token_revoked: WAIVED/);
  assert.doesNotMatch(line, /PASS/);
  const bad = makeDeps({ [GATES_PATH]: JSON.stringify(emptyGates()), [AUTH_LOG_PATH]: waiverLog() });
  assert.equal(await run(['--record-waiver', 'verify_pass'], bad), 1);
  assert.equal(Object.keys(bad.written).length, 0);
  const noBlock = makeDeps({ [GATES_PATH]: JSON.stringify(emptyGates()), [AUTH_LOG_PATH]: '# Log\n' });
  assert.equal(await run(['--record-waiver', 'ci_token_revoked'], noBlock), 1);
});
