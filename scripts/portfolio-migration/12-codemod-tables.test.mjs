import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
  rewriteSource,
  rewriteSelect,
  functionName,
  buildHintMap,
  loadRenameMap,
  hintQuerySql,
} from './12-codemod-tables.mjs';

const SCRIPT = path.join(path.dirname(fileURLToPath(import.meta.url)), '12-codemod-tables.mjs');

const TABLE_NAMES = [
  'habits',
  'exercises',
  'workout_sessions',
  'user_profiles',
  'coach_client_links',
  'notification_log',
  'ai_conversations',
  'hydration_logs',
  'journal_entries',
  'body_measurements',
];
const FN_SIG = 'deduct_ai_credits(p_user_id uuid, p_kind text)';
const MAP_JSON = {
  tables: Object.fromEntries(TABLE_NAMES.map((t) => [t, `ziko_${t}`])),
  functions: { [FN_SIG]: `ziko_${FN_SIG}` },
  types: {},
  required_extensions: {},
};
const TABLES = new Map(TABLE_NAMES.map((t) => [t, `ziko_${t}`]));
const FUNCTIONS = new Map([['deduct_ai_credits', 'ziko_deduct_ai_credits']]);
const HINTS = { coach_client_links_coach_id_fkey: 'ziko_coach_client_links_coach_id_fkey' };
const HINT_MAP = new Map(Object.entries(HINTS));

const FILE = 'apps/web/src/lib/thing.ts';
const CHAT = 'apps/mobile/app/(auth)/onboarding/ziko-chat.tsx';
const rw = (text, extra = {}) =>
  rewriteSource(text, { file: FILE, tables: TABLES, functions: FUNCTIONS, hintMap: HINT_MAP, ...extra });

test('B1 .from literal in all quote forms and multi-line chain is rewritten', () => {
  assert.equal(rw(`supabase.from('habits').select('*')`).text, `supabase.from('ziko_habits').select('*')`);
  assert.equal(rw(`supabase.from("habits")`).text, `supabase.from("ziko_habits")`);
  assert.equal(rw('supabase.from(`habits`)').text, 'supabase.from(`ziko_habits`)');
  const multi = `await supabase\n  .from('habits')\n  .select('*');`;
  assert.equal(rw(multi).text, multi.replace("'habits'", "'ziko_habits'"));
  assert.equal(rw(multi).unrecognized.length, 0);
});

test('B2 storage .from calls are untouched', () => {
  for (const src of [
    `supabase.storage.from('avatars').upload(a, b)`,
    `supabase.storage.from(STORAGE_BUCKETS.avatars).upload(a, b)`,
    `supabase\n  .storage\n  .from('habits')`,
    `storage\n    .from('habits')`,
  ]) {
    const r = rw(src);
    assert.equal(r.text, src, src);
    assert.equal(r.unrecognized.length, 0, src);
    assert.equal(r.changes, 0, src);
  }
});

test('B3 rpc names are rewritten and functionName strips the signature', () => {
  assert.equal(
    rw(`supabase.rpc('deduct_ai_credits', { p_user_id: id })`).text,
    `supabase.rpc('ziko_deduct_ai_credits', { p_user_id: id })`,
  );
  assert.equal(functionName('deduct_ai_credits(p_user_id uuid, p_kind text)'), 'deduct_ai_credits');
  assert.equal(functionName('plain_name'), 'plain_name');
});

test('B4 embedded selects are aliased at every level', () => {
  const t = (s) => rewriteSelect(s, TABLES, HINT_MAP);
  assert.equal(t('*, exercises(name)').text, '*, exercises:ziko_exercises(name)');
  assert.equal(
    t('workout_sessions!inner(started_at)').text,
    'workout_sessions:ziko_workout_sessions!inner(started_at)',
  );
  assert.equal(
    t('coach:user_profiles!coach_client_links_coach_id_fkey(name)').text,
    'coach:ziko_user_profiles!ziko_coach_client_links_coach_id_fkey(name)',
  );
  assert.equal(
    t('id, habits(id, exercises(name))').text,
    'id, habits:ziko_habits(id, exercises:ziko_exercises(name))',
  );
  const bare = t('habits, exercises, name');
  assert.equal(bare.text, 'habits, exercises, name');
  assert.equal(bare.changes, 0);
  const tpl = rw('q.select(`\n  *,\n  exercises(name),\n  workout_sessions!inner(x)\n`)');
  assert.equal(tpl.text, 'q.select(`\n  *,\n  exercises:ziko_exercises(name),\n  workout_sessions:ziko_workout_sessions!inner(x)\n`)');
  assert.equal(tpl.unrecognized.length, 0);
  const viaSource = rw(`q.select('*, exercises(name)')`);
  assert.equal(viaSource.text, `q.select('*, exercises:ziko_exercises(name)')`);
});

