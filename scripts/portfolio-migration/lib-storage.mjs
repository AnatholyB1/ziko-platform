// Phase 5 (plan 05-01) storage-migration helpers: pure functions, no I/O.
//
// Rules for this module:
//   - no filesystem, network or database access; callers pass rows in and get
//     data / SQL text back.
//   - bucket ids always come from the caller (live storage.buckets rows); there
//     is no hardcoded bucket list (D-01).
//   - every destination bucket must match ^ziko-[a-z0-9-]+$ so a write can never
//     land in a portfolio-owned bucket.
//   - output structures carry bucket ids, counts and hashed keys only.

export const SOURCE_BUCKET_RE = /^[a-z0-9][a-z0-9-]*$/;
export const TARGET_BUCKET_RE = /^ziko-[a-z0-9-]+$/;

const ZIKO_TABLE_RE = /^ziko_[a-z0-9_]+$/;
const REF_RE = /^[a-z0-9]+$/;
const ROLE_RE = /^[a-z_][a-z0-9_]*$/;
const POLICY_NAME_RE = /^[A-Za-z0-9_ .-]+$/;
const UUID_LOOSE_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function escapeRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function bucketAlternation(buckets) {
  if (!Array.isArray(buckets) || buckets.length === 0) throw new Error('empty bucket list');
  for (const b of buckets) {
    if (typeof b !== 'string' || !SOURCE_BUCKET_RE.test(b)) throw new Error(`invalid bucket id: ${JSON.stringify(b)}`);
  }
  return [...buckets].sort((a, b) => b.length - a.length || a.localeCompare(b)).map(escapeRe).join('|');
}

function requireRef(ref, what) {
  if (typeof ref !== 'string' || !REF_RE.test(ref)) throw new Error(`invalid ${what}: ${JSON.stringify(ref)}`);
  return ref;
}

// ---------------------------------------------------------------------------
// Bucket naming and config
// ---------------------------------------------------------------------------

export function targetBucketId(id) {
  if (typeof id !== 'string' || !SOURCE_BUCKET_RE.test(id)) throw new Error(`invalid source bucket id: ${JSON.stringify(id)}`);
  if (id.startsWith('ziko-')) throw new Error(`bucket id already prefixed: ${id}`);
  return `ziko-${id}`;
}

export function assertTargetBucket(id) {
  if (typeof id !== 'string' || !TARGET_BUCKET_RE.test(id)) {
    throw new Error(`destination bucket must match ${TARGET_BUCKET_RE}: ${JSON.stringify(id)}`);
  }
}

function camelCase(id) {
  return id.replace(/-([a-z0-9])/g, (_, c) => c.toUpperCase());
}

function sortedMime(list) {
  return Array.isArray(list) ? [...list].sort() : null;
}

function sizeOf(v) {
  return v === null || v === undefined ? null : Number(v);
}

export function buildBucketMap(rows, { sourceRef, generatedAt }) {
  const buckets = [...(rows ?? [])]
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
    .map((r) => ({
      id: r.id,
      target_id: targetBucketId(r.id),
      key: camelCase(r.id),
      public: r.public === true,
      file_size_limit: sizeOf(r.file_size_limit),
      allowed_mime_types: sortedMime(r.allowed_mime_types),
    }));
  return { generated_at: generatedAt, source_ref: sourceRef, buckets };
}

export function diffBucketConfig(sourceRows, targetRows) {
  const tgt = new Map((targetRows ?? []).map((r) => [r.id, r]));
  const missing = [];
  const mismatched = [];
  const sourceIds = new Set();
  for (const s of sourceRows ?? []) {
    sourceIds.add(s.id);
    const t = tgt.get(targetBucketId(s.id));
    if (!t) {
      missing.push(s.id);
      continue;
    }
    if ((s.public === true) !== (t.public === true)) mismatched.push({ id: s.id, field: 'public' });
    if (sizeOf(s.file_size_limit) !== sizeOf(t.file_size_limit)) mismatched.push({ id: s.id, field: 'file_size_limit' });
    if (JSON.stringify(sortedMime(s.allowed_mime_types)) !== JSON.stringify(sortedMime(t.allowed_mime_types))) {
      mismatched.push({ id: s.id, field: 'allowed_mime_types' });
    }
  }
  const extraZiko = [...tgt.keys()]
    .filter((id) => id.startsWith('ziko-') && !sourceIds.has(id.slice('ziko-'.length)))
    .map((id) => id.slice('ziko-'.length))
    .sort();
  return { ok: missing.length === 0 && mismatched.length === 0 && extraZiko.length === 0, missing, mismatched, extraZiko };
}

// ---------------------------------------------------------------------------
// Object re-key
// ---------------------------------------------------------------------------

