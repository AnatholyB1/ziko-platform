// Offline tests for 17-env-switch.mjs (06-05). No network, no Vercel/EAS calls.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import {
  ENV_MATRIX,
  FORBIDDEN_NAMES,
  PORTFOLIO_REF,
  renderEnvFile,
  buildVercelCommands,
  buildEasCommands,
  auditEnvNames,
  fingerprint,
  assertLocalPathIgnored,
  runEnvSwitch,
} from './17-env-switch.mjs';

const REF = 'ubxllsvanurkwkohzxau';
const names = (s) => Object.keys(ENV_MATRIX[s]).sort();

test('E1 matrix has exactly the documented names per surface, no secret in public vars', () => {
  assert.deepEqual(names('api'), ['SUPABASE_PUBLISHABLE_KEY', 'SUPABASE_SERVICE_KEY', 'SUPABASE_URL']);
  // NEXT_PUBLIC_SUPABASE_KEY is a publishable-key alias that application code reads (audit finding).
  assert.deepEqual(names('web'), [
    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    'NEXT_PUBLIC_SUPABASE_KEY',
    'NEXT_PUBLIC_SUPABASE_URL',
    'SUPABASE_SERVICE_ROLE_KEY',
    'SUPABASE_URL',
  ]);
  assert.deepEqual(names('mobile'), ['EXPO_PUBLIC_SUPABASE_KEY', 'EXPO_PUBLIC_SUPABASE_URL']);
  for (const s of ['api', 'web', 'mobile']) {
    for (const [name, spec] of Object.entries(ENV_MATRIX[s])) {
      assert.ok(['url', 'publishable', 'secret'].includes(spec.from), `${s}.${name}.from`);
      if (/^(NEXT_PUBLIC|EXPO_PUBLIC)_/.test(name)) assert.notEqual(spec.from, 'secret', `${name} must not carry the secret`);
    }
  }
  assert.equal(ENV_MATRIX.mobile.EXPO_PUBLIC_SUPABASE_KEY.visibility, 'sensitive');
  assert.equal(ENV_MATRIX.mobile.EXPO_PUBLIC_SUPABASE_URL.visibility, 'plaintext');
});

test('E2 renderEnvFile preserves comments, order, unrelated keys and line endings', () => {
  const lf = '# comment\nFOO=1\n\nSUPABASE_URL=old\nBAR=2\n';
  const out = renderEnvFile(lf, { SUPABASE_URL: 'new', SUPABASE_SERVICE_KEY: 'k' });
  assert.equal(out, '# comment\nFOO=1\n\nSUPABASE_URL=new\nBAR=2\nSUPABASE_SERVICE_KEY=k\n');
  const crlf = '# c\r\nFOO=1\r\nSUPABASE_URL=old\r\n';
  const out2 = renderEnvFile(crlf, { SUPABASE_URL: 'n2', X_NEW: 'v' });
  assert.equal(out2, '# c\r\nFOO=1\r\nSUPABASE_URL=n2\r\nX_NEW=v\r\n');
  assert.equal(renderEnvFile('', { A: '1' }), 'A=1\n');
  assert.throws(() => renderEnvFile('', { EXPO_PUBLIC_ZIKO_RELOGIN_CUTOVER_DATE: 'x' }), /forbidden/i);
  assert.throws(() => renderEnvFile('', { NEXT_PUBLIC_ZIKO_RELOGIN_CUTOVER_DATE: 'x' }), /forbidden/i);
  assert.ok(FORBIDDEN_NAMES.includes('EXPO_PUBLIC_ZIKO_RELOGIN_CUTOVER_DATE'));
});

test('E3 vercel preview commands: rm then add per name, branch arg, value via stdin', () => {
  const cmds = buildVercelCommands({ surface: 'web', environment: 'preview', gitBranch: 'gsd/phase-6-cutover' });
  const web = names('web');
  assert.equal(cmds.length, web.length * 2);
  for (const n of web) {
    const rm = cmds.find((c) => c.op === 'rm' && c.name === n);
    const add = cmds.find((c) => c.op === 'add' && c.name === n);
    assert.ok(rm && add);
    assert.deepEqual(rm.args.slice(0, 4), ['env', 'rm', n, 'preview']);
    assert.ok(rm.args.includes('gsd/phase-6-cutover'));
    assert.equal(rm.tolerateAbsent, true);
    assert.deepEqual(add.args, ['env', 'add', n, 'preview', 'gsd/phase-6-cutover']);
    assert.equal(add.stdin, true);
    assert.ok(cmds.indexOf(rm) < cmds.indexOf(add));
  }
});

