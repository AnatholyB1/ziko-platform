import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PROJECTS } from '../auth-merge/lib.mjs';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import {
  assertCommittedSafe,
  emptyGates,
  GATE_KEYS,
  GATES_PATH,
  AUTH_LOG_PATH,
  REPO_ROOT,
  confirmationLine,
} from './18-decom-guard.mjs';
import { evaluatePreDelete, classifyGetResponse, buildDeletionLog, run } from './24-decom-delete.mjs';

const ZIKO = PROJECTS.ziko;
const SCRATCH = PROJECTS.scratch;
const PORTFOLIO = PROJECTS.portfolio;

test('evaluatePreDelete: matching ziko identity is ok', () => {
  const r = evaluatePreDelete({ project: 'ziko', ref: ZIKO, info: { id: ZIKO, name: 'ziko', status: 'ACTIVE_HEALTHY' } });
  assert.equal(r.ok, true);
});

test('evaluatePreDelete: ref field preferred, scratch name accepted', () => {
  const r = evaluatePreDelete({ project: 'scratch', ref: SCRATCH, info: { ref: SCRATCH, name: 'ziko-migration-scratch', status: 'ACTIVE_HEALTHY' } });
  assert.equal(r.ok, true);
});

test('evaluatePreDelete: portfolio-like name for ziko is not ok', () => {
  const r = evaluatePreDelete({ project: 'ziko', ref: ZIKO, info: { id: ZIKO, name: 'portfolio-like', status: 'ACTIVE_HEALTHY' } });
  assert.equal(r.ok, false);
  assert.match(r.detail, /name/);
});

test('evaluatePreDelete: ref mismatch is not ok', () => {
  const r = evaluatePreDelete({ project: 'ziko', ref: ZIKO, info: { id: PORTFOLIO, name: 'ziko', status: 'ACTIVE_HEALTHY' } });
  assert.equal(r.ok, false);
  assert.match(r.detail, /ref/);
});

test('evaluatePreDelete: already removed or going down is not ok', () => {
  for (const status of ['REMOVED', 'GOING_DOWN']) {
    assert.equal(evaluatePreDelete({ project: 'ziko', ref: ZIKO, info: { id: ZIKO, name: 'ziko', status } }).ok, false);
  }
});

test('evaluatePreDelete: missing info is not ok', () => {
  assert.equal(evaluatePreDelete({ project: 'ziko', ref: ZIKO, info: null }).ok, false);
  assert.equal(evaluatePreDelete({ project: 'portfolio', ref: ZIKO, info: { id: ZIKO, name: 'ziko' } }).ok, false);
});

test('classifyGetResponse', () => {
  assert.equal(classifyGetResponse({ status: 200, body: { status: 'ACTIVE_HEALTHY' } }), 'present');
  assert.equal(classifyGetResponse({ status: 200, body: { status: 'REMOVED' } }), 'in-progress');
  assert.equal(classifyGetResponse({ status: 200, body: { status: 'GOING_DOWN' } }), 'in-progress');
  assert.equal(classifyGetResponse({ status: 200, body: { status: 'REMOVING' } }), 'in-progress');
  assert.equal(classifyGetResponse({ status: 404, body: null }), 'gone');
  assert.equal(classifyGetResponse({ status: 410, body: null }), 'gone');
  for (const s of [401, 403, 429, 500, 503]) assert.equal(classifyGetResponse({ status: s, body: null }), 'error');
});

const LOG_INPUT = {
  project: 'ziko',
  ref: ZIKO,
  preDelete: { name: 'ziko', status: 'ACTIVE_HEALTHY', region: 'eu-west-3' },
  deletedAt: '2026-10-05T10:00:00.000Z',
  confirmedGoneAt: '2026-10-05T10:01:00.000Z',
  method: 'api',
  evidence: [
    { gate: 'backup_encrypted', path: 'scripts/portfolio-migration/reports/decom-backup.json', sha256: 'a'.repeat(64) },
    { gate: 'verify_pass', path: 'scripts/portfolio-migration/reports/decom-verify.json', sha256: 'b'.repeat(64) },
  ],
  authBlock: '07-17 D-15 confirmation',
};