export function rekeyObjectName(name, remap) {
  if (!remap) return { key: name, rekeyed: false };
  const { sourceUuid, targetUuid } = remap;
  if (!UUID_LOOSE_RE.test(sourceUuid ?? '') || !UUID_LOOSE_RE.test(targetUuid ?? '')) throw new Error('invalid remap uuid');
  const src = sourceUuid.toLowerCase();
  const slash = name.indexOf('/');
  const first = slash === -1 ? name : name.slice(0, slash);
  const rest = slash === -1 ? '' : name.slice(slash);
  if (first.toLowerCase() === src) {
    if (rest.toLowerCase().includes(src)) throw new Error('source uuid appears beyond the first path segment');
    return { key: `${targetUuid}${rest}`, rekeyed: true };
  }
  if (name.toLowerCase().includes(src)) throw new Error('source uuid appears outside the first path segment');
  return { key: name, rekeyed: false };
}

function mimeAllowed(list, mimetype) {
  return list.some((m) => (m.endsWith('/*') ? String(mimetype).startsWith(m.slice(0, -1)) : m === mimetype));
}

export function findMimeSizeViolations(objects, bucketRows) {
  const byId = new Map((bucketRows ?? []).map((r) => [r.id, r]));
  const counts = new Map();
  const bump = (bucket, reason) => {
    const k = `${bucket}\u0000${reason}`;
    counts.set(k, (counts.get(k) ?? 0) + 1);
  };
  for (const o of objects ?? []) {
    const b = byId.get(o.bucket_id);
    if (!b) continue;
    if (Array.isArray(b.allowed_mime_types) && !mimeAllowed(b.allowed_mime_types, o.mimetype)) bump(o.bucket_id, 'mime');
    const limit = sizeOf(b.file_size_limit);
    if (limit !== null && Number(o.size) > limit) bump(o.bucket_id, 'size');
  }
  return [...counts.entries()]
    .map(([k, count]) => {
      const [bucket, reason] = k.split('\u0000');
      return { bucket, reason, count };
    })
    .sort((a, b) => a.bucket.localeCompare(b.bucket) || a.reason.localeCompare(b.reason));
}

// ---------------------------------------------------------------------------
// Policies
// ---------------------------------------------------------------------------

function parseRoles(roles) {
  if (Array.isArray(roles)) return roles.map(String);
  const s = String(roles ?? '').trim();
  if (s.startsWith('{') && s.endsWith('}')) {
    return s.slice(1, -1).split(',').map((r) => r.trim().replace(/^"|"$/g, '')).filter(Boolean);
  }
  return s ? [s] : [];
}

function fnRegex(fnName) {
  return new RegExp(`(?<![A-Za-z0-9_])(?:public\\.)?${escapeRe(fnName)}\\(`, 'g');
}

function rewriteExpr(expr, { bucketIds, functionRenames }) {
  if (expr === null || expr === undefined) return null;
  let out = String(expr);
  const known = new Set(bucketIds);
  for (const m of out.matchAll(/bucket_id\s*=\s*'([^']*)'/g)) {
    if (!known.has(m[1])) throw new Error(`bucket_id compared against unknown bucket literal: ${m[1]}`);
  }
  out = out.replace(/'([^']*)'/g, (whole, lit) => (known.has(lit) ? `'${targetBucketId(lit)}'` : whole));
  for (const [oldName, newName] of Object.entries(functionRenames ?? {})) {
    out = out.replace(fnRegex(oldName), `public.${newName}(`);
  }
  return out;
}

export function rewritePolicy(row, { bucketIds, functionRenames }) {
  const ctx = { bucketIds, functionRenames };
  return {
    name: `ziko_${row.policyname}`,
    cmd: row.cmd,
    roles: parseRoles(row.roles),
    permissive: String(row.permissive ?? 'PERMISSIVE').toUpperCase(),
    qual: rewriteExpr(row.qual, ctx),
    with_check: rewriteExpr(row.with_check, ctx),
  };
}

const CMDS = new Set(['ALL', 'SELECT', 'INSERT', 'UPDATE', 'DELETE']);

export function renderPoliciesSql(policies, { header }) {
  const lines = [`-- ${String(header).replace(/\s*\n\s*/g, ' ')}`, '-- generated file: do not edit by hand', ''];
  for (const p of policies) {
    if (typeof p.name !== 'string' || !POLICY_NAME_RE.test(p.name)) throw new Error(`invalid policy name: ${JSON.stringify(p.name)}`);
    if (!CMDS.has(p.cmd)) throw new Error(`invalid policy command: ${JSON.stringify(p.cmd)}`);
    const roles = parseRoles(p.roles);
    if (roles.length === 0 || !roles.every((r) => ROLE_RE.test(r))) throw new Error(`invalid policy roles on ${p.name}`);
    const permissive = String(p.permissive ?? 'PERMISSIVE').toUpperCase();
    if (permissive !== 'PERMISSIVE' && permissive !== 'RESTRICTIVE') throw new Error(`invalid permissive flag on ${p.name}`);
    const useUsing = p.cmd !== 'INSERT' && p.qual !== null && p.qual !== undefined;
    const useCheck = p.cmd !== 'SELECT' && p.cmd !== 'DELETE' && p.with_check !== null && p.with_check !== undefined;
    const parts = [`CREATE POLICY "${p.name}" ON storage.objects AS ${permissive} FOR ${p.cmd} TO ${roles.join(', ')}`];
    if (useUsing) parts.push(`USING (${p.qual})`);
    if (useCheck) parts.push(`WITH CHECK (${p.with_check})`);
    lines.push(`DROP POLICY IF EXISTS "${p.name}" ON storage.objects;`);
    lines.push(`${parts.join('\n  ')};`);
    lines.push('');
  }
  return lines.join('\n');
}