test('E4 production gate: confirm-ref + exact typed line per surface (flip and rollback)', () => {
  const lineApi = `Typed authorization: approve ${REF} option-backend-flip`;
  const lineWeb = `Typed authorization: approve ${REF} option-web-flip`;
  const base = { environment: 'production', confirmRef: REF };
  assert.throws(() => buildVercelCommands({ surface: 'api', ...base, authorizationText: '' }), /authorization/i);
  assert.throws(() => buildVercelCommands({ surface: 'api', environment: 'production', authorizationText: lineApi }), /confirm-ref/i);
  assert.throws(() => buildVercelCommands({ surface: 'api', ...base, confirmRef: 'slkobhavpwsubnsmuhya', authorizationText: lineApi }), /confirm-ref/i);
  assert.throws(() => buildVercelCommands({ surface: 'api', ...base, authorizationText: lineWeb }), /authorization/i);
  assert.throws(() => buildVercelCommands({ surface: 'web', ...base, authorizationText: lineApi }), /authorization/i);
  assert.throws(() => buildVercelCommands({ surface: 'api', ...base, authorizationText: lineApi + 'x ' }), /authorization/i);
  assert.ok(buildVercelCommands({ surface: 'api', ...base, authorizationText: `noise\n${lineApi}\n` }).length > 0);
  assert.ok(buildVercelCommands({ surface: 'web', ...base, authorizationText: lineWeb }).length > 0);
  // production commands carry no git branch
  const prod = buildVercelCommands({ surface: 'api', ...base, authorizationText: lineApi });
  assert.deepEqual(prod.find((c) => c.op === 'add').args.slice(0, 4), ['env', 'add', 'SUPABASE_URL', 'production']);
  // rollback uses the same gate through runEnvSwitch (target ziko)
  assert.equal(PORTFOLIO_REF, REF);
});

test('E5 preview without git branch throws', () => {
  assert.throws(() => buildVercelCommands({ surface: 'web', environment: 'preview' }), /git-branch/i);
  assert.throws(() => buildVercelCommands({ surface: 'web', environment: 'preview', gitBranch: '' }), /git-branch/i);
});

test('E6 eas commands: URL plaintext, key sensitive, typed mobile-build line required', () => {
  const line = `Typed authorization: approve ${REF} option-mobile-build`;
  assert.throws(() => buildEasCommands({ environment: 'production', authorizationText: '' }), /authorization/i);
  const cmds = buildEasCommands({ environment: 'production', authorizationText: line });
  const url = cmds.find((c) => c.name === 'EXPO_PUBLIC_SUPABASE_URL');
  const key = cmds.find((c) => c.name === 'EXPO_PUBLIC_SUPABASE_KEY');
  assert.equal(cmds.length, 2);
  assert.ok(url.args.join(' ').includes('--visibility plaintext'));
  assert.ok(key.args.join(' ').includes('--visibility sensitive'));
  for (const c of cmds) {
    assert.ok(c.args.includes('--force') && c.args.includes('--non-interactive'));
    assert.ok(c.args.includes('production'));
  }
  assert.ok(buildEasCommands({ environment: 'preview', authorizationText: line }).length === 2);
});

test('E7 audit flags unknown SUPABASE env names and accepts known ones', () => {
  const ok = auditEnvNames([
    { surface: 'api', path: 'a.ts', text: 'const u = process.env.SUPABASE_URL; const k = process.env["SUPABASE_SERVICE_KEY"]; process.env.OTHER' },
    { surface: 'mobile', path: 'm.ts', text: "process.env['EXPO_PUBLIC_SUPABASE_URL']" },
  ]);
  assert.equal(ok.ok, true);
  assert.deepEqual(ok.unknown, []);
  const bad = auditEnvNames([{ surface: 'api', path: 'b.ts', text: 'process.env.SUPABASE_FOO' }]);
  assert.equal(bad.ok, false);
  assert.equal(bad.unknown[0].name, 'SUPABASE_FOO');
  // a name valid for another surface is unknown for this one
  const cross = auditEnvNames([{ surface: 'api', path: 'c.ts', text: 'process.env.SUPABASE_SERVICE_ROLE_KEY' }]);
  assert.equal(cross.ok, false);
  // shared code is checked against the union
  const shared = auditEnvNames([{ surface: 'shared', path: 's.ts', text: 'process.env.SUPABASE_SERVICE_ROLE_KEY' }]);
  assert.equal(shared.ok, true);
});

test('E8 fingerprint is 8 hex of sha256; dry run never prints the value', async () => {
  const v = 'super-secret-value-123';
  assert.equal(fingerprint(v), createHash('sha256').update(v).digest('hex').slice(0, 8));
  const lines = [];
  const code = await runEnvSwitch(['--surface', 'api', '--target', 'portfolio', '--dest', 'local', '--plan'], {
    getKeys: async () => ({ publishable: 'PUBKEY-abcdef', secret: v }),
    log: (m) => lines.push(String(m)),
    errLog: (m) => lines.push(String(m)),
  });
  assert.equal(code, 0);
  const all = lines.join('\n');
  assert.ok(!all.includes(v));
  assert.ok(!all.includes('PUBKEY-abcdef'));
  assert.ok(all.includes(fingerprint(v)));
  assert.ok(all.includes('SUPABASE_SERVICE_KEY'));
});

test('E9 local destination refuses a path that git does not ignore', async () => {
  assert.throws(() => assertLocalPathIgnored('apps/web/.env.local', () => false), /not ignored/i);
  assert.doesNotThrow(() => assertLocalPathIgnored('apps/web/.env.local', () => true));
  const written = [];
  const code = await runEnvSwitch(['--surface', 'web', '--target', 'portfolio', '--dest', 'local', '--apply'], {
    getKeys: async () => ({ publishable: 'p', secret: 's' }),
    isIgnored: () => false,
    readFile: () => '',
    writeFile: (p, c) => written.push([p, c]),
    log: () => {},
    errLog: () => {},
  });
  assert.equal(code, 1);
  assert.equal(written.length, 0);
});
