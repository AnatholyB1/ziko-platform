/**
 * Pure (network-free) helpers for the Phase 4 data loader (ziko -> portfolio, ziko_* tables).
 *
 * RULES (enforced here so the loader script cannot drift):
 *  - No default project refs. This module never connects to anything.
 *  - ziko is never written. Every write identifier must be a ziko_ table (ZIKO_TABLE_RE).
 *  - TRUNCATE is always an explicit table list, never with dependent-table expansion, never
 *    with identity reset.
 *  - No data values are ever logged or placed in error text; messages name tables and counts only.
 *
 * Node built-ins plus the shared Phase 3 constants only (no pg import).
 */

import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Transform } from 'node:stream';
import { StringDecoder } from 'node:string_decoder';
import { PROJECTS, KNOWN_COLLISION_SOURCE_IDS } from '../auth-merge/lib.mjs';
import { rewriteStorageUrls } from './lib-storage.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));

export const EXPECTED_TABLE_COUNT = 99;
export const IDENT_RE = /^[a-z_][a-z0-9_]*$/;
export const ZIKO_TABLE_RE = /^ziko_[a-z0-9_]+$/;
export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function loadRenameMap(path = join(__dirname, 'rename-map.generated.json')) {
  return JSON.parse(await readFile(path, 'utf8'));
}

/** Table plan from map.tables only. Returns [{source, target}] sorted by target. */
export function buildTablePlan(map) {
  const tables = map && map.tables;
  if (!tables || typeof tables !== 'object') throw new Error('rename map has no tables object');
  const entries = Object.entries(tables);
  if (entries.length !== EXPECTED_TABLE_COUNT) {
    throw new Error(`rename map table count ${entries.length} != expected ${EXPECTED_TABLE_COUNT}`);
  }
  const seen = new Set();
  const plan = [];
  for (const [source, target] of entries) {
    if (!IDENT_RE.test(source)) throw new Error('invalid source table identifier in rename map');
    if (typeof target !== 'string' || !ZIKO_TABLE_RE.test(target) || !IDENT_RE.test(target)) {
      throw new Error(`target for ${source} is not a valid ziko_ table identifier`);
    }
    if (seen.has(target)) throw new Error(`duplicate target table ${target} in rename map`);
    seen.add(target);
    plan.push({ source, target });
  }
  plan.sort((a, b) => (a.target < b.target ? -1 : a.target > b.target ? 1 : 0));
  return plan;
}

export function quoteIdent(name) {
  if (typeof name !== 'string' || !IDENT_RE.test(name)) {
    throw new Error('invalid SQL identifier');
  }
  return `"${name}"`;
}

export function assertZikoTable(name) {
  if (typeof name !== 'string' || !ZIKO_TABLE_RE.test(name) || !IDENT_RE.test(name)) {
    throw new Error(`refusing non-ziko_ table identifier: ${String(name).slice(0, 80)}`);
  }
}

export function buildTruncateSql(tables) {
  if (!Array.isArray(tables) || tables.length === 0) throw new Error('truncate list is empty');
  const seen = new Set();
  for (const t of tables) {
    assertZikoTable(t);
    if (seen.has(t)) throw new Error(`duplicate table ${t} in truncate list`);
    seen.add(t);
  }
  return `TRUNCATE ${tables.map((t) => `public.${quoteIdent(t)}`).join(', ')};`;
}

function colList(cols) {
  if (!Array.isArray(cols) || cols.length === 0) throw new Error('column list is empty');
  return cols.map(quoteIdent).join(', ');
}

/** Read side (source table, no ziko_ guard: source names are unprefixed). */
export function buildCopyToSql(sourceTable, cols) {
  return `COPY public.${quoteIdent(sourceTable)} (${colList(cols)}) TO STDOUT`;
}

export function buildCopyFromSql(targetTable, cols) {
  assertZikoTable(targetTable);
  return `COPY public.${quoteIdent(targetTable)} (${colList(cols)}) FROM STDIN`;
}

export function buildTriggerToggleSql(targetTable, enable) {
  assertZikoTable(targetTable);
  return `ALTER TABLE public.${quoteIdent(targetTable)} ${enable ? 'ENABLE' : 'DISABLE'} TRIGGER USER`;
}

/** Positional comparison of [{name,type}] lists. */
export function compareColumnLists(a, b) {
  const diffs = [];
  const n = Math.max(a.length, b.length);
  for (let i = 0; i < n; i++) {
    const x = a[i];
    const y = b[i];
    if (!x || !y || x.name !== y.name || x.type !== y.type) {
      diffs.push({
        position: i,
        source: x ? `${x.name}:${x.type}` : null,
        target: y ? `${y.name}:${y.type}` : null,
      });
    }
  }
  return { ok: diffs.length === 0, diffs };
}