test('buildDeletionLog: markdown and json, safe content', () => {
  const { json, markdown } = buildDeletionLog(LOG_INPUT);
  assert.match(markdown, /^# ziko deletion log/m);
  assert.ok(markdown.includes(ZIKO));
  assert.ok(markdown.includes('2026-10-05T10:00:00.000Z'));
  assert.ok(markdown.includes('api'));
  assert.ok(markdown.includes('eu-west-3'));
  assert.ok(markdown.includes('a'.repeat(64)));
  assert.match(markdown, /final action of milestone v1\.19/);
  assert.equal(json.ref, ZIKO);
  assert.equal(json.evidence.length, 2);
  assert.equal(assertCommittedSafe(markdown), true);
  assert.equal(assertCommittedSafe(json), true);
});

test('buildDeletionLog: dashboard method accepted, bad method rejected', () => {
  assert.equal(buildDeletionLog({ ...LOG_INPUT, method: 'dashboard' }).json.method, 'dashboard');
  assert.throws(() => buildDeletionLog({ ...LOG_INPUT, method: 'cli' }), /method/);
});

test('buildDeletionLog: refuses unsafe content', () => {
  assert.throws(() => buildDeletionLog({ ...LOG_INPUT, preDelete: { name: 'x@example.com', status: 's', region: 'r' } }));
});

// ---------------------------------------------------------------- CLI harness (mocked fetch, no real API)

const TOKEN = 'sbp_TESTTOKENVALUE0123456789';
const norm = (p) => String(p).replaceAll('\\', '/').toLowerCase();
const EVIDENCE_PATH = 'scripts/portfolio-migration/reports/fake-evidence.json';
const EVIDENCE_BYTES = Buffer.from('{"fake":"evidence"}\n');
const sha = (b) => createHash('sha256').update(b).digest('hex');

const ZIKO_AUTH = [
  '### 07-17 D-15 confirmation',
  confirmationLine(),
  'Timestamp: 2026-10-05T09:00:00Z',
  'Reply: "yes"',
  '',
].join('\n');
const SCRATCH_AUTH = [
  '### 07-16 scratch deletion',
  `Approved: delete scratch ${SCRATCH}`,
  'Timestamp: 2026-10-05T08:00:00Z',
  'Reply: "approve"',
  '',
].join('\n');

function goodGates(falseKeys = []) {
  const g = emptyGates();
  for (const k of GATE_KEYS) {
    if (k === 'confirmation_yes') {
      g[k] = { passed: true, at: 'x', evidence: null, sha256: null, auth_block: '07-17 D-15 confirmation', required_line: confirmationLine() };
    } else {
      g[k] = { passed: true, at: 'x', evidence: EVIDENCE_PATH, sha256: sha(EVIDENCE_BYTES), auth_block: null, required_line: null };
    }
  }
  for (const k of falseKeys) g[k] = { ...g[k], passed: false };
  return g;
}

function makeDeps({
  gates = goodGates(),
  authText = `${ZIKO_AUTH}\n${SCRATCH_AUTH}`,
  evidenceBytes = EVIDENCE_BYTES,
  handler,
  extraFiles = {},
  token = TOKEN,
} = {}) {
  const files = new Map();
  files.set(norm(GATES_PATH), JSON.stringify(gates));
  files.set(norm(AUTH_LOG_PATH), authText);
  files.set(norm(resolve(REPO_ROOT, EVIDENCE_PATH)), evidenceBytes);
  for (const [k, v] of Object.entries(extraFiles)) files.set(norm(k), v);
  const written = {};
  const calls = [];
  const out = [];
  let clock = 1_000_000;
  const defaultHandler = (url, init) => {
    const method = init?.method;
    const refMatch = url.match(/\/v1\/projects\/([a-z]{20})$/);
    if (method === 'GET' && refMatch) {
      const ref = refMatch[1];
      return { status: 200, body: { id: ref, ref, name: ref === SCRATCH ? 'ziko-migration-scratch' : 'ziko', status: 'ACTIVE_HEALTHY', region: 'eu-west-3', organization_id: 'vercel_icfg_abc' } };
    }
    if (method === 'DELETE' && refMatch) return { status: 200, body: { id: refMatch[1], ref: refMatch[1], name: 'ziko' } };
    if (method === 'GET' && url.endsWith('/v1/organizations')) return { status: 200, body: [{ id: 'vercel_icfg_abc', slug: 'vercel_icfg_abc', name: 'org' }] };
    if (method === 'GET' && url.endsWith('/v1/projects')) return { status: 200, body: [{ ref: ZIKO }, { ref: PORTFOLIO }, { ref: SCRATCH }] };
    return { status: 500, body: null };
  };
  const deps = {
    repoRoot: REPO_ROOT,
    readText: (p) => {
      const v = files.get(norm(p));
      if (v === undefined) throw new Error(`ENOENT ${norm(p)}`);
      return Buffer.isBuffer(v) ? v.toString('utf8') : v;
    },
    readBytes: (p) => {
      const v = files.get(norm(p));
      if (v === undefined) throw new Error(`ENOENT ${norm(p)}`);
      return Buffer.isBuffer(v) ? v : Buffer.from(v);
    },
    writeText: async (p, t) => {
      written[norm(p)] = t;
      files.set(norm(p), t);
    },
    fileExists: (p) => files.has(norm(p)),
    now: () => '2026-10-05T10:00:00.000Z',
    nowMs: () => clock,
    sleep: async (ms) => {
      clock += ms;
    },
    loadToken: async () => token,
    log: (m) => out.push(String(m)),
    errlog: (m) => out.push(String(m)),
    fetchImpl: async (url, init) => {
      calls.push([url, init]);
      const r = await (handler ?? defaultHandler)(url, init, defaultHandler);
      if (r instanceof Error) throw r;
      return { ok: r.status >= 200 && r.status < 300, status: r.status, json: async () => r.body };
    },
  };
  return { deps, calls, out, written, files };
}

const deleteCalls = (calls) => calls.filter((c) => c[1]?.method === 'DELETE');
const DEL = (extra = []) => ['--delete', '--project', 'ziko', '--confirm-ref', ZIKO, '--json-out', 'out/del.json', ...extra];

async function refuses(argv, opts, code = 1) {
  const h = makeDeps(opts);
  assert.equal(await run(argv, h.deps), code);
  assert.equal(deleteCalls(h.calls).length, 0);
  return h;
}

test('refusal: project portfolio', async () => {
  await refuses(['--delete', '--project', 'portfolio', '--confirm-ref', PORTFOLIO, '--json-out', 'o.json']);
  const h = await refuses(['--delete', '--project', 'portfolio', '--confirm-ref', ZIKO, '--json-out', 'o.json']);
  assert.equal(h.calls.length, 0);
});

test('refusal: unknown project', async () => {
  await refuses(['--delete', '--project', 'other', '--confirm-ref', ZIKO, '--json-out', 'o.json']);
});

test('refusal: portfolio ref as confirm-ref under ziko', async () => {
  const h = await refuses(DEL().map((a) => (a === ZIKO ? PORTFOLIO : a)));
  assert.equal(h.calls.length, 0);
});

test('refusal: scratch ref as confirm-ref under ziko', async () => {
  await refuses(DEL().map((a) => (a === ZIKO ? SCRATCH : a)));
});

test('refusal: wrong confirm-ref', async () => {
  await refuses(DEL().map((a) => (a === ZIKO ? 'abcdefghijklmnopqrst' : a)));
});

test('refusal: missing confirm-ref', async () => {
  await refuses(['--delete', '--project', 'ziko', '--json-out', 'o.json']);
});

test('refusal: scratch project with ziko ref as confirm-ref', async () => {
  await refuses(['--delete', '--project', 'scratch', '--confirm-ref', ZIKO, '--json-out', 'o.json']);
});

for (const key of GATE_KEYS) {
  test(`refusal: gate ${key} false`, async () => {
    const h = await refuses(DEL(), { gates: goodGates([key]) });
    assert.equal(h.calls.length, 0);
  });
}

test('refusal: evidence file modified after recording', async () => {
  const h = await refuses(DEL(), { evidenceBytes: Buffer.from('{"fake":"tampered"}\n') });
  assert.equal(h.calls.length, 0);
});

test('refusal: evidence file missing', async () => {
  const h = makeDeps();
  h.files.delete(norm(resolve(REPO_ROOT, EVIDENCE_PATH)));
  assert.equal(await run(DEL(), h.deps), 1);
  assert.equal(deleteCalls(h.calls).length, 0);
});

test('refusal: D-15 authorization block missing', async () => {
  await refuses(DEL(), { authText: SCRATCH_AUTH });
});

test('refusal: reply "yes but wait" is not a plain yes', async () => {
  await refuses(DEL(), { authText: ZIKO_AUTH.replace('Reply: "yes"', 'Reply: "yes but wait"') });
});

test('refusal: abort confirmation line', async () => {
  await refuses(DEL(), { authText: ZIKO_AUTH.replace(confirmationLine(), 'Confirmation: none (abort)') });
});

test('refusal: gate file unreadable', async () => {
  const h = makeDeps();
  h.files.delete(norm(GATES_PATH));
  assert.equal(await run(DEL(), h.deps), 1);
  assert.equal(h.calls.length, 0);
});

test('refusal: pre-delete GET name mismatch', async () => {
  const h = await refuses(DEL(), {
    handler: (url, init, d) =>
      init.method === 'GET' ? { status: 200, body: { id: ZIKO, name: 'portfolio-like', status: 'ACTIVE_HEALTHY' } } : d(url, init),
  });
  assert.ok(h.calls.length >= 1);
});

test('refusal: pre-delete GET ref mismatch', async () => {
  await refuses(DEL(), {
    handler: (url, init, d) =>
      init.method === 'GET' ? { status: 200, body: { id: PORTFOLIO, name: 'ziko', status: 'ACTIVE_HEALTHY' } } : d(url, init),
  });
});

test('refusal: pre-delete GET 404 or error', async () => {
  for (const status of [404, 401, 500]) {
    await refuses(DEL(), { handler: (url, init, d) => (init.method === 'GET' ? { status, body: null } : d(url, init)) });
  }
});

test('refusal: token load failure', async () => {
  const h = makeDeps();
  h.deps.loadToken = async () => {
    throw new Error('no token');
  };
  assert.equal(await run(DEL(), h.deps), 1);
  assert.equal(h.calls.length, 0);
});

test('bad args: --delete without --json-out, --except outside dry-run', async () => {
  await refuses(['--delete', '--project', 'ziko', '--confirm-ref', ZIKO], {}, 2);
  await refuses([...DEL(), '--except', 'confirmation_yes'], {}, 2);
  await refuses(['--delete', '--dry-run', '--project', 'ziko'], {}, 2);
  await refuses(['--bogus'], {}, 2);
});

test('scratch: refused without its auth block, deletes with it', async () => {
  const argv = ['--delete', '--project', 'scratch', '--confirm-ref', SCRATCH, '--json-out', 'o.json'];
  const scratchGates = () => {
    const g = goodGates();
    return g;
  };
  await refuses(argv, { gates: scratchGates(), authText: ZIKO_AUTH });
  await refuses(argv, { gates: goodGates(['restore_proven']), authText: SCRATCH_AUTH });
  const h = makeDeps({ gates: scratchGates(), authText: SCRATCH_AUTH });
  assert.equal(await run(argv, h.deps), 0);
  const d = deleteCalls(h.calls);
  assert.equal(d.length, 1);
  assert.ok(d[0][0].endsWith(`/v1/projects/${SCRATCH}`));
});

test('happy path: exactly one DELETE to the ziko ref, json-out written', async () => {
  const h = makeDeps();
  assert.equal(await run(DEL(), h.deps), 0);
  const d = deleteCalls(h.calls);
  assert.equal(d.length, 1);
  assert.ok(d[0][0].endsWith(`/v1/projects/${ZIKO}`));
  const doc = JSON.parse(h.written['out/del.json']);
  assert.equal(doc.deleted_at, '2026-10-05T10:00:00.000Z');
  assert.equal(doc.pre_delete.name, 'ziko');
  assert.equal(doc.response_ref, ZIKO);
  // GET identity came before the DELETE
  assert.equal(h.calls.findIndex((c) => c[1].method === 'DELETE') > h.calls.findIndex((c) => c[1].method === 'GET'), true);
});

test('DELETE 429: no second DELETE, exit 1', async () => {
  const h = makeDeps({ handler: (url, init, d) => (init.method === 'DELETE' ? { status: 429, body: null } : d(url, init)) });
  assert.equal(await run(DEL(), h.deps), 1);
  assert.equal(deleteCalls(h.calls).length, 1);
});

test('DELETE 500 and network error: single DELETE, exit 1', async () => {
  for (const handler of [
    (url, init, d) => (init.method === 'DELETE' ? { status: 500, body: null } : d(url, init)),
    (url, init, d) => (init.method === 'DELETE' ? new Error('socket hang up') : d(url, init)),
  ]) {
    const h = makeDeps({ handler });
    assert.equal(await run(DEL(), h.deps), 1);
    assert.equal(deleteCalls(h.calls).length, 1);
  }
});

test('DELETE 403 or 409: exit 3 (dashboard fallback), single DELETE, nothing written', async () => {
  for (const status of [403, 409]) {
    const h = makeDeps({ handler: (url, init, d) => (init.method === 'DELETE' ? { status, body: null } : d(url, init)) });
    assert.equal(await run(DEL(), h.deps), 3);
    assert.equal(deleteCalls(h.calls).length, 1);
    assert.equal(h.written['out/del.json'], undefined);
  }
});

test('token never appears in output (including error text)', async () => {
  const h = makeDeps({ handler: (url, init, d) => (init.method === 'DELETE' ? new Error(`boom ${TOKEN}`) : d(url, init)) });
  await run(DEL(), h.deps);
  assert.ok(h.out.length > 0);
  assert.equal(h.out.join('\n').includes(TOKEN), false);
  assert.ok(h.out.join('\n').includes('[secret]'));
});

test('dry-run: all gates pass, zero DELETE; failing gate refuses', async () => {
  const argv = ['--dry-run', '--project', 'ziko', '--confirm-ref', ZIKO];
  const h = makeDeps();
  assert.equal(await run(argv, h.deps), 0);
  assert.equal(deleteCalls(h.calls).length, 0);
  assert.match(h.out.join('\n'), /\[PASS\] pre-delete identity/);
  await refuses(argv, { gates: goodGates(['verify_pass']) });
});

test('dry-run --except confirmation_yes works only for that gate', async () => {
  const argv = ['--dry-run', '--project', 'ziko', '--confirm-ref', ZIKO, '--except', 'confirmation_yes'];
  const h = makeDeps({ gates: goodGates(['confirmation_yes']), authText: '' });
  assert.equal(await run(argv, h.deps), 0);
  assert.equal(deleteCalls(h.calls).length, 0);
  await refuses(argv, { gates: goodGates(['confirmation_yes', 'verify_pass']), authText: '' });
  await refuses(['--dry-run', '--project', 'ziko', '--confirm-ref', ZIKO, '--except', 'verify_pass'], {}, 2);
});

test('preflight: read-only, reports org kind and other projects', async () => {
  const h = makeDeps({
    handler: (url, init, d) =>
      init.method === 'GET' && url.endsWith('/v1/projects') ? { status: 200, body: [{ ref: ZIKO }, { ref: PORTFOLIO }, { ref: 'zzzzzzzzzzzzzzzzzzzz' }] } : d(url, init),
  });
  assert.equal(await run(['--preflight', '--project', 'ziko', '--json-out', 'o/pre.json'], h.deps), 0);
  assert.equal(h.calls.every((c) => c[1].method === 'GET'), true);
  const text = h.out.join('\n');
  assert.match(text, /vercel_marketplace_managed=true/);
  assert.match(text, /other_projects=1/);
  const doc = JSON.parse(h.written['o/pre.json']);
  assert.equal(doc.pre_delete.name, 'ziko');
  assert.equal(doc.vercel_marketplace_managed, true);
});

test('preflight: unknown project or GET failure exits 1 with no DELETE', async () => {
  await refuses(['--preflight', '--project', 'portfolio']);
  await refuses(['--preflight', '--project', 'ziko'], { handler: () => ({ status: 403, body: null }) });
});

test('confirm-gone: polls until gone and absent from list, merges into json-out', async () => {
  let n = 0;
  const h = makeDeps({
    extraFiles: { 'out/del.json': JSON.stringify({ project: 'ziko', ref: ZIKO, deleted_at: 'T0', pre_delete: { name: 'ziko', status: 'ACTIVE_HEALTHY', region: 'eu-west-3' } }) },
    handler: (url, init, d) => {
      if (init.method === 'GET' && url.endsWith(`/v1/projects/${ZIKO}`)) {
        n += 1;
        if (n === 1) return { status: 200, body: { id: ZIKO, name: 'ziko', status: 'GOING_DOWN' } };
        return { status: 404, body: null };
      }
      if (init.method === 'GET' && url.endsWith('/v1/projects')) return { status: 200, body: [{ ref: PORTFOLIO }] };
      return d(url, init);
    },
  });
  assert.equal(await run(['--confirm-gone', '--project', 'ziko', '--json-out', 'out/del.json'], h.deps), 0);
  assert.equal(deleteCalls(h.calls).length, 0);
  const doc = JSON.parse(h.written['out/del.json']);
  assert.equal(doc.confirmed_gone_at, '2026-10-05T10:00:00.000Z');
  assert.equal(doc.method, 'api');
  assert.equal(doc.deleted_at, 'T0');
});

test('confirm-gone: dashboard method when no deleted_at; timeout exits 4', async () => {
  const gone = makeDeps({
    handler: (url, init, d) =>
      init.method === 'GET' && url.endsWith(`/v1/projects/${ZIKO}`) ? { status: 404, body: null }
        : init.method === 'GET' && url.endsWith('/v1/projects') ? { status: 200, body: [] } : d(url, init),
  });
  assert.equal(await run(['--confirm-gone', '--project', 'ziko', '--json-out', 'o.json'], gone.deps), 0);
  assert.equal(JSON.parse(gone.written['o.json']).method, 'dashboard');

  const stuck = makeDeps({
    handler: (url, init, d) =>
      init.method === 'GET' && url.endsWith(`/v1/projects/${ZIKO}`) ? { status: 404, body: null }
        : init.method === 'GET' && url.endsWith('/v1/projects') ? { status: 200, body: [{ ref: ZIKO }] } : d(url, init),
  });
  assert.equal(await run(['--confirm-gone', '--project', 'ziko', '--timeout-s', '20'], stuck.deps), 4);
  assert.equal(deleteCalls(stuck.calls).length, 0);
});

test('confirm-gone: gated like delete (no network when a gate fails)', async () => {
  const h = makeDeps({ gates: goodGates(['backup_encrypted']) });
  assert.equal(await run(['--confirm-gone', '--project', 'ziko'], h.deps), 1);
  assert.equal(h.calls.length, 0);
  const h2 = makeDeps({ authText: '' });
  assert.equal(await run(['--confirm-gone', '--project', 'ziko'], h2.deps), 1);
  assert.equal(h2.calls.length, 0);
});

test('write-log: builds log from delete json; refuses without confirmed_gone_at or for scratch', async () => {
  const doc = {
    project: 'ziko',
    ref: ZIKO,
    deleted_at: '2026-10-05T10:00:00.000Z',
    confirmed_gone_at: '2026-10-05T10:01:00.000Z',
    method: 'api',
    pre_delete: { name: 'ziko', status: 'ACTIVE_HEALTHY', region: 'eu-west-3' },
  };
  const argv = ['--write-log', '--project', 'ziko', '--from', 'in.json', '--log-md', 'log.md', '--log-json', 'log.json'];
  const ok = makeDeps({ extraFiles: { 'in.json': JSON.stringify(doc) } });
  assert.equal(await run(argv, ok.deps), 0);
  assert.match(ok.written['log.md'], /^# ziko deletion log/);
  assert.equal(JSON.parse(ok.written['log.json']).evidence.length, GATE_KEYS.length - 1);
  assert.equal(ok.calls.length, 0);

  const { confirmed_gone_at: _drop, ...noGone } = doc;
  const refused = makeDeps({ extraFiles: { 'in.json': JSON.stringify(noGone) } });
  assert.equal(await run(argv, refused.deps), 1);
  assert.equal(refused.written['log.md'], undefined);

  const scratch = makeDeps({ extraFiles: { 'in.json': JSON.stringify(doc) } });
  assert.equal(await run(['--write-log', '--project', 'scratch', '--from', 'in.json', '--log-md', 'l.md', '--log-json', 'l.json'], scratch.deps), 1);

  const gated = makeDeps({ gates: goodGates(['verify_pass']), extraFiles: { 'in.json': JSON.stringify(doc) } });
  assert.equal(await run(argv, gated.deps), 1);
  assert.equal(gated.written['log.md'], undefined);
});

test('help exits 0', async () => {
  const h = makeDeps();
  assert.equal(await run(['--help'], h.deps), 0);
  assert.equal(h.calls.length, 0);
});
