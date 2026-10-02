#!/usr/bin/env node
/**
 * Phase 5 STORAGE-04 authenticated test harness (D-10).
 *
 * Usage:
 *   node scripts/portfolio-migration/10-storage-auth-tests.mjs --project-ref <scratch|portfolio>
 *        --mode full|smoke [--confirm-ref <ref>] [--with-codemod-patch <path>]
 *        [--report-out <path>] [--bucket-map <path>]
 *
 * Throwaway athlete/coach/outsider users are created with the Admin API, signed in with
 * signInWithPassword, and every allow/deny assertion runs with those user JWTs (publishable key).
 * The service-role client is confined to setup (user creation, seed objects), the coach link,
 * the service-side bucket-limit cases and cleanup.
 *
 * full  : whole matrix, scratch only (writes objects, links, revocations).
 * smoke : reads, denials and signed-URL issuance only (no storage object is written); the only
 *         project allowed with --confirm-ref besides scratch is portfolio.
 * Exit codes: 0 all non-deferred cases matched; 1 a case failed or the run was refused; 2 bad args.
 */

import { randomBytes } from 'node:crypto';
import { spawn } from 'node:child_process';
import { readFile, writeFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  PROJECTS,
  parseCliArgs,
  assertWriteAllowed,
  getProjectApiKeys,
  runSql,
  isMain,
  redactPii,
} from '../auth-merge/lib.mjs';
import { assertReportSafe } from './lib-verify.mjs';
import { targetBucketId } from './lib-storage.mjs';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(SCRIPT_DIR, '..', '..');
const FIXTURE_PATH = path.join(SCRIPT_DIR, '.tmp-storage-auth-fixture.json');
const BACKEND_OUT = path.join(SCRIPT_DIR, '.tmp-storage-auth-backend-out.json');
const WEB_RESULTS = path.join(SCRIPT_DIR, '.tmp-storage-auth-web-results.json');
const WEB_JSON = path.join(SCRIPT_DIR, '.tmp-storage-auth-web-vitest.json');
const DEFAULT_MAP = path.join(SCRIPT_DIR, 'bucket-map.generated.json');
const IS_WIN = process.platform === 'win32';
const NPX = IS_WIN ? 'npx.cmd' : 'npx';

const HELP = `10-storage-auth-tests.mjs - Phase 5 STORAGE-04 authenticated storage test harness

Required:
  --project-ref <ref>        scratch or portfolio (ziko is refused).
  --mode full|smoke          full: scratch only. smoke: reads/denials/signed URLs only.
Conditional:
  --confirm-ref <ref>        Required for portfolio (must equal the portfolio ref; smoke only).
Optional:
  --with-codemod-patch <p>   git apply the bucket codemod patch before child runs, reverse after.
  --report-out <path>        Write a PII-free JSON report.
  --bucket-map <path>        bucket-map.generated.json (default next to this script).
  --help, -h                 Show this help.

Exit codes: 0 pass; 1 a case failed or the run was refused; 2 bad arguments.
`;

export class UsageError extends Error {
  constructor(message, exitCode = 2) {
    super(message);
    this.exitCode = exitCode;
  }
}

// ---------------------------------------------------------------------------
// Pure: run resolution
// ---------------------------------------------------------------------------

/** Validate CLI args. Throws UsageError (exitCode 1 = refused, 2 = bad arguments). */
export function resolveAuthRun(args) {
  const { projectRef, mode, confirmRef } = args ?? {};
  if (!projectRef) throw new UsageError('--project-ref is required', 2);
  if (mode !== 'full' && mode !== 'smoke') throw new UsageError('--mode must be full or smoke', 2);
  if (projectRef === PROJECTS.ziko) throw new UsageError('ziko is the live source and is never a test target', 1);
  if (projectRef !== PROJECTS.scratch && projectRef !== PROJECTS.portfolio) {
    throw new UsageError('--project-ref must be the scratch or portfolio project', 1);
  }
  if (projectRef === PROJECTS.portfolio) {
    if (mode === 'full') throw new UsageError('full mode writes storage objects and is refused on portfolio', 1);
    if (confirmRef !== PROJECTS.portfolio) throw new UsageError('portfolio requires --confirm-ref equal to the portfolio ref', 1);
  }
  return { targetRef: projectRef, mode, confirmRef: confirmRef ?? null };
}

// ---------------------------------------------------------------------------
// Pure: matrix
// ---------------------------------------------------------------------------

export const WRITE_OPS = Object.freeze(['upload', 'update', 'delete', 'link', 'revoke']);
const ROLES = ['a', 'b', 'c', 'd'];
const FULL = ['full'];
const BOTH = ['full', 'smoke'];

