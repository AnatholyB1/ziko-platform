import { test } from 'node:test';
import assert from 'node:assert/strict';

import { PROJECTS } from '../auth-merge/lib.mjs';
import {
  evaluateCase,
  buildChecks,
  webInlinedRef,
  buildHeaders,
  resolveSmokeRun,
  BYPASS_HEADER,
} from './15-smoke-core-flows.mjs';

test('S1 evaluateCase exact match only', () => {
  assert.equal(evaluateCase(200, 200), true);
  assert.equal(evaluateCase(200, 201), false);
  assert.equal(evaluateCase(200, '200'), false);
  assert.equal(evaluateCase(401, undefined), false);
  assert.equal(evaluateCase('ok', null), false);
  assert.equal(evaluateCase('ok', 'unknown'), false);
});

test('S2 buildChecks order and skips', () => {
  const full = buildChecks({});
  assert.deepEqual(full, [
    'api-health', 'login-athlete', 'read-credits', 'read-own-profile', 'write-own-row', 'read-back',
    'delete-own-row', 'ai-chat', 'coach-crm-read', 'unauth-denied', 'web-home', 'web-login', 'web-inlined-ref',
  ]);
  assert.ok(!buildChecks({ skipAi: true }).includes('ai-chat'));
  const noWeb = buildChecks({ skipWeb: true });
  for (const id of ['web-home', 'web-login', 'web-inlined-ref']) assert.ok(!noWeb.includes(id));
  assert.ok(noWeb.includes('ai-chat'));
});

test('S3 webInlinedRef', () => {
  const t = PROJECTS.portfolio;
  const o = PROJECTS.ziko;
  assert.equal(webInlinedRef(`x https://${t}.supabase.co y`, t, o), true);
  assert.equal(webInlinedRef(`https://${t}.supabase.co https://${o}.supabase.co`, t, o), false);
  assert.equal(webInlinedRef('nothing', t, o), false);
  assert.equal(webInlinedRef(`https://${o}.supabase.co`, t, o), false);
});

test('S4 bypass header only when a secret is given', () => {
  assert.deepEqual(buildHeaders(null), {});
  assert.equal(buildHeaders('s3cret')[BYPASS_HEADER], 's3cret');
  assert.equal(BYPASS_HEADER, 'x-vercel-protection-bypass');
});

test('S5 arg validation', () => {
  assert.equal(resolveSmokeRun({ projectRef: PROJECTS.scratch, confirmRef: PROJECTS.scratch }).exitCode, 2);
  assert.equal(
    resolveSmokeRun({ projectRef: PROJECTS.ziko, confirmRef: PROJECTS.ziko, apiUrl: 'http://localhost:8080' }).exitCode,
    1,
  );
  assert.equal(
    resolveSmokeRun({ projectRef: PROJECTS.portfolio, confirmRef: PROJECTS.portfolio, apiUrl: 'http://localhost:8080' }).exitCode,
    1,
  );
  const ok = resolveSmokeRun({ projectRef: PROJECTS.scratch, confirmRef: PROJECTS.scratch, apiUrl: 'http://localhost:8080/' });
  assert.equal(ok.run.apiUrl, 'http://localhost:8080');
  assert.equal(ok.run.otherRef, PROJECTS.portfolio);
});
