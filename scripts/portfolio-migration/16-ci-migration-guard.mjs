#!/usr/bin/env node
// CI migration guard (06-04, CUTOVER-05, D-11/D-16).
//   --freeze-legacy [--out <file>]       write sha256 manifest of supabase/migrations/*.sql
//   --check-legacy  [--manifest <file>]  fail if supabase/migrations/ differs from the manifest
//   --check-portfolio [--dir <dir>]      lint supabase/portfolio-migrations/*.sql
//   --pending --base <sha> [--watermark-file <file>]
//                                        list portfolio migrations added in <base>..HEAD above watermark
// Common: --root <dir> (default: repo root). No network access.
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';
import { parseCliArgs } from '../auth-merge/lib.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, '..', '..');
const PORTFOLIO_DIR = 'supabase/portfolio-migrations';
const DEFAULT_MANIFEST = join(HERE, 'legacy-migrations.manifest.json');
const DEFAULT_WATERMARK = join(HERE, 'portfolio-migrations.watermark');

/** sha256 over content with CRLF normalised, so Windows checkouts match Linux CI. */
function sha256Normalized(buf) {
  const text = buf.toString('utf8').replace(/\r\n/g, '\n');
  return createHash('sha256').update(text, 'utf8').digest('hex');
}

export function buildLegacyManifest(dir) {
  return readdirSync(dir)
    .filter((f) => f.endsWith('.sql'))
    .sort()
    .map((file) => ({ file, sha256: sha256Normalized(readFileSync(join(dir, file))) }));
}

export function diffLegacy(manifest, current) {
  const problems = [];
  const want = new Map(manifest.map((e) => [e.file, e.sha256]));
  const have = new Map(current.map((e) => [e.file, e.sha256]));
  for (const [f, h] of have) {
    if (!want.has(f)) problems.push(`added: ${f}`);
    else if (want.get(f) !== h) problems.push(`modified: ${f}`);
  }
  for (const f of want.keys()) if (!have.has(f)) problems.push(`deleted: ${f}`);
  return problems;
}

/**
 * Strip comments (-- and block) while respecting single-quoted strings and
 * dollar-quoted bodies. Function bodies and string literals are kept.
 */
function stripComments(sql) {
  let out = '';
  let i = 0;
  const n = sql.length;
  while (i < n) {
    const c = sql[i];
    const d = sql[i + 1];
    if (c === '-' && d === '-') {
      while (i < n && sql[i] !== '\n') i++;
    } else if (c === '/' && d === '*') {
      let depth = 1;
      i += 2;
      while (i < n && depth > 0) {
        if (sql[i] === '/' && sql[i + 1] === '*') { depth++; i += 2; }
        else if (sql[i] === '*' && sql[i + 1] === '/') { depth--; i += 2; }
        else i++;
      }
      out += ' ';
    } else if (c === "'") {
      let j = i + 1;
      while (j < n) {
        if (sql[j] === "'" && sql[j + 1] === "'") j += 2;
        else if (sql[j] === "'") { j++; break; }
        else j++;
      }
      out += sql.slice(i, j);
      i = j;
    } else if (c === '$') {
      const m = /^\$[A-Za-z_]*\$/.exec(sql.slice(i, i + 64));
      if (m) {
        const tag = m[0];
        const end = sql.indexOf(tag, i + tag.length);
        const stop = end === -1 ? n : end + tag.length;
        // body kept verbatim, but comments inside are stripped by recursion
        const inner = sql.slice(i + tag.length, end === -1 ? n : end);
        out += tag + stripComments(inner) + (end === -1 ? '' : tag);
        i = stop;
      } else {
        out += c;
        i++;
      }
    } else {
      out += c;
      i++;
    }
  }
  return out;
}

const IDENT = '(?:"[^"]+"|[A-Za-z_][\\w$]*)';
const QNAME = `(?:${IDENT}\\s*\\.\\s*)?${IDENT}`;

function splitName(q) {
  const parts = q.split('.').map((s) => s.trim().replace(/^"|"$/g, ''));
  return parts.length === 2 ? { schema: parts[0], name: parts[1] } : { schema: null, name: parts[0] };
}