/**
 * Case = { id, surface, bucket (SOURCE id), actor, op, expect, modes, ...params }.
 * expect: allow | deny | reject | baseline | deferred-table-codemod.
 * Ops that mutate (WRITE_OPS, signed-upload, service-upload, baseline-remove) are full-only.
 * Order matters: later cases depend on earlier uploads, link and revoke.
 */
function mk(id, surface, bucket, actor, op, expect, modes, extra = {}) {
  return { id, surface, bucket, actor, op, expect, modes, ...extra };
}

export const MATRIX = Object.freeze([
  // avatars (public)
  mk('av-upload-own', 'mobile-profile', 'avatars', 'A', 'upload', 'allow', FULL, { file: 'own.png', mime: 'image/png' }),
  mk('av-update-own', 'mobile-profile', 'avatars', 'A', 'update', 'allow', FULL, { file: 'own.png', mime: 'image/png' }),
  mk('av-public-read', 'mobile-profile', 'avatars', 'anon', 'public-read', 'allow', BOTH, { folder: 'A', file: 'own.png' }),
  mk('av-foreign-write', 'mobile-profile', 'avatars', 'B', 'upload', 'deny', FULL, { folder: 'A', file: 'evil.png', mime: 'image/png' }),
  mk('av-delete-own', 'mobile-profile', 'avatars', 'A', 'delete', 'allow', FULL, { file: 'own.png' }),

  // coach-logos (public)
  mk('cl-upload-own', 'web-coach', 'coach-logos', 'C', 'upload', 'allow', FULL, { file: 'own.png', mime: 'image/png' }),
  mk('cl-public-read', 'web-coach', 'coach-logos', 'anon', 'public-read', 'allow', BOTH, { folder: 'C', file: 'own.png' }),
  mk('cl-foreign-write', 'web-coach', 'coach-logos', 'D', 'upload', 'deny', FULL, { folder: 'C', file: 'evil.png', mime: 'image/png' }),

  // exercise-media (public, 2 MB, png/gif)
  mk('em-public-read', 'plugin-coach', 'exercise-media', 'anon', 'public-read', 'allow', BOTH, { folder: 'A', file: 'seed.gif' }),
  mk('em-auth-upload', 'plugin-coach', 'exercise-media', 'A', 'upload', 'deny', FULL, { file: 'own.png', mime: 'image/png' }),
  mk('em-service-oversize', 'storage-only', 'exercise-media', 'service', 'service-upload', 'reject', FULL, { folder: 'A', file: 'big.png', mime: 'image/png', size: 2 * 1024 * 1024 + 1 }),
  mk('em-service-textplain', 'storage-only', 'exercise-media', 'service', 'service-upload', 'reject', FULL, { folder: 'A', file: 'note.png', mime: 'text/plain' }),

  // profile-photos (private) + D-02 baseline quirks
  mk('pp-upload-own', 'mobile-profile', 'profile-photos', 'A', 'upload', 'allow', FULL, { file: 'own.png', mime: 'image/png' }),
  mk('pp-signed-read', 'mobile-profile', 'profile-photos', 'A', 'sign-url', 'allow', FULL, { file: 'seed.png' }),
  mk('pp-foreign-write', 'mobile-profile', 'profile-photos', 'B', 'upload', 'deny', FULL, { folder: 'A', file: 'evil.png', mime: 'image/png' }),
  mk('pp-baseline-public-url', 'mobile-profile', 'profile-photos', 'anon', 'baseline-public-url', 'baseline', BOTH, { folder: 'A', file: 'seed.png' }),
  mk('pp-baseline-remove', 'mobile-profile', 'profile-photos', 'A', 'baseline-remove', 'baseline', FULL, { file: 'seed.png' }),

  // scan-photos (private)
  mk('sp-signed-upload-own', 'plugin-nutrition', 'scan-photos', 'A', 'signed-upload', 'allow', FULL, { file: 'own.png', mime: 'image/png' }),
  mk('sp-sign-upload-own', 'plugin-nutrition', 'scan-photos', 'A', 'sign-upload', 'allow', BOTH, { file: 'smoke.png' }),
  mk('sp-read-own', 'plugin-nutrition', 'scan-photos', 'A', 'read', 'allow', FULL, { file: 'seed.png' }),
  mk('sp-backend-own', 'backend', 'scan-photos', 'A', 'route-upload-url', 'allow', BOTH),
  mk('sp-backend-foreign', 'backend', 'scan-photos', 'B', 'route-upload-url', 'deny', BOTH),
  mk('sp-foreign-read', 'plugin-nutrition', 'scan-photos', 'B', 'read', 'deny', BOTH, { folder: 'A', file: 'seed.png' }),
  mk('sp-delete-own', 'plugin-nutrition', 'scan-photos', 'A', 'delete', 'allow', FULL, { file: 'own.png' }),

  // coach-kyc (private)
  mk('ck-signed-upload', 'web-coach', 'coach-kyc', 'C', 'signed-upload', 'allow', FULL, { file: 'own.png', mime: 'image/png' }),
  mk('ck-web-upload-url-own', 'web-coach', 'coach-kyc', 'C', 'route-upload-url', 'allow', BOTH),
  mk('ck-web-upload-url-foreign', 'web-coach', 'coach-kyc', 'D', 'route-upload-url', 'deny', BOTH),
  mk('ck-web-upload-url-unknown-bucket', 'web-coach', 'coach-kyc', 'C', 'route-upload-url', 'reject', BOTH),
  mk('ck-web-photo-own', 'web-coach', 'coach-kyc', 'C', 'route-photo', 'allow', FULL),
  mk('ck-web-photo-foreign', 'web-coach', 'coach-kyc', 'A', 'route-photo', 'deny', BOTH),
  mk('ck-foreign-read', 'web-coach', 'coach-kyc', 'D', 'read', 'deny', FULL, { folder: 'C', file: 'seed.png' }),
  mk('ck-upsert-overwrite', 'web-coach', 'coach-kyc', 'C', 'update', 'deny', FULL, { file: 'seed.png', mime: 'image/png' }),

  // coach-exercises (private)
  mk('ce-upload-own', 'plugin-coach', 'coach-exercises', 'C', 'upload', 'allow', FULL, { file: 'own.png', mime: 'image/png' }),
  mk('ce-foreign-read', 'plugin-coach', 'coach-exercises', 'D', 'read', 'deny', BOTH, { folder: 'C', file: 'seed.png' }),

  // exports (private, service-written)
  mk('ex-read-own', 'storage-only', 'exports', 'A', 'read', 'allow', FULL, { file: 'seed.png' }),
  mk('ex-foreign-read', 'storage-only', 'exports', 'B', 'read', 'deny', FULL, { folder: 'A', file: 'seed.png' }),
  mk('ex-upload-denied', 'storage-only', 'exports', 'A', 'upload', 'deny', FULL, { file: 'own.png', mime: 'image/png' }),

  // ai-imports (25 MB, doc mimes)
  mk('ai-signed-upload-pdf', 'web-coach', 'ai-imports', 'A', 'signed-upload', 'allow', FULL, { file: 'own.pdf', mime: 'application/pdf' }),
  mk('ai-wrong-mime', 'web-coach', 'ai-imports', 'A', 'upload', 'reject', FULL, { file: 'bad.png', mime: 'image/png' }),
  mk('ai-foreign-read', 'web-coach', 'ai-imports', 'B', 'read', 'deny', BOTH, { folder: 'A', file: 'own.pdf' }),
  mk('ai-backend-own', 'backend', 'ai-imports', 'A', 'route-upload-url', 'allow', BOTH),
  mk('ai-backend-foreign', 'backend', 'ai-imports', 'B', 'route-upload-url', 'deny', BOTH),

  // coach-videos (private, video mimes) with link lifecycle
  mk('cv-upload-own', 'plugin-coach', 'coach-videos', 'A', 'upload', 'allow', FULL, { file: 'own.mp4', mime: 'video/mp4' }),
  mk('cv-wrong-mime', 'plugin-coach', 'coach-videos', 'A', 'upload', 'reject', FULL, { file: 'bad.txt', mime: 'text/plain' }),
  mk('cv-link', 'plugin-coach', 'coach-videos', 'service', 'link', 'allow', FULL),
  mk('cv-coach-read-linked', 'plugin-coach', 'coach-videos', 'C', 'read', 'allow', FULL, { folder: 'A', file: 'own.mp4' }),
  mk('cv-outsider-read', 'plugin-coach', 'coach-videos', 'D', 'read', 'deny', FULL, { folder: 'A', file: 'own.mp4' }),
  mk('cv-revoke', 'plugin-coach', 'coach-videos', 'service', 'revoke', 'allow', FULL),
  mk('cv-coach-read-revoked', 'plugin-coach', 'coach-videos', 'C', 'read', 'deny', FULL, { folder: 'A', file: 'own.mp4' }),

  // backend coach routes: every one queries an unprefixed table (table codemod not in Phase 5)
  mk('bk-clients-links-me', 'backend', 'coach-kyc', 'A', 'route-call', 'deferred-table-codemod', FULL, { route: 'GET /coach/clients/links/me' }),
  mk('bk-videos-upload-url', 'backend', 'coach-videos', 'A', 'route-call', 'deferred-table-codemod', FULL, { route: 'POST /coach/videos/upload-url' }),
  mk('bk-videos-signed-url', 'backend', 'coach-videos', 'C', 'route-call', 'deferred-table-codemod', FULL, { route: 'GET /coach/videos/:videoId/signed-url' }),
  mk('bk-videos-audio-url', 'backend', 'coach-videos', 'A', 'route-call', 'deferred-table-codemod', FULL, { route: 'GET /coach/videos/annotations/:annotationId/audio-url' }),
  mk('bk-exercises-media-url', 'backend', 'coach-exercises', 'A', 'route-call', 'deferred-table-codemod', FULL, { route: 'GET /coach/exercises/:id/media-url' }),
  mk('bk-imports-create', 'backend', 'ai-imports', 'A', 'route-call', 'deferred-table-codemod', FULL, { route: 'POST /coach/imports' }),
]);