test('B5 unknown constraint hints fail closed, modifiers and column hints are kept', () => {
  const bad = rewriteSelect('exercises!mystery_fkey(name)', TABLES, HINT_MAP);
  assert.equal(bad.unrecognized.length, 1);
  const left = rewriteSelect('exercises!left(name)', TABLES, HINT_MAP);
  assert.equal(left.text, 'exercises:ziko_exercises!left(name)');
  assert.equal(left.unrecognized.length, 0);
  const col = rewriteSelect('exercises!user_id(name)', TABLES, HINT_MAP);
  assert.equal(col.text, 'exercises:ziko_exercises!user_id(name)');
  assert.equal(col.unrecognized.length, 0);
  assert.equal(rw(`q.select('*, exercises!mystery_fkey(name)')`).unrecognized.length, 1);
});

test('B6 filter paths and foreign table options are untouched and not reported', () => {
  for (const src of [
    `q.eq('workout_sessions.user_id', id)`,
    `q.order('name', { foreignTable: 'exercises' })`,
    `q.order('name', { referencedTable: 'exercises' })`,
  ]) {
    const r = rw(src);
    assert.equal(r.text, src, src);
    assert.equal(r.unrecognized.length, 0, src);
  }
});

test('B7 realtime table is rewritten', () => {
  const src = `ch.on('postgres_changes', { event: '*', schema: 'public', table: 'notification_log' }, cb)`;
  const r = rw(src);
  assert.equal(r.text, src.replace("'notification_log'", "'ziko_notification_log'"));
  assert.equal(r.unrecognized.length, 0);
});

test('B8 public.<table> in strings is rewritten, bare SQL FROM is unrecognized', () => {
  const r = rw(`const q = 'SELECT 1 FROM public.coach_client_links WHERE a'`);
  assert.equal(r.text, `const q = 'SELECT 1 FROM public.ziko_coach_client_links WHERE a'`);
  assert.equal(r.unrecognized.length, 0);
  const bare = rw(`const q = 'SELECT 1 FROM coach_client_links WHERE a'`);
  assert.equal(bare.unrecognized.length, 1);
});

test('B9 query keys are untouched and not reported', () => {
  for (const src of [
    `useQuery({ queryKey: ['habits', userId], queryFn })`,
    `qc.invalidateQueries({ queryKey: ['habits'] })`,
    `qc.setQueryData(['habits', id], x)`,
    `qc.getQueryData(['habits'])`,
  ]) {
    const r = rw(src);
    assert.equal(r.text, src, src);
    assert.equal(r.unrecognized.length, 0, src);
    assert.equal(r.changes, 0, src);
  }
});

test('B10 literal-rewrite files rewrite every exact table literal including unions', () => {
  const src = [
    `type T = 'hydration_logs' | 'journal_entries' | 'body_measurements';`,
    `const m = { table: 'hydration_logs' };`,
    `await supabase.from('ai_conversations').select('*');`,
  ].join('\n');
  const r = rewriteSource(src, { file: CHAT, tables: TABLES, functions: FUNCTIONS, hintMap: HINT_MAP });
  assert.equal(r.unrecognized.length, 0);
  assert.match(r.text, /'ziko_hydration_logs' \| 'ziko_journal_entries' \| 'ziko_body_measurements'/);
  assert.match(r.text, /table: 'ziko_hydration_logs'/);
  assert.match(r.text, /from\('ziko_ai_conversations'\)/);
});

test('B11 stray table literal is unrecognized; false positive suppresses; apply writes nothing', () => {
  const src = `const t = 'habits';`;
  const r = rw(src);
  assert.equal(r.unrecognized.length, 1);
  assert.equal(r.text, src);
  const fp = rw(src, { falsePositives: [{ file: FILE, pattern: "const t = 'habits'" }] });
  assert.equal(fp.unrecognized.length, 0);

  const tmp = makeTree({
    'backend/api/src/ok.ts': `supabase.from('habits').select('*');\n`,
    'backend/api/src/bad.ts': `const t = 'habits';\n`,
  });
  const run = cli(['--apply'], tmp);
  assert.equal(run.status, 1);
  assert.equal(fs.readFileSync(path.join(tmp, 'backend/api/src/ok.ts'), 'utf8'), `supabase.from('habits').select('*');\n`);
});

test('B12 dynamic .from arguments are unrecognized unless allowlisted', () => {
  assert.equal(rw(`supabase.from(variable)`).unrecognized.length, 1);
  assert.equal(rw('supabase.from(`${x}`)').unrecognized.length, 1);
  assert.equal(rw(`const a = Array.from(items)`).unrecognized.length, 0);
  assert.equal(rw(`gsap.from(ref.current, { y: 1 }); gsap.from('.card')`).unrecognized.length, 0);
  const ok = rw(`supabase.from(variable)`, { falsePositives: [{ file: FILE, pattern: '.from(variable)' }] });
  assert.equal(ok.unrecognized.length, 0);
});

test('B13 .from literal outside the map is unrecognized', () => {
  assert.equal(rw(`supabase.from('rh_users')`).unrecognized.length, 1);
});

