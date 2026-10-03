#!/usr/bin/env node
// Table-name codemod (Phase 6, D-17).
//
// Renames every ziko table X to ziko_X (and every RPC to its ziko_ name) across
// application source, driven only by rename-map.generated.json (tables{} and
// functions{}), never a hardcoded list. Handled contexts: .from('t'), .rpc('f'),
// embedded selects (rewritten with an alias that preserves the response key, e.g.
// exercises(name) -> exercises:ziko_exercises(name)), realtime `table:` literals,
// `public.<t>` inside strings, and exact table literals in REWRITE_LITERAL_FILES.
// Storage .from() calls, TanStack query keys and filter paths are never touched.
// Any other quoted literal equal to a mapped name, any dynamic .from() argument,
// any unmapped .from() literal and any unknown !constraint hint fails closed:
// it is reported as unrecognized and --apply writes nothing.
//
// Modes: --scan (read-only) | --apply | --check (read-only, repo-wide residual pass)
//        | --gen-hints --source-ref <ref> --project-ref <ref> (read-only catalog queries)

import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { parseCliArgs, isMain, runSql, assertProjectRefFormat } from '../auth-merge/lib.mjs';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_ROOT = path.resolve(SCRIPT_DIR, '..', '..');
const DEFAULT_MAP = path.join(SCRIPT_DIR, 'rename-map.generated.json');
const DEFAULT_HINT_MAP = path.join(SCRIPT_DIR, 'fkey-hint-map.generated.json');

export const SCAN_ROOTS = [
  'apps/mobile/app',
  'apps/mobile/src',
  'apps/web/src',
  'apps/web/test',
  'backend/api/src',
  'backend/api/test',
  'plugins/*/src',
  'packages/*/src',
  'scripts/exercise-import',
];

// Files where EVERY exact table-name literal is rewritten (dynamic table maps / unions).
export const REWRITE_LITERAL_FILES = ['apps/mobile/app/(auth)/onboarding/ziko-chat.tsx'];

// Explicit allowlist of lookalikes that are NOT table usages.
// file: repo-relative path, or `**/<name>` to match by basename suffix.
// pattern: substring that must appear on the offending line.
export const FALSE_POSITIVES = [
  // ziko-chat resolves the table from MICRO_ACTION_MAP whose literals are rewritten in-file.
  { file: 'apps/mobile/app/(auth)/onboarding/ziko-chat.tsx', pattern: '.from(mapping.table)' },
];

const SKIP_DIRS = new Set(['node_modules', 'dist', '.next', '.git']);
const CODE_EXT = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs']);
export const RESIDUAL_EXCLUDE_PREFIXES = [
  '.planning/',
  'supabase/',
  'node_modules/',
  'scripts/portfolio-migration/',
  'scripts/auth-merge/',
  'scripts/purge-test-accounts/',
  'scripts/waitlist-erasure/', // Phase 7 follow-up: operates on ziko by ref (SUPABASE_URL env)
  'scripts/food-data/', // Phase 7 follow-up: operates on ziko by ref (SUPABASE_URL env)
];