export function casesFor(mode) {
  if (mode === 'full') return [...MATRIX];
  if (mode === 'smoke') return MATRIX.filter((c) => c.modes.includes('smoke'));
  throw new Error(`unknown mode: ${mode}`);
}

// ---------------------------------------------------------------------------
// Pure: evaluation, naming, report
// ---------------------------------------------------------------------------

/**
 * results: [{ id, status }] with status in allow|deny|reject|baseline|deferred-table-codemod|error.
 * A case passes when status === expect. Deferred cases (expect deferred-table-codemod and observed
 * the same) are counted separately and never as pass.
 */
export function evaluateMatrix(results, { cases = casesFor('full') } = {}) {
  const byId = new Map((results ?? []).map((r) => [r.id, r]));
  let passed = 0;
  let failed = 0;
  let deferred = 0;
  let missing = 0;
  const failures = [];
  const perCase = [];
  for (const c of cases) {
    const r = byId.get(c.id);
    if (!r) {
      missing += 1;
      failures.push({ id: c.id, reason: 'missing' });
      perCase.push({ id: c.id, observed: null, ok: false, deferred: false });
      continue;
    }
    const isDeferred = c.expect === 'deferred-table-codemod';
    const match = r.status === c.expect;
    if (isDeferred && match) {
      deferred += 1;
      perCase.push({ id: c.id, observed: r.status, ok: true, deferred: true });
    } else if (match) {
      passed += 1;
      perCase.push({ id: c.id, observed: r.status, ok: true, deferred: false });
    } else {
      failed += 1;
      failures.push({ id: c.id, reason: `expected ${c.expect}, observed ${r.status}` });
      perCase.push({ id: c.id, observed: r.status, ok: false, deferred: false });
    }
  }
  return { ok: failed === 0 && missing === 0, passed, failed, deferred, missing, failures, perCase };
}

