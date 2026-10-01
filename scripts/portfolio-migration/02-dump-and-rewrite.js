#!/usr/bin/env node
/**
 * Dump ziko's LIVE public schema and rewrite it, name by name via
 * rename-map.generated.json (Plan 01 output), into a two-file migration series:
 *
 *   supabase/portfolio-migrations/<TS>_portfolio_ziko_schema.sql
 *     ziko_-prefixed sequence, tables, constraints, indexes, grants, RLS enable,
 *     RLS policies that do NOT call a ziko function.
 *   supabase/portfolio-migrations/<TS+1s>_portfolio_ziko_functions.sql
 *     CREATE EXTENSION (gated on required_extensions), the 33 ziko_-prefixed
 *     functions (+ search_path pin, GRANT/REVOKE), the 18 public-schema
 *     triggers, and the RLS policies that call a ziko function (they cannot be
 *     created before the function exists).
 *
 * The two auth.users triggers (on_auth_user_created, on_auth_user_created_credits)
 * are deliberately NOT emitted (D-02: Phase 3 attaches them).
 *
 * DUMP TRANSPORT (deviation from the plan text): `supabase db dump` shells out to
 * pg_dump inside Docker, which is unavailable on this machine (no Docker, no
 * pg_dump). The "dump" is therefore reconstructed from the live pg_catalog
 * through `supabase db query --linked --file` (same read-only transport as
 * 01-generate-rename-map.mjs): pg_get_functiondef / pg_get_constraintdef /
 * pg_get_indexdef / pg_get_triggerdef / pg_get_expr, which are the exact
 * deparsers pg_dump itself uses. Only SELECTs are ever sent to the database.
 *
 * Rewrite engine: zero-dependency regex (see 02-03-PLAN.md <interfaces>).
 *
 * Usage:
 *   node scripts/portfolio-migration/02-dump-and-rewrite.js
 *        [--project-ref <ref>]   (default: ziko, slkobhavpwsubnsmuhya)
 *        [--out-dir <dir>]       (default: <repo>/supabase/portfolio-migrations)
 *        [--ts <YYYYMMDDHHMMSS>] (default: current UTC time)
 *
 * SECURITY: the live push-trigger definitions embed an X-Webhook-Secret literal.
 * It is replaced by the {{X_WEBHOOK_SECRET}} placeholder the moment the
 * definitions are read, and the raw dump is never written to disk or logged.
 */
'use strict';

const { execFile } = require('node:child_process');
const { promisify } = require('node:util');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { randomUUID } = require('node:crypto');

const execFileAsync = promisify(execFile);

const DEFAULT_PROJECT_REF = 'slkobhavpwsubnsmuhya'; // ziko
const MAP_PATH = path.join(__dirname, 'rename-map.generated.json');
const SECRET_PLACEHOLDER = '{{X_WEBHOOK_SECRET}}';
const PREFIX = 'ziko_';
const RESERVED_SCHEMA_WORDS = ['auth', 'storage', 'extensions', 'net', 'public', 'vault', 'supabase_functions'];

function parseArgs(argv) {
  const get = (flag, fallback) => {
    const i = argv.indexOf(flag);
    return i !== -1 && argv[i + 1] ? argv[i + 1] : fallback;
  };
  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  const defaultTs =
    `${now.getUTCFullYear()}${pad(now.getUTCMonth() + 1)}${pad(now.getUTCDate())}` +
    `${pad(now.getUTCHours())}${pad(now.getUTCMinutes())}${pad(now.getUTCSeconds())}`;
  return {
    projectRef: get('--project-ref', DEFAULT_PROJECT_REF),
    outDir: get('--out-dir', path.join(__dirname, '..', '..', 'supabase', 'portfolio-migrations')),
    ts: get('--ts', defaultTs),
  };
}

function fail(msg) {
  console.error(`02-dump-and-rewrite failed: ${msg}`);
  process.exit(1);
}

// ── Live catalog queries (SELECT only) ─────────────────────────────────────

