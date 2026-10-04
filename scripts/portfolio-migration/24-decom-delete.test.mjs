import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PROJECTS } from '../auth-merge/lib.mjs';
import { assertCommittedSafe } from './18-decom-guard.mjs';
import { evaluatePreDelete, classifyGetResponse, buildDeletionLog } from './24-decom-delete.mjs';

const ZIKO = PROJECTS.ziko;
const SCRATCH = PROJECTS.scratch;
const PORTFOLIO = PROJECTS.portfolio;

test('evaluatePreDelete: matching ziko identity is ok', () => {
  const r = evaluatePreDelete({ project: 'ziko', ref: ZIKO, info: { id: ZIKO, name: 'ziko', status: 'ACTIVE_HEALTHY' } });
  assert.equal(r.ok, true);
});

test('evaluatePreDelete: ref field preferred, scratch name accepted', () => {
  const r = evaluatePreDelete({ project: 'scratch', ref: SCRATCH, info: { ref: SCRATCH, name: 'ziko-migration-scratch', status: 'ACTIVE_HEALTHY' } });
  assert.equal(r.ok, true);
});

test('evaluatePreDelete: portfolio-like name for ziko is not ok', () => {
  const r = evaluatePreDelete({ project: 'ziko', ref: ZIKO, info: { id: ZIKO, name: 'portfolio-like', status: 'ACTIVE_HEALTHY' } });
  assert.equal(r.ok, false);
  assert.match(r.detail, /name/);
});

test('evaluatePreDelete: ref mismatch is not ok', () => {
  const r = evaluatePreDelete({ project: 'ziko', ref: ZIKO, info: { id: PORTFOLIO, name: 'ziko', status: 'ACTIVE_HEALTHY' } });
  assert.equal(r.ok, false);
  assert.match(r.detail, /ref/);
});

test('evaluatePreDelete: already removed or going down is not ok', () => {
  for (const status of ['REMOVED', 'GOING_DOWN']) {
    assert.equal(evaluatePreDelete({ project: 'ziko', ref: ZIKO, info: { id: ZIKO, name: 'ziko', status } }).ok, false);
  }
});

test('evaluatePreDelete: missing info is not ok', () => {
  assert.equal(evaluatePreDelete({ project: 'ziko', ref: ZIKO, info: null }).ok, false);
  assert.equal(evaluatePreDelete({ project: 'portfolio', ref: ZIKO, info: { id: ZIKO, name: 'ziko' } }).ok, false);
});

test('classifyGetResponse', () => {
  assert.equal(classifyGetResponse({ status: 200, body: { status: 'ACTIVE_HEALTHY' } }), 'present');
  assert.equal(classifyGetResponse({ status: 200, body: { status: 'REMOVED' } }), 'in-progress');
  assert.equal(classifyGetResponse({ status: 200, body: { status: 'GOING_DOWN' } }), 'in-progress');
  assert.equal(classifyGetResponse({ status: 200, body: { status: 'REMOVING' } }), 'in-progress');
  assert.equal(classifyGetResponse({ status: 404, body: null }), 'gone');
  assert.equal(classifyGetResponse({ status: 410, body: null }), 'gone');
  for (const s of [401, 403, 429, 500, 503]) assert.equal(classifyGetResponse({ status: s, body: null }), 'error');
});

const LOG_INPUT = {
  project: 'ziko',
  ref: ZIKO,
  preDelete: { name: 'ziko', status: 'ACTIVE_HEALTHY', region: 'eu-west-3' },
  deletedAt: '2026-10-05T10:00:00.000Z',
  confirmedGoneAt: '2026-10-05T10:01:00.000Z',
  method: 'api',
  evidence: [
    { gate: 'backup_encrypted', path: 'scripts/portfolio-migration/reports/decom-backup.json', sha256: 'a'.repeat(64) },
    { gate: 'verify_pass', path: 'scripts/portfolio-migration/reports/decom-verify.json', sha256: 'b'.repeat(64) },
  ],
  authBlock: '07-17 D-15 confirmation',
};

test('buildDeletionLog: markdown and json, safe content', () => {
  const { json, markdown } = buildDeletionLog(LOG_INPUT);
  assert.match(markdown, /^# ziko deletion log/m);
  assert.ok(markdown.includes(ZIKO));
  assert.ok(markdown.includes('2026-10-05T10:00:00.000Z'));
  assert.ok(markdown.includes('api'));
  assert.ok(markdown.includes('eu-west-3'));
  assert.ok(markdown.includes('a'.repeat(64)));
  assert.match(markdown, /final action of milestone v1\.19/);
  assert.equal(json.ref, ZIKO);
  assert.equal(json.evidence.length, 2);
  assert.equal(assertCommittedSafe(markdown), true);
  assert.equal(assertCommittedSafe(json), true);
});

test('buildDeletionLog: dashboard method accepted, bad method rejected', () => {
  assert.equal(buildDeletionLog({ ...LOG_INPUT, method: 'dashboard' }).json.method, 'dashboard');
  assert.throws(() => buildDeletionLog({ ...LOG_INPUT, method: 'cli' }), /method/);
});

test('buildDeletionLog: refuses unsafe content', () => {
  assert.throws(() => buildDeletionLog({ ...LOG_INPUT, preDelete: { name: 'x@example.com', status: 's', region: 'r' } }));
});