export function testEmail(runId, role) {
  if (!/^[a-z0-9]+$/.test(String(runId))) throw new Error('runId must be lowercase alphanumeric');
  if (!ROLES.includes(role)) throw new Error('role must be a|b|c|d');
  return `ziko-storage-test-${runId}-${role}@example.com`;
}

/** PII-free report; the per-surface view maps cases to the app surface they exercise. */
export function buildAuthReport({ targetRef, mode, cases, evaluation }) {
  const perSurface = {};
  const byId = new Map(evaluation.perCase.map((p) => [p.id, p]));
  const caseRows = [];
  for (const c of cases) {
    const p = byId.get(c.id) ?? { observed: null, ok: false, deferred: false };
    const s = (perSurface[c.surface] ??= { pass: 0, fail: 0, deferred: 0 });
    if (p.deferred) s.deferred += 1;
    else if (p.ok) s.pass += 1;
    else s.fail += 1;
    caseRows.push({
      id: c.id,
      surface: c.surface,
      bucket: targetBucketId(c.bucket),
      actor: c.actor,
      op: c.op,
      expect: c.expect,
      observed: p.observed,
      ok: p.ok,
      ...(p.deferred && c.route ? { route: c.route } : {}),
    });
  }
  const report = {
    generated_at: new Date().toISOString(),
    target_ref: targetRef,
    mode,
    passed: evaluation.ok,
    counts: {
      passed: evaluation.passed,
      failed: evaluation.failed,
      deferred: evaluation.deferred,
      missing: evaluation.missing,
    },
    perSurface,
    deferredRoutes: caseRows.filter((r) => r.route).map((r) => ({ id: r.id, route: r.route })),
    cases: caseRows,
  };
  assertReportSafe(report);
  return report;
}