function publicTargetOk(q) {
  const { schema, name } = splitName(q);
  if (schema !== null && schema !== 'public') return true; // auth/storage etc. are not "public objects"
  return name.startsWith('ziko_');
}

/** Returns an array of violation strings (empty = pass). */
export function lintPortfolioSql(text) {
  const problems = [];
  const sql = stripComments(text);

  // Rule 1: no rh_ / gecko_ identifiers anywhere (bodies included, comments excluded).
  const foreign = sql.match(/\b(?:rh|gecko)_[A-Za-z0-9_]*/gi);
  if (foreign) problems.push(`references foreign-tenant object(s): ${[...new Set(foreign)].join(', ')}`);

  // Rule 2: DDL targets in public (or unqualified) must be ziko_-prefixed.
  // String literals are blanked first so DDL text inside format()/EXECUTE strings is not parsed as DDL.
  const ddl = sql.replace(/'(?:[^']|'')*'/g, "''");
  const objKinds = 'TABLE|VIEW|MATERIALIZED\\s+VIEW|SEQUENCE|FUNCTION|PROCEDURE|TYPE|DOMAIN';
  const objRe = new RegExp(
    `\\b(CREATE|ALTER|DROP)\\s+(?:OR\\s+REPLACE\\s+)?(?:UNLOGGED\\s+|TEMP(?:ORARY)?\\s+)?(${objKinds})\\s+(?:IF\\s+(?:NOT\\s+)?EXISTS\\s+)?(?:ONLY\\s+)?(${QNAME})`,
    'gi',
  );
  for (const m of ddl.matchAll(objRe)) {
    if (!publicTargetOk(m[3])) problems.push(`${m[1].toUpperCase()} ${m[2].toUpperCase()} on non-ziko_ object: ${m[3]}`);
  }

  const idxRe = new RegExp(`\\bCREATE\\s+(?:UNIQUE\\s+)?INDEX\\s+(?:CONCURRENTLY\\s+)?(?:IF\\s+NOT\\s+EXISTS\\s+)?(?:${IDENT}\\s+)?ON\\s+(?:ONLY\\s+)?(${QNAME})`, 'gi');
  for (const m of ddl.matchAll(idxRe)) {
    if (!publicTargetOk(m[1])) problems.push(`CREATE INDEX on non-ziko_ table: ${m[1]}`);
  }

  const polRe = new RegExp(`\\b(CREATE|ALTER|DROP)\\s+POLICY\\s+(?:IF\\s+(?:NOT\\s+)?EXISTS\\s+)?(${IDENT})\\s+ON\\s+(${QNAME})`, 'gi');
  for (const m of ddl.matchAll(polRe)) {
    const policy = m[2].replace(/^"|"$/g, '');
    const { schema } = splitName(m[3]);
    if (!publicTargetOk(m[3])) problems.push(`${m[1].toUpperCase()} POLICY on non-ziko_ table: ${m[3]}`);
    if (schema === 'storage' && !policy.startsWith('ziko_')) problems.push(`storage policy not ziko_-named: ${policy}`);
  }

  const trgRe = new RegExp(`\\b(CREATE|DROP)\\s+(?:OR\\s+REPLACE\\s+)?TRIGGER\\s+(?:IF\\s+(?:NOT\\s+)?EXISTS\\s+)?(${IDENT})(?:[\\s\\S]*?\\bON\\s+(${QNAME}))?`, 'gi');
  for (const m of ddl.matchAll(trgRe)) {
    const trg = m[2].replace(/^"|"$/g, '');
    if (m[3] && !publicTargetOk(m[3])) problems.push(`TRIGGER on non-ziko_ table: ${m[3]}`);
    // Triggers on public ziko_ tables are scoped by their table; triggers on shared schemas (auth/storage) must be ziko_-named.
    if (m[3] && splitName(m[3]).schema && splitName(m[3]).schema !== 'public' && !trg.startsWith('ziko_')) {
      problems.push(`trigger on shared schema not ziko_-named: ${trg}`);
    }
  }

  // Rule 3: storage buckets must be ziko- ids.
  const bucketRe = /\binsert\s+into\s+storage\.buckets\s*\(([^)]*)\)\s*values\s*([\s\S]*?)(?:;|$)/gi;
  for (const m of sql.matchAll(bucketRe)) {
    const cols = m[1].split(',').map((s) => s.trim().toLowerCase());
    const idIdx = cols.indexOf('id');
    for (const tuple of m[2].matchAll(/\(([^()]*)\)/g)) {
      const vals = tuple[1].split(',').map((s) => s.trim());
      const id = (vals[idIdx] ?? '').replace(/^'|'$/g, '');
      if (!id.startsWith('ziko-')) problems.push(`storage bucket id not ziko--prefixed: ${id}`);
    }
  }
  return problems;
}

