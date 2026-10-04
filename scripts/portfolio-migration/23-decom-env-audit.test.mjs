// Offline tests for 23-decom-env-audit.mjs (07-06). No network, no Vercel/EAS/GitHub calls.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  classifyValue,
  parseDotenv,
  parseVercelEnvLs,
  scanCiWorkflow,
  buildRemediationPlan,
  buildRemediationCommands,
  buildAuditReport,
} from './23-decom-env-audit.mjs';
import { fingerprint } from './17-env-switch.mjs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { run } from './23-decom-env-audit.mjs';
import { PROJECTS } from '../auth-merge/lib.mjs';

const ZIKO = 'zzzzzzzzzzzzzzzzzzzz';
const SCRATCH = 'sssssssssssssssssss1';
const PORTFOLIO = 'pppppppppppppppppppp';
const ZIKO_KEY = 'fake-ziko-publishable-key-value';
const SCRATCH_KEY = 'fake-scratch-publishable-key-value';
const ctx = {
  zikoRef: ZIKO,
  scratchRef: SCRATCH,
  zikoFingerprints: [fingerprint(ZIKO_KEY)],
  scratchFingerprints: [fingerprint(SCRATCH_KEY)],
};
const b64u = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const jwt = (payload) => `${b64u({ alg: 'HS256', typ: 'JWT' })}.${b64u(payload)}.fakesig`;

const AUTH_OK = [
  '### 07-14 env remediation',
  'Approved: env-remediation',
  'Timestamp: 2026-10-04T10:00:00Z',
  'Reply: "go"',
  '',
].join('\n');

test('C1 classifyValue: ref substring, fingerprint, JWT ref claim, scratch, clean, unknown', () => {
  assert.equal(classifyValue(`https://${ZIKO}.supabase.co`, ctx), 'points_at_ziko');
  assert.equal(classifyValue(ZIKO_KEY, ctx), 'points_at_ziko');
  assert.equal(classifyValue(jwt({ ref: ZIKO, role: 'anon' }), ctx), 'points_at_ziko');
  assert.equal(classifyValue(`https://${SCRATCH}.supabase.co`, ctx), 'points_at_scratch');
  assert.equal(classifyValue(SCRATCH_KEY, ctx), 'points_at_scratch');
  assert.equal(classifyValue(jwt({ ref: SCRATCH }), ctx), 'points_at_scratch');
  assert.equal(classifyValue(`https://${PORTFOLIO}.supabase.co`, ctx), 'clean');
  assert.equal(classifyValue(jwt({ ref: PORTFOLIO }), ctx), 'clean');
  assert.equal(classifyValue('', ctx), 'unknown');
  assert.equal(classifyValue(undefined, ctx), 'unknown');
  assert.equal(classifyValue('not.a.jwt', ctx), 'clean');
});

test('C2 classifyValue never returns or logs the value', () => {
  const lines = [];
  const orig = console.log;
  console.log = (...a) => lines.push(a.join(' '));
  try {
    const r = classifyValue(ZIKO_KEY, ctx);
    assert.equal(typeof r, 'string');
    assert.ok(!r.includes(ZIKO_KEY));
  } finally {
    console.log = orig;
  }
  assert.equal(lines.length, 0);
});

test('C3 parseDotenv: quotes, = inside values, CRLF, comments', () => {
  const env = parseDotenv('# c\r\nA="x=y"\r\nB=\'q\'\r\n\r\nexport C=plain=1\r\nD=\r\n');
  assert.deepEqual(env, { A: 'x=y', B: 'q', C: 'plain=1', D: '' });
});

test('C4 parseVercelEnvLs: table rows, all-branches and branch-specific preview', () => {
  const text = [
    'Vercel CLI 59.24.0',
    '> Environment Variables found for ziko-api',
    '',
    ' name                       value        environments                  created',
    ' SUPABASE_URL               Encrypted    Production, Preview           5d ago',
    ' SUPABASE_SERVICE_KEY       Encrypted    Production                    5d ago',
    ' SUPABASE_PUBLISHABLE_KEY   Encrypted    Preview (feature/x)           2d ago',
    ' FOO                        Encrypted    Development                   9d ago',
  ].join('\n');
  const rows = parseVercelEnvLs(text);
  assert.deepEqual(rows[0], { name: 'SUPABASE_URL', environments: ['production', 'preview'], gitBranch: null });
  assert.deepEqual(rows[1], { name: 'SUPABASE_SERVICE_KEY', environments: ['production'], gitBranch: null });
  assert.deepEqual(rows[2], { name: 'SUPABASE_PUBLISHABLE_KEY', environments: ['preview'], gitBranch: 'feature/x' });
  assert.deepEqual(rows[3], { name: 'FOO', environments: ['development'], gitBranch: null });
  assert.equal(rows.length, 4);
});