/** Write the gitignored .tmp fixture (credentials leave the process only through this file). */
export async function writeFixture(file, data) {
  await writeFile(file, JSON.stringify(data), { mode: 0o600 });
}

// ---------------------------------------------------------------------------
// Live runner (not unit tested; executed in plans 09 (scratch full) and 11 (portfolio smoke))
// ---------------------------------------------------------------------------

const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64',
);
const GIF = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');

const SEEDS = [
  { bucket: 'profile-photos', owner: 'A', file: 'seed.png', mime: 'image/png' },
  { bucket: 'scan-photos', owner: 'A', file: 'seed.png', mime: 'image/png' },
  { bucket: 'coach-kyc', owner: 'C', file: 'seed.png', mime: 'image/png' },
  { bucket: 'coach-exercises', owner: 'C', file: 'seed.png', mime: 'image/png' },
  { bucket: 'exports', owner: 'A', file: 'seed.png', mime: 'image/png' },
  { bucket: 'exercise-media', owner: 'A', file: 'seed.gif', mime: 'image/gif' },
];

export function bytesFor(mime, size) {
  if (size) return Buffer.alloc(size, 0x61);
  if (mime === 'image/png') return PNG;
  if (mime === 'image/gif') return GIF;
  if (mime === 'application/pdf') return Buffer.from('%PDF-1.4\n%%EOF\n');
  if (mime === 'video/mp4') return Buffer.from('\u0000\u0000\u0000\u0018ftypmp42\u0000\u0000\u0000\u0000mp42isom');
  return Buffer.from('storage auth test');
}

/** Map a storage error to deny (policy/lookup) or reject (mime/size). */
export function classifyError(err) {
  const m = `${err?.message ?? ''} ${err?.statusCode ?? ''} ${err?.status ?? ''}`.toLowerCase();
  return /mime|exceed|too large|payload|\b413\b|\b415\b|not supported/.test(m) ? 'reject' : 'deny';
}

/** Map an HTTP status of a route handler to a matrix status. */
export function statusFromHttp(code) {
  if (code === 200) return 'allow';
  if (code === 401 || code === 403) return 'deny';
  if (code === 400) return 'reject';
  return 'error';
}

function safeMessage(err) {
  return redactPii(String(err?.message ?? err)).replace(/eyJ[\w.-]+/g, '[jwt]').slice(0, 300);
}

async function loadBucketMap(file) {
  const map = JSON.parse(await readFile(file, 'utf8'));
  const ids = new Map((map.buckets ?? []).map((b) => [b.id, b.target_id ?? targetBucketId(b.id)]));
  const needed = new Set(MATRIX.map((c) => c.bucket));
  for (const id of needed) if (!ids.has(id)) throw new Error('bucket map is missing a bucket used by the matrix');
  return Object.fromEntries([...needed].map((id) => [id, ids.get(id)]));
}

function runChild(cmd, args, { cwd = REPO_ROOT, env = process.env, timeoutMs = 300000 } = {}) {
  return new Promise((resolve) => {
    const child = spawn(cmd, args, { cwd, env, shell: IS_WIN, windowsHide: true });
    let stdout = '';
    let stderr = '';
    const timer = setTimeout(() => child.kill(), timeoutMs);
    child.stdout.on('data', (d) => (stdout += d));
    child.stderr.on('data', (d) => (stderr += d));
    child.on('close', (code) => {
      clearTimeout(timer);
      resolve({ code, stdout, stderr });
    });
    child.on('error', (err) => {
      clearTimeout(timer);
      resolve({ code: 1, stdout, stderr: String(err.message) });
    });
  });
}

// ---- codemod patch (needed because backend/web still name the old buckets until Phase 6) ----

async function patchFileList(patch) {
  const r = await runChild('git', ['apply', '--numstat', patch]);
  if (r.code !== 0) throw new Error('git apply --numstat failed for the codemod patch');
  return r.stdout.split('\n').filter(Boolean).map((l) => l.split('\t')[2]);
}

async function assertTreeClean(files, what) {
  const r = await runChild('git', ['status', '--porcelain', '--', ...files]);
  if (r.code !== 0 || r.stdout.trim() !== '') throw new Error(`${what}: working tree is not clean for the patch file list`);
}

// ---- setup / cleanup (service client lives only in these functions) ----

