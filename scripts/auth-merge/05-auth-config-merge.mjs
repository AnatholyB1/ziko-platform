#!/usr/bin/env node
/**
 * AUTHMIG-04: additive read-merge-write of the portfolio auth redirect allow-list (D-10, D-14).
 *
 * Only `uri_allow_list` is ever written (single-key PATCH). site_url, email templates, providers and
 * rate limits are left untouched by design. The CLI-based whole-config push is never used (D-14).
 *
 * Modes (exactly one):
 *   --snapshot --label <l> [--out-dir <dir>] [--overwrite]   GET config; raw JSON -> <tmpdir>/ziko-auth-merge/<ref>-<label>.raw.json,
 *                                                            redacted JSON -> <out-dir>/<ref>-<label>.redacted.json
 *   --plan --source-ref <ziko> [--extra-uris a,b]            read-only; prints what would be added
 *   --apply --source-ref <ziko> --confirm-ref <ref> --snapshot-raw <path> [--extra-uris a,b]
 *   --diff --before-raw <path>                               fails on any removed URI or changed non-allow-list key
 *
 * Extra URIs are derived from code, not guessed (reviewed by a human before any portfolio PATCH, T-3-31):
 *   - mobile deep-link scheme from apps/mobile/app.json  -> `ziko://**`
 *   - emailRedirectTo / redirectTo origins in apps/ and backend/: none found (web `redirectTo` values are
 *     in-app relative paths, not auth redirect URLs), so no origin is added.
 * ziko's own site_url is appended by --plan/--apply only if absent from the merged list.
 *
 * The Management API token comes from lib.loadAccessToken() and is never printed.
 */

import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { mkdir, writeFile, readFile, access } from 'node:fs/promises';
import {
  parseCliArgs,
  requireRef,
  assertWriteAllowed,
  parseUriList,
  unionUriList,
  diffAuthConfig,
  loadAccessToken,
  redactPii,
  isMain,
} from './lib.mjs';

export const DEFAULT_EXTRA_URIS = Object.freeze(['ziko://**']);
const LABEL_RE = /^[a-z0-9-]+$/;
const API = 'https://api.supabase.com/v1/projects';

const HELP = `Usage: node scripts/auth-merge/05-auth-config-merge.mjs --project-ref <ref> <mode> [options]
Modes:
  --snapshot --label <l> [--out-dir <dir>] [--overwrite]
  --plan --source-ref <ziko ref> [--extra-uris a,b]
  --apply --source-ref <ziko ref> --confirm-ref <ref> --snapshot-raw <path> [--extra-uris a,b]
  --diff --before-raw <path>
Only uri_allow_list is ever written. Raw snapshots live in the OS temp dir.
  --help, -h`;

// ---------------------------------------------------------------- pure helpers

export function buildMergedAllowList(portfolioList, zikoList, extraUris = []) {
  const existing = new Set(parseUriList(portfolioList));
  const wanted = [...parseUriList(zikoList), ...extraUris.map((u) => String(u).trim()).filter(Boolean)];
  const added = [];
  for (const u of wanted) {
    if (!existing.has(u) && !added.includes(u)) added.push(u);
  }
  return { merged: unionUriList(portfolioList, wanted), added };
}

export function redactConfig(config) {
  const cfg = config ?? {};
  const keys = Object.keys(cfg).sort();
  const digests = {};
  for (const k of keys) {
    digests[k] = createHash('sha256').update(JSON.stringify(cfg[k]) ?? 'undefined').digest('hex');
  }
  return { keys, digests, uri_allow_list: parseUriList(cfg.uri_allow_list), site_url: cfg.site_url ?? null };
}

export function rawSnapshotPath(ref, label) {
  if (typeof label !== 'string' || !LABEL_RE.test(label)) throw new Error('Invalid label (expected /^[a-z0-9-]+$/)');
  if (typeof ref !== 'string' || !/^[a-z]{20}$/.test(ref)) throw new Error('Invalid project ref format');
  return join(tmpdir(), 'ziko-auth-merge', `${ref}-${label}.raw.json`);
}

// ---------------------------------------------------------------- transport

async function getConfig(ref, token) {
  const res = await fetch(`${API}/${ref}/config/auth`, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error(redactPii(`GET config/auth failed for ${ref}: HTTP ${res.status}`));
  return res.json();
}

async function patchAllowList(ref, token, uriAllowList) {
  const res = await fetch(`${API}/${ref}/config/auth`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ uri_allow_list: uriAllowList }),
  });
  if (!res.ok) throw new Error(redactPii(`PATCH config/auth failed for ${ref}: HTTP ${res.status}`));
}

async function exists(p) {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}

async function readRaw(p, label) {
  if (!p) throw new Error(`${label} is required`);
  return JSON.parse(await readFile(p, 'utf8'));
}