export function findStalePolicyRefs(policies, { bucketIds, functionNames }) {
  const bare = (bucketIds ?? []).map((id) => new RegExp(`'${escapeRe(id)}'`));
  const fns = (functionNames ?? []).map(fnRegex);
  const out = [];
  for (const p of policies ?? []) {
    const text = `${p.qual ?? ''}\n${p.with_check ?? ''}`;
    const stale = bare.some((re) => re.test(text)) || fns.some((re) => {
      re.lastIndex = 0;
      return re.test(text);
    });
    if (stale) out.push(p.name);
  }
  return out;
}

export function normalizePolicyExpr(expr) {
  return String(expr ?? '')
    .replace(/\s+/g, ' ')
    .replace(/\(\s+/g, '(')
    .replace(/\s+\)/g, ')')
    .trim();
}

function policyShape(p) {
  return JSON.stringify([
    p.cmd,
    [...parseRoles(p.roles)].sort(),
    String(p.permissive ?? 'PERMISSIVE').toUpperCase(),
    normalizePolicyExpr(p.qual),
    normalizePolicyExpr(p.with_check),
  ]);
}

function otherNames(list) {
  return new Set((list ?? []).map((x) => (typeof x === 'string' ? x : (x.policyname ?? x.name))));
}

export function evaluatePolicies({ expected, actual, baselineOther, currentOther }) {
  const exp = new Map((expected ?? []).map((p) => [p.name, p]));
  const act = new Map((actual ?? []).map((p) => [p.name, p]));
  const missing = [...exp.keys()].filter((n) => !act.has(n));
  const unexpected = [...act.keys()].filter((n) => !exp.has(n));
  const mismatched = [...exp.keys()].filter((n) => act.has(n) && policyShape(exp.get(n)) !== policyShape(act.get(n)));
  const base = otherNames(baselineOther);
  const cur = otherNames(currentOther);
  const otherChanged = [...new Set([...[...base].filter((n) => !cur.has(n)), ...[...cur].filter((n) => !base.has(n))])].sort();
  const ok = missing.length === 0 && unexpected.length === 0 && mismatched.length === 0 && otherChanged.length === 0;
  return {
    ok,
    detail: `${exp.size - missing.length - mismatched.length}/${exp.size} policies match${ok ? '' : `; missing ${missing.length}, mismatched ${mismatched.length}, unexpected ${unexpected.length}, other-changed ${otherChanged.length}`}`,
    missing,
    mismatched,
    unexpected,
    otherChanged,
  };
}

// ---------------------------------------------------------------------------
// Stored storage URLs
// ---------------------------------------------------------------------------

const URL_KIND = '(object/(?:public|sign|authenticated)|render/image/(?:public|sign))';

export function buildStorageUrlRegex({ sourceRef, buckets }) {
  requireRef(sourceRef, 'source ref');
  return new RegExp(
    `https://${escapeRe(sourceRef)}\\.supabase\\.co/storage/v1/${URL_KIND}/(${bucketAlternation(buckets)})(?![A-Za-z0-9_-])`,
    'g',
  );
}

export function rewriteStorageUrls(text, { sourceRef, targetRef, buckets }) {
  requireRef(targetRef, 'target ref');
  const re = buildStorageUrlRegex({ sourceRef, buckets });
  let count = 0;
  const out = String(text).replace(re, (_, kind, bucket) => {
    count += 1;
    return `https://${targetRef}.supabase.co/storage/v1/${kind}/${targetBucketId(bucket)}`;
  });
  return { text: out, count };
}

export function buildUrlScanSql(tables, { ref, buckets, mode }) {
  if (mode !== 'leftover' && mode !== 'rewritten') throw new Error(`invalid scan mode: ${JSON.stringify(mode)}`);
  requireRef(ref, 'project ref');
  if (!Array.isArray(tables) || tables.length === 0) throw new Error('no tables');
  const alt = bucketAlternation(buckets);
  const pattern = mode === 'leftover'
    ? `${ref}|/(public|sign|authenticated)/(${alt})/`
    : `${ref}\\.supabase\\.co/storage/v1/(object|render/image)/(public|sign|authenticated)/ziko-(${alt})/`;
  return tables
    .map((t) => {
      if (typeof t !== 'string' || !ZIKO_TABLE_RE.test(t)) throw new Error(`table must match ${ZIKO_TABLE_RE}: ${JSON.stringify(t)}`);
      return `SELECT '${t}' AS tbl, count(*)::bigint AS n FROM public."${t}" r WHERE r::text ~ '${pattern}'`;
    })
    .join('\nUNION ALL\n');
}
