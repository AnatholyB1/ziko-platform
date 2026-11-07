// Executes every (table, command) write couple found by the AST scan against the DISPOSABLE stack through
// PostgREST (gateway) as (a) a real GoTrue user (role authenticated, JWT) and (b) anon (publishable key only).
// usage: node couples2.mjs <label> <out.json>
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';

const TEMP = process.env.TEMP;
const ROOT = process.env.UAT_ROOT || `${TEMP}/ziko-uat-rv`;
const PGPORT = process.env.UAT_PG_PORT || '54520';
const GW = `http://127.0.0.1:${process.env.UAT_GW_PORT || '3220'}`;
const PSQL = 'C:/Users/Anatholy/scoop/apps/postgresql/current/bin/psql.exe';
const keys = Object.fromEntries(fs.readFileSync(`${ROOT}/keys.env`, 'utf8').trim().split(/\r?\n/).map((l) => l.split('=')));
const ANON = keys.UAT_ANON_KEY;
const label = process.argv[2] || 'run';
const outFile = process.argv[3] || `${TEMP}/rv/couples-${label}.json`;
const ast = JSON.parse(fs.readFileSync(`${TEMP}/rv/ast.json`, 'utf8'));
const isTest = (f) => /__tests__|\.test\.|\.spec\.|[\\/]test[\\/]/.test(f);