async function createUsers(state, { admin, createClient, url, publishable }) {
  for (const role of ROLES) {
    const password = randomBytes(18).toString('base64url');
    const email = testEmail(state.runId, role);
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { app: 'ziko', full_name: 'storage test' },
    });
    if (error || !data?.user) throw new Error(`createUser failed: ${safeMessage(error)}`);
    const key = role.toUpperCase();
    state.users[key] = { id: data.user.id };
    const client = createClient(url, publishable, { auth: { autoRefreshToken: false, persistSession: false } });
    const { data: s, error: sErr } = await client.auth.signInWithPassword({ email, password });
    if (sErr || !s?.session) throw new Error(`signInWithPassword failed: ${safeMessage(sErr)}`);
    state.users[key].jwt = s.session.access_token;
    state.users[key].refresh = s.session.refresh_token;
    state.clients[key] = client;
  }
}

async function seedObjects(state, admin) {
  for (const s of SEEDS) {
    const { error } = await admin.storage
      .from(state.buckets[s.bucket])
      .upload(`${state.users[s.owner].id}/${s.file}`, bytesFor(s.mime), { contentType: s.mime, upsert: true });
    if (error) throw new Error(`seed upload failed for ${state.buckets[s.bucket]}: ${safeMessage(error)}`);
  }
}

async function cleanup(state, admin, targetRef) {
  const problems = [];
  const uids = Object.values(state.users).map((u) => u.id).filter(Boolean);
  const inList = uids.map((u) => `'${u}'`).join(',');
  if (uids.length > 0) {
    try {
      const rows = await runSql(
        targetRef,
        `SELECT bucket_id, name FROM storage.objects WHERE bucket_id LIKE 'ziko-%' AND split_part(name, '/', 1) IN (${inList})`,
      );
      const byBucket = new Map();
      for (const r of rows) byBucket.set(r.bucket_id, [...(byBucket.get(r.bucket_id) ?? []), r.name]);
      for (const [b, names] of byBucket) {
        for (let i = 0; i < names.length; i += 100) {
          const { error } = await admin.storage.from(b).remove(names.slice(i, i + 100));
          if (error) problems.push(`object removal failed in ${b}`);
        }
      }
    } catch (err) {
      problems.push(`object cleanup failed: ${safeMessage(err)}`);
    }
    try {
      await runSql(
        targetRef,
        `DELETE FROM public.ziko_coach_client_links WHERE coach_id IN (${inList}) OR client_id IN (${inList}) RETURNING 1 AS n`,
      );
    } catch (err) {
      problems.push(`link cleanup failed: ${safeMessage(err)}`);
    }
    for (const id of uids) {
      const { error } = await admin.auth.admin.deleteUser(id);
      if (error) problems.push('deleteUser failed');
    }
  }
  for (const f of [FIXTURE_PATH, BACKEND_OUT, WEB_RESULTS, WEB_JSON]) await rm(f, { force: true });
  try {
    const users = await runSql(
      targetRef,
      `SELECT count(*)::int AS n FROM auth.users WHERE email LIKE 'ziko-storage-test-${state.runId}-%'`,
    );
    if (Number(users[0]?.n) !== 0) problems.push(`${users[0]?.n} test users remain`);
    if (uids.length > 0) {
      const objs = await runSql(
        targetRef,
        `SELECT count(*)::int AS n FROM storage.objects WHERE split_part(name, '/', 1) IN (${inList})`,
      );
      if (Number(objs[0]?.n) !== 0) problems.push(`${objs[0]?.n} test objects remain`);
    }
  } catch (err) {
    problems.push(`cleanup assertion failed: ${safeMessage(err)}`);
  }
  return problems;
}

// ---- storage-level case execution (user clients only) ----

function pathFor(c, state, mode) {
  if (c.op === 'sign-upload' || mode === 'full') {
    return `${state.users[c.folder ?? c.actor].id}/${c.file}`;
  }
  return state.existing[c.bucket] ?? null;
}