test('C5 parseVercelEnvLs also reads --format json output', () => {
  const json = JSON.stringify({ envs: [{ key: 'A', target: ['production', 'preview'], gitBranch: 'b1' }, { key: 'B', target: 'development' }] });
  const rows = parseVercelEnvLs(json);
  assert.deepEqual(rows, [
    { name: 'A', environments: ['production', 'preview'], gitBranch: 'b1' },
    { name: 'B', environments: ['development'], gitBranch: null },
  ]);
});

test('C6 scanCiWorkflow finds the supabase secrets in ci.yml test step', () => {
  const yml = [
    'jobs:',
    '  verify:',
    '    steps:',
    '      - name: Test',
    '        run: npx turbo run test',
    '        env:',
    '          SUPABASE_URL: ${{ secrets.SUPABASE_URL }}',
    '          SUPABASE_PUBLISHABLE_KEY: ${{ secrets.SUPABASE_PUBLISHABLE_KEY }}',
    '          SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}',
  ].join('\n');
  const r = scanCiWorkflow(yml);
  assert.equal(r.test_step_uses_supabase_secrets, true);
  assert.deepEqual(r.secret_names.sort(), ['SUPABASE_PUBLISHABLE_KEY', 'SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_URL']);
  const none = scanCiWorkflow('jobs:\n  a:\n    steps:\n      - run: echo hi\n');
  assert.equal(none.test_step_uses_supabase_secrets, false);
  assert.deepEqual(none.secret_names, []);
});

const ROWS = [
  { surface: 'api', project: 'p-api', environment: 'production', branch: null, name: 'SUPABASE_URL', status: 'clean' },
  { surface: 'api', project: 'p-api', environment: 'preview', branch: null, name: 'SUPABASE_URL', status: 'points_at_ziko' },
  { surface: 'api', project: 'p-api', environment: 'development', branch: null, name: 'LEGACY_ZIKO_URL', status: 'points_at_ziko' },
  { surface: 'web', project: 'p-web', environment: 'preview', branch: 'feat/x', name: 'NEXT_PUBLIC_SUPABASE_URL', status: 'unknown' },
  { surface: 'web', project: 'p-web', environment: 'production', branch: null, name: 'SUPABASE_URL', status: 'clean' },
  { surface: 'mobile', project: 'eas', environment: 'preview', branch: null, name: 'EXPO_PUBLIC_SUPABASE_URL', status: 'points_at_ziko' },
];

test('C7 buildRemediationPlan: rm for unmatrixed names, set-portfolio for matrix names, names only', () => {
  const plan = buildRemediationPlan(ROWS);
  const items = plan.items;
  assert.equal(items.length, 3);
  const byKey = Object.fromEntries(items.map((i) => [`${i.surface}/${i.environment}/${i.branch}/${i.name}`, i.action]));
  assert.equal(byKey['api/preview/null/SUPABASE_URL'], 'set-portfolio');
  assert.equal(byKey['api/development/null/LEGACY_ZIKO_URL'], 'rm');
  assert.equal(byKey['web/preview/feat/x/NEXT_PUBLIC_SUPABASE_URL'], 'set-portfolio');
  for (const i of items) assert.deepEqual(Object.keys(i).sort(), ['action', 'branch', 'environment', 'name', 'project', 'surface']);
  // production of both surfaces is clean -> never targeted
  assert.deepEqual([...plan.clean_production_surfaces].sort(), ['api', 'web']);
  assert.ok(!items.some((i) => i.environment === 'production'));
});

test('C8 buildRemediationPlan code-read override: matrix name not read by code is removed', () => {
  const plan = buildRemediationPlan(ROWS, { codeNames: { api: new Set(['SUPABASE_PUBLISHABLE_KEY']), web: new Set(['NEXT_PUBLIC_SUPABASE_URL']) } });
  const a = plan.items.find((i) => i.surface === 'api' && i.name === 'SUPABASE_URL');
  assert.equal(a.action, 'rm');
  const w = plan.items.find((i) => i.surface === 'web');
  assert.equal(w.action, 'set-portfolio');
});

