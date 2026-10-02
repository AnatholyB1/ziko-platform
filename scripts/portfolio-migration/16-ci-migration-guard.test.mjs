import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, mkdirSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync, spawnSync } from 'node:child_process';
import { lintPortfolioSql, pendingFiles } from './16-ci-migration-guard.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const SCRIPT = join(here, '16-ci-migration-guard.mjs');
const REPO = join(here, '..', '..');

function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'guard-'));
  mkdirSync(join(root, 'supabase', 'migrations'), { recursive: true });
  writeFileSync(join(root, 'supabase', 'migrations', '001_a.sql'), 'select 1;');
  writeFileSync(join(root, 'supabase', 'migrations', '002_b.sql'), 'select 2;');
  return root;
}
const run = (root, ...args) => spawnSync('node', [SCRIPT, '--root', root, ...args], { encoding: 'utf8' });

test('G1 freeze then check-legacy: ok on unchanged, fail on add/modify/delete', () => {
  const root = fixture();
  try {
    const manifest = join(root, 'm.json');
    assert.equal(run(root, '--freeze-legacy', '--out', manifest).status, 0);
    const m = JSON.parse(readFileSync(manifest, 'utf8'));
    assert.equal(m.length, 2);
    assert.deepEqual(m.map((e) => e.file), ['001_a.sql', '002_b.sql']);
    assert.equal(run(root, '--check-legacy', '--manifest', manifest).status, 0);
    writeFileSync(join(root, 'supabase', 'migrations', '003_c.sql'), 'x');
    assert.equal(run(root, '--check-legacy', '--manifest', manifest).status, 1);
    rmSync(join(root, 'supabase', 'migrations', '003_c.sql'));
    writeFileSync(join(root, 'supabase', 'migrations', '001_a.sql'), 'changed');
    assert.equal(run(root, '--check-legacy', '--manifest', manifest).status, 1);
    writeFileSync(join(root, 'supabase', 'migrations', '001_a.sql'), 'select 1;');
    rmSync(join(root, 'supabase', 'migrations', '002_b.sql'));
    assert.equal(run(root, '--check-legacy', '--manifest', manifest).status, 1);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('G2 real portfolio migrations pass lint', () => {
  const dir = join(REPO, 'supabase', 'portfolio-migrations');
  const files = readdirSync(dir).filter((f) => f.endsWith('.sql'));
  assert.equal(files.length >= 5, true);
  for (const f of files) {
    const res = lintPortfolioSql(readFileSync(join(dir, f), 'utf8'));
    assert.deepEqual(res, [], `${f}: ${res.join('; ')}`);
  }
});

test('G3 lint rejects non-ziko objects and passes ziko equivalents', () => {
  const bad = [
    'CREATE TABLE public.habits (id int);',
    'ALTER TABLE habits ADD COLUMN x int;',
    'CREATE POLICY "x" ON public.habits FOR SELECT USING (true);',
    'CREATE FUNCTION public.foo() RETURNS int AS $$ select 1 $$ LANGUAGE sql;',
    'DROP TABLE public.rh_users;',
    'select * from rh_users;',
    'select * from gecko_things;',
    "CREATE FUNCTION public.ziko_f() RETURNS int AS $$ select count(*) from rh_x $$ LANGUAGE sql;",
    "insert into storage.buckets (id, name) values ('avatars', 'avatars');",
  ];
  for (const sql of bad) assert.notDeepEqual(lintPortfolioSql(sql), [], sql);
  const good = [
    'CREATE TABLE public.ziko_habits (id int);',
    'ALTER TABLE ziko_habits ADD COLUMN x int;',
    'CREATE POLICY "ziko_x" ON public.ziko_habits FOR SELECT USING (true);',
    'CREATE FUNCTION public.ziko_foo() RETURNS int AS $$ select 1 $$ LANGUAGE sql;',
    "insert into storage.buckets (id, name) values ('ziko-avatars', 'ziko-avatars');",
    '-- rh_ and gecko_ mentioned in a comment only\nselect 1;',
  ];
  for (const sql of good) assert.deepEqual(lintPortfolioSql(sql), [], sql);
});

test('G4 pendingFiles filters on added and watermark', () => {
  const added = [
    'supabase/portfolio-migrations/20261002160000_old.sql',
    'supabase/portfolio-migrations/20261003100000_b.sql',
    'supabase/portfolio-migrations/20261003090000_a.sql',
    'supabase/migrations/20270101000000_legacy.sql',
    'README.md',
  ];
  assert.deepEqual(pendingFiles({ added, watermark: '20261002160000' }), [
    'supabase/portfolio-migrations/20261003090000_a.sql',
    'supabase/portfolio-migrations/20261003100000_b.sql',
  ]);
  const existing = readdirSync(join(REPO, 'supabase', 'portfolio-migrations'))
    .filter((f) => f.endsWith('.sql'))
    .map((f) => `supabase/portfolio-migrations/${f}`);
  assert.deepEqual(pendingFiles({ added: existing, watermark: '20261002160000' }), []);
});

test('G5 --pending --base uses git diff added files', () => {
  const root = mkdtempSync(join(tmpdir(), 'guardgit-'));
  const git = (...a) => execFileSync('git', a, { cwd: root, encoding: 'utf8' });
  try {
    git('init', '-q');
    git('config', 'user.email', 't@t');
    git('config', 'user.name', 't');
    git('config', 'commit.gpgsign', 'false');
    mkdirSync(join(root, 'supabase', 'portfolio-migrations'), { recursive: true });
    writeFileSync(join(root, 'supabase', 'portfolio-migrations', '20261002160000_old.sql'), 'select 1;');
    writeFileSync(join(root, 'wm'), '20261002160000\n');
    git('add', '.');
    git('commit', '-q', '-m', 'base');
    const base = git('rev-parse', 'HEAD').trim();
    const empty = run(root, '--pending', '--base', base, '--watermark-file', join(root, 'wm'));
    assert.equal(empty.status, 0);
    assert.equal(empty.stdout.trim(), '');
    writeFileSync(join(root, 'supabase', 'portfolio-migrations', '20261003100000_new.sql'), 'select 2;');
    git('add', '.');
    git('commit', '-q', '-m', 'new');
    const out = run(root, '--pending', '--base', base, '--watermark-file', join(root, 'wm'));
    assert.equal(out.status, 0);
    assert.equal(out.stdout.trim(), 'supabase/portfolio-migrations/20261003100000_new.sql');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