const QUERIES = {
  sequences: `
    SELECT c.relname AS name, format_type(s.seqtypid, NULL) AS type, s.seqstart AS start,
           s.seqincrement AS inc, s.seqmin AS min, s.seqmax AS max, s.seqcache AS cache,
           s.seqcycle AS cycle,
           (SELECT count(*) FROM pg_depend d WHERE d.objid = c.oid AND d.deptype IN ('a','i')) AS owned
    FROM pg_class c JOIN pg_sequence s ON s.seqrelid = c.oid
    WHERE c.relnamespace = 'public'::regnamespace ORDER BY 1`,
  tables: `
    SELECT c.relname AS name, c.relrowsecurity AS rls, c.relforcerowsecurity AS force_rls,
      (SELECT jsonb_agg(jsonb_build_object(
          'name', quote_ident(a.attname),
          'type', format_type(a.atttypid, a.atttypmod),
          'notnull', a.attnotnull,
          'default', pg_get_expr(d.adbin, d.adrelid),
          'generated', a.attgenerated::text,
          'identity', a.attidentity::text,
          'has_attacl', a.attacl IS NOT NULL) ORDER BY a.attnum)
       FROM pg_attribute a LEFT JOIN pg_attrdef d ON d.adrelid = a.attrelid AND d.adnum = a.attnum
       WHERE a.attrelid = c.oid AND a.attnum > 0 AND NOT a.attisdropped) AS cols
    FROM pg_class c
    WHERE c.relnamespace = 'public'::regnamespace AND c.relkind IN ('r','p') ORDER BY 1`,
  table_acls: `
    SELECT c.relname AS tbl,
           CASE WHEN x.grantee = 0 THEN 'PUBLIC' ELSE quote_ident(pg_get_userbyid(x.grantee)) END AS grantee,
           x.privilege_type AS priv, x.is_grantable AS grantable
    FROM pg_class c, aclexplode(c.relacl) x
    WHERE c.relnamespace = 'public'::regnamespace AND c.relkind IN ('r','p') ORDER BY 1,2,3`,
  column_acls: `
    SELECT c.relname AS tbl, quote_ident(a.attname) AS col,
           CASE WHEN x.grantee = 0 THEN 'PUBLIC' ELSE quote_ident(pg_get_userbyid(x.grantee)) END AS grantee,
           x.privilege_type AS priv, x.is_grantable AS grantable
    FROM pg_attribute a JOIN pg_class c ON c.oid = a.attrelid, aclexplode(a.attacl) x
    WHERE c.relnamespace = 'public'::regnamespace AND c.relkind IN ('r','p') AND a.attnum > 0 AND NOT a.attisdropped
    ORDER BY 1,2,3,4`,
  constraints: `
    SELECT r.relname AS tbl, c.conname AS name, c.contype::text AS type,
           pg_get_constraintdef(c.oid) AS def
    FROM pg_constraint c JOIN pg_class r ON r.oid = c.conrelid
    WHERE r.relnamespace = 'public'::regnamespace AND r.relkind IN ('r','p')
    ORDER BY r.relname, c.contype, c.conname`,
  indexes: `
    SELECT t.relname AS tbl, i.relname AS name, pg_get_indexdef(x.indexrelid) AS def
    FROM pg_index x JOIN pg_class i ON i.oid = x.indexrelid JOIN pg_class t ON t.oid = x.indrelid
    WHERE t.relnamespace = 'public'::regnamespace AND t.relkind IN ('r','p')
      AND NOT EXISTS (SELECT 1 FROM pg_constraint c WHERE c.conindid = x.indexrelid AND c.conrelid = x.indrelid)
    ORDER BY 1,2`,
  policies: `
    SELECT tablename AS tbl, policyname AS name, permissive, cmd,
           (SELECT jsonb_agg(quote_ident(r)) FROM unnest(roles) r) AS roles, qual, with_check
    FROM pg_policies WHERE schemaname = 'public' ORDER BY tablename, policyname`,
  comments: `
    SELECT r.relname AS tbl, d.objsubid AS sub, quote_ident(a.attname) AS col, d.description AS descr
    FROM pg_description d JOIN pg_class r ON r.oid = d.objoid AND d.classoid = 'pg_class'::regclass
    LEFT JOIN pg_attribute a ON a.attrelid = r.oid AND a.attnum = d.objsubid AND d.objsubid > 0
    WHERE r.relnamespace = 'public'::regnamespace AND r.relkind IN ('r','p') ORDER BY 1,2`,
  functions: `
    SELECT p.proname AS name, pg_get_function_identity_arguments(p.oid) AS args,
           pg_get_functiondef(p.oid) AS def, p.proconfig AS config,
           (SELECT jsonb_agg(jsonb_build_object(
               'grantee', CASE WHEN x.grantee = 0 THEN 'PUBLIC' ELSE quote_ident(pg_get_userbyid(x.grantee)) END,
               'grantable', x.is_grantable) ORDER BY x.grantee)
            FROM aclexplode(p.proacl) x WHERE x.privilege_type = 'EXECUTE') AS acl,
           (p.proacl IS NOT NULL) AS has_acl
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.prokind = 'f'
      AND NOT EXISTS (SELECT 1 FROM pg_depend d WHERE d.objid = p.oid AND d.deptype = 'e')
    ORDER BY 1,2`,
  triggers: `
    SELECT r.relname AS tbl, t.tgname AS name, t.tgenabled::text AS enabled,
           pg_get_triggerdef(t.oid) AS def
    FROM pg_trigger t JOIN pg_class r ON r.oid = t.tgrelid
    WHERE NOT t.tgisinternal AND r.relnamespace = 'public'::regnamespace ORDER BY 1,2`,
  auth_triggers: `
    SELECT t.tgname AS name FROM pg_trigger t JOIN pg_class r ON r.oid = t.tgrelid
    WHERE NOT t.tgisinternal AND r.relnamespace = 'auth'::regnamespace ORDER BY 1`,
};