test('C9 buildRemediationCommands refuses without the approval block', () => {
  const plan = buildRemediationPlan(ROWS);
  assert.throws(() => buildRemediationCommands(plan, { authorizationText: '' }), /approval|authorization/i);
  assert.throws(() => buildRemediationCommands(plan, { authorizationText: '### 07-14 env remediation\nApproved: env-remediation\n' }), /approval|authorization/i);
  assert.throws(() => buildRemediationCommands(plan, { authorizationText: AUTH_OK.replace('Approved: env-remediation', 'Approved: nothing') }), /approval|authorization/i);
});

test('C10 buildRemediationCommands builds rm/add argv, values never in argv, preview branch honoured', () => {
  const plan = buildRemediationPlan(ROWS);
  const cmds = buildRemediationCommands(plan, { authorizationText: AUTH_OK });
  const flat = cmds.map((c) => c.args.join(' '));
  assert.ok(flat.includes('env rm LEGACY_ZIKO_URL development --yes'));
  assert.ok(flat.includes('env rm NEXT_PUBLIC_SUPABASE_URL preview feat/x --yes'));
  assert.ok(flat.includes('env rm SUPABASE_URL preview --yes'));
  const add = cmds.find((c) => c.op === 'add' && c.name === 'NEXT_PUBLIC_SUPABASE_URL');
  assert.deepEqual(add.args.slice(0, 5), ['env', 'add', 'NEXT_PUBLIC_SUPABASE_URL', 'preview', 'feat/x']);
  assert.equal(add.stdin, true);
  assert.equal(add.valueFrom, 'url');
  assert.ok(!flat.some((l) => l.includes('production')));
  // no rm-only item has an add
  assert.ok(!cmds.some((c) => c.op === 'add' && c.name === 'LEGACY_ZIKO_URL'));
});

test('C11 buildAuditReport: passed iff no ziko/unknown (and no CI scratch with includeCi); report is safe', () => {
  const clean = ROWS.filter((r) => r.status === 'clean');
  const okReport = buildAuditReport({ projects: ['p-api', 'p-web'], rows: clean, ci: { status: 'off_scratch' }, eas: { available: true }, includeCi: true, now: () => 'T' });
  assert.equal(okReport.passed, true);
  assert.equal(okReport.generated_at, 'T');
  const bad = buildAuditReport({ projects: [], rows: ROWS, ci: { status: 'off_scratch' }, eas: {}, includeCi: false });
  assert.equal(bad.passed, false);
  const ciBad = buildAuditReport({ projects: [], rows: clean, ci: { status: 'on_scratch' }, eas: {}, includeCi: true });
  assert.equal(ciBad.passed, false);
  const ciIgnored = buildAuditReport({ projects: [], rows: clean, ci: { status: 'on_scratch' }, eas: {}, includeCi: false });
  assert.equal(ciIgnored.passed, true);
  const unk = buildAuditReport({ projects: [], rows: [{ ...clean[0], status: 'unknown' }], ci: {}, eas: {}, includeCi: false });
  assert.equal(unk.passed, false);
  assert.throws(() => buildAuditReport({ projects: [], rows: [{ ...clean[0], name: 'a@b.com' }], ci: {}, eas: {}, includeCi: false }));
});

// ---------------------------------------------------------------- CLI (07-06 task 2)

const REAL_ZIKO_KEY = 'fake-real-ziko-pub-key';
const PORTFOLIO_PUB = 'fake-portfolio-pub-key';
const PORTFOLIO_SECRET = 'fake-portfolio-secret-key';
const keysFor = async (ref) => {
  if (ref === PROJECTS.ziko) return { publishable: REAL_ZIKO_KEY, secret: 'fake-real-ziko-secret' };
  if (ref === PROJECTS.scratch) return { publishable: 'fake-scratch-pub', secret: 'fake-scratch-secret' };
  return { publishable: PORTFOLIO_PUB, secret: PORTFOLIO_SECRET };
};
const TMP = join(tmpdir(), 'ziko-decom-env-test');
const CLEAN_URL = `https://${PROJECTS.portfolio}.supabase.co`;

