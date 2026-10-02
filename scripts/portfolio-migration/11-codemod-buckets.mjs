#!/usr/bin/env node
// Bucket-name codemod (Phase 5, D-04).
//
// Renames every ziko storage bucket id X to ziko-X across application source,
// driven only by a bucket map file (never a hardcoded list). Storage call sites
// are rewritten to reference a per-deployable STORAGE_BUCKETS constant; in-string
// occurrences and test literals are renamed in place. Anything that matches a
// quoted bucket id but is not in a recognised context fails closed.
//
// Modes: --scan (read-only) | --apply | --check (read-only, repo-wide residual pass)

import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { parseCliArgs, isMain } from '../auth-merge/lib.mjs';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_ROOT = path.resolve(SCRIPT_DIR, '..', '..');
const DEFAULT_MAP = path.join(SCRIPT_DIR, 'bucket-map.generated.json');

export const SCAN_ROOTS = [
  'apps/mobile/app',
  'apps/mobile/src',
  'apps/web/src',
  'backend/api/src',
  'backend/api/test',
  'plugins/*/src',
  'packages/plugin-sdk/src',
  'scripts/exercise-import',
];

// Explicit allowlist of quoted bucket-id lookalikes that are NOT storage buckets.
// file: repo-relative path, or `**/<name>` to match by basename suffix.
// pattern: substring that must appear on the offending line.
export const FALSE_POSITIVES = [
  { file: 'plugins/coach/src/screens/VideoListScreen.tsx', pattern: "queryKey: ['coach-videos'" },
  { file: '**/package.json', pattern: '"exports"' },
  { file: '**/package-lock.json', pattern: '"exports"' },
];

const SKIP_DIRS = new Set(['node_modules', 'dist', '.next']);
const SKIP_PREFIXES = ['apps/web/src/app/api/__live__'];
const CODE_EXT = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs']);
const RESIDUAL_EXT = new Set([...CODE_EXT, '.json', '.sql']);
const RESIDUAL_EXCLUDE_PREFIXES = [
  '.planning/',
  'supabase/migrations/',
  'scripts/portfolio-migration/',
  'scripts/auth-merge/',
  'scripts/purge-test-accounts/',
  'apps/web/src/app/api/__live__/',
];

const CONSTANT_MODULES = {
  backend: 'backend/api/src/config/buckets.ts',
  web: 'apps/web/src/lib/buckets.ts',
  'plugin-sdk': 'packages/plugin-sdk/src/buckets.ts',
};
const PLUGIN_SDK_INDEX = 'packages/plugin-sdk/src/index.ts';
const CONSTANT_SURFACES = new Set(['backend', 'web', 'mobile', 'plugin-sdk']);

