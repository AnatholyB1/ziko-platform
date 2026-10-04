#!/usr/bin/env node
/**
 * 24-decom-delete.mjs - fail-closed project deletion (D-16, scratch deletion D-12b).
 *
 * IRREVERSIBLE. The only path to a DELETE request passes every gate, in this fixed order:
 *   format/project/ref/confirm-ref -> gate file + evidence sha256 -> authorization block ->
 *   token -> pre-delete GET identity (name + ref) -> exactly one DELETE (never retried).
 * Project refs come only from DECOM_REFS (PROJECTS); no literal ref appears in this file.
 *
 * Modes (see HELP). Exit codes: 0 ok | 1 refused/failed | 2 bad args | 3 API refused the delete
 * (403/409, use the dashboard then --confirm-gone) | 4 deleted but not yet confirmed gone.
 * Output is PII-free and never contains the access token.
 */

// ---------------------------------------------------------------- pure evaluators

import { assertCommittedSafe, EXPECTED_NAMES, DECOM_REFS } from './18-decom-guard.mjs';

const IN_PROGRESS_RE = /^(REMOVED|GOING_DOWN|REMOVING|DELETING|DELETED)$/i;

/** Pre-delete identity check against the GET /v1/projects/{ref} body. */
export function evaluatePreDelete({ project, ref, info } = {}) {
  if (!Object.hasOwn(EXPECTED_NAMES, project)) return { ok: false, detail: "project must be 'ziko' or 'scratch'" };
  if (!info || typeof info !== 'object') return { ok: false, detail: 'no project info returned' };
  if (info.name !== EXPECTED_NAMES[project]) {
    return { ok: false, detail: `name mismatch (expected ${EXPECTED_NAMES[project]}, got ${String(info.name).slice(0, 60)})` };
  }
  if ((info.ref ?? info.id) !== ref) return { ok: false, detail: 'ref mismatch between request and returned project' };
  if (IN_PROGRESS_RE.test(String(info.status ?? ''))) {
    return { ok: false, detail: `project already ${String(info.status)}` };
  }
  return { ok: true, detail: 'identity matches' };
}

/** 'present' | 'in-progress' | 'gone' | 'error' */
export function classifyGetResponse({ status, body } = {}) {
  if (status === 404 || status === 410) return 'gone';
  if (status === 200) return IN_PROGRESS_RE.test(String(body?.status ?? '')) ? 'in-progress' : 'present';
  return 'error';
}

/** Deletion log pair: { json, markdown }, both safe for commit. */
export function buildDeletionLog({ project, ref, preDelete, deletedAt, confirmedGoneAt, method, evidence = [], authBlock } = {}) {
  if (method !== 'api' && method !== 'dashboard') throw new Error("method must be 'api' or 'dashboard'");
  const json = {
    project,
    ref,
    method,
    deleted_at: deletedAt,
    confirmed_gone_at: confirmedGoneAt,
    pre_delete: { name: preDelete?.name, status: preDelete?.status, region: preDelete?.region },
    evidence: evidence.map((e) => ({ gate: e.gate, path: e.path, sha256: e.sha256 })),
    auth_block: authBlock ?? null,
  };
  const lines = [
    `# ${project} deletion log`,
    '',
    `- Deleted at: ${deletedAt}`,
    `- Confirmed gone at: ${confirmedGoneAt}`,
    `- Project ref: ${ref}`,
    `- Method: ${method}`,
    `- Pre-delete identity: name ${json.pre_delete.name}, status ${json.pre_delete.status}, region ${json.pre_delete.region}`,
    authBlock ? `- Authorization: ${authBlock}` : '- Authorization: (none recorded)',
    '',
    '## Evidence pointers',
    '',
    ...(json.evidence.length
      ? json.evidence.map((e) => `- ${e.gate}: ${e.path} (sha256 ${e.sha256})`)
      : ['- (none)']),
    '',
    'This deletion is the final action of milestone v1.19.',
    '',
  ];
  const markdown = lines.join('\n');
  assertCommittedSafe(json);
  assertCommittedSafe(markdown);
  return { json, markdown };
}

export { DECOM_REFS };