function makeDeps({ zikoIn = [], failClassify = false, authText = AUTH_OK, ciYml = 'jobs: {}' } = {}) {
  const calls = [];
  const files = {};
  const removed = [];
  const written = {};
  const logs = [];
  const gates = [];
  const runner = (cmd, args, opts = {}) => {
    calls.push({ cmd, args, input: opts.input });
    if (cmd === 'vercel' && args[0] === 'link') return { status: 0, stdout: '', stderr: '' };
    if (cmd === 'vercel' && args[0] === 'env' && args[1] === 'ls') {
      const env = args[2];
      const envs = [{ key: 'SUPABASE_URL', target: [env] }];
      if (env === 'preview') envs.push({ key: 'NEXT_PUBLIC_SUPABASE_URL', target: ['preview'], gitBranch: 'feat/x' });
      return { status: 0, stdout: JSON.stringify({ envs }), stderr: '' };
    }
    if (cmd === 'vercel' && args[0] === 'env' && args[1] === 'pull') {
      const env = args[3].split('=')[1];
      const val = zikoIn.includes(env) ? `https://${PROJECTS.ziko}.supabase.co` : CLEAN_URL;
      files[args[2]] = `SUPABASE_URL="${val}"\nNEXT_PUBLIC_SUPABASE_URL="${val}"\n`;
      return { status: 0, stdout: '', stderr: '' };
    }
    if (cmd === 'vercel' && args[0] === 'env') return { status: 0, stdout: '', stderr: '' };
    if (cmd === 'npx') return { status: 0, stdout: `EXPO_PUBLIC_SUPABASE_URL=${CLEAN_URL}\nEXPO_PUBLIC_SUPABASE_KEY=${PORTFOLIO_PUB}\n`, stderr: '' };
    if (cmd === 'gh') return { status: 0, stdout: '[{"name":"SUPABASE_URL","updatedAt":"2026-01-01T00:00:00Z"}]', stderr: '' };
    return { status: 1, stdout: '', stderr: '' };
  };
  const deps = {
    runner,
    getKeys: keysFor,
    readText: (p) => {
      const k = String(p);
      if (k in files) return files[k];
      const norm = k.replaceAll('\\', '/');
      if (norm.endsWith('ci.yml')) return ciYml;
      if (norm.endsWith('07-AUTHORIZATIONS.md')) return authText;
      if (norm.endsWith('report.json')) return written.report ?? '';
      throw new Error(`ENOENT ${norm}`);
    },
    writeText: (p, t) => {
      if (String(p).endsWith('report.json')) written.report = t;
    },
    removePath: (p) => removed.push(p),
    mkTmp: () => TMP,
    collectCodeNames: () => ({ api: new Set(['SUPABASE_URL']), web: new Set(['NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_URL']) }),
    recordGate: (key, ev) => gates.push([key, ev]),
    repoRoot: 'C:/ziko-platform-fake-root',
    now: () => 'T',
    log: (m) => logs.push(m),
    errlog: (m) => logs.push(m),
  };
  if (failClassify) deps.classify = () => { throw new Error('boom'); };
  return { deps, calls, files, removed, written, logs, gates };
}

const AUDIT_ARGV = ['--all', '--vercel-project', 'p-api', '--vercel-project', 'p-web', '--include-ci', '--json-out', 'report.json'];

test('R1 --help exits 0 and documents modes', async () => {
  const h = makeDeps();
  assert.equal(await run(['--help'], h.deps), 0);
  assert.ok(h.logs.join('\n').includes('--apply-remediation'));
});

test('R2 audit: ci.yml injecting supabase secrets -> not passed, no value leaks', async () => {
  const h = makeDeps({ ciYml: 'x: ${{ secrets.SUPABASE_URL }}' });
  const code = await run(AUDIT_ARGV, h.deps);
  assert.equal(code, 1);
  const report = JSON.parse(h.written.report);
  assert.equal(report.ci.status, 'on_scratch');
  assert.equal(report.passed, false);
  const everything = h.logs.join('\n') + h.written.report;
  for (const secret of [REAL_ZIKO_KEY, PORTFOLIO_PUB, PORTFOLIO_SECRET, CLEAN_URL, PROJECTS.ziko]) assert.ok(!everything.includes(secret));
  assert.ok(report.rows.some((r) => r.environment === 'preview' && r.branch === 'feat/x'));
});