async function execCase(c, state, mode, { admin, targetRef, anon }) {
  const bucketId = state.buckets[c.bucket];
  const cl = c.actor === 'anon' ? anon : state.clients[c.actor];
  if (c.op === 'link' || c.op === 'revoke') {
    const sql =
      c.op === 'link'
        ? `INSERT INTO public.ziko_coach_client_links (coach_id, client_id) VALUES ('${state.users.C.id}', '${state.users.A.id}') RETURNING 1 AS n`
        : `UPDATE public.ziko_coach_client_links SET revoked_at = now() WHERE coach_id = '${state.users.C.id}' AND client_id = '${state.users.A.id}' RETURNING 1 AS n`;
    const rows = await runSql(targetRef, sql);
    return rows.length === 1 ? 'allow' : 'error';
  }
  if (c.op === 'route-upload-url' || c.op === 'route-photo' || c.op === 'route-call') return null; // children
  const p = pathFor(c, state, mode);
  if (!p) return 'error';
  const mime = c.mime ?? 'image/png';
  switch (c.op) {
    case 'upload':
    case 'update': {
      const { error } = await cl.storage
        .from(bucketId)
        .upload(p, bytesFor(mime, c.size), { contentType: mime, upsert: c.op === 'update' });
      return error ? classifyError(error) : 'allow';
    }
    case 'service-upload': {
      const { error } = await admin.storage.from(bucketId).upload(p, bytesFor(mime, c.size), { contentType: mime, upsert: true });
      return error ? classifyError(error) : 'allow';
    }
    case 'signed-upload': {
      const s = await cl.storage.from(bucketId).createSignedUploadUrl(p);
      if (s.error || !s.data) return classifyError(s.error);
      const u = await cl.storage.from(bucketId).uploadToSignedUrl(p, s.data.token, bytesFor(mime, c.size), { contentType: mime });
      return u.error ? classifyError(u.error) : 'allow';
    }
    case 'sign-upload': {
      const s = await cl.storage.from(bucketId).createSignedUploadUrl(p);
      return s.error || !s.data?.token ? classifyError(s.error) : 'allow';
    }
    case 'sign-url': {
      const s = await cl.storage.from(bucketId).createSignedUrl(p, 60);
      return s.error || !s.data?.signedUrl ? 'deny' : 'allow';
    }
    case 'read': {
      const { error } = await cl.storage.from(bucketId).download(p);
      return error ? 'deny' : 'allow';
    }
    case 'delete': {
      const r = await cl.storage.from(bucketId).remove([p]);
      return r.error || (r.data?.length ?? 0) === 0 ? 'deny' : 'allow';
    }
    case 'baseline-remove': {
      const r = await cl.storage.from(bucketId).remove([p]);
      if (r.error) return 'deny';
      return (r.data?.length ?? 0) === 0 ? 'baseline' : 'allow';
    }
    case 'public-read':
    case 'baseline-public-url': {
      const { data } = cl.storage.from(bucketId).getPublicUrl(p);
      const res = await fetch(data.publicUrl);
      if (c.op === 'public-read') return res.status === 200 ? 'allow' : 'deny';
      return res.status === 200 ? 'allow' : 'baseline';
    }
    default:
      return 'error';
  }
}

function parseChildJson(stdout) {
  const line = stdout.split('\n').map((l) => l.trim()).filter((l) => l.startsWith('{')).pop();
  return line ? JSON.parse(line) : null;
}