const norm = (f) => String(f).replace(/\\/g, '/').replace(/^\.\//, '');
const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const asMap = (m) => (m instanceof Map ? m : new Map(Object.entries(m ?? {})));
const altOf = (names) => [...names].sort((a, b) => b.length - a.length).map(escapeRe).join('|');

// ------------------------------------------------------------------ map loading

/** 'deduct_ai_credits(p_user_id uuid)' -> 'deduct_ai_credits' */
export function functionName(signature) {
  const s = String(signature);
  const i = s.indexOf('(');
  return i === -1 ? s : s.slice(0, i);
}

export function loadRenameMap(mapPath) {
  const raw = JSON.parse(fs.readFileSync(mapPath, 'utf8'));
  const tables = new Map(Object.entries(raw.tables ?? {}));
  if (tables.size === 0) throw new Error('rename map has no tables{}');
  const functions = new Map();
  for (const [oldSig, newSig] of Object.entries(raw.functions ?? {})) {
    functions.set(functionName(oldSig), functionName(newSig));
  }
  return { tables, functions };
}

function loadHintMap(hintPath) {
  if (!fs.existsSync(hintPath)) return new Map();
  const raw = JSON.parse(fs.readFileSync(hintPath, 'utf8'));
  return new Map(Object.entries(raw.hints ?? {}));
}

// ------------------------------------------------------------------ embedded selects

const JOIN_MODIFIERS = new Set(['inner', 'left', 'right', 'full']);
const EMBED_RE = /(?<![\w$.:!])((?:[A-Za-z_]\w*:)?)([A-Za-z_]\w*)((?:![A-Za-z_]\w*)*)\(/g;

/**
 * Rewrite embedded resources in a PostgREST select string.
 * Returns { text, changes, unrecognized: string[], unaliased: number }.
 */
export function rewriteSelect(selectText, tables, hintMap = new Map()) {
  const t = asMap(tables);
  const h = asMap(hintMap);
  const targets = new Set(t.values());
  const hintTargets = new Set(h.values());
  let changes = 0;
  let unaliased = 0;
  const unrecognized = [];
  const text = String(selectText).replace(EMBED_RE, (full, alias, name, hints) => {
    if (t.has(name)) {
      let outHints = '';
      for (const hint of hints.split('!').filter(Boolean)) {
        if (JOIN_MODIFIERS.has(hint) || hintTargets.has(hint)) outHints += `!${hint}`;
        else if (h.has(hint)) outHints += `!${h.get(hint)}`;
        else {
          if (/_fkey$/.test(hint)) unrecognized.push(`unknown constraint hint '${hint}' on embed '${name}'`);
          outHints += `!${hint}`; // column hint (or unknown, already reported)
        }
      }
      changes++;
      return `${alias || `${name}:`}${t.get(name)}${outHints}(`;
    }
    if (!alias && targets.has(name)) unaliased++;
    return full;
  });
  return { text, changes, unrecognized, unaliased };
}

// ------------------------------------------------------------------ lexer

function lex(src) {
  const n = src.length;
  const tokens = [];
  const comments = [];
  const REGEX_PREV = new Set([...'(,=:[!&|?{};+-*%~^']);

  function scanString(i, q) {
    let j = i + 1;
    while (j < n) {
      const c = src[j];
      if (c === '\\') {
        j += 2;
        continue;
      }
      if (c === '\n') return -1;
      if (c === q) return j + 1;
      j++;
    }
    return -1;
  }

  function scanTemplate(i) {
    let j = i + 1;
    let interp = false;
    while (j < n) {
      const c = src[j];
      if (c === '\\') {
        j += 2;
        continue;
      }
      if (c === '`') {
        tokens.push({ start: i, end: j + 1, quote: '`', value: src.slice(i + 1, j), interp });
        return j + 1;
      }
      if (c === '$' && src[j + 1] === '{') {
        interp = true;
        j = scanCode(j + 2, true) + 1;
        continue;
      }
      j++;
    }
    return n;
  }

  function scanCode(start, stopAtBrace) {
    let i = start;
    let depth = 0;
    let last = '';
    while (i < n) {
      const c = src[i];
      const d = src[i + 1];
      if (c === '/' && d === '/') {
        const e = src.indexOf('\n', i);
        const end = e === -1 ? n : e;
        comments.push([i, end]);
        i = end;
        continue;
      }
      if (c === '/' && d === '*') {
        const e = src.indexOf('*/', i + 2);
        const end = e === -1 ? n : e + 2;
        comments.push([i, end]);
        i = end;
        continue;
      }
      if (c === "'" || c === '"') {
        const e = scanString(i, c);
        if (e === -1) {
          i++;
          last = c;
          continue;
        }
        tokens.push({ start: i, end: e, quote: c, value: src.slice(i + 1, e - 1), interp: false });
        i = e;
        last = c;
        continue;
      }
      if (c === '`') {
        i = scanTemplate(i);
        last = '`';
        continue;
      }
      if (c === '/' && (last === '' || REGEX_PREV.has(last))) {
        let j = i + 1;
        let cls = false;
        while (j < n) {
          const x = src[j];
          if (x === '\\') {
            j += 2;
            continue;
          }
          if (x === '\n') break;
          if (x === '[') cls = true;
          else if (x === ']') cls = false;
          else if (x === '/' && !cls) break;
          j++;
        }
        if (src[j] === '/') {
          i = j + 1;
          last = ')';
          continue;
        }
      }
      if (stopAtBrace) {
        if (c === '{') depth++;
        else if (c === '}') {
          if (depth === 0) return i;
          depth--;
        }
      }
      if (!/\s/.test(c)) last = c;
      i++;
    }
    return i;
  }

  scanCode(0, false);
  tokens.sort((a, b) => a.start - b.start);

  // masked: same length as src; comments and string contents blanked (newlines kept)
  const chars = src.split('');
  const blank = (s, e) => {
    for (let k = s; k < e; k++) if (chars[k] !== '\n' && chars[k] !== '\r') chars[k] = ' ';
  };
  for (const [s, e] of comments) blank(s, e);
  for (const tk of tokens) blank(tk.start + 1, tk.end - 1);
  return { tokens, masked: chars.join('') };
}

// ------------------------------------------------------------------ rewrite

function isFalsePositive(file, lineText, fps) {
  const f = norm(file);
  return fps.some((fp) => {
    const fileOk = fp.file.startsWith('**/') ? f === fp.file.slice(3) || f.endsWith(fp.file.slice(2)) : f === fp.file;
    return fileOk && lineText.includes(fp.pattern);
  });
}

const QUERY_KEY_RE = /(?:\bqueryKey\s*[:=]\s*|\b\w*Quer(?:y|ies)\w*\(\s*(?:\{\s*queryKey\s*:\s*)?)\[\s*$/;
const FILTER_OPTION_RE = /\b(?:foreignTable|referencedTable)\s*:\s*$/;

function isStorageOrStatic(head) {
  const h = head.trimEnd();
  if (/(^|[^\w$])storage\s*\??$/.test(h)) return true; // storage.from / supabase.storage.from
  if (/(^|[^\w$])[A-Z][A-Za-z0-9_$]*$/.test(h)) return true; // Array.from, Buffer.from, ...
  if (/(^|[^\w$])(?:gsap|tl|timeline)$/.test(h)) return true; // GSAP animation .from(), not a table
  return false;
}

/**
 * Rewrite one file's source.
 * Returns { text, changes, unrecognized: string[], unaliased: string[] }.
 */
export function rewriteSource(
  source,
  { file, tables, functions = new Map(), hintMap = new Map(), falsePositives = FALSE_POSITIVES },
) {
  const t = asMap(tables);
  const fns = asMap(functions);
  const f = norm(file);
  const literalFile = REWRITE_LITERAL_FILES.includes(f);
  const names = new Set([...t.keys(), ...fns.keys()]);
  const publicRe = new RegExp(`\\bpublic\\.(${altOf(names)})(?![\\w])`, 'g');
  const sqlFromRe = new RegExp(`\\b(?:FROM|JOIN|INTO|UPDATE)\\s+(?:${altOf(t.keys())})(?![\\w])`);
  const { tokens, masked } = lex(source);

  const lineStarts = [0];
  for (let i = 0; i < source.length; i++) if (source[i] === '\n') lineStarts.push(i + 1);
  const lineOf = (idx) => {
    let lo = 0;
    let hi = lineStarts.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (lineStarts[mid] <= idx) lo = mid;
      else hi = mid - 1;
    }
    return lo + 1;
  };
  const lineText = (idx) => {
    const ln = lineOf(idx);
    const s = lineStarts[ln - 1];
    const e = source.indexOf('\n', s);
    return source.slice(s, e === -1 ? source.length : e);
  };

  const edits = [];
  const unrecognized = [];
  const unaliased = [];
  let changes = 0;
  const flag = (idx, msg) => {
    if (isFalsePositive(file, lineText(idx), falsePositives)) return;
    unrecognized.push(`${f}:${lineOf(idx)}: ${msg}`);
  };
  const edit = (tok, value) => {
    if (value !== tok.value) edits.push({ start: tok.start + 1, end: tok.end - 1, value });
  };

  for (const tok of tokens) {
    const mBefore = masked.slice(Math.max(0, tok.start - 400), tok.start);
    const v = tok.value;
    let m;

    if (/\.rpc\(\s*$/.test(mBefore)) {
      if (tok.interp) flag(tok.start, 'dynamic .rpc() argument');
      else if (fns.has(v)) {
        edit(tok, fns.get(v));
        changes++;
      } else if (!v.startsWith('ziko_')) flag(tok.start, `.rpc('${v}') is not in the rename map`);
      continue;
    }

    if ((m = /\.from\(\s*$/.exec(mBefore))) {
      if (isStorageOrStatic(mBefore.slice(0, m.index))) continue;
      if (tok.interp) flag(tok.start, 'dynamic .from() argument');
      else if (t.has(v)) {
        edit(tok, t.get(v));
        changes++;
      } else if (!v.startsWith('ziko_')) flag(tok.start, `.from('${v}') is not in the rename map`);
      continue;
    }

    if (/\.select\(\s*$/.test(mBefore)) {
      if (tok.interp) {
        if (rewriteSelect(v, t, hintMap).changes > 0) flag(tok.start, 'interpolated select contains an embedded table');
        continue;
      }
      const r = rewriteSelect(v, t, hintMap);
      for (const u of r.unrecognized) flag(tok.start, u);
      if (r.unaliased) unaliased.push(`${f}:${lineOf(tok.start)}: unaliased ziko_ embed`);
      edit(tok, r.text);
      changes += r.changes;
      continue;
    }

    if (/\btable\s*:\s*$/.test(mBefore) && /postgres_changes/.test(source.slice(Math.max(0, tok.start - 400), tok.start))) {
      if (t.has(v)) {
        edit(tok, t.get(v));
        changes++;
      } else if (!v.startsWith('ziko_')) flag(tok.start, `realtime table '${v}' is not in the rename map`);
      continue;
    }

    // ---- generic literal
    const sel = v.includes('(') || v.includes('!') ? rewriteSelect(v, t, hintMap) : null;
    if (sel?.unaliased) unaliased.push(`${f}:${lineOf(tok.start)}: unaliased ziko_ embed`);
    if (QUERY_KEY_RE.test(mBefore) || FILTER_OPTION_RE.test(mBefore)) continue;

    if (!tok.interp && t.has(v)) {
      if (literalFile) {
        edit(tok, t.get(v));
        changes++;
      } else flag(tok.start, `table literal '${v}' in an unrecognized context`);
      continue;
    }

    let next = v.replace(publicRe, (_, name) => {
      changes++;
      return `public.${t.get(name) ?? fns.get(name)}`;
    });
    edit(tok, next);
    if (sqlFromRe.test(next)) flag(tok.start, 'bare SQL table reference in a string (use public.<table>)');
    if (sel && sel.changes > 0) flag(tok.start, 'embedded select in an unrecognized context');
  }

  // dynamic (non-literal) .from( / .rpc( arguments
  for (const m of masked.matchAll(/\.(from|rpc)\(\s*(?=[^\s'"`)])/g)) {
    if (m[1] === 'from' && isStorageOrStatic(masked.slice(Math.max(0, m.index - 200), m.index))) continue;
    flag(m.index, `dynamic .${m[1]}() argument`);
  }

  let out = source;
  for (const e of edits.sort((a, b) => b.start - a.start)) out = out.slice(0, e.start) + e.value + out.slice(e.end);
  return { text: out, changes, unrecognized, unaliased };
}

// ------------------------------------------------------------------ FK hint map

/** Read-only catalog query: one row per public foreign key constraint. */
export function hintQuerySql() {
  return [
    'SELECT cl.relname AS "table", c.conname AS "constraint",',
    '  (SELECT array_agg(a.attname ORDER BY k.ord)',
    '     FROM unnest(c.conkey) WITH ORDINALITY AS k(attnum, ord)',
    '     JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = k.attnum) AS "columns",',
    '  rcl.relname AS ref_table, rn.nspname AS ref_schema',
    'FROM pg_constraint c',
    'JOIN pg_class cl ON cl.oid = c.conrelid',
    'JOIN pg_namespace n ON n.oid = cl.relnamespace',
    'JOIN pg_class rcl ON rcl.oid = c.confrelid',
    'JOIN pg_namespace rn ON rn.oid = rcl.relnamespace',
    "WHERE c.contype = 'f' AND n.nspname = 'public'",
    'ORDER BY 1, 2',
  ].join('\n');
}

// The Supabase CLI returns array_agg as Postgres array text ("{a,b}"), not a JSON array.
const colKey = (cols) =>
  (Array.isArray(cols)
    ? cols
    : typeof cols === 'string'
      ? cols.replace(/^\{|\}$/g, '').split(',').filter(Boolean)
      : []
  ).join(',');

/**
 * Match each ziko FK constraint X on T(cols)->R to the portfolio constraint on
 * ziko_T(cols)->ziko_R. Returns { X: portfolioName }. Throws on missing/ambiguous.
 */
export function buildHintMap(sourceRows, targetRows) {
  const out = {};
  for (const s of sourceRows) {
    // FKs into other schemas (e.g. auth.users) keep their referenced table name; only public refs are prefixed.
    const expectedRef = s.ref_schema && s.ref_schema !== 'public' ? s.ref_table : `ziko_${s.ref_table}`;
    const cands = targetRows.filter(
      (r) => r.table === `ziko_${s.table}` && r.ref_table === expectedRef && colKey(r.columns) === colKey(s.columns),
    );
    if (cands.length === 0) {
      throw new Error(`no portfolio constraint matches ${s.table}.${s.constraint} (${colKey(s.columns)} -> ${s.ref_table})`);
    }
    if (cands.length > 1) {
      throw new Error(`ambiguous portfolio match for ${s.table}.${s.constraint}: ${cands.map((c) => c.constraint).join(', ')}`);
    }
    const name = cands[0].constraint;
    if (out[s.constraint] !== undefined && out[s.constraint] !== name) {
      throw new Error(`ambiguous: constraint name ${s.constraint} maps to both ${out[s.constraint]} and ${name}`);
    }
    out[s.constraint] = name;
  }
  return out;
}

// ------------------------------------------------------------------ file walking

function walk(dirAbs, rootAbs, out) {
  let items;
  try {
    items = fs.readdirSync(dirAbs, { withFileTypes: true });
  } catch {
    return;
  }
  for (const it of items) {
    const abs = path.join(dirAbs, it.name);
    if (it.isDirectory()) {
      if (SKIP_DIRS.has(it.name)) continue;
      walk(abs, rootAbs, out);
    } else if (it.isFile()) {
      out.push(norm(path.relative(rootAbs, abs)));
    }
  }
}

function expandRoots(rootAbs) {
  const roots = [];
  for (const r of SCAN_ROOTS) {
    if (r.includes('*')) {
      const [head, tail] = r.split('*');
      let dirs = [];
      try {
        dirs = fs.readdirSync(path.join(rootAbs, head), { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name);
      } catch {
        /* none */
      }
      for (const d of dirs) roots.push(`${norm(head)}${d}${tail}`);
    } else roots.push(r);
  }
  return roots;
}

export function collectScanFiles(rootAbs) {
  const out = [];
  for (const r of expandRoots(rootAbs)) walk(path.join(rootAbs, r), rootAbs, out);
  return out.filter((f) => CODE_EXT.has(path.extname(f))).sort();
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
  return files
    .filter((f) => CODE_EXT.has(path.extname(f)))
    .filter((f) => !f.split('/').some((seg) => SKIP_DIRS.has(seg)))
    .filter((f) => !RESIDUAL_EXCLUDE_PREFIXES.some((p) => f.startsWith(p)))
    .sort();
}

// ------------------------------------------------------------------ CLI modes

function analyze(rootAbs, files, ctx) {
  const rows = [];
  for (const file of files) {
    const src = readText(rootAbs, file);
    if (src === null) continue;
    rows.push({ file, src, ...rewriteSource(src, { file, ...ctx }) });
  }
  return rows;
}

function runScan(rootAbs, ctx, log) {
  const rows = analyze(rootAbs, collectScanFiles(rootAbs), ctx);
  let total = 0;
  let touched = 0;
  const bad = [];
  for (const r of rows) {
    if (r.changes || r.unrecognized.length) {
      log(`${r.file}: changes=${r.changes} unrecognized=${r.unrecognized.length}`);
    }
    total += r.changes;
    if (r.changes) touched++;
    bad.push(...r.unrecognized);
  }
  log(`TOTAL: ${total} change(s) in ${touched} file(s); ${bad.length} unrecognized`);
  if (bad.length) {
    log(`UNRECOGNIZED (${bad.length}):`);
    for (const b of bad) log(`  ${b}`);
  }
  return { code: bad.length ? 1 : 0, rows };
}

function runApply(rootAbs, ctx, log, errLog) {
  const { rows } = runScan(rootAbs, ctx, () => {});
  const bad = rows.flatMap((r) => r.unrecognized);
  if (bad.length) {
    errLog(`refusing --apply: ${bad.length} unrecognized item(s):`);
    for (const b of bad) errLog(`  ${b}`);
    return { code: 1, changed: [] };
  }
  const changed = [];
  for (const r of rows) {
    if (r.text !== r.src) {
      fs.writeFileSync(path.join(rootAbs, r.file), r.text);
      changed.push(r.file);
    }
  }
  log(`changed ${changed.length} file(s), ${rows.reduce((a, r) => a + r.changes, 0)} change(s)`);
  for (const c of changed) log(`  ${c}`);
  return { code: 0, changed };
}

function runCheck(rootAbs, ctx, errLog, log) {
  const failures = [];
  for (const r of analyze(rootAbs, residualFiles(rootAbs), ctx)) {
    if (r.changes) failures.push(`${r.file}: ${r.changes} unprefixed table/RPC/embed reference(s)`);
    failures.push(...r.unrecognized, ...r.unaliased);
  }
  if (failures.length) {
    errLog(`CHECK FAILED (${failures.length}):`);
    for (const x of failures) errLog(`  ${x}`);
    return 1;
  }
  log('CHECK OK: no residual unprefixed table/RPC/embed references');
  return 0;
}

async function runGenHints(args, log) {
  assertProjectRefFormat(args.sourceRef);
  assertProjectRefFormat(args.projectRef);
  const sql = hintQuerySql();
  const source = await runSql(args.sourceRef, sql);
  const target = await runSql(args.projectRef, sql);
  const hints = buildHintMap(source, target);
  const out = path.resolve(args.hintOut ?? DEFAULT_HINT_MAP);
  fs.writeFileSync(out, `${JSON.stringify({ hints }, null, 2)}\n`);
  log(`wrote ${Object.keys(hints).length} hint(s) to ${out}`);
  return 0;
}

export async function main(argv, { log = console.log, exit = process.exit } = {}) {
  const args = parseCliArgs(
    argv,
    {
      map: 'string',
      'hint-map': 'string',
      root: 'string',
      scan: 'boolean',
      apply: 'boolean',
      check: 'boolean',
      'gen-hints': 'boolean',
      'source-ref': 'string',
      'project-ref': 'string',
      'hint-out': 'string',
      'manifest-out': 'string',
    },
    { exit, log: console.error },
  );
  if (args.help) {
    log(
      'Usage: 12-codemod-tables.mjs (--scan | --apply | --check | --gen-hints --source-ref <ref> --project-ref <ref>)\n' +
        '       [--map <file>] [--hint-map <file>] [--root <dir>] [--hint-out <file>] [--manifest-out <file>]',
    );
    return 0;
  }
  const modes = ['scan', 'apply', 'check', 'genHints'].filter((m) => args[m]);
  if (modes.length !== 1) {
    console.error('Specify exactly one of --scan, --apply, --check, --gen-hints');
    return 2;
  }
  if (args.genHints) {
    if (!args.sourceRef || !args.projectRef) {
      console.error('--gen-hints requires --source-ref <ref> and --project-ref <ref>');
      return 2;
    }
    try {
      return await runGenHints(args, log);
    } catch (e) {
      console.error(`gen-hints failed: ${e.message}`);
      return 1;
    }
  }
  const mapPath = path.resolve(args.map ?? DEFAULT_MAP);
  if (!fs.existsSync(mapPath)) {
    console.error(`Rename map not found: ${mapPath}`);
    return 2;
  }
  let ctx;
  try {
    const { tables, functions } = loadRenameMap(mapPath);
    ctx = { tables, functions, hintMap: loadHintMap(path.resolve(args.hintMap ?? DEFAULT_HINT_MAP)) };
  } catch (e) {
    console.error(`Invalid rename map ${mapPath}: ${e.message}`);
    return 2;
  }
  const rootAbs = path.resolve(args.root ?? DEFAULT_ROOT);

  if (args.scan) return runScan(rootAbs, ctx, log).code;
  if (args.apply) {
    const { code, changed } = runApply(rootAbs, ctx, log, console.error);
    if (code === 0 && args.manifestOut) {
      fs.writeFileSync(args.manifestOut, changed.join('\n') + (changed.length ? '\n' : ''));
    }
    return code;
  }
  return runCheck(rootAbs, ctx, console.error, log);
}

if (isMain(import.meta.url)) {
  process.exitCode = await main(process.argv.slice(2));
}