/** Validate an already-parsed uuid-remap.json; returns lower-cased {sourceUuid, targetUuid}. */
export function parseRemapFile(obj, { projectRef, sourceRef }) {
  if (!obj || typeof obj !== 'object') throw new Error('remap file is not an object');
  if (obj.target_ref !== projectRef) {
    throw new Error('remap file target_ref does not match --project-ref');
  }
  if (obj.source_ref !== sourceRef || sourceRef !== PROJECTS.ziko) {
    throw new Error('remap file source_ref is not the ziko project');
  }
  if (!Array.isArray(obj.remaps) || obj.remaps.length !== 1) {
    throw new Error('remap file must contain exactly one remap');
  }
  const { source_user_id: s, target_user_id: t } = obj.remaps[0] || {};
  if (typeof s !== 'string' || typeof t !== 'string' || !UUID_RE.test(s) || !UUID_RE.test(t)) {
    throw new Error('remap file contains an invalid UUID');
  }
  const sourceUuid = s.toLowerCase();
  const targetUuid = t.toLowerCase();
  if (!KNOWN_COLLISION_SOURCE_IDS.includes(sourceUuid)) {
    throw new Error('remap source user is not a known collision id');
  }
  if (sourceUuid === targetUuid) throw new Error('remap source and target are identical');
  return { sourceUuid, targetUuid };
}

/**
 * Per-line UUID rewrite over COPY text output. Line buffered (never per raw chunk) so a UUID
 * straddling a chunk boundary is still replaced; utf8 decoded with StringDecoder so multi-byte
 * characters split across chunks survive. stats: rows = newline-terminated lines.
 */
export function createRemapTransform(sourceUuid, targetUuid) {
  const re = new RegExp(sourceUuid, 'gi');
  const decoder = new StringDecoder('utf8');
  const stats = { rows: 0, replacements: 0, rowsTouched: 0 };
  let carry = '';

  const rewrite = (line) => {
    let count = 0;
    const out = line.replace(re, () => {
      count++;
      return targetUuid;
    });
    if (count > 0) {
      stats.replacements += count;
      stats.rowsTouched += 1;
    }
    return out;
  };

  const t = new Transform({
    transform(chunk, _enc, cb) {
      carry += decoder.write(chunk);
      const parts = carry.split('\n');
      carry = parts.pop();
      if (parts.length > 0) {
        let out = '';
        for (const p of parts) {
          stats.rows += 1;
          out += rewrite(p) + '\n';
        }
        this.push(out, 'utf8');
      }
      cb();
    },
    flush(cb) {
      carry += decoder.end();
      if (carry.length > 0) this.push(rewrite(carry), 'utf8');
      carry = '';
      cb();
    },
  });
  t.stats = stats;
  return t;
}

/**
 * Per-line storage-URL rewrite over COPY text output (D-05, in-flight). Same buffering as
 * createRemapTransform. COPY text leaves '/' and '.' unescaped so a per-line regex is safe.
 * Rewrites https://<sourceRef>.supabase.co/storage/v1/<kind>/<bucket> to the target host and
 * ziko-<bucket>. stats: rows = newline-terminated lines, replacements, rowsTouched.
 */
export function createUrlRewriteTransform({ sourceRef, targetRef, buckets }) {
  if (!Array.isArray(buckets) || buckets.length === 0) throw new Error('url rewrite: empty bucket list');
  if (sourceRef === targetRef) throw new Error('url rewrite: source and target ref are identical');
  const opts = { sourceRef, targetRef, buckets };
  const decoder = new StringDecoder('utf8');
  const stats = { rows: 0, replacements: 0, rowsTouched: 0 };
  let carry = '';

  const rewrite = (line) => {
    const { text, count } = rewriteStorageUrls(line, opts);
    if (count > 0) {
      stats.replacements += count;
      stats.rowsTouched += 1;
    }
    return text;
  };

  const t = new Transform({
    transform(chunk, _enc, cb) {
      carry += decoder.write(chunk);
      const parts = carry.split('\n');
      carry = parts.pop();
      if (parts.length > 0) {
        let out = '';
        for (const p of parts) {
          stats.rows += 1;
          out += rewrite(p) + '\n';
        }
        this.push(out, 'utf8');
      }
      cb();
    },
    flush(cb) {
      carry += decoder.end();
      if (carry.length > 0) this.push(rewrite(carry), 'utf8');
      carry = '';
      cb();
    },
  });
  t.stats = stats;
  return t;
}

/** Kahn topological sort (parents first), alphabetical tie-break. Edges outside the list / self ignored. */
export function topoSortTables(tables, edges) {
  const set = new Set(tables);
  const parents = new Map(tables.map((t) => [t, new Set()]));
  for (const { child, parent } of edges) {
    if (child === parent || !set.has(child) || !set.has(parent)) continue;
    parents.get(child).add(parent);
  }
  const done = new Set();
  const order = [];
  const remaining = [...tables].sort();
  while (remaining.length > 0) {
    const idx = remaining.findIndex((t) => [...parents.get(t)].every((p) => done.has(p)));
    if (idx === -1) throw new Error('foreign key cycle detected among ziko_ tables');
    const [next] = remaining.splice(idx, 1);
    done.add(next);
    order.push(next);
  }
  return order;
}

/** Every table referencing a ziko_ table must itself be a ziko_ table. */
export function assertNoForeignReferrers(rows) {
  for (const { referrer, referenced } of rows) {
    if (!ZIKO_TABLE_RE.test(referrer)) {
      throw new Error(`non-ziko_ table ${referrer} references ${referenced}; refusing to truncate`);
    }
  }
}

export function evaluateLoadedTable({ table, sourceCount, streamedRows, targetCount }) {
  const ok = sourceCount === streamedRows && streamedRows === targetCount;
  return ok
    ? { ok: true, reason: null }
    : {
        ok: false,
        reason: `${table}: source=${sourceCount} streamed=${streamedRows} target=${targetCount}`,
      };
}