function mergeFor(target, source, extras) {
  const withSite = [...extras];
  const r = buildMergedAllowList(target.uri_allow_list, source.uri_allow_list, withSite);
  const siteUrl = source.site_url ? String(source.site_url).trim() : '';
  if (siteUrl && !parseUriList(r.merged).includes(siteUrl) && !r.added.includes(siteUrl)) {
    return buildMergedAllowList(target.uri_allow_list, source.uri_allow_list, [...withSite, siteUrl]);
  }
  return r;
}

// ---------------------------------------------------------------- main

export async function main(argv = process.argv.slice(2)) {
  const args = parseCliArgs(argv, {
    'project-ref': 'string',
    'source-ref': 'string',
    'confirm-ref': 'string',
    snapshot: 'boolean',
    plan: 'boolean',
    apply: 'boolean',
    diff: 'boolean',
    label: 'string',
    'out-dir': 'string',
    overwrite: 'boolean',
    'extra-uris': 'list',
    'snapshot-raw': 'string',
    'before-raw': 'string',
  });
  if (args.help) {
    console.log(HELP);
    return 0;
  }
  const modes = ['snapshot', 'plan', 'apply', 'diff'].filter((m) => args[m]);
  if (modes.length !== 1) {
    console.error('ERROR: exactly one of --snapshot --plan --apply --diff is required');
    return 2;
  }
  const mode = modes[0];
  const ref = requireRef(args, 'projectRef');
  const extras = args.extraUris.length ? args.extraUris : [...DEFAULT_EXTRA_URIS];

  if (mode === 'apply') {
    // Safety gate first: no token read, no network before this passes.
    assertWriteAllowed({ projectRef: ref, confirmRef: args.confirmRef });
    if (!args.snapshotRaw) throw new Error('--snapshot-raw <path> is required for --apply');
    if (!args.sourceRef) throw new Error('--source-ref is required for --apply');
  }

  const token = await loadAccessToken();

  if (mode === 'snapshot') {
    const label = args.label;
    const rawPath = rawSnapshotPath(ref, label);
    if ((await exists(rawPath)) && !args.overwrite) {
      console.error(`ERROR: ${rawPath} already exists; pass --overwrite to replace it deliberately`);
      return 1;
    }
    const cfg = await getConfig(ref, token);
    await mkdir(join(tmpdir(), 'ziko-auth-merge'), { recursive: true });
    await writeFile(rawPath, JSON.stringify(cfg, null, 2), 'utf8');
    const outDir = args.outDir ?? '.';
    await mkdir(outDir, { recursive: true });
    await writeFile(join(outDir, `${ref}-${label}.redacted.json`), JSON.stringify(redactConfig(cfg), null, 2), 'utf8');
    console.log(`raw_snapshot=${rawPath}`);
    console.log(`redacted_snapshot=${join(outDir, `${ref}-${label}.redacted.json`)}`);
    return 0;
  }

  if (mode === 'plan') {
    const sourceRef = requireRef(args, 'sourceRef');
    const target = await getConfig(ref, token);
    const source = await getConfig(sourceRef, token);
    const { merged, added } = mergeFor(target, source, extras);
    console.log(`target_site_url_kept=${target.site_url ?? ''}`);
    console.log(`source_site_url=${source.site_url ?? ''}`);
    console.log(`existing_entries=${parseUriList(target.uri_allow_list).length}`);
    console.log(`merged_entries=${parseUriList(merged).length}`);
    for (const a of added) console.log(`add=${a}`);
    return 0;
  }

  if (mode === 'apply') {
    const sourceRef = requireRef(args, 'sourceRef');
    const before = await readRaw(args.snapshotRaw, '--snapshot-raw');
    const target = await getConfig(ref, token);
    const drift = diffAuthConfig(before, target, { allowChanged: [] });
    if (drift.removedUris.length || drift.addedUris.length || drift.changedKeys.length) {
      console.error(
        `ABORT: config drift since snapshot (removed=${drift.removedUris.length} added=${drift.addedUris.length} changed_keys=${drift.changedKeys.join(',')})`
      );
      return 1;
    }
    const source = await getConfig(sourceRef, token);
    const { merged, added } = mergeFor(target, source, extras);
    if (!added.length) {
      console.log('Nothing to add; allow-list already contains every entry. No PATCH sent.');
      return 0;
    }
    await patchAllowList(ref, token, merged);
    console.log(`patched uri_allow_list: added=${added.length}`);
    return 0;
  }

  // diff
  const before = await readRaw(args.beforeRaw, '--before-raw');
  const after = await getConfig(ref, token);
  const d = diffAuthConfig(before, after, { allowChanged: ['uri_allow_list'] });
  for (const u of d.addedUris) console.log(`added=${u}`);
  if (d.removedUris.length || d.changedKeys.length) {
    for (const u of d.removedUris) console.log(`REMOVED=${u}`);
    for (const k of d.changedKeys) console.log(`CHANGED_KEY=${k}`);
    console.log('DIFF: FAIL');
    return 1;
  }
  console.log('DIFF: PASS');
  return 0;
}

if (isMain(import.meta.url)) {
  main().then(
    (code) => process.exit(code),
    (err) => {
      console.error(`ERROR: ${redactPii(err.message)}`);
      process.exit(1);
    }
  );
}