async function runQuery(projectRef, sql) {
  const tmpFile = path.join(os.tmpdir(), `zk-dump-${randomUUID()}.sql`);
  fs.writeFileSync(tmpFile, sql, 'utf8');
  try {
    const { stdout } = await execFileAsync(
      'supabase',
      ['db', 'query', '--linked', '--project-ref', projectRef, '--file', tmpFile],
      // shell:true on Windows for the .cmd/.exe shim; argv is fixed flags + a path we generated.
      { maxBuffer: 1024 * 1024 * 128, shell: process.platform === 'win32' }
    );
    const start = stdout.indexOf('{');
    const parsed = JSON.parse(stdout.slice(start));
    if (!Array.isArray(parsed.rows)) throw new Error('no rows array in CLI output');
    return parsed.rows;
  } finally {
    try { fs.unlinkSync(tmpFile); } catch (_) { /* ignore */ }
  }
}

// ── Rewrite engine ─────────────────────────────────────────────────────────

function buildRewriter(map, sequenceNames) {
  const tableNames = Object.keys(map.tables);
  const fnNames = [...new Set(Object.keys(map.functions).map((k) => k.slice(0, k.indexOf('('))))];

  for (const t of tableNames) {
    if (RESERVED_SCHEMA_WORDS.includes(t)) fail(`table name "${t}" collides with a schema word`);
    if (fnNames.includes(t)) fail(`"${t}" is both a table and a function name; rewrite ambiguous`);
    if (!/^[a-z_][a-z0-9_]*$/.test(t)) fail(`unexpected table identifier "${t}"`);
    if (PREFIX.length + t.length > 63) fail(`prefixed table name too long: ${t}`);
  }
  const alt = (names) => [...names].sort((a, b) => b.length - a.length).join('|');
  const T = alt(tableNames);
  const F = alt(fnNames);
  const S = sequenceNames.length ? alt(sequenceNames) : null;

  const reQualified = new RegExp(`\\bpublic\\.(${T})\\b`, 'gi');
  const reContext = new RegExp(
    `\\b(FROM|JOIN|INTO|UPDATE|TABLE|REFERENCES|ONLY|SETOF|RETURNS|ON)([\\s(]+)(${T})\\b(?!\\.)`, 'gi');
  const reDotted = new RegExp(`(?<![\\w."$])(${T})\\.(?=[a-z_*"])`, 'gi');
  const reRowtype = new RegExp(`(?<![\\w."$])(${T})(?=%ROWTYPE)`, 'gi');
  const reFn = new RegExp(`(?<![\\w.])(public\\.)?(${F})(?=\\s*\\()`, 'g');
  const reSeq = S ? new RegExp(`(?<![\\w])(${S})(?![\\w])`, 'g') : null;
  const reResidual = new RegExp(`(?<![\\w.$])(${T})(?![\\w])`, 'g');

  function rewrite(text) {
    if (text == null) return text;
    let out = text;
    out = out.replace(reQualified, (_, n) => `public.${PREFIX}${n}`);
    out = out.replace(reContext, (_, kw, ws, n) => `${kw}${ws}${PREFIX}${n}`);
    out = out.replace(reDotted, (_, n) => `${PREFIX}${n}.`);
    out = out.replace(reRowtype, (_, n) => `${PREFIX}${n}`);
    out = out.replace(reFn, (_, q, n) => `${q || ''}${PREFIX}${n}`);
    if (reSeq) out = out.replace(reSeq, (_, n) => `${PREFIX}${n}`);
    return out;
  }
  function residuals(text) {
    const hits = [];
    let m;
    reResidual.lastIndex = 0;
    while ((m = reResidual.exec(text)) !== null) {
      hits.push({ name: m[1], ctx: text.slice(Math.max(0, m.index - 28), m.index + m[1].length + 18).replace(/\s+/g, ' ') });
    }
    return hits;
  }
  const newFnNames = fnNames.map((n) => `${PREFIX}${n}`);
  const reNewFnCall = new RegExp(`(?<![\\w.])(?:public\\.)?(${alt(newFnNames)})(?=\\s*\\()`);
  return { rewrite, residuals, newFnNames, usesZikoFunction: (t) => reNewFnCall.test(t), fnNames };
}

