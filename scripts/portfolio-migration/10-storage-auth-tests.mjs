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

// LIVE-RUNNER-MARKER