async function runLive(run, opts) {
  const { createClient } = await import('@supabase/supabase-js');
  const { targetRef, mode, confirmRef } = run;
  assertWriteAllowed({ projectRef: targetRef, confirmRef });
  const keys = await getProjectApiKeys(targetRef);
  const url = `https://${targetRef}.supabase.co`;
  const noSession = { auth: { autoRefreshToken: false, persistSession: false } };
  const admin = createClient(url, keys.secret, noSession);
  const anon = createClient(url, keys.publishable, noSession);
  const cases = casesFor(mode);
  const state = {
    runId: randomBytes(4).toString('hex'),
    users: {},
    clients: {},
    buckets: await loadBucketMap(opts.bucketMap),
    existing: {},
  };
  const results = [];
  let patchFiles = null;
  let patchApplied = false;
  let problems = [];
  try {
    if (opts.patch) {
      patchFiles = await patchFileList(opts.patch);
      await assertTreeClean(patchFiles, 'before codemod patch');
      const r = await runChild('git', ['apply', opts.patch]);
      if (r.code !== 0) throw new Error('git apply of the codemod patch failed');
      patchApplied = true;
    }
    if (mode === 'smoke') {
      for (const b of Object.keys(state.buckets)) {
        const rows = await runSql(targetRef, `SELECT name FROM storage.objects WHERE bucket_id = '${state.buckets[b]}' ORDER BY name LIMIT 1`);
        state.existing[b] = rows[0]?.name ?? null;
      }
    }
    await createUsers(state, { admin, createClient, url, publishable: keys.publishable });
    if (mode === 'full') await seedObjects(state, admin);

    for (const c of cases) {
      let status;
      try {
        status = await execCase(c, state, mode, { admin, targetRef, anon });
      } catch (err) {
        console.error(`case ${c.id}: ${safeMessage(err)}`);
        status = 'error';
      }
      if (status !== null) results.push({ id: c.id, status });
    }

    await writeFixture(FIXTURE_PATH, {
      url,
      publishable: keys.publishable,
      mode,
      runId: state.runId,
      users: state.users,
      buckets: state.buckets,
      existing: state.existing,
    });
    const childEnv = {
      ...process.env,
      SUPABASE_URL: url,
      SUPABASE_PUBLISHABLE_KEY: keys.publishable,
      SUPABASE_SERVICE_KEY: keys.secret,
      ZIKO_STORAGE_LIVE_FIXTURE: FIXTURE_PATH,
    };
    const be = await runChild(NPX, ['tsx', 'scripts/portfolio-migration/10-storage-auth-backend.ts'], { env: childEnv });
    const beJson = be.code === 0 ? parseChildJson(be.stdout) : null;
    if (beJson?.results) results.push(...beJson.results);
    else console.error(`backend child failed (exit ${be.code})`);

    const web = await runChild(
      NPX,
      ['vitest', 'run', 'src/app/api/__live__/storage-routes.live.test.ts', '--reporter=json', `--outputFile=${WEB_JSON}`],
      {
        cwd: path.join(REPO_ROOT, 'apps', 'web'),
        env: {
          ...process.env,
          ZIKO_STORAGE_LIVE_FIXTURE: FIXTURE_PATH,
          ZIKO_STORAGE_LIVE_RESULTS: WEB_RESULTS,
          NEXT_PUBLIC_SUPABASE_URL: url,
          NEXT_PUBLIC_SUPABASE_ANON_KEY: keys.publishable,
        },
      },
    );
    try {
      const webJson = JSON.parse(await readFile(WEB_RESULTS, 'utf8'));
      for (const [id, status] of Object.entries(webJson)) results.push({ id, status });
    } catch {
      console.error(`web live spec produced no results (exit ${web.code})`);
    }
  } finally {
    try {
      problems = await cleanup(state, admin, targetRef);
    } catch (err) {
      problems = [`cleanup threw: ${safeMessage(err)}`];
    }
    if (patchApplied) {
      const r = await runChild('git', ['apply', '-R', opts.patch]);
      let clean = false;
      try {
        await assertTreeClean(patchFiles, 'after codemod patch reverse');
        clean = r.code === 0;
      } catch {
        clean = false;
      }
      if (!clean) {
        console.error('FATAL: codemod patch could not be reversed cleanly; fix the working tree manually');
        process.exitCode = 1;
        problems.push('codemod patch left applied');
      }
    }
  }

  const evaluation = evaluateMatrix(results, { cases });
  const report = buildAuthReport({ targetRef, mode, cases, evaluation });
  if (problems.length > 0) {
    report.passed = false;
    report.cleanupProblems = problems.length;
    for (const p of problems) console.error(`cleanup: ${p}`);
  }
  return report;
}

export async function main(argv) {
  const args = parseCliArgs(argv, {
    'project-ref': 'string',
    mode: 'string',
    'confirm-ref': 'string',
    'with-codemod-patch': 'string',
    'report-out': 'string',
    'bucket-map': 'string',
  });
  if (args.help) {
    console.log(HELP);
    return 0;
  }
  let run;
  try {
    run = resolveAuthRun(args);
  } catch (err) {
    if (err instanceof UsageError) {
      console.error(`ERROR: ${err.message}`);
      return err.exitCode;
    }
    throw err;
  }
  const report = await runLive(run, {
    patch: args.withCodemodPatch ? path.resolve(args.withCodemodPatch) : null,
    bucketMap: args.bucketMap ? path.resolve(args.bucketMap) : DEFAULT_MAP,
  });
  if (args.reportOut) await writeFile(args.reportOut, `${JSON.stringify(report, null, 2)}\n`);
  console.log(
    `storage auth ${report.mode} on ${report.target_ref}: ${report.passed ? 'PASS' : 'FAIL'} ` +
      `(pass ${report.counts.passed}, fail ${report.counts.failed}, deferred ${report.counts.deferred}, missing ${report.counts.missing})`,
  );
  for (const [s, v] of Object.entries(report.perSurface)) console.log(`  ${s}: pass ${v.pass}, fail ${v.fail}, deferred ${v.deferred}`);
  for (const c of report.cases.filter((x) => !x.ok)) console.log(`  FAIL ${c.id}: expected ${c.expect}, observed ${c.observed}`);
  return report.passed ? 0 : 1;
}

if (isMain(import.meta.url)) {
  main(process.argv.slice(2))
    .then((code) => process.exit(process.exitCode || code))
    .catch((err) => {
      console.error(`ERROR: ${safeMessage(err)}`);
      process.exit(1);
    });
}
