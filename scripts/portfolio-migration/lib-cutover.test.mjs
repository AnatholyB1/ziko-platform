import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { PROJECTS } from '../auth-merge/lib.mjs';
import { requireWriteAuthorization, writeSafeReport, detectProjectRefs, tempEmail } from './lib-cutover.mjs';

const PHRASE = 'cutover go';

function authFile(content) {
  const dir = mkdtempSync(join(tmpdir(), 'cutover-auth-'));
  const f = join(dir, 'auth.txt');
  writeFileSync(f, content);
  return f;
}

test('L1 requireWriteAuthorization', () => {
  assert.throws(() => requireWriteAuthorization({ projectRef: PROJECTS.ziko, confirmRef: PROJECTS.ziko }), /ziko/);
  assert.throws(() => requireWriteAuthorization({ projectRef: PROJECTS.scratch, confirmRef: PROJECTS.portfolio }), /confirm-ref/);
  assert.throws(() => requireWriteAuthorization({ projectRef: PROJECTS.scratch }), /confirm-ref/);
  assert.throws(
    () => requireWriteAuthorization({ projectRef: PROJECTS.portfolio, confirmRef: PROJECTS.portfolio }),
    /authorization/,
  );
  const bad = authFile(`Typed authorization: ${PHRASE} extra\nsomething`);
  assert.throws(
    () => requireWriteAuthorization({ projectRef: PROJECTS.portfolio, confirmRef: PROJECTS.portfolio, authorizationFile: bad, phrase: PHRASE }),
    /exact typed authorization/,
  );
  const good = authFile(`header\nTyped authorization: ${PHRASE}\n`);
  assert.doesNotThrow(() =>
    requireWriteAuthorization({ projectRef: PROJECTS.portfolio, confirmRef: PROJECTS.portfolio, authorizationFile: good, phrase: PHRASE }),
  );
  assert.doesNotThrow(() => requireWriteAuthorization({ projectRef: PROJECTS.scratch, confirmRef: PROJECTS.scratch }));
});

test('L2 writeSafeReport rejects PII and writes nothing', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'cutover-rep-'));
  const cases = [
    { a: 'x@y.com' },
    { a: '123e4567-e89b-12d3-a456-426614174000' },
    { a: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9' },
  ];
  for (const [i, obj] of cases.entries()) {
    const p = join(dir, `r${i}.json`);
    await assert.rejects(() => writeSafeReport(p, obj));
    assert.equal(existsSync(p), false);
  }
  const ok = join(dir, 'ok.json');
  await writeSafeReport(ok, { cases: [{ id: 'api-health', ok: true }] });
  assert.equal(existsSync(ok), true);
});

test('L3 detectProjectRefs', () => {
  const refs = detectProjectRefs(
    `a https://${PROJECTS.ziko}.supabase.co/x b https://${PROJECTS.portfolio}.supabase.co https://short.supabase.co ${PROJECTS.scratch}`,
  );
  assert.deepEqual([...refs].sort(), [PROJECTS.ziko, PROJECTS.portfolio].sort());
});

test('L4 tempEmail', () => {
  const e = tempEmail('abc123', 'athlete');
  assert.ok(e.includes('abc123'));
  assert.ok(e.endsWith('@example.com'));
  assert.throws(() => tempEmail('ABC', 'a'));
});