// ── Helpers ────────────────────────────────────────────────────────────────

const pn = (name) => `${PREFIX}${name}`; // prefixed relation / index / constraint / sequence name
const checkLen = (name) => { if (Buffer.byteLength(name) > 63) fail(`identifier exceeds 63 bytes: ${name}`); return name; };
const q = (s) => `"${String(s).replace(/"/g, '""')}"`;
const lit = (s) => `'${String(s).replace(/'/g, "''")}'`;

function redactSecrets(def) {
  // Replace the value of the X-Webhook-Secret header regardless of JSON spacing.
  return def.replace(/("X-Webhook-Secret"\s*:\s*")[^"]*(")/gi, `$1${SECRET_PLACEHOLDER}$2`);
}

function injectSearchPath(def, config, needsExtensions) {
  const hasPin = (config || []).some((c) => /^search_path=/i.test(c));
  if (hasPin) return { def, pinned: false };
  const sp = needsExtensions ? 'public, extensions, pg_temp' : 'public, pg_temp';
  const idx = def.search(/\nAS \$function\$/);
  if (idx === -1) fail('could not locate "AS $function$" to inject search_path');
  return { def: `${def.slice(0, idx)}\n SET search_path = ${sp}${def.slice(idx)}`, pinned: true };
}

// ── Main ───────────────────────────────────────────────────────────────────

async function main() {
  const { projectRef, outDir, ts } = parseArgs(process.argv.slice(2));
  if (!/^\d{14}$/.test(ts)) fail('--ts must be YYYYMMDDHHMMSS');
  if (!fs.existsSync(MAP_PATH)) fail(`missing ${MAP_PATH} (run 01-generate-rename-map.mjs first)`);
  const map = JSON.parse(fs.readFileSync(MAP_PATH, 'utf8'));

  const reqExt = map.required_extensions || {};
  for (const e of ['pg_net', 'unaccent']) {
    if (reqExt[e] == null || reqExt[e].required == null) fail(`required_extensions.${e}.required is not resolved in the rename map`);
  }

  console.log(`Reading live catalog from project ${projectRef} (SELECT-only)...`);
  const data = {};
  for (const [k, sql] of Object.entries(QUERIES)) {
    data[k] = await runQuery(projectRef, sql); // sequential: CLI telemetry-file race on parallel runs
    console.log(`  ${k}: ${data[k].length}`);
  }

  // ── cross-check live catalog against the rename map ──
  const liveTables = data.tables.map((t) => t.name).sort();
  const mapTables = Object.keys(map.tables).sort();
  if (JSON.stringify(liveTables) !== JSON.stringify(mapTables)) fail('live tables differ from rename map; regenerate map');
  if (data.tables.some((t) => t.cols.some((c) => c.generated || c.identity))) fail('generated/identity columns not supported by this tool');
  const authTrig = data.auth_triggers.map((r) => r.name).sort();
  if (JSON.stringify(authTrig) !== JSON.stringify(['on_auth_user_created', 'on_auth_user_created_credits'])) {
    fail(`unexpected auth.users triggers: ${authTrig.join(',')}`);
  }
  const mapFnKeys = new Set(Object.keys(map.functions));
  const liveFnKeys = new Set(data.functions.map((f) => `${f.name}(${f.args})`));
  for (const k of mapFnKeys) if (!liveFnKeys.has(k)) fail(`rename-map function missing live: ${k}`);
  for (const k of liveFnKeys) if (!mapFnKeys.has(k)) fail(`live function absent from rename map: ${k}`);

  const seqNames = data.sequences.map((s) => s.name);
  const R = buildRewriter(map, seqNames);

  const warnings = [];
  const residualReport = [];
  const checkResiduals = (label, text) => {
    for (const h of R.residuals(text)) residualReport.push(`${label}: ${h.name} :: ...${h.ctx}...`);
  };

  // ── schema file ──
  const S = [];
  S.push(`-- Phase 2 (supabase-portfolio-migration): ziko schema -> ziko_-prefixed objects.`);
  S.push(`-- GENERATED by scripts/portfolio-migration/02-dump-and-rewrite.js from ziko's live public schema`);
  S.push(`-- (project ${projectRef}) via scripts/portfolio-migration/rename-map.generated.json. Do not hand-edit.`);
  S.push(`-- Contains: sequence, tables, constraints, indexes, grants, RLS enable, non-function RLS policies.`);
  S.push(`-- auth.users references are intentionally left untouched (shared auth). No data is migrated here.`);
  S.push('');

  S.push('-- ── Sequences ──────────────────────────────────────────────────────────');
  for (const s of data.sequences) {
    if (Number(s.owned) > 0) fail(`sequence ${s.name} is owned by a column; ownership rewrite not implemented`);
    S.push(
      `CREATE SEQUENCE public.${checkLen(pn(s.name))} AS ${s.type} INCREMENT BY ${s.inc} MINVALUE ${s.min} MAXVALUE ${s.max} START WITH ${s.start} CACHE ${s.cache} ${s.cycle ? 'CYCLE' : 'NO CYCLE'};`
    );
  }
  S.push('');

  S.push('-- ── Tables ─────────────────────────────────────────────────────────────');
  for (const t of data.tables) {
    const cols = t.cols.map((c) => {
      let line = `  ${c.name} ${c.type}`;
      if (c.default != null) {
        const d = R.rewrite(c.default);
        if (R.usesZikoFunction(d)) fail(`default of ${t.name}.${c.name} calls a ziko function; ordering not supported`);
        checkResiduals(`default ${t.name}.${c.name}`, d);
        line += ` DEFAULT ${d}`;
      }
      if (c.notnull) line += ' NOT NULL';
      return line;
    });
    S.push(`CREATE TABLE public.${pn(t.name)} (\n${cols.join(',\n')}\n);`);
  }
  S.push('');

  S.push('-- ── Constraints (PK / UNIQUE / CHECK first, FOREIGN KEY last) ──────────────');
  const cons = data.constraints;
  const nonFk = cons.filter((c) => c.type !== 'f');
  const fks = cons.filter((c) => c.type === 'f');
  for (const c of [...nonFk, ...fks]) {
    const def = R.rewrite(c.def);
    if (R.usesZikoFunction(def)) fail(`constraint ${c.tbl}.${c.name} calls a ziko function; ordering not supported`);
    if (c.type !== 'f') checkResiduals(`constraint ${c.tbl}.${c.name}`, def);
    S.push(`ALTER TABLE ONLY public.${pn(c.tbl)} ADD CONSTRAINT ${q(checkLen(pn(c.name)))} ${def};`);
  }
  S.push('');

  S.push('-- ── Indexes ────────────────────────────────────────────────────────────');
  for (const i of data.indexes) {
    let def = R.rewrite(i.def);
    const m = def.match(/^CREATE (UNIQUE )?INDEX (\S+) ON /);
    if (!m) fail(`unparseable index def for ${i.name}`);
    const bare = m[2].replace(/^"|"$/g, '');
    if (bare !== i.name) fail(`index name mismatch ${bare} vs ${i.name}`);
    def = def.replace(/^CREATE (UNIQUE )?INDEX (\S+) ON /, `CREATE $1INDEX ${q(checkLen(pn(i.name)))} ON `);
    if (R.usesZikoFunction(def)) fail(`index ${i.name} calls a ziko function; ordering not supported`);
    checkResiduals(`index ${i.name}`, def.replace(/^CREATE (UNIQUE )?INDEX \S+ ON \S+ USING \w+ /, ''));
    S.push(`${def};`);
  }
  S.push('');

  S.push('-- ── Table privileges (replicates ziko live ACLs; incl. any anon revokes) ───');
  const aclByTable = new Map();
  for (const a of data.table_acls) {
    if (!aclByTable.has(a.tbl)) aclByTable.set(a.tbl, []);
    aclByTable.get(a.tbl).push(a);
  }
  for (const t of data.tables) {
    const acls = aclByTable.get(t.name) || [];
    S.push(`REVOKE ALL ON TABLE public.${pn(t.name)} FROM PUBLIC, anon, authenticated, service_role;`);
    const byGrantee = new Map();
    for (const a of acls) {
      if (a.grantee === 'postgres') continue; // owner
      const k = `${a.grantee}|${a.grantable}`;
      if (!byGrantee.has(k)) byGrantee.set(k, { grantee: a.grantee, grantable: a.grantable, privs: [] });
      byGrantee.get(k).privs.push(a.priv);
    }
    for (const g of byGrantee.values()) {
      S.push(`GRANT ${g.privs.join(', ')} ON TABLE public.${pn(t.name)} TO ${g.grantee}${g.grantable ? ' WITH GRANT OPTION' : ''};`);
    }
  }
  S.push('-- Column-level privileges (e.g. user_gamification.equipped_* UPDATE for authenticated)');
  for (const a of data.column_acls) {
    if (a.grantee === 'postgres') continue;
    S.push(`GRANT ${a.priv}(${a.col}) ON TABLE public.${pn(a.tbl)} TO ${a.grantee}${a.grantable ? ' WITH GRANT OPTION' : ''};`);
  }
  S.push('');

  S.push('-- ── Row Level Security ─────────────────────────────────────────────────');
  for (const t of data.tables) {
    if (!t.rls) warnings.push(`table ${t.name} has RLS disabled live`);
    S.push(`ALTER TABLE public.${pn(t.name)} ENABLE ROW LEVEL SECURITY;`);
    if (t.force_rls) S.push(`ALTER TABLE public.${pn(t.name)} FORCE ROW LEVEL SECURITY;`);
  }
  S.push('');

  const policySql = (p) => {
    const qual = p.qual == null ? null : R.rewrite(p.qual);
    const wc = p.with_check == null ? null : R.rewrite(p.with_check);
    if (qual) checkResiduals(`policy ${p.tbl}.${p.name} USING`, qual);
    if (wc) checkResiduals(`policy ${p.tbl}.${p.name} WITH CHECK`, wc);
    const roles = (p.roles || []).join(', ');
    let sql = `CREATE POLICY ${q(p.name)} ON public.${pn(p.tbl)} AS ${p.permissive} FOR ${p.cmd}`;
    if (roles && roles.toLowerCase() !== 'public') sql += ` TO ${roles}`;
    if (qual != null) sql += ` USING (${qual})`;
    if (wc != null) sql += ` WITH CHECK (${wc})`;
    return { sql: `${sql};`, dependsOnFn: R.usesZikoFunction(`${qual || ''} ${wc || ''}`) };
  };
  const policiesNow = [];
  const policiesLater = [];
  for (const p of data.policies) {
    const r = policySql(p);
    (r.dependsOnFn ? policiesLater : policiesNow).push(r.sql);
  }
  S.push('-- ── RLS policies (those calling a ziko_ function are in the functions migration) ──');
  S.push(...policiesNow);
  S.push('');

  S.push('-- ── Comments ───────────────────────────────────────────────────────────');
  for (const c of data.comments) {
    c.descr = R.rewrite(c.descr); // doc text cites public.<table>/public.<fn>(); keep it consistent
    if (c.sub > 0) S.push(`COMMENT ON COLUMN public.${pn(c.tbl)}.${c.col} IS ${lit(c.descr)};`);
    else S.push(`COMMENT ON TABLE public.${pn(c.tbl)} IS ${lit(c.descr)};`);
  }
  S.push('');

  // ── functions file ──
  const FN = [];
  FN.push(`-- Phase 2 (supabase-portfolio-migration): ziko functions/triggers -> ziko_-prefixed objects.`);
  FN.push(`-- GENERATED by scripts/portfolio-migration/02-dump-and-rewrite.js. Do not hand-edit.`);
  FN.push(`-- Requires the companion *_portfolio_ziko_schema.sql migration to be applied first.`);
  FN.push(`-- Intentionally NOT included (D-02): CREATE TRIGGER on_auth_user_created / on_auth_user_created_credits`);
  FN.push(`--   on auth.users -- Phase 3 attaches them to ziko_handle_new_user() / ziko_handle_new_user_credits().`);
  FN.push(`-- Intentionally NOT included: event trigger ensure_rls (ziko_rls_auto_enable() is created, not attached);`);
  FN.push(`--   an event trigger is database-wide and would alter behaviour for the rh_*/gecko_* tenants.`);
  FN.push(`-- ACTION REQUIRED BEFORE APPLY: the two push triggers carry the placeholder ${SECRET_PLACEHOLDER} in their`);
  FN.push(`--   X-Webhook-Secret header. Substitute the real secret at apply time (Plan 05/07); never commit it.`);
  FN.push('');
  FN.push('-- Extensions required by the ziko functions/triggers (evidence: rename-map.generated.json required_extensions).');
  if (reqExt.pg_net.required === true) FN.push('CREATE EXTENSION IF NOT EXISTS pg_net;');
  if (reqExt.unaccent.required === true) FN.push('CREATE EXTENSION IF NOT EXISTS unaccent;');
  FN.push('');
  FN.push('-- SQL-language function bodies are validated at creation; keep creation order-independent.');
  FN.push('SET check_function_bodies = off;');
  FN.push('');

  FN.push('-- ── Functions ──────────────────────────────────────────────────────────');
  let pinnedCount = 0;
  for (const f of data.functions) {
    let def = R.rewrite(f.def);
    if (!def.startsWith(`CREATE OR REPLACE FUNCTION public.${PREFIX}${f.name}(`)) fail(`function header rewrite failed for ${f.name}`);
    const needsExt = /\b(unaccent|uuid_generate_v\d|crypt|gen_salt|digest|hmac)\s*\(/i.test(def);
    const inj = injectSearchPath(def, f.config, needsExt);
    def = inj.def;
    if (inj.pinned) pinnedCount++;
    checkResiduals(`function ${f.name}`, def);
    FN.push(`${def.trimEnd()};`);
    FN.push('');
  }
  FN.push('-- ── Function privileges (replicates ziko live ACLs) ─────────────────────');
  for (const f of data.functions) {
    const sig = `public.${PREFIX}${f.name}(${R.rewrite(f.args)})`;
    FN.push(`REVOKE ALL ON FUNCTION ${sig} FROM PUBLIC, anon, authenticated, service_role;`);
    if (f.has_acl) {
      for (const a of f.acl || []) {
        if (a.grantee === 'postgres') continue;
        FN.push(`GRANT EXECUTE ON FUNCTION ${sig} TO ${a.grantee}${a.grantable ? ' WITH GRANT OPTION' : ''};`);
      }
    } else {
      FN.push(`GRANT EXECUTE ON FUNCTION ${sig} TO PUBLIC;`); // NULL proacl == default PUBLIC execute
    }
  }
  FN.push('');
  FN.push('RESET check_function_bodies;');
  FN.push('');

  FN.push('-- ── Triggers (public-schema tables only) ──────────────────────────────');
  let secretsRedacted = 0;
  for (const t of data.triggers) {
    const before = t.def;
    const redacted = redactSecrets(before);
    if (redacted !== before) secretsRedacted++;
    const def = R.rewrite(redacted);
    if (!def.includes(`ON public.${PREFIX}${t.tbl} `)) fail(`trigger ${t.name} table rewrite failed`);
    if (!new RegExp(`EXECUTE (FUNCTION|PROCEDURE) (public\\.)?${PREFIX}`).test(def) && /EXECUTE (FUNCTION|PROCEDURE) (public\.)?[a-z_]+\(/.test(def) && !/supabase_functions\./.test(def)) {
      fail(`trigger ${t.name} function reference not rewritten`);
    }
    checkResiduals(`trigger ${t.name}`, def.replace(/^CREATE TRIGGER \S+ /, ''));
    FN.push(`${def};`);
    if (t.enabled === 'D') FN.push(`ALTER TABLE public.${pn(t.tbl)} DISABLE TRIGGER ${t.name};`);
    else if (t.enabled === 'R') FN.push(`ALTER TABLE public.${pn(t.tbl)} ENABLE REPLICA TRIGGER ${t.name};`);
    else if (t.enabled === 'A') FN.push(`ALTER TABLE public.${pn(t.tbl)} ENABLE ALWAYS TRIGGER ${t.name};`);
  }
  FN.push('');
  FN.push('-- ── RLS policies that call a ziko_ function (need the function to exist) ────');
  FN.push(...policiesLater);
  FN.push('');

  // ── write ──
  const tsPlus1 = (() => {
    const y = +ts.slice(0, 4), mo = +ts.slice(4, 6) - 1, d = +ts.slice(6, 8);
    const h = +ts.slice(8, 10), mi = +ts.slice(10, 12), s = +ts.slice(12, 14);
    const dt = new Date(Date.UTC(y, mo, d, h, mi, s + 1));
    const p = (n) => String(n).padStart(2, '0');
    return `${dt.getUTCFullYear()}${p(dt.getUTCMonth() + 1)}${p(dt.getUTCDate())}${p(dt.getUTCHours())}${p(dt.getUTCMinutes())}${p(dt.getUTCSeconds())}`;
  })();
  fs.mkdirSync(outDir, { recursive: true });
  const schemaPath = path.join(outDir, `${ts}_portfolio_ziko_schema.sql`);
  const fnPath = path.join(outDir, `${tsPlus1}_portfolio_ziko_functions.sql`);
  fs.writeFileSync(schemaPath, `${S.join('\n')}\n`, 'utf8');
  fs.writeFileSync(fnPath, `${FN.join('\n')}\n`, 'utf8');

  console.log(`Wrote ${schemaPath}`);
  console.log(`Wrote ${fnPath}`);
  console.log(`  tables: ${data.tables.length}, constraints: ${cons.length}, indexes: ${data.indexes.length}`);
  console.log(`  policies: ${policiesNow.length} (schema) + ${policiesLater.length} (functions file)`);
  console.log(`  functions: ${data.functions.length} (search_path newly pinned on ${pinnedCount}), triggers: ${data.triggers.length}`);
  console.log(`  webhook secrets redacted to placeholder: ${secretsRedacted}`);
  console.log(`  auth.users triggers excluded: ${authTrig.join(', ')}`);
  for (const w of warnings) console.log(`  WARNING: ${w}`);
  if (residualReport.length) {
    console.log(`  RESIDUAL unprefixed table-name tokens for review (${residualReport.length}):`);
    for (const r of residualReport) console.log(`    ${r}`);
  } else {
    console.log('  residual unprefixed table-name tokens: none');
  }
}

main().catch((err) => fail(err.message));