test('B14 rewriting is idempotent', () => {
  const src = [
    `supabase.from('ziko_habits').select('*, exercises:ziko_exercises(name)');`,
    `supabase.rpc('ziko_deduct_ai_credits');`,
    `supabase.from('habits').select('*, exercises(name)');`,
    `supabase.rpc('deduct_ai_credits');`,
  ].join('\n');
  const first = rw(src);
  const second = rw(first.text);
  assert.equal(second.text, first.text);
  assert.equal(second.changes, 0);
  assert.equal(second.unrecognized.length, 0);
  const clean = rw(`supabase.from('ziko_habits'); supabase.rpc('ziko_deduct_ai_credits')`);
  assert.equal(clean.changes, 0);
});

test('B15 --check flags residuals and ignores excluded paths and comments', () => {
  const dirty = (files) => {
    const tmp = makeTree(files);
    return cli(['--check'], tmp).status;
  };
  assert.equal(dirty({ 'apps/web/src/a.ts': `supabase.from('habits')\n` }), 1);
  assert.equal(dirty({ 'apps/web/src/a.ts': `supabase.rpc('deduct_ai_credits')\n` }), 1);
  assert.equal(dirty({ 'apps/web/src/a.ts': `q.select('*, ziko_exercises(name)')\n` }), 1);
  assert.equal(
    dirty({
      'apps/web/src/a.ts': `supabase.from('ziko_habits').select('*, exercises:ziko_exercises(name)')\n`,
      'scripts/portfolio-migration/x.mjs': `supabase.from('habits')\n`,
      '.planning/x.ts': `supabase.from('habits')\n`,
      'apps/web/src/b.ts': `// supabase.from('habits')\n/* supabase.from('habits')\n supabase.rpc('deduct_ai_credits') */\n`,
    }),
    0,
  );
});

test('B16 buildHintMap matches constraints across projects', () => {
  const src = [{ table: 'coach_client_links', constraint: 'ccl_coach_fkey', columns: ['coach_id'], ref_table: 'user_profiles' }];
  const tgt = [
    { table: 'ziko_coach_client_links', constraint: 'ziko_ccl_coach_fkey', columns: ['coach_id'], ref_table: 'ziko_user_profiles' },
    { table: 'ziko_coach_client_links', constraint: 'ziko_ccl_client_fkey', columns: ['client_id'], ref_table: 'ziko_user_profiles' },
    { table: 'other', constraint: 'o_fkey', columns: ['coach_id'], ref_table: 'ziko_user_profiles' },
  ];
  assert.deepEqual(buildHintMap(src, tgt), { ccl_coach_fkey: 'ziko_ccl_coach_fkey' });
  assert.throws(() => buildHintMap(src, []), /no portfolio constraint/i);
  assert.throws(
    () => buildHintMap(src, [tgt[0], { ...tgt[0], constraint: 'dup_fkey' }]),
    /ambiguous/i,
  );
});

test('B17 CLI argument validation and read-only hint SQL', () => {
  const tmp = makeTree({});
  assert.equal(cli([], tmp).status, 2);
  assert.equal(spawnSync(process.execPath, [SCRIPT, '--gen-hints'], { encoding: 'utf8' }).status, 2);
  assert.equal(
    spawnSync(process.execPath, [SCRIPT, '--gen-hints', '--source-ref', 'abcdefghijklmnopqrst'], { encoding: 'utf8' }).status,
    2,
  );
  const sql = hintQuerySql();
  assert.match(sql.trimStart(), /^SELECT\b/i);
  assert.doesNotMatch(sql, /\b(INSERT|UPDATE|DELETE|ALTER|DROP|CREATE|TRUNCATE|GRANT)\b/i);
  assert.equal(sql.split(';').filter((s) => s.trim()).length, 1);
});

test('loadRenameMap reads tables and functions from the generated map file', () => {
  const tmp = makeTree({});
  const { tables, functions } = loadRenameMap(path.join(tmp, 'map.json'));
  assert.equal(tables.get('habits'), 'ziko_habits');
  assert.equal(functions.get('deduct_ai_credits'), 'ziko_deduct_ai_credits');
});

// ------------------------------------------------------------------ helpers

function makeTree(files) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'codemod-tables-'));
  fs.writeFileSync(path.join(tmp, 'map.json'), JSON.stringify(MAP_JSON));
  fs.writeFileSync(path.join(tmp, 'hints.json'), JSON.stringify({ hints: HINTS }));
  for (const [rel, content] of Object.entries(files)) {
    const abs = path.join(tmp, rel);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, content);
  }
  return tmp;
}

function cli(args, tmp) {
  return spawnSync(
    process.execPath,
    [SCRIPT, ...args, '--root', tmp, '--map', path.join(tmp, 'map.json'), '--hint-map', path.join(tmp, 'hints.json')],
    { encoding: 'utf8' },
  );
}