function sql(q) {
  return execFileSync(PSQL, ['-h', '127.0.0.1', '-p', PGPORT, '-U', 'postgres', '-v', 'ON_ERROR_STOP=1', '-X', '-q', '-t', '-A', '-c', q], { encoding: 'utf8', maxBuffer: 1 << 26, stdio: ['ignore', 'pipe', 'pipe'] }).trim();
}
const sqlj = (q) => JSON.parse(sql(q) || 'null');
const q1 = (s) => String(s).replace(/'/g, "''");

async function signup(email) {
  const r = await fetch(`${GW}/auth/v1/signup`, { method: 'POST', headers: { apikey: ANON, 'content-type': 'application/json' }, body: JSON.stringify({ email, password: 'Passw0rd!uat1' }) });
  const j = await r.json();
  if (!j.access_token) throw new Error('signup failed ' + JSON.stringify(j));
  return { id: j.user.id, token: j.access_token };
}
const tag = Date.now().toString(36);
const A = await signup(`rv-a-${tag}@example.com`);
const B = await signup(`rv-b-${tag}@example.com`);

const meta = {};
function load(t) {
  if (meta[t]) return meta[t];
  const cols = sqlj(`select coalesce(json_agg(json_build_object('name',a.attname,'udt',t.typname,'cat',t.typcategory,'notnull',a.attnotnull,'hasdef',a.atthasdef,'gen',(a.attgenerated<>'' or a.attidentity<>'')) order by a.attnum),'[]') from pg_attribute a join pg_type t on t.oid=a.atttypid where a.attrelid='public.${t}'::regclass and a.attnum>0 and not a.attisdropped`);
  const fks = sqlj(`select coalesce(json_agg(json_build_object('cols',(select json_agg(a.attname order by u.ord) from unnest(c.conkey) with ordinality u(k,ord) join pg_attribute a on a.attrelid=c.conrelid and a.attnum=u.k),'schema',n.nspname,'reftable',cl.relname,'refcols',(select json_agg(a.attname order by u.ord) from unnest(c.confkey) with ordinality u(k,ord) join pg_attribute a on a.attrelid=c.confrelid and a.attnum=u.k))),'[]') from pg_constraint c join pg_class cl on cl.oid=c.confrelid join pg_namespace n on n.oid=cl.relnamespace where c.contype='f' and c.conrelid='public.${t}'::regclass`);
  const pk = sqlj(`select coalesce(json_agg(a.attname order by u.ord),'[]') from pg_constraint c cross join lateral unnest(c.conkey) with ordinality u(k,ord) join pg_attribute a on a.attrelid=c.conrelid and a.attnum=u.k where c.contype='p' and c.conrelid='public.${t}'::regclass`);
  const defs = sqlj(`select coalesce(json_agg(pg_get_constraintdef(oid)),'[]') from pg_constraint where contype='c' and conrelid='public.${t}'::regclass`);
  const allowed = {};
  for (const d of defs) {
    if (!/ARRAY\[/.test(d)) continue;
    for (const c of cols) {
      if (new RegExp(`\\(?\\(?${c.name}\\)?(::\\w+( \\w+)?)?\\)?\\s*=\\s*ANY`).test(d) || new RegExp(`\\b${c.name}\\b[^=]{0,30}=\\s*ANY`).test(d)) {
        const m = d.match(/ARRAY\[\s*'([^']*)'/);
        if (m) allowed[c.name] = m[1];
      }
    }
  }
  meta[t] = { cols, fks, pk, allowed, byName: Object.fromEntries(cols.map((c) => [c.name, c])) };
  return meta[t];
}
const enumCache = {};
const enumFirst = (udt) => (enumCache[udt] ??= sql(`select e.enumlabel from pg_enum e join pg_type t on t.oid=e.enumtypid where t.typname='${udt}' order by e.enumsortorder limit 1`));
const rnd = () => Math.random().toString(36).slice(2, 8);
function dummy(c) {
  const t = c.udt;
  if (c.name === 'email' || /_email$/.test(c.name)) return `rv_${rnd()}@example.com`;
  if (c.name === 'email_normalized') return `rv_${rnd()}@example.com`;
  if (t === 'uuid') return crypto.randomUUID();
  if (['int2', 'int4', 'int8', 'numeric', 'float4', 'float8'].includes(t)) return 1;
  if (t === 'bool') return false;
  if (t === 'timestamptz' || t === 'timestamp') return new Date().toISOString();
  if (t === 'date') return new Date().toISOString().slice(0, 10);
  if (t === 'time') return '10:00:00';
  if (t === 'jsonb' || t === 'json') return /^(exercises|items|nutrients|macros|data|payload|evidence|config|settings)/.test(c.name) ? (c.name === 'evidence' || c.name === 'config' || c.name === 'settings' || c.name === 'data' || c.name === 'payload' || c.name === 'macros' || c.name === 'nutrients' ? {} : []) : {};
  if (c.cat === 'E') return enumFirst(c.udt);
  if (t.startsWith('_')) return [];
  return `rv_${c.name}_${rnd()}`;
}
const TABLE_OVERRIDES = {
  ziko_challenges: () => ({ end_date: new Date(Date.now() + 7 * 864e5).toISOString().slice(0, 10) }),
  ziko_friendships: () => ({ requester_id: A.id, addressee_id: B.id, user_id: undefined }),
  ziko_coach_client_links: () => ({ coach_id: B.id, client_id: A.id }),
  ziko_coach_invitations: () => ({ coach_id: B.id, code: `AB${Math.floor(1000 + Math.random() * 8999)}`.replace(/[01]/g, '2').slice(0, 6).padEnd(6, 'X') }),
  ziko_coach_branding: () => ({ primary_color: '#FF5C1A' }),
  ziko_user_profiles: () => ({ age: 30 }),
};
const OWNERISH = /^(user_id|owner_id|athlete_id|created_by|sender_id|author_id|member_id|requester_id)$/;
let seq = 0;
function buildRow(table, u, depth = 0) {
  const m = load(table);
  const ov = TABLE_OVERRIDES[table] ? TABLE_OVERRIDES[table]() : {};
  const fkByCol = {};
  for (const f of m.fks) for (let i = 0; i < f.cols.length; i++) fkByCol[f.cols[i]] = { ...f, i };
  const row = {};
  for (const c of m.cols) {
    if (c.gen) continue;
    if (Object.prototype.hasOwnProperty.call(ov, c.name)) { if (ov[c.name] !== undefined) row[c.name] = ov[c.name]; continue; }
    const fk = fkByCol[c.name];
    if (fk) {
      if (fk.schema === 'auth') { if (c.notnull || OWNERISH.test(c.name) || c.name === 'coach_id' || c.name === 'client_id') row[c.name] = c.name === 'coach_id' ? B.id : c.name === 'client_id' ? A.id : u.id; continue; }
      if (!c.notnull) continue;
      if (depth > 5) continue;
      row[c.name] = parent(fk.reftable, fk.refcols[fk.i], u, depth + 1);
      continue;
    }
    if (c.name === 'client_id' && c.udt === 'uuid') { row[c.name] = A.id; continue; }
    if (OWNERISH.test(c.name) && c.udt === 'uuid') { row[c.name] = u.id; continue; }
    if (c.name === 'coach_id' && c.udt === 'uuid') { row[c.name] = B.id; continue; }
    if (m.allowed[c.name] !== undefined && (c.notnull || true) && !c.hasdef) { row[c.name] = m.allowed[c.name]; continue; }
    if (c.notnull && !c.hasdef) row[c.name] = m.allowed[c.name] ?? dummy(c);
  }
  return row;
}
function lit(v, c) {
  if (v === null || v === undefined) return 'null';
  if (typeof v === 'object') return `'${q1(JSON.stringify(v))}'::${c && c.udt === 'json' ? 'json' : 'jsonb'}`;
  if (typeof v === 'boolean' || typeof v === 'number') return String(v);
  return `'${q1(v)}'`;
}
// insert as superuser; returns the stored row (all columns, defaults included) or null if on-conflict skipped
function seed(table, row, replica = false) {
  const m = load(table);
  const names = Object.keys(row);
  const vals = names.map((n) => lit(row[n], m.byName[n]));
  const stmt = names.length
    ? `insert into public.${table}(${names.map((n) => `"${n}"`).join(',')}) values(${vals.join(',')}) on conflict do nothing returning to_jsonb(${table}.*)`
    : `insert into public.${table} default values returning to_jsonb(${table}.*)`;
  const out = sql(`${replica ? 'set session_replication_role=replica; ' : ''}${stmt}`).split('\n').filter((l) => l.startsWith('{'));
  return out.length ? JSON.parse(out[0]) : null;
}
const parents = {};
function parent(table, refcol, u, depth) {
  const key = `${table}|${u.id}`;
  if (parents[key]) return parents[key][refcol];
  const row = buildRow(table, u, depth);
  let stored = null;
  try { stored = seed(table, row); } catch (e) { stored = seed(table, row, true); }
  if (!stored) {
    const owner = Object.keys(row).find((k) => OWNERISH.test(k));
    stored = sqlj(`select to_jsonb(t) from public.${table} t where ${owner ? `"${owner}"='${u.id}'` : 'true'} limit 1`) || row;
  }
  parents[key] = stored;
  return stored[refcol];
}

async function pgrst(method, table, { token, anon, body, query = '', prefer }) {
  const headers = { apikey: ANON, 'content-type': 'application/json', Authorization: `Bearer ${anon ? ANON : token}` };
  if (prefer) headers.Prefer = prefer;
  const r = await fetch(`${GW}/rest/v1/${table}${query}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  const text = await r.text();
  let j; try { j = JSON.parse(text); } catch { j = text; }
  return { status: r.status, body: j };
}
function classify(res) {
  const b = res.body || {};
  const msg = `${b.message || ''} ${b.details || ''} ${b.hint || ''}`;
  if (res.status >= 200 && res.status < 300) return Array.isArray(b) && b.length === 0 && res.expectRows ? 'OK_0ROWS' : 'OK';
  if (b.code === '42501' && /(permission denied for|droit refus. pour)/i.test(msg)) return 'PRIV_DENIED';
  if (b.code === '42501') return 'RLS_DENIED';
  return `ERR_${b.code || res.status}`;
}

const couples = [];
const seen = new Set();
for (const x of ast.out) {
  if (isTest(x.file) || !/^ziko_/.test(x.table)) continue;
  const side = x.file.startsWith('backend') ? 'backend' : x.file.startsWith('apps/web') ? 'web' : 'mobile';
  const k = `${x.table}|${x.cmd}|${side}`;
  const site = `${x.file}:${x.line}[${x.client}]`;
  if (seen.has(k)) { couples.find((c) => c.k === k).sites.push(site); continue; }
  seen.add(k);
  couples.push({ k, table: x.table, cmd: x.cmd, side, sites: [site] });
}

async function runOne(c, role) {
  for (const k of Object.keys(parents)) delete parents[k];
  load(c.table);
  const isCoach = /^ziko_coach_|^ziko_dashboard_configs$|^ziko_form|^ziko_ai_imports$|^ziko_ai_tool_audit$/.test(c.table) || meta[c.table].byName.coach_id;
  const u = isCoach ? B : A;
  const anon = role === 'anon';
  load(c.table);
  const m = meta[c.table];
  let res;
  if (c.cmd === 'insert') {
    res = await pgrst('POST', c.table, { token: u.token, anon, body: buildRow(c.table, u), prefer: 'return=minimal' });
  } else {
    const row0 = buildRow(c.table, u);
    let stored;
    try { stored = seed(c.table, row0); } catch { stored = seed(c.table, row0, true); }
    if (!stored) { const own = Object.keys(row0).find((k) => OWNERISH.test(k) || k === 'coach_id'); stored = sqlj(`select to_jsonb(t) from public.${c.table} t where ${own ? `"${own}"='${row0[own]}'` : 'true'} limit 1`); }
    if (!stored) throw new Error('seed produced no row');
    const keyCols = m.pk.length ? m.pk : Object.keys(stored).slice(0, 1);
    const filter = '?' + keyCols.map((n) => `${n}=eq.${encodeURIComponent(stored[n])}`).join('&');
    if (c.cmd === 'update') {
      const col = m.cols.find((cc) => !m.pk.includes(cc.name) && !cc.gen && stored[cc.name] !== null && stored[cc.name] !== undefined && !m.fks.some((f) => f.cols.includes(cc.name)) && typeof stored[cc.name] !== 'object') || m.cols.find((cc) => m.pk.includes(cc.name));
      res = await pgrst('PATCH', c.table, { token: u.token, anon, query: filter, body: { [col.name]: stored[col.name] }, prefer: 'return=representation' });
      res.expectRows = true;
    } else if (c.cmd === 'delete') {
      res = await pgrst('DELETE', c.table, { token: u.token, anon, query: filter, prefer: 'return=representation' });
      res.expectRows = true;
    } else {
      // upsert: re-send the stored row so INSERT ... ON CONFLICT DO UPDATE is exercised (needs INSERT + UPDATE)
      res = await pgrst('POST', c.table, { token: u.token, anon, body: stored, prefer: 'resolution=merge-duplicates,return=minimal' });
    }
  }
  return { class: classify(res), status: res.status, msg: res.status >= 300 ? String((res.body && (res.body.message || res.body.code)) || '').slice(0, 140) : '' };
}

try { const lr = buildRow('ziko_coach_client_links', A); if (meta.ziko_coach_client_links.byName.status) lr.status = meta.ziko_coach_client_links.allowed.status ?? 'active'; seed('ziko_coach_client_links', lr); } catch (e) { console.log('link seed failed', String(e.stderr||e).slice(0,200)); }
const results = [];
for (const c of couples) {
  const pair = { ...c, results: {} };
  for (const role of ['authenticated', 'anon']) {
    try { pair.results[role] = await runOne(c, role); } catch (e) { pair.results[role] = { class: 'HARNESS_ERR', status: 0, msg: String(e.stderr || e.message || e).replace(/\s+/g, ' ').slice(0, 220) }; }
  }
  results.push(pair);
  const a = pair.results.authenticated, n = pair.results.anon;
  process.stdout.write(`${c.table}.${c.cmd}[${c.side}] auth=${a.class}${a.msg ? ' (' + a.msg.slice(0, 70) + ')' : ''} anon=${n.class}\n`);
}
fs.writeFileSync(outFile, JSON.stringify({ label, userA: A.id, userB: B.id, results }, null, 1));
const tally = { authenticated: {}, anon: {} };
for (const r of results) for (const role of ['authenticated', 'anon']) { const k = r.results[role].class; tally[role][k] = (tally[role][k] || 0) + 1; }
console.log('done', results.length, 'couples ->', outFile);
console.log(JSON.stringify(tally));