const norm = (f) => String(f).replace(/\\/g, '/').replace(/^\.\//, '');
const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export function camelKey(id) {
  return String(id).replace(/-([a-z0-9])/g, (_, c) => c.toUpperCase());
}

function entriesOf(map) {
  if (!map || !Array.isArray(map.buckets) || map.buckets.length === 0) {
    throw new Error('bucket map has no buckets[]');
  }
  return map.buckets.map((b) => ({
    id: b.id,
    target: b.target_id ?? `ziko-${b.id}`,
    key: b.key ?? camelKey(b.id),
  }));
}

function isTestFile(f) {
  return /\.(test|spec)\.[cm]?[jt]sx?$/.test(f) || f.startsWith('backend/api/test/');
}

export function surfaceOf(file) {
  const f = norm(file);
  if (isTestFile(f)) return 'tests';
  if (f.startsWith('backend/api/src/')) return 'backend';
  if (f.startsWith('apps/web/src/')) return 'web';
  if (
    f.startsWith('apps/mobile/app/') ||
    f.startsWith('apps/mobile/src/') ||
    /^plugins\/[^/]+\/src\//.test(f)
  ) {
    return 'mobile';
  }
  if (f.startsWith('packages/plugin-sdk/src/')) return 'plugin-sdk';
  if (f.startsWith('scripts/exercise-import/')) return 'scripts';
  return null;
}

export function importSpecifierFor(file) {
  const f = norm(file);
  switch (surfaceOf(f)) {
    case 'backend': {
      const rel = path.posix.relative(path.posix.dirname(f), 'backend/api/src/config/buckets.js');
      return rel.startsWith('.') ? rel : `./${rel}`;
    }
    case 'web':
      return '@/lib/buckets';
    case 'mobile':
      return '@ziko/plugin-sdk';
    case 'plugin-sdk': {
      const rel = path.posix.relative(path.posix.dirname(f), 'packages/plugin-sdk/src/buckets');
      return rel.startsWith('.') ? rel : `./${rel}`;
    }
    default:
      return null;
  }
}

function isFalsePositive(file, lineText) {
  const f = norm(file);
  return FALSE_POSITIVES.some((fp) => {
    const fileOk = fp.file.startsWith('**/') ? f === fp.file.slice(3) || f.endsWith(fp.file.slice(2)) : f === fp.file;
    return fileOk && lineText.includes(fp.pattern);
  });
}

function buildRegexes(entries) {
  const alt = [...entries.map((e) => e.id)].sort((a, b) => b.length - a.length).map(escapeRe).join('|');
  return {
    quoted: new RegExp(`(['"\`])(${alt})\\1`, 'g'),
    query: new RegExp(`(?<=bucket=)(${alt})(?=[&'"\`\\s]|$)`, 'g'),
    segment: new RegExp(`(?<=/)(${alt})(?=/)`, 'g'),
  };
}

function lineInfo(source, index) {
  const start = source.lastIndexOf('\n', index - 1) + 1;
  let end = source.indexOf('\n', index);
  if (end === -1) end = source.length;
  const line = source.slice(0, index).split('\n').length;
  return { line, text: source.slice(start, end) };
}

const COMMENT_LINE_RE = /^\s*(\/\/|\/\*|\*)/;
const IMPORT_LINE_RE = /^\s*(import\b|export\b[^=]*\bfrom\b|.*\brequire\()/;

function classifyQuoted(source, idx, literalEnd) {
  const before = source.slice(0, idx);
  if (/\.storage\s*\??\.\s*from\(\s*$/.test(before)) return 'storage-from';
  const after = source.slice(literalEnd);
  if (
    /(?:const|let|var)\s+[A-Za-z_$][\w$]*(?:\s*:\s*[^=\n]+)?\s*=\s*$/.test(before) &&
    /^[ \t]*(?:as[ \t]+const[ \t]*)?(?:;|\r?\n|$)/.test(after)
  ) {
    return 'const-decl';
  }
  const open = before.lastIndexOf('[');
  if (open !== -1) {
    const inside = before.slice(open);
    if (/^\[\s*(?:(['"`])[^'"`\n]*\1\s*,\s*)*$/.test(inside)) {
      const head = before.slice(0, open);
      const m = /([A-Za-z_$][\w$]*)\s*(?::[^=\n]+)?=\s*$/.exec(head);
      if (m && /bucket/i.test(m[1])) return 'array-member';
    }
  }
  const call = /([A-Za-z_$][\w$]*)\(\s*$/.exec(before);
  if (call && /bucket/i.test(call[1])) return 'call-arg';
  return 'unclassified';
}

/**
 * Find every occurrence of a bucket id in a quoted/query/path-segment context.
 * Returns [{ kind, id, key, target, line, index, literalStart, literalEnd, quoted }].
 */
export function classifyOccurrences(source, { file, map }) {
  const entries = entriesOf(map);
  const byId = new Map(entries.map((e) => [e.id, e]));
  const re = buildRegexes(entries);
  const test = isTestFile(norm(file));
  const found = new Map();

  const add = (idx, id, quoted, litStart, litEnd) => {
    if (found.has(idx)) return;
    const { line, text } = lineInfo(source, idx);
    const e = byId.get(id);
    let kind;
    if (isFalsePositive(file, text)) kind = 'false-positive';
    else if (test) kind = 'test-literal';
    else if (COMMENT_LINE_RE.test(text)) kind = 'comment';
    else if (quoted) kind = classifyQuoted(source, litStart, litEnd);
    else kind = IMPORT_LINE_RE.test(text) ? 'unclassified' : 'in-string';
    found.set(idx, { kind, id, key: e.key, target: e.target, line, index: idx, literalStart: litStart, literalEnd: litEnd, quoted });
  };

  for (const m of source.matchAll(re.quoted)) add(m.index + 1, m[2], true, m.index, m.index + m[0].length);
  for (const m of source.matchAll(re.query)) add(m.index, m[1], false, m.index, m.index + m[1].length);
  for (const m of source.matchAll(re.segment)) add(m.index, m[1], false, m.index, m.index + m[1].length);

  return [...found.values()].sort((a, b) => a.index - b.index);
}

const CONSTANT_KINDS = new Set(['storage-from', 'const-decl', 'array-member', 'call-arg']);

function lastImportEnd(source) {
  let end = -1;
  const re = /^import\b[\s\S]*?(['"])[^'"\n]+\1[ \t]*;?[ \t]*$/gm;
  for (const m of source.matchAll(re)) end = m.index + m[0].length;
  return end;
}

export function insertImport(source, { file }) {
  const spec = importSpecifierFor(file);
  if (!spec) return source;
  if (/import[^;]*\bSTORAGE_BUCKETS\b[^;]*from/.test(source)) return source;
  const eol = source.includes('\r\n') ? '\r\n' : '\n';

  if (spec === '@ziko/plugin-sdk') {
    const re = /import\s+(?!type\b)\{([^}]*)\}\s*from\s*(['"])@ziko\/plugin-sdk\2/;
    const m = re.exec(source);
    if (m) {
      const inner = m[1];
      const trimmed = inner.replace(/\s+$/, '');
      const tail = inner.slice(trimmed.length);
      const sep = trimmed.endsWith(',') ? ' ' : ', ';
      const replacement = m[0].replace(`{${inner}}`, `{${trimmed}${sep}STORAGE_BUCKETS${tail}}`);
      return source.slice(0, m.index) + replacement + source.slice(m.index + m[0].length);
    }
  }

  const line = `import { STORAGE_BUCKETS } from '${spec}';`;
  const end = lastImportEnd(source);
  if (end !== -1) return source.slice(0, end) + eol + line + source.slice(end);
  const directive = /^(?:\s*(['"])use (?:client|strict)\1;?[ \t]*\r?\n)+/.exec(source);
  const at = directive ? directive[0].length : 0;
  return source.slice(0, at) + line + eol + source.slice(at);
}

export function renderConstantsModule(map) {
  const entries = entriesOf(map);
  const body = entries.map((e) => `  ${e.key}: '${e.target}',`).join('\n');
  return [
    '// Generated by scripts/portfolio-migration/11-codemod-buckets.mjs from bucket-map.generated.json.',
    '// Do not edit by hand.',
    'export const STORAGE_BUCKETS = {',
    body,
    '} as const;',
    '',
    'export type StorageBucket = (typeof STORAGE_BUCKETS)[keyof typeof STORAGE_BUCKETS];',
    '',
  ].join('\n');
}

/** Rewrite one file's source. Throws (fail closed) on any unclassified occurrence. */
export function rewriteSource(source, { file, map }) {
  const occ = classifyOccurrences(source, { file, map });
  const bad = occ.filter((o) => o.kind === 'unclassified');
  if (bad.length) {
    throw new Error(
      `unclassified bucket occurrence(s): ${bad.map((o) => `${norm(file)}:${o.line} ('${o.id}')`).join(', ')}`,
    );
  }
  const useConstant = CONSTANT_SURFACES.has(surfaceOf(file));
  let out = source;
  let usedConstant = false;
  for (const o of [...occ].reverse()) {
    if (o.kind === 'false-positive') continue;
    if (useConstant && CONSTANT_KINDS.has(o.kind)) {
      out = out.slice(0, o.literalStart) + `STORAGE_BUCKETS.${o.key}` + out.slice(o.literalEnd);
      usedConstant = true;
    } else {
      out = out.slice(0, o.index) + o.target + out.slice(o.index + o.id.length);
    }
  }
  return usedConstant ? insertImport(out, { file }) : out;
}

// ---------------------------------------------------------------- CLI helpers

export function loadMap(mapPath) {
  const raw = JSON.parse(fs.readFileSync(mapPath, 'utf8'));
  entriesOf(raw);
  return raw;
}

function walk(dirAbs, rootAbs, out) {
  let items;
  try {
    items = fs.readdirSync(dirAbs, { withFileTypes: true });
  } catch {
    return;
  }
  for (const it of items) {
    const abs = path.join(dirAbs, it.name);
    const rel = norm(path.relative(rootAbs, abs));
    if (it.isDirectory()) {
      if (SKIP_DIRS.has(it.name)) continue;
      if (SKIP_PREFIXES.some((p) => rel === p || rel.startsWith(`${p}/`))) continue;
      walk(abs, rootAbs, out);
    } else if (it.isFile()) {
      out.push(rel);
    }
  }
}

function expandRoots(rootAbs) {
  const roots = [];
  for (const r of SCAN_ROOTS) {
    if (r.includes('*')) {
      const [head, tail] = r.split('*');
      const headAbs = path.join(rootAbs, head);
      let names = [];
      try {
        names = fs.readdirSync(headAbs, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name);
      } catch {
        /* none */
      }
      for (const n of names) roots.push(`${norm(head)}${n}${tail}`);
    } else {
      roots.push(r);
    }
  }
  return roots;
}

export function collectScanFiles(rootAbs) {
  const out = [];
  for (const r of expandRoots(rootAbs)) walk(path.join(rootAbs, r), rootAbs, out);
  return out.filter((f) => CODE_EXT.has(path.extname(f))).sort();
}

function inScanRoots(rel, rootAbs) {
  return expandRoots(rootAbs).some((r) => rel === r || rel.startsWith(`${r}/`));
}

function readText(rootAbs, rel) {
  try {
    const abs = path.join(rootAbs, rel);
    if (fs.statSync(abs).size > 4_000_000) return null;
    return fs.readFileSync(abs, 'utf8');
  } catch {
    return null;
  }
}

function scanTree(rootAbs, map) {
  const files = collectScanFiles(rootAbs);
  const rows = [];
  for (const f of files) {
    const src = readText(rootAbs, f);
    if (src === null) continue;
    const occ = classifyOccurrences(src, { file: f, map });
    if (occ.length) rows.push({ file: f, occ });
  }
  return rows;
}

function printScan(rows, log) {
  const totals = {};
  for (const { file, occ } of rows) {
    const counts = {};
    for (const o of occ) {
      counts[o.kind] = (counts[o.kind] ?? 0) + 1;
      totals[o.kind] = (totals[o.kind] ?? 0) + 1;
    }
    log(`${file}: ${Object.entries(counts).map(([k, v]) => `${k}=${v}`).join(' ')}`);
  }
  const total = Object.values(totals).reduce((a, b) => a + b, 0);
  log(`TOTAL: ${total} occurrence(s) in ${rows.length} file(s) ${JSON.stringify(totals)}`);
  const bad = rows.flatMap(({ file, occ }) => occ.filter((o) => o.kind === 'unclassified').map((o) => `${file}:${o.line}`));
  if (bad.length) {
    log(`UNCLASSIFIED (${bad.length}):`);
    for (const b of bad) log(`  ${b}`);
  }
  return bad;
}

function residualFiles(rootAbs) {
  let files = null;
  if (fs.existsSync(path.join(rootAbs, '.git'))) {
    const r = spawnSync('git', ['ls-files', '-z'], { cwd: rootAbs, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 });
    if (r.status === 0) files = r.stdout.split('\0').filter(Boolean).map(norm);
  }
  if (files === null) {
    files = [];
    walk(rootAbs, rootAbs, files);
  }
  for (const m of Object.values(CONSTANT_MODULES)) if (!files.includes(m)) files.push(m);
  return files.filter((f) => {
    if (!RESIDUAL_EXT.has(path.extname(f))) return false;
    if (f.split('/').some((seg) => SKIP_DIRS.has(seg))) return false;
    return !RESIDUAL_EXCLUDE_PREFIXES.some((p) => f.startsWith(p));
  });
}

function residualScan(rootAbs, map) {
  const entries = entriesOf(map);
  const alt = [...entries.map((e) => e.id)].sort((a, b) => b.length - a.length).map(escapeRe).join('|');
  const re = new RegExp(`(?<=['"\`/=])(?:${alt})(?=['"\`/&?])`, 'g');
  const hits = [];
  for (const f of residualFiles(rootAbs)) {
    const src = readText(rootAbs, f);
    if (src === null) continue;
    const lines = src.split('\n');
    for (let i = 0; i < lines.length; i++) {
      re.lastIndex = 0;
      if (re.test(lines[i]) && !isFalsePositive(f, lines[i])) hits.push(`${f}:${i + 1}`);
    }
  }
  return hits;
}

function runApply(rootAbs, map, log) {
  const rows = scanTree(rootAbs, map);
  const bad = printScan(rows, () => {});
  if (bad.length) {
    log(`refusing --apply: ${bad.length} unclassified occurrence(s):`);
    for (const b of bad) log(`  ${b}`);
    return { code: 1, changed: [] };
  }
  const changed = [];
  for (const f of collectScanFiles(rootAbs)) {
    const src = readText(rootAbs, f);
    if (src === null) continue;
    const next = rewriteSource(src, { file: f, map });
    if (next !== src) {
      fs.writeFileSync(path.join(rootAbs, f), next);
      changed.push(f);
    }
  }
  const content = renderConstantsModule(map);
  for (const rel of Object.values(CONSTANT_MODULES)) {
    const abs = path.join(rootAbs, rel);
    const existing = fs.existsSync(abs) ? fs.readFileSync(abs, 'utf8') : null;
    if (existing !== content) {
      fs.mkdirSync(path.dirname(abs), { recursive: true });
      fs.writeFileSync(abs, content);
      changed.push(existing === null ? `A ${rel}` : rel);
    }
  }
  const idxAbs = path.join(rootAbs, PLUGIN_SDK_INDEX);
  const idxExists = fs.existsSync(idxAbs);
  let idx = idxExists ? fs.readFileSync(idxAbs, 'utf8') : '';
  const eol = idx.includes('\r\n') ? '\r\n' : '\n';
  const add = [];
  if (!/export\s*\{\s*STORAGE_BUCKETS\s*\}\s*from\s*['"]\.\/buckets['"]/.test(idx)) {
    add.push("export { STORAGE_BUCKETS } from './buckets';");
  }
  if (!/export\s+type\s*\{\s*StorageBucket\s*\}\s*from\s*['"]\.\/buckets['"]/.test(idx)) {
    add.push("export type { StorageBucket } from './buckets';");
  }
  if (add.length) {
    if (idx && !idx.endsWith('\n')) idx += eol;
    idx += add.join(eol) + eol;
    fs.mkdirSync(path.dirname(idxAbs), { recursive: true });
    fs.writeFileSync(idxAbs, idx);
    changed.push(idxExists ? PLUGIN_SDK_INDEX : `A ${PLUGIN_SDK_INDEX}`);
  }
  return { code: 0, changed };
}

function runCheck(rootAbs, map, log) {
  const failures = new Set();
  const entries = entriesOf(map);

  // (a) no old ids in recognised (or any) contexts across SCAN_ROOTS
  for (const { file, occ } of scanTree(rootAbs, map)) {
    for (const o of occ) if (o.kind !== 'false-positive') failures.add(`${file}:${o.line} old bucket id '${o.id}' (${o.kind})`);
  }
  // (b) constant modules exist and contain every target id
  for (const rel of Object.values(CONSTANT_MODULES)) {
    const src = readText(rootAbs, rel);
    if (src === null) {
      failures.add(`${rel}: constant module missing`);
      continue;
    }
    for (const e of entries) if (!src.includes(`'${e.target}'`)) failures.add(`${rel}: missing ${e.target}`);
  }
  // (c) every STORAGE_BUCKETS reference imports it
  const moduleSet = new Set([...Object.values(CONSTANT_MODULES), PLUGIN_SDK_INDEX]);
  for (const f of collectScanFiles(rootAbs)) {
    if (moduleSet.has(f)) continue;
    const src = readText(rootAbs, f);
    if (src === null || !/\bSTORAGE_BUCKETS\b/.test(src)) continue;
    if (!/import[^;]*\bSTORAGE_BUCKETS\b[^;]*from/.test(src)) failures.add(`${f}: uses STORAGE_BUCKETS without importing it`);
  }
  // (d) repo-wide residual pass (fail closed outside SCAN_ROOTS too)
  for (const hit of residualScan(rootAbs, map)) failures.add(`${hit} residual old bucket literal`);

  if (failures.size) {
    log(`CHECK FAILED (${failures.size}):`);
    for (const f of [...failures].sort()) log(`  ${f}`);
    return 1;
  }
  log('CHECK OK: no residual old bucket literals; constant modules and imports consistent');
  return 0;
}

export function main(argv, { log = console.log, exit = process.exit } = {}) {
  const args = parseCliArgs(
    argv,
    { map: 'string', root: 'string', scan: 'boolean', apply: 'boolean', check: 'boolean', 'manifest-out': 'string' },
    { exit, log: console.error },
  );
  if (args.help) {
    log('Usage: 11-codemod-buckets.mjs (--scan | --apply | --check) [--map <file>] [--root <dir>] [--manifest-out <file>]');
    return 0;
  }
  const modes = ['scan', 'apply', 'check'].filter((m) => args[m]);
  if (modes.length !== 1) {
    console.error('Specify exactly one of --scan, --apply, --check');
    return 2;
  }
  const mapPath = path.resolve(args.map ?? DEFAULT_MAP);
  if (!fs.existsSync(mapPath)) {
    console.error(`Bucket map not found: ${mapPath}`);
    return 2;
  }
  const rootAbs = path.resolve(args.root ?? DEFAULT_ROOT);
  let map;
  try {
    map = loadMap(mapPath);
  } catch (e) {
    console.error(`Invalid bucket map ${mapPath}: ${e.message}`);
    return 2;
  }

  if (args.scan) {
    return printScan(scanTree(rootAbs, map), log).length ? 1 : 0;
  }
  if (args.apply) {
    const { code, changed } = runApply(rootAbs, map, console.error);
    if (code === 0) {
      log(`changed ${changed.length} file(s)`);
      for (const c of changed) log(`  ${c}`);
      if (args.manifestOut) fs.writeFileSync(args.manifestOut, changed.join('\n') + (changed.length ? '\n' : ''));
    }
    return code;
  }
  return runCheck(rootAbs, map, console.error);
}

if (isMain(import.meta.url)) {
  process.exitCode = main(process.argv.slice(2));
}