test('R3 audit passes when everything is clean and CI is off scratch; gate only with --record-gate and in-repo evidence', async () => {
  const h = makeDeps();
  assert.equal(await run(AUDIT_ARGV, h.deps), 0);
  assert.equal(h.gates.length, 0);
  assert.ok(h.calls.some((c) => c.cmd === 'npx' && c.args.includes('eas-cli@24.10.0')));
  const outside = makeDeps();
  assert.equal(await run([...AUDIT_ARGV, '--record-gate'], outside.deps), 1);
  assert.equal(outside.gates.length, 0);
  const inside = makeDeps();
  const argv = ['--all', '--vercel-project', 'p-api', '--vercel-project', 'p-web', '--json-out', 'C:/ziko-platform-fake-root/reports/report.json', '--record-gate'];
  assert.equal(await run(argv, inside.deps), 0);
  assert.deepEqual(inside.gates, [['env_scopes_clean', { evidence: 'reports/report.json' }]]);
});

test('R4 audit fails when a preview value points at ziko; gate not recorded', async () => {
  const h = makeDeps({ zikoIn: ['preview'] });
  const code = await run([...AUDIT_ARGV, '--record-gate'], h.deps);
  assert.equal(code, 1);
  assert.equal(h.gates.length, 0);
  const report = JSON.parse(h.written.report);
  assert.ok(report.rows.some((r) => r.status === 'points_at_ziko' && r.environment === 'preview'));
});

test('R5 every pulled file path is removed even when classification throws', async () => {
  const h = makeDeps({ failClassify: true });
  const code = await run(AUDIT_ARGV, h.deps);
  assert.equal(code, 1);
  const pulls = h.calls.filter((c) => c.cmd === 'vercel' && c.args[1] === 'pull').map((c) => c.args[2]);
  assert.ok(pulls.length >= 1);
  for (const p of pulls) assert.ok(h.removed.includes(p), `not removed: ${p}`);
  assert.ok(h.removed.includes(TMP));
});

test('R6 --plan-remediation prints names only and runs nothing', async () => {
  const h = makeDeps({ zikoIn: ['preview'] });
  await run(AUDIT_ARGV, h.deps);
  const before = h.calls.length;
  const code = await run(['--plan-remediation', '--from', 'report.json'], h.deps);
  assert.equal(code, 0);
  assert.equal(h.calls.length, before);
  assert.ok(h.logs.some((l) => l.startsWith('set-portfolio | ')));
});

test('R7 --apply-remediation refusals: zero runner calls', async () => {
  const base = makeDeps({ zikoIn: ['preview'] });
  await run(AUDIT_ARGV, base.deps);
  const before = base.calls.length;
  for (const confirm of [PROJECTS.ziko, PROJECTS.scratch, undefined]) {
    const argv = ['--apply-remediation', '--from', 'report.json', ...(confirm ? ['--confirm-ref', confirm] : [])];
    assert.equal(await run(argv, base.deps), 1);
  }
  assert.equal(base.calls.length, before);
  const noAuth = makeDeps({ zikoIn: ['preview'], authText: '' });
  noAuth.written.report = base.written.report;
  assert.equal(await run(['--apply-remediation', '--from', 'report.json', '--confirm-ref', PROJECTS.portfolio], noAuth.deps), 1);
  assert.equal(noAuth.calls.length, 0);
});

test('R8 --apply-remediation with approval: portfolio values on stdin, never argv, production untouched', async () => {
  const base = makeDeps({ zikoIn: ['preview'] });
  await run(AUDIT_ARGV, base.deps);
  const h = makeDeps({ zikoIn: ['preview'] });
  h.written.report = base.written.report;
  const code = await run(['--apply-remediation', '--from', 'report.json', '--confirm-ref', PROJECTS.portfolio], h.deps);
  assert.equal(code, 0);
  const adds = h.calls.filter((c) => c.cmd === 'vercel' && c.args[0] === 'env' && c.args[1] === 'add');
  assert.ok(adds.length >= 1);
  for (const a of adds) {
    assert.ok([CLEAN_URL, PORTFOLIO_PUB, PORTFOLIO_SECRET].includes(a.input));
    assert.ok(!a.args.join(' ').includes(PORTFOLIO_PUB));
  }
  assert.ok(!h.calls.some((c) => c.cmd === 'vercel' && c.args[0] === 'env' && c.args.includes('production')));
  assert.ok(h.removed.includes(TMP));
});

test('R9 bad args and mode count', async () => {
  const h = makeDeps();
  assert.equal(await run(['--bogus'], h.deps), 2);
  assert.equal(await run([], h.deps), 2);
  assert.equal(await run(['--all'], h.deps), 2);
});