export function pendingFiles({ added, watermark }) {
  return added
    .filter((p) => p.startsWith(`${PORTFOLIO_DIR}/`) && p.endsWith('.sql'))
    .filter((p) => {
      const m = /^(\d{14})_/.exec(p.slice(PORTFOLIO_DIR.length + 1));
      return m && m[1] > watermark;
    })
    .sort();
}

function main() {
  const args = parseCliArgs(process.argv.slice(2), {
    'freeze-legacy': 'boolean',
    'check-legacy': 'boolean',
    'check-portfolio': 'boolean',
    pending: 'boolean',
    out: 'string',
    manifest: 'string',
    dir: 'string',
    base: 'string',
    'watermark-file': 'string',
    root: 'string',
  });
  const root = args.root ? resolve(args.root) : REPO_ROOT;
  const legacyDir = join(root, 'supabase', 'migrations');

  if (args.freeze_legacy || args.freezeLegacy) {
    const out = args.out ?? DEFAULT_MANIFEST;
    const manifest = buildLegacyManifest(legacyDir);
    writeFileSync(out, JSON.stringify(manifest, null, 2) + '\n');
    console.log(`froze ${manifest.length} legacy migrations -> ${out}`);
    return 0;
  }
  if (args.checkLegacy) {
    const mf = args.manifest ?? DEFAULT_MANIFEST;
    const problems = diffLegacy(JSON.parse(readFileSync(mf, 'utf8')), buildLegacyManifest(legacyDir));
    if (problems.length) {
      console.error('FAIL: supabase/migrations/ is frozen (ziko history, never pushed). Differences:');
      for (const p of problems) console.error(`  ${p}`);
      return 1;
    }
    console.log('PASS: legacy migrations match frozen manifest');
    return 0;
  }
  if (args.checkPortfolio) {
    const dir = args.dir ? resolve(args.dir) : join(root, PORTFOLIO_DIR);
    let bad = 0;
    for (const f of readdirSync(dir).filter((x) => x.endsWith('.sql')).sort()) {
      const problems = lintPortfolioSql(readFileSync(join(dir, f), 'utf8'));
      for (const p of problems) { console.error(`FAIL ${f}: ${p}`); bad++; }
    }
    if (bad) return 1;
    console.log('PASS: portfolio migrations are ziko_-only');
    return 0;
  }
  if (args.pending) {
    if (!args.base) { console.error('--pending requires --base <sha>'); return 2; }
    const wmFile = args.watermarkFile ?? DEFAULT_WATERMARK;
    if (!existsSync(wmFile)) { console.error(`watermark file missing: ${wmFile}`); return 2; }
    const watermark = readFileSync(wmFile, 'utf8').trim();
    const stdout = execFileSync(
      'git',
      ['diff', '--diff-filter=A', '--name-only', args.base, 'HEAD', '--', `${PORTFOLIO_DIR}/`],
      { cwd: root, encoding: 'utf8' },
    );
    const added = stdout.split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
    for (const f of pendingFiles({ added, watermark })) console.log(f);
    return 0;
  }
  console.error('Specify one of --freeze-legacy --check-legacy --check-portfolio --pending');
  return 2;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exit(main());
}
